import type { IndicatorComputeContext, IndicatorParamsByType, IndicatorType, MarketTimeframe  } from '@ai/shared'
import type { IndicatorValueUpsertInput } from '../repositories/indicator-value.repository'
import type { RuntimeIndicatorConfig } from './indicator-config.service'
import type {PrismaMarketTimeframe} from '@/common/utils/prisma-enum-mappers';
import { computeIndicator } from '@ai/shared'
import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  mapIndicatorType,
  mapTimeframe,

  reverseMapTimeframe
} from '@/common/utils/prisma-enum-mappers'
import { PrismaService } from '@/prisma/prisma.service'
import { IndicatorValueRepository } from '../repositories/indicator-value.repository'
import { IndicatorConfigService } from './indicator-config.service'

interface NewBarContext {
  symbolId: string
  symbolCode: string
  timeframe: MarketTimeframe
}

@Injectable()
export class IndicatorEngineService {
  private readonly logger = new Logger(IndicatorEngineService.name)

  constructor(
    @Inject(IndicatorConfigService)
    private readonly configService: IndicatorConfigService,
    @Inject(IndicatorValueRepository)
    private readonly valueRepository: IndicatorValueRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 褰撴柊鐨?K 绾夸繚瀛樺悗璋冪敤锛屽熀浜庡綋鍓嶉厤缃绠楁墍鏈夌浉鍏虫寚鏍?
   */
  async handleNewBar(ctx: NewBarContext): Promise<void> {
    const configs = this.configService.getRuntimeConfigs(ctx.symbolId, mapTimeframe(ctx.timeframe))
    if (!configs.length) return

    const maxWindow = this.getMaxWindow(configs)
    if (maxWindow <= 0) return

    const bars = await this.loadRecentBars(ctx.symbolId, mapTimeframe(ctx.timeframe), maxWindow)
    if (!bars.length) return

    const computeContext: IndicatorComputeContext = {
      symbol: ctx.symbolCode,
      timeframe: ctx.timeframe,
      bars,
    }

    const now = new Date()
    const latestBarTime = new Date(bars[bars.length - 1]!.timestamp)

    const values: IndicatorValueUpsertInput[] = configs
      .map(config => {
        const params = config.params as IndicatorParamsByType[IndicatorType]
        const value = computeIndicator(config.type, computeContext, params)
        if (value === null) return null
        return {
          indicatorConfigId: config.id,
          symbolId: ctx.symbolId,
          timeframe: mapTimeframe(ctx.timeframe),
          type: mapIndicatorType(config.type),
          time: latestBarTime,
          valueNumeric: value,
          valueJson: null,
          createdAt: now,
        }
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)

    if (!values.length) return

    await this.valueRepository.upsertMany(values)
  }

  private async loadRecentBars(symbolId: string, timeframe: PrismaMarketTimeframe, window: number) {
    const client = this.prisma.getClient()
    const bars = await client.marketBar.findMany({
      where: {
        symbolId,
        timeframe,
      },
      orderBy: { time: 'desc' },
      take: window + 1,
    })

    return bars
      .map(bar => ({
        symbol: '',
        timeframe: reverseMapTimeframe(bar.timeframe),
        open: bar.open.toString(),
        high: bar.high.toString(),
        low: bar.low.toString(),
        close: bar.close.toString(),
        volume: bar.volume?.toString(),
        quoteVolume: bar.quoteVolume?.toString(),
        trades: bar.trades ?? undefined,
        source: bar.source ?? undefined,
        timestamp: bar.time.getTime(),
        isFinal: bar.isFinal,
      }))
      .reverse()
  }

  private getMaxWindow(configs: RuntimeIndicatorConfig[]): number {
    let max = 0
    for (const config of configs) {
      const win = (config.params as { window?: number }).window
      if (typeof win === 'number' && win > max) {
        max = win
      }
    }
    return max
  }
}
