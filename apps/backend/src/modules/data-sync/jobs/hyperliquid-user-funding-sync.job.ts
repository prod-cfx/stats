import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports
import { HyperliquidApiService } from '@/modules/whale-tracking/services/hyperliquid-api.service'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

interface UserFundingCursor {
  /**
   * 鲸鱼地址（必填）
   */
  userAddress: string
  /**
   * 最后同步时间戳（毫秒）
   */
  lastSyncTime: number
}

interface HyperliquidFunding {
  coin: string
  fundingRate: string
  szi: string // 持仓大小（signed size）
  usdc: string // 支付或收到的 USDC 金额
  time: number // timestamp in milliseconds
}

@Injectable()
export class HyperliquidUserFundingSyncJob implements DataPullJob {
  readonly key = 'hyperliquid-user-funding-sync'
  private readonly logger = new Logger(HyperliquidUserFundingSyncJob.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly hyperliquidApi: HyperliquidApiService,
  ) {}

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    if (!cursor.userAddress) {
      throw new DomainException('data_sync.user_funding_sync.config_missing', {
        code: ErrorCode.DATA_SYNC_CONFIG_MISSING,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'userAddress is required in cursor' },
      })
    }

    // 计算查询时间范围：从 lastSyncTime 到现在
    const now = Date.now()
    // 资金费率每 8 小时结算，默认拉取最近 7 天的数据
    const startTime = cursor.lastSyncTime || now - 7 * 24 * 60 * 60 * 1000

    this.logger.log(
      `Fetching user funding for ${cursor.userAddress} from ${new Date(startTime).toISOString()} to ${new Date(now).toISOString()}`,
    )

    // 调用 Hyperliquid API
    const funding = await this.hyperliquidApi.getUserFunding<HyperliquidFunding[]>(
      cursor.userAddress,
      startTime,
      now,
      false, // skipCache
    )

    if (!funding || funding.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify({ ...cursor, lastSyncTime: now }),
        meta: {
          note: 'No funding data returned from Hyperliquid API',
          userAddress: cursor.userAddress,
        },
      }
    }

    const client = this.prisma.getClient()

    // 转换数据并写入数据库
    const rows = funding.map(item => ({
      userAddress: cursor.userAddress,
      coin: item.coin,
      fundingRate: item.fundingRate,
      szi: item.szi,
      usdc: item.usdc,
      time: new Date(item.time),
      source: 'HYPERLIQUID',
    }))

    const result = await client.hyperliquidUserFunding.createMany({
      data: rows,
      skipDuplicates: true, // 幂等性：基于唯一约束 (userAddress, coin, time)
    })

    const insertedCount = result.count

    // 更新 cursor
    const newCursor: UserFundingCursor = {
      userAddress: cursor.userAddress,
      lastSyncTime: now,
    }

    // 统计
    const totalFundingPaid = funding.reduce((sum, item) => {
      const usdc = Number.parseFloat(item.usdc)
      return sum + (usdc < 0 ? Math.abs(usdc) : 0)
    }, 0)

    const totalFundingReceived = funding.reduce((sum, item) => {
      const usdc = Number.parseFloat(item.usdc)
      return sum + (usdc > 0 ? usdc : 0)
    }, 0)

    const uniqueCoins = new Set(funding.map(item => item.coin)).size

    return {
      fetchedCount: insertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        userAddress: cursor.userAddress,
        apiDataCount: funding.length,
        insertedCount,
        timeRange: {
          from: new Date(startTime).toISOString(),
          to: new Date(now).toISOString(),
        },
        stats: {
          totalFundingPaid: totalFundingPaid.toFixed(2),
          totalFundingReceived: totalFundingReceived.toFixed(2),
          netFunding: (totalFundingReceived - totalFundingPaid).toFixed(2),
          uniqueCoins,
        },
      },
    }
  }

  private parseCursor(currentCursor: string | null): UserFundingCursor {
    if (!currentCursor) {
      return {
        userAddress: '',
        lastSyncTime: 0,
      }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<UserFundingCursor>
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
