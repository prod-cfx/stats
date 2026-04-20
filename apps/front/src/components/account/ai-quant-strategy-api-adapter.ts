import type { AiQuantStrategyRecord, AiQuantStrategyViewState } from './ai-quant-strategy-store'
import type {
  AccountAiQuantBacktestConfigDefaults,
  AccountAiQuantConsistencySummary,
  AccountAiQuantDeploymentExecutionConfig,
  AccountAiQuantDeploymentExecutionConstraints,
  AccountAiQuantLeverageRange,
  AccountAiQuantPublishedStrategyConfig,
  AccountAiQuantRuntimeExecutionState,
  AccountAiQuantSnapshotCompatibilityMetadata,
  AccountAiQuantStrategyDetail,
  AccountAiQuantStrategyListItem,
  AccountAiQuantStrategyApiState,
} from '@/lib/api'

function normalizeNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeStatus(status: AccountAiQuantStrategyApiState): AiQuantStrategyViewState {
  if (status === 'running') return 'running'
  if (status === 'draft') return 'draft'
  return 'stopped'
}

function fmtTimelineTime(ts: string): string {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ts

  const y = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${mm}-${dd} ${hh}:${min}`
}

function mapDynamicParamFields(
  paramSchema: Record<string, unknown> | null | undefined,
  paramValues: Record<string, unknown> | null | undefined,
  schemaVersion: string | null | undefined,
) {
  if (!paramSchema) {
    return {
      paramSchema: null,
      paramValues: null,
      schemaVersion: schemaVersion ?? null,
      supportsDynamicParams: false,
    }
  }

  return {
    paramSchema,
    paramValues: paramValues ?? {},
    schemaVersion: schemaVersion ?? null,
    supportsDynamicParams: true,
  }
}

function normalizeLeverageRange(
  range: AccountAiQuantLeverageRange | null | undefined,
): { min: number, max: number } | null {
  if (!range) return null
  const min = normalizeNumber(range.min)
  const max = normalizeNumber(range.max)
  if (min <= 0 || max <= 0 || max < min) return null
  return { min, max }
}

function normalizeBacktestConfigDefaults(
  config: AccountAiQuantBacktestConfigDefaults | null | undefined,
): AiQuantStrategyRecord['snapshotBacktestConfigDefaults'] {
  if (!config) return null
  const initialCash = normalizeNumber(config.initialCash)
  const leverage = normalizeNumber(config.leverage)
  const slippageBps = normalizeNumber(config.slippageBps)
  const feeBps = normalizeNumber(config.feeBps)
  const priceSource = typeof config.priceSource === 'string' ? config.priceSource : ''
  if (!initialCash || !priceSource) return null
  const normalized = {
    initialCash,
    leverage: leverage > 0 ? leverage : null,
    slippageBps,
    feeBps,
    priceSource,
    allowPartial: config.allowPartial === true,
    stateTimeframes: Array.isArray(config.stateTimeframes)
      ? config.stateTimeframes
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map(item => item.trim())
      : [],
  }
  return normalized
}

function normalizeDeploymentExecutionConfig(
  config: AccountAiQuantDeploymentExecutionConfig | null | undefined,
  marketType: 'spot' | 'perp' | null,
): AiQuantStrategyRecord['deploymentExecutionBaseline'] {
  if (!config) return null
  return {
    leverage: marketType === 'perp' && typeof config.leverage === 'number' && Number.isFinite(config.leverage)
      ? config.leverage
      : null,
    priceSource: typeof config.priceSource === 'string' ? config.priceSource : null,
    orderType: typeof config.orderType === 'string' ? config.orderType : null,
    timeInForce: typeof config.timeInForce === 'string' ? config.timeInForce : null,
  }
}

function normalizeCompatibilityMetadata(
  metadata: AccountAiQuantSnapshotCompatibilityMetadata | null | undefined,
): AiQuantStrategyRecord['compatibilityMetadata'] {
  if (!metadata) return null
  return {
    isLegacySnapshot: metadata.isLegacySnapshot === true,
    missingBacktestConfigDefaults: metadata.missingBacktestConfigDefaults === true,
    missingDeploymentExecutionDefaults: metadata.missingDeploymentExecutionDefaults === true,
    missingDeploymentExecutionConstraints: metadata.missingDeploymentExecutionConstraints === true,
    requiresRepublishForBacktest: metadata.requiresRepublishForBacktest === true,
    requiresRepublishForDeploy: metadata.requiresRepublishForDeploy === true,
    ...(metadata.invalidBinding === true ? { invalidBinding: true } : {}),
  }
}

function normalizeConsistencySummary(
  summary: AccountAiQuantConsistencySummary | null | undefined,
): AiQuantStrategyRecord['consistencySummary'] {
  if (!summary) return null
  return {
    isConsistent: summary.isConsistent === true,
    driftReasons: Array.isArray(summary.driftReasons) ? summary.driftReasons.filter(Boolean) : [],
    consistencyScore: typeof summary.consistencyScore === 'number' ? summary.consistencyScore : null,
  }
}

function normalizeRuntimeExecutionStates(
  states: AccountAiQuantRuntimeExecutionState[] | null | undefined,
): AiQuantStrategyRecord['runtimeExecutionStates'] {
  if (!Array.isArray(states) || states.length === 0) return []

  return states.map(state => ({
    executionSemanticKey: state.executionSemanticKey,
    status: state.status,
    failureReason: state.failureReason ?? null,
    failureCode: state.failureCode ?? null,
    lastAttemptAt: state.lastAttemptAt ?? null,
    consumedAt: state.consumedAt ?? null,
    cooldownUntil: state.cooldownUntil ?? null,
    publishedSnapshotId: state.publishedSnapshotId,
    snapshotHash: state.snapshotHash,
  }))
}

function buildStrategyBoundPublishedSnapshotParamValues(input: {
  exchange: AiQuantStrategyRecord['exchange']
  strategyConfig: AccountAiQuantPublishedStrategyConfig | null | undefined
  fallbackSymbol: string
  fallbackTimeframe: string
  fallbackPositionPct: number
}): Record<string, unknown> | null {
  const {
    exchange,
    strategyConfig,
    fallbackSymbol,
    fallbackTimeframe,
    fallbackPositionPct,
  } = input

  if (strategyConfig) {
    return {
      exchange: strategyConfig.exchange ?? exchange,
      symbol: strategyConfig.symbol ?? fallbackSymbol,
      ...(strategyConfig.marketType ? { marketType: strategyConfig.marketType } : {}),
      baseTimeframe: strategyConfig.baseTimeframe ?? fallbackTimeframe,
      positionPct: normalizeNumber(strategyConfig.positionPct ?? fallbackPositionPct),
    }
  }

  return null
}

export function mapAccountStrategyListItemToRecord(
  item: AccountAiQuantStrategyListItem,
): AiQuantStrategyRecord {
  const dynamicParams = mapDynamicParamFields(item.paramSchema, item.paramValues, item.schemaVersion)

  return {
    id: item.id,
    name: item.name,
    status: normalizeStatus(item.status),
    exchange: (item.exchange === 'okx' ? 'okx' : 'binance'),
    symbol: item.symbol ?? '--',
    timeframe: item.timeframe ?? '--',
    positionPct: normalizeNumber(item.positionPct),
    initialCapital: 10000,
    metrics: {
      returnPct: normalizeNumber(item.metrics.returnPct),
      maxDrawdownPct: normalizeNumber(item.metrics.maxDrawdownPct),
      winRatePct: normalizeNumber(item.metrics.winRatePct),
      tradeCount: normalizeNumber(item.metrics.tradeCount),
    },
    ...dynamicParams,
    equitySeries: [],
    timeline: [],
    updatedAt: item.updatedAt,
  }
}

export function mapAccountStrategyDetailToRecord(
  detail: AccountAiQuantStrategyDetail,
): AiQuantStrategyRecord {
  const snapshotExchange = detail.snapshot.exchange
  const resolvedExchange = snapshotExchange ?? detail.exchange
  const exchange = resolvedExchange === 'okx' ? 'okx' : resolvedExchange === 'hyperliquid' ? 'hyperliquid' : 'binance'
  const publishedSnapshotParamValues = detail.snapshot.publishedSnapshotId
    ? buildStrategyBoundPublishedSnapshotParamValues({
        exchange,
        strategyConfig: detail.snapshot.strategyConfig,
        fallbackSymbol: detail.snapshot.symbol ?? detail.symbol ?? '--',
        fallbackTimeframe: detail.snapshot.timeframe ?? detail.timeframe ?? '--',
        fallbackPositionPct: normalizeNumber(detail.snapshot.positionPct ?? detail.positionPct),
      })
    : null
  const initialCapital = detail.accountOverview?.initialBalance
    ?? detail.equitySeries[0]?.value
    ?? 10000
  const dynamicParams = mapDynamicParamFields(
    detail.snapshot.paramSchema ?? detail.paramSchema,
    detail.snapshot.paramValues ?? detail.paramValues,
    detail.snapshot.schemaVersion ?? detail.schemaVersion,
  )
  const snapshotMarketType =
    detail.snapshot.strategyConfig?.marketType === 'spot' || detail.snapshot.strategyConfig?.marketType === 'perp'
      ? detail.snapshot.strategyConfig.marketType
      : null
  const invalidBinding = detail.snapshot.compatibilityMetadata?.invalidBinding === true

  return {
    id: detail.id,
    name: detail.name,
    status: normalizeStatus(detail.status),
    exchange,
    symbol: detail.snapshot.symbol ?? detail.symbol ?? '--',
    timeframe: detail.snapshot.timeframe ?? detail.timeframe ?? '--',
    positionPct: normalizeNumber(detail.snapshot.positionPct ?? detail.positionPct),
    initialCapital,
    metrics: {
      returnPct: normalizeNumber(detail.metrics.returnPct),
      maxDrawdownPct: normalizeNumber(detail.metrics.maxDrawdownPct),
      winRatePct: normalizeNumber(detail.metrics.winRatePct),
      tradeCount: normalizeNumber(detail.metrics.tradeCount),
    },
    ...dynamicParams,
    runtimeExecutionStates: normalizeRuntimeExecutionStates(detail.runtimeExecutionStates),
    publishedSnapshotParamValues,
    snapshotBacktestConfigDefaults: normalizeBacktestConfigDefaults(detail.snapshot.backtestConfigDefaults),
    deploymentExecutionBaseline: invalidBinding
      ? null
      : normalizeDeploymentExecutionConfig(detail.snapshot.deploymentExecutionBaseline, snapshotMarketType),
    deploymentExecutionCurrent: invalidBinding
      ? null
      : normalizeDeploymentExecutionConfig(detail.snapshot.deploymentExecutionCurrent, snapshotMarketType),
    executionConfigVersion:
      typeof detail.snapshot.executionConfigVersion === 'number'
        ? detail.snapshot.executionConfigVersion
        : null,
    deploymentLeverageRange: !invalidBinding && snapshotMarketType === 'perp'
      ? normalizeLeverageRange(
          detail.snapshot.effectiveAllowedLeverageRange
            ?? detail.snapshot.deploymentExecutionConstraints?.effectiveAllowedLeverageRange,
        )
      : null,
    deploymentConstraintExplanation: invalidBinding
      ? null
      : detail.snapshot.deploymentExecutionConstraints?.constraintExplanation ?? null,
    compatibilityMetadata: normalizeCompatibilityMetadata(detail.snapshot.compatibilityMetadata),
    consistencySummary: normalizeConsistencySummary(detail.snapshot.consistencySummary),
    canEditDeploymentLeverage:
      !invalidBinding
      && snapshotMarketType === 'perp'
      && Boolean(detail.snapshot.deploymentExecutionCurrent)
      && detail.snapshot.compatibilityMetadata?.requiresRepublishForDeploy !== true,
    publishedSnapshotId: detail.snapshot.publishedSnapshotId ?? null,
    snapshotHash: detail.snapshot.snapshotHash ?? null,
    totalPnl: detail.totalPnl ?? null,
    todayPnl: detail.todayPnl ?? null,
    accountOverview: detail.accountOverview
      ? {
          initialBalance: detail.accountOverview.initialBalance ?? null,
          totalEquity: detail.accountOverview.totalEquity ?? null,
          availableBalance: detail.accountOverview.availableBalance ?? null,
          totalPnl: detail.accountOverview.totalPnl ?? null,
          todayPnl: detail.accountOverview.todayPnl ?? null,
          baseCurrency: detail.accountOverview.baseCurrency ?? null,
        }
      : undefined,
    positionOverview: detail.positionOverview
      ? {
          openPositionsCount: detail.positionOverview.openPositionsCount ?? null,
          closedPositionsCount: detail.positionOverview.closedPositionsCount ?? null,
          totalRealizedPnl: detail.positionOverview.totalRealizedPnl ?? null,
          totalUnrealizedPnl: detail.positionOverview.totalUnrealizedPnl ?? null,
        }
      : undefined,
    latestOrders: Array.isArray(detail.latestOrders)
      ? detail.latestOrders.map(order => ({
          executedAt: fmtTimelineTime(order.executedAt),
          side: order.side,
          symbol: order.symbol,
          price: typeof order.price === 'number' && Number.isFinite(order.price) ? order.price : null,
          quantity: typeof order.quantity === 'number' && Number.isFinite(order.quantity) ? order.quantity : null,
          fee: typeof order.fee === 'number' && Number.isFinite(order.fee) ? order.fee : null,
          feeCurrency: order.feeCurrency ?? null,
          orderId: order.orderId ?? null,
        }))
      : [],
    equitySeries: detail.equitySeries.map(item => ({
      ts: fmtTimelineTime(item.ts),
      value: normalizeNumber(item.value),
    })),
    timeline: detail.timeline.map(item => ({
      at: fmtTimelineTime(item.at),
      event: item.event,
      note: item.note ?? undefined,
    })),
    deploy: !invalidBinding && detail.snapshot.deployAt
      ? {
          exchange,
          accountId: '',
          accountName: detail.snapshot.deployAccountName ?? '--',
          at: detail.snapshot.deployAt,
          status: detail.status === 'running' ? 'running' : 'stopped',
        }
      : undefined,
    updatedAt: detail.updatedAt,
  }
}
