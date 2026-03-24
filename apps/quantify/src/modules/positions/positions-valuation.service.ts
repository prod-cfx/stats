import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { QuotesUpdateDto } from './dto/quotes-update.dto'
import type { PrismaClient } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable, Logger } from '@nestjs/common'
import { PositionSide, PositionStatus, Prisma } from '@/prisma/prisma.types'

// Prisma 7: 从 Prisma namespace 导出类型和值
/* eslint-disable no-redeclare, ts/no-redeclare */
type Decimal = Prisma.Decimal
const Decimal = Prisma.Decimal
/* eslint-enable no-redeclare, ts/no-redeclare */

@Injectable()
export class PositionsValuationService {
  private readonly logger = new Logger(PositionsValuationService.name)

  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async applyQuotes({ quotes }: QuotesUpdateDto) {
    if (!quotes.length) {
      return { updatedPositions: 0, updatedAccounts: 0 }
    }
    const symbolMap = new Map<string, Decimal>()
    for (const quote of quotes) {
      const symbol = quote.symbol.trim().toUpperCase()
      if (!symbol) continue
      symbolMap.set(symbol, new Decimal(quote.price))
    }
    if (!symbolMap.size) {
      return { updatedPositions: 0, updatedAccounts: 0 }
    }

    return this.txHost.withTransaction(async () => {
      const prisma = this.txHost.tx
      const symbols = Array.from(symbolMap.keys())
      const positions = await prisma.position.findMany({
        where: {
          status: PositionStatus.OPEN,
          symbol: { in: symbols },
        },
      })

      if (!positions.length) {
        return { updatedPositions: 0, updatedAccounts: 0 }
      }

      const affectedAccounts = new Set<string>()
      for (const position of positions) {
        const markPrice = symbolMap.get(position.symbol)
        if (!markPrice) continue
        const unrealized = this.calculateUnrealizedPnl(
          position.positionSide,
          position.avgEntryPrice,
          markPrice,
          position.quantity,
        )
        affectedAccounts.add(position.userStrategyAccountId)
        await prisma.position.update({
          where: { id: position.id },
          data: { unrealizedPnl: unrealized },
        })
      }

      for (const accountId of affectedAccounts) {
        const aggregate = await prisma.position.aggregate({
          where: { userStrategyAccountId: accountId, status: PositionStatus.OPEN },
          _sum: { unrealizedPnl: true },
        })
        const totalUnrealized = aggregate._sum.unrealizedPnl ?? new Decimal(0)
        const account = await prisma.userStrategyAccount.findUnique({
          where: { id: accountId },
          select: { balance: true },
        })
        if (!account) continue
        await prisma.userStrategyAccount.update({
          where: { id: accountId },
          data: {
            totalUnrealizedPnl: totalUnrealized,
            equity: account.balance.add(totalUnrealized),
          },
        })
      }

      return {
        updatedPositions: positions.length,
        updatedAccounts: affectedAccounts.size,
      }
    })
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
