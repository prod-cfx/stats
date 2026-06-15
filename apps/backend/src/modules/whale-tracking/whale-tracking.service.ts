import type {
  WhaleDiscoverResponseDto,
  WhaleDiscoverTraderAiTagDto,
  WhaleDiscoverTraderDto,
} from './dto/responses/whale-discover.response.dto'
import type {
  QueryTraderOpenOrdersDto,
  TraderOpenOrdersResponseDto,
} from './dto/trader-open-orders.dto'
import type {
  QueryTraderPositionsDto,
  TraderPositionsResponseDto,
} from './dto/trader-positions.dto'
import type { QueryTraderSnapshotDto, TraderSnapshotResponseDto } from './dto/trader-snapshot.dto'
import type {
  QueryWhaleAddressPerformanceDto,
  WhaleAddressPerformanceResponseDto,
} from './dto/whale-address-performance.dto'
import type { HyperliquidWhaleAlert } from '@/prisma/prisma.types'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { EnvService } from '@/common/services/env.service'
// eslint-disable-next-line ts/consistent-type-imports
import { WhalePerformanceService, WhaleSnapshotService } from './services'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { WhaleTrackingRepository } from './whale-tracking.repository'

interface AggregatedWhaleStats {
  address: string
  totalValueUsd: number
  trades: number
  positions: number
  longCount: number
  shortCount: number
}

@Injectable()
export class WhaleTrackingService {
  private readonly logger = new Logger(WhaleTrackingService.name)
  private readonly lookbackDays = 7
  private readonly maxWhales = 24

  // 固定一组颜色，按索引循环分配，保证前后端视觉一致性
  private readonly avatarColors: readonly string[] = [
    '#3b82f6',
    '#a855f7',
    '#14b8a6',
    '#f97316',
    '#22c55e',
    '#06b6d4',
    '#8b5cf6',
    '#ef4444',
    '#84cc16',
    '#eab308',
  ]

  constructor(
    private readonly whaleTrackingRepository: WhaleTrackingRepository,
    private readonly envService: EnvService,
    private readonly whalePerformanceService: WhalePerformanceService,
    private readonly whaleSnapshotService: WhaleSnapshotService,
  ) {}

  async getDiscoverWhales(): Promise<WhaleDiscoverResponseDto> {
    const since = new Date(Date.now() - this.lookbackDays * 24 * 60 * 60 * 1000)

    // E2E 环境中可能会有后台任务写入真实数据，discover 返回需保持可预期。
    // 约定：E2E 测试数据写入 source='TEST'。
    const isE2e = this.envService.getString('APP_ENV') === 'e2e'

    const baseWhere = {
      createTime: {
        gte: since,
      },
      ...(isE2e ? { source: 'TEST' as const } : {}),
    }

    // 1. 先按 address 聚合出近 lookbackDays 内总持仓价值最高的一批鲸鱼
    const grouped = await this.whaleTrackingRepository.groupWhaleAlertsByAddress(
      baseWhere,
      this.maxWhales,
    )

    if (!grouped.length) {
      // E2E 要求确定性：无数据就返回空
      if (isE2e) {
        return {
          recommended: [],
          details: [],
        }
      }
      // 本地/新环境下数据库可能尚未同步 whale alert 数据：
      // 按需求：有后端数据则返回真实数据；无数据则返回 mock，保证前端可正常渲染。
      this.logger.warn(
        '[WhaleTracking] No HyperliquidWhaleAlert data found in DB, returning mock discover whales',
      )
      return this.buildMockDiscoverWhales()
    }

    const addresses = grouped.map((g: (typeof grouped)[number]) => g.userAddress)

    // 2. 拉取这些 address 在时间窗口内的所有预警，用于计算更丰富的统计（positions / 多空分布等）
    const alerts: HyperliquidWhaleAlert[] = await this.whaleTrackingRepository.findManyAlerts({
      ...baseWhere,
      userAddress: {
        in: addresses,
      },
    })

    const perUserStats = new Map<string, AggregatedWhaleStats>()
    const perUserSymbols = new Map<string, Set<string>>()

    for (const alert of alerts) {
      const addr = alert.userAddress
      const positionValue = Number(alert.positionValueUsd ?? 0)

      let stats = perUserStats.get(addr)
      if (!stats) {
        stats = {
          address: addr,
          totalValueUsd: 0,
          trades: 0,
          positions: 0,
          longCount: 0,
          shortCount: 0,
        }
        perUserStats.set(addr, stats)
      }

      stats.totalValueUsd += Number.isFinite(positionValue) ? positionValue : 0
      stats.trades += 1

      const symbols =
        perUserSymbols.get(addr) ??
        ((): Set<string> => {
          const set = new Set<string>()
          perUserSymbols.set(addr, set)
          return set
        })()
      symbols.add(alert.symbol)

      const positionSize = Number(alert.positionSize ?? 0)
      if (positionSize > 0) {
        stats.longCount += 1
      } else if (positionSize < 0) {
        stats.shortCount += 1
      }
    }

    // 将 groupBy 的结果和明细统计合并，确保排序依据为总持仓价值
    const merged: AggregatedWhaleStats[] = grouped.map((g: (typeof grouped)[number]) => {
      const fromStats = perUserStats.get(g.userAddress)
      const totalValueFromGroup = Number(g._sum.positionValueUsd ?? 0)
      const baseTotal =
        Number.isFinite(totalValueFromGroup) && totalValueFromGroup > 0
          ? totalValueFromGroup
          : (fromStats?.totalValueUsd ?? 0)

      const symbols = perUserSymbols.get(g.userAddress)
      const positions = symbols ? symbols.size : (fromStats?.positions ?? 0)

      return {
        address: g.userAddress,
        totalValueUsd: baseTotal,
        trades: fromStats?.trades ?? g._count._all ?? 0,
        positions,
        longCount: fromStats?.longCount ?? 0,
        shortCount: fromStats?.shortCount ?? 0,
      }
    })

    // 重新按 totalValueUsd 降序排序，防御性保证顺序
    merged.sort((a, b) => b.totalValueUsd - a.totalValueUsd)

    const traders: WhaleDiscoverTraderDto[] = merged.map((stats, index) =>
      this.toTraderDto(stats, index),
    )

    const recommended = traders.slice(0, 3).map(t => ({
      ...t,
      variant: 'recommended' as const,
    }))

    const details = traders.map(t => ({
      ...t,
      variant: 'detail' as const,
    }))

    return {
      recommended,
      details,
    }
  }

  private buildMockDiscoverWhales(): WhaleDiscoverResponseDto {
    const mockStats: AggregatedWhaleStats[] = [
      {
        address: '0x020ca66c30bec2c4fe3861a94e4db4a498a35872',
        totalValueUsd: 128_500_000,
        trades: 42,
        positions: 9,
        longCount: 31,
        shortCount: 11,
      },
      {
        address: '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        totalValueUsd: 86_750_000,
        trades: 28,
        positions: 7,
        longCount: 18,
        shortCount: 10,
      },
      {
        address: '0x66f820a414680b5bcda5eeca5dea238543f42054',
        totalValueUsd: 54_200_000,
        trades: 19,
        positions: 6,
        longCount: 9,
        shortCount: 10,
      },
      {
        address: '0x281055afc982d96fab65b3a49cac8b878184cb16',
        totalValueUsd: 32_400_000,
        trades: 15,
        positions: 5,
        longCount: 11,
        shortCount: 4,
      },
      {
        address: '0x53d284357ec70ce289d6d64134dfac8e511c8a3d',
        totalValueUsd: 21_050_000,
        trades: 12,
        positions: 5,
        longCount: 7,
        shortCount: 5,
      },
      {
        address: '0xfe9e8709d3215310075d67e3ed32a380ccf451c8',
        totalValueUsd: 15_800_000,
        trades: 10,
        positions: 4,
        longCount: 6,
        shortCount: 4,
      },
      {
        address: '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8',
        totalValueUsd: 11_250_000,
        trades: 9,
        positions: 4,
        longCount: 5,
        shortCount: 4,
      },
      {
        address: '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0',
        totalValueUsd: 8_900_000,
        trades: 8,
        positions: 3,
        longCount: 3,
        shortCount: 5,
      },
      {
        address: '0x1151314c646ce4e0efd76d1af4760ae66a9fe30f',
        totalValueUsd: 6_750_000,
        trades: 7,
        positions: 3,
        longCount: 4,
        shortCount: 3,
      },
      {
        address: '0xd551234ae421e3bcba99a0da6d736074f22192ff',
        totalValueUsd: 4_250_000,
        trades: 6,
        positions: 2,
        longCount: 4,
        shortCount: 2,
      },
    ]

    const traders: WhaleDiscoverTraderDto[] = mockStats.map((stats, index) =>
      this.toTraderDto(stats, index),
    )

    const recommended = traders.slice(0, 3).map(t => ({
      ...t,
      variant: 'recommended' as const,
    }))

    const details = traders.map(t => ({
      ...t,
      variant: 'detail' as const,
    }))

    return { recommended, details }
  }

  async getTraderPerformance(
    address: string,
    query: QueryWhaleAddressPerformanceDto,
  ): Promise<WhaleAddressPerformanceResponseDto> {
    return this.whalePerformanceService.getTraderPerformance(address, query)
  }

  private toTraderDto(stats: AggregatedWhaleStats, index: number): WhaleDiscoverTraderDto {
    const avatarColor = this.avatarColors[index % this.avatarColors.length]

    const trades = stats.trades || 0
    const long = stats.longCount || 0
    const short = stats.shortCount || 0
    const totalDirectional = long + short

    // 简单占位胜率：按多单占比计算，避免始终 50%
    const winRatePct =
      totalDirectional > 0 ? Number(((long / totalDirectional) * 100).toFixed(2)) : 50

    // PnL 暂时使用名义价值的一小部分作为占位，以便前端排序/展示不会全部为 0
    const pnlScale = 0.08
    const directionFactor = totalDirectional > 0 ? (long >= short ? 1 : -1) : 1
    const rawPnl = stats.totalValueUsd * pnlScale * directionFactor

    // 为避免数字过大，截断到 2 位小数
    const pnlUsd = Number(rawPnl.toFixed(2))

    const aiTags: WhaleDiscoverTraderAiTagDto[] = this.buildAiTags(stats)

    const tag = this.buildTag(stats)

    return {
      variant: 'detail',
      address: stats.address,
      handle: null,
      tag,
      totalValueUsd: Number(stats.totalValueUsd.toFixed(2)),
      pnlUsd,
      pnlLabelKey: 'realizedPnl1m',
      trades,
      positions: stats.positions,
      winRatePct,
      winRateLabelKey: 'winRate1m',
      avatarColor,
      aiTags,
    }
  }

  private buildTag(stats: AggregatedWhaleStats): string | null {
    if (stats.totalValueUsd <= 0) return null
    const millions = stats.totalValueUsd / 1_000_000
    if (millions >= 10_000) {
      return '$10B+ HYPERUNIT WHALE'
    }
    if (millions >= 1_000) {
      return '$1B+ HYPERUNIT WHALE'
    }
    if (millions >= 100) {
      return '$100M+ HYPERUNIT WHALE'
    }
    if (millions >= 10) {
      return '$10M+ HYPERUNIT WHALE'
    }
    return null
  }

  private buildAiTags(stats: AggregatedWhaleStats): WhaleDiscoverTraderAiTagDto[] {
    const tags: WhaleDiscoverTraderAiTagDto[] = []

    const total = stats.trades || 0
    const long = stats.longCount || 0
    const short = stats.shortCount || 0

    if (stats.totalValueUsd > 20_000_000) {
      tags.push({
        key: 'treasuryKeeper',
        color: '#fde047',
        bgColor: '#713f1233',
        descriptionKey: 'treasuryKeeper',
      })
    }

    if (total > 0) {
      const longRatio = long / total
      const shortRatio = short / total

      if (longRatio >= 0.6) {
        tags.push({
          key: 'bullWarGod',
          color: '#93c5fd',
          bgColor: '#1e3a8a33',
          descriptionKey: 'bullWarGod',
        })
      }

      if (shortRatio >= 0.5) {
        tags.push({
          key: 'smartTrader',
          color: '#fde047',
          bgColor: '#713f1233',
          descriptionKey: 'smartTrader',
        })
      }
    }

    if (total >= 10 && stats.positions >= 5) {
      tags.push({
        key: 'swingKing',
        color: '#d8b4fe',
        bgColor: '#581c8733',
        descriptionKey: 'swingKing',
      })
    }

    // 保证不会返回过长的标签列表
    return tags.slice(0, 3)
  }

  /**
   * 获取鲸鱼交易者账户快照
   *
   * @param address - 用户地址
   * @param query - 查询参数
   * @returns 账户快照数据（永续 + 现货 + 汇总）
   */
  async getTraderSnapshot(
    address: string,
    query: QueryTraderSnapshotDto,
  ): Promise<TraderSnapshotResponseDto> {
    return this.whaleSnapshotService.getTraderSnapshot(address, query)
  }

  /**
   * 获取鲸鱼交易者持仓详情
   *
   * @param address - 用户地址
   * @param query - 查询参数
   * @returns 持仓详情数据（永续 + 现货）
   */
  async getTraderPositions(
    address: string,
    query: QueryTraderPositionsDto,
  ): Promise<TraderPositionsResponseDto> {
    return this.whaleSnapshotService.getTraderPositions(address, query)
  }

  /**
   * 获取鲸鱼交易者挂单列表
   *
   * @param address - 用户地址
   * @param query - 查询参数
   * @returns 挂单列表数据
   */
  async getTraderOpenOrders(
    address: string,
    query: QueryTraderOpenOrdersDto,
  ): Promise<TraderOpenOrdersResponseDto> {
    return this.whaleSnapshotService.getTraderOpenOrders(address, query)
  }

  async getTraderDiscoverTags(address: string): Promise<{
    tag: string | null
    aiTags: WhaleDiscoverTraderAiTagDto[]
  }> {
    const since = new Date(Date.now() - this.lookbackDays * 24 * 60 * 60 * 1000)
    const isE2e = this.envService.getString('APP_ENV') === 'e2e'

    const where = {
      userAddress: address,
      createTime: {
        gte: since,
      },
      ...(isE2e ? { source: 'TEST' as const } : {}),
    }

    const alerts: HyperliquidWhaleAlert[] = await this.whaleTrackingRepository.findManyAlerts(where)

    if (!alerts.length) {
      return {
        tag: null,
        aiTags: [],
      }
    }

    const symbols = new Set<string>()

    const stats: AggregatedWhaleStats = {
      address,
      totalValueUsd: 0,
      trades: 0,
      positions: 0,
      longCount: 0,
      shortCount: 0,
    }

    for (const alert of alerts) {
      const positionValue = Number(alert.positionValueUsd ?? 0)
      stats.totalValueUsd += Number.isFinite(positionValue) ? positionValue : 0
      stats.trades += 1

      symbols.add(alert.symbol)

      const positionSize = Number(alert.positionSize ?? 0)
      if (positionSize > 0) {
        stats.longCount += 1
      } else if (positionSize < 0) {
        stats.shortCount += 1
      }
    }

    stats.positions = symbols.size

    return {
      tag: this.buildTag(stats),
      aiTags: this.buildAiTags(stats),
    }
  }
}
