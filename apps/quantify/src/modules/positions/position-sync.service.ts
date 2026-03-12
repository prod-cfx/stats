import type { ExchangeId, MarketType, UnifiedPosition } from '@/modules/trading/core/types'
import { Injectable, Logger } from '@nestjs/common'
import { PositionSide, PositionStatus, Prisma, TradeSide } from '@prisma/client'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { TradingService } from '@/modules/trading/trading.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { PrismaService } from '@/prisma/prisma.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { PositionsService } from './positions.service'

// Prisma 7: 浠?Prisma namespace 瀵煎嚭绫诲瀷鍜屽€?
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
 * 浠撲綅鍚屾鏈嶅姟
 * 璐熻矗浠庝氦鏄撴墍鑾峰彇瀹為檯浠撲綅骞朵笌鏈湴鏁版嵁搴撹褰曡繘琛屽姣斿拰鍚屾
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
   * 鍚屾鐢ㄦ埛鍦ㄦ寚瀹氫氦鏄撴墍鐨勪粨浣?
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
      // 1. 浠庝氦鏄撴墍鑾峰彇瀹為檯浠撲綅
      const exchangePositions = await this.tradingService.getPositions(userId, exchangeId, marketType)

      // 2. 鑾峰彇鏈湴璁板綍鐨勫紑鏀句粨浣?
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

      // 3. 鏋勫缓浜ゆ槗鎵€浠撲綅鏄犲皠锛堟寜 symbol + side 鍒嗙粍锛?
      const exchangePositionMap = new Map<string, UnifiedPosition>()
      for (const pos of exchangePositions) {
        const key = this.getPositionKey(pos.symbol, pos.side === 'long' ? 'LONG' : 'SHORT')
        exchangePositionMap.set(key, pos)
      }

      // 4. 鏋勫缓鏈湴浠撲綅鏄犲皠
      const localPositionMap = new Map<string, typeof localPositions[0]>()
      for (const pos of localPositions) {
        const key = this.getPositionKey(pos.symbol, pos.positionSide)
        localPositionMap.set(key, pos)
      }

      // 5. 瀵规瘮骞跺悓姝ュ樊寮?
      // 5.1 澶勭悊浜ゆ槗鎵€瀛樺湪浣嗘湰鍦颁笉瀛樺湪鎴栨暟閲忎笉涓€鑷寸殑浠撲綅
      for (const [key, exchangePos] of exchangePositionMap.entries()) {
        const localPos = localPositionMap.get(key)
        const exchangeQty = new Decimal(exchangePos.size)
        const localQty = localPos ? new Decimal(localPos.quantity) : new Decimal(0)

        if (!localPos) {
          // 浜ゆ槗鎵€鏈変粨浣嶏紝鏈湴娌℃湁 - 闇€瑕佸垱寤?
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
          // 鏁伴噺涓嶄竴鑷?- 闇€瑕佽皟鏁?
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

      // 5.2 澶勭悊鏈湴瀛樺湪浣嗕氦鏄撴墍涓嶅瓨鍦ㄧ殑浠撲綅锛堝簲璇ュ叧闂級
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

      // 璁板綍鍚屾鏃ュ織
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

      // 璁板綍澶辫触鏃ュ織
      const durationMs = Date.now() - startTime
      await this.saveSyncLog(result, accountId, syncType, triggeredBy, durationMs)

      return result
    }
  }

  /**
   * 鎵归噺鍚屾鎵€鏈夋椿璺冪敤鎴风殑浠撲綅
   */
  async syncAllActivePositions(): Promise<PositionSyncResult[]> {
    this.logger.log('Starting batch position sync for all active accounts')

    // 鑾峰彇鎵€鏈夋湁鏁堢殑鐢ㄦ埛浜ゆ槗璐︽埛閰嶇疆
    const _accounts = await this.prisma.userStrategyAccount.findMany({
      where: {
        // 鍙互娣诲姞鏇村杩囨护鏉′欢锛屾瘮濡傚彧鍚屾鏈€杩戞椿璺冪殑璐︽埛
      },
      include: {
        user: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100, // 姣忔鏈€澶氬悓姝?100 涓处鎴?
    })

    const results: PositionSyncResult[] = []

    // TODO: 瀹炵幇瀹屾暣鐨勬壒閲忓悓姝ラ€昏緫
    // 闇€瑕佷粠璐︽埛閰嶇疆鎴栧叾浠栧湴鏂硅幏鍙栦氦鏄撴墍鍜屽競鍦虹被鍨嬩俊鎭?
    // 褰撳墠瀹炵幇渚濊禆鐨勬暟鎹粨鏋勮繕涓嶅畬鏁达紝鏆傛椂杩斿洖绌虹粨鏋?
    this.logger.warn('Batch sync not fully implemented: missing exchange account mapping')

    /*
    for (const account of accounts) {
      try {
        // 闇€瑕佷粠鐢ㄦ埛閰嶇疆涓幏鍙栦氦鏄撴墍淇℃伅
        const userExchangeAccount = await this.prisma.exchangeAccount.findFirst({
          where: {
            userId: account.userId,
          },
        })

        if (!userExchangeAccount) {
          this.logger.debug(`No active exchange account for user ${account.userId}`)
          continue
        }

        const exchangeId = userExchangeAccount.exchangeId as ExchangeId
        // marketType 闇€瑕佷粠鍏朵粬鍦版柟鑾峰彇鎴栭厤缃?
        const marketType: MarketType = 'perp' // 榛樿鍚堢害

        const result = await this.syncUserPositions(
          account.userId,
          account.id,
          exchangeId,
          marketType,
          'scheduled',
        )
        results.push(result)

        // 娣诲姞寤惰繜閬垮厤杩囦簬棰戠箒璇锋眰浜ゆ槗鎵€ API
        await this.delay(1000)
      }
      catch (error) {
        this.logger.error(
          `Failed to sync account ${account.id}: ${(error as Error).message}`,
          (error as Error).stack,
        )
      }
    }
    */

    this.logger.log(
      `Batch sync completed: ${results.length} accounts processed, ` +
      `${results.filter(r => r.success).length} successful`,
    )

    return results
  }

  private getPositionKey(symbol: string, side: PositionSide): string {
    return `${symbol.toUpperCase()}:${side}`
  }

  /**
   * 鍒涘缓鏈湴缂哄け鐨勪粨浣?
   */
  private async createMissingPosition(
    accountId: string,
    exchangePos: UnifiedPosition,
    exchangeId: ExchangeId,
    marketType: MarketType,
  ): Promise<void> {
    // 鐢变簬涓嶇煡閬撳叿浣撶殑鎴愪氦鍘嗗彶锛屽彧鑳借褰曚竴涓璐﹁皟鏁?
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
   * 璋冩暣浠撲綅鏁伴噺
   */
  private async adjustPositionQuantity(
    localPos: any,
    exchangePos: UnifiedPosition,
    diff: Decimal,
  ): Promise<void> {
    // 宸紓涓烘锛氶渶瑕佸鍔犱粨浣嶏紙涔板叆/鍔犱粨锛?
    // 宸紓涓鸿礋锛氶渶瑕佸噺灏戜粨浣嶏紙鍗栧嚭/鍑忎粨锛?
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
   * 鍏抽棴瀛ょ珛鐨勪粨浣嶏紙浜ゆ槗鎵€宸蹭笉瀛樺湪锛?
   */
  private async closeOrphanedPosition(localPos: any): Promise<void> {
    // 寮哄埗骞充粨
    const tradeSide = localPos.positionSide === PositionSide.LONG ? TradeSide.SELL : TradeSide.BUY

    await this.positionsService.recordTrade({
      userStrategyAccountId: localPos.userStrategyAccountId,
      symbol: localPos.symbol,
      market: localPos.metadata?.market ?? 'unknown',
      side: tradeSide,
      positionSide: localPos.positionSide,
      price: localPos.avgEntryPrice.toString(), // 浣跨敤骞冲潎鍏ュ満浠蜂綔涓哄钩浠撲环
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
    // 灏?BTC/USDT:PERP 鏍煎紡杞崲涓?BTCUSDT
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
   * 淇濆瓨鍚屾鏃ュ織鍒版暟鎹簱
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
      // 鏃ュ織淇濆瓨澶辫触涓嶅簲闃绘柇涓绘祦绋?
      this.logger.warn(
        `Failed to save position sync log: ${(error as Error).message}`,
      )
    }
  }
}
