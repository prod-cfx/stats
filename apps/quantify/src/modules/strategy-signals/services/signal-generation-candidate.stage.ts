import type { LegTimeframeData } from '@ai/shared/script-engine/helpers/context-builder'
import type { SignalGeneratorRepository } from '../repositories/signal-generator.repository'
import type { PrismaMarketTimeframe } from '@/common/utils/prisma-enum-mappers'
import type { GatewayBar, MarketDataReadGateway  } from '@/modules/market-data/services/market-data-read.gateway'
import type {
  StrategyDataRequirements,
  StrategyLegDefinition,
} from '@/modules/strategy-templates/types/strategy-template.types'
import type {
  IndicatorConfig,
  Prisma,
  StrategyTemplate,
  Symbol,
} from '@/prisma/prisma.types'
import { Logger } from '@nestjs/common'
import { reverseMapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { normalizeGatewayBars } from '@/modules/market-data/services/market-data-bar.mapper'
import {
  normalizeRequestedCode,
  normalizeRequestedCodeForMarket,
} from '@/modules/market-data/utils/market-symbol-code.util'
import {
  mapLegDataRequirementTimeframes,
} from '@/modules/strategy-templates/utils/data-requirements-timeframe.mapper'

const DEFAULT_BAR_LIMIT = 100

export interface IndicatorGroup {
  symbol: Symbol
  timeframe: PrismaMarketTimeframe
  fields: Map<string, IndicatorConfig>
}

export interface IndicatorSnapshot {
  field: string
  value: number
  recordedAt: Date
}

export class SignalGenerationCandidateStage {
  private readonly logger = new Logger(SignalGenerationCandidateStage.name)

  constructor(
    private readonly generatorRepository: SignalGeneratorRepository,
    private readonly marketDataReadGateway: MarketDataReadGateway,
  ) {}

  async findCandidateGroups(_strategy: StrategyTemplate, requiredFields: string[]) {
    if (!requiredFields.length) return []

    const configs = await this.generatorRepository.findEnabledIndicatorConfigs(requiredFields)
    const groups = new Map<string, IndicatorGroup>()

    for (const config of configs) {
      const key = `${config.symbolId}:${config.timeframe}`
      if (!groups.has(key)) {
        groups.set(key, {
          symbol: config.symbol,
          timeframe: config.timeframe,
          fields: new Map(),
        })
      }
      groups.get(key)?.fields.set(config.name, config)
    }

    return Array.from(groups.values()).filter(group =>
      requiredFields.every(field => group.fields.has(field)),
    )
  }

  async loadIndicatorSnapshots(
    group: IndicatorGroup,
    requiredFields: string[],
  ): Promise<IndicatorSnapshot[] | null> {
    const configIds = requiredFields
      .map(field => group.fields.get(field)?.id)
      .filter((id): id is string => Boolean(id))

    if (configIds.length !== requiredFields.length) {
      return null
    }

    const grouped = await this.generatorRepository.groupLatestIndicatorValues(configIds)
    if (!grouped.length) return null

    const latestRecords = await this.generatorRepository.findLatestIndicatorValues(
      grouped
        .filter(item => item._max.time)
        .map(item => ({
          indicatorConfigId: item.indicatorConfigId,
          time: item._max.time as Date,
        })),
    )

    const result: IndicatorSnapshot[] = []
    for (const field of requiredFields) {
      const config = group.fields.get(field)
      if (!config) return null
      const match = latestRecords.find(value => value.indicatorConfigId === config.id)
      if (!match || match.valueNumeric === null) return null

      const numeric = Number(match.valueNumeric)
      if (!Number.isFinite(numeric)) return null

      result.push({ field, value: numeric, recordedAt: match.time })
    }

    return result
  }

  async loadLatestBar(
    symbolId: string,
    timeframe: PrismaMarketTimeframe,
  ): Promise<GatewayBar | null> {
    return this.marketDataReadGateway.getLatestBarBySymbolId(
      symbolId,
      reverseMapTimeframe(timeframe),
    )
  }

  async loadRecentBars(
    symbolId: string,
    timeframe: string,
    limit: number = DEFAULT_BAR_LIMIT,
  ): Promise<GatewayBar[] | null> {
    try {
      return await this.marketDataReadGateway.getRecentBarsBySymbolId(symbolId, timeframe as any, limit)
    } catch (error) {
      this.logger.error(`Failed to load recent bars: ${(error as Error).message}`)
      return null
    }
  }

  async loadMultiLegDataBatch(
    legs: StrategyLegDefinition[],
    dataRequirements: StrategyDataRequirements,
    marketType: 'spot' | 'perp' | null = null,
  ): Promise<Record<string, Record<string, LegTimeframeData>>> {
    const symbolCodes = legs.map(leg => leg.symbol)
    const symbols = marketType
      ? await this.generatorRepository.findSymbolsByCodeForMarket(symbolCodes, marketType)
      : await this.generatorRepository.findSymbolsByCode(symbolCodes)
    const symbolMap = new Map(symbols.map(s => [s.code, s]))

    interface DataRequest {
      legId: string
      symbolId: string
      timeframe: string
      prismaTimeframe: PrismaMarketTimeframe
    }

    const dataRequests: DataRequest[] = []
    for (const leg of legs) {
      const normalizedLegSymbol = marketType
        ? normalizeRequestedCodeForMarket(leg.symbol, marketType)
        : normalizeRequestedCode(leg.symbol)
      const symbol = symbolMap.get(normalizedLegSymbol)
      if (!symbol) {
        this.logger.warn(`Symbol ${leg.symbol} not found for leg ${leg.id}`)
        continue
      }

      const timeframes = mapLegDataRequirementTimeframes(dataRequirements, leg.id)
      if (timeframes.length === 0) {
        this.logger.warn(`No timeframes defined for leg ${leg.id}`)
        continue
      }

      for (const timeframe of timeframes) {
        dataRequests.push({
          legId: leg.id,
          symbolId: symbol.id,
          timeframe: timeframe.appTimeframe,
          prismaTimeframe: timeframe.prismaTimeframe,
        })
      }
    }

    const barsResults = await Promise.all(
      dataRequests.map(async req => ({
        ...req,
        bars: await this.loadRecentBars(req.symbolId, req.timeframe, DEFAULT_BAR_LIMIT),
      })),
    )

    const result: Record<string, Record<string, LegTimeframeData>> = {}
    for (const data of barsResults) {
      if (!result[data.legId]) {
        result[data.legId] = {}
      }

      const bars = normalizeGatewayBars(data.bars ?? [])
      const currentPrice = bars.length > 0 ? bars[bars.length - 1].close : 0

      result[data.legId][data.timeframe] = {
        bars,
        indicators: {},
        currentPrice,
      }
    }

    return result
  }
}
