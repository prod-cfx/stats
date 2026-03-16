/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器和依赖注入需要运行时导入 */
import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

import { Prisma } from '@/prisma/prisma.types'

import { StrategyInstanceStatsDto } from '../dto/strategy-instance-stats.dto'

// Prisma 7: 从 Prisma namespace 导出类型和值
/* eslint-disable no-redeclare, ts/no-redeclare */
type Decimal = Prisma.Decimal
const Decimal = Prisma.Decimal

type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
/* eslint-enable no-redeclare, ts/no-redeclare */

// 常量定义
const DECIMAL_PLACES = 2
const MAX_BATCH_SIZE = 100
const CUID_REGEX = /^c[a-z0-9]{24}$/i

interface PositionStats {
  openCount: number
  closedCount: number
}

interface TradeStats {
  totalCount: number
  winCount: number
  lossCount: number
}

interface AccountStats {
  totalInitialBalance: Decimal
  totalEquity: Decimal
  totalPnl: Decimal
  totalRealizedPnl: Decimal
  totalUnrealizedPnl: Decimal
}

@Injectable()
export class StrategyInstanceStatsService {
  private readonly logger = new Logger(StrategyInstanceStatsService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 计算策略实例的统计数据
   *
   * 注意：当前实现基于 UserStrategyAccount 表，该表与策略实例间接关联
   * 通过 strategyId 字段关联到策略模板，再通过策略模板关联到策略实例
   *
   * 未来如果需要更精确的统计，建议在数据库 schema 中添加直接关联
   *
   * @param strategyInstanceId 策略实例 ID
   * @param timezone 时区 (默认 UTC)
   * @returns 统计数据或 null
   * @throws InternalServerErrorException 计算失败时抛出
   */
  async calculateStats(
    strategyInstanceId: string,
    timezone: string = 'UTC'
  ): Promise<StrategyInstanceStatsDto | null> {
    // 输入验证
    if (!strategyInstanceId || !this.isValidCuid(strategyInstanceId)) {
      throw new BadRequestException('Invalid strategy instance ID format')
    }

    try {
      const client = this.prisma.getClient()

      // 获取策略实例信息
      const instance = await client.strategyInstance.findUnique({
        where: { id: strategyInstanceId },
        include: {
          strategyTemplate: {
            select: { id: true }
          }
        }
      })

      if (!instance) {
        this.logger.debug(`Strategy instance not found: ${strategyInstanceId}`)
        return null
      }

      // 通过订阅关系获取关联的账户（更精确的关联）
      const subscriptions = await client.userStrategySubscription.findMany({
        where: {
          strategyInstanceId,
          status: 'active'
        },
        select: {
          userId: true
        }
      })

      if (subscriptions.length === 0) {
        // 没有活跃订阅，返回空统计
        this.logger.debug(`No active subscriptions for instance: ${strategyInstanceId}`)
        return this.createEmptyStats()
      }

      const userIds = subscriptions.map(s => s.userId)

      // 查询订阅用户的策略账户
      const accounts = await client.userStrategyAccount.findMany({
        where: {
          userId: { in: userIds },
          strategyId: instance.strategyTemplateId
        },
        select: {
          id: true,
          initialBalance: true,
          balance: true,
          equity: true,
          totalRealizedPnl: true,
          totalUnrealizedPnl: true
        }
      })

      if (accounts.length === 0) {
        return this.createEmptyStats()
      }

      const accountIds = accounts.map(a => a.id)

      // 并行查询所有统计数据
      const [accountStats, positionStats, tradeStats, todayStats] = await Promise.all([
        Promise.resolve(this.aggregateAccountStats(accounts)),
        this.getPositionStats(accountIds),
        this.getTradeStats(accountIds),
        this.getTodayStats(accountIds, timezone)
      ])

      // 计算汇总统计
      return this.buildStatsDto(
        accountStats,
        positionStats,
        tradeStats,
        todayStats
      )
    } catch (error) {
      this.logger.error(
        `Failed to calculate stats for instance ${strategyInstanceId}`,
        error.stack
      )

      if (error instanceof PrismaClientKnownRequestError) {
        throw new InternalServerErrorException(
          'Database error while calculating statistics'
        )
      }

      if (error instanceof BadRequestException) {
        throw error
      }

      throw new InternalServerErrorException(
        'Failed to calculate statistics',
        error.message
      )
    }
  }

  /**
   * 批量计算多个策略实例的统计数据
   *
   * 优化版本：使用批量查询减少数据库往返次数
   *
   * @param strategyInstanceIds 策略实例 ID 数组
   * @param timezone 时区 (默认 UTC)
   * @returns 实例 ID 到统计数据的映射
   */
  async calculateBatchStats(
    strategyInstanceIds: string[],
    timezone: string = 'UTC'
  ): Promise<Map<string, StrategyInstanceStatsDto | null>> {
    // 输入验证
    if (!Array.isArray(strategyInstanceIds)) {
      throw new BadRequestException('strategyInstanceIds must be an array')
    }

    if (strategyInstanceIds.length === 0) {
      return new Map()
    }

    // 防止 DOS 攻击
    if (strategyInstanceIds.length > MAX_BATCH_SIZE) {
      throw new BadRequestException(
        `Batch size exceeds maximum of ${MAX_BATCH_SIZE}`
      )
    }

    // 验证所有实例 ID 格式
    const invalidIds = strategyInstanceIds.filter(id => !this.isValidCuid(id))
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Invalid instance IDs: ${invalidIds.slice(0, 5).join(', ')}${invalidIds.length > 5 ? '...' : ''}`
      )
    }

    try {
      const client = this.prisma.getClient()

      // 1. 批量查询所有策略实例
      const instances = await client.strategyInstance.findMany({
        where: { id: { in: strategyInstanceIds } },
        include: {
          strategyTemplate: {
            select: { id: true }
          }
        }
      })

      if (instances.length === 0) {
        this.logger.debug('No instances found for provided IDs')
        return new Map()
      }

      const instanceMap = new Map(instances.map(i => [i.id, i]))
      const templateIds = [...new Set(instances.map(i => i.strategyTemplateId))]

      // 2. 批量查询活跃订阅
      const subscriptions = await client.userStrategySubscription.findMany({
        where: {
          strategyInstanceId: { in: strategyInstanceIds },
          status: 'active'
        },
        select: {
          strategyInstanceId: true,
          userId: true
        }
      })

      // 按实例分组订阅
      const subscriptionsByInstance = this.groupBy(subscriptions, 'strategyInstanceId')

      // 获取所有订阅用户 ID
      const allUserIds = [...new Set(subscriptions.map(s => s.userId))]

      if (allUserIds.length === 0) {
        // 没有活跃订阅，返回空统计
        return new Map(
          strategyInstanceIds.map(id => [id, this.createEmptyStats()])
        )
      }

      // 3. 批量查询所有相关账户
      const accounts = await client.userStrategyAccount.findMany({
        where: {
          userId: { in: allUserIds },
          strategyId: { in: templateIds }
        },
        select: {
          id: true,
          userId: true,
          strategyId: true,
          initialBalance: true,
          balance: true,
          equity: true,
          totalRealizedPnl: true,
          totalUnrealizedPnl: true
        }
      })

      const allAccountIds = accounts.map(a => a.id)

      if (allAccountIds.length === 0) {
        return new Map(
          strategyInstanceIds.map(id => [id, this.createEmptyStats()])
        )
      }

      // 4. 批量查询持仓和今日统计
      const [positions, closedPositionsForWinRate, todayMetrics] = await Promise.all([
        client.position.findMany({
          where: { userStrategyAccountId: { in: allAccountIds } },
          select: {
            userStrategyAccountId: true,
            status: true
          }
        }),
        client.position.findMany({
          where: {
            userStrategyAccountId: { in: allAccountIds },
            status: 'CLOSED'
          },
          select: {
            userStrategyAccountId: true,
            realizedPnl: true
          }
        }),
        this.getTodayMetricsBatch(allAccountIds, timezone)
      ])

      // 5. 按账户分组数据
      const positionsByAccountId = this.groupBy(positions, 'userStrategyAccountId')
      const closedPositionsMap = this.groupBy(closedPositionsForWinRate, 'userStrategyAccountId')

      // 6. 为每个实例计算统计
      const statsMap = new Map<string, StrategyInstanceStatsDto | null>()

      for (const [instanceId, instance] of instanceMap.entries()) {
        const instanceSubscriptions = subscriptionsByInstance.get(instanceId) || []
        const instanceUserIds = instanceSubscriptions.map((s: any) => s.userId)

        if (instanceUserIds.length === 0) {
          statsMap.set(instanceId, this.createEmptyStats())
          continue
        }

        // 获取该实例相关的账户
        const instanceAccounts = accounts.filter(
          a => instanceUserIds.includes(a.userId) &&
               a.strategyId === instance.strategyTemplateId
        )

        if (instanceAccounts.length === 0) {
          statsMap.set(instanceId, this.createEmptyStats())
          continue
        }

        const instanceAccountIds = instanceAccounts.map(a => a.id)

        // 聚合统计
        const accountStats = this.aggregateAccountStats(instanceAccounts)
        const positionStats = this.aggregatePositionStatsFromGrouped(
          instanceAccountIds,
          positionsByAccountId
        )
        const tradeStats = this.aggregateTradeStatsFromGrouped(
          instanceAccountIds,
          closedPositionsMap
        )
        const todayStats = this.aggregateTodayStatsFromGrouped(
          instanceAccountIds,
          todayMetrics
        )

        statsMap.set(
          instanceId,
          this.buildStatsDto(accountStats, positionStats, tradeStats, todayStats)
        )
      }

      // 为未找到的实例 ID 添加空统计
      for (const id of strategyInstanceIds) {
        if (!statsMap.has(id)) {
          statsMap.set(id, null)
        }
      }

      return statsMap
    } catch (error) {
      this.logger.error('Batch stats calculation failed', error.stack)

      if (error instanceof BadRequestException) {
        throw error
      }

      throw new InternalServerErrorException(
        'Failed to calculate batch statistics',
        error.message
      )
    }
  }

  /**
   * 汇总账户统计
   */
  private aggregateAccountStats(
    accounts: Array<{
      initialBalance: Decimal
      balance: Decimal
      equity: Decimal
      totalRealizedPnl: Decimal
      totalUnrealizedPnl: Decimal
    }>
  ): AccountStats {
    let totalInitialBalance = new Decimal(0)
    let totalEquity = new Decimal(0)
    let totalRealizedPnl = new Decimal(0)
    let totalUnrealizedPnl = new Decimal(0)

    for (const account of accounts) {
      totalInitialBalance = totalInitialBalance.plus(account.initialBalance)
      totalEquity = totalEquity.plus(account.equity)
      totalRealizedPnl = totalRealizedPnl.plus(account.totalRealizedPnl)
      totalUnrealizedPnl = totalUnrealizedPnl.plus(account.totalUnrealizedPnl)
    }

    const totalPnl = totalRealizedPnl.plus(totalUnrealizedPnl)

    return {
      totalInitialBalance,
      totalEquity,
      totalPnl,
      totalRealizedPnl,
      totalUnrealizedPnl
    }
  }

  /**
   * 获取持仓统计
   */
  private async getPositionStats(accountIds: string[]): Promise<PositionStats> {
    const client = this.prisma.getClient()

    const [openPositions, closedPositions] = await Promise.all([
      client.position.count({
        where: {
          userStrategyAccountId: { in: accountIds },
          status: 'OPEN'
        }
      }),
      client.position.count({
        where: {
          userStrategyAccountId: { in: accountIds },
          status: 'CLOSED'
        }
      })
    ])

    return {
      openCount: openPositions,
      closedCount: closedPositions
    }
  }

  /**
   * 获取交易统计
   *
   * 注意：Trade 表不直接存储 PnL，需要从关联 Position 获取
   * 为保持量纲一致，totalCount 和 winCount/lossCount 都基于 Position 统计
   *
   * @returns TradeStats 包含平仓位数、盈利数、亏损数
   */
  private async getTradeStats(accountIds: string[]): Promise<TradeStats> {
    const client = this.prisma.getClient()

    // 获取所有已平仓位来计算胜率
    const closedPositions = await client.position.findMany({
      where: {
        userStrategyAccountId: { in: accountIds },
        status: 'CLOSED'
      },
      select: {
        realizedPnl: true
      }
    })

    let winCount = 0
    let lossCount = 0

    for (const position of closedPositions) {
      if (position.realizedPnl.greaterThan(0)) {
        winCount++
      } else if (position.realizedPnl.lessThan(0)) {
        lossCount++
      }
    }

    // 总数使用已平仓位数量，保持量纲一致
    const totalCount = closedPositions.length

    return {
      totalCount,
      winCount,
      lossCount
    }
  }

  /**
   * 获取今日统计
   *
   * @param accountIds 账户 ID 列表
   * @param timezone 时区 (默认 UTC)
   */
  private async getTodayStats(
    accountIds: string[],
    timezone: string = 'UTC'
  ): Promise<{ todayPnl: Decimal }> {
    const client = this.prisma.getClient()

    // 计算今日开始时间（正确处理时区）
    const todayStart = this.getTodayStartInTimezone(timezone)

    const todayMetrics = await client.strategyPnlDaily.findMany({
      where: {
        userStrategyAccountId: { in: accountIds },
        date: {
          gte: todayStart
        }
      },
      select: {
        realizedPnl: true,
        unrealizedPnl: true
      }
    })

    let todayPnl = new Decimal(0)
    for (const metric of todayMetrics) {
      // 今日盈亏 = 已实现盈亏 + 未实现盈亏
      todayPnl = todayPnl.plus(metric.realizedPnl).plus(metric.unrealizedPnl)
    }

    return { todayPnl }
  }

  /**
   * 批量获取今日统计（用于批量计算）
   */
  private async getTodayMetricsBatch(
    accountIds: string[],
    timezone: string = 'UTC'
  ): Promise<Map<string, Decimal>> {
    const client = this.prisma.getClient()

    // 计算今日开始时间（正确处理时区）
    const todayStart = this.getTodayStartInTimezone(timezone)

    const todayMetrics = await client.strategyPnlDaily.findMany({
      where: {
        userStrategyAccountId: { in: accountIds },
        date: {
          gte: todayStart
        }
      },
      select: {
        userStrategyAccountId: true,
        realizedPnl: true,
        unrealizedPnl: true
      }
    })

    const metricsMap = new Map<string, Decimal>()
    for (const metric of todayMetrics) {
      const current = metricsMap.get(metric.userStrategyAccountId) || new Decimal(0)
      // 今日盈亏 = 已实现盈亏 + 未实现盈亏
      const dailyPnl = metric.realizedPnl.plus(metric.unrealizedPnl)
      metricsMap.set(
        metric.userStrategyAccountId,
        current.plus(dailyPnl)
      )
    }

    return metricsMap
  }

  /**
   * 获取指定时区的今日开始时间（UTC 时间戳）
   *
   * 例如：timezone=Asia/Shanghai，当前上海时间是 2025-11-29 15:30
   * 应返回上海的 2025-11-29 00:00:00，对应的 UTC 时间为 2025-11-28 16:00:00
   *
   * @param timezone IANA 时区名称，如 'Asia/Shanghai', 'America/New_York'
   * @returns UTC Date 对象，表示该时区今日零点
   */
  private getTodayStartInTimezone(timezone: string): Date {
    const now = new Date()

    // 使用 Intl.DateTimeFormat 获取指定时区的年月日
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })

    const parts = formatter.formatToParts(now)
    const year = parts.find(p => p.type === 'year')!.value
    const month = parts.find(p => p.type === 'month')!.value
    const day = parts.find(p => p.type === 'day')!.value

    // 创建一个临时格式化器来计算偏移量
    const utcFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })

    const targetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })

    // 使用当前时间作为参考点计算偏移量
    const refDate = new Date()
    const utcTime = utcFormatter.format(refDate)
    const targetTime = targetFormatter.format(refDate)

    // 解析时间字符串计算偏移（以小时为单位）
    const utcParts = utcTime.match(/(\d+)\/(\d+)\/(\d+),\s+(\d+):(\d+):(\d+)/)!
    const targetParts = targetTime.match(/(\d+)\/(\d+)\/(\d+),\s+(\d+):(\d+):(\d+)/)!

    const utcDate = new Date(
      Number.parseInt(utcParts[3]), Number.parseInt(utcParts[1]) - 1, Number.parseInt(utcParts[2]),
      Number.parseInt(utcParts[4]), Number.parseInt(utcParts[5]), Number.parseInt(utcParts[6])
    )
    const targetDate = new Date(
      Number.parseInt(targetParts[3]), Number.parseInt(targetParts[1]) - 1, Number.parseInt(targetParts[2]),
      Number.parseInt(targetParts[4]), Number.parseInt(targetParts[5]), Number.parseInt(targetParts[6])
    )

    const offsetMs = targetDate.getTime() - utcDate.getTime()

    // 构建目标时区的今日零点
    const todayInTarget = new Date(
      Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day), 0, 0, 0, 0
    )

    // 减去偏移量得到 UTC 时间
    return new Date(todayInTarget.getTime() - offsetMs)
  }

  /**
   * 构建统计 DTO
   *
   * 使用 Decimal 类型进行精确计算，避免浮点精度问题
   */
  private buildStatsDto(
    accountStats: AccountStats,
    positionStats: PositionStats,
    tradeStats: TradeStats,
    todayStats: { todayPnl: Decimal }
  ): StrategyInstanceStatsDto {
    // 使用 Decimal 进行精确计算
    const investedAmount = accountStats.totalInitialBalance
    const currentValue = accountStats.totalEquity
    const totalPnl = accountStats.totalPnl
    const todayPnl = todayStats.todayPnl

    // 计算收益率（使用 Decimal 保持精度）
    const totalPnlRate = investedAmount.greaterThan(0)
      ? totalPnl.dividedBy(investedAmount).times(100)
      : new Decimal(0)

    const todayPnlRate = currentValue.greaterThan(0)
      ? todayPnl.dividedBy(currentValue).times(100)
      : new Decimal(0)

    // 修复：正确计算胜率 = 盈利交易数 / 总交易数
    const winRate = tradeStats.totalCount > 0
      ? (tradeStats.winCount / tradeStats.totalCount) * 100
      : undefined

    return {
      investedAmount: investedAmount.toDecimalPlaces(DECIMAL_PLACES).toNumber(),
      currentValue: currentValue.toDecimalPlaces(DECIMAL_PLACES).toNumber(),
      totalPnl: totalPnl.toDecimalPlaces(DECIMAL_PLACES).toNumber(),
      totalPnlRate: totalPnlRate.toDecimalPlaces(DECIMAL_PLACES).toNumber(),
      todayPnl: todayPnl.toDecimalPlaces(DECIMAL_PLACES).toNumber(),
      todayPnlRate: todayPnlRate.toDecimalPlaces(DECIMAL_PLACES).toNumber(),
      openPositionsCount: positionStats.openCount,
      closedPositionsCount: positionStats.closedCount,
      totalTradesCount: tradeStats.totalCount,
      winningTradesCount: tradeStats.winCount,
      winRate: winRate !== undefined ? Number(winRate.toFixed(DECIMAL_PLACES)) : undefined,
      maxDrawdown: undefined, // 需要更复杂的历史数据分析
      sharpeRatio: undefined, // 需要历史收益率和波动率数据
      lastUpdatedAt: new Date()
    }
  }

  /**
   * 创建空统计数据
   */
  private createEmptyStats(): StrategyInstanceStatsDto {
    return {
      investedAmount: 0,
      currentValue: 0,
      totalPnl: 0,
      totalPnlRate: 0,
      todayPnl: 0,
      todayPnlRate: 0,
      openPositionsCount: 0,
      closedPositionsCount: 0,
      totalTradesCount: 0,
      winningTradesCount: 0,
      winRate: undefined, // 修复：无数据时应为 undefined，而非 0
      maxDrawdown: undefined,
      sharpeRatio: undefined,
      lastUpdatedAt: new Date()
    }
  }

  /**
   * 验证 CUID 格式
   */
  private isValidCuid(id: string): boolean {
    return CUID_REGEX.test(id)
  }

  /**
   * 分组辅助方法
   */
  private groupBy<T>(items: T[], key: keyof T): Map<any, T[]> {
    const map = new Map()
    for (const item of items) {
      const group = map.get(item[key]) || []
      group.push(item)
      map.set(item[key], group)
    }
    return map
  }

  /**
   * 从分组数据聚合持仓统计
   */
  private aggregatePositionStatsFromGrouped(
    accountIds: string[],
    positionsByAccountId: Map<string, any[]>
  ): PositionStats {
    let openCount = 0
    let closedCount = 0

    for (const accountId of accountIds) {
      const positions = positionsByAccountId.get(accountId) || []
      for (const pos of positions) {
        if (pos.status === 'OPEN') {
          openCount++
        } else if (pos.status === 'CLOSED') {
          closedCount++
        }
      }
    }

    return { openCount, closedCount }
  }

  /**
   * 从分组数据聚合交易统计
   *
   * 注意：为保持量纲一致，totalCount 和 winCount/lossCount 都基于 Position 统计
   */
  private aggregateTradeStatsFromGrouped(
    accountIds: string[],
    closedPositionsMap: Map<string, any[]>
  ): TradeStats {
    let totalCount = 0
    let winCount = 0
    let lossCount = 0

    for (const accountId of accountIds) {
      // 通过已平仓位计算胜率和亏损数
      const closedPositions = closedPositionsMap.get(accountId) || []
      totalCount += closedPositions.length

      for (const position of closedPositions) {
        if (position.realizedPnl) {
          if (position.realizedPnl.greaterThan(0)) {
            winCount++
          } else if (position.realizedPnl.lessThan(0)) {
            lossCount++
          }
        }
      }
    }

    return { totalCount, winCount, lossCount }
  }

  /**
   * 从分组数据聚合今日统计
   */
  private aggregateTodayStatsFromGrouped(
    accountIds: string[],
    todayMetrics: Map<string, Decimal>
  ): { todayPnl: Decimal } {
    let todayPnl = new Decimal(0)

    for (const accountId of accountIds) {
      const pnl = todayMetrics.get(accountId)
      if (pnl) {
        todayPnl = todayPnl.plus(pnl)
      }
    }

    return { todayPnl }
  }
}
