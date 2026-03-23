import { Injectable, Logger } from '@nestjs/common'
import { LedgerEntryType, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { StrategyPnlReportRepository } from './repositories/strategy-pnl-report.repository'

// Prisma 7: 从 Prisma namespace 导出类型和值
/* eslint-disable no-redeclare, ts/no-redeclare */
type Decimal = Prisma.Decimal
const Decimal = Prisma.Decimal
/* eslint-enable no-redeclare, ts/no-redeclare */

const DAY_MS = 24 * 60 * 60 * 1000

@Injectable()
export class StrategyPnlReportService {
  private readonly logger = new Logger(StrategyPnlReportService.name)
  private readonly batchSize = 100

  constructor(private readonly reportRepository: StrategyPnlReportRepository) {}

  async generateDailyReport(targetDate?: Date) {
    const dayStart = this.startOfUtcDay(targetDate ?? new Date())
    const dayEnd = new Date(dayStart.getTime() + DAY_MS)
    const prevDay = new Date(dayStart.getTime() - DAY_MS)

    const ledgerGroups = await this.reportRepository.groupLedgerByAccountAndType(dayStart, dayEnd)
    const ledgerMap = new Map<
      string,
      Partial<Record<LedgerEntryType, Decimal>>
    >()
    for (const group of ledgerGroups) {
      const perAccount =
        ledgerMap.get(group.userStrategyAccountId) ?? ({} as Partial<Record<LedgerEntryType, Decimal>>)
      perAccount[group.type] = group._sum.amount ?? new Decimal(0)
      ledgerMap.set(group.userStrategyAccountId, perAccount)
    }

    const prevReports = await this.reportRepository.findDailyStatsByDate(prevDay)
    const prevMap = new Map(prevReports.map(report => [report.userStrategyAccountId, report]))

    const totalAccounts = await this.reportRepository.countAccounts()
    let processed = 0
    for (let skip = 0; skip < totalAccounts; skip += this.batchSize) {
      const accounts = await this.reportRepository.findAccountsBatch(skip, this.batchSize)
      for (const account of accounts) {
        const ledger = ledgerMap.get(account.id) ?? {}
        const realizedPnl = ledger[LedgerEntryType.REALIZED_PNL] ?? new Decimal(0)
        const deposits = ledger[LedgerEntryType.DEPOSIT] ?? new Decimal(0)
        const withdrawalsRaw = ledger[LedgerEntryType.WITHDRAW] ?? new Decimal(0)
        const withdrawals = withdrawalsRaw.abs()
        const equityStart =
          prevMap.get(account.id)?.equityEnd ?? account.initialBalance
        const equityEnd = account.equity
        const unrealized = account.totalUnrealizedPnl
        const maxDrawdown = equityStart.gt(equityEnd)
          ? equityStart.sub(equityEnd)
          : new Decimal(0)

        await this.reportRepository.upsertDailyStat({
          userStrategyAccountId: account.id,
          date: dayStart,
          equityStart,
          equityEnd,
          realizedPnl,
          unrealizedPnl: unrealized,
          deposits,
          withdrawals,
          maxDrawdown,
        })
        processed += 1
      }
    }

    this.logger.log(
      `已生成 ${processed} 个账户的日度收益: ${dayStart.toISOString().slice(0, 10)}`,
    )
    return {
      date: dayStart.toISOString(),
      accountsProcessed: processed,
    }
  }

  private startOfUtcDay(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  }
}
