import type { AccountStrategyActionDto } from '../dto/account-strategy-action.dto'
import type { AccountStrategyDeployDto } from '../dto/account-strategy-deploy.dto'
import type { AccountStrategyDetailResponseDto, AccountStrategyTimelineEventDto } from '../dto/account-strategy-detail.response.dto'
import type { AccountStrategyListItemDto } from '../dto/account-strategy-list-item.dto'
import type { AccountStrategyListQueryDto } from '../dto/account-strategy-list-query.dto'
import type { StrategySignalsRuntimeConfig } from '@/modules/strategy-signals/types/strategy-signals-config.type'
import type { ExchangeId, MarketType, UnifiedBalance } from '@/modules/trading/core/types'
import { createHash } from 'node:crypto'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Optional } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { ConfigService } from '@nestjs/config'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { PublishedStrategySnapshotsRepository } from '@/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { MarketDataIngestionService } from '@/modules/market-data/services/market-data-ingestion.service'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { MarketDataReadGateway } from '@/modules/market-data/services/market-data-read.gateway'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { StrategyInstanceStatsService } from '@/modules/strategy-instances/services/strategy-instance-stats.service'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { StrategyInstancesService } from '@/modules/strategy-instances/services/strategy-instances.service'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '@/modules/strategy-signals/types/strategy-signals-config.type'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { TradingService } from '@/modules/trading/trading.service'
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
  private static readonly BEST_EFFORT_EXTERNAL_TIMEOUT_MS = 1_500

  constructor(
    private readonly repo: AccountStrategyViewRepository,
    private readonly statsService: StrategyInstanceStatsService,
    private readonly strategyInstancesService: StrategyInstancesService,
    private readonly marketDataIngestionService: MarketDataIngestionService,
    @Optional() private readonly marketDataReadGateway?: MarketDataReadGateway,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly tradingService?: TradingService,
    @Optional() private readonly publishedSnapshotsRepository?: PublishedStrategySnapshotsRepository,
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
          (item as { strategyTemplateId?: string | null }).strategyTemplateId ?? null,
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
    const strategySchema = this.resolveStrategySchema(row)
    const schemaVersion = this.resolveSchemaVersion(row)
    const dynamicParams = this.buildDynamicParams({
      strategySchema,
      mergedParams,
      schemaVersion,
    })
    const detailSnapshot = await this.resolveDetailSnapshotView({
      userId,
      row,
      strategySchema,
      schemaVersion,
    })

    const symbol = this.readString(mergedParams, ['symbol'])
    const normalizedSymbol = symbol?.split(':')[0] ?? null
    const exchangeId = this.resolveExchangeId(
      this.readString(mergedParams, ['exchange', 'provider', 'exchangeId'])
        ?? sub?.exchangeAccount?.exchangeId
        ?? null,
    )
    const marketType = this.resolveMarketType(mergedParams, symbol, exchangeId)

    const account = await this.repo.findUserStrategyAccount(userId, row.strategyTemplateId)
      ?? (normalizedSymbol
        ? await this.repo.findLatestExecutedAccountByUserAndSymbol(userId, normalizedSymbol)
        : null)
    const equityRows = account
      ? await this.repo.loadEquitySeries(account.id)
      : []
    const latestDailySnapshot = account && typeof (this.repo as any).loadLatestDailySnapshot === 'function'
      ? await (this.repo as any).loadLatestDailySnapshot(account.id)
      : this.getLatestDailySnapshotFromSeries(equityRows)
    const closedPositionRows = account && typeof (this.repo as any).loadClosedPositionPnlSeries === 'function'
      ? await (this.repo as any).loadClosedPositionPnlSeries(account.id)
      : []
    const positionFinancials = account && typeof (this.repo as any).loadPositionFinancials === 'function'
      ? await (this.repo as any).loadPositionFinancials(account.id)
      : null
    const openPositionsForValuation = account && typeof (this.repo as any).loadOpenPositionsForValuation === 'function'
      ? await (this.repo as any).loadOpenPositionsForValuation(account.id)
      : []
    const tradeStats = account
      ? await this.repo.loadTradeStats(account.id)
      : { tradeCount: 0, closedCount: 0, winningCount: 0 }
    const positionOverview = account
      ? await this.repo.loadPositionOverview(account.id)
      : { openCount: 0, closedCount: 0 }
    const hasLocalActivity = this.hasLocalStrategyActivity({
      account,
      tradeStats,
      positionOverview,
    })
    const timelineSource = await this.repo.loadTimeline(
      userId,
      strategyInstanceId,
      account?.id,
    )

    const stats = await this.statsService.calculateStats(strategyInstanceId).catch(() => null)
    const livePositionFinancials = account
      ? await this.resolveLivePositionFinancials(openPositionsForValuation, positionFinancials)
      : null
    const resolvedRealizedPnl = account
      ? this.resolveAccountRealizedPnl(account, livePositionFinancials ?? positionFinancials)
      : null
    const resolvedUnrealizedPnl = account
      ? this.resolveAccountUnrealizedPnl(account, livePositionFinancials ?? positionFinancials)
      : null
    const resolvedAvailableBalance = account
      ? this.resolveAccountAvailableBalance(account, livePositionFinancials ?? positionFinancials)
      : null
    const resolvedTotalEquity = account
      ? this.resolveAccountEquity(account, livePositionFinancials ?? positionFinancials)
      : null
    const exchangeBalance = exchangeId
      ? await this.resolveExchangeBalanceSnapshot({
          userId,
          exchangeId,
          marketType,
          exchangeAccountId: sub?.exchangeAccount?.id ?? null,
          preferredAsset: account
            ? this.readAccountBaseCurrency(account)
            : this.resolvePreferredQuoteAsset(symbol),
        })
      : null
    const shouldUseExchangeBalance = !!exchangeBalance && !hasLocalActivity
    const shouldSeedInitialBalanceFromExchange = shouldUseExchangeBalance && this.isDefaultSeedAccount(account)
    const overviewInitialBalance = shouldSeedInitialBalanceFromExchange
      ? exchangeBalance.total
      : (account ? this.toFiniteNumber(account.initialBalance) : exchangeBalance?.total ?? null)
    const overviewTotalEquity = shouldUseExchangeBalance
      ? exchangeBalance.total
      : resolvedTotalEquity
    const overviewAvailableBalance = shouldUseExchangeBalance
      ? exchangeBalance.free
      : resolvedAvailableBalance
    const overviewBaseCurrency = shouldUseExchangeBalance
      ? exchangeBalance.asset
      : (account ? this.readAccountBaseCurrency(account) : exchangeBalance?.asset ?? null)
    const totalPnl = account
      ? (resolvedRealizedPnl ?? 0) + (resolvedUnrealizedPnl ?? 0)
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
          initialBalance: overviewInitialBalance ?? Number(account.initialBalance),
          totalRealizedPnl: resolvedRealizedPnl ?? 0,
          totalUnrealizedPnl: resolvedUnrealizedPnl ?? 0,
          closedPositionRows,
          startedAt: lifecycleStartAt,
          dailyRows: equityRows,
          currentEquity: shouldUseExchangeBalance
            ? overviewTotalEquity
            : resolvedTotalEquity,
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
          overviewTotalEquity,
          shouldUseExchangeBalance ? null : latestDailySnapshot,
          resolvedUnrealizedPnl ?? 0,
          closedPositionRows,
        )
      : this.readStatsNumber(stats, 'todayPnl') ?? totalPnl
    const resolvedSnapshot = await this.resolveBoundSnapshotDetail({
      userId,
      source: row,
    })

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
        publishedSnapshotId: resolvedSnapshot.publishedSnapshotId,
        snapshotHash: resolvedSnapshot.snapshotHash,
        exchange: resolvedSnapshot.paramValues
          ? this.readString(resolvedSnapshot.paramValues, ['exchange', 'provider', 'exchangeId'])
          : null,
        symbol: resolvedSnapshot.paramValues
          ? this.readString(resolvedSnapshot.paramValues, ['symbol'])
          : null,
        timeframe: resolvedSnapshot.paramValues
          ? this.readString(resolvedSnapshot.paramValues, ['timeframe', 'period'])
          : null,
        positionPct: resolvedSnapshot.paramValues
          ? this.readNumber(resolvedSnapshot.paramValues, ['positionPct', 'positionSizeRatioPercent'])
          : null,
        paramSchema: dynamicParams.paramSchema,
        paramValues: resolvedSnapshot.paramValues,
        schemaVersion: dynamicParams.schemaVersion,
        deployAccountName: sub?.exchangeAccount?.name ?? null,
        deployAt: sub?.subscribedAt?.toISOString() ?? row.startedAt?.toISOString() ?? null,
      },
      timeline: this.buildMixedTimeline(timelineSource),
      accountOverview: {
        initialBalance: overviewInitialBalance,
        totalEquity: overviewTotalEquity,
        availableBalance: overviewAvailableBalance,
        totalPnl: totalPnl ?? null,
        todayPnl: todayPnl ?? null,
        baseCurrency: overviewBaseCurrency,
      },
      positionOverview: {
        openPositionsCount: account ? positionOverview.openCount : null,
        closedPositionsCount: account ? positionOverview.closedCount : null,
        totalRealizedPnl: account ? resolvedRealizedPnl : null,
        totalUnrealizedPnl: account ? resolvedUnrealizedPnl : null,
      },
      latestOrders: this.buildLatestOrders(timelineSource.trades),
    }

    if (detail.equitySeries.length === 0 && account) {
      detail.equitySeries = [{
        ts: new Date().toISOString(),
        value: shouldUseExchangeBalance
          ? overviewTotalEquity
          : (resolvedTotalEquity ?? (
              Number(account.initialBalance) + (resolvedRealizedPnl ?? 0) + (resolvedUnrealizedPnl ?? 0)
            )),
      }]
    }

    return detail
  }

  private async resolveBoundSnapshotDetail(input: {
    userId: string
    source: unknown
  }): Promise<{
    publishedSnapshotId: string | null
    snapshotHash: string | null
    paramValues: Record<string, unknown> | null
  }> {
    const root = this.readRecord(input.source)
    const metadata = this.readRecord(root?.metadata)
    const boundPublishedSnapshotId = typeof metadata?.publishedSnapshotId === 'string' && metadata.publishedSnapshotId.trim().length > 0
      ? metadata.publishedSnapshotId.trim()
      : null
    const boundSnapshotHash = typeof metadata?.snapshotHash === 'string' && metadata.snapshotHash.trim().length > 0
      ? metadata.snapshotHash.trim()
      : null

    if (!boundPublishedSnapshotId || !this.publishedSnapshotsRepository) {
      return {
        publishedSnapshotId: boundPublishedSnapshotId,
        snapshotHash: boundSnapshotHash,
        paramValues: null,
      }
    }

    const snapshot = await this.publishedSnapshotsRepository.findByIdForUser(boundPublishedSnapshotId, input.userId)
    if (!snapshot) {
      return {
        publishedSnapshotId: boundPublishedSnapshotId,
        snapshotHash: boundSnapshotHash,
        paramValues: null,
      }
    }

    if (boundSnapshotHash && snapshot.snapshotHash !== boundSnapshotHash) {
      return {
        publishedSnapshotId: boundPublishedSnapshotId,
        snapshotHash: boundSnapshotHash,
        paramValues: null,
      }
    }

    const paramValues = {
      ...(this.readRecord(snapshot.paramsSnapshot) ?? {}),
      ...(this.readRecord(snapshot.lockedParams) ?? {}),
    }

    return {
      publishedSnapshotId: snapshot.id,
      snapshotHash: snapshot.snapshotHash,
      paramValues: Object.keys(paramValues).length > 0 ? paramValues : null,
    }
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
    const exchangeBalance = dto.exchangeAccountId && this.tradingService
      ? await this.resolveExchangeBalanceSnapshot({
          userId: dto.userId,
          exchangeId: resolvedDeploy.exchange,
          marketType: this.resolveMarketType(
            { exchange: resolvedDeploy.exchange },
            resolvedDeploy.symbol,
            resolvedDeploy.exchange,
          ),
          exchangeAccountId: dto.exchangeAccountId,
          preferredAsset: this.resolvePreferredQuoteAsset(resolvedDeploy.symbol),
        })
      : null

    try {
      await this.marketDataIngestionService.ensureSymbolsSubscribed([resolvedDeploy.symbol])

      const deployResult = await this.repo.deployStrategyForUser({
        userId: dto.userId,
        name: dto.name,
        exchange: resolvedDeploy.exchange,
        symbol: resolvedDeploy.symbol,
        timeframe: resolvedDeploy.timeframe,
        positionPct: resolvedDeploy.positionPct,
        publishedSnapshotBinding: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: resolvedDeploy.publishedSnapshotId,
          snapshotHash: resolvedDeploy.snapshotHash,
          sourceStrategyInstanceId: resolvedDeploy.sourceStrategyInstanceId ?? dto.strategyInstanceId ?? null,
          sourceStrategyTemplateId: resolvedDeploy.sourceStrategyTemplateId,
        },
        initialBalanceQuote: exchangeBalance?.total,
        accountBalanceQuote: exchangeBalance?.free,
        mode: dto.mode,
        strategyInstanceId: dto.strategyInstanceId ?? resolvedDeploy.sourceStrategyInstanceId ?? undefined,
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

  private async buildAccountFallbackMetrics(userId: string, strategyTemplateId: string | null): Promise<{
    returnPct: number | null
    winRatePct: number | null
    tradeCount: number | null
  } | null> {
    if (!strategyTemplateId) return null

    const repoAny = this.repo as any
    const findExact = repoAny.findUserStrategyAccount as
      ((uid: string, strategyId: string) => Promise<any>) | undefined
    const loadTradeStats = repoAny.loadTradeStats as
      ((accountId: string) => Promise<{ tradeCount: number; closedCount: number; winningCount: number }>) | undefined

    if (!findExact || !loadTradeStats) return null

    const account = await findExact.call(this.repo, userId, strategyTemplateId)
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
    currentEquity?: number | null
  }): Array<{ ts: string; value: number }> {
    const initial = Number.isFinite(input.initialBalance) ? input.initialBalance : 0
    const currentEquity = input.currentEquity ?? (initial + input.totalRealizedPnl + input.totalUnrealizedPnl)
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
    currentEquity: number | null,
    latestDailySnapshot: { date: Date; equityStart?: any } | null,
    totalUnrealizedPnl: number,
    closedPositionRows: Array<{ closedAt: Date | null; realizedPnl: any }>,
  ): number {
    const startUtcDay = this.startOfUtcDay(new Date())
    const latestDailyStart = latestDailySnapshot
      && this.startOfUtcDay(latestDailySnapshot.date).getTime() === startUtcDay.getTime()
      ? this.toFiniteNumber(latestDailySnapshot.equityStart)
      : null

    if (currentEquity !== null && latestDailyStart !== null) {
      return Number((currentEquity - latestDailyStart).toFixed(8))
    }

    const endUtcDay = new Date(startUtcDay.getTime() + 24 * 60 * 60 * 1000)

    const realizedToday = closedPositionRows
      .filter(row => row.closedAt && row.closedAt >= startUtcDay && row.closedAt < endUtcDay)
      .reduce((acc, row) => acc + Number(row.realizedPnl ?? 0), 0)

    return Number((realizedToday + totalUnrealizedPnl).toFixed(8))
  }

  private async resolveLivePositionFinancials(
    openPositions: Array<{
      symbol?: unknown
      positionSide?: unknown
      quantity?: unknown
      avgEntryPrice?: unknown
      unrealizedPnl?: unknown
    }>,
    fallbackFinancials: {
      openCostBasis?: unknown
      totalRealizedPnl?: unknown
      totalUnrealizedPnl?: unknown
    } | null,
  ): Promise<{
    openCostBasis?: unknown
    totalRealizedPnl?: unknown
    totalUnrealizedPnl?: unknown
  } | null> {
    if (!openPositions.length || !this.marketDataReadGateway) return fallbackFinancials

    const uniqueSymbols = [...new Set(openPositions
      .map(position => typeof position.symbol === 'string' ? position.symbol.trim().toUpperCase() : '')
      .filter(Boolean))]

    if (!uniqueSymbols.length) return fallbackFinancials

    const latestQuotes = new Map<string, number>()
    await Promise.all(uniqueSymbols.map(async (symbol) => {
      try {
        const quote = await this.marketDataReadGateway!.getLatestQuote(symbol)
        const lastPrice = Number(quote.lastPrice)
        if (Number.isFinite(lastPrice)) {
          latestQuotes.set(symbol, lastPrice)
        }
      } catch {
        // Detail view should degrade gracefully when quote snapshots are temporarily unavailable.
      }
    }))

    if (!latestQuotes.size) return fallbackFinancials

    let totalUnrealizedPnl = 0
    let openCostBasis = 0
    for (const position of openPositions) {
      const symbol = typeof position.symbol === 'string' ? position.symbol.trim().toUpperCase() : ''
      const markPrice = latestQuotes.get(symbol)
      const quantity = this.toFiniteNumber(position.quantity)
      const avgEntryPrice = this.toFiniteNumber(position.avgEntryPrice)
      if (!symbol || markPrice == null || quantity == null || avgEntryPrice == null) {
        totalUnrealizedPnl += this.toFiniteNumber(position.unrealizedPnl) ?? 0
        openCostBasis += (quantity ?? 0) * (avgEntryPrice ?? 0)
        continue
      }

      const side = position.positionSide === 'SHORT' ? -1 : 1
      totalUnrealizedPnl += (markPrice - avgEntryPrice) * quantity * side
      openCostBasis += quantity * avgEntryPrice
    }

    return {
      openCostBasis,
      totalRealizedPnl: fallbackFinancials?.totalRealizedPnl,
      totalUnrealizedPnl: Number(totalUnrealizedPnl.toFixed(8)),
    }
  }

  private resolveAccountRealizedPnl(
    account: unknown,
    positionFinancials: {
      openCostBasis?: unknown
      totalRealizedPnl?: unknown
      totalUnrealizedPnl?: unknown
    } | null,
  ): number {
    const positionRealized = this.toFiniteNumber(positionFinancials?.totalRealizedPnl)
    const accountRealized = this.toFiniteNumber(this.readRecord(account)?.totalRealizedPnl)
    if (this.shouldPreferAccountAggregateField(account, positionFinancials, 'totalRealizedPnl')) {
      return accountRealized ?? 0
    }
    if (positionRealized !== null) return positionRealized
    return accountRealized ?? 0
  }

  private resolveAccountUnrealizedPnl(
    account: unknown,
    positionFinancials: {
      openCostBasis?: unknown
      totalRealizedPnl?: unknown
      totalUnrealizedPnl?: unknown
    } | null,
  ): number {
    const positionUnrealized = this.toFiniteNumber(positionFinancials?.totalUnrealizedPnl)
    const accountUnrealized = this.toFiniteNumber(this.readRecord(account)?.totalUnrealizedPnl)
    if (this.shouldPreferAccountAggregateField(account, positionFinancials, 'totalUnrealizedPnl')) {
      return accountUnrealized ?? 0
    }
    if (positionUnrealized !== null) return positionUnrealized
    return accountUnrealized ?? 0
  }

  private resolveAccountEquity(
    account: unknown,
    positionFinancials: {
      openCostBasis?: unknown
      totalRealizedPnl?: unknown
      totalUnrealizedPnl?: unknown
    } | null,
  ): number | null {
    const row = this.readRecord(account)
    if (!row) return null

    const initialBalance = this.toFiniteNumber(row.initialBalance)
    const realizedPnl = this.resolveAccountRealizedPnl(account, positionFinancials)
    const unrealizedPnl = this.resolveAccountUnrealizedPnl(account, positionFinancials)

    if (initialBalance !== null) {
      return Number((initialBalance + realizedPnl + unrealizedPnl).toFixed(8))
    }

    const balance = this.resolveAccountAvailableBalance(account, positionFinancials)
    if (balance === null) return this.toFiniteNumber(row.equity)

    const openCostBasis = this.toFiniteNumber(positionFinancials?.openCostBasis) ?? 0
    return Number((balance + openCostBasis + unrealizedPnl).toFixed(8))
  }

  private resolveAccountAvailableBalance(
    account: unknown,
    positionFinancials: {
      openCostBasis?: unknown
      totalRealizedPnl?: unknown
      totalUnrealizedPnl?: unknown
    } | null,
  ): number | null {
    const row = this.readRecord(account)
    if (!row) return null

    const initialBalance = this.toFiniteNumber(row.initialBalance)
    if (initialBalance !== null) {
      const realizedPnl = this.resolveAccountRealizedPnl(account, positionFinancials)
      const openCostBasis = this.toFiniteNumber(positionFinancials?.openCostBasis) ?? 0
      return Number((initialBalance + realizedPnl - openCostBasis).toFixed(8))
    }

    return this.toFiniteNumber(row.balance ?? row.equity)
  }

  private shouldPreferAccountAggregateField(
    account: unknown,
    positionFinancials: {
      openCostBasis?: unknown
      totalRealizedPnl?: unknown
      totalUnrealizedPnl?: unknown
    } | null,
    field: 'totalRealizedPnl' | 'totalUnrealizedPnl',
  ): boolean {
    if (!positionFinancials) return false

    const positionRealized = this.toFiniteNumber(positionFinancials.totalRealizedPnl)
    const positionUnrealized = this.toFiniteNumber(positionFinancials.totalUnrealizedPnl)
    const openCostBasis = this.toFiniteNumber(positionFinancials.openCostBasis)

    if (positionRealized !== 0 || positionUnrealized !== 0 || openCostBasis !== 0) {
      return false
    }

    const accountRow = this.readRecord(account)
    if (!accountRow) return false

    const accountValue = this.toFiniteNumber(accountRow[field])
    return accountValue !== null && accountValue !== 0
  }

  private hasLocalStrategyActivity(input: {
    account: unknown
    tradeStats: { tradeCount: number; closedCount: number; winningCount: number }
    positionOverview: { openCount: number; closedCount: number }
  }): boolean {
    const row = this.readRecord(input.account)
    const realizedPnl = this.toFiniteNumber(row?.totalRealizedPnl) ?? 0
    const unrealizedPnl = this.toFiniteNumber(row?.totalUnrealizedPnl) ?? 0

    return input.tradeStats.tradeCount > 0
      || input.positionOverview.openCount > 0
      || input.positionOverview.closedCount > 0
      || realizedPnl !== 0
      || unrealizedPnl !== 0
  }

  private getLatestDailySnapshotFromSeries(
    dailyRows: Array<{ date: Date; equityStart?: any }>,
  ): { date: Date; equityStart?: any } | null {
    const rows = dailyRows
      .filter(row => row.date instanceof Date && Number.isFinite(row.date.getTime()))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
    return rows[0] ?? null
  }

  private isDefaultSeedAccount(account: unknown): boolean {
    if (!account) return true

    const row = this.readRecord(account)
    if (!row) return false

    const initialBalance = this.toFiniteNumber(row.initialBalance)
    const balance = this.toFiniteNumber(row.balance)
    const equity = this.toFiniteNumber(row.equity)
    const realizedPnl = this.toFiniteNumber(row.totalRealizedPnl) ?? 0
    const unrealizedPnl = this.toFiniteNumber(row.totalUnrealizedPnl) ?? 0

    return initialBalance === 1000
      && (balance === null || balance === 1000)
      && (equity === null || equity === 1000)
      && realizedPnl === 0
      && unrealizedPnl === 0
  }

  private resolveExchangeId(value: string | null): ExchangeId | null {
    if (value === 'binance' || value === 'okx' || value === 'hyperliquid') {
      return value
    }
    return null
  }

  private resolveMarketType(
    mergedParams: Record<string, unknown>,
    symbol: string | null,
    exchangeId: ExchangeId | null,
  ): MarketType {
    const raw = this.readString(mergedParams, ['marketType', 'instrumentType'])
    if (raw === 'spot' || raw === 'perp') return raw
    if (symbol?.includes(':') || symbol?.toUpperCase().includes('SWAP')) return 'perp'
    if (exchangeId === 'hyperliquid') return 'perp'
    return 'spot'
  }

  private resolvePreferredQuoteAsset(symbol: string | null): string | null {
    if (!symbol) return 'USDT'

    const normalized = symbol.trim().toUpperCase()
    if (normalized.endsWith('USDT')) return 'USDT'
    if (normalized.endsWith('USDC')) return 'USDC'

    const parts = normalized.split(/[/:-]/).filter(Boolean)
    return parts[1] ?? 'USDT'
  }

  private async resolveExchangeBalanceSnapshot(input: {
    userId: string
    exchangeId: ExchangeId
    marketType: MarketType
    exchangeAccountId: string | null
    preferredAsset: string | null
  }): Promise<{ asset: string; free: number; total: number } | null> {
    if (!this.tradingService) return null

    try {
      const balances = await this.withBestEffortTimeout(
        this.tradingService.getBalance(
          input.userId,
          input.exchangeId,
          input.marketType,
          input.exchangeAccountId ?? undefined,
        ),
      )

      return this.pickExchangeBalance(balances, input.preferredAsset)
    } catch {
      return null
    }
  }

  private async withBestEffortTimeout<T>(promise: Promise<T>): Promise<T> {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('best effort timeout')), AccountStrategyViewService.BEST_EFFORT_EXTERNAL_TIMEOUT_MS)
      }),
    ])
  }

  private pickExchangeBalance(
    balances: UnifiedBalance[],
    preferredAsset: string | null,
  ): { asset: string; free: number; total: number } | null {
    if (!Array.isArray(balances) || balances.length === 0) return null

    const normalizedPreferredAsset = preferredAsset?.trim().toUpperCase() ?? 'USDT'
    const preferred = balances.find(balance => balance.asset?.trim().toUpperCase() === normalizedPreferredAsset)
    if (preferred) {
      return {
        asset: preferred.asset,
        free: preferred.free,
        total: preferred.total,
      }
    }
    return null
  }

  private startOfUtcDay(date: Date): Date {
    const start = new Date(date)
    start.setUTCHours(0, 0, 0, 0)
    return start
  }

  private hashDeployPayload(dto: AccountStrategyDeployDto): string {
    return createHash('sha256')
      .update(JSON.stringify({
        name: dto.name,
        publishedSnapshotId: dto.publishedSnapshotId,
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
    publishedSnapshotId: string
    snapshotHash: string
    sourceStrategyInstanceId: string | null
    sourceStrategyTemplateId: string | null
  }> {
    if (!this.publishedSnapshotsRepository) {
      throw new DomainException('account_strategy.deploy_snapshot_repository_unavailable', {
        code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
        status: HttpStatus.SERVICE_UNAVAILABLE,
      })
    }

    const publishedSnapshotId = dto.publishedSnapshotId?.trim() ?? ''
    if (!publishedSnapshotId) {
      throw new DomainException('account_strategy.deploy_missing_required_fields', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: {
          exchange: null,
          symbol: null,
          timeframe: null,
          positionPct: null,
          strategyInstanceId: dto.strategyInstanceId ?? null,
          publishedSnapshotId: null,
        },
      })
    }

    const snapshot = await this.publishedSnapshotsRepository.findByIdForUser(publishedSnapshotId, dto.userId!)
    if (!snapshot) {
      throw new DomainException('account_strategy.published_snapshot_not_found', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { publishedSnapshotId },
      })
    }

    const snapshotParams = this.resolveSnapshotParamsForDeploy(snapshot)
    const exchange = this.readString(snapshotParams, ['exchange', 'exchangeId', 'provider']) as
      | 'binance'
      | 'okx'
      | 'hyperliquid'
      | null
    const symbol = this.readString(snapshotParams, ['symbol'])
    const timeframe = this.readString(snapshotParams, ['timeframe', 'period'])
    const positionPct = this.readNumber(snapshotParams, ['positionPct', 'positionSizeRatioPercent'])

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
          publishedSnapshotId,
        },
      })
    }

    return {
      exchange,
      symbol,
      timeframe,
      positionPct,
      publishedSnapshotId: snapshot.id,
      snapshotHash: snapshot.snapshotHash,
      sourceStrategyInstanceId: snapshot.strategyInstanceId,
      sourceStrategyTemplateId: snapshot.strategyTemplateId,
    }
  }

  private async resolveDetailSnapshotView(input: {
    userId: string
    row: unknown
    strategySchema: Record<string, unknown> | null
    schemaVersion: string | null
  }): Promise<{
    publishedSnapshotId: string | null
    snapshotHash: string | null
    snapshotParams: Record<string, unknown> | null
    dynamicParams: {
      paramSchema: Record<string, unknown> | null
      paramValues: Record<string, unknown> | null
      schemaVersion: string | null
    }
  }> {
    const binding = this.readStrategySnapshotBinding(input.row)
    const emptyDynamicParams = this.buildDynamicParams({
      strategySchema: input.strategySchema,
      mergedParams: {},
      schemaVersion: input.schemaVersion,
    })

    if (!binding.publishedSnapshotId || !this.publishedSnapshotsRepository) {
      return {
        publishedSnapshotId: binding.publishedSnapshotId,
        snapshotHash: binding.snapshotHash,
        snapshotParams: null,
        dynamicParams: emptyDynamicParams,
      }
    }

    const snapshot = await this.publishedSnapshotsRepository.findByIdForUser(binding.publishedSnapshotId, input.userId)
    if (!snapshot) {
      return {
        publishedSnapshotId: binding.publishedSnapshotId,
        snapshotHash: binding.snapshotHash,
        snapshotParams: null,
        dynamicParams: emptyDynamicParams,
      }
    }

    try {
      const snapshotParams = this.resolveSnapshotParamsForDeploy(snapshot)
      return {
        publishedSnapshotId: snapshot.id,
        snapshotHash: snapshot.snapshotHash,
        snapshotParams,
        dynamicParams: this.buildDynamicParams({
          strategySchema: input.strategySchema,
          mergedParams: snapshotParams,
          schemaVersion: input.schemaVersion,
        }),
      }
    } catch {
      return {
        publishedSnapshotId: snapshot.id,
        snapshotHash: snapshot.snapshotHash,
        snapshotParams: null,
        dynamicParams: emptyDynamicParams,
      }
    }
  }

  private readStrategySnapshotBinding(source: unknown): {
    publishedSnapshotId: string | null
    snapshotHash: string | null
  } {
    const root = this.readRecord(source)
    const metadata = this.readRecord(root?.metadata)
    return {
      publishedSnapshotId: this.normalizeOptionalString(metadata?.publishedSnapshotId),
      snapshotHash: this.normalizeOptionalString(metadata?.snapshotHash),
    }
  }

  private normalizeOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  private resolveSnapshotParamsForDeploy(snapshot: {
    id: string
    paramsSnapshot: unknown
    lockedParams: unknown
  }): Record<string, unknown> {
    const paramsSnapshot = this.readRecord(snapshot.paramsSnapshot)
    const lockedParams = this.readRecord(snapshot.lockedParams)
    const merged = {
      ...(paramsSnapshot ?? {}),
      ...(lockedParams ?? {}),
    }

    if (Object.keys(merged).length > 0) {
      return merged
    }

    throw new DomainException('account_strategy.published_snapshot_params_missing', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: { publishedSnapshotId: snapshot.id },
    })
  }
}
