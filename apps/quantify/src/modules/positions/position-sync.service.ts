import type { ExchangeId, MarketType, UnifiedPosition } from '@/modules/trading/core/types'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { TradingService } from '@/modules/trading/trading.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PrismaService } from '@/prisma/prisma.service'
import { PositionSide, PositionStatus, Prisma, TradeSide } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PositionsService } from './positions.service'

// Prisma 7: 从 Prisma namespace 导出类型和值
/* eslint-disable no-redeclare, ts/no-redeclare */
type Decimal = Prisma.Decimal
const Decimal = Prisma.Decimal
/* eslint-enable no-redeclare, ts/no-redeclare */

export interface PositionSyncResult {
  userId: string
  exchangeId: ExchangeId
  marketType: MarketType
  success: boolean
  syncedAt: Date
  exchangePositions: number
  localPositions: number
  differences: PositionDifference[]
  errors?: string[]
}

export interface PositionDifference {
  symbol: string
  positionSide: PositionSide
  exchangeQuantity: string
  localQuantity: string
  difference: string
  action: 'created' | 'updated' | 'closed' | 'skipped'
}

/**
 * 仓位同步服务
 * 负责从交易所获取实际仓位并与本地数据库记录进行对比和同步
 */
@Injectable()
export class PositionSyncService {
  private readonly logger = new Logger(PositionSyncService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly tradingService: TradingService,
    private readonly positionsService: PositionsService,
  ) {}

  /**
   * 同步用户在指定交易所的仓位
   */
  async syncUserPositions(
    userId: string,
    accountId: string,
    exchangeId: ExchangeId,
    marketType: MarketType,
    syncType: 'manual' | 'scheduled' | 'auto' = 'manual',
    triggeredBy?: string,
  ): Promise<PositionSyncResult> {
    const syncedAt = new Date()
    const startTime = Date.now()
    const differences: PositionDifference[] = []
    const errors: string[] = []

    try {
      // 1. 从交易所获取实际仓位
      const exchangePositions = await this.tradingService.getPositions(userId, exchangeId, marketType)

      // 2. 获取本地记录的开放仓位
      const localPositions = await this.prisma.position.findMany({
        where: {
          userStrategyAccountId: accountId,
          status: PositionStatus.OPEN,
        },
      })

      this.logger.log(
        `Syncing positions for user ${userId}, account ${accountId}: ` +
        `${exchangePositions.length} from exchange, ${localPositions.length} in local DB`,
      )

      // 3. 构建交易所仓位映射（按 symbol + side 分组）
      const exchangePositionMap = new Map<string, UnifiedPosition>()
      for (const pos of exchangePositions) {
        const key = this.getPositionKey(pos.symbol, pos.side === 'long' ? 'LONG' : 'SHORT')
        exchangePositionMap.set(key, pos)
      }

      // 4. 构建本地仓位映射
      const localPositionMap = new Map<string, typeof localPositions[0]>()
      for (const pos of localPositions) {
        const key = this.getPositionKey(pos.symbol, pos.positionSide)
        localPositionMap.set(key, pos)
      }

      // 5. 对比并同步差异
      // 5.1 处理交易所存在但本地不存在或数量不一致的仓位
      for (const [key, exchangePos] of exchangePositionMap.entries()) {
        const localPos = localPositionMap.get(key)
        const exchangeQty = new Decimal(exchangePos.size)
        const localQty = localPos ? new Decimal(localPos.quantity) : new Decimal(0)

        if (!localPos) {
          // 交易所有仓位，本地没有，需要创建
          try {
            await this.createMissingPosition(accountId, exchangePos, exchangeId, marketType)
            differences.push({
              symbol: exchangePos.symbol,
              positionSide: exchangePos.side === 'long' ? 'LONG' : 'SHORT',
              exchangeQuantity: exchangeQty.toString(),
              localQuantity: '0',
              difference: exchangeQty.toString(),
              action: 'created',
            })
            this.logger.log(`Created missing position: ${exchangePos.symbol} ${exchangePos.side}`)
          }
          catch (error) {
            const errorMsg = `Failed to create position ${exchangePos.symbol}: ${(error as Error).message}`
            errors.push(errorMsg)
            this.logger.error(errorMsg, (error as Error).stack)
          }
        }
        else if (!exchangeQty.equals(localQty)) {
          // 数量不一致，需要调整
          const diff = exchangeQty.sub(localQty)
          try {
            await this.adjustPositionQuantity(localPos, exchangePos, diff)
            differences.push({
              symbol: exchangePos.symbol,
              positionSide: exchangePos.side === 'long' ? 'LONG' : 'SHORT',
              exchangeQuantity: exchangeQty.toString(),
              localQuantity: localQty.toString(),
              difference: diff.toString(),
              action: 'updated',
            })
            this.logger.log(
              `Adjusted position: ${exchangePos.symbol} ${exchangePos.side}, ` +
              `from ${localQty.toString()} to ${exchangeQty.toString()}`,
            )
          }
          catch (error) {
            const errorMsg = `Failed to adjust position ${exchangePos.symbol}: ${(error as Error).message}`
            errors.push(errorMsg)
            this.logger.error(errorMsg, (error as Error).stack)
          }
        }
      }

      // 5.2 处理本地存在但交易所不存在的仓位（应该关闭）
      for (const [key, localPos] of localPositionMap.entries()) {
        if (!exchangePositionMap.has(key)) {
          const localQty = new Decimal(localPos.quantity)
          if (localQty.gt(0)) {
            try {
              await this.closeOrphanedPosition(localPos)
              differences.push({
                symbol: localPos.symbol,
                positionSide: localPos.positionSide,
                exchangeQuantity: '0',
                localQuantity: localQty.toString(),
                difference: localQty.neg().toString(),
                action: 'closed',
              })
              this.logger.log(
                `Closed orphaned position: ${localPos.symbol} ${localPos.positionSide}`,
              )
            }
            catch (error) {
              const errorMsg = `Failed to close position ${localPos.symbol}: ${(error as Error).message}`
              errors.push(errorMsg)
              this.logger.error(errorMsg, (error as Error).stack)
            }
          }
        }
      }

      const result = {
        userId,
        exchangeId,
        marketType,
        success: errors.length === 0,
        syncedAt,
        exchangePositions: exchangePositions.length,
        localPositions: localPositions.length,
        differences,
        errors: errors.length > 0 ? errors : undefined,
      }

      // 记录同步日志
      const durationMs = Date.now() - startTime
      await this.saveSyncLog(result, accountId, syncType, triggeredBy, durationMs)

      return result
    }
    catch (error) {
      this.logger.error(
        `Failed to sync positions for user ${userId}: ${(error as Error).message}`,
        (error as Error).stack,
      )

      const result = {
        userId,
        exchangeId,
        marketType,
        success: false,
        syncedAt,
        exchangePositions: 0,
        localPositions: 0,
        differences: [],
        errors: [(error as Error).message],
      }

      // 记录失败日志
      const durationMs = Date.now() - startTime
      await this.saveSyncLog(result, accountId, syncType, triggeredBy, durationMs)

      return result
    }
  }

  /**
   * 批量同步所有活跃用户的仓位
   */
  async syncAllActivePositions(): Promise<PositionSyncResult[]> {
    this.logger.log('Starting batch position sync for all active accounts')

    const results: PositionSyncResult[] = []
    // 按“订阅绑定交易账户”构建同步任务，避免误同步无绑定账户
    const tasks = await this.collectBatchSyncTasks()

    if (tasks.length === 0) {
      this.logger.log('Batch sync skipped: no active subscriptions with exchange account binding')
      return results
    }

    for (const task of tasks) {
      try {
        const account = await this.prisma.userStrategyAccount.findUnique({
          where: {
            userId_strategyId: {
              userId: task.userId,
              strategyId: task.strategyId,
            },
          },
          select: { id: true },
        })

        if (!account) {
          this.logger.warn(
            `Batch sync skipped: strategy account not found for user=${task.userId}, strategy=${task.strategyId}`,
          )
          continue
        }

        const marketType = await this.inferMarketType(account.id, task.exchangeId)
        const result = await this.syncUserPositions(
          task.userId,
          account.id,
          task.exchangeId,
          marketType,
          'scheduled',
        )

        results.push(result)

        // 轻微限速，避免交易所 API 峰值
        await this.delay(300)
      }
      catch (error) {
        this.logger.error(
          `Failed to batch sync user=${task.userId}, strategy=${task.strategyId}: ${(error as Error).message}`,
          (error as Error).stack,
        )
      }
    }

    this.logger.log(
      `Batch sync completed: ${results.length} accounts processed, ` +
      `${results.filter(r => r.success).length} successful`,
    )

    return results
  }

  private async collectBatchSyncTasks(): Promise<Array<{ userId: string; strategyId: string; exchangeId: ExchangeId }>> {
    const [strategySubs, llmSubs] = await Promise.all([
      this.prisma.userStrategySubscription.findMany({
        where: {
          status: 'active',
          exchangeAccountId: { not: null },
        },
        select: {
          userId: true,
          strategyInstance: {
            select: {
              strategyTemplateId: true,
            },
          },
          exchangeAccount: {
            select: {
              exchangeId: true,
            },
          },
        },
        take: 200,
      }),
      this.prisma.userLlmStrategySubscription.findMany({
        where: {
          status: 'active',
          exchangeAccountId: { not: null },
        },
        select: {
          userId: true,
          llmStrategyInstance: {
            select: {
              strategyId: true,
            },
          },
          exchangeAccount: {
            select: {
              exchangeId: true,
            },
          },
        },
        take: 200,
      }),
    ])

    const taskMap = new Map<string, { userId: string; strategyId: string; exchangeId: ExchangeId }>()

    for (const sub of strategySubs) {
      const strategyId = sub.strategyInstance?.strategyTemplateId
      const exchangeId = sub.exchangeAccount?.exchangeId as ExchangeId | undefined
      if (!strategyId || !exchangeId) continue

      const key = `${sub.userId}:${strategyId}:${exchangeId}`
      taskMap.set(key, {
        userId: sub.userId,
        strategyId,
        exchangeId,
      })
    }

    for (const sub of llmSubs) {
      const strategyId = sub.llmStrategyInstance?.strategyId
      const exchangeId = sub.exchangeAccount?.exchangeId as ExchangeId | undefined
      if (!strategyId || !exchangeId) continue

      const key = `${sub.userId}:${strategyId}:${exchangeId}`
      taskMap.set(key, {
        userId: sub.userId,
        strategyId,
        exchangeId,
      })
    }

    return Array.from(taskMap.values())
  }

  private async inferMarketType(accountId: string, exchangeId: ExchangeId): Promise<MarketType> {
    const latestPosition = await this.prisma.position.findFirst({
      where: {
        userStrategyAccountId: accountId,
        exchangeId,
        marketType: {
          in: ['spot', 'perp'],
        },
      },
      select: {
        marketType: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (latestPosition?.marketType === 'spot' || latestPosition?.marketType === 'perp') {
      return latestPosition.marketType
    }

    return exchangeId === 'hyperliquid' ? 'perp' : 'spot'
  }

  private getPositionKey(symbol: string, side: PositionSide): string {
    return `${symbol.toUpperCase()}:${side}`
  }

  /**
   * 创建本地缺失的仓位
   */
  private async createMissingPosition(
    accountId: string,
    exchangePos: UnifiedPosition,
    exchangeId: ExchangeId,
    marketType: MarketType,
  ): Promise<void> {
    // 由于不知道具体的成交历史，只能记录一个对账调整
    const positionSide = exchangePos.side === 'long' ? PositionSide.LONG : PositionSide.SHORT
    const tradeSide = exchangePos.side === 'long' ? TradeSide.BUY : TradeSide.SELL

    await this.positionsService.recordTrade({
      userStrategyAccountId: accountId,
      symbol: this.normalizeSymbol(exchangePos.symbol),
      market: `${exchangeId}:${marketType}`,
      side: tradeSide,
      positionSide,
      price: exchangePos.entryPrice.toString(),
      quantity: exchangePos.size.toString(),
      fee: '0',
      orderId: `sync-${Date.now()}`,
      externalTradeId: `sync-${accountId}-${exchangePos.symbol}-${Date.now()}`,
      provider: exchangeId,
      executedAt: new Date().toISOString(),
      metadata: {
        syncSource: 'position-reconciliation',
        exchangePosition: exchangePos,
      },
    })
  }

  /**
   * 调整仓位数量
   */
  private async adjustPositionQuantity(
    localPos: any,
    exchangePos: UnifiedPosition,
    diff: Decimal,
  ): Promise<void> {
    // 差异为正：需要增加仓位（买入/加仓）
    // 差异为负：需要减少仓位（卖出/减仓）
    const isIncrease = diff.gt(0)
    const tradeSide = isIncrease
      ? (localPos.positionSide === PositionSide.LONG ? TradeSide.BUY : TradeSide.SELL)
      : (localPos.positionSide === PositionSide.LONG ? TradeSide.SELL : TradeSide.BUY)

    await this.positionsService.recordTrade({
      userStrategyAccountId: localPos.userStrategyAccountId,
      symbol: localPos.symbol,
      market: localPos.metadata?.market ?? 'unknown',
      side: tradeSide,
      positionSide: localPos.positionSide,
      price: exchangePos.entryPrice.toString(),
      quantity: diff.abs().toString(),
      fee: '0',
      orderId: `sync-adjust-${Date.now()}`,
      externalTradeId: `sync-adjust-${localPos.id}-${Date.now()}`,
      provider: 'reconciliation',
      executedAt: new Date().toISOString(),
      metadata: {
        syncSource: 'position-adjustment',
        originalQuantity: localPos.quantity.toString(),
        targetQuantity: exchangePos.size.toString(),
        difference: diff.toString(),
      },
    })
  }

  /**
   * 关闭孤立的仓位（交易所已不存在）
   */
  private async closeOrphanedPosition(localPos: any): Promise<void> {
    // 强制平仓
    const tradeSide = localPos.positionSide === PositionSide.LONG ? TradeSide.SELL : TradeSide.BUY

    await this.positionsService.recordTrade({
      userStrategyAccountId: localPos.userStrategyAccountId,
      symbol: localPos.symbol,
      market: localPos.metadata?.market ?? 'unknown',
      side: tradeSide,
      positionSide: localPos.positionSide,
      price: localPos.avgEntryPrice.toString(), // 使用平均入场价作为平仓价
      quantity: localPos.quantity.toString(),
      fee: '0',
      orderId: `sync-close-${Date.now()}`,
      externalTradeId: `sync-close-${localPos.id}-${Date.now()}`,
      provider: 'reconciliation',
      executedAt: new Date().toISOString(),
      metadata: {
        syncSource: 'position-closure',
        reason: 'position-not-found-on-exchange',
      },
    })
  }

  private normalizeSymbol(symbol: string): string {
    // 将 BTC/USDT:PERP 格式转换为 BTCUSDT
    return symbol
      .replace('/', '')
      .replace(':PERP', '')
      .replace(':SWAP', '')
      .toUpperCase()
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 保存同步日志到数据库
   */
  private async saveSyncLog(
    result: PositionSyncResult,
    accountId: string,
    syncType: 'manual' | 'scheduled' | 'auto',
    triggeredBy: string | undefined,
    durationMs: number,
  ): Promise<void> {
    try {
      await this.prisma.positionSyncLog.create({
        data: {
          userId: result.userId,
          userStrategyAccountId: accountId,
          exchangeId: result.exchangeId,
          marketType: result.marketType,
          syncType,
          success: result.success,
          exchangePositions: result.exchangePositions,
          localPositions: result.localPositions,
          differencesCount: result.differences.length,
          differences: result.differences.length > 0 ? (result.differences as any) : null,
          errors: result.errors && result.errors.length > 0 ? (result.errors as any) : null,
          durationMs,
          triggeredBy,
        },
      })

      this.logger.debug(
        `Saved sync log for user ${result.userId}, account ${accountId}: ` +
        `success=${result.success}, duration=${durationMs}ms`,
      )
    }
    catch (error) {
      // 日志保存失败不应阻断主流程
      this.logger.warn(
        `Failed to save position sync log: ${(error as Error).message}`,
      )
    }
  }
}
