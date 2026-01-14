import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { HyperliquidApiService } from '@/modules/whale-tracking/services/hyperliquid-api.service'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

interface UserOrdersCursor {
  /**
   * 鲸鱼地址（必填）
   */
  userAddress: string
  /**
   * 最后同步时间戳（毫秒）
   */
  lastSyncTime: number
}

interface HyperliquidOrder {
  coin: string
  side: string // 'A' = buy, 'B' = sell
  limitPx: string // limit price
  sz: string // size
  oid: number // order ID
  timestamp: number // milliseconds
  origSz: string // original size
  // Optional fields
  cloid?: string // client order ID
  orderType?: string
  triggerPx?: string // trigger price
  triggerCondition?: string
  reduceOnly?: boolean
}

@Injectable()
export class HyperliquidUserOrdersSyncJob implements DataPullJob {
  readonly key = 'hyperliquid-user-orders-sync'
  private readonly logger = new Logger(HyperliquidUserOrdersSyncJob.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly hyperliquidApi: HyperliquidApiService,
  ) {}

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    if (!cursor.userAddress) {
      throw new Error('userAddress is required in cursor')
    }

    const now = Date.now()

    this.logger.log(`Fetching historical orders for ${cursor.userAddress}`)

    // 调用 Hyperliquid API（historicalOrders 不支持时间范围参数，返回所有历史订单）
    const orders = await this.hyperliquidApi.getHistoricalOrders<HyperliquidOrder[]>(
      cursor.userAddress,
      false, // skipCache
    )

    if (!orders || orders.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify({ ...cursor, lastSyncTime: now }),
        meta: {
          note: 'No orders data returned from Hyperliquid API',
          userAddress: cursor.userAddress,
        },
      }
    }

    // 过滤增量数据：仅同步 lastSyncTime 之后的订单
    const incrementalOrders = orders.filter(order => order.timestamp > cursor.lastSyncTime)

    if (incrementalOrders.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify({ ...cursor, lastSyncTime: now }),
        meta: {
          note: 'No new orders since last sync',
          userAddress: cursor.userAddress,
          apiDataCount: orders.length,
        },
      }
    }

    const client = this.prisma.getClient()

    // 转换数据并写入数据库
    const rows = incrementalOrders.map(order => ({
      userAddress: cursor.userAddress,
      coin: order.coin,
      orderId: BigInt(order.oid),
      clientOrderId: order.cloid ?? null,
      side: order.side,
      limitPrice: order.limitPx,
      size: order.sz,
      originalSize: order.origSz,
      orderType: order.orderType ?? null,
      triggerPrice: order.triggerPx ?? null,
      triggerCondition: order.triggerCondition ?? null,
      reduceOnly: order.reduceOnly ?? null,
      status: 'filled', // 历史订单默认为已完成状态
      timestamp: new Date(order.timestamp),
      source: 'HYPERLIQUID',
    }))

    const result = await client.hyperliquidUserOrder.createMany({
      data: rows,
      skipDuplicates: true, // 幂等性：基于唯一约束 (userAddress, orderId)
    })

    const insertedCount = result.count

    // 更新 cursor
    const newCursor: UserOrdersCursor = {
      userAddress: cursor.userAddress,
      lastSyncTime: now,
    }

    // 统计
    const buyOrders = incrementalOrders.filter(o => o.side === 'A').length
    const sellOrders = incrementalOrders.filter(o => o.side === 'B').length

    return {
      fetchedCount: insertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        userAddress: cursor.userAddress,
        apiDataCount: orders.length,
        incrementalCount: incrementalOrders.length,
        insertedCount,
        stats: {
          buyOrders,
          sellOrders,
        },
      },
    }
  }

  private parseCursor(currentCursor: string | null): UserOrdersCursor {
    if (!currentCursor) {
      return {
        userAddress: '',
        lastSyncTime: 0,
      }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<UserOrdersCursor>
      return {
        userAddress: parsed.userAddress || '',
        lastSyncTime: parsed.lastSyncTime || 0,
      }
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return {
        userAddress: '',
        lastSyncTime: 0,
      }
    }
  }
}
