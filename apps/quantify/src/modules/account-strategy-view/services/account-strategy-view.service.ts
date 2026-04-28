import type { AccountStrategyActionDto } from '../dto/account-strategy-action.dto'
import type { AccountStrategyDeployDto } from '../dto/account-strategy-deploy.dto'
import type {
  AccountStrategyDetailResponseDto,
  AccountStrategyRuleSummaryDto,
  AccountStrategyTimelineEventDto,
} from '../dto/account-strategy-detail.response.dto'
import type { AccountStrategyListItemDto } from '../dto/account-strategy-list-item.dto'
import type { AccountStrategyListQueryDto } from '../dto/account-strategy-list-query.dto'
import type { AccountStrategyUpdateExecutionLeverageDto } from '../dto/account-strategy-update-execution-leverage.dto'
import type { StrategyInstanceStatsDto } from '@/modules/strategy-instances/dto/strategy-instance-stats.dto'
import type { StrategySignalsRuntimeConfig } from '@/modules/strategy-signals/types/strategy-signals-config.type'
import type { ExchangeId, MarketType, UnifiedBalance, UnifiedOrder } from '@/modules/trading/core/types'
import { createHash } from 'node:crypto'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger, Optional } from '@nestjs/common'
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
import { PositionsService } from '@/modules/positions/positions.service'
import {
  resolveStrategyFundingFromExchangeBalance,
  resolveStrategyFundingFromStrategyAccount,
  type StrategyFundingSnapshot,
} from '@/modules/trading/core/strategy-buying-power.resolver'
import { normalizeExecutionSymbol } from '@/modules/trading/core/symbol-normalizer'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { StrategyInstanceStatsService } from '@/modules/strategy-instances/services/strategy-instance-stats.service'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { StrategyInstancesService } from '@/modules/strategy-instances/services/strategy-instances.service'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { StrategyRuntimeExecutionStateService } from '@/modules/strategy-signals/services/strategy-runtime-execution-state.service'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '@/modules/strategy-signals/types/strategy-signals-config.type'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { TradingService } from '@/modules/trading/trading.service'
import { Prisma } from '@/prisma/prisma.types'
import { AccountStrategyAction } from '../dto/account-strategy-action.dto'
import {
  DeployIdempotencyConflictException,
  DeploySnapshotRequiresRepublishException,
  InvalidStrategyActionException,
  MissingUserIdentityException,
  StrategyNotFoundException,
  StrategyOwnerOnlyException,
} from '../exceptions'
// eslint-disable-next-line ts/consistent-type-imports -- DI requires value import with emitDecoratorMetadata
import { AccountStrategyViewRepository } from '../repositories/account-strategy-view.repository'
import {
  buildAccountStrategyLatestOrders,
  buildAccountStrategyMixedTimeline,
  buildAccountStrategyRuntimeSemanticSummary,
} from './account-strategy-view-detail-projection'

interface FormalSnapshotDetail {
  publishedSnapshotId: string | null
  snapshotHash: string | null
  paramValues: Record<string, unknown> | null
  strategyConfig: Record<string, unknown> | null
  backtestConfigDefaults: Record<string, unknown> | null
  deploymentExecutionDefaults: Record<string, unknown> | null
  deploymentExecutionConstraints: Record<string, unknown> | null
  compatibilityMetadata: Record<string, unknown> | null
  ruleSummary: AccountStrategyRuleSummaryDto | null
}

interface StrategyAccountFallback {
  id: string
  initialBalance: unknown
  totalRealizedPnl: unknown
  totalUnrealizedPnl: unknown
}

type StrategyRow = NonNullable<Awaited<ReturnType<AccountStrategyViewRepository['findStrategyForUser']>>>
type StrategyOpenOrder = UnifiedOrder & { exchangeId: ExchangeId; marketType: MarketType }

@Injectable()
export class AccountStrategyViewService {
  private static readonly BEST_EFFORT_EXTERNAL_TIMEOUT_MS = 1_500
  private static readonly DEFAULT_PERP_DEPLOY_MAX_LEVERAGE = 5
  private readonly logger = new Logger(AccountStrategyViewService.name)
  private readonly liquidationLocks = new Map<string, Promise<void>>()

  constructor(
    private readonly repo: AccountStrategyViewRepository,
    private readonly statsService: StrategyInstanceStatsService,
    private readonly strategyInstancesService: StrategyInstancesService,
    private readonly marketDataIngestionService: MarketDataIngestionService,
    @Optional() private readonly marketDataReadGateway?: MarketDataReadGateway,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly tradingService?: TradingService,
    @Optional() private readonly publishedSnapshotsRepository?: PublishedStrategySnapshotsRepository,
    private readonly runtimeExecutionStateService?: StrategyRuntimeExecutionStateService,
    @Optional() private readonly positionsService?: PositionsService,
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
    let statsMap = new Map<string, StrategyInstanceStatsDto | null>()

    if (instanceIds.length > 0) {
      try {
        statsMap = await this.statsService.calculateBatchStats(instanceIds)
      } catch {
        statsMap = new Map<string, StrategyInstanceStatsDto | null>()
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
    const latestDailySnapshot = account
      ? await this.repo.loadLatestDailySnapshot?.(account.id) ?? this.getLatestDailySnapshotFromSeries(equityRows)
      : this.getLatestDailySnapshotFromSeries(equityRows)
    const closedPositionRows = account
      ? await this.repo.loadClosedPositionPnlSeries?.(account.id) ?? []
      : []
    const positionFinancials = account
      ? await this.repo.loadPositionFinancials?.(account.id) ?? null
      : null
    const openPositionsForValuation = account
      ? await this.repo.loadOpenPositionsForValuation?.(account.id) ?? []
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
    const paramsFundingSnapshot = this.readFundingSnapshot((row as Record<string, unknown>).params)
    const exchangeBalanceSnapshot = account && !hasLocalActivity && (this.toFiniteNumber(account.balance) ?? 0) <= 0 && exchangeId
      ? await this.resolveExchangeBalanceSnapshot({
          userId,
          exchangeId,
          marketType,
          exchangeAccountId: sub?.exchangeAccount?.id ?? null,
          preferredAsset: this.readAccountBaseCurrency(account),
        })
      : null
    const exchangeFundingSnapshot = exchangeBalanceSnapshot && exchangeBalanceSnapshot.free > 0
      ? resolveStrategyFundingFromExchangeBalance({
          balance: exchangeBalanceSnapshot,
          marketType,
          mode: (row as Record<string, unknown>).mode === 'LIVE' ? 'LIVE' : 'TESTNET',
          reservedQuote: 0,
        })
      : null
    if (account && exchangeFundingSnapshot) {
      await this.repo.refreshPristineStrategyAccountFunding({
        accountId: account.id,
        baseCurrency: exchangeFundingSnapshot.asset,
        initialBalance: exchangeFundingSnapshot.totalEquity,
        balance: exchangeFundingSnapshot.buyingPower,
        equity: exchangeFundingSnapshot.totalEquity,
      })
    }
    const overviewInitialBalance = account
      ? exchangeFundingSnapshot?.totalEquity ?? this.toFiniteNumber(account.initialBalance)
      : paramsFundingSnapshot?.totalEquity ?? null
    const overviewTotalEquity = account
      ? exchangeFundingSnapshot?.totalEquity ?? resolvedTotalEquity
      : paramsFundingSnapshot?.totalEquity ?? null
    const overviewAvailableBalance = account
      ? exchangeFundingSnapshot?.buyingPower ?? this.toFiniteNumber(account.balance)
      : paramsFundingSnapshot?.buyingPower ?? null
    const overviewBaseCurrency = account
      ? exchangeFundingSnapshot?.asset ?? this.readAccountBaseCurrency(account)
      : paramsFundingSnapshot?.asset ?? null
    const localFundingSnapshot = account
      ? resolveStrategyFundingFromStrategyAccount({
          account: {
            baseCurrency: this.readAccountBaseCurrency(account),
            balance: account.balance,
            equity: overviewTotalEquity,
            initialBalance: account.initialBalance,
          },
          mode: (row as Record<string, unknown>).mode === 'LIVE' ? 'LIVE' : 'TESTNET',
          reservedQuote: 0,
        })
      : null
    const overviewFundingSnapshot = hasLocalActivity
      ? localFundingSnapshot
      : exchangeFundingSnapshot ?? paramsFundingSnapshot ?? localFundingSnapshot
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
          currentEquity: resolvedTotalEquity,
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
          latestDailySnapshot,
          resolvedUnrealizedPnl ?? 0,
          closedPositionRows,
        )
      : this.readStatsNumber(stats, 'todayPnl') ?? totalPnl
    const resolvedSnapshot = await this.resolveBoundSnapshotDetail({
      userId,
      source: row,
    })
    let runtimeExecutionStates: AccountStrategyDetailResponseDto['runtimeExecutionStates'] = []
    let runtimeExecutionStateInvalid = false
    try {
      runtimeExecutionStates = await this.resolveRuntimeExecutionStates({
        strategyInstanceId,
        publishedSnapshotId: resolvedSnapshot.publishedSnapshotId,
        snapshotHash: resolvedSnapshot.snapshotHash,
        compatibilityMetadata: resolvedSnapshot.compatibilityMetadata,
      })
    } catch (error) {
      if (this.isRuntimeExecutionBindingMismatch(error)) {
        runtimeExecutionStateInvalid = true
        resolvedSnapshot.compatibilityMetadata = {
          ...(resolvedSnapshot.compatibilityMetadata ?? {}),
          invalidBinding: true,
        }
      } else {
        this.logger.warn(
          `Failed to load runtime execution states for strategy instance ${strategyInstanceId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }
    const snapshotStrategyConfig = resolvedSnapshot.strategyConfig
    const snapshotMarketType = this.readSnapshotMarketType(snapshotStrategyConfig)
    const detailLeverageConstraints = await this.resolveEffectiveLeverageConstraints({
      userId,
      exchangeId: this.resolveExchangeId(
        snapshotStrategyConfig
          ? this.readString(snapshotStrategyConfig, ['exchange', 'exchangeId', 'provider'])
          : exchangeId,
      ),
      marketType: snapshotMarketType === 'perp'
        ? 'perp'
        : marketType,
      symbol: snapshotStrategyConfig
        ? this.readString(snapshotStrategyConfig, ['symbol'])
        : symbol,
      exchangeAccountId: sub?.exchangeAccount?.id ?? null,
      deploymentExecutionConstraints: resolvedSnapshot.deploymentExecutionConstraints,
    })
    const currentExecutionConfig = this.readRecord((row as Record<string, unknown>).deploymentExecutionConfig)
    const deploymentExecutionConfig = currentExecutionConfig ?? resolvedSnapshot.deploymentExecutionDefaults
    const baselineExecutionConfig = resolvedSnapshot.deploymentExecutionDefaults
    const driftReasons: string[] = []
    if (baselineExecutionConfig && deploymentExecutionConfig) {
      const driftFields = snapshotMarketType === 'perp'
        ? ['leverage', 'priceSource', 'orderType', 'timeInForce']
        : ['priceSource', 'orderType', 'timeInForce']
      for (const field of driftFields) {
        if (baselineExecutionConfig[field] !== deploymentExecutionConfig[field]) {
          driftReasons.push(field)
        }
      }
    }
    const snapshotDeploymentExecutionBaseline = snapshotMarketType === 'spot'
      ? this.stripLeverageFromExecutionConfig(resolvedSnapshot.deploymentExecutionDefaults)
      : resolvedSnapshot.deploymentExecutionDefaults
    const snapshotDeploymentExecutionCurrent = snapshotMarketType === 'spot'
      ? this.stripLeverageFromExecutionConfig(deploymentExecutionConfig)
      : deploymentExecutionConfig
    const snapshotDeploymentExecutionConstraints = snapshotMarketType === 'spot'
      ? this.stripLeverageFromExecutionConstraints(resolvedSnapshot.deploymentExecutionConstraints)
      : (resolvedSnapshot.deploymentExecutionConstraints
          ? {
              ...resolvedSnapshot.deploymentExecutionConstraints,
              ...(detailLeverageConstraints
                ? { accountMaxLeverage: detailLeverageConstraints.accountMax }
                : {}),
            }
          : null)
    const detailPositionOverview = {
      openPositionsCount: account ? positionOverview.openCount : null,
      closedPositionsCount: account ? positionOverview.closedCount : null,
      totalRealizedPnl: account ? resolvedRealizedPnl : null,
      totalUnrealizedPnl: account ? resolvedUnrealizedPnl : null,
    }
    const latestOrders = buildAccountStrategyLatestOrders(timelineSource.trades, timelineSource.signalExecutions)
    const currentOpenOrders = await this.loadCurrentOpenOrdersForStrategy({
      userId,
      row,
      sub,
      strict: false,
    })
    const openOrdersCount = currentOpenOrders
      ? currentOpenOrders.filter(order => this.isOpenExchangeOrder(order)).length
      : null
    const runtimeSemanticMarketType = snapshotMarketType ?? marketType
    const runtimeSemanticSymbol = snapshotStrategyConfig
      ? this.readString(snapshotStrategyConfig, ['symbol']) ?? symbol
      : symbol
    const runtimeSemanticSummary = buildAccountStrategyRuntimeSemanticSummary({
      status: this.mapUiStatus(row.status),
      marketType: runtimeSemanticMarketType ?? 'unknown',
      symbol: runtimeSemanticSymbol ?? '',
      openPositionsCount: detailPositionOverview.openPositionsCount,
      trades: timelineSource.trades,
      ruleSummary: resolvedSnapshot.ruleSummary,
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
        exchange: resolvedSnapshot.strategyConfig
          ? this.readString(resolvedSnapshot.strategyConfig, ['exchange', 'provider', 'exchangeId'])
          : null,
        symbol: resolvedSnapshot.strategyConfig
          ? this.readString(resolvedSnapshot.strategyConfig, ['symbol'])
          : null,
        timeframe: resolvedSnapshot.strategyConfig
          ? this.readString(resolvedSnapshot.strategyConfig, ['baseTimeframe', 'timeframe', 'period'])
          : null,
        positionPct: resolvedSnapshot.strategyConfig
          ? this.readNumber(resolvedSnapshot.strategyConfig, ['positionPct', 'positionSizeRatioPercent'])
          : null,
        paramSchema: resolvedSnapshot.paramValues ? dynamicParams.paramSchema : null,
        paramValues: resolvedSnapshot.paramValues,
        schemaVersion: resolvedSnapshot.paramValues ? dynamicParams.schemaVersion : null,
        deployAccountName: sub?.exchangeAccount?.name ?? null,
        deployAt: sub?.subscribedAt?.toISOString() ?? row.startedAt?.toISOString() ?? null,
        strategyConfig: snapshotStrategyConfig,
        backtestConfigDefaults: resolvedSnapshot.backtestConfigDefaults
          ? {
              ...resolvedSnapshot.backtestConfigDefaults,
              stateTimeframes: this.readStringArray(
                snapshotStrategyConfig,
                ['stateTimeframes'],
              ),
            }
          : null,
        deploymentExecutionBaseline: snapshotDeploymentExecutionBaseline,
        deploymentExecutionCurrent: snapshotDeploymentExecutionCurrent,
        deploymentExecutionConstraints: snapshotDeploymentExecutionConstraints,
        effectiveAllowedLeverageRange: snapshotMarketType === 'perp' && detailLeverageConstraints
          ? {
              min: detailLeverageConstraints.min,
              max: detailLeverageConstraints.max,
            }
          : null,
        compatibilityMetadata: this.normalizeCompatibilityMetadata(resolvedSnapshot.compatibilityMetadata),
        consistencySummary: {
          isConsistent: driftReasons.length === 0,
          driftReasons,
          consistencyScore: driftReasons.length === 0 ? 100 : null,
        },
        ruleSummary: resolvedSnapshot.ruleSummary,
        executionConfigVersion: typeof (row as Record<string, unknown>).executionConfigVersion === 'number'
          ? ((row as Record<string, unknown>).executionConfigVersion as number)
          : null,
      },
      timeline: buildAccountStrategyMixedTimeline(timelineSource),
      accountOverview: {
        initialBalance: overviewInitialBalance,
        totalEquity: overviewFundingSnapshot?.totalEquity ?? overviewTotalEquity,
        availableBalance: overviewFundingSnapshot?.buyingPower ?? overviewAvailableBalance,
        executionCapital: overviewFundingSnapshot?.executionCapital ?? null,
        nonTradableReason: overviewFundingSnapshot?.nonTradableReason ?? null,
        totalPnl: totalPnl ?? null,
        todayPnl: todayPnl ?? null,
        baseCurrency: overviewFundingSnapshot?.asset ?? overviewBaseCurrency,
      },
      positionOverview: detailPositionOverview,
      latestOrders,
      openOrdersCount,
      runtimeExecutionStates,
      runtimeSemanticSummary,
      deployment: !resolvedSnapshot.publishedSnapshotId
        || resolvedSnapshot.compatibilityMetadata?.requiresRepublishForDeploy
        || resolvedSnapshot.compatibilityMetadata?.invalidBinding === true
        || runtimeExecutionStateInvalid
        ? null
        : {
            exchangeAccountId: sub?.exchangeAccount?.id ?? null,
            exchangeAccountName: sub?.exchangeAccount?.name ?? null,
            executionConfig: {
              leverage: snapshotMarketType === 'perp' && deploymentExecutionConfig
                ? this.readNumber(deploymentExecutionConfig, ['leverage'])
                : null,
              priceSource: deploymentExecutionConfig ? this.readString(deploymentExecutionConfig, ['priceSource']) : null,
              orderType: deploymentExecutionConfig ? this.readString(deploymentExecutionConfig, ['orderType']) : null,
              timeInForce: deploymentExecutionConfig ? this.readString(deploymentExecutionConfig, ['timeInForce']) : null,
            },
            executionConfigVersion: typeof (row as Record<string, unknown>).executionConfigVersion === 'number'
              ? ((row as Record<string, unknown>).executionConfigVersion as number)
              : null,
            effectiveAllowedLeverageRange: snapshotMarketType === 'perp' && detailLeverageConstraints
              ? { min: detailLeverageConstraints.min, max: detailLeverageConstraints.max }
              : null,
            driftFields: driftReasons,
            reReadAtNextEligibleExecutionCycle: true,
            updatedBy: typeof row.updatedBy === 'string' ? row.updatedBy : null,
          },
    }

    if (detail.equitySeries.length === 0 && account) {
      detail.equitySeries = [{
        ts: new Date().toISOString(),
        value: resolvedTotalEquity ?? (
          Number(account.initialBalance) + (resolvedRealizedPnl ?? 0) + (resolvedUnrealizedPnl ?? 0)
        ),
      }]
    }

    return detail
  }

  private async resolveRuntimeExecutionStates(input: {
    strategyInstanceId: string
    publishedSnapshotId: string | null
    snapshotHash: string | null
    compatibilityMetadata: Record<string, unknown> | null
  }): Promise<AccountStrategyDetailResponseDto['runtimeExecutionStates']> {
    if (
      !input.publishedSnapshotId
      || !input.snapshotHash
      || !this.runtimeExecutionStateService
      || input.compatibilityMetadata?.requiresRepublishForDeploy === true
      || input.compatibilityMetadata?.invalidBinding === true
    ) {
      return []
    }

    const states = await this.runtimeExecutionStateService.loadStatesForBinding({
      strategyInstanceId: input.strategyInstanceId,
      publishedSnapshotId: input.publishedSnapshotId,
      snapshotHash: input.snapshotHash,
    })

    return states.map(state => ({
      executionSemanticKey: state.executionSemanticKey,
      status: this.mapRuntimeExecutionStateStatusForDetail(state.status),
      failureFamily: this.mapRuntimeExecutionFailureFamilyForDetail(state.failureCode),
      failureReason: state.failureReason ?? null,
      failureCode: state.failureCode ?? null,
      lastAttemptAt: state.lastAttemptAt?.toISOString() ?? null,
      consumedAt: state.consumedAt?.toISOString() ?? null,
      cooldownUntil: state.cooldownUntil?.toISOString() ?? null,
      publishedSnapshotId: state.publishedSnapshotId,
      snapshotHash: state.snapshotHash,
    }))
  }

  private mapRuntimeExecutionStateStatusForDetail(
    status: 'ready' | 'running' | 'retryable' | 'terminal' | 'consumed',
  ): 'ready' | 'consumed' | 'failed' | 'cooldown' {
    if (status === 'running') return 'ready'
    if (status === 'retryable') return 'cooldown'
    if (status === 'terminal') return 'failed'
    return status
  }

  private mapRuntimeExecutionFailureFamilyForDetail(
    failureCode: string | null | undefined,
  ): 'binding' | 'activation' | 'execution' | 'persistence' | null {
    if (!failureCode) return null

    if (failureCode === 'SNAPSHOT_RUNTIME_PARAMS_MISSING' || failureCode === 'SYMBOL_NOT_FOUND') {
      return 'binding'
    }
    if (
      failureCode === 'SNAPSHOT_REFERENCE_BAR_MISSING'
      || failureCode === 'SNAPSHOT_RUNTIME_CONTEXT_MISSING'
    ) {
      return 'activation'
    }
    if (
      failureCode === 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL'
      || failureCode === 'SNAPSHOT_SCRIPT_NO_SIGNAL'
      || failureCode === 'SEMANTIC_EXECUTED_NO_SIGNAL'
      || failureCode === 'SNAPSHOT_RUNTIME_EXECUTION_UNEXPECTED_ERROR'
    ) {
      return 'execution'
    }
    if (failureCode === 'SIGNAL_PERSIST_FAILED') {
      return 'persistence'
    }

    return null
  }

  private isRuntimeExecutionBindingMismatch(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false
    }

    return error.message === 'strategy_instance_mismatch'
      || error.message === 'published_snapshot_mismatch'
      || error.message === 'snapshot_hash_mismatch'
  }

  private async resolveBoundSnapshotDetail(input: {
    userId: string
    source: unknown
  }): Promise<FormalSnapshotDetail> {
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
        strategyConfig: null,
        backtestConfigDefaults: null,
        deploymentExecutionDefaults: null,
        deploymentExecutionConstraints: null,
        compatibilityMetadata: null,
        ruleSummary: null,
      }
    }

    const snapshot = await this.publishedSnapshotsRepository.findByIdForUser(boundPublishedSnapshotId, input.userId)
    if (!snapshot) {
      return {
        publishedSnapshotId: boundPublishedSnapshotId,
        snapshotHash: boundSnapshotHash,
        paramValues: null,
        strategyConfig: null,
        backtestConfigDefaults: null,
        deploymentExecutionDefaults: null,
        deploymentExecutionConstraints: null,
        compatibilityMetadata: {
          isLegacySnapshot: true,
          missingStrategyConfig: true,
          missingBacktestConfigDefaults: true,
          missingDeploymentExecutionDefaults: true,
          missingDeploymentExecutionConstraints: true,
          requiresRepublishForBacktest: true,
          requiresRepublishForDeploy: true,
          invalidBinding: true,
        },
        ruleSummary: null,
      }
    }

    if (boundSnapshotHash && snapshot.snapshotHash !== boundSnapshotHash) {
      return {
        publishedSnapshotId: boundPublishedSnapshotId,
        snapshotHash: boundSnapshotHash,
        paramValues: null,
        strategyConfig: null,
        backtestConfigDefaults: null,
        deploymentExecutionDefaults: null,
        deploymentExecutionConstraints: null,
        compatibilityMetadata: {
          isLegacySnapshot: true,
          missingStrategyConfig: true,
          missingBacktestConfigDefaults: true,
          missingDeploymentExecutionDefaults: true,
          missingDeploymentExecutionConstraints: true,
          requiresRepublishForBacktest: true,
          requiresRepublishForDeploy: true,
          invalidBinding: true,
        },
        ruleSummary: null,
      }
    }

    const paramValues = {
      ...(this.readRecord(snapshot.paramsSnapshot) ?? {}),
      ...(this.readRecord(snapshot.lockedParams) ?? {}),
    }
    const strategyConfig = this.readRecord((snapshot as Record<string, unknown>).strategyConfig)
    const backtestConfigDefaults = this.readRecord((snapshot as Record<string, unknown>).backtestConfigDefaults)
    const deploymentExecutionDefaults = this.readRecord((snapshot as Record<string, unknown>).deploymentExecutionDefaults)
    const deploymentExecutionConstraints = this.readRecord((snapshot as Record<string, unknown>).deploymentExecutionConstraints)
    const missingStrategyConfig = !strategyConfig
    const missingBacktestConfigDefaults = !backtestConfigDefaults
    const missingDeploymentExecutionDefaults = !deploymentExecutionDefaults
    const missingDeploymentExecutionConstraints = !deploymentExecutionConstraints
    const compatibilityMetadata = missingStrategyConfig
      || missingBacktestConfigDefaults
      || missingDeploymentExecutionDefaults
      || missingDeploymentExecutionConstraints
      ? {
          isLegacySnapshot: true,
          missingStrategyConfig,
          missingBacktestConfigDefaults,
          missingDeploymentExecutionDefaults,
          missingDeploymentExecutionConstraints,
          requiresRepublishForBacktest: missingStrategyConfig || missingBacktestConfigDefaults,
          requiresRepublishForDeploy: missingStrategyConfig || missingDeploymentExecutionDefaults || missingDeploymentExecutionConstraints,
        }
      : {
          isLegacySnapshot: false,
          missingStrategyConfig: false,
          missingBacktestConfigDefaults: false,
          missingDeploymentExecutionDefaults: false,
          missingDeploymentExecutionConstraints: false,
          requiresRepublishForBacktest: false,
          requiresRepublishForDeploy: false,
        }

    return {
      publishedSnapshotId: snapshot.id,
      snapshotHash: snapshot.snapshotHash,
      paramValues: Object.keys(paramValues).length > 0 ? paramValues : null,
      strategyConfig,
      backtestConfigDefaults,
      deploymentExecutionDefaults,
      deploymentExecutionConstraints,
      compatibilityMetadata,
      ruleSummary: this.buildPublishedSnapshotRuleSummary(snapshot),
    }
  }

  private buildPublishedSnapshotRuleSummary(snapshot: unknown): AccountStrategyRuleSummaryDto | null {
    const root = this.readRecord(snapshot)
    const specSnapshot = this.readRecord(root?.specSnapshot)
    const rules = Array.isArray(specSnapshot?.rules) ? specSnapshot.rules : []
    if (!rules.length) return null

    const normalizedRules = rules
      .map((rule) => {
        const record = this.readRecord(rule)
        if (!record) return null
        const condition = this.readRecord(record.condition)
        const actions = Array.isArray(record.actions)
          ? record.actions
              .map(action => this.readString(this.readRecord(action), ['type']))
              .filter((action): action is string => Boolean(action))
          : []
        return {
          id: this.readString(record, ['id']),
          phase: this.readString(record, ['phase']),
          conditionKey: this.readString(condition, ['key']),
          operator: this.readString(condition, ['op']),
          value: this.readNumber(condition, ['value']),
          actions,
        }
      })
      .filter((rule): rule is {
        id: string | null
        phase: string | null
        conditionKey: string | null
        operator: string | null
        value: number | null
        actions: string[]
      } => rule !== null)

    return normalizedRules.length > 0
      ? {
          rules: normalizedRules,
          executionPolicy: this.readRecord(specSnapshot?.executionPolicy),
        }
      : null
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

    if (
      dto.action !== AccountStrategyAction.RUN
      && dto.action !== AccountStrategyAction.STOP
      && dto.action !== AccountStrategyAction.LIQUIDATE_AND_STOP
    ) {
      throw new InvalidStrategyActionException({ action: dto.action })
    }

    if (dto.action === AccountStrategyAction.LIQUIDATE_AND_STOP) {
      if (row.status !== 'running') {
        return this.getStrategyDetail(userId, strategyInstanceId)
      }
      return this.runLiquidateAndStopLocked(userId, strategyInstanceId, row)
    }

    const nextStatus = dto.action === AccountStrategyAction.RUN ? 'running' : 'stopped'
    if (nextStatus === row.status) {
      return this.getStrategyDetail(userId, strategyInstanceId)
    }

    await this.strategyInstancesService.updateInstance(
      strategyInstanceId,
      {
        status: nextStatus,
        updatedBy: userId,
      },
      userId,
    )

    return this.getStrategyDetail(userId, strategyInstanceId)
  }

  private async runLiquidateAndStopLocked(
    userId: string,
    strategyInstanceId: string,
    fallbackRow: StrategyRow,
  ): Promise<AccountStrategyDetailResponseDto> {
    return this.runWithLiquidationLock(strategyInstanceId, async () => {
      const latestRow = await this.repo.findStrategyForUser(userId, strategyInstanceId)
      const row = latestRow ?? fallbackRow

      if (row.createdBy !== userId) {
        throw new StrategyOwnerOnlyException({ userId, ownerId: row.createdBy })
      }
      this.assertStrategyVisible(row, strategyInstanceId)

      if (row.status !== 'running') {
        return this.getStrategyDetail(userId, strategyInstanceId)
      }

      return this.liquidateAndStopStrategy(userId, strategyInstanceId, row)
    })
  }

  private async runWithLiquidationLock<T>(
    strategyInstanceId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const previous = this.liquidationLocks.get(strategyInstanceId) ?? Promise.resolve()
    let releaseCurrent!: () => void
    const current = new Promise<void>(resolve => {
      releaseCurrent = resolve
    })
    const next = previous.catch(() => undefined).then(() => current)
    this.liquidationLocks.set(strategyInstanceId, next)

    await previous.catch(() => undefined)
    try {
      return await task()
    } finally {
      releaseCurrent()
      if (this.liquidationLocks.get(strategyInstanceId) === next) {
        this.liquidationLocks.delete(strategyInstanceId)
      }
    }
  }

  private async liquidateAndStopStrategy(
    userId: string,
    strategyInstanceId: string,
    row: StrategyRow,
  ): Promise<AccountStrategyDetailResponseDto> {
    const sub = this.assertStrategyVisible(row, strategyInstanceId)
    const account = await this.repo.findUserStrategyAccount(userId, row.strategyTemplateId)
    if (!account) {
      throw new StrategyNotFoundException({ strategyInstanceId })
    }

    await this.strategyInstancesService.updateInstance(
      strategyInstanceId,
      {
        status: 'paused',
        updatedBy: userId,
      },
      userId,
    )

    try {
      await this.cancelOpenOrdersForStrategy(userId, row, sub.exchangeAccount?.id ?? undefined)

      const openPositions = await this.repo.loadOpenPositionsForLiquidation(account.id)
      // latestOrders is recent activity history, not authoritative open-order state.
      if (openPositions.length > 0) {
        if (!this.positionsService) {
          throw new DomainException('account_strategy.liquidation_service_unavailable', {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
          })
        }

        for (const position of openPositions) {
          await this.positionsService.closePosition({
            userId,
            userStrategyAccountId: account.id,
            positionId: position.id,
            quantity: position.quantity.toString(),
            exchangeId: position.exchangeId as ExchangeId,
            marketType: position.marketType as MarketType,
            note: 'AI Quant 平仓并停止',
          })
        }
      }

      await this.strategyInstancesService.updateInstance(
        strategyInstanceId,
        {
          status: 'stopped',
          updatedBy: userId,
        },
        userId,
      )
    }
    catch (error) {
      await this.strategyInstancesService.updateInstance(
        strategyInstanceId,
        {
          status: 'running',
          updatedBy: userId,
        },
        userId,
      ).catch(() => undefined)
      throw error
    }

    return this.getStrategyDetail(userId, strategyInstanceId)
  }

  private async cancelOpenOrdersForStrategy(
    userId: string,
    row: StrategyRow,
    exchangeAccountId?: string,
  ): Promise<void> {
    const sub = row.subscriptions?.[0]
    const openOrders = await this.loadCurrentOpenOrdersForStrategy({
      userId,
      row,
      sub,
      exchangeAccountId,
      strict: true,
    }) ?? []

    for (const order of openOrders) {
      if (!this.isOpenExchangeOrder(order)) {
        continue
      }
      await this.tradingService.cancelOrder(
        userId,
        order.exchangeId,
        order.marketType,
        order.id,
        order.symbol,
        exchangeAccountId,
      )
    }
  }

  private async loadCurrentOpenOrdersForStrategy(input: {
    userId: string
    row: StrategyRow
    sub?: StrategyRow['subscriptions'][number] | null
    exchangeAccountId?: string
    strict: boolean
  }): Promise<StrategyOpenOrder[] | null> {
    const { userId, row, sub, exchangeAccountId, strict } = input
    if (!this.tradingService) {
      if (strict) {
        throw new DomainException('account_strategy.trading_service_unavailable', {
          code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
          status: HttpStatus.SERVICE_UNAVAILABLE,
        })
      }
      return null
    }

    const mergedParams = {
      ...(this.readRecord(row.strategyTemplate?.defaultParams) ?? {}),
      ...(this.readRecord((row as Record<string, unknown>).params) ?? {}),
      ...(this.readRecord(sub?.customParams) ?? {}),
    }
    const exchangeId = this.resolveExchangeId(
      this.readString(mergedParams, ['exchange', 'provider', 'exchangeId'])
      ?? sub?.exchangeAccount?.exchangeId
      ?? null,
    )
    const symbol = this.readString(mergedParams, ['symbol'])
    if (!exchangeId || !symbol) {
      if (strict) {
        throw new DomainException('account_strategy.liquidation_order_context_missing', {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
        })
      }
      return null
    }

    const marketType = this.resolveMarketType(mergedParams, symbol, exchangeId)
    const executionSymbol = normalizeExecutionSymbol(symbol, marketType, exchangeId)
    const resolvedExchangeAccountId = exchangeAccountId ?? sub?.exchangeAccount?.id ?? undefined

    try {
      return (await this.tradingService.getOpenOrders(
        userId,
        exchangeId,
        marketType,
        executionSymbol,
        resolvedExchangeAccountId,
      )).map(order => ({
        ...order,
        exchangeId,
        marketType,
        symbol: order.symbol || executionSymbol,
      }))
    }
    catch (error) {
      if (strict) {
        throw error
      }
      this.logger.warn(
        `Failed to load current open orders for strategy ${row.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return null
    }
  }

  private isOpenExchangeOrder(order: Pick<UnifiedOrder, 'status'>): boolean {
    return order.status === 'open' || order.status === 'partially_filled'
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

    const resolvedDeploy = await this.resolveDeployPayload(dto)

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
    const exchangeBalance = this.tradingService
      ? await this.resolveExchangeBalanceSnapshot({
          userId: dto.userId,
          exchangeId: resolvedDeploy.exchange,
          marketType: resolvedDeploy.marketType,
          exchangeAccountId: resolvedDeploy.exchangeAccountId,
          preferredAsset: this.resolvePreferredQuoteAsset(resolvedDeploy.symbol),
        })
      : null
    const deployFundingSnapshot = exchangeBalance
      ? resolveStrategyFundingFromExchangeBalance({
          balance: exchangeBalance,
          marketType: resolvedDeploy.marketType,
          mode: dto.mode ?? null,
          reservedQuote: 0,
        })
      : null

    let strategyInstanceIdForBinding: string | null = null
    let deployedStrategyInstanceId: string | null = null
    try {
      await this.marketDataIngestionService.ensureSymbolsSubscribed([resolvedDeploy.symbol])

      const deployResult = await this.repo.deployStrategyForUser({
        userId: dto.userId,
        name: dto.name,
        exchange: resolvedDeploy.exchange,
        symbol: resolvedDeploy.symbol,
        marketType: resolvedDeploy.marketType,
        timeframe: resolvedDeploy.timeframe,
        positionPct: resolvedDeploy.positionPct,
        publishedSnapshotBinding: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: resolvedDeploy.publishedSnapshotId,
          snapshotHash: resolvedDeploy.snapshotHash,
          sourceStrategyInstanceId: resolvedDeploy.sourceStrategyInstanceId,
          sourceStrategyTemplateId: resolvedDeploy.sourceStrategyTemplateId,
        },
        initialBalanceQuote: deployFundingSnapshot?.totalEquity ?? exchangeBalance?.total,
        accountBalanceQuote: deployFundingSnapshot?.buyingPower ?? exchangeBalance?.free,
        fundingSnapshot: deployFundingSnapshot,
        mode: dto.mode,
        exchangeAccountId: resolvedDeploy.exchangeAccountId ?? undefined,
        exchangeAccountName: dto.exchangeAccountName,
        deploymentExecutionConfig: resolvedDeploy.deploymentExecutionConfig,
        executionConfigVersion: 1,
      })
      strategyInstanceIdForBinding = deployResult.strategyInstanceId
      deployedStrategyInstanceId = deployResult.strategyInstanceId

      const riskProfile = this.buildRiskProfileSnapshot(dto)
      await this.repo.upsertRiskProfile({
        strategyInstanceId: deployResult.strategyInstanceId,
        ...riskProfile,
      })
      await this.requireRuntimeExecutionStateService().initializeStatesForDeploy({
        strategyInstanceId: deployResult.strategyInstanceId,
        publishedSnapshotId: resolvedDeploy.publishedSnapshotId,
        snapshotHash: resolvedDeploy.snapshotHash,
        snapshot: resolvedDeploy.snapshot,
      })
      await this.repo.markDeployRequestSucceeded(deployRequest.id, deployResult.strategyInstanceId)
      await this.repo.activateStrategyInstanceForRuntime({
        strategyInstanceId: deployResult.strategyInstanceId,
        mode: deployResult.mode,
        userId: dto.userId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const code = error instanceof DomainException ? error.code : ErrorCode.BAD_REQUEST
      try {
        await this.repo.markDeployRequestFailed(deployRequest.id, String(code), message)
      } catch {
        // Best effort only: preserve the original deploy failure when the
        // failure marker cannot be persisted.
      }
      if (strategyInstanceIdForBinding) {
        try {
          await this.repo.markStrategyInstanceRuntimeBindingFailed({
            strategyInstanceId: strategyInstanceIdForBinding,
            errorCode: String(code),
            userId: dto.userId,
          })
        } catch {
          // Best effort only: preserve the original deploy failure when the
          // runtime binding failure marker cannot be persisted.
        }
      }
      throw error
    }

    return this.getStrategyDetail(dto.userId, deployedStrategyInstanceId!)
  }

  async getDeployResult(userId: string, deployRequestId: string): Promise<AccountStrategyDetailResponseDto | null> {
    if (!userId) {
      throw new MissingUserIdentityException()
    }

    const deployRequest = await this.repo.findDeployRequestByUserAndRequestId(userId, deployRequestId)
    if (!deployRequest) {
      return null
    }

    if (deployRequest.status !== 'SUCCEEDED' || !deployRequest.strategyInstanceId) {
      return null
    }

    return this.getStrategyDetail(userId, deployRequest.strategyInstanceId)
  }

  async updateDeploymentLeverage(
    strategyInstanceId: string,
    dto: AccountStrategyUpdateExecutionLeverageDto,
  ): Promise<AccountStrategyDetailResponseDto> {
    if (!dto.userId) {
      throw new MissingUserIdentityException()
    }
    const row = await this.repo.findStrategyForUser(dto.userId, strategyInstanceId)
    if (!row) {
      throw new StrategyNotFoundException({ strategyInstanceId })
    }

    if (row.createdBy !== dto.userId) {
      throw new StrategyOwnerOnlyException({ userId: dto.userId, ownerId: row.createdBy })
    }

    const sub = this.assertStrategyVisible(row, strategyInstanceId)
    const account = await this.repo.findUserStrategyAccount(dto.userId, row.strategyTemplateId)
    const positionOverview = account
      ? await this.repo.loadPositionOverview(account.id)
      : { openCount: 0, closedCount: 0 }
    if ((positionOverview?.openCount ?? 0) > 0) {
      throw new DomainException('account_strategy.deployment_leverage_requires_flat_positions', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    const snapshotDetail = await this.resolveBoundSnapshotDetail({ userId: dto.userId, source: row })
    if (snapshotDetail.compatibilityMetadata?.requiresRepublishForDeploy) {
      throw new DomainException('account_strategy.invalid_snapshot_execution_config', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    const strategyConfig = snapshotDetail.strategyConfig ?? {}
    const deploymentDefaults = snapshotDetail.deploymentExecutionDefaults ?? {}
    const snapshotMarketType = this.readSnapshotMarketType(strategyConfig)
    if (snapshotMarketType !== 'perp') {
      throw new DomainException('account_strategy.deployment_leverage_not_supported_for_spot', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }
    const constraints = await this.resolveEffectiveLeverageConstraints({
      userId: dto.userId,
      exchangeId: this.resolveExchangeId(this.readString(strategyConfig, ['exchange']) ?? sub.exchangeAccount?.exchangeId ?? null),
      marketType: snapshotMarketType,
      symbol: this.readString(strategyConfig, ['symbol']),
      exchangeAccountId: sub.exchangeAccount?.id ?? null,
      deploymentExecutionConstraints: snapshotDetail.deploymentExecutionConstraints,
    })

    if (!constraints || dto.leverage < constraints.min || dto.leverage > constraints.max) {
      throw new DomainException('account_strategy.invalid_deployment_leverage', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    const existingConfig = this.readRecord((row as Record<string, unknown>).deploymentExecutionConfig)
    const nextExecutionConfig = {
      leverage: dto.leverage,
      priceSource: this.readString(existingConfig ?? deploymentDefaults, ['priceSource']) ?? null,
      orderType: this.readString(existingConfig ?? deploymentDefaults, ['orderType']) ?? null,
      timeInForce: this.readString(existingConfig ?? deploymentDefaults, ['timeInForce']) ?? null,
    }
    const nextVersion = typeof (row as Record<string, unknown>).executionConfigVersion === 'number'
      ? ((row as Record<string, unknown>).executionConfigVersion as number) + 1
      : 1

    await this.repo.updateDeploymentExecutionConfig({
      strategyInstanceId,
      userId: dto.userId,
      executionConfig: nextExecutionConfig as {
        leverage: number
        priceSource: string
        orderType: string
        timeInForce: string
      },
      executionConfigVersion: nextVersion,
      existingParams: this.readRecord((row as Record<string, unknown>).params) ?? {},
      existingMetadata: this.readRecord((row as Record<string, unknown>).metadata) ?? {},
      reason: dto.reason,
    })

    return this.getStrategyDetail(dto.userId, strategyInstanceId)
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
    if (row.status === 'running') {
      throw new DomainException('account_strategy.delete_running_forbidden', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { strategyInstanceId },
      })
    }
    if (row.status !== 'draft') {
      await this.assertNoRuntimeRiskBeforeDelete(userId, row, strategyInstanceId)
    }

    await this.repo.deleteStrategyForUser(userId, strategyInstanceId)
  }

  private async assertNoRuntimeRiskBeforeDelete(
    userId: string,
    row: StrategyRow,
    strategyInstanceId: string,
  ): Promise<void> {
    const sub = this.assertStrategyVisible(row, strategyInstanceId)
    const account = await this.repo.findUserStrategyAccount(userId, row.strategyTemplateId)
    if (account) {
      const openPositions = await this.repo.loadOpenPositionsForLiquidation(account.id)
      if (openPositions.length > 0) {
        throw new DomainException('account_strategy.delete_runtime_risk_forbidden', {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
          args: { strategyInstanceId, openPositionsCount: openPositions.length },
        })
      }
    }

    if (!this.tradingService) {
      throw new DomainException('account_strategy.trading_service_unavailable', {
        code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
        status: HttpStatus.SERVICE_UNAVAILABLE,
      })
    }

    const mergedParams = {
      ...(this.readRecord(row.strategyTemplate?.defaultParams) ?? {}),
      ...(this.readRecord((row as Record<string, unknown>).params) ?? {}),
      ...(this.readRecord(sub.customParams) ?? {}),
    }
    const exchangeId = this.resolveExchangeId(
      this.readString(mergedParams, ['exchange', 'provider', 'exchangeId'])
      ?? sub.exchangeAccount?.exchangeId
      ?? null,
    )
    const symbol = this.readString(mergedParams, ['symbol'])
    if (!exchangeId || !symbol) {
      return
    }

    const marketType = this.resolveMarketType(mergedParams, symbol, exchangeId)
    const executionSymbol = normalizeExecutionSymbol(symbol, marketType, exchangeId)
    const openOrders = await this.tradingService.getOpenOrders(
      userId,
      exchangeId,
      marketType,
      executionSymbol,
      sub.exchangeAccount?.id ?? undefined,
    )
    const riskyOrders = openOrders.filter(order => order.status === 'open' || order.status === 'partially_filled')
    if (riskyOrders.length > 0) {
      throw new DomainException('account_strategy.delete_runtime_risk_forbidden', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { strategyInstanceId, openOrdersCount: riskyOrders.length },
      })
    }
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

  private requireRuntimeExecutionStateService(): StrategyRuntimeExecutionStateService {
    if (!this.runtimeExecutionStateService) {
      throw new DomainException('account_strategy.deploy_runtime_execution_state_service_unavailable', {
        code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
        status: HttpStatus.SERVICE_UNAVAILABLE,
      })
    }

    return this.runtimeExecutionStateService
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

  private normalizeCompatibilityMetadata(
    value: Record<string, unknown> | null,
  ): AccountStrategyDetailResponseDto['snapshot']['compatibilityMetadata'] {
    if (!value) return null

    return {
      isLegacySnapshot: value.isLegacySnapshot === true,
      missingStrategyConfig: value.missingStrategyConfig === true,
      missingBacktestConfigDefaults: value.missingBacktestConfigDefaults === true,
      missingDeploymentExecutionDefaults: value.missingDeploymentExecutionDefaults === true,
      missingDeploymentExecutionConstraints: value.missingDeploymentExecutionConstraints === true,
      requiresRepublishForBacktest: value.requiresRepublishForBacktest === true,
      requiresRepublishForDeploy: value.requiresRepublishForDeploy === true,
      ...(value.invalidBinding === true ? { invalidBinding: true } : {}),
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

  private readStringArray(source: Record<string, unknown> | null, keys: string[]): string[] {
    if (!source) return []
    for (const key of keys) {
      const value = source[key]
      if (Array.isArray(value)) {
        return value
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map(item => item.trim())
      }
    }
    return []
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

  private readFundingSnapshot(params: unknown): StrategyFundingSnapshot | null {
    const record = this.readRecord(params)
    const snapshot = this.readRecord(record?.fundingSnapshot)
    if (!snapshot) return null
    const totalEquity = this.toFiniteNumber(snapshot.totalEquity)
    const buyingPower = this.toFiniteNumber(snapshot.buyingPower)
    const executionCapital = this.toFiniteNumber(snapshot.executionCapital)
    if (totalEquity === null || buyingPower === null || executionCapital === null) return null
    return {
      asset: this.readString(snapshot, ['asset']) ?? 'USDT',
      totalEquity,
      availableCash: this.toFiniteNumber(snapshot.availableCash),
      availableEquity: this.toFiniteNumber(snapshot.availableEquity),
      reservedQuote: this.toFiniteNumber(snapshot.reservedQuote) ?? 0,
      usedMargin: this.toFiniteNumber(snapshot.usedMargin),
      buyingPower,
      executionCapital,
      fundingSource: this.readString(snapshot, ['fundingSource']) === 'exchange_live'
        ? 'exchange_live'
        : this.readString(snapshot, ['fundingSource']) === 'paper'
          ? 'paper'
          : 'exchange_testnet',
      accountMode: this.readString(snapshot, ['accountMode']),
      marginMode: this.readString(snapshot, ['marginMode']),
      nonTradableReason: this.readString(snapshot, ['nonTradableReason']),
    }
  }

  private async buildAccountFallbackMetrics(userId: string, strategyTemplateId: string | null): Promise<{
    returnPct: number | null
    winRatePct: number | null
    tradeCount: number | null
  } | null> {
    if (!strategyTemplateId) return null

    const account = await this.repo.findUserStrategyAccount?.(userId, strategyTemplateId) as StrategyAccountFallback | null
    if (!account) return null

    const tradeStats = await this.repo.loadTradeStats?.(account.id)
    if (!tradeStats) return null
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
  }): Promise<UnifiedBalance | null> {
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
    let timeout: ReturnType<typeof setTimeout> | null = null
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('best effort timeout')),
            AccountStrategyViewService.BEST_EFFORT_EXTERNAL_TIMEOUT_MS,
          )
        }),
      ])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  private pickExchangeBalance(
    balances: UnifiedBalance[],
    preferredAsset: string | null,
  ): UnifiedBalance | null {
    if (!Array.isArray(balances) || balances.length === 0) return null

    const normalizedPreferredAsset = preferredAsset?.trim().toUpperCase() ?? 'USDT'
    const preferred = balances.find(balance => balance.asset?.trim().toUpperCase() === normalizedPreferredAsset)
    if (preferred) {
      return {
        asset: preferred.asset,
        free: preferred.free,
        locked: preferred.locked,
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
        mode: dto.mode ?? null,
        leverage: this.readNumber(dto.deploymentExecutionConfig ?? {}, ['leverage']) ?? null,
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
    marketType: MarketType
    deploymentExecutionConfig: {
      leverage: number
      priceSource: string
      orderType: string
      timeInForce: string
    }
    publishedSnapshotId: string
    snapshotHash: string
    sourceStrategyInstanceId: string | null
    sourceStrategyTemplateId: string | null
    snapshot: unknown
    exchangeAccountId: string | null
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

    const runtimeExecutionStateService = this.requireRuntimeExecutionStateService()
    try {
      const semanticKeys = runtimeExecutionStateService.buildExecutionSemanticKeysFromSnapshot(snapshot)
      if (
        !semanticKeys.length
        && !this.isContinuousOfficialStrategyPlazaSnapshot(snapshot)
        && !this.hasDeployableCompiledDecisionSnapshot(snapshot)
      ) {
        throw new DeploySnapshotRequiresRepublishException({
          publishedSnapshotId: snapshot.id,
        })
      }
    } catch (error) {
      if (error instanceof DomainException || error instanceof DeploySnapshotRequiresRepublishException) {
        throw error
      }

      throw new DeploySnapshotRequiresRepublishException({
        publishedSnapshotId: snapshot.id,
      })
    }

    const strategyConfig = this.readRecord((snapshot as Record<string, unknown>).strategyConfig)
    const deploymentExecutionDefaults = this.readRecord((snapshot as Record<string, unknown>).deploymentExecutionDefaults)
    const deploymentExecutionConstraints = this.readRecord((snapshot as Record<string, unknown>).deploymentExecutionConstraints)
    if (!strategyConfig || !deploymentExecutionDefaults || !deploymentExecutionConstraints) {
      throw new DomainException('account_strategy.invalid_snapshot_execution_config', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    const exchange = this.readString(strategyConfig, ['exchange', 'exchangeId', 'provider']) as
      | 'binance'
      | 'okx'
      | 'hyperliquid'
      | null
    const symbol = this.readString(strategyConfig, ['symbol'])
    const timeframe = this.readString(strategyConfig, ['baseTimeframe', 'timeframe', 'period'])
    const positionPct = this.readNumber(strategyConfig, ['positionPct', 'positionSizeRatioPercent'])
    const marketType = this.readSnapshotMarketType(strategyConfig)

    if (!exchange || !symbol || !timeframe || positionPct === null || !marketType) {
      throw new DomainException('account_strategy.deploy_missing_required_fields', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: {
          exchange,
          symbol,
          timeframe,
          positionPct,
          marketType,
          publishedSnapshotId,
        },
      })
    }

    const resolvedExchangeAccount = await this.resolveDeployExchangeAccountForFunding({
      userId: dto.userId!,
      exchange,
      exchangeAccountId: dto.exchangeAccountId ?? null,
    })
    const leverageConstraints = await this.resolveEffectiveLeverageConstraints({
      userId: dto.userId!,
      exchangeId: exchange,
      marketType,
      symbol,
      exchangeAccountId: resolvedExchangeAccount.id,
      deploymentExecutionConstraints,
    })
    if (!leverageConstraints) {
      throw new DomainException('account_strategy.invalid_snapshot_execution_config', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    const requestedLeverage = this.readNumber(dto.deploymentExecutionConfig ?? {}, ['leverage'])
      ?? this.readNumber(deploymentExecutionDefaults, ['leverage'])
      ?? this.readNumber(deploymentExecutionConstraints, ['defaultLeverage'])
    if (
      requestedLeverage === null
      || requestedLeverage < leverageConstraints.min
      || requestedLeverage > leverageConstraints.max
    ) {
      throw new DomainException('account_strategy.invalid_deployment_leverage', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    if (!snapshot.strategyInstanceId) {
      throw new DeploySnapshotRequiresRepublishException({
        publishedSnapshotId: snapshot.id,
      })
    }

    return {
      exchange,
      symbol,
      timeframe,
      positionPct,
      marketType,
      deploymentExecutionConfig: {
        leverage: requestedLeverage,
        priceSource: this.readString(deploymentExecutionDefaults, ['priceSource']) ?? 'close',
        orderType: this.readString(deploymentExecutionDefaults, ['orderType']) ?? 'market',
        timeInForce: this.readString(deploymentExecutionDefaults, ['timeInForce']) ?? 'GTC',
      },
      publishedSnapshotId: snapshot.id,
      snapshotHash: snapshot.snapshotHash,
      sourceStrategyInstanceId: snapshot.strategyInstanceId,
      sourceStrategyTemplateId: snapshot.strategyTemplateId,
      snapshot,
      exchangeAccountId: resolvedExchangeAccount.id,
    }
  }

  private async resolveDeployExchangeAccountForFunding(input: {
    userId: string
    exchange: 'binance' | 'okx' | 'hyperliquid'
    exchangeAccountId: string | null
  }): Promise<{ id: string | null }> {
    const resolver = (this.repo as Partial<AccountStrategyViewRepository>).resolveDeployExchangeAccount
    if (!resolver) {
      return { id: input.exchangeAccountId }
    }
    return resolver.call(this.repo, input)
  }

  private async resolveEffectiveLeverageConstraints(input: {
    userId: string
    exchangeId: ExchangeId | null
    marketType: MarketType
    symbol: string | null
    exchangeAccountId: string | null
    deploymentExecutionConstraints: Record<string, unknown> | null
  }): Promise<{ min: number, max: number, accountMax: number | null } | null> {
    if (!input.exchangeId || !input.symbol || !input.deploymentExecutionConstraints) return null
    if (input.marketType === 'spot') {
      return { min: 1, max: 1, accountMax: 1 }
    }
    const effectiveAllowedLeverageRange = this.readRecord(input.deploymentExecutionConstraints.effectiveAllowedLeverageRange)
    const effectiveRangeMin = effectiveAllowedLeverageRange
      ? this.readNumber(effectiveAllowedLeverageRange, ['min'])
      : null
    const effectiveRangeMax = effectiveAllowedLeverageRange
      ? this.readNumber(effectiveAllowedLeverageRange, ['max'])
      : null
    const rawPlatformRiskMaxLeverage = this.readNumber(input.deploymentExecutionConstraints, ['platformRiskMaxLeverage'])
    const platformRiskMaxLeverage =
      rawPlatformRiskMaxLeverage === 1 && !effectiveAllowedLeverageRange ? null : rawPlatformRiskMaxLeverage
    const strategyDeclaredLeverageRange = this.readRecord(input.deploymentExecutionConstraints.strategyDeclaredLeverageRange)
    const strategyMin = strategyDeclaredLeverageRange ? this.readNumber(strategyDeclaredLeverageRange, ['min']) : null
    const strategyMax = strategyDeclaredLeverageRange ? this.readNumber(strategyDeclaredLeverageRange, ['max']) : null
    const accountConstraints = this.tradingService?.getLeverageConstraints
      ? await this.tradingService.getLeverageConstraints({
          userId: input.userId,
          exchangeId: input.exchangeId,
          marketType: input.marketType,
          symbol: input.symbol,
          exchangeAccountId: input.exchangeAccountId ?? undefined,
        })
      : null
    const accountMin = typeof accountConstraints?.minLeverage === 'number' ? accountConstraints.minLeverage : 1
    const accountMax = typeof accountConstraints?.maxLeverage === 'number' ? accountConstraints.maxLeverage : null
    const min = Math.max(accountMin, effectiveRangeMin ?? 1, strategyMin ?? 1)
    const maxCandidates = [effectiveRangeMax, platformRiskMaxLeverage, strategyMax, accountMax].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    const max = maxCandidates.length > 0
      ? Math.min(...maxCandidates)
      : AccountStrategyViewService.DEFAULT_PERP_DEPLOY_MAX_LEVERAGE
    if (!max || max < min) return null
    return { min, max, accountMax }
  }

  private isContinuousOfficialStrategyPlazaSnapshot(snapshot: unknown): boolean {
    const record = this.readRecord(snapshot)
    const executionEnvelope = this.readRecord(record?.executionEnvelope)
    if (!executionEnvelope) return false

    return this.readString(executionEnvelope, ['source']) === 'strategy-plaza-official-template'
      && this.readString(executionEnvelope, ['runtime']) === 'signal-generator'
  }

  private hasDeployableCompiledDecisionSnapshot(snapshot: unknown): boolean {
    const record = this.readRecord(snapshot)
    const astSnapshot = this.readRecord(record?.astSnapshot)
    if (!record || !astSnapshot) return false
    if (this.readString(astSnapshot, ['astVersion']) !== 'csa.v1') return false
    if (!this.isCompilerV1Snapshot(record, astSnapshot)) return false

    const decisionPrograms = astSnapshot.decisionPrograms
    if (!Array.isArray(decisionPrograms)) return false

    return decisionPrograms.some(program => this.isDeployableDecisionProgram(program))
  }

  private isCompilerV1Snapshot(
    snapshot: Record<string, unknown>,
    astSnapshot: Record<string, unknown>,
  ): boolean {
    const compiledManifest = this.readRecord(snapshot.compiledManifest)
    const astManifest = this.readRecord(astSnapshot.manifest)
    if (this.readString(compiledManifest ?? {}, ['compileVersion']) === 'compiler.v1') return true
    if (this.readString(astManifest ?? {}, ['compileVersion']) === 'compiler.v1') return true

    const scriptSnapshot = snapshot.scriptSnapshot
    return typeof scriptSnapshot === 'string' && scriptSnapshot.includes('@generated by compiler.v1')
  }

  private isDeployableDecisionProgram(program: unknown): boolean {
    const record = this.readRecord(program)
    if (!record) return false
    const phase = this.readString(record, ['phase'])
    if (phase !== 'entry' && phase !== 'exit' && phase !== 'rebalance') return false
    if (!this.readString(record, ['id'])) return false
    if (!this.readString(record, ['sourceRef'])) return false
    if (!this.readString(record, ['when'])) return false

    const actions = record.actions
    if (!Array.isArray(actions) || actions.length === 0) return false

    return actions.some((action) => {
      const actionRecord = this.readRecord(action)
      return !!actionRecord && !!this.readString(actionRecord, ['kind'])
    })
  }

  private readSnapshotMarketType(source: Record<string, unknown> | null | undefined): MarketType | null {
    const raw = source ? this.readString(source, ['marketType']) : null
    if (raw === 'spot' || raw === 'perp') return raw
    return null
  }

  private stripLeverageFromExecutionConfig(
    config: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (!config) return null
    const { leverage: _leverage, ...rest } = config
    return rest
  }

  private stripLeverageFromExecutionConstraints(
    constraints: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (!constraints) return null
    const {
      defaultLeverage: _defaultLeverage,
      platformRiskMaxLeverage: _platformRiskMaxLeverage,
      strategyDeclaredLeverageRange: _strategyDeclaredLeverageRange,
      effectiveAllowedLeverageRange: _effectiveAllowedLeverageRange,
      accountMaxLeverage: _accountMaxLeverage,
      ...rest
    } = constraints
    return rest
  }
}
