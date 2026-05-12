import type { ExchangeId, MarketType, UnifiedPosition } from '@/modules/trading/core/types'
import { PositionSide, PositionStatus, TradeSide } from '@ai/shared'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { TradingService } from '@/modules/trading/trading.service'
import { normalizeLedgerSymbol } from '@/modules/trading/core/symbol-normalizer'
import { Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PositionsService } from './positions.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PositionsRepository } from './repositories/positions.repository'

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

interface SharedAccountAttribution {
  quantities: Map<string, Decimal>
  realTradeKeys: Set<string>
  syntheticTradeKeys: Set<string>
}

/**
 * 仓位同步服务
 * 负责从交易所获取实际仓位并与本地数据库记录进行对比和同步
 */
@Injectable()
export class PositionSyncService {
  private readonly logger = new Logger(PositionSyncService.name)

  constructor(
    private readonly positionsRepository: PositionsRepository,
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
    exchangeAccountId?: string,
  ): Promise<PositionSyncResult> {
    const syncedAt = new Date()
    const startTime = Date.now()
    const differences: PositionDifference[] = []
    const errors: string[] = []

    try {
      const resolvedExchangeAccountId = exchangeAccountId
        ?? await this.resolveSyncExchangeAccountId(userId, accountId, exchangeId)

      // 1. 从交易所获取实际仓位
      const exchangePositions = await this.tradingService.getPositions(userId, exchangeId, marketType, resolvedExchangeAccountId ?? undefined)

      // 2. 获取本地记录的开放仓位
      const allLocalPositions = await this.positionsRepository.findOpenByAccount(accountId)
      const localPositions = allLocalPositions.filter(pos => this.isPositionInSyncScope(pos, exchangeId, marketType))
      const matchableLocalPositions = allLocalPositions.filter(pos => this.isPositionMatchScope(pos, exchangeId, marketType))

      this.logger.log(
        `Syncing positions for user ${userId}, account ${accountId}: ` +
        `${exchangePositions.length} from exchange, ${localPositions.length} in local DB`,
      )

      // 3. 构建交易所仓位映射（按 symbol + side 分组）
      const exchangePositionMap = new Map<string, UnifiedPosition>()
      for (const pos of exchangePositions) {
        const positionSide = this.resolveExchangePositionSide(pos)
        if (!positionSide) {
          this.logger.warn(`Skipped non-directional exchange position: ${pos.symbol} ${pos.side}`)
          continue
        }

        const key = this.getPositionKey(pos.symbol, positionSide)
        exchangePositionMap.set(key, pos)
      }
      const sharedAccountSymbols = Array.from(exchangePositionMap.values())
        .map(pos => normalizeLedgerSymbol(pos.symbol))
      const sharedAccountAttribution = await this.loadSharedAccountAttribution(
        userId,
        accountId,
        exchangeId,
        marketType,
        resolvedExchangeAccountId ?? undefined,
        sharedAccountSymbols,
      )

      // 4. 构建本地仓位映射
      const localPositionMap = new Map<string, typeof localPositions[0]>()
      for (const pos of matchableLocalPositions) {
        const key = this.getPositionKey(pos.symbol, pos.positionSide)
        localPositionMap.set(key, pos)
      }

      // 5. 对比并同步差异
      // 5.1 处理交易所存在但本地不存在或数量不一致的仓位
      for (const [key, exchangePos] of exchangePositionMap.entries()) {
        const localPos = localPositionMap.get(key)
        const exchangeQty = new Decimal(exchangePos.size)
        const localQty = localPos ? new Decimal(localPos.quantity) : new Decimal(0)
        const positionSide = this.resolveExchangePositionSide(exchangePos)
        if (!positionSide) {
          continue
        }

        if (sharedAccountAttribution) {
          try {
            const handled = await this.syncSharedAccountPosition({
              accountId,
              key,
              exchangePos,
              exchangeQty,
              localPos,
              localQty,
              localInSyncScope: localPos ? localPositions.includes(localPos) : false,
              exchangeId,
              marketType,
              exchangeAccountId: resolvedExchangeAccountId ?? undefined,
              attribution: sharedAccountAttribution,
              differences,
            })
            if (handled) {
              continue
            }
          }
          catch (error) {
            const errorMsg = `Failed to sync shared account position ${exchangePos.symbol}: ${(error as Error).message}`
            errors.push(errorMsg)
            this.logger.error(errorMsg, (error as Error).stack)
            continue
          }
        }

        if (!localPos) {
          // 交易所有仓位，本地没有，需要创建
          try {
            await this.createMissingPosition(accountId, exchangePos, exchangeId, marketType, resolvedExchangeAccountId)
            differences.push({
              symbol: exchangePos.symbol,
              positionSide,
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
            await this.adjustPositionQuantity(localPos, exchangePos, diff, exchangeId, marketType, undefined, resolvedExchangeAccountId)
            differences.push({
              symbol: exchangePos.symbol,
              positionSide,
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
      const closePositionMap = new Map<string, typeof localPositions[0]>()
      for (const pos of localPositions) {
        const key = this.getPositionKey(pos.symbol, pos.positionSide)
        closePositionMap.set(key, pos)
      }

      for (const [key, localPos] of closePositionMap.entries()) {
        if (!exchangePositionMap.has(key)) {
          if (this.isSpotPosition(localPos)) {
            this.logger.warn(
              `Skipped orphan closure for spot position: ${localPos.symbol} ${localPos.positionSide}`,
            )
            continue
          }

          const localQty = new Decimal(localPos.quantity)
          if (localQty.gt(0)) {
            try {
              await this.closeOrphanedPosition(localPos, 'position-not-found-on-exchange', resolvedExchangeAccountId)
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
        const account = await this.positionsRepository.findUserStrategyAccount(task.userId, task.strategyId)

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
          undefined,
          task.exchangeAccountId,
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

  private async collectBatchSyncTasks(): Promise<Array<{
    userId: string
    strategyId: string
    exchangeId: ExchangeId
    exchangeAccountId: string
  }>> {
    const [strategySubs, llmSubs] = await this.positionsRepository.findActiveSubscriptionsForBatchSync(200)

    const taskMap = new Map<string, {
      userId: string
      strategyId: string
      exchangeId: ExchangeId
      exchangeAccountId: string
    }>()

    for (const sub of strategySubs) {
      const strategyId = sub.strategyInstance?.strategyTemplateId
      const exchangeId = sub.exchangeAccount?.exchangeId as ExchangeId | undefined
      const exchangeAccountId = sub.exchangeAccount?.id
      if (!strategyId || !exchangeId || !exchangeAccountId) continue

      const key = `${sub.userId}:${strategyId}:${exchangeId}:${exchangeAccountId}`
      taskMap.set(key, {
        userId: sub.userId,
        strategyId,
        exchangeId,
        exchangeAccountId,
      })
    }

    for (const sub of llmSubs) {
      const strategyId = sub.llmStrategyInstance?.strategyId
      const exchangeId = sub.exchangeAccount?.exchangeId as ExchangeId | undefined
      const exchangeAccountId = sub.exchangeAccount?.id
      if (!strategyId || !exchangeId || !exchangeAccountId) continue

      const key = `${sub.userId}:${strategyId}:${exchangeId}:${exchangeAccountId}`
      taskMap.set(key, {
        userId: sub.userId,
        strategyId,
        exchangeId,
        exchangeAccountId,
      })
    }

    return Array.from(taskMap.values())
  }

  private async inferMarketType(accountId: string, exchangeId: ExchangeId): Promise<MarketType> {
    const latestPosition = await this.positionsRepository.findFirstPositionByAccount(accountId, exchangeId)

    if (latestPosition?.marketType === 'spot' || latestPosition?.marketType === 'perp') {
      return latestPosition.marketType
    }

    return exchangeId === 'hyperliquid' ? 'perp' : 'spot'
  }

  private getPositionKey(symbol: string, side: PositionSide): string {
    return `${normalizeLedgerSymbol(symbol)}:${side}`
  }

  private resolveExchangePositionSide(position: UnifiedPosition): PositionSide | null {
    if (position.side === 'long') {
      return PositionSide.LONG
    }

    if (position.side === 'short') {
      return PositionSide.SHORT
    }

    return null
  }

  private isPositionInSyncScope(
    localPos: { symbol?: string | null; exchangeId?: string | null; marketType?: string | null; metadata?: unknown },
    syncExchangeId: ExchangeId,
    syncMarketType: MarketType,
  ): boolean {
    if (localPos.exchangeId) {
      if (localPos.exchangeId !== syncExchangeId) {
        return false
      }

      if (localPos.marketType) {
        return localPos.marketType === syncMarketType
      }

      const metadataMarket = this.readMetadataMarket(localPos.metadata)
      if (metadataMarket) {
        return metadataMarket === `${syncExchangeId}:${syncMarketType}`
      }

      const symbolMarketType = this.inferMarketTypeFromSymbol(localPos.symbol)
      return symbolMarketType === syncMarketType
    }

    const metadataMarket = this.readMetadataMarket(localPos.metadata)
    if (metadataMarket) {
      return metadataMarket === `${syncExchangeId}:${syncMarketType}`
    }

    return false
  }

  private isPositionMatchScope(
    localPos: { symbol?: string | null; exchangeId?: string | null; marketType?: string | null; metadata?: unknown },
    syncExchangeId: ExchangeId,
    syncMarketType: MarketType,
  ): boolean {
    if (this.isPositionInSyncScope(localPos, syncExchangeId, syncMarketType)) {
      return true
    }
    if (localPos.exchangeId && localPos.exchangeId !== syncExchangeId) {
      return false
    }

    const metadataMarket = this.readMetadataMarket(localPos.metadata)
    if (metadataMarket) {
      return metadataMarket === `${syncExchangeId}:${syncMarketType}`
    }
    if (localPos.marketType) {
      return localPos.marketType === syncMarketType
    }

    return this.inferMarketTypeFromSymbol(localPos.symbol) === syncMarketType
  }

  private inferMarketTypeFromSymbol(symbol?: string | null): MarketType | undefined {
    const normalized = String(symbol ?? '').toUpperCase()
    if (normalized.includes(':PERP') || normalized.endsWith('-SWAP')) {
      return 'perp'
    }
    return undefined
  }

  private isSpotPosition(
    localPos: { marketType?: string | null; metadata?: unknown },
  ): boolean {
    if (localPos.marketType === 'spot') {
      return true
    }

    if (this.readMetadataMarket(localPos.metadata)?.endsWith(':spot')) {
      return true
    }

    return false
  }

  private readMetadataMarket(metadata: unknown): string | undefined {
    if (!metadata || typeof metadata !== 'object' || !('market' in metadata)) {
      return undefined
    }

    const market = metadata.market
    return typeof market === 'string' ? market : undefined
  }

  private async loadSharedAccountAttribution(
    userId: string,
    accountId: string,
    exchangeId: ExchangeId,
    marketType: MarketType,
    exchangeAccountId?: string,
    symbols: string[] = [],
  ): Promise<SharedAccountAttribution | null> {
    if (exchangeId !== 'okx' || marketType !== 'perp') {
      return null
    }

    if (!exchangeAccountId) {
      return null
    }

    if (symbols.length === 0) {
      return null
    }

    if (
      typeof this.positionsRepository.countActiveStrategyBindingsByExchangeAccount !== 'function'
      || typeof this.positionsRepository.findTradesByAccount !== 'function'
    ) {
      return null
    }

    const bindingCount = await this.positionsRepository.countActiveStrategyBindingsByExchangeAccount(userId, exchangeAccountId)
    if (bindingCount <= 1) {
      return null
    }

    const trades = await this.positionsRepository.findTradesByAccount(accountId, symbols)
    const quantities = new Map<string, Decimal>()
    const realTradeKeys = new Set<string>()
    const syntheticTradeKeys = new Set<string>()

    for (const trade of trades) {
      if (!this.isTradeForExchangeAccount(trade, exchangeAccountId)) {
        continue
      }

      if (!this.isTradeInSyncScope(trade, exchangeId, marketType)) {
        continue
      }

      const key = this.getPositionKey(trade.symbol, trade.positionSide)
      if (this.isSyntheticTrade(trade)) {
        syntheticTradeKeys.add(key)
        continue
      }

      realTradeKeys.add(key)
      const signedQuantity = this.getSignedTradeQuantity(trade)
      const nextQuantity = (quantities.get(key) ?? new Decimal(0)).add(signedQuantity)
      quantities.set(key, nextQuantity.gt(0) ? nextQuantity : new Decimal(0))
    }

    return { quantities, realTradeKeys, syntheticTradeKeys }
  }

  private async resolveSyncExchangeAccountId(
    userId: string,
    accountId: string,
    exchangeId: ExchangeId,
  ): Promise<string | null> {
    if (typeof this.positionsRepository.findExchangeAccountIdForStrategyAccount !== 'function') {
      return null
    }

    return this.positionsRepository.findExchangeAccountIdForStrategyAccount(userId, accountId, exchangeId)
  }

  private async syncSharedAccountPosition(params: {
    accountId: string
    key: string
    exchangePos: UnifiedPosition
    exchangeQty: Decimal
    localPos: Awaited<ReturnType<PositionsRepository['findOpenByAccount']>>[number] | undefined
    localQty: Decimal
    localInSyncScope: boolean
    exchangeId: ExchangeId
    marketType: MarketType
    exchangeAccountId?: string
    attribution: SharedAccountAttribution
    differences: PositionDifference[]
  }): Promise<boolean> {
    const {
      accountId,
      key,
      exchangePos,
      exchangeQty,
      localPos,
      localQty,
      localInSyncScope,
      exchangeId,
      marketType,
      exchangeAccountId,
      attribution,
      differences,
    } = params
    const attributedQty = attribution.quantities.get(key) ?? new Decimal(0)
    const positionSide = this.resolveExchangePositionSide(exchangePos)
    if (!positionSide) {
      return true
    }

    if (!localPos) {
      if (attributedQty.gt(0)) {
        await this.createMissingPosition(accountId, exchangePos, exchangeId, marketType, exchangeAccountId, attributedQty)
        differences.push({
          symbol: exchangePos.symbol,
          positionSide,
          exchangeQuantity: exchangeQty.toString(),
          localQuantity: '0',
          difference: attributedQty.toString(),
          action: 'created',
        })
        return true
      }

      differences.push({
        symbol: exchangePos.symbol,
        positionSide,
        exchangeQuantity: exchangeQty.toString(),
        localQuantity: '0',
        difference: exchangeQty.toString(),
        action: 'skipped',
      })
      this.logger.warn(
        `Skipped shared account position without strategy attribution: ${exchangePos.symbol} ${exchangePos.side}`,
      )
      return true
    }

    if (attributedQty.lte(0)) {
      if (localInSyncScope && this.isSyntheticLocalPosition(localPos, key, attribution)) {
        await this.closeOrphanedPosition(localPos, 'shared-account-unattributed-synthetic-position', exchangeAccountId)
        differences.push({
          symbol: exchangePos.symbol,
          positionSide,
          exchangeQuantity: exchangeQty.toString(),
          localQuantity: localQty.toString(),
          difference: localQty.neg().toString(),
          action: 'closed',
        })
        return true
      }

      differences.push({
        symbol: exchangePos.symbol,
        positionSide,
        exchangeQuantity: exchangeQty.toString(),
        localQuantity: localQty.toString(),
        difference: exchangeQty.sub(localQty).toString(),
        action: 'skipped',
      })
      this.logger.warn(
        `Skipped shared account adjustment without strategy attribution: ${exchangePos.symbol} ${exchangePos.side}`,
      )
      return true
    }

    if (!attributedQty.equals(localQty)) {
      const diff = attributedQty.sub(localQty)
      await this.adjustPositionQuantity(
        localPos,
        exchangePos,
        diff,
        exchangeId,
        marketType,
        attributedQty,
        exchangeAccountId,
      )
      differences.push({
        symbol: exchangePos.symbol,
        positionSide,
        exchangeQuantity: exchangeQty.toString(),
        localQuantity: localQty.toString(),
        difference: diff.toString(),
        action: 'updated',
      })
      return true
    }

    return true
  }

  private isTradeInSyncScope(
    trade: { symbol?: string | null; market?: string | null },
    exchangeId: ExchangeId,
    marketType: MarketType,
  ): boolean {
    if (trade.market) {
      return trade.market === `${exchangeId}:${marketType}`
    }

    return this.inferMarketTypeFromSymbol(trade.symbol) === marketType
  }

  private isTradeForExchangeAccount(
    trade: { metadata?: unknown },
    exchangeAccountId: string,
  ): boolean {
    return this.readMetadataExchangeAccountId(trade.metadata) === exchangeAccountId
  }

  private isSyntheticTrade(
    trade: { orderId?: string | null; externalTradeId?: string | null; provider?: string | null; metadata?: unknown },
  ): boolean {
    if (trade.provider === 'reconciliation') {
      return true
    }

    if (trade.orderId?.startsWith('sync-') || trade.externalTradeId?.startsWith('sync-')) {
      return true
    }

    return Boolean(this.readSyncSource(trade.metadata))
  }

  private readMetadataExchangeAccountId(metadata: unknown): string | null {
    if (!metadata || typeof metadata !== 'object' || !('exchangeAccountId' in metadata)) {
      return null
    }

    const exchangeAccountId = metadata.exchangeAccountId
    return typeof exchangeAccountId === 'string' ? exchangeAccountId : null
  }

  private isSyntheticLocalPosition(
    localPos: { metadata?: unknown },
    key: string,
    attribution: SharedAccountAttribution,
  ): boolean {
    if (this.readSyncSource(localPos.metadata)) {
      return true
    }

    return attribution.syntheticTradeKeys.has(key) && !attribution.realTradeKeys.has(key)
  }

  private readSyncSource(metadata: unknown): string | undefined {
    if (!metadata || typeof metadata !== 'object' || !('syncSource' in metadata)) {
      return undefined
    }

    const syncSource = metadata.syncSource
    return typeof syncSource === 'string' ? syncSource : undefined
  }

  private getSignedTradeQuantity(
    trade: { positionSide: PositionSide; side: TradeSide; quantity: Decimal | string | number },
  ): Decimal {
    const quantity = new Decimal(trade.quantity)
    const isIncrease = trade.positionSide === PositionSide.LONG
      ? trade.side === TradeSide.BUY
      : trade.side === TradeSide.SELL

    return isIncrease ? quantity : quantity.neg()
  }

  /**
   * 创建本地缺失的仓位
   */
  private async createMissingPosition(
    accountId: string,
    exchangePos: UnifiedPosition,
    exchangeId: ExchangeId,
    marketType: MarketType,
    exchangeAccountId?: string | null,
    quantityOverride?: Decimal,
  ): Promise<void> {
    // 由于不知道具体的成交历史，只能记录一个对账调整
    const positionSide = this.resolveExchangePositionSide(exchangePos)
    if (!positionSide) {
      return
    }

    const tradeSide = positionSide === PositionSide.LONG ? TradeSide.BUY : TradeSide.SELL

    const quantity = quantityOverride ?? new Decimal(exchangePos.size)

    await this.positionsService.recordTrade({
      userStrategyAccountId: accountId,
      symbol: normalizeLedgerSymbol(exchangePos.symbol),
      market: `${exchangeId}:${marketType}`,
      side: tradeSide,
      positionSide,
      price: exchangePos.entryPrice.toString(),
      quantity: quantity.toString(),
      fee: '0',
      orderId: `sync-${Date.now()}`,
      externalTradeId: `sync-${accountId}-${exchangePos.symbol}-${Date.now()}`,
      provider: exchangeId,
      executedAt: new Date().toISOString(),
      metadata: {
        syncSource: 'position-reconciliation',
        market: `${exchangeId}:${marketType}`,
        exchangeAccountId: exchangeAccountId ?? null,
        exchangePosition: quantityOverride
          ? { ...exchangePos, size: quantity.toString() }
          : exchangePos,
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
    exchangeId: ExchangeId,
    marketType: MarketType,
    targetQuantity: Decimal = new Decimal(exchangePos.size),
    exchangeAccountId?: string | null,
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
      market: `${exchangeId}:${marketType}`,
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
        market: `${exchangeId}:${marketType}`,
        exchangeAccountId: exchangeAccountId ?? null,
        originalQuantity: localPos.quantity.toString(),
        targetQuantity: targetQuantity.toString(),
        difference: diff.toString(),
      },
    })
  }

  /**
   * 关闭孤立的仓位（交易所已不存在）
   */
  private async closeOrphanedPosition(
    localPos: any,
    reason: 'position-not-found-on-exchange' | 'shared-account-unattributed-synthetic-position' = 'position-not-found-on-exchange',
    exchangeAccountId?: string | null,
  ): Promise<void> {
    // 强制平仓
    const tradeSide = localPos.positionSide === PositionSide.LONG ? TradeSide.SELL : TradeSide.BUY

    await this.positionsService.recordTrade({
      userStrategyAccountId: localPos.userStrategyAccountId,
      symbol: localPos.symbol,
      market: this.resolveLocalPositionMarket(localPos),
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
        reason,
        exchangeAccountId: exchangeAccountId ?? null,
      },
    })
  }

  private resolveLocalPositionMarket(
    localPos: { exchangeId?: string | null; marketType?: string | null; metadata?: unknown },
  ): string {
    if (localPos.exchangeId && localPos.marketType) {
      return `${localPos.exchangeId}:${localPos.marketType}`
    }

    return this.readMetadataMarket(localPos.metadata) ?? 'unknown'
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
      await this.positionsRepository.saveSyncLog({
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
