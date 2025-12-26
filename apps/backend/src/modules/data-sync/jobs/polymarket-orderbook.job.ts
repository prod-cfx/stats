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
}

@Injectable()
export class PolymarketOrderbookJob implements DataPullJob {
  readonly key = 'polymarket-orderbook-crypto'
  private readonly logger = new Logger(PolymarketOrderbookJob.name)
  private readonly batchSize = 25
  private readonly category?: string | null

  constructor(
    private readonly clobClient: PolymarketClobClient,
    private readonly repo: PolymarketRepository,
    private readonly configService: ConfigService,
  ) {
    const cfg = this.configService.get<PolymarketConfig>('polymarket')
    this.category = cfg?.filters.category ?? 'crypto'
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
    for (const target of targets) {
      try {
        const snapshot = await this.clobClient.fetchOrderbook({ tokenId: target.outcomeTokenId })
        await this.repo.saveOrderbookSnapshot({
          marketDbId: target.marketDbId,
          outcomeDbId: target.outcomeDbId,
          marketExternalId: target.marketExternalId,
          outcomeTokenId: target.outcomeTokenId,
          bids: snapshot.bids,
          asks: snapshot.asks,
          seq: this.extractSeq(snapshot),
          spread: this.computeSpread(snapshot),
          capturedAt: this.toDate(snapshot.timestamp) ?? new Date(),
          rawPayload: snapshot as Record<string, unknown>,
          source: 'POLYMARKET',
        })
        success += 1
      } catch (error) {
        this.logger.warn(
          `Failed to fetch Polymarket orderbook for token=${target.outcomeTokenId}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    const nextOffset = targets.length < this.batchSize ? 0 : cursor.offset + targets.length

    return {
      fetchedCount: success,
      newCursor: JSON.stringify({ offset: nextOffset }),
      meta: {
        tokensProcessed: targets.length,
        success,
      },
    }
  }

  private parseCursor(currentCursor: string | null): OrderbookCursor {
    if (!currentCursor) return { offset: 0 }
    try {
      const parsed = JSON.parse(currentCursor) as OrderbookCursor
      return {
        offset: Number.isFinite(parsed?.offset) ? Math.max(0, Math.trunc(parsed.offset)) : 0,
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
    if (typeof value === 'number') {
      const ms = value > 1_000_000_000_000 ? value : value * 1000
      return new Date(ms)
    }
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : new Date(parsed)
  }
}
