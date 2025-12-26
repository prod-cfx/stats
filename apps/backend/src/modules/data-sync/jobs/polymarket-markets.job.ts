import type { DataPullJob, JobRunResult } from '../contracts/data-pull-job'
import type { PolymarketGammaEvent, PolymarketGammaMarket, PolymarketGammaOutcome } from '@/clients/polymarket/types'
import type { PolymarketConfig } from '@/config/polymarket.config'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
// eslint-disable-next-line ts/consistent-type-imports
import { PolymarketGammaClient } from '@/clients/polymarket/gamma-client'
// eslint-disable-next-line ts/consistent-type-imports
import { PolymarketRepository } from '@/modules/polymarket/polymarket.repository'

interface PolymarketMarketsCursor {
  nextCursor?: string | null
  updatedSince?: string | null
  offset?: number // 备用分页：当 API 不返回 nextCursor 时使用 offset
  initialSyncComplete?: boolean // 标记初次全量同步是否完成
}

@Injectable()
export class PolymarketMarketsJob implements DataPullJob {
  readonly key = 'polymarket-markets-crypto'
  private readonly logger = new Logger(PolymarketMarketsJob.name)
  private readonly batchSize = 100
  private readonly category?: string | null

  constructor(
    private readonly gammaClient: PolymarketGammaClient,
    private readonly repo: PolymarketRepository,
    private readonly configService: ConfigService,
  ) {
    const cfg = this.configService.get<PolymarketConfig>('polymarket')
    this.category = cfg?.filters.category ?? 'crypto'
  }

  async run(currentCursor: string | null): Promise<JobRunResult> {
    const cursor = this.parseCursor(currentCursor)

    // 初次全量同步完成后，才使用 updatedSince 做增量更新
    const useIncrementalSync = cursor.initialSyncComplete === true
    
    const response = await this.gammaClient.listMarkets({
      limit: this.batchSize,
      cursor: cursor.nextCursor ?? null,
      offset: useIncrementalSync ? undefined : (cursor.offset ?? 0), // 增量模式不使用 offset
      updatedSince: useIncrementalSync ? (cursor.updatedSince ?? null) : null,
      category: this.category ?? null,
      // 不过滤 active/closed 状态，以便能够标记已关闭的市场为 inactive
      // isActive 标志会根据 API 返回的 active/closed 字段在 processMarket 中正确设置
    })

    let processed = 0
    let latestUpdatedIso = cursor.updatedSince ?? null

    for (const market of response.markets) {
      await this.processMarket(market)
      processed += 1

      const updatedIso = this.pickLatestTimestamp(market)
      if (updatedIso && (!latestUpdatedIso || updatedIso > latestUpdatedIso)) {
        latestUpdatedIso = updatedIso
      }
    }

    const nextCursorValue = response.nextCursor ?? null
    const hasMore = processed >= this.batchSize
    
    // 判断初次同步是否完成
    let initialSyncComplete = cursor.initialSyncComplete ?? false
    if (!initialSyncComplete && !nextCursorValue && !hasMore) {
      // 当没有 nextCursor 且返回数据少于批次大小时，认为初次同步完成
      initialSyncComplete = true
      this.logger.log(`Initial sync completed, will switch to incremental updates`)
    }
    
    const newCursor: PolymarketMarketsCursor = {
      nextCursor: nextCursorValue,
      updatedSince: initialSyncComplete ? (latestUpdatedIso ?? cursor.updatedSince ?? null) : null,
      offset: nextCursorValue ? 0 : (cursor.offset ?? 0) + processed,
      initialSyncComplete,
    }

    return {
      fetchedCount: processed,
      newCursor: JSON.stringify(newCursor),
      meta: {
        markets: processed,
        nextCursor: response.nextCursor ?? null,
        latestUpdatedIso,
        offset: newCursor.offset,
        initialSyncComplete,
      },
    }
  }

  private async processMarket(market: PolymarketGammaMarket): Promise<void> {
    // API 返回 events 数组，取第一个元素作为主事件
    const event = market.event ?? market.events?.[0]
    
    const marketRecord = await this.repo.upsertMarket({
      marketId: market.id,
      eventExternalId: market.event_id ?? (event as Record<string, any>)?.id ?? null,
      eventSlug: event?.slug ?? null,
      eventTitle: event?.title ?? null,
      eventStartTime: this.toDate(event?.start_date),
      eventEndTime: this.toDate(event?.end_date),
      slug: market.slug,
      question: market.question ?? market.title,
      category: market.category ?? event?.category ?? this.category ?? null,
      tags: this.extractTags(market, event),
      outcomeType: market.outcomeType ?? (market as Record<string, any>)?.outcome_type ?? null,
      status: market.status ?? ((market as Record<string, any>)?.closed ? 'closed' : 'open'),
      resolutionSource: market.resolution_source ?? null,
      resolutionTime: this.toDate(market.resolution_time),
      startTradingAt: this.toDate(market.start_date ?? (market as any)?.created_at),
      endTradingAt: this.toDate(market.end_date ?? market.close_date ?? event?.end_date),
      lastUpdatedAt: this.toDate((market as any)?.updated_at),
      feeRate: this.toDecimal((market as Record<string, any>)?.fee_rate),
      liquidity: this.toDecimal(market.liquidity ?? (market as Record<string, any>)?.liquidity_num),
      volume24h: this.toDecimal(market.volume24hr ?? (market as Record<string, any>)?.volume_24h),
      volumeTotal: this.toDecimal((market as Record<string, any>)?.volume_total),
      openInterest: this.toDecimal(market.open_interest ?? (market as Record<string, any>)?.openInterest),
      isActive: (market as Record<string, any>)?.active !== false && (market as Record<string, any>)?.closed !== true,
      rawPayload: market as Record<string, unknown>,
    })

    const outcomeInputs = (market.outcomes ?? [])
      .map(outcome => this.mapOutcome(outcome, marketRecord.id))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))

    if (outcomeInputs.length) {
      await this.repo.upsertOutcomes(outcomeInputs)
    }
  }

  private mapOutcome(outcome: PolymarketGammaOutcome, marketDbId: number) {
    if (!outcome.token_id) return null
    return {
      marketDbId,
      outcomeTokenId: outcome.token_id,
      name: outcome.name ?? outcome.side ?? null,
      shortName: (outcome as Record<string, any>)?.short_name ?? null,
      side: outcome.side ?? null,
      price: this.toDecimal(outcome.price),
      probability: this.toDecimal(outcome.probability),
      liquidity: this.toDecimal(outcome.liquidity),
      poolBalance: this.toDecimal(outcome.pool_balance),
      lastTradePrice: this.toDecimal(outcome.last_trade_price),
      lastTradeAt: this.toDate(outcome.last_trade_time),
      rawPayload: outcome as Record<string, unknown>,
    }
  }

  private extractTags(market: PolymarketGammaMarket, event?: PolymarketGammaEvent): string[] {
    const tags = new Set<string>()
    ;(market.tags ?? []).forEach(tag => tag && tags.add(tag))
    ;(event?.tags ?? []).forEach(tag => tag && tags.add(tag))
    const legacyTags = (market as Record<string, any>)?.tag_ids ?? []
    if (Array.isArray(legacyTags)) {
      legacyTags.forEach(tag => {
        if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim())
      })
    }
    return [...tags]
  }

  private parseCursor(currentCursor: string | null): PolymarketMarketsCursor {
    if (!currentCursor) {
      return {}
    }
    try {
      const parsed = JSON.parse(currentCursor) as PolymarketMarketsCursor
      return parsed ?? {}
    } catch {
      this.logger.warn(`Invalid cursor detected for ${this.key}, resetting.`)
      return {}
    }
  }

  private pickLatestTimestamp(market: PolymarketGammaMarket): string | null {
    const candidates = [
      (market as any)?.updated_at,
      market?.close_date,
      market?.end_date,
      market?.start_date,
      market?.created_at,
    ].filter(Boolean) as (string | number)[]

    const isoTimes = candidates
      .map(value => this.toDate(value))
      .filter((value): value is Date => value instanceof Date)
      .map(date => date.toISOString())

    if (!isoTimes.length) return null
    return isoTimes.sort().at(-1) ?? null
  }

  private toDate(value?: string | number | Date | null): Date | null {
    if (value == null) return null
    if (value instanceof Date) return value
    if (typeof value === 'number') {
      const ms = value > 1_000_000_000_000 ? value : value * 1000
      return new Date(ms)
    }
    const parsed = Date.parse(value)
    if (Number.isNaN(parsed)) return null
    return new Date(parsed)
  }

  private toDecimal(value?: string | number | null): string | null {
    if (value == null) return null
    if (typeof value === 'string') return value
    if (typeof value === 'number' && Number.isFinite(value)) return value.toString()
    return null
  }
}
