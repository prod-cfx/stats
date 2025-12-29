import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
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
  offset?: number // offset 分页：用于持续轮询所有市场
  usedCursor?: boolean // 上一轮是否使用了 cursor 模式（用于状态转换判断）
}

export interface PolymarketTaskMeta {
  /**
   * 任务级覆盖的 category（例如 "crypto" / "sports"），
   * 将覆盖 Job 内的默认值（例如 'crypto'）。
   */
  category?: string
  /**
   * 任务级覆盖的 tags：
   * - 建议使用字符串数组；
   * - 也兼容 tagsCsv（逗号分隔字符串）形式。
   */
  tags?: string[]
  tagsCsv?: string
}

@Injectable()
export class PolymarketMarketsJob implements DataPullJob<PolymarketTaskMeta> {
  readonly key = 'polymarket-markets-crypto'
  private readonly logger = new Logger(PolymarketMarketsJob.name)
  private readonly batchSize = 100
  /**
   * 默认 category（已标准化为小写、去掉首尾空格）
   * 实际使用时会与任务级 meta 合并，允许按任务覆盖。
   */
  private readonly defaultCategory?: string | null
  private readonly effectiveLimit: number // 实际请求的 limit（考虑 API maxLimit 限制）

  constructor(
    private readonly gammaClient: PolymarketGammaClient,
    private readonly repo: PolymarketRepository,
    private readonly configService: ConfigService,
  ) {
    const cfg = this.configService.get<PolymarketConfig>('polymarket')
    // 默认 category 现在不再通过全局 config/env 配置，而是固定为 'crypto'，
    // 并允许通过任务级 meta 覆盖（resolveCategory 中处理）。
    this.defaultCategory = 'crypto'
    
    // 计算实际请求的 limit（gamma-client 会 clamp 到 maxLimit）
    const maxLimit = cfg?.gamma.maxLimit ?? 200
    this.effectiveLimit = Math.min(this.batchSize, maxLimit)
  }

  async run(ctx: DataPullJobContext<PolymarketTaskMeta>): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    const category = this.resolveCategory(ctx.meta)
    const tags = this.resolveTags(ctx.meta)

    // 注意：Polymarket API 的 updated_since 参数实际不工作，无法做增量同步
    // 因此始终使用 offset 分页，持续轮询所有市场以获取状态更新
    const response = await this.gammaClient.listMarkets({
      limit: this.batchSize,
      cursor: cursor.nextCursor ?? null,
      offset: cursor.offset ?? 0,
      updatedSince: null, // API 不支持，保持 null
      category: category ?? null,
      tags: tags ?? undefined,
      // 不过滤 active/closed 状态，以便能够标记已关闭的市场为 inactive
      // isActive 标志会根据 API 返回的 active/closed 字段在 processMarket 中正确设置
    })

    let processed = 0
    let skipped = 0

    for (const market of response.markets) {
      const result = await this.processMarket(market, category)
      if (result.skipped) {
        skipped += 1
      } else {
        processed += 1
      }
    }

    const nextCursorValue = response.nextCursor ?? null
    const apiReturned = response.markets.length  // API 实际返回的数量
    
    // 计算下一次的 offset
    // 关键：必须基于 API 实际返回的数量（apiReturned），而不是过滤后的数量（processed）
    // 因为过滤后 crypto 市场可能只有个位数，会导致永远重置 offset=0，永远循环第一页
    // 注意：使用 effectiveLimit 而不是 batchSize 来判断，
    // 因为 gamma-client 会将 limit clamp 到 POLYMARKET_GAMMA_LIMIT
    let nextOffset = 0
    let usedCursor = false
    
    if (nextCursorValue) {
      // 有 cursor，进入 cursor 模式，offset 重置为 0
      nextOffset = 0
      usedCursor = true
    } else if (cursor.usedCursor) {
      // 上一轮使用了 cursor，但这一轮没有 nextCursor，说明 cursor 模式结束
      // 必须重置 offset=0 重新开始 offset 模式，否则会跳过前面的数据
      nextOffset = 0
      usedCursor = false
      this.logger.log(`Cursor mode ended, resetting offset to 0 for next cycle`)
    } else if (apiReturned >= this.effectiveLimit) {
      // 在 offset 模式下，API 返回了满批数据，继续下一页
      nextOffset = (cursor.offset ?? 0) + apiReturned
      usedCursor = false
    } else {
      // 在 offset 模式下，API 返回数据不满，说明到达末尾，重置为 0 开始新一轮
      nextOffset = 0
      usedCursor = false
      this.logger.log(`Reached end of markets (apiReturned=${apiReturned} < effectiveLimit=${this.effectiveLimit}), will restart from offset 0 on next run`)
    }
    
    const newCursor: PolymarketMarketsCursor = {
      nextCursor: nextCursorValue,
      offset: nextOffset,
      usedCursor,
    }

    return {
      fetchedCount: processed,
      newCursor: JSON.stringify(newCursor),
      meta: {
        markets: processed,
        skipped,
        total: response.markets.length,
        nextCursor: response.nextCursor ?? null,
        offset: nextOffset,
        category,
        tags,
      },
    }
  }

  private async processMarket(
    market: PolymarketGammaMarket,
    configuredCategory: string | null,
  ): Promise<{ skipped: boolean }> {
    // API 返回 events 数组，取第一个元素作为主事件
    const event = market.event ?? market.events?.[0]
    const m = market as any
    
    // 统一 category 为小写并去除空格
    // 注意：不应该用配置的默认 category 回填，否则会将无分类的市场错误地标记为 crypto
    const rawCategory = market.category ?? event?.category ?? null
    const normalizedCategory = rawCategory ? rawCategory.toLowerCase().trim() : null
    
    // 关键：Gamma API 的 category 参数不工作（忽略该查询参数），
    // 必须在本地过滤，否则会把所有历史市场全量 upsert 导致数据库膨胀
    if (configuredCategory && normalizedCategory !== configuredCategory) {
      // 不匹配配置的 category，跳过此市场
      return { skipped: true }
    }
    
    const marketRecord = await this.repo.upsertMarket({
      marketId: market.id,
      eventExternalId: m.eventId ?? m.event_id ?? event?.id ?? null,
      eventSlug: event?.slug ?? null,
      eventTitle: event?.title ?? null,
      // API 返回 camelCase，兼容 snake_case
      eventStartTime: this.toDate(event?.startDate ?? event?.start_date),
      eventEndTime: this.toDate(event?.endDate ?? event?.end_date),
      slug: market.slug,
      question: market.question ?? market.title,
      category: normalizedCategory,
      tags: this.extractTags(market, event),
      outcomeType: market.outcomeType ?? m.outcome_type ?? null,
      status: market.status ?? (m.closed ? 'closed' : 'open'),
      // API 返回 camelCase
      resolutionSource: m.resolutionSource ?? m.resolution_source ?? null,
      resolutionTime: this.toDate(m.resolutionTime ?? m.resolution_time),
      startTradingAt: this.toDate(m.startDate ?? m.start_date ?? m.createdAt ?? m.created_at),
      endTradingAt: this.toDate(m.endDate ?? m.end_date ?? m.closeDate ?? m.close_date ?? event?.endDate ?? event?.end_date),
      lastUpdatedAt: this.toDate(m.updatedAt ?? m.updated_at),
      feeRate: this.toDecimal(m.feeRate ?? m.fee_rate),
      liquidity: this.toDecimal(market.liquidity ?? m.liquidityNum ?? m.liquidity_num),
      volume24h: this.toDecimal(m.volume24hr ?? m.volume24h ?? m.volume_24h),
      volumeTotal: this.toDecimal(m.volumeTotal ?? m.volume_total),
      openInterest: this.toDecimal(m.openInterest ?? m.open_interest),
      isActive: m.active !== false && m.closed !== true,
      rawPayload: market as Record<string, unknown>,
    })

    // 处理 outcomes 字段的多种格式
    const outcomes = this.parseOutcomes(market)
    const outcomeInputs = outcomes
      .map(outcome => this.mapOutcome(outcome, marketRecord.id))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))

    if (outcomeInputs.length) {
      await this.repo.upsertOutcomes(outcomeInputs)
    }
    
    return { skipped: false }
  }

  private parseOutcomes(market: PolymarketGammaMarket): PolymarketGammaOutcome[] {
    // 0. 统一处理 clobTokenIds，如果是字符串先解析成数组
    let clobTokenIds: string[] | undefined
    const rawClobTokenIds = (market as any).clobTokenIds
    if (typeof rawClobTokenIds === 'string') {
      try {
        const parsed = JSON.parse(rawClobTokenIds)
        if (Array.isArray(parsed)) {
          clobTokenIds = parsed.map(String)
        }
      } catch (error) {
        this.logger.warn(`Failed to parse clobTokenIds JSON for market ${market.id}: ${String(error)}`)
      }
    } else if (Array.isArray(rawClobTokenIds)) {
      clobTokenIds = rawClobTokenIds.map(String)
    }

    // 1. 如果 outcomes 是数组，直接返回
    if (Array.isArray(market.outcomes)) {
      return market.outcomes
    }

    // 2. 如果 outcomes 是字符串，尝试解析为 JSON
    if (typeof market.outcomes === 'string') {
      try {
        const parsed = JSON.parse(market.outcomes)
        if (Array.isArray(parsed)) {
          // 如果是简单的字符串数组 ["Yes", "No"]，转换为 outcome 对象
          // 注意：只有当有真实的 clobTokenIds 时才创建 outcome
          // 否则订单簿作业会对假 token_id 永远返回 404
          if (!clobTokenIds || clobTokenIds.length === 0) {
            this.logger.debug(`Market ${market.id} has outcomes but no clobTokenIds, skipping outcomes`)
            return []
          }
          return parsed
            .map((name, index) => {
              const tokenId = clobTokenIds[index]
              if (!tokenId) return null
              return {
                id: `${market.id}-outcome-${index}`,
                token_id: tokenId,
                name: String(name),
              }
            })
            .filter((outcome): outcome is NonNullable<typeof outcome> => outcome !== null)
        }
      } catch (error) {
        this.logger.warn(`Failed to parse outcomes JSON for market ${market.id}: ${String(error)}`)
      }
    }

    // 3. 检查 clobTokenIds 字段
    if (clobTokenIds && clobTokenIds.length > 0) {
      return clobTokenIds.map((tokenId, index) => ({
        id: `${market.id}-outcome-${index}`,
        token_id: tokenId,
        name: `Outcome ${index + 1}`,
      }))
    }

    // 4. 返回空数组
    return []
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

  private resolveCategory(meta: PolymarketTaskMeta | null): string | null {
    const fromMeta = meta?.category
    const value = (fromMeta ?? this.defaultCategory ?? 'crypto') || 'crypto'
    return value.trim().toLowerCase()
  }

  private resolveTags(meta: PolymarketTaskMeta | null): string[] | null {
    if (!meta) return null

    const tags: string[] = []

    if (Array.isArray(meta.tags)) {
      for (const tag of meta.tags) {
        if (typeof tag === 'string' && tag.trim()) {
          tags.push(tag.trim())
        }
      }
    }

    if (typeof meta.tagsCsv === 'string' && meta.tagsCsv.trim()) {
      const parts = meta.tagsCsv
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
      tags.push(...parts)
    }

    if (!tags.length) return null
    // 去重
    return Array.from(new Set(tags))
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
