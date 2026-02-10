import { Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService / MarketTradesRepository，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
// eslint-disable-next-line ts/consistent-type-imports
import { MarketTradesRepository } from '../repositories/market-trades.repository'

const DEFAULT_MAX_COUNT_PER_SYMBOL = 5000

@Injectable()
export class CleanupOldTradesJob {
  private readonly logger = new Logger(CleanupOldTradesJob.name)

  constructor(
    private readonly marketTradesRepository: MarketTradesRepository,
    private readonly configService: ConfigService,
  ) {}

  private getMaxCountPerSymbol(): number {
    const raw = this.configService.get<string>('TRADES_MAX_COUNT_PER_SYMBOL')
    const parsed = raw != null ? Number(raw) : Number.NaN

    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed)
    }

    return DEFAULT_MAX_COUNT_PER_SYMBOL
  }

  @Cron('0 3 * * *')
  async handleCron() {
    const maxCount = this.getMaxCountPerSymbol()
    this.logger.log(`Starting cleanup of excess trades (max ${maxCount} per symbol)...`)

    try {
      const totalBefore = await this.marketTradesRepository.getTradeCount()
      const symbolGroups = await this.marketTradesRepository.getDistinctSymbolGroups()

      let totalDeleted = 0
      let successCount = 0
      let failCount = 0
      let consecutiveFailures = 0
      const failedSymbols: string[] = []

      const BATCH_SIZE = 10

      for (let i = 0; i < symbolGroups.length; i += BATCH_SIZE) {
        if (consecutiveFailures >= 5) {
          this.logger.error(
            `Cleanup circuit breaker opened after ${consecutiveFailures} consecutive failures, stopping remaining cleanup`,
          )
          break
        }

        const batch = symbolGroups.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(
          batch.map(async ({ exchange, instrumentType, symbol }) => {
            const deleted = await this.marketTradesRepository.deleteExcessTrades(
              exchange,
              instrumentType,
              symbol,
              maxCount,
            )
            return { exchange, instrumentType, symbol, deleted }
          }),
        )

        for (let j = 0; j < results.length; j++) {
          const group = batch[j]
          const result = results[j]

          if (result.status === 'fulfilled') {
            const { exchange, instrumentType, symbol, deleted } = result.value
            if (deleted > 0) {
              totalDeleted += deleted
              this.logger.debug(
                `Deleted ${deleted} excess trades for ${exchange}/${instrumentType}/${symbol}`,
              )
            }
            successCount++
            consecutiveFailures = 0
          } else {
            const { exchange, instrumentType, symbol } = group
            failCount++
            consecutiveFailures++
            failedSymbols.push(`${exchange}/${instrumentType}/${symbol}`)
            this.logger.error(
              `Trade cleanup failed for ${exchange}/${instrumentType}/${symbol}: ${
                result.reason instanceof Error ? result.reason.message : String(result.reason)
              }`,
            )
          }
        }
      }

      const totalAfter = await this.marketTradesRepository.getTradeCount()

      if (failedSymbols.length) {
        this.logger.warn(
          `Cleanup completed with failures for symbols (${failedSymbols.length}): ${failedSymbols.join(', ')}`,
        )
      }

      this.logger.log(
        `Cleanup completed: ${successCount} success, ${failCount} failed. ` +
          `Deleted ${totalDeleted} trades. Total: ${totalBefore} -> ${totalAfter}.`,
      )
    } catch (error) {
      this.logger.error(
        `Failed to cleanup trades: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
