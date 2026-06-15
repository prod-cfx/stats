import type {
  QueryTraderOpenOrdersDto,
  TraderOpenOrdersResponseDto,
} from '../dto/trader-open-orders.dto'
import type {
  QueryTraderPositionsDto,
  TraderPositionsResponseDto,
} from '../dto/trader-positions.dto'
import type { QueryTraderSnapshotDto, TraderSnapshotResponseDto } from '../dto/trader-snapshot.dto'
import type {
  ClearinghouseStateResponse,
  HyperliquidAssetPosition,
  HyperliquidOpenOrder,
  HyperliquidSpotBalance,
} from './hyperliquid-api.service'
import { safeParseFloat } from '@ai/shared'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { HyperliquidApiService } from './hyperliquid-api.service'

@Injectable()
export class WhaleSnapshotService {
  private readonly logger = new Logger(WhaleSnapshotService.name)

  constructor(private readonly hyperliquidApi: HyperliquidApiService) {}

  async getTraderSnapshot(
    address: string,
    query: QueryTraderSnapshotDto,
  ): Promise<TraderSnapshotResponseDto> {
    const skipCache = query.skipCache ?? false

    const [perpState, spotState] = await Promise.all([
      this.hyperliquidApi.getClearinghouseState(address, skipCache),
      this.hyperliquidApi.getSpotClearinghouseState(address, skipCache),
    ])

    const perpSummary =
      perpState.marginSummary || ({} as ClearinghouseStateResponse['marginSummary'])
    const accountValue = safeParseFloat(perpSummary.accountValue)
    const totalMarginUsed = safeParseFloat(perpSummary.totalMarginUsed)
    const totalPositionValue = safeParseFloat(perpSummary.totalNtlPos)
    const withdrawable = safeParseFloat(perpState.withdrawable)

    const marginUsagePercent = accountValue > 0 ? (totalMarginUsed / accountValue) * 100 : 0
    const leverageRatio = totalMarginUsed > 0 ? totalPositionValue / totalMarginUsed : 0

    let unrealizedPnl = 0
    const assetPositions: HyperliquidAssetPosition[] = perpState.assetPositions || []
    for (const ap of assetPositions) {
      unrealizedPnl += safeParseFloat(ap.position?.unrealizedPnl)
    }
    const roi = totalMarginUsed > 0 ? (unrealizedPnl / totalMarginUsed) * 100 : 0

    const spotBalances: HyperliquidSpotBalance[] = spotState.balances || []
    let spotTotalValue = 0

    if (spotBalances.length > 0) {
      this.logger.warn(
        `[PERF-002] 现货余额价值计算暂未实现 (address=${address}, balances=${spotBalances.length}), 返回值为 0`,
      )
    }

    interface BalanceWithValue {
      coin: string
      total: number
      hold: number
      value: number
      sharePercent: number
    }
    const balances: BalanceWithValue[] = []

    for (const balance of spotBalances) {
      const total = safeParseFloat(balance.total)
      const hold = safeParseFloat(balance.hold)
      const value = 0
      spotTotalValue += value

      balances.push({
        coin: balance.coin,
        total,
        hold,
        value,
        sharePercent: 0,
      })
    }

    for (const balance of balances) {
      balance.sharePercent = spotTotalValue > 0 ? (balance.value / spotTotalValue) * 100 : 0
    }

    const totalAccountValue = accountValue + spotTotalValue
    const perpPercent = totalAccountValue > 0 ? (accountValue / totalAccountValue) * 100 : 0
    const spotPercent = totalAccountValue > 0 ? (spotTotalValue / totalAccountValue) * 100 : 0

    return {
      perp: {
        accountValue,
        totalMarginUsed,
        totalPositionValue,
        withdrawable,
        marginUsagePercent: Number(marginUsagePercent.toFixed(2)),
        leverageRatio: Number(leverageRatio.toFixed(2)),
        unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
        roi: Number(roi.toFixed(2)),
      },
      spot: {
        totalValue: spotTotalValue,
        balances,
      },
      total: {
        accountValue: totalAccountValue,
        perpPercent: Number(perpPercent.toFixed(3)),
        spotPercent: Number(spotPercent.toFixed(3)),
      },
    }
  }

  async getTraderPositions(
    address: string,
    query: QueryTraderPositionsDto,
  ): Promise<TraderPositionsResponseDto> {
    const skipCache = query.skipCache ?? false
    const type = query.type ?? 'all'

    const needPerp = type === 'all' || type === 'perp'
    const needSpot = type === 'all' || type === 'spot'

    const [perpState, spotState] = await Promise.all([
      needPerp ? this.hyperliquidApi.getClearinghouseState(address, skipCache) : null,
      needSpot ? this.hyperliquidApi.getSpotClearinghouseState(address, skipCache) : null,
    ])

    interface PerpPositionItem {
      coin: string
      side: 'LONG' | 'SHORT'
      size: number
      entryPrice: number
      markPrice: number
      liquidationPrice: number
      positionValue: number
      marginUsed: number
      leverage: { type: 'cross' | 'isolated'; value: number }
      unrealizedPnl: number
      unrealizedPnlPercent: number
      fundingRate?: number
      roi: number
    }

    const perpPositions: PerpPositionItem[] = []
    if (perpState) {
      const assetPositions: HyperliquidAssetPosition[] = perpState.assetPositions || []
      for (const ap of assetPositions) {
        const position = ap.position
        if (!position) continue

        const szi = safeParseFloat(position.szi)
        const side: 'LONG' | 'SHORT' = szi > 0 ? 'LONG' : 'SHORT'
        const entryPrice = safeParseFloat(position.entryPx)
        const markPrice = szi !== 0 ? Math.abs(safeParseFloat(position.positionValue) / szi) : 0
        const liquidationPrice = safeParseFloat(position.liquidationPx)
        const positionValue = safeParseFloat(position.positionValue)
        const marginUsed = safeParseFloat(position.marginUsed)
        const unrealizedPnl = safeParseFloat(position.unrealizedPnl)
        const unrealizedPnlPercent = marginUsed > 0 ? (unrealizedPnl / marginUsed) * 100 : 0
        const roi = marginUsed > 0 ? (unrealizedPnl / marginUsed) * 100 : 0

        const cumFunding = position.cumFunding
        const fundingRate = cumFunding ? safeParseFloat(cumFunding.sinceOpen) : undefined

        const leverage = position.leverage || { type: 'cross' as const, value: 1 }
        const leverageType: 'cross' | 'isolated' =
          leverage.type === 'isolated' ? 'isolated' : 'cross'
        const leverageValue = Number(leverage.value || 1)

        perpPositions.push({
          coin: position.coin,
          side,
          size: szi,
          entryPrice,
          markPrice,
          liquidationPrice,
          positionValue,
          marginUsed,
          leverage: {
            type: leverageType,
            value: leverageValue,
          },
          unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
          unrealizedPnlPercent: Number(unrealizedPnlPercent.toFixed(2)),
          fundingRate: fundingRate !== undefined ? Number(fundingRate.toFixed(2)) : undefined,
          roi: Number(roi.toFixed(2)),
        })
      }
    }

    interface SpotBalanceItem {
      coin: string
      total: number
      hold: number
      available: number
      value: number
    }

    const spotBalancesResult: SpotBalanceItem[] = []
    if (spotState) {
      const balances: HyperliquidSpotBalance[] = spotState.balances || []

      if (balances.length > 0) {
        this.logger.warn(
          `[PERF-002] 持仓详情现货价值计算暂未实现 (address=${address}, balances=${balances.length}), 返回值为 0`,
        )
      }

      for (const balance of balances) {
        const total = safeParseFloat(balance.total)
        if (total === 0) continue

        const hold = safeParseFloat(balance.hold)
        const available = total - hold
        const value = 0

        spotBalancesResult.push({
          coin: balance.coin,
          total,
          hold,
          available,
          value,
        })
      }
    }

    return {
      perp: perpPositions,
      spot: spotBalancesResult,
    }
  }

  async getTraderOpenOrders(
    address: string,
    query: QueryTraderOpenOrdersDto,
  ): Promise<TraderOpenOrdersResponseDto> {
    const skipCache = query.skipCache ?? false
    const coinFilter = query.coin

    const openOrders: HyperliquidOpenOrder[] = await this.hyperliquidApi.getOpenOrders(
      address,
      skipCache,
    )

    let filteredOrders = openOrders || []
    if (coinFilter) {
      filteredOrders = filteredOrders.filter(order => order.coin === coinFilter)
    }

    const orders = filteredOrders.map(order => {
      const side: 'BUY' | 'SELL' = order.side === 'A' ? 'BUY' : 'SELL'
      const limitPrice = safeParseFloat(order.limitPx)
      const size = safeParseFloat(order.sz)
      const origSize = safeParseFloat(order.origSz)
      const value = limitPrice * size
      const timestamp = new Date(order.timestamp).toISOString()

      return {
        orderId: order.oid,
        coin: order.coin,
        side,
        type: order.orderType || 'limit',
        price: limitPrice,
        size,
        origSize,
        value,
        timestamp,
        triggerPrice: order.triggerPx ? safeParseFloat(order.triggerPx) : null,
        triggerCondition: order.triggerCondition || null,
        reduceOnly: order.reduceOnly || false,
      }
    })

    return { orders }
  }
}
