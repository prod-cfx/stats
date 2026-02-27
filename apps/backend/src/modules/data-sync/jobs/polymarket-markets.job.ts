import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import type {
  PolymarketGammaEvent,
  PolymarketGammaMarket,
  PolymarketGammaOutcome,
} from '@/clients/polymarket/types'
import type { PolymarketConfig } from '@/config/polymarket.config'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
// eslint-disable-next-line ts/consistent-type-imports
import { GoogleTranslateClient } from '@/clients/google-translate/google-translate.client'
// eslint-disable-next-line ts/consistent-type-imports
import { PolymarketGammaClient } from '@/clients/polymarket/gamma-client'
// eslint-disable-next-line ts/consistent-type-imports
import { PolymarketRepository } from '@/modules/polymarket/polymarket.repository'

interface MarketTranslations {
  questionZh: string | null
  eventTitleZh: string | null
  outcomes: Record<string, { nameZh: string | null; shortNameZh: string | null }>
}
type TranslationMap = Map<string, MarketTranslations>

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
  /**
   * 仅同步活跃市场（closed=false）。
   * 设为 true 可跳过已关闭的历史市场，大幅减少同步数据量。
   */
  onlyActive?: boolean
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
    private readonly translateClient: GoogleTranslateClient,
  ) {
    const cfg = this.configService.get<PolymarketConfig>('polymarket')
    // 默认 category 仍然来源于全局 config/env（兼容历史行为），
    // 同时允许通过任务级 meta 覆盖（resolveCategory 中处理）。
    const rawCategory = cfg?.filters.category ?? 'crypto'
    this.defaultCategory = rawCategory ? rawCategory.trim().toLowerCase() : 'crypto'

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
    const onlyActive = ctx.meta?.onlyActive ?? false
    const response = await this.gammaClient.listMarkets({
      limit: this.batchSize,
      cursor: cursor.nextCursor ?? null,
      offset: cursor.offset ?? 0,
      updatedSince: null, // API 不支持，保持 null
      category: category ?? null,
      tags: tags ?? undefined,
      // 当 onlyActive=true 时，仅获取未关闭的市场，跳过海量历史数据
      closed: onlyActive ? false : undefined,
    })

    let processed = 0
    let skipped = 0

    // 先过滤出需要处理的 markets（本地 category 过滤）
    const marketsToProcess: PolymarketGammaMarket[] = []
    for (const market of response.markets) {
      const event = market.event ?? market.events?.[0]
      const rawCategory = market.category ?? event?.category ?? null
      const normalizedCategory = rawCategory ? rawCategory.toLowerCase().trim() : null
      if (category && normalizedCategory !== category) {
        skipped += 1
        continue
      }
      marketsToProcess.push(market)
    }

    // 批量翻译：收集所有需要翻译的文本，一次性发送减少 API 调用次数
    const translationMap = await this.batchTranslateMarkets(marketsToProcess)

    for (const market of marketsToProcess) {
      const result = await this.processMarket(market, translationMap)
      if (result.skipped) {
        skipped += 1
      } else {
        processed += 1
      }
    }

    const nextCursorValue = response.nextCursor ?? null
    const apiReturned = response.markets.length // API 实际返回的数量

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
      this.logger.log(
        `Reached end of markets (apiReturned=${apiReturned} < effectiveLimit=${this.effectiveLimit}), will restart from offset 0 on next run`,
      )
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
    translationMap: TranslationMap,
  ): Promise<{ skipped: boolean }> {
    // API 返回 events 数组，取第一个元素作为主事件
    const event = market.event ?? market.events?.[0]
    const m = market as any

    // 统一 category 为小写并去除空格
    // 注意：不应该用配置的默认 category 回填，否则会将无分类的市场错误地标记为 crypto
    const rawCategory = market.category ?? event?.category ?? null
    const normalizedCategory = rawCategory ? rawCategory.toLowerCase().trim() : null

    const translations = translationMap.get(market.id) ?? null

    const marketInput = {
      marketId: market.id,
      eventExternalId: m.eventId ?? m.event_id ?? event?.id ?? null,
      eventSlug: event?.slug ?? null,
      eventTitle: event?.title ?? null,
      eventTitleZh: translations?.eventTitleZh ?? null,
      // API 返回 camelCase，兼容 snake_case
      eventStartTime: this.toDate(event?.startDate ?? event?.start_date),
      eventEndTime: this.toDate(event?.endDate ?? event?.end_date),
      slug: market.slug,
      question: market.question ?? market.title,
      questionZh: translations?.questionZh ?? null,
      category: normalizedCategory,
      tags: this.extractTags(market, event),
      outcomeType: market.outcomeType ?? m.outcome_type ?? null,
      status: market.status ?? (m.closed ? 'closed' : 'open'),
      // API 返回 camelCase
      resolutionSource: m.resolutionSource ?? m.resolution_source ?? null,
      resolutionTime: this.toDate(m.resolutionTime ?? m.resolution_time),
      startTradingAt: this.toDate(m.startDate ?? m.start_date ?? m.createdAt ?? m.created_at),
      endTradingAt: this.toDate(
        m.endDate ?? m.end_date ?? m.closeDate ?? m.close_date ?? event?.endDate ?? event?.end_date,
      ),
      lastUpdatedAt: this.toDate(m.updatedAt ?? m.updated_at),
      feeRate: this.toDecimal(m.feeRate ?? m.fee_rate),
      liquidity: this.toDecimal(market.liquidity ?? m.liquidityNum ?? m.liquidity_num),
      volume24h: this.toDecimal(m.volume24hr ?? m.volume24h ?? m.volume_24h),
      volumeTotal: this.toDecimal(m.volumeTotal ?? m.volume_total),
      openInterest: this.toDecimal(m.openInterest ?? m.open_interest),
      isActive: m.active !== false && m.closed !== true,
      rawPayload: market as Record<string, unknown>,
    }

    // 处理 outcomes 字段的多种格式
    const outcomes = this.parseOutcomes(market)
    const outcomeTranslations = translations?.outcomes ?? {}
    const outcomeInputs = outcomes
      .map(outcome => this.mapOutcome(outcome, outcomeTranslations))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))

    await this.repo.upsertMarketWithOutcomes(marketInput, outcomeInputs)

    return { skipped: false }
  }

  /**
   * 批量收集一批市场的所有待翻译文本，调用翻译 API，返回 marketId → translations 映射。
   * 未启用翻译、或翻译失败时返回空 Map（主链路不中断）。
   */
  private async batchTranslateMarkets(markets: PolymarketGammaMarket[]): Promise<TranslationMap> {
    const result: TranslationMap = new Map()
    if (!markets.length) return result

    const cfg = this.configService.get<PolymarketConfig>('polymarket')
    if (cfg?.translation?.enabled === false) return result

    // ---- 1. 收集所有文本，记录 (marketId, field, tokenId) 索引 ----
    type TextRecord =
      | { kind: 'question'; marketId: string }
      | { kind: 'eventTitle'; marketId: string }
      | { kind: 'outcomeName'; marketId: string; tokenId: string }
      | { kind: 'outcomeShortName'; marketId: string; tokenId: string }

    const allTexts: string[] = []
    const textMeta: TextRecord[] = []

    for (const market of markets) {
      const event = market.event ?? market.events?.[0]
      const question = market.question ?? market.title
      const eventTitle = event?.title ?? null

      if (question?.trim()) {
        allTexts.push(question)
        textMeta.push({ kind: 'question', marketId: market.id })
      }
      if (eventTitle?.trim()) {
        allTexts.push(eventTitle)
        textMeta.push({ kind: 'eventTitle', marketId: market.id })
      }

      const outcomes = this.parseOutcomes(market)
      for (const outcome of outcomes) {
        if (!outcome.token_id) continue
        const name = outcome.name ?? outcome.side
        const shortName = (outcome as Record<string, any>)?.short_name
        if (name?.trim()) {
          allTexts.push(name)
          textMeta.push({ kind: 'outcomeName', marketId: market.id, tokenId: outcome.token_id })
        }
        if (shortName?.trim()) {
          allTexts.push(shortName)
          textMeta.push({
            kind: 'outcomeShortName',
            marketId: market.id,
            tokenId: outcome.token_id,
          })
        }
      }
    }

    if (!allTexts.length) return result

    // ---- 2. 批量翻译 ----
    let translated: (string | null)[]
    try {
      translated = await this.translateClient.translateBatch(allTexts)
    } catch (err) {
      this.logger.warn(`batchTranslateMarkets: translate failed, skipping. ${String(err)}`)
      return result
    }

    // ---- 3. 将翻译结果回填到 Map ----
    for (let i = 0; i < textMeta.length; i++) {
      const meta = textMeta[i]
      const translatedText = translated[i] ?? null

      if (!result.has(meta.marketId)) {
        result.set(meta.marketId, { questionZh: null, eventTitleZh: null, outcomes: {} })
      }
      const entry = result.get(meta.marketId)!

      if (meta.kind === 'question') {
        entry.questionZh = translatedText
      } else if (meta.kind === 'eventTitle') {
        entry.eventTitleZh = translatedText
      } else if (meta.kind === 'outcomeName') {
        entry.outcomes[meta.tokenId] ??= { nameZh: null, shortNameZh: null }
        entry.outcomes[meta.tokenId].nameZh = translatedText
      } else if (meta.kind === 'outcomeShortName') {
        entry.outcomes[meta.tokenId] ??= { nameZh: null, shortNameZh: null }
        entry.outcomes[meta.tokenId].shortNameZh = translatedText
      }
    }

    return result
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
        this.logger.warn(
          `Failed to parse clobTokenIds JSON for market ${market.id}: ${String(error)}`,
        )
      }
    } else if (Array.isArray(rawClobTokenIds)) {
      clobTokenIds = rawClobTokenIds.map(String)
    }

    let outcomePrices: string[] | undefined
    const rawOutcomePrices = (market as { outcomePrices?: unknown }).outcomePrices
    if (typeof rawOutcomePrices === 'string') {
      try {
        const parsed = JSON.parse(rawOutcomePrices)
        if (Array.isArray(parsed)) {
          // 使用 toDecimal 转换并过滤无效值（null/undefined/空串）
          const validPrices = parsed
            .map((v: unknown) => this.toDecimal(v))
            .filter((v): v is string => v !== null)
          outcomePrices = validPrices.length > 0 ? validPrices : undefined
        }
      } catch {
        // ignore parse error
      }
    } else if (Array.isArray(rawOutcomePrices)) {
      // 使用 toDecimal 转换并过滤无效值（null/undefined/空串）
      const validPrices = rawOutcomePrices
        .map((v: unknown) => this.toDecimal(v))
        .filter((v): v is string => v !== null)
      outcomePrices = validPrices.length > 0 ? validPrices : undefined
    }

    // 1. 如果 outcomes 是数组，处理字符串数组或对象数组
    if (Array.isArray(market.outcomes)) {
      if (market.outcomes.every(outcome => typeof outcome === 'string')) {
        // 注意：只有当有真实的 clobTokenIds 时才创建 outcome
        // 否则订单簿作业会对假 token_id 永远返回 404
        if (!clobTokenIds || clobTokenIds.length === 0) {
          this.logger.debug(
            `Market ${market.id} has outcomes but no clobTokenIds, skipping outcomes`,
          )
          return []
        }
        return this.buildOutcomesFromStringArray(
          market.id,
          market.outcomes,
          clobTokenIds,
          outcomePrices,
        )
      }
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
            this.logger.debug(
              `Market ${market.id} has outcomes but no clobTokenIds, skipping outcomes`,
            )
            return []
          }
          return this.buildOutcomesFromStringArray(market.id, parsed, clobTokenIds, outcomePrices)
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

  private buildOutcomesFromStringArray(
    marketId: string,
    names: string[],
    clobTokenIds: string[],
    outcomePrices?: string[],
  ): PolymarketGammaOutcome[] {
    return names
      .map((name, index) => {
        const tokenId = clobTokenIds[index]
        if (!tokenId) return null
        // 缺失概率不要写入 0：0 会被前端当成 0% 展示，产生误导
        const probability = outcomePrices?.[index]
        return {
          id: `${marketId}-outcome-${index}`,
          token_id: tokenId,
          name: String(name),
          ...(probability !== undefined ? { probability } : {}),
        }
      })
      .filter((outcome): outcome is NonNullable<typeof outcome> => outcome !== null)
  }

  private mapOutcome(
    outcome: PolymarketGammaOutcome,
    outcomeTranslations: Record<string, { nameZh: string | null; shortNameZh: string | null }> = {},
  ) {
    if (!outcome.token_id) return null
    // 约定：缺失概率的数据不入库（避免前端展示为 '-' 或误导性 0%）。
    // 注意：若数据源既不提供 probability 也不提供 price，则该 outcome 直接跳过。
    const probability = this.toDecimal(outcome.probability) ?? this.toDecimal(outcome.price)
    if (!probability) return null
    const ozh = outcomeTranslations[outcome.token_id] ?? null
    return {
      outcomeTokenId: outcome.token_id,
      name: outcome.name ?? outcome.side ?? null,
      nameZh: ozh?.nameZh ?? null,
      shortName: (outcome as Record<string, any>)?.short_name ?? null,
      shortNameZh: ozh?.shortNameZh ?? null,
      side: outcome.side ?? null,
      price: this.toDecimal(outcome.price),
      probability,
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
    // 如果 meta.category 显式设置为空字符串，返回 null（不过滤 category）
    if (fromMeta === '') return null
    // 如果 defaultCategory 为空字符串且无 meta 覆盖，也返回 null
    if (fromMeta === undefined && this.defaultCategory === '') return null
    const value = fromMeta ?? this.defaultCategory ?? 'crypto'
    if (!value) return null
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

  private toDecimal(value?: unknown): string | null {
    if (value == null) return null
    if (typeof value === 'string') {
      // 空字符串视为无效值，避免阻断 price 兜底逻辑
      if (value === '') return null
      return value
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value.toString()
    return null
  }
}
