import type { HyperliquidWhaleAlert } from '@prisma/client'
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
  WhaleAssetPerformanceDto,
  WhaleTradeHistoryItemDto,
  WhaleTraderSummaryPerformanceDto,
} from './dto/whale-address-performance.dto'
import type {
  ClearinghouseStateResponse,
  HyperliquidAssetPosition,
  HyperliquidOpenOrder,
  HyperliquidSpotBalance,
} from './services/hyperliquid-api.service'
import { safeParseFloat } from '@ai/shared'
import { Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'
// eslint-disable-next-line ts/consistent-type-imports
import { HyperliquidApiService } from './services'

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
    private readonly prisma: PrismaService,
    private readonly hyperliquidApi: HyperliquidApiService,
  ) {}

  async getDiscoverWhales(): Promise<WhaleDiscoverResponseDto> {
    const client = this.prisma.getClient()

    const since = new Date(Date.now() - this.lookbackDays * 24 * 60 * 60 * 1000)

    // E2E 环境中可能会有后台任务写入真实数据，discover 返回需保持可预期。
    // 约定：E2E 测试数据写入 source='TEST'。
    const isE2e = process.env.APP_ENV === 'e2e'

    const baseWhere = {
      createTime: {
        gte: since,
      },
      ...(isE2e ? { source: 'TEST' as const } : {}),
    }

    // 1. 先按 address 聚合出近 lookbackDays 内总持仓价值最高的一批鲸鱼
    const grouped = await client.hyperliquidWhaleAlert.groupBy({
      by: ['userAddress'],
      where: {
        ...baseWhere,
      },
      _sum: {
        positionValueUsd: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _sum: {
          positionValueUsd: 'desc',
        },
      },
      take: this.maxWhales,
    })

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
    const alerts: HyperliquidWhaleAlert[] = await client.hyperliquidWhaleAlert.findMany({
      where: {
        ...baseWhere,
        userAddress: {
          in: addresses,
        },
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
        address: '0x8ba1f109551bd432803012645ac136ddd64dba72',
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
    const client = this.prisma.getClient()

    const lookbackDays = typeof query.timeRangeDays === 'number' ? query.timeRangeDays : 30
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)

    const where = {
      userAddress: address,
      createTime: {
        gte: since,
      },
      ...(query.symbol ? { symbol: query.symbol } : {}),
    }

    // 1）使用数据库端聚合计算 summary 级统计信息，避免在 Node 层对大量记录做手工聚合
    const summaryAgg = await client.hyperliquidWhaleAlert.groupBy({
      by: ['userAddress'],
      where,
      _sum: {
        positionValueUsd: true,
      },
      _count: {
        _all: true,
      },
    })

    let totalValueUsd = 0
    let tradesCount = 0

    if (summaryAgg.length > 0) {
      const agg = summaryAgg[0]
      const sumVal = agg._sum.positionValueUsd ?? 0
      totalValueUsd = Number(sumVal)
      tradesCount = agg._count._all ?? 0
    }

    // 2）按 symbol 维度在数据库端聚合，以获取 byAsset 统计
    const byAssetAgg = await client.hyperliquidWhaleAlert.groupBy({
      by: ['symbol'],
      where,
      _sum: {
        positionValueUsd: true,
      },
      _count: {
        _all: true,
      },
    })

    // 批量查询 long 和 short 方向的计数，避免 N+1 查询问题
    const [longAgg, shortAgg] = await Promise.all([
      // 查询所有 long 持仓（positionSize > 0）按 symbol 分组的计数
      client.hyperliquidWhaleAlert.groupBy({
        by: ['symbol'],
        where: {
          ...where,
          positionSize: {
            gt: 0,
          },
        },
        _count: {
          _all: true,
        },
      }),
      // 查询所有 short 持仓（positionSize < 0）按 symbol 分组的计数
      client.hyperliquidWhaleAlert.groupBy({
        by: ['symbol'],
        where: {
          ...where,
          positionSize: {
            lt: 0,
          },
        },
        _count: {
          _all: true,
        },
      }),
    ])

    // 构建 Map 方便快速查找每个 symbol 的 long/short 计数
    const longCountMap = new Map<string, number>()
    const shortCountMap = new Map<string, number>()

    for (const item of longAgg) {
      longCountMap.set(item.symbol, item._count._all)
    }

    for (const item of shortAgg) {
      shortCountMap.set(item.symbol, item._count._all)
    }

    // 组装结果，从 Map 中读取预先计算好的 long/short 计数
    const byAssetWithDirection = byAssetAgg.map((agg: (typeof byAssetAgg)[number]) => {
      const symbol = agg.symbol
      const symbolLong = longCountMap.get(symbol) ?? 0
      const symbolShort = shortCountMap.get(symbol) ?? 0

      return {
        agg,
        symbol,
        symbolLong,
        symbolShort,
      }
    })

    let longCount = 0
    let shortCount = 0

    const byAsset: WhaleAssetPerformanceDto[] = byAssetWithDirection.map(
      (item: (typeof byAssetWithDirection)[number]) => {
        const sumVal = item.agg._sum.positionValueUsd ?? 0
        const totalVal = Number(sumVal)
        const trades = item.agg._count._all ?? 0

        longCount += item.symbolLong
        shortCount += item.symbolShort

        return {
          symbol: item.symbol,
          totalValueUsd: Number(totalVal.toFixed(2)),
          trades,
          longCount: item.symbolLong,
          shortCount: item.symbolShort,
        }
      },
    )

    byAsset.sort((a, b) => b.totalValueUsd - a.totalValueUsd)

    const positionsCount = byAsset.length

    const totalDirectional = longCount + shortCount
    const winRatePct =
      totalDirectional > 0 ? Number(((longCount / totalDirectional) * 100).toFixed(2)) : 50

    const pnlScale = 0.08
    const directionFactor = totalDirectional > 0 ? (longCount >= shortCount ? 1 : -1) : 1
    const rawPnl = totalValueUsd * pnlScale * directionFactor
    const pnlUsd = Number(rawPnl.toFixed(2))

    const summary: WhaleTraderSummaryPerformanceDto = {
      address,
      lookbackDays,
      symbolFilter: query.symbol,
      trades: tradesCount,
      positions: positionsCount,
      totalValueUsd: Number(totalValueUsd.toFixed(2)),
      longCount,
      shortCount,
      winRatePct,
      pnlUsd,
    }

    const limit =
      typeof query.limit === 'number' && query.limit > 0 ? Math.min(query.limit, 500) : 200

    // 3）针对交易明细，仅拉取有限条数到 Node 层，避免一次性加载过多记录
    const tradesSource: HyperliquidWhaleAlert[] = await client.hyperliquidWhaleAlert.findMany({
      where,
      orderBy: {
        createTime: 'desc',
      },
      take: limit,
    })

    const trades: WhaleTradeHistoryItemDto[] = tradesSource.map(a => {
      const positionSize = Number(a.positionSize ?? 0)
      const side: 'LONG' | 'SHORT' = positionSize >= 0 ? 'LONG' : 'SHORT'

      return {
        address: a.userAddress,
        symbol: a.symbol,
        side,
        positionSize,
        positionValueUsd: Number(a.positionValueUsd ?? 0),
        entryPrice: Number(a.entryPrice ?? 0),
        liquidationPrice: Number(a.liquidationPrice ?? 0),
        positionAction: a.positionAction,
        createTime: a.createTime.toISOString(),
      }
    })

    return {
      summary,
      byAsset,
      trades,
    }
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
    const skipCache = query.skipCache ?? false

    // 并行请求永续和现货账户状态
    const [perpState, spotState] = await Promise.all([
      this.hyperliquidApi.getClearinghouseState(address, skipCache),
      this.hyperliquidApi.getSpotClearinghouseState(address, skipCache),
    ])

    // 解析永续合约账户数据
    const perpSummary =
      perpState.marginSummary || ({} as ClearinghouseStateResponse['marginSummary'])
    const accountValue = safeParseFloat(perpSummary.accountValue)
    const totalMarginUsed = safeParseFloat(perpSummary.totalMarginUsed)
    const totalPositionValue = safeParseFloat(perpSummary.totalNtlPos)
    const withdrawable = safeParseFloat(perpState.withdrawable)

    // 计算保证金使用率和杠杆倍数
    const marginUsagePercent = accountValue > 0 ? (totalMarginUsed / accountValue) * 100 : 0
    const leverageRatio = totalMarginUsed > 0 ? totalPositionValue / totalMarginUsed : 0

    // 计算未实现盈亏和 ROI
    let unrealizedPnl = 0
    const assetPositions: HyperliquidAssetPosition[] = perpState.assetPositions || []
    for (const ap of assetPositions) {
      unrealizedPnl += safeParseFloat(ap.position?.unrealizedPnl)
    }
    const roi = totalMarginUsed > 0 ? (unrealizedPnl / totalMarginUsed) * 100 : 0

    // 解析现货账户数据
    const spotBalances: HyperliquidSpotBalance[] = spotState.balances || []
    let spotTotalValue = 0

    // TODO(PERF-002): 现货价值计算硬编码为 0，需要实现 getMetaInfo() 获取币种价格
    // 实现方案：
    // 1. HyperliquidApiService.getMetaInfo() 获取所有币种的中间价
    // 2. 根据 balance.coin 查询对应价格
    // 3. value = total * price
    // 4. 添加价格缓存（TTL 5秒）避免频繁请求
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
      const value = 0 // TODO(PERF-002): 等待价格 API 实现
      spotTotalValue += value

      balances.push({
        coin: balance.coin,
        total,
        hold,
        value,
        sharePercent: 0, // 稍后计算
      })
    }

    // 计算现货余额占比
    for (const balance of balances) {
      balance.sharePercent = spotTotalValue > 0 ? (balance.value / spotTotalValue) * 100 : 0
    }

    // 计算汇总数据
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
    const skipCache = query.skipCache ?? false
    const type = query.type ?? 'all'

    // 根据类型筛选决定请求哪些接口
    const needPerp = type === 'all' || type === 'perp'
    const needSpot = type === 'all' || type === 'spot'

    const [perpState, spotState] = await Promise.all([
      needPerp ? this.hyperliquidApi.getClearinghouseState(address, skipCache) : null,
      needSpot ? this.hyperliquidApi.getSpotClearinghouseState(address, skipCache) : null,
    ])

    // 定义永续持仓内部类型
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

    // 解析永续合约持仓
    const perpPositions: PerpPositionItem[] = []
    if (perpState) {
      const assetPositions: HyperliquidAssetPosition[] = perpState.assetPositions || []
      for (const ap of assetPositions) {
        const position = ap.position
        if (!position) continue

        const szi = safeParseFloat(position.szi)
        const side: 'LONG' | 'SHORT' = szi > 0 ? 'LONG' : 'SHORT'

        // entryPx 解析
        const entryPrice = safeParseFloat(position.entryPx)

        // 标记价格获取（技术债务）：
        // 需要调用 Hyperliquid API 的 meta 端点获取实时标记价格
        // 实现方案：
        // 1. HyperliquidApiService.getMetaInfo() 获取所有币种的标记价格
        // 2. 根据 position.coin 查询对应的 markPx
        // 3. 添加价格缓存（TTL 5秒）避免频繁请求
        // 临时方案：使用 positionValue 和 szi 反推近似价格
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

    // 定义现货余额内部类型
    interface SpotBalanceItem {
      coin: string
      total: number
      hold: number
      available: number
      value: number
    }

    // 解析现货余额
    const spotBalancesResult: SpotBalanceItem[] = []
    if (spotState) {
      const balances: HyperliquidSpotBalance[] = spotState.balances || []

      // TODO(PERF-002): 现货价值计算硬编码为 0，需要实现 getMetaInfo() 获取币种价格
      if (balances.length > 0) {
        this.logger.warn(
          `[PERF-002] 持仓详情现货价值计算暂未实现 (address=${address}, balances=${balances.length}), 返回值为 0`,
        )
      }

      for (const balance of balances) {
        const total = safeParseFloat(balance.total)
        if (total === 0) continue // 跳过零余额

        const hold = safeParseFloat(balance.hold)
        const available = total - hold
        const value = 0 // TODO(PERF-002): 等待价格 API 实现

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
    const skipCache = query.skipCache ?? false
    const coinFilter = query.coin

    // 调用 Hyperliquid API 获取挂单
    const openOrders: HyperliquidOpenOrder[] = await this.hyperliquidApi.getOpenOrders(
      address,
      skipCache,
    )

    // 过滤和转换数据
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

  async getTraderDiscoverTags(address: string): Promise<{
    tag: string | null
    aiTags: WhaleDiscoverTraderAiTagDto[]
  }> {
    const client = this.prisma.getClient()

    const since = new Date(Date.now() - this.lookbackDays * 24 * 60 * 60 * 1000)
    const isE2e = process.env.APP_ENV === 'e2e'

    const where = {
      userAddress: address,
      createTime: {
        gte: since,
      },
      ...(isE2e ? { source: 'TEST' as const } : {}),
    }

    const alerts: HyperliquidWhaleAlert[] = await client.hyperliquidWhaleAlert.findMany({
      where,
    })

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
