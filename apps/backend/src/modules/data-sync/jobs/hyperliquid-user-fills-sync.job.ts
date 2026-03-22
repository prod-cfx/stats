import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports
import { HyperliquidApiService } from '@/modules/whale-tracking/services/hyperliquid-api.service'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

interface UserFillsCursor {
  /**
   * 鲸鱼地址（必填）
   */
  userAddress: string
  /**
   * 最后同步时间戳（毫秒）
   */
  lastSyncTime: number
}

interface HyperliquidFill {
  coin: string
  px: string // price
  sz: string // size
  side: string // 'A' = buy, 'B' = sell
  time: number // timestamp in milliseconds
  startPosition: string
  dir: string // direction
  closedPnl: string
  hash: string
  oid: number // order ID
  crossed: boolean
  fee: string
  tid: number // trade ID
  liquidation: boolean
}

@Injectable()
export class HyperliquidUserFillsSyncJob implements DataPullJob {
  readonly key = 'hyperliquid-user-fills-sync'
  private readonly logger = new Logger(HyperliquidUserFillsSyncJob.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly hyperliquidApi: HyperliquidApiService,
  ) {}

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    if (!cursor.userAddress) {
      throw new DomainException('data_sync.user_fills_sync.config_missing', {
        code: ErrorCode.DATA_SYNC_CONFIG_MISSING,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'userAddress is required in cursor' },
      })
    }

    // 计算查询时间范围：从 lastSyncTime 到现在
    const now = Date.now()
    const startTime = cursor.lastSyncTime || now - 24 * 60 * 60 * 1000 // 默认拉取最近 24 小时

    this.logger.log(
      `Fetching user fills for ${cursor.userAddress} from ${new Date(startTime).toISOString()} to ${new Date(now).toISOString()}`,
    )

    // 调用 Hyperliquid API
    const fills = await this.hyperliquidApi.getUserFillsByTime<HyperliquidFill[]>(
      cursor.userAddress,
      startTime,
      now,
      false, // skipCache
    )

    if (!fills || fills.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify({ ...cursor, lastSyncTime: now }),
        meta: {
          note: 'No fills data returned from Hyperliquid API',
          userAddress: cursor.userAddress,
        },
      }
    }

    const client = this.prisma.getClient()

    // 转换数据并写入数据库
    const rows = fills.map(fill => ({
      userAddress: cursor.userAddress,
      coin: fill.coin,
      price: fill.px,
      size: fill.sz,
      side: fill.side,
      time: new Date(fill.time),
      startPosition: fill.startPosition,
      direction: fill.dir,
      closedPnl: fill.closedPnl,
      hash: fill.hash,
      orderId: BigInt(fill.oid),
      tradeId: BigInt(fill.tid),
      crossed: fill.crossed,
      fee: fill.fee,
      liquidation: fill.liquidation,
      source: 'HYPERLIQUID',
    }))

    const result = await client.hyperliquidUserFill.createMany({
      data: rows,
      skipDuplicates: true, // 幂等性：基于唯一约束 (userAddress, coin, time, tradeId)
    })

    const insertedCount = result.count

    // 更新 cursor
    const newCursor: UserFillsCursor = {
      userAddress: cursor.userAddress,
      lastSyncTime: now,
    }

    // 统计
    const buyFills = fills.filter(f => f.side === 'A').length
    const sellFills = fills.filter(f => f.side === 'B').length
    const liquidations = fills.filter(f => f.liquidation).length

    return {
      fetchedCount: insertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        userAddress: cursor.userAddress,
        apiDataCount: fills.length,
        insertedCount,
        timeRange: {
          from: new Date(startTime).toISOString(),
          to: new Date(now).toISOString(),
        },
        stats: {
          buyFills,
          sellFills,
          liquidations,
        },
      },
    }
  }

  private parseCursor(currentCursor: string | null): UserFillsCursor {
    if (!currentCursor) {
      return {
        userAddress: '',
        lastSyncTime: 0,
      }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<UserFillsCursor>
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
