import type { AccountStrategyActionDto } from '../dto/account-strategy-action.dto'
import type { AccountStrategyDeployDto } from '../dto/account-strategy-deploy.dto'
import type { AccountStrategyDetailResponseDto, AccountStrategyTimelineEventDto } from '../dto/account-strategy-detail.response.dto'
import type { AccountStrategyListItemDto } from '../dto/account-strategy-list-item.dto'
import type { AccountStrategyListQueryDto } from '../dto/account-strategy-list.query.dto'
import type { StrategySignalsRuntimeConfig } from '@/modules/strategy-signals/types/strategy-signals-config.type'
import { createHash } from 'node:crypto'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Optional } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { ConfigService } from '@nestjs/config'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { MarketDataIngestionService } from '@/modules/market-data/services/market-data-ingestion.service'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { StrategyInstanceStatsService } from '@/modules/strategy-instances/services/strategy-instance-stats.service'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { StrategyInstancesService } from '@/modules/strategy-instances/services/strategy-instances.service'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '@/modules/strategy-signals/types/strategy-signals-config.type'
import { Prisma } from '@/prisma/prisma.types'
import { AccountStrategyAction } from '../dto/account-strategy-action.dto'
import {
  DeployIdempotencyConflictException,
  InvalidStrategyActionException,
  MissingUserIdentityException,
  StrategyNotFoundException,
  StrategyOwnerOnlyException,
} from '../exceptions'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { AccountStrategyViewRepository } from '../repositories/account-strategy-view.repository'

@Injectable()
export class AccountStrategyViewService {
  constructor(
    private readonly repo: AccountStrategyViewRepository,
    private readonly statsService: StrategyInstanceStatsService,
    private readonly strategyInstancesService: StrategyInstancesService,
    private readonly marketDataIngestionService: MarketDataIngestionService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async listStrategies(
    query: AccountStrategyListQueryDto,
  ): Promise<BasePaginationResponseDto<AccountStrategyListItemDto>> {
    const rows = await this.repo.listStrategiesForUser({
      userId: query.userId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      subscribedOnly: query.subscribedOnly,
      excludeDraft: query.excludeDraft,
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

    const items = await Promise.all(rows.items.map(async (item) => {
      const stats = statsMap.get(item.id)
      const mergedParams = {
        ...(item.defaultParams ?? {}),
        ...(item.params ?? {}),
        ...(item.customParams ?? {}),
      } as Record<string, unknown>
      const dynamicParams = this.buildDynamicParams({
        strategySchema: this.resolveStrategySchema(item),
        mergedParams,
        schemaVersion: this.resolveSchemaVersion(item),
      })
      const symbol = this.readString(mergedParams, ['symbol'])

      let fallback = null as Awaited<ReturnType<typeof this.buildAccountFallbackMetrics>> | null
      try {
        fallback = await this.buildAccountFallbackMetrics(
          query.userId,
          symbol,
        )
      } catch {
        fallback = null
      }

      const statsReturnPct = this.readStatsNumber(stats, 'totalPnlRate')
      const statsWinRatePct = this.readStatsNumber(stats, 'winRate')
      const statsTradeCount = this.readStatsNumber(stats, 'totalTradesCount')

      return {
        id: item.id,
        name: item.name,
        status: this.mapUiStatus(item.status),
        exchange: this.readString(mergedParams, ['exchange', 'provider', 'exchangeId']),
        symbol,
        timeframe: this.readString(mergedParams, ['timeframe', 'period']),
        positionPct: this.readNumber(mergedParams, ['positionPct', 'positionSizeRatioPercent']),
        ...dynamicParams,
        isSubscribed: item.subscribed,
        metrics: {
          returnPct: this.pickStatsOrFallbackMetric(statsReturnPct, fallback?.returnPct),
          maxDrawdownPct: this.readStatsNumber(stats, 'maxDrawdown'),
          winRatePct: this.pickStatsOrFallbackMetric(statsWinRatePct, fallback?.winRatePct),
          tradeCount: this.pickStatsOrFallbackMetric(statsTradeCount, fallback?.tradeCount),
        },
        updatedAt: item.updatedAt.toISOString(),
      }
    }))

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
      throw new StrategyNotFoundException({ strategyInstanceId })
    }

    const sub = this.assertStrategyVisible(row, strategyInstanceId)
    const isSubscribed = sub.status === 'active'

    const mergedParams = {
      ...(row.strategyTemplate?.defaultParams as Record<string, unknown> ?? {}),
      ...(row.params as Record<string, unknown> ?? {}),
      ...(sub?.customParams as Record<string, unknown> ?? {}),
    } as Record<string, unknown>
    const dynamicParams = this.buildDynamicParams({
      strategySchema: this.resolveStrategySchema(row),
      mergedParams,
      schemaVersion: this.resolveSchemaVersion(row),
    })

    const symbol = this.readString(mergedParams, ['symbol'])
    const normalizedSymbol = symbol?.split(':')[0] ?? null

    const account = await this.repo.findUserStrategyAccount(userId, row.strategyTemplateId)
      ?? (normalizedSymbol
        ? await this.repo.findLatestExecutedAccountByUserAndSymbol(userId, normalizedSymbol)
        : null)
    const equityRows = account
      ? await this.repo.loadEquitySeries(account.id)
      : []
    const closedPositionRows = account && typeof (this.repo as any).loadClosedPositionPnlSeries === 'function'
      ? await (this.repo as any).loadClosedPositionPnlSeries(account.id)
      : []
    const tradeStats = account
      ? await this.repo.loadTradeStats(account.id)
      : { tradeCount: 0, closedCount: 0, winningCount: 0 }
    const positionOverview = account
      ? await this.repo.loadPositionOverview(account.id)
      : { openCount: 0, closedCount: 0 }
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

    const lifecycleStartAt = row.startedAt ?? row.createdAt ?? row.updatedAt

    const derivedEquitySeries = account
      ? this.buildIndustryEquitySeries({
          initialBalance: Number(account.initialBalance),
          totalRealizedPnl: Number(account.totalRealizedPnl),
          totalUnrealizedPnl: Number(account.totalUnrealizedPnl),
          closedPositionRows,
          startedAt: lifecycleStartAt,
          dailyRows: equityRows,
        })
      : []

    const maxDrawdownPct = derivedEquitySeries.length > 0
      ? this.computeMaxDrawdownPct(derivedEquitySeries)
      : this.readStatsNumber(stats, 'maxDrawdown')

    const winRatePct = tradeStats.closedCount > 0
      ? Number(((tradeStats.winningCount / tradeStats.closedCount) * 100).toFixed(2))
      : this.readStatsNumber(stats, 'winRate')

    const todayPnl = account
      ? this.calculateTodayPnl(
          Number(account.totalUnrealizedPnl),
          closedPositionRows,
        )
      : this.readStatsNumber(stats, 'todayPnl') ?? totalPnl

    const detail: AccountStrategyDetailResponseDto = {
      id: row.id,
      name: row.name,
      status: this.mapUiStatus(row.status),
      exchange: this.readString(mergedParams, ['exchange', 'provider', 'exchangeId']),
      symbol,
      timeframe: this.readString(mergedParams, ['timeframe', 'period']),
      positionPct: this.readNumber(mergedParams, ['positionPct', 'positionSizeRatioPercent']),
      ...dynamicParams,
      isSubscribed,
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
      equitySeries: derivedEquitySeries,
      snapshot: {
        exchange: this.readString(mergedParams, ['exchange', 'provider', 'exchangeId']),
        symbol,
        timeframe: this.readString(mergedParams, ['timeframe', 'period']),
        positionPct: this.readNumber(mergedParams, ['positionPct', 'positionSizeRatioPercent']),
        paramSchema: dynamicParams.paramSchema,
        paramValues: dynamicParams.paramValues,
        schemaVersion: dynamicParams.schemaVersion,
        deployAccountName: sub?.exchangeAccount?.name ?? null,
        deployAt: sub?.subscribedAt?.toISOString() ?? row.startedAt?.toISOString() ?? null,
      },
      timeline: this.buildMixedTimeline(timelineSource),
      accountOverview: {
        initialBalance: account ? this.toFiniteNumber(account.initialBalance) : null,
        totalEquity: account ? this.toFiniteNumber(account.equity) : null,
        availableBalance: account ? this.toFiniteNumber(account.balance ?? account.equity) : null,
        totalPnl: totalPnl ?? null,
        todayPnl: todayPnl ?? null,
        baseCurrency: account ? this.readAccountBaseCurrency(account) : null,
      },
      positionOverview: {
        openPositionsCount: account ? positionOverview.openCount : null,
        closedPositionsCount: account ? positionOverview.closedCount : null,
        totalRealizedPnl: account ? this.toFiniteNumber(account.totalRealizedPnl) : null,
        totalUnrealizedPnl: account ? this.toFiniteNumber(account.totalUnrealizedPnl) : null,
      },
      latestOrders: this.buildLatestOrders(timelineSource.trades),
    }

    if (detail.equitySeries.length === 0 && account) {
      detail.equitySeries = [{
        ts: new Date().toISOString(),
        value: Number(account.initialBalance) + Number(account.totalRealizedPnl) + Number(account.totalUnrealizedPnl),
      }]
    }

    return detail
  }

  async performAction(
    strategyInstanceId: string,
    dto: AccountStrategyActionDto,
  ): Promise<AccountStrategyDetailResponseDto> {
    if (!dto.userId) {
      throw new MissingUserIdentityException()
    }
    const userId = dto.userId

    const row = await this.repo.findStrategyForUser(userId, strategyInstanceId)
    if (!row) {
      throw new StrategyNotFoundException({ strategyInstanceId })
    }

    const isOwner = row.createdBy === userId
    if (!isOwner) {
      throw new StrategyOwnerOnlyException({ userId, ownerId: row.createdBy })
    }

    this.assertStrategyVisible(row, strategyInstanceId)

    if (dto.action !== AccountStrategyAction.RUN && dto.action !== AccountStrategyAction.STOP) {
      throw new InvalidStrategyActionException({ action: dto.action })
    }

    const nextStatus = dto.action === AccountStrategyAction.RUN ? 'running' : 'stopped'
    if (nextStatus === row.status) {
      return this.getStrategyDetail(userId, strategyInstanceId)
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

  async deployStrategy(dto: AccountStrategyDeployDto): Promise<AccountStrategyDetailResponseDto> {
    if (!dto.userId) {
      throw new MissingUserIdentityException()
    }
    if (!dto.deployRequestId) {
      throw new DomainException('account_strategy.deploy_request_id_required', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    const payloadHash = this.hashDeployPayload(dto)
    const existingDeployRequest = await this.repo.findDeployRequestByUserAndRequestId(
      dto.userId,
      dto.deployRequestId,
    )
    if (existingDeployRequest) {
      if (existingDeployRequest.payloadHash !== payloadHash) {
        throw new DeployIdempotencyConflictException({
          deployRequestId: dto.deployRequestId,
          status: 'PAYLOAD_MISMATCH',
        })
      }
      if (existingDeployRequest.status === 'SUCCEEDED' && existingDeployRequest.strategyInstanceId) {
        return this.getStrategyDetail(dto.userId, existingDeployRequest.strategyInstanceId)
      }
      throw new DeployIdempotencyConflictException({
        deployRequestId: dto.deployRequestId,
        status: existingDeployRequest.status,
      })
    }

    let deployRequest: { id: string }
    try {
      deployRequest = await this.repo.createDeployRequestProcessing(
        dto.userId,
        dto.deployRequestId,
        payloadHash,
      )
    } catch (error) {
      if (!this.isDeployRequestUniqueConflict(error)) {
        throw error
      }
      const conflict = await this.repo.findDeployRequestByUserAndRequestId(dto.userId, dto.deployRequestId)
      if (conflict?.status === 'SUCCEEDED' && conflict.strategyInstanceId) {
        return this.getStrategyDetail(dto.userId, conflict.strategyInstanceId)
      }
      throw new DeployIdempotencyConflictException({
        deployRequestId: dto.deployRequestId,
        status: conflict?.status ?? 'PROCESSING',
      })
    }

    const resolvedDeploy = await this.resolveDeployPayload(dto)

    try {
      await this.marketDataIngestionService.ensureSymbolsSubscribed([resolvedDeploy.symbol])

      const deployResult = await this.repo.deployStrategyForUser({
        userId: dto.userId,
        name: dto.name,
        exchange: resolvedDeploy.exchange,
        symbol: resolvedDeploy.symbol,
        timeframe: resolvedDeploy.timeframe,
        positionPct: resolvedDeploy.positionPct,
        mode: dto.mode,
        strategyInstanceId: dto.strategyInstanceId,
        exchangeAccountId: dto.exchangeAccountId,
        exchangeAccountName: dto.exchangeAccountName,
      })

      const riskProfile = this.buildRiskProfileSnapshot(dto)
      await this.repo.upsertRiskProfile({
        strategyInstanceId: deployResult.strategyInstanceId,
        ...riskProfile,
      })
      await this.repo.markDeployRequestSucceeded(deployRequest.id, deployResult.strategyInstanceId)

      return this.getStrategyDetail(dto.userId, deployResult.strategyInstanceId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const code = error instanceof DomainException ? error.code : ErrorCode.BAD_REQUEST
      await this.repo.markDeployRequestFailed(deployRequest.id, String(code), message)
      throw error
    }
  }

  async deleteStrategy(userId: string, strategyInstanceId: string): Promise<void> {
    const row = await this.repo.findStrategyForUser(userId, strategyInstanceId)
    if (!row) {
      throw new StrategyNotFoundException({ strategyInstanceId })
    }

    const isOwner = row.createdBy === userId
    if (!isOwner) {
      throw new StrategyOwnerOnlyException({ userId, ownerId: row.createdBy })
    }

    await this.repo.deleteStrategyForUser(userId, strategyInstanceId)
  }

  private mapUiStatus(status: string): 'running' | 'stopped' | 'draft' {
    if (status === 'running') return 'running'
    if (status === 'draft') return 'draft'
    return 'stopped'
  }

  private isDeployRequestUniqueConflict(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2002'
    }
    if (typeof error === 'object' && error !== null && 'code' in error) {
      return (error as { code?: unknown }).code === 'P2002'
    }
    return false
  }

  private assertStrategyVisible<T extends { status?: string | null }>(
    row: { status: string; subscriptions?: T[] | null },
    strategyInstanceId: string,
  ): T {
    const sub = row.subscriptions?.[0]
    const isSubscribed = !!sub && sub.status === 'active'
    if (!isSubscribed || this.mapUiStatus(row.status) === 'draft') {
      throw new StrategyNotFoundException({ strategyInstanceId })
    }

    return sub
  }

  private buildDynamicParams(meta: {
    strategySchema: Record<string, unknown> | null
    mergedParams: Record<string, unknown>
    schemaVersion: string | null
  }): {
    paramSchema: Record<string, unknown> | null
    paramValues: Record<string, unknown> | null
    schemaVersion: string | null
  } {
    return {
      paramSchema: meta.strategySchema,
      paramValues: meta.strategySchema ? meta.mergedParams : null,
      schemaVersion: meta.strategySchema ? meta.schemaVersion : null,
    }
  }

  private resolveStrategySchema(source: unknown): Record<string, unknown> | null {
    const root = this.readRecord(source)
    if (!root) return null

    const template = this.readRecord(root.strategyTemplate)
    const candidates = [
      root.strategySchema,
      root.paramSchema,
      root.paramsSchema,
      template?.strategySchema,
      template?.paramSchema,
      template?.paramsSchema,
    ]

    for (const candidate of candidates) {
      const schema = this.readRecord(candidate)
      if (schema) return schema
    }
    return null
  }

  private resolveSchemaVersion(source: unknown): string | null {
    const root = this.readRecord(source)
    if (!root) return null

    const template = this.readRecord(root.strategyTemplate)
    const rootMeta = this.readRecord(root.metadata)
    const templateMeta = this.readRecord(template?.metadata)
    const candidates = [
      root.schemaVersion,
      root.strategySchemaVersion,
      root.paramSchemaVersion,
      rootMeta?.schemaVersion,
      template?.schemaVersion,
      template?.strategySchemaVersion,
      template?.paramSchemaVersion,
      template?.rulesVersion,
      templateMeta?.schemaVersion,
    ]

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate
      if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate)
    }
    return null
  }

  private readRecord(input: unknown): Record<string, unknown> | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null
    return input as Record<string, unknown>
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

  private pickStatsOrFallbackMetric(statsValue: number | null, fallbackValue: number | null): number | null {
    if (statsValue == null) return fallbackValue
    if (fallbackValue == null) return statsValue
    if (statsValue === 0 && fallbackValue !== 0) return fallbackValue
    return statsValue
  }

  private async buildAccountFallbackMetrics(userId: string, symbol: string | null): Promise<{
    returnPct: number | null
    winRatePct: number | null
    tradeCount: number | null
  } | null> {
    if (!symbol) return null

    const normalizedSymbol = symbol.split(':')[0]?.trim().toUpperCase()
    if (!normalizedSymbol) return null

    const repoAny = this.repo as any
    const findLatest = repoAny.findLatestExecutedAccountByUserAndSymbol as
      ((uid: string, s: string) => Promise<any>) | undefined
    const loadTradeStats = repoAny.loadTradeStats as
      ((accountId: string) => Promise<{ tradeCount: number; closedCount: number; winningCount: number }>) | undefined

    if (!findLatest || !loadTradeStats) return null

    const account = await findLatest.call(this.repo, userId, normalizedSymbol)
    if (!account) return null

    const tradeStats = await loadTradeStats.call(this.repo, account.id)
    const totalPnl = Number(account.totalRealizedPnl) + Number(account.totalUnrealizedPnl)
    const invested = Number(account.initialBalance)

    return {
      returnPct: invested > 0 ? Number(((totalPnl / invested) * 100).toFixed(2)) : 0,
      winRatePct: tradeStats.closedCount > 0
        ? Number(((tradeStats.winningCount / tradeStats.closedCount) * 100).toFixed(2))
        : 0,
      tradeCount: tradeStats.tradeCount,
    }
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

  private buildLatestOrders(
    trades: Array<{
      executedAt?: Date
      side?: string
      symbol?: string
      price?: unknown
      quantity?: unknown
      fee?: unknown
      feeCurrency?: string | null
      orderId?: string | null
    }>,
  ) {
    return trades
      .filter(trade => trade.executedAt instanceof Date && typeof trade.symbol === 'string' && typeof trade.side === 'string')
      .slice(0, 10)
      .map(trade => ({
        executedAt: trade.executedAt!.toISOString(),
        side: trade.side!,
        symbol: trade.symbol!,
        price: this.toFiniteNumber(trade.price),
        quantity: this.toFiniteNumber(trade.quantity),
        fee: this.toFiniteNumber(trade.fee),
        feeCurrency: trade.feeCurrency ?? null,
        orderId: trade.orderId ?? null,
      }))
  }

  private toFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'string' && value.trim().length === 0) return null
    const normalized = Number(value)
    return Number.isFinite(normalized) ? normalized : null
  }

  private readAccountBaseCurrency(account: unknown): string | null {
    const row = this.readRecord(account)
    if (!row) return 'USDT'
    const raw = row.baseCurrency
    return typeof raw === 'string' && raw.trim().length > 0 ? raw : 'USDT'
  }

  private buildIndustryEquitySeries(input: {
    initialBalance: number
    totalRealizedPnl: number
    totalUnrealizedPnl: number
    closedPositionRows: Array<{ openedAt: Date; closedAt: Date | null; realizedPnl: any }>
    startedAt: Date
    dailyRows: Array<{ date: Date; equityStart?: any; equityEnd: any }>
  }): Array<{ ts: string; value: number }> {
    const initial = Number.isFinite(input.initialBalance) ? input.initialBalance : 0
    const currentEquity = initial + input.totalRealizedPnl + input.totalUnrealizedPnl
    const startedAtMs = input.startedAt.getTime()
    const now = new Date()

    // 行业通用口径优先使用账户权益时间序列（按时间顺序、峰值到谷值计算最大回撤）
    const dailyPoints = input.dailyRows
      .filter(item => item.date.getTime() >= startedAtMs)
      .map(item => ({
        ts: item.date.toISOString(),
        value: Number(item.equityEnd),
      }))
      .filter(item => Number.isFinite(item.value))

    if (dailyPoints.length > 0) {
      dailyPoints.push({
        ts: now.toISOString(),
        value: Number(currentEquity.toFixed(8)),
      })
      return this.normalizeEquitySeries(dailyPoints)
    }

    // 没有日度权益时，再按平仓事件累计构造；并过滤策略启动前历史成交，避免跨策略污染
    const points: Array<{ ts: string; value: number }> = [{
      ts: input.startedAt.toISOString(),
      value: Number(initial.toFixed(8)),
    }]

    let runningEquity = initial
    for (const row of input.closedPositionRows) {
      const at = row.closedAt ?? row.openedAt
      if (at.getTime() < startedAtMs) continue
      runningEquity += Number(row.realizedPnl ?? 0)
      points.push({
        ts: at.toISOString(),
        value: Number(runningEquity.toFixed(8)),
      })
    }

    points.push({
      ts: now.toISOString(),
      value: Number(currentEquity.toFixed(8)),
    })

    return this.normalizeEquitySeries(points)
  }

  private normalizeEquitySeries(series: Array<{ ts: string; value: number }>): Array<{ ts: string; value: number }> {
    if (series.length === 0) return []

    const sorted = [...series]
      .filter(item => Number.isFinite(item.value))
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

    const dedup: Array<{ ts: string; value: number }> = []
    for (const point of sorted) {
      const last = dedup[dedup.length - 1]
      if (last && last.ts === point.ts) {
        last.value = point.value
        continue
      }
      dedup.push({
        ts: point.ts,
        value: Number(point.value.toFixed(8)),
      })
    }

    return dedup
  }

  private computeMaxDrawdownPct(series: Array<{ ts: string; value: number }>): number {
    if (series.length === 0) return 0
    let peak = series[0].value
    let maxDrawdown = 0
    for (const point of series) {
      if (point.value > peak) peak = point.value
      if (peak <= 0) continue
      const drawdownPct = ((peak - point.value) / peak) * 100
      if (drawdownPct > maxDrawdown) {
        maxDrawdown = drawdownPct
      }
    }
    return Number(maxDrawdown.toFixed(2))
  }

  private calculateTodayPnl(
    totalUnrealizedPnl: number,
    closedPositionRows: Array<{ closedAt: Date | null; realizedPnl: any }>,
  ): number {
    const startUtcDay = new Date()
    startUtcDay.setUTCHours(0, 0, 0, 0)
    const endUtcDay = new Date(startUtcDay.getTime() + 24 * 60 * 60 * 1000)

    const realizedToday = closedPositionRows
      .filter(row => row.closedAt && row.closedAt >= startUtcDay && row.closedAt < endUtcDay)
      .reduce((acc, row) => acc + Number(row.realizedPnl ?? 0), 0)

    return Number((realizedToday + totalUnrealizedPnl).toFixed(8))
  }

  private hashDeployPayload(dto: AccountStrategyDeployDto): string {
    return createHash('sha256')
      .update(JSON.stringify({
        name: dto.name,
        exchange: dto.exchange ?? null,
        symbol: dto.symbol ?? null,
        timeframe: dto.timeframe ?? null,
        positionPct: dto.positionPct ?? null,
        exchangeAccountId: dto.exchangeAccountId ?? null,
        strategyInstanceId: dto.strategyInstanceId ?? null,
        mode: dto.mode ?? null,
      }))
      .digest('hex')
  }

  private buildRiskProfileSnapshot(dto: AccountStrategyDeployDto) {
    const config = this.getSignalsConfig().execution
    const adminPerOrderMaxQuote = new Prisma.Decimal(config.defaultQuoteAmount)
    const adminDailyMaxQuote = adminPerOrderMaxQuote.mul(50)
    const adminMaxRiskFractionCap = new Prisma.Decimal(config.maxRiskFraction)

    const userPerOrderMaxQuote = new Prisma.Decimal(
      typeof dto.userPerOrderMaxQuote === 'number' && dto.userPerOrderMaxQuote > 0
        ? dto.userPerOrderMaxQuote
        : adminPerOrderMaxQuote,
    )
    const userDailyMaxQuote = new Prisma.Decimal(
      typeof dto.userDailyMaxQuote === 'number' && dto.userDailyMaxQuote > 0
        ? dto.userDailyMaxQuote
        : adminDailyMaxQuote,
    )
    const userMaxRiskFraction = new Prisma.Decimal(
      typeof dto.userMaxRiskFraction === 'number' && dto.userMaxRiskFraction > 0
        ? dto.userMaxRiskFraction
        : adminMaxRiskFractionCap,
    )

    return {
      adminPerOrderMaxQuote,
      adminDailyMaxQuote,
      adminMaxRiskFractionCap,
      userPerOrderMaxQuote,
      userDailyMaxQuote,
      userMaxRiskFraction,
      effectivePerOrderMaxQuote: Prisma.Decimal.min(adminPerOrderMaxQuote, userPerOrderMaxQuote),
      effectiveDailyMaxQuote: Prisma.Decimal.min(adminDailyMaxQuote, userDailyMaxQuote),
      effectiveMaxRiskFraction: Prisma.Decimal.min(adminMaxRiskFractionCap, userMaxRiskFraction),
    }
  }

  private getSignalsConfig(): StrategySignalsRuntimeConfig {
    return this.configService?.get<StrategySignalsRuntimeConfig>('strategySignals')
      ?? DEFAULT_STRATEGY_SIGNALS_CONFIG
  }

  private async resolveDeployPayload(dto: AccountStrategyDeployDto): Promise<{
    exchange: 'binance' | 'okx' | 'hyperliquid'
    symbol: string
    timeframe: string
    positionPct: number
  }> {
    let fallbackParams: Record<string, unknown> = {}

    if (dto.strategyInstanceId) {
      const row = await this.repo.findStrategyForUser(dto.userId!, dto.strategyInstanceId)
      fallbackParams = {
        ...(row?.strategyTemplate?.defaultParams as Record<string, unknown> ?? {}),
        ...(row?.params as Record<string, unknown> ?? {}),
        ...(row?.subscriptions?.[0]?.customParams as Record<string, unknown> ?? {}),
      }
    }

    const exchange = (dto.exchange
      || this.readString(fallbackParams, ['exchange', 'exchangeId', 'provider'])) as
      | 'binance'
      | 'okx'
      | 'hyperliquid'
      | null
    const symbol = dto.symbol || this.readString(fallbackParams, ['symbol'])
    const timeframe = dto.timeframe || this.readString(fallbackParams, ['timeframe', 'period'])
    const positionPct = dto.positionPct ?? this.readNumber(fallbackParams, ['positionPct', 'positionSizeRatioPercent'])

    if (!exchange || !symbol || !timeframe || positionPct === null) {
      throw new DomainException('account_strategy.deploy_missing_required_fields', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: {
          exchange,
          symbol,
          timeframe,
          positionPct,
          strategyInstanceId: dto.strategyInstanceId ?? null,
        },
      })
    }

    return { exchange, symbol, timeframe, positionPct }
  }
}
