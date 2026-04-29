import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { QuotesUpdateDto } from './dto/quotes-update.dto'
import type { PrismaClient } from '@/prisma/prisma.types'
import { PositionSide, PositionStatus } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { MARKET_QUOTE_EVENT } from '@/modules/market-data/services/market-data-stream.service'
import { Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PositionsRepository } from './repositories/positions.repository'

// Prisma 7: 从 Prisma namespace 导出类型和值
/* eslint-disable no-redeclare, ts/no-redeclare */
type Decimal = Prisma.Decimal
const Decimal = Prisma.Decimal
/* eslint-enable no-redeclare, ts/no-redeclare */

@Injectable()
export class PositionsValuationService {
  private readonly logger = new Logger(PositionsValuationService.name)

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
    private readonly positionsRepository: PositionsRepository,
  ) {}

  async applyQuotes({ quotes }: QuotesUpdateDto) {
    if (!quotes.length) {
      return { updatedPositions: 0, updatedAccounts: 0 }
    }
    const symbolMap = new Map<string, Decimal>()
    for (const quote of quotes) {
      for (const symbol of this.expandQuoteSymbols(quote.symbol)) {
        symbolMap.set(symbol, new Decimal(quote.price))
      }
    }
    if (!symbolMap.size) {
      return { updatedPositions: 0, updatedAccounts: 0 }
    }

    return this.txHost.withTransaction(async () => {
      const symbols = Array.from(symbolMap.keys())
      const positions = await this.positionsRepository.findOpenPositionsBySymbols(symbols)

      if (!positions.length) {
        return { updatedPositions: 0, updatedAccounts: 0 }
      }

      const affectedAccounts = new Set<string>()
      const orderedPositions = [...positions].sort((left, right) => left.id.localeCompare(right.id))
      for (const position of orderedPositions) {
        const markPrice = symbolMap.get(position.symbol)
        if (!markPrice) continue
        const unrealized = this.calculateUnrealizedPnl(
          position.positionSide,
          position.avgEntryPrice,
          markPrice,
          position.quantity,
        )
        affectedAccounts.add(position.userStrategyAccountId)
        await this.positionsRepository.updatePositionUnrealizedPnl(position.id, unrealized)
      }

      for (const accountId of Array.from(affectedAccounts).sort()) {
        const totalUnrealized = await this.positionsRepository.aggregateOpenPositionUnrealizedPnl(accountId) ?? new Decimal(0)
        const balance = await this.positionsRepository.findAccountBalance(accountId)
        if (!balance) continue
        await this.positionsRepository.updateAccountValuation(accountId, totalUnrealized, balance.add(totalUnrealized))
      }

      return {
        updatedPositions: positions.length,
        updatedAccounts: affectedAccounts.size,
      }
    })
  }

  @OnEvent(MARKET_QUOTE_EVENT, { async: true })
  async handleMarketQuote(event: {
    data?: {
      symbol?: string
      lastPrice?: string | number | null
      source?: string | null
      eventTime?: string | number | Date | null
    }
  }): Promise<void> {
    const symbol = typeof event.data?.symbol === 'string' ? event.data.symbol.trim() : ''
    const rawLastPrice = event.data?.lastPrice
    const price = typeof rawLastPrice === 'number'
      ? String(rawLastPrice)
      : typeof rawLastPrice === 'string'
        ? rawLastPrice.trim()
        : ''

    if (!symbol || !price) return

    const rawEventTime = event.data?.eventTime
    const eventTime = rawEventTime instanceof Date
      ? rawEventTime.toISOString()
      : rawEventTime != null
        ? new Date(rawEventTime).toISOString()
        : undefined

    try {
      await this.applyQuotes({
        quotes: [{
          symbol,
          price,
          source: event.data?.source ?? undefined,
          eventTime,
        }],
      })
    } catch (error) {
      this.logger.error(
        `实时估值更新失败: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }
  }

  private expandQuoteSymbols(symbol: string): string[] {
    const normalized = symbol.trim().toUpperCase()
    if (!normalized) return []
    if (!normalized.includes(':')) return [normalized]
    const raw = normalized.split(':')[0] ?? normalized
    if (!raw || raw === normalized) return [normalized]
    return [normalized, raw]
  }

  private calculateUnrealizedPnl(
    side: PositionSide,
    entryPrice: Decimal,
    currentPrice: Decimal,
    quantity: Decimal,
  ) {
    const diff = currentPrice.sub(entryPrice)
    return diff.mul(quantity).mul(side === PositionSide.LONG ? 1 : -1)
  }
}
