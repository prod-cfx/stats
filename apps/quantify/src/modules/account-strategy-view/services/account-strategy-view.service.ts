import type { AccountStrategyActionDto } from '../dto/account-strategy-action.dto';
import type { AccountStrategyDetailResponseDto, AccountStrategyTimelineEventDto } from '../dto/account-strategy-detail.response.dto'
import type { AccountStrategyListItemDto } from '../dto/account-strategy-list-item.dto'
import type { AccountStrategyListQueryDto } from '../dto/account-strategy-list.query.dto'
import type { AccountStrategyViewRepository } from '../repositories/account-strategy-view.repository'
import type { StrategyInstanceStatsService } from '@/modules/strategy-instances/services/strategy-instance-stats.service'
import type { StrategyInstancesService } from '@/modules/strategy-instances/services/strategy-instances.service'
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { AccountStrategyAction } from '../dto/account-strategy-action.dto'

@Injectable()
export class AccountStrategyViewService {
  constructor(
    private readonly repo: AccountStrategyViewRepository,
    private readonly statsService: StrategyInstanceStatsService,
    private readonly strategyInstancesService: StrategyInstancesService,
  ) {}

  async listStrategies(
    query: AccountStrategyListQueryDto,
  ): Promise<BasePaginationResponseDto<AccountStrategyListItemDto>> {
    const rows = await this.repo.listStrategiesForUser({
      userId: query.userId,
      page: query.page,
      limit: query.limit,
      status: query.status,
    })

    const instanceIds = rows.items.map(item => item.id)
    let statsMap = new Map<string, any>()

    if (instanceIds.length > 0) {
      try {
        statsMap = await this.statsService.calculateBatchStats(instanceIds)
      } catch {
        statsMap = new Map<string, any>()
      }
    }

    const items: AccountStrategyListItemDto[] = rows.items.map(item => {
      const stats = statsMap.get(item.id)
      const mergedParams = {
        ...(item.defaultParams ?? {}),
        ...(item.params ?? {}),
        ...(item.customParams ?? {}),
      } as Record<string, unknown>

      return {
        id: item.id,
        name: item.name,
        status: this.mapUiStatus(item.status),
        exchange: this.readString(mergedParams, ['exchange', 'provider', 'exchangeId']),
        symbol: this.readString(mergedParams, ['symbol']),
        timeframe: this.readString(mergedParams, ['timeframe', 'period']),
        positionPct: this.readNumber(mergedParams, ['positionPct', 'positionSizeRatioPercent']),
        isSubscribed: item.subscribed,
        metrics: {
          returnPct: this.readStatsNumber(stats, 'totalPnlRate'),
          maxDrawdownPct: this.readStatsNumber(stats, 'maxDrawdown'),
          winRatePct: this.readStatsNumber(stats, 'winRate'),
          tradeCount: this.readStatsNumber(stats, 'totalTradesCount'),
        },
        updatedAt: item.updatedAt.toISOString(),
      }
    })

    return new BasePaginationResponseDto<AccountStrategyListItemDto>(
      rows.total,
      rows.page,
      rows.limit,
      items,
    )
  }

  async getStrategyDetail(userId: string, strategyInstanceId: string): Promise<AccountStrategyDetailResponseDto> {
    const row = await this.repo.findStrategyForUser(userId, strategyInstanceId)
    if (!row) {
      throw new NotFoundException('Strategy not found')
    }

    const sub = row.subscriptions[0]
    const mergedParams = {
      ...(row.strategyTemplate?.defaultParams as Record<string, unknown> ?? {}),
      ...(row.params as Record<string, unknown> ?? {}),
      ...(sub?.customParams as Record<string, unknown> ?? {}),
    } as Record<string, unknown>

    const account = await this.repo.findUserStrategyAccount(userId, row.strategyTemplateId)
    const equityRows = account
      ? await this.repo.loadEquitySeries(account.id)
      : []
    const tradeStats = account
      ? await this.repo.loadTradeStats(account.id)
      : { tradeCount: 0, closedCount: 0, winningCount: 0 }
    const timelineSource = await this.repo.loadTimeline(
      userId,
      strategyInstanceId,
      account?.id,
    )

    const stats = await this.statsService.calculateStats(strategyInstanceId).catch(() => null)
    const totalPnl = account
      ? Number(account.totalRealizedPnl) + Number(account.totalUnrealizedPnl)
      : this.readStatsNumber(stats, 'totalPnl')
    const investedAmount = account
      ? Number(account.initialBalance)
      : this.readStatsNumber(stats, 'investedAmount')
    const returnPct = investedAmount > 0
      ? Number(((totalPnl / investedAmount) * 100).toFixed(2))
      : 0

    const maxDrawdownPct = equityRows.length > 0
      ? Math.max(...equityRows.map(row => Number(row.maxDrawdown)))
      : this.readStatsNumber(stats, 'maxDrawdown')

    const winRatePct = tradeStats.closedCount > 0
      ? Number(((tradeStats.winningCount / tradeStats.closedCount) * 100).toFixed(2))
      : this.readStatsNumber(stats, 'winRate')

    const todayPnl = equityRows.length > 0
      ? Number(equityRows[equityRows.length - 1]?.realizedPnl ?? 0)
        + Number(equityRows[equityRows.length - 1]?.unrealizedPnl ?? 0)
      : this.readStatsNumber(stats, 'todayPnl')

    const detail: AccountStrategyDetailResponseDto = {
      id: row.id,
      name: row.name,
      status: this.mapUiStatus(row.status),
      exchange: this.readString(mergedParams, ['exchange', 'provider', 'exchangeId']),
      symbol: this.readString(mergedParams, ['symbol']),
      timeframe: this.readString(mergedParams, ['timeframe', 'period']),
      positionPct: this.readNumber(mergedParams, ['positionPct', 'positionSizeRatioPercent']),
      isSubscribed: !!sub && sub.status === 'active',
      metrics: {
        returnPct,
        maxDrawdownPct,
        winRatePct,
        tradeCount: tradeStats.tradeCount > 0
          ? tradeStats.tradeCount
          : this.readStatsNumber(stats, 'totalTradesCount'),
      },
      updatedAt: row.updatedAt.toISOString(),
      totalPnl,
      todayPnl,
      equitySeries: equityRows.map(item => ({
        ts: item.date.toISOString(),
        value: Number(item.equityEnd),
      })),
      snapshot: {
        exchange: this.readString(mergedParams, ['exchange', 'provider', 'exchangeId']),
        symbol: this.readString(mergedParams, ['symbol']),
        timeframe: this.readString(mergedParams, ['timeframe', 'period']),
        positionPct: this.readNumber(mergedParams, ['positionPct', 'positionSizeRatioPercent']),
        deployAccountName: sub?.exchangeAccount?.name ?? null,
        deployAt: sub?.subscribedAt?.toISOString() ?? row.startedAt?.toISOString() ?? null,
      },
      timeline: this.buildMixedTimeline(timelineSource),
    }

    if (detail.equitySeries.length === 0 && account) {
      detail.equitySeries = [{
        ts: new Date().toISOString(),
        value: Number(account.equity),
      }]
    }

    return detail
  }

  async performAction(
    strategyInstanceId: string,
    dto: AccountStrategyActionDto,
  ): Promise<AccountStrategyDetailResponseDto> {
    if (!dto.userId) {
      throw new BadRequestException('Missing user identity')
    }
    const userId = dto.userId

    const row = await this.repo.findStrategyForUser(userId, strategyInstanceId)
    if (!row) {
      throw new NotFoundException('Strategy not found')
    }

    const isOwner = row.createdBy === userId
    if (!isOwner) {
      throw new ForbiddenException('Only strategy owner can operate instance status')
    }

    const nextStatus = dto.action === AccountStrategyAction.RUN ? 'running' : 'stopped'
    if (nextStatus === row.status) {
      return this.getStrategyDetail(userId, strategyInstanceId)
    }

    if (dto.action !== AccountStrategyAction.RUN && dto.action !== AccountStrategyAction.STOP) {
      throw new BadRequestException('Invalid action')
    }

    await this.strategyInstancesService.updateInstance(
      strategyInstanceId,
      {
        status: nextStatus as any,
        updatedBy: userId,
      },
      userId,
    )

    return this.getStrategyDetail(userId, strategyInstanceId)
  }

  private mapUiStatus(status: string): 'running' | 'stopped' | 'draft' {
    if (status === 'running') return 'running'
    if (status === 'draft') return 'draft'
    return 'stopped'
  }

  private readString(source: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = source[key]
      if (typeof value === 'string' && value.trim().length > 0) return value
    }
    return null
  }

  private readNumber(source: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = source[key]
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
      }
    }
    return null
  }

  private readStatsNumber(stats: any, key: string): number | null {
    if (!stats) return null
    const value = stats[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private buildMixedTimeline(source: {
    instance: any
    subscription: any
    signalExecutions: any[]
    trades: any[]
  }): AccountStrategyTimelineEventDto[] {
    const events: AccountStrategyTimelineEventDto[] = []

    if (source.instance?.createdAt) {
      events.push({
        at: source.instance.createdAt.toISOString(),
        eventType: 'system',
        event: '创建策略',
        note: null,
      })
    }
    if (source.subscription?.subscribedAt) {
      events.push({
        at: source.subscription.subscribedAt.toISOString(),
        eventType: 'system',
        event: '订阅策略',
        note: null,
      })
    }
    if (source.instance?.startedAt) {
      events.push({
        at: source.instance.startedAt.toISOString(),
        eventType: 'system',
        event: '开始运行',
        note: null,
      })
    }
    if (source.instance?.stoppedAt) {
      events.push({
        at: source.instance.stoppedAt.toISOString(),
        eventType: 'system',
        event: '停止运行',
        note: null,
      })
    }
    if (source.subscription?.unsubscribedAt) {
      events.push({
        at: source.subscription.unsubscribedAt.toISOString(),
        eventType: 'system',
        event: '取消订阅',
        note: null,
      })
    }

    for (const execution of source.signalExecutions) {
      events.push({
        at: execution.createdAt.toISOString(),
        eventType: 'trade',
        event: execution.status === 'SUCCESS' ? '信号执行成功' : '信号执行',
        note: execution.errorMessage ?? null,
      })
    }

    for (const trade of source.trades) {
      events.push({
        at: trade.executedAt.toISOString(),
        eventType: 'trade',
        event: `成交 ${trade.side}`,
        note: `${trade.symbol} @ ${trade.price}`,
      })
    }

    return events
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      .slice(0, 30)
  }
}
