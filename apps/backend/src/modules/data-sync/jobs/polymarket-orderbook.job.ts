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
    let skipped = 0  // 跳过的（连续失败超过阈值）
    const failedTokens = cursor.failedTokens ?? {}
    const newFailedTokens: Record<string, number> = {}
    let consecutiveProcessed = 0  // 从开始到第一个"需要重试的失败"之前的处理数量
    let hasEncounteredRetryableFailure = false
    
    for (const target of targets) {
      const tokenId = target.outcomeTokenId
      const currentFailCount = failedTokens[tokenId] ?? 0
      
      // 如果该 token 连续失败次数已超过阈值，跳过它（避免永久卡死）
      if (currentFailCount >= this.maxRetries) {
        skipped += 1
        this.logger.warn(
          `Skipping token=${tokenId} after ${currentFailCount} consecutive failures (max=${this.maxRetries})`,
        )
        // 跳过的 token 也算"已处理"，但不计入失败
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
    // - 如果第1个就失败（且未超阈值）：consecutiveProcessed=0，offset不变，下次重试同一批
    // - 如果第1个失败但超阈值被跳过：consecutiveProcessed=1，offset推进1，下次从第2个开始
    // - 如果前10个成功第11个失败：consecutiveProcessed=10，offset推进10，下次从失败的那个开始
    // - 如果全部成功/跳过：consecutiveProcessed=targets.length，正常推进
    const nextOffset = targets.length < this.batchSize ? 0 : cursor.offset + consecutiveProcessed

    return {
      fetchedCount: success,
      newCursor: JSON.stringify({ 
        offset: nextOffset,
        failedTokens: Object.keys(newFailedTokens).length > 0 ? newFailedTokens : undefined,
      }),
      meta: {
        tokensProcessed: targets.length,
        success,
        failed,
        skipped,
        consecutiveProcessed,
        nextOffset,
        failedTokensCount: Object.keys(newFailedTokens).length,
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
