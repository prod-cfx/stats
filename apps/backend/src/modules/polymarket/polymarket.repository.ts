import type { PolymarketMarket as PolymarketMarketModel, Prisma } from '@prisma/client'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

export interface PolymarketMarketWriteInput {
  marketId: string
  eventExternalId?: string | null
  eventSlug?: string | null
  eventTitle?: string | null
  eventTitleZh?: string | null
  eventStartTime?: Date | null
  eventEndTime?: Date | null
  slug?: string | null
  question?: string | null
  questionZh?: string | null
  category?: string | null
  tags?: string[]
  outcomeType?: string | null
  status?: string | null
  resolutionSource?: string | null
  resolutionTime?: Date | null
  startTradingAt?: Date | null
  endTradingAt?: Date | null
  lastUpdatedAt?: Date | null
  feeRate?: string | null
  liquidity?: string | null
  volume24h?: string | null
  volumeTotal?: string | null
  openInterest?: string | null
  isActive?: boolean
  rawPayload: Record<string, unknown>
}

export interface PolymarketOutcomeWriteInput {
  marketDbId: number
  outcomeTokenId: string
  name?: string | null
  shortName?: string | null
  nameZh?: string | null
  shortNameZh?: string | null
  side?: string | null
  price?: string | null
  probability?: string | null
  liquidity?: string | null
  poolBalance?: string | null
  lastTradePrice?: string | null
  lastTradeAt?: Date | null
  rawPayload: Record<string, unknown>
}

export type PolymarketOutcomeWriteWithoutMarketInput = Omit<
  PolymarketOutcomeWriteInput,
  'marketDbId'
>

export interface PolymarketOrderbookSnapshotInput {
  marketDbId?: number | null
  outcomeDbId?: number | null
  marketExternalId: string
  outcomeTokenId: string
  bids: { price: string; size: string }[]
  asks: { price: string; size: string }[]
  seq?: bigint | number | null
  spread?: string | null
  capturedAt: Date
  rawPayload?: Record<string, unknown>
  source?: string
}

export interface OutcomeTokenRecord {
  marketDbId: number
  marketExternalId: string
  outcomeDbId: number
  outcomeTokenId: string
}

export interface MarketTranslationSnapshot {
  marketId: string
  question: string | null
  questionZh: string | null
  eventTitle: string | null
  eventTitleZh: string | null
}

export type PolymarketMarketWithOutcomes = Prisma.PolymarketMarketGetPayload<{
  include: {
    outcomes: true
  }
}>

@Injectable()
export class PolymarketRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  private toMarketUpsertData(market: PolymarketMarketWriteInput) {
    return {
      marketId: market.marketId,
      eventExternalId: market.eventExternalId,
      eventSlug: market.eventSlug,
      eventTitle: market.eventTitle,
      eventTitleZh: market.eventTitleZh,
      eventStartTime: market.eventStartTime ?? undefined,
      eventEndTime: market.eventEndTime ?? undefined,
      slug: market.slug,
      question: market.question,
      questionZh: market.questionZh,
      category: market.category,
      tags: market.tags ?? [],
      outcomeType: market.outcomeType,
      status: market.status,
      resolutionSource: market.resolutionSource,
      resolutionTime: market.resolutionTime,
      startTradingAt: market.startTradingAt,
      endTradingAt: market.endTradingAt,
      lastUpdatedAt: market.lastUpdatedAt,
      feeRate: market.feeRate ?? undefined,
      liquidity: market.liquidity ?? undefined,
      volume24h: market.volume24h ?? undefined,
      volumeTotal: market.volumeTotal ?? undefined,
      openInterest: market.openInterest ?? undefined,
      isActive: market.isActive ?? true,
      rawPayload: market.rawPayload,
    }
  }

  async upsertMarket(market: PolymarketMarketWriteInput): Promise<PolymarketMarketModel> {
    const client = this.getClient()
    const marketData = this.toMarketUpsertData(market)
    return client.polymarketMarket.upsert({
      where: { marketId: market.marketId },
      create: marketData,
      update: marketData,
    })
  }

  async upsertMarketWithOutcomes(
    market: PolymarketMarketWriteInput,
    outcomes: PolymarketOutcomeWriteWithoutMarketInput[],
  ): Promise<void> {
    const client = this.getClient()
    const marketData = this.toMarketUpsertData(market)

    await client.$transaction(async tx => {
      const marketRecord = await tx.polymarketMarket.upsert({
        where: { marketId: market.marketId },
        create: marketData,
        update: marketData,
      })

      if (!outcomes.length) return

      await Promise.all(
        outcomes.map(outcome =>
          tx.polymarketOutcome.upsert({
            where: { outcomeTokenId: outcome.outcomeTokenId },
            create: {
              marketId: marketRecord.id,
              outcomeTokenId: outcome.outcomeTokenId,
              name: outcome.name,
              shortName: outcome.shortName,
              nameZh: outcome.nameZh,
              shortNameZh: outcome.shortNameZh,
              side: outcome.side,
              price: outcome.price ?? undefined,
              probability: outcome.probability ?? undefined,
              liquidity: outcome.liquidity ?? undefined,
              poolBalance: outcome.poolBalance ?? undefined,
              lastTradePrice: outcome.lastTradePrice ?? undefined,
              lastTradeAt: outcome.lastTradeAt ?? undefined,
              rawPayload: outcome.rawPayload,
            },
            update: {
              marketId: marketRecord.id,
              name: outcome.name,
              shortName: outcome.shortName,
              nameZh: outcome.nameZh,
              shortNameZh: outcome.shortNameZh,
              side: outcome.side,
              price: outcome.price ?? undefined,
              probability: outcome.probability ?? undefined,
              liquidity: outcome.liquidity ?? undefined,
              poolBalance: outcome.poolBalance ?? undefined,
              lastTradePrice: outcome.lastTradePrice ?? undefined,
              lastTradeAt: outcome.lastTradeAt ?? undefined,
              rawPayload: outcome.rawPayload,
            },
          }),
        ),
      )
    })
  }

  async upsertOutcomes(outcomes: PolymarketOutcomeWriteInput[]): Promise<void> {
    if (!outcomes.length) return
    const client = this.getClient()
    await client.$transaction(
      outcomes.map(outcome =>
        client.polymarketOutcome.upsert({
          where: { outcomeTokenId: outcome.outcomeTokenId },
          create: {
            marketId: outcome.marketDbId,
            outcomeTokenId: outcome.outcomeTokenId,
            name: outcome.name,
            shortName: outcome.shortName,
            nameZh: outcome.nameZh,
            shortNameZh: outcome.shortNameZh,
            side: outcome.side,
            price: outcome.price ?? undefined,
            probability: outcome.probability ?? undefined,
            liquidity: outcome.liquidity ?? undefined,
            poolBalance: outcome.poolBalance ?? undefined,
            lastTradePrice: outcome.lastTradePrice ?? undefined,
            lastTradeAt: outcome.lastTradeAt ?? undefined,
            rawPayload: outcome.rawPayload,
          },
          update: {
            marketId: outcome.marketDbId,
            name: outcome.name,
            shortName: outcome.shortName,
            nameZh: outcome.nameZh,
            shortNameZh: outcome.shortNameZh,
            side: outcome.side,
            price: outcome.price ?? undefined,
            probability: outcome.probability ?? undefined,
            liquidity: outcome.liquidity ?? undefined,
            poolBalance: outcome.poolBalance ?? undefined,
            lastTradePrice: outcome.lastTradePrice ?? undefined,
            lastTradeAt: outcome.lastTradeAt ?? undefined,
            rawPayload: outcome.rawPayload,
          },
        }),
      ),
    )
  }

  async saveOrderbookSnapshot(input: PolymarketOrderbookSnapshotInput): Promise<void> {
    const client = this.getClient()
    const seqValue =
      typeof input.seq === 'number'
        ? BigInt(Math.trunc(input.seq))
        : typeof input.seq === 'bigint'
          ? input.seq
          : undefined

    await client.polymarketOrderbookSnapshot.upsert({
      where: {
        marketExternalId_outcomeTokenId_capturedAt: {
          marketExternalId: input.marketExternalId,
          outcomeTokenId: input.outcomeTokenId,
          capturedAt: input.capturedAt,
        },
      },
      create: {
        marketId: input.marketDbId ?? undefined,
        outcomeId: input.outcomeDbId ?? undefined,
        marketExternalId: input.marketExternalId,
        outcomeTokenId: input.outcomeTokenId,
        bids: input.bids,
        asks: input.asks,
        seq: seqValue,
        spread: input.spread ?? undefined,
        capturedAt: input.capturedAt,
        source: input.source ?? 'POLYMARKET',
        rawPayload: input.rawPayload,
      },
      update: {
        marketId: input.marketDbId ?? undefined,
        outcomeId: input.outcomeDbId ?? undefined,
        bids: input.bids,
        asks: input.asks,
        seq: seqValue,
        spread: input.spread ?? undefined,
        source: input.source ?? 'POLYMARKET',
        rawPayload: input.rawPayload,
      },
    })
  }

  async listOutcomeTokens(params: {
    category?: string | null
    limit?: number
    offset?: number
  }): Promise<OutcomeTokenRecord[]> {
    const client = this.getClient()
    const limit = Math.max(1, Math.min(params.limit ?? 50, 500))
    const offset = Math.max(0, params.offset ?? 0)

    type OutcomeRow = Prisma.PolymarketOutcomeGetPayload<{
      include: {
        market: {
          select: {
            id: true
            marketId: true
            category: true
            isActive: true
          }
        }
      }
    }>

    // 标准化 category：确保与存储格式一致（小写 + trim）
    const normalizedCategory = params.category?.trim().toLowerCase()

    // Prisma relation filter 需要用 is/isNot 包裹
    const where: Prisma.PolymarketOutcomeWhereInput = {
      market: {
        is: {
          isActive: true,
          ...(normalizedCategory ? { category: normalizedCategory } : {}),
        },
      },
    }

    const rows = await client.polymarketOutcome.findMany({
      take: limit,
      skip: offset,
      orderBy: {
        id: 'asc',
      },
      include: {
        market: {
          select: {
            id: true,
            marketId: true,
            category: true,
            isActive: true,
          },
        },
      },
      where,
    })

    return rows
      .map((row: OutcomeRow) => ({
        marketDbId: row.market?.id ?? 0,
        marketExternalId: row.market?.marketId ?? '',
        outcomeDbId: row.id,
        outcomeTokenId: row.outcomeTokenId,
      }))
      .filter(
        (record: OutcomeTokenRecord) =>
          record.marketDbId > 0 && record.marketExternalId && record.outcomeTokenId,
      )
  }

  async markMarketActivity(
    marketId: number,
    updates: {
      isActive?: boolean
      lastUpdatedAt?: Date
    },
  ): Promise<void> {
    const client = this.getClient()
    await client.polymarketMarket.update({
      where: { id: marketId },
      data: {
        isActive: updates.isActive ?? undefined,
        lastUpdatedAt: updates.lastUpdatedAt ?? undefined,
      },
    })
  }

  async listMarketsWithOutcomes(params: {
    category?: string | null
    onlyActive?: boolean
    offset?: number
    limit?: number
  }): Promise<PolymarketMarketWithOutcomes[]> {
    const client = this.getClient()
    const limit = Math.max(1, Math.min(params.limit ?? 50, 200))
    const offset = Math.max(0, params.offset ?? 0)

    const normalizedCategory = params.category?.trim().toLowerCase()

    return client.polymarketMarket.findMany({
      where: {
        ...(params.onlyActive !== false ? { isActive: true } : {}),
        ...(normalizedCategory ? { category: normalizedCategory } : {}),
      },
      include: {
        outcomes: true,
      },
      skip: offset,
      take: limit,
      orderBy: {
        lastUpdatedAt: 'desc',
      },
    })
  }

  async findMarketsForTranslation(ids: string[]): Promise<MarketTranslationSnapshot[]> {
    if (!ids.length) return []

    const client = this.getClient()
    return client.polymarketMarket.findMany({
      where: {
        marketId: {
          in: ids,
        },
      },
      select: {
        marketId: true,
        question: true,
        questionZh: true,
        eventTitle: true,
        eventTitleZh: true,
      },
    })
  }
}
