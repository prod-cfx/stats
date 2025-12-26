import type { DataPullJob, JobRunResult } from '../contracts/data-pull-job'
import type { PolymarketRestBook } from '@/clients/polymarket/types'
import type { PolymarketConfig } from '@/config/polymarket.config'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
// eslint-disable-next-line ts/consistent-type-imports
import { PolymarketClobClient } from '@/clients/polymarket/clob-client'
// eslint-disable-next-line ts/consistent-type-imports
import { PolymarketRepository } from '@/modules/polymarket/polymarket.repository'

interface OrderbookCursor {
  offset: number
  // 记录连续失败的 token 及其失败次数，用于判断是否跳过
  failedTokens?: Record<string, number>
  // 记录已永久跳过的 token（失败次数超过阈值），持久化跳过状态
  skippedTokens?: Set<string> | string[]
}

@Injectable()
export class PolymarketOrderbookJob implements DataPullJob {
  readonly key = 'polymarket-orderbook-crypto'
  private readonly logger = new Logger(PolymarketOrderbookJob.name)
  private readonly batchSize = 25
  private readonly category?: string | null
  // 单个 token 连续失败超过此次数，将被跳过（offset 推进，避免卡死）
  private readonly maxRetries = 5

  constructor(
    private readonly clobClient: PolymarketClobClient,
    private readonly repo: PolymarketRepository,
    private readonly configService: ConfigService,
  ) {
    const cfg = this.configService.get<PolymarketConfig>('polymarket')
    // 确保 category 已标准化（配置层已处理，这里是防御性检查）
    const rawCategory = cfg?.filters.category ?? 'crypto'
    this.category = rawCategory ? rawCategory.trim().toLowerCase() : 'crypto'
  }

  async run(currentCursor: string | null): Promise<JobRunResult> {
    const cursor = this.parseCursor(currentCursor)

    const targets = await this.repo.listOutcomeTokens({
      category: this.category ?? null,
      limit: this.batchSize,
      offset: cursor.offset,
    })

    if (!targets.length) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify({ offset: 0 }),
        meta: {
          note: 'No Polymarket outcomes available for orderbook snapshot',
        },
      }
    }

    let success = 0
    let failed = 0
    let skipped = 0  // 跳过的（连续失败超过阈值或已在永久跳过列表）
    const failedTokens = cursor.failedTokens ?? {}
    const newFailedTokens: Record<string, number> = {}
    
    // 读取并转换 skippedTokens（持久化的跳过列表）
    const skippedTokens = new Set<string>(
      Array.isArray(cursor.skippedTokens) ? cursor.skippedTokens : []
    )
    const newSkippedTokens = new Set(skippedTokens)  // 复制一份，用于更新
    
    let consecutiveProcessed = 0  // 从开始到第一个"需要重试的失败"之前的处理数量
    let hasEncounteredRetryableFailure = false
    
    for (const target of targets) {
      const tokenId = target.outcomeTokenId
      
      // 检查是否在永久跳过列表中（持久化的跳过状态）
      if (skippedTokens.has(tokenId)) {
        skipped += 1
        // 跳过的 token 也算"已处理"
        if (!hasEncounteredRetryableFailure) {
          consecutiveProcessed += 1
        }
        continue
      }
      
      const currentFailCount = failedTokens[tokenId] ?? 0
      
      // 如果该 token 连续失败次数已超过阈值，加入永久跳过列表
      if (currentFailCount >= this.maxRetries) {
        skipped += 1
        newSkippedTokens.add(tokenId)  // 持久化跳过状态
        this.logger.warn(
          `Permanently skipping token=${tokenId} after ${currentFailCount} consecutive failures (max=${this.maxRetries})`,
        )
        // 跳过的 token 也算"已处理"
        if (!hasEncounteredRetryableFailure) {
          consecutiveProcessed += 1
        }
        continue
      }
      
      try {
        const snapshot = await this.clobClient.fetchOrderbook({ tokenId })
        await this.repo.saveOrderbookSnapshot({
          marketDbId: target.marketDbId,
          outcomeDbId: target.outcomeDbId,
          marketExternalId: target.marketExternalId,
          outcomeTokenId: tokenId,
          bids: snapshot.bids,
          asks: snapshot.asks,
          seq: this.extractSeq(snapshot),
          spread: this.computeSpread(snapshot),
          capturedAt: this.toDate(snapshot.timestamp) ?? new Date(),
          rawPayload: snapshot as Record<string, unknown>,
          source: 'POLYMARKET',
        })
        success += 1
        // 成功后，清除该 token 的失败记录
        delete newFailedTokens[tokenId]
        // 只有在还没遇到"需要重试的失败"时，才计入连续处理
        if (!hasEncounteredRetryableFailure) {
          consecutiveProcessed += 1
        }
      } catch (error) {
        failed += 1
        hasEncounteredRetryableFailure = true
        // 记录失败次数 +1
        newFailedTokens[tokenId] = currentFailCount + 1
        this.logger.warn(
          `Failed to fetch Polymarket orderbook for token=${tokenId} (attempt ${currentFailCount + 1}/${this.maxRetries}): ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    // 关键：按"连续处理"的数量推进 offset（包括成功、跳过，但不包括需要重试的失败）
    // 特别处理最后一页：如果有失败需要重试，不要重置 offset 为 0（否则 failedTokens 会被清空）
    let nextOffset: number
    if (targets.length < this.batchSize) {
      // 最后一页
      if (hasEncounteredRetryableFailure) {
        // 有失败需要重试，继续推进 offset（不重置为 0）
        nextOffset = cursor.offset + consecutiveProcessed
        this.logger.log(`Last page with retryable failures, keeping offset at ${nextOffset} for retry`)
      } else {
        // 没有失败，或全部已跳过，重置为 0 开始新一轮
        nextOffset = 0
        this.logger.log(`Completed full cycle, resetting offset to 0`)
      }
    } else {
      // 非最后一页，正常推进
      nextOffset = cursor.offset + consecutiveProcessed
    }

    return {
      fetchedCount: success,
      newCursor: JSON.stringify({ 
        offset: nextOffset,
        failedTokens: Object.keys(newFailedTokens).length > 0 ? newFailedTokens : undefined,
        skippedTokens: newSkippedTokens.size > 0 ? Array.from(newSkippedTokens) : undefined,
      }),
      meta: {
        tokensProcessed: targets.length,
        success,
        failed,
        skipped,
        consecutiveProcessed,
        nextOffset,
        failedTokensCount: Object.keys(newFailedTokens).length,
        skippedTokensCount: newSkippedTokens.size,
      },
    }
  }

  private parseCursor(currentCursor: string | null): OrderbookCursor {
    if (!currentCursor) return { offset: 0 }
    try {
      const parsed = JSON.parse(currentCursor) as OrderbookCursor
      return {
        offset: Number.isFinite(parsed?.offset) ? Math.max(0, Math.trunc(parsed.offset)) : 0,
        failedTokens: parsed?.failedTokens && typeof parsed.failedTokens === 'object' ? parsed.failedTokens : undefined,
        // 解析并转换 skippedTokens（持久化的跳过列表）
        skippedTokens: Array.isArray(parsed?.skippedTokens) ? parsed.skippedTokens : undefined,
      }
    } catch {
      this.logger.warn(`Invalid cursor detected for ${this.key}, resetting.`)
      return { offset: 0 }
    }
  }

  private extractSeq(snapshot: PolymarketRestBook): bigint | number | null {
    const seq = snapshot.seq ?? (snapshot as Record<string, any>)?.sequence
    if (seq == null) return null
    if (typeof seq === 'number' && Number.isFinite(seq)) {
      return BigInt(Math.trunc(seq))
    }
    if (typeof seq === 'string' && seq.trim().length) {
      try {
        return BigInt(seq)
      } catch {
        return null
      }
    }
    return null
  }

  private computeSpread(snapshot: PolymarketRestBook): string | null {
    const bestBid = snapshot.bids?.[0]?.price
    const bestAsk = snapshot.asks?.[0]?.price
    if (!bestBid || !bestAsk) return null
    const bid = Number(bestBid)
    const ask = Number(bestAsk)
    if (!Number.isFinite(bid) || !Number.isFinite(ask)) return null
    const spread = ask - bid
    return spread >= 0 ? spread.toFixed(6) : null
  }

  private toDate(value?: number | string | null): Date | null {
    if (value == null) return null
    
    // 如果是数字，直接处理
    if (typeof value === 'number') {
      const ms = value > 1_000_000_000_000 ? value : value * 1000
      return new Date(ms)
    }
    
    // 如果是字符串，尝试两种方式：
    // 1. 先尝试作为数字字符串解析（Polymarket 返回 "1766738570134" 这种格式）
    const numericValue = Number(value)
    if (!Number.isNaN(numericValue) && numericValue > 0) {
      const ms = numericValue > 1_000_000_000_000 ? numericValue : numericValue * 1000
      return new Date(ms)
    }
    
    // 2. 尝试作为 ISO 日期字符串解析
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : new Date(parsed)
  }
}
