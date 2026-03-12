/* eslint-disable ts/consistent-type-imports -- NestJS 瑁呴グ鍣ㄥ拰渚濊禆娉ㄥ叆闇€瑕佽繍琛屾椂瀵煎叆 */
import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '@/prisma/prisma.service'

import { StrategyInstanceStatsDto } from '../dto/strategy-instance-stats.dto'

// Prisma 7: 浠?Prisma namespace 瀵煎嚭绫诲瀷鍜屽€?
/* eslint-disable no-redeclare, ts/no-redeclare */
type Decimal = Prisma.Decimal
const Decimal = Prisma.Decimal

type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
/* eslint-enable no-redeclare, ts/no-redeclare */

// 甯搁噺瀹氫箟
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
   * 璁＄畻绛栫暐瀹炰緥鐨勭粺璁℃暟鎹?
   *
   * 娉ㄦ剰锛氬綋鍓嶅疄鐜板熀浜?UserStrategyAccount 琛紝璇ヨ〃涓庣瓥鐣ュ疄渚嬮棿鎺ュ叧鑱?
   * 閫氳繃 strategyId 瀛楁鍏宠仈鍒扮瓥鐣ユā鏉匡紝鍐嶉€氳繃绛栫暐妯℃澘鍏宠仈鍒扮瓥鐣ュ疄渚?
   *
   * 鏈潵濡傛灉闇€瑕佹洿绮剧‘鐨勭粺璁★紝寤鸿鍦ㄦ暟鎹簱 schema 涓坊鍔犵洿鎺ュ叧鑱?
   *
   * @param strategyInstanceId 绛栫暐瀹炰緥 ID
   * @param timezone 鏃跺尯 (榛樿 UTC)
   * @returns 缁熻鏁版嵁鎴?null
   * @throws InternalServerErrorException 璁＄畻澶辫触鏃舵姏鍑?
   */
  async calculateStats(
    strategyInstanceId: string,
    timezone: string = 'UTC'
  ): Promise<StrategyInstanceStatsDto | null> {
    // 杈撳叆楠岃瘉
    if (!strategyInstanceId || !this.isValidCuid(strategyInstanceId)) {
      throw new BadRequestException('Invalid strategy instance ID format')
    }

    try {
      const client = this.prisma.getClient()

      // 鑾峰彇绛栫暐瀹炰緥淇℃伅
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

      // 閫氳繃璁㈤槄鍏崇郴鑾峰彇鍏宠仈鐨勮处鎴凤紙鏇寸簿纭殑鍏宠仈锛?
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
        // 娌℃湁娲昏穬璁㈤槄锛岃繑鍥炵┖缁熻
        this.logger.debug(`No active subscriptions for instance: ${strategyInstanceId}`)
        return this.createEmptyStats()
      }

      const userIds = subscriptions.map(s => s.userId)

      // 鏌ヨ璁㈤槄鐢ㄦ埛鐨勭瓥鐣ヨ处鎴?
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

      // 骞惰鏌ヨ鎵€鏈夌粺璁℃暟鎹?
      const [accountStats, positionStats, tradeStats, todayStats] = await Promise.all([
        Promise.resolve(this.aggregateAccountStats(accounts)),
        this.getPositionStats(accountIds),
        this.getTradeStats(accountIds),
        this.getTodayStats(accountIds, timezone)
      ])

      // 璁＄畻姹囨€荤粺璁?
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
   * 鎵归噺璁＄畻澶氫釜绛栫暐瀹炰緥鐨勭粺璁℃暟鎹?
   *
   * 浼樺寲鐗堟湰锛氫娇鐢ㄦ壒閲忔煡璇㈠噺灏戞暟鎹簱寰€杩旀鏁?
   *
   * @param strategyInstanceIds 绛栫暐瀹炰緥 ID 鏁扮粍
   * @param timezone 鏃跺尯 (榛樿 UTC)
   * @returns 瀹炰緥 ID 鍒扮粺璁℃暟鎹殑鏄犲皠
   */
  async calculateBatchStats(
    strategyInstanceIds: string[],
    timezone: string = 'UTC'
  ): Promise<Map<string, StrategyInstanceStatsDto | null>> {
    // 杈撳叆楠岃瘉
    if (!Array.isArray(strategyInstanceIds)) {
      throw new BadRequestException('strategyInstanceIds must be an array')
    }

    if (strategyInstanceIds.length === 0) {
      return new Map()
    }

    // 闃叉 DOS 鏀诲嚮
    if (strategyInstanceIds.length > MAX_BATCH_SIZE) {
      throw new BadRequestException(
        `Batch size exceeds maximum of ${MAX_BATCH_SIZE}`
      )
    }

    // 楠岃瘉鎵€鏈?ID 鏍煎紡
    const invalidIds = strategyInstanceIds.filter(id => !this.isValidCuid(id))
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Invalid instance IDs: ${invalidIds.slice(0, 5).join(', ')}${invalidIds.length > 5 ? '...' : ''}`
      )
    }

    try {
      const client = this.prisma.getClient()

      // 1. 鎵归噺鏌ヨ鎵€鏈夌瓥鐣ュ疄渚?
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

      // 2. 鎵归噺鏌ヨ娲昏穬璁㈤槄
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

      // 鎸夊疄渚嬪垎缁勮闃?
      const subscriptionsByInstance = this.groupBy(subscriptions, 'strategyInstanceId')

      // 鑾峰彇鎵€鏈夎闃呯敤鎴?ID
      const allUserIds = [...new Set(subscriptions.map(s => s.userId))]

      if (allUserIds.length === 0) {
        // 娌℃湁娲昏穬璁㈤槄锛岃繑鍥炵┖缁熻
        return new Map(
          strategyInstanceIds.map(id => [id, this.createEmptyStats()])
        )
      }

      // 3. 鎵归噺鏌ヨ鎵€鏈夌浉鍏宠处鎴?
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

      // 4. 鎵归噺鏌ヨ鎸佷粨鍜屼粖鏃ョ粺璁?
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

      // 5. 鎸夎处鎴峰垎缁勬暟鎹?
      const positionsByAccountId = this.groupBy(positions, 'userStrategyAccountId')
      const closedPositionsMap = this.groupBy(closedPositionsForWinRate, 'userStrategyAccountId')

      // 6. 涓烘瘡涓疄渚嬭绠楃粺璁?
      const statsMap = new Map<string, StrategyInstanceStatsDto | null>()

      for (const [instanceId, instance] of instanceMap.entries()) {
        const instanceSubscriptions = subscriptionsByInstance.get(instanceId) || []
        const instanceUserIds = instanceSubscriptions.map((s: any) => s.userId)

        if (instanceUserIds.length === 0) {
          statsMap.set(instanceId, this.createEmptyStats())
          continue
        }

        // 鑾峰彇璇ュ疄渚嬬浉鍏崇殑璐︽埛
        const instanceAccounts = accounts.filter(
          a => instanceUserIds.includes(a.userId) &&
               a.strategyId === instance.strategyTemplateId
        )

        if (instanceAccounts.length === 0) {
          statsMap.set(instanceId, this.createEmptyStats())
          continue
        }

        const instanceAccountIds = instanceAccounts.map(a => a.id)

        // 鑱氬悎缁熻
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

      // 涓烘湭鎵惧埌鐨勫疄渚?ID 娣诲姞绌虹粺璁?
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
   * 姹囨€昏处鎴风粺璁?
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
   * 鑾峰彇鎸佷粨缁熻
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
   * 鑾峰彇浜ゆ槗缁熻
   *
   * 娉ㄦ剰锛歍rade 琛ㄤ笉鐩存帴瀛樺偍 PnL锛岄渶瑕佷粠鍏宠仈鐨?Position 鑾峰彇
   * 涓轰繚鎸侀噺绾蹭竴鑷达紝totalCount 鍜?winCount/lossCount 閮藉熀浜?Position 缁熻
   *
   * @returns TradeStats 鍖呭惈骞充粨浣嶆€绘暟銆佺泩鍒╂暟銆佷簭鎹熸暟
   */
  private async getTradeStats(accountIds: string[]): Promise<TradeStats> {
    const client = this.prisma.getClient()

    // 鑾峰彇鎵€鏈夊凡骞充粨浣嶆潵璁＄畻鑳滅巼
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

    // 鎬绘暟浣跨敤宸插钩浠撲綅鏁伴噺锛屼繚鎸侀噺绾蹭竴鑷?
    const totalCount = closedPositions.length

    return {
      totalCount,
      winCount,
      lossCount
    }
  }

  /**
   * 鑾峰彇浠婃棩缁熻
   *
   * @param accountIds 璐︽埛 ID 鍒楄〃
   * @param timezone 鏃跺尯 (榛樿 UTC)
   */
  private async getTodayStats(
    accountIds: string[],
    timezone: string = 'UTC'
  ): Promise<{ todayPnl: Decimal }> {
    const client = this.prisma.getClient()

    // 璁＄畻浠婃棩寮€濮嬫椂闂达紙姝ｇ‘澶勭悊鏃跺尯锛?
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
      // 浠婃棩鐩堜簭 = 宸插疄鐜扮泩浜?+ 鏈疄鐜扮泩浜?
      todayPnl = todayPnl.plus(metric.realizedPnl).plus(metric.unrealizedPnl)
    }

    return { todayPnl }
  }

  /**
   * 鎵归噺鑾峰彇浠婃棩缁熻锛堢敤浜庢壒閲忚绠楋級
   */
  private async getTodayMetricsBatch(
    accountIds: string[],
    timezone: string = 'UTC'
  ): Promise<Map<string, Decimal>> {
    const client = this.prisma.getClient()

    // 璁＄畻浠婃棩寮€濮嬫椂闂达紙姝ｇ‘澶勭悊鏃跺尯锛?
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
      // 浠婃棩鐩堜簭 = 宸插疄鐜扮泩浜?+ 鏈疄鐜扮泩浜?
      const dailyPnl = metric.realizedPnl.plus(metric.unrealizedPnl)
      metricsMap.set(
        metric.userStrategyAccountId,
        current.plus(dailyPnl)
      )
    }

    return metricsMap
  }

  /**
   * 鑾峰彇鎸囧畾鏃跺尯鐨勪粖鏃ュ紑濮嬫椂闂达紙UTC 鏃堕棿鎴筹級
   *
   * 渚嬪锛歵imezone=Asia/Shanghai锛屽綋鍓嶄笂娴锋椂闂存槸 2025-11-29 15:30
   * 搴旇繑鍥炰笂娴风殑 2025-11-29 00:00:00锛屽搴旂殑 UTC 鏃堕棿鏄?2025-11-28 16:00:00
   *
   * @param timezone IANA 鏃跺尯鍚嶇О锛屽 'Asia/Shanghai', 'America/New_York'
   * @returns UTC Date 瀵硅薄锛岃〃绀鸿鏃跺尯浠婃棩闆剁偣
   */
  private getTodayStartInTimezone(timezone: string): Date {
    const now = new Date()

    // 浣跨敤 Intl.DateTimeFormat 鑾峰彇鎸囧畾鏃跺尯鐨勫勾鏈堟棩
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

    // 鍒涘缓涓€涓复鏃舵牸寮忓寲鍣ㄦ潵璁＄畻鍋忕Щ閲?
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

    // 浣跨敤褰撳墠鏃堕棿浣滀负鍙傝€冪偣璁＄畻鍋忕Щ閲?
    const refDate = new Date()
    const utcTime = utcFormatter.format(refDate)
    const targetTime = targetFormatter.format(refDate)

    // 瑙ｆ瀽鏃堕棿瀛楃涓茶绠楀亸绉伙紙浠ュ皬鏃朵负鍗曚綅锛?
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

    // 鏋勯€犵洰鏍囨椂鍖虹殑浠婃棩闆剁偣
    const todayInTarget = new Date(
      Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day), 0, 0, 0, 0
    )

    // 鍑忓幓鍋忕Щ閲忓緱鍒?UTC 鏃堕棿
    return new Date(todayInTarget.getTime() - offsetMs)
  }

  /**
   * 鏋勫缓缁熻 DTO
   *
   * 浣跨敤 Decimal 绫诲瀷杩涜绮剧‘璁＄畻锛岄伩鍏嶆诞鐐圭簿搴﹂棶棰?
   */
  private buildStatsDto(
    accountStats: AccountStats,
    positionStats: PositionStats,
    tradeStats: TradeStats,
    todayStats: { todayPnl: Decimal }
  ): StrategyInstanceStatsDto {
    // 浣跨敤 Decimal 杩涜绮剧‘璁＄畻
    const investedAmount = accountStats.totalInitialBalance
    const currentValue = accountStats.totalEquity
    const totalPnl = accountStats.totalPnl
    const todayPnl = todayStats.todayPnl

    // 璁＄畻鏀剁泭鐜囷紙浣跨敤 Decimal 淇濇寔绮惧害锛?
    const totalPnlRate = investedAmount.greaterThan(0)
      ? totalPnl.dividedBy(investedAmount).times(100)
      : new Decimal(0)

    const todayPnlRate = currentValue.greaterThan(0)
      ? todayPnl.dividedBy(currentValue).times(100)
      : new Decimal(0)

    // 鉁?淇锛氭纭绠楄儨鐜?= 鐩堝埄浜ゆ槗鏁?/ 鎬讳氦鏄撴暟
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
      maxDrawdown: undefined, // 闇€瑕佹洿澶嶆潅鐨勫巻鍙叉暟鎹垎鏋?
      sharpeRatio: undefined, // 闇€瑕佸巻鍙叉敹鐩婄巼鍜屾尝鍔ㄧ巼鏁版嵁
      lastUpdatedAt: new Date()
    }
  }

  /**
   * 鍒涘缓绌虹粺璁℃暟鎹?
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
      winRate: undefined, // 鉁?淇锛氭棤鏁版嵁鏃跺簲涓?undefined锛岃€岄潪 0
      maxDrawdown: undefined,
      sharpeRatio: undefined,
      lastUpdatedAt: new Date()
    }
  }

  /**
   * 楠岃瘉 CUID 鏍煎紡
   */
  private isValidCuid(id: string): boolean {
    return CUID_REGEX.test(id)
  }

  /**
   * 鍒嗙粍杈呭姪鏂规硶
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
   * 浠庡垎缁勬暟鎹仛鍚堟寔浠撶粺璁?
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
   * 浠庡垎缁勬暟鎹仛鍚堜氦鏄撶粺璁?
   *
   * 娉ㄦ剰锛氫负淇濇寔閲忕翰涓€鑷达紝totalCount 鍜?winCount/lossCount 閮藉熀浜?Position 缁熻
   */
  private aggregateTradeStatsFromGrouped(
    accountIds: string[],
    closedPositionsMap: Map<string, any[]>
  ): TradeStats {
    let totalCount = 0
    let winCount = 0
    let lossCount = 0

    for (const accountId of accountIds) {
      // 閫氳繃宸插钩浠撲綅璁＄畻鑳滅巼鍜屾€绘暟
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
   * 浠庡垎缁勬暟鎹仛鍚堜粖鏃ョ粺璁?
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
