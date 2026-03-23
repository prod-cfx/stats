import type { IndicatorParamsByType, IndicatorType } from '@ai/shared'
import type { OnModuleInit } from '@nestjs/common'
import type { IndicatorSeriesQuery, IndicatorSnapshotQuery } from '../repositories/indicator-value.repository'
import type {
  MarketTimeframe,
  Prisma,
  IndicatorConfig as PrismaIndicatorConfig,
  IndicatorType as PrismaIndicatorType,
} from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { IndicatorConfigRepository } from '../repositories/indicator-config.repository'
 
import { IndicatorValueRepository } from '../repositories/indicator-value.repository'

export interface IndicatorConfigCreateInput {
  symbolId: string
  timeframe: MarketTimeframe
  type: PrismaIndicatorType
  name: string
  params: unknown
  isEnabled: boolean
  description?: string | null
}

export interface IndicatorConfigUpdateInput {
  symbolId?: string
  timeframe?: MarketTimeframe
  type?: PrismaIndicatorType
  name?: string
  params?: unknown
  isEnabled?: boolean
  description?: string | null
}

export interface RuntimeIndicatorConfig {
  id: string
  symbolId: string
  timeframe: MarketTimeframe
  type: IndicatorType
  params: IndicatorParamsByType[IndicatorType]
}

@Injectable()
export class IndicatorConfigService implements OnModuleInit {
  private readonly logger = new Logger(IndicatorConfigService.name)
  private readonly runtimeConfigs = new Map<string, RuntimeIndicatorConfig[]>()

  constructor(
    @Inject(IndicatorConfigRepository)
    private readonly repository: IndicatorConfigRepository,
    @Inject(IndicatorValueRepository)
    private readonly indicatorValueRepository: IndicatorValueRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.reloadAllRuntimeConfigs()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Skip indicator runtime preload on module init: ${message}`)
    }
  }

  /**
   * 用于指标引擎：按 symbolId + timeframe 获取已解析参数的运行时配置
   */
  getRuntimeConfigs(symbolId: string, timeframe: MarketTimeframe): RuntimeIndicatorConfig[] {
    const key = this.buildKey(symbolId, timeframe)
    return this.runtimeConfigs.get(key) ?? []
  }

  async reloadAllRuntimeConfigs(): Promise<void> {
    let records: PrismaIndicatorConfig[] = []
    try {
      records = await this.repository.listAllActive()
    } catch (error) {
      if (!this.isMissingIndicatorConfigTableError(error)) {
        throw error
      }
      this.logger.warn(
        'indicator_configs table is missing in current database; skip indicator runtime preload',
      )
    }
    this.runtimeConfigs.clear()

    for (const record of records) {
      try {
        const parsed = this.toRuntimeConfig(record)
        const key = this.buildKey(record.symbolId, record.timeframe)
        const existing = this.runtimeConfigs.get(key) ?? []
        existing.push(parsed)
        this.runtimeConfigs.set(key, existing)
      } catch (error) {
        this.logger.warn(
          `Failed to load indicator config ${record.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }

    this.logger.log(`Indicator runtime configs loaded: ${this.runtimeConfigs.size} symbol/timeframe groups`)
  }

  private isMissingIndicatorConfigTableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    const code = (error as { code?: unknown }).code
    return code === 'P2021'
  }

  async listForAdmin(params: {
    symbolCode?: string
    timeframe?: MarketTimeframe
    type?: string
    isEnabled?: boolean
    page: number
    limit: number
  }) {
    const skip = (params.page - 1) * params.limit
    const [items, total] = await this.repository.list({
      symbolCode: params.symbolCode,
      timeframe: params.timeframe,
      type: params.type,
      isEnabled: params.isEnabled,
      skip,
      take: params.limit,
    })
    return new BasePaginationResponseDto(total, params.page, params.limit, items)
  }

  async create(data: IndicatorConfigCreateInput) {
    const created = await this.repository.create({
      symbol: { connect: { id: data.symbolId } },
      timeframe: data.timeframe,
      type: data.type,
      name: data.name,
      params: data.params as Prisma.JsonValue,
      isEnabled: data.isEnabled,
      description: data.description,
    })
    await this.reloadAllRuntimeConfigs()
    return created
  }

  async update(id: string, data: IndicatorConfigUpdateInput) {
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new DomainException('Indicator config not found', {
        code: ErrorCode.INDICATOR_CONFIG_NOT_FOUND,
        args: { id },
      })
    }

    const updated = await this.repository.update(id, {
      timeframe: data.timeframe,
      type: data.type,
      name: data.name,
      params: data.params as Prisma.JsonValue | undefined,
      isEnabled: data.isEnabled,
      description: data.description,
      symbol:
        data.symbolId && data.symbolId !== existing.symbolId
          ? {
              connect: { id: data.symbolId },
            }
          : undefined,
    })

    await this.reloadAllRuntimeConfigs()
    return updated
  }

  async getSymbolByCode(code: string): Promise<{ id: string; code: string }> {
    const symbol = await this.repository.findSymbolByCode(code.trim().toUpperCase())
    if (!symbol) {
      throw new DomainException('Symbol not found', {
        code: ErrorCode.MARKET_SYMBOL_NOT_FOUND,
        args: { symbol: code },
        status: 404,
      })
    }
    return symbol
  }

  async delete(id: string) {
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new DomainException('Indicator config not found', {
        code: ErrorCode.INDICATOR_CONFIG_NOT_FOUND,
        args: { id },
      })
    }
    const deleted = await this.repository.delete(id)
    await this.reloadAllRuntimeConfigs()
    return deleted
  }

  private toRuntimeConfig(record: PrismaIndicatorConfig): RuntimeIndicatorConfig {
    const paramsRaw = (record.params ?? {}) as unknown
    if (!paramsRaw || typeof paramsRaw !== 'object') {
      throw new DomainException('Invalid indicator config params', {
        code: ErrorCode.INDICATOR_CONFIG_INVALID_PARAMS,
        args: { id: record.id },
      })
    }

    const params = paramsRaw as IndicatorParamsByType[IndicatorType]
    if (typeof (params as { window?: unknown }).window !== 'number') {
      throw new DomainException('Indicator config missing window param', {
        code: ErrorCode.INDICATOR_CONFIG_INVALID_PARAMS,
        args: { id: record.id },
      })
    }

    return {
      id: record.id,
      symbolId: record.symbolId,
      timeframe: record.timeframe,
      type: record.type as IndicatorType,
      params,
    }
  }

  private buildKey(symbolId: string, timeframe: MarketTimeframe): string {
    return `${symbolId}:${timeframe}`
  }

  async getIndicatorSnapshot(query: IndicatorSnapshotQuery) {
    return this.indicatorValueRepository.getSnapshot(query)
  }

  async getIndicatorSeries(query: IndicatorSeriesQuery) {
    return this.indicatorValueRepository.getSeries(query)
  }
}
