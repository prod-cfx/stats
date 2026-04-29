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

  const y = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
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

function normalizeMarketType(value: unknown): AiQuantStrategyRecord['marketType'] {
  if (value === 'spot' || value === 'perp' || value === 'futures' || value === 'swap') return value
  return 'unknown'
}

function normalizeExchange(value: unknown): AiQuantStrategyRecord['exchange'] {
  if (value === 'okx' || value === 'hyperliquid') return value
  return 'binance'
}

function findRuleActions(
  ruleSummary: AiQuantStrategyRecord['ruleSummary'],
  phase: string,
): string[] {
  const actions = ruleSummary?.rules
    .filter(item => item.phase === phase)
    .flatMap(item => item.actions) ?? []
  return Array.from(new Set(actions))
}

function classifyOrderSemantic(input: {
  side: string
  marketType: AiQuantStrategyRecord['marketType']
  entryActions: string[]
  exitActions: string[]
}): { semanticAction: string; semanticRole: 'entry' | 'exit' | 'unknown' } {
  const side = input.side.toUpperCase()
  const marketType = input.marketType ?? 'unknown'

  if (marketType === 'spot') {
    if (side === 'BUY') return { semanticAction: '买入', semanticRole: 'entry' }
    if (side === 'SELL') return { semanticAction: '卖出', semanticRole: 'exit' }
    return { semanticAction: side || '语义待确认', semanticRole: 'unknown' }
  }

  if (marketType === 'perp' || marketType === 'futures' || marketType === 'swap') {
    const entryCandidates: Array<{ action: string; side: string; label: string }> = [
      { action: 'OPEN_LONG', side: 'BUY', label: '开多' },
      { action: 'OPEN_SHORT', side: 'SELL', label: '开空' },
    ].filter(candidate => input.entryActions.includes(candidate.action) && candidate.side === side)
    const exitCandidates: Array<{ action: string; side: string; label: string }> = [
      { action: 'CLOSE_LONG', side: 'SELL', label: '平多' },
      { action: 'CLOSE_SHORT', side: 'BUY', label: '平空' },
      { action: 'FORCE_EXIT', side, label: '平仓' },
    ].filter(candidate => input.exitActions.includes(candidate.action) && candidate.side === side)

    if (entryCandidates.length === 1 && exitCandidates.length === 0) {
      return { semanticAction: entryCandidates[0]!.label, semanticRole: 'entry' }
    }
    if (exitCandidates.length === 1 && entryCandidates.length === 0) {
      return { semanticAction: exitCandidates[0]!.label, semanticRole: 'exit' }
    }
    if (entryCandidates.length > 0 || exitCandidates.length > 0) {
      return { semanticAction: '语义待确认', semanticRole: 'unknown' }
    }

    if (side === 'BUY' || side === 'SELL') return { semanticAction: '合约成交', semanticRole: 'unknown' }
    return { semanticAction: side || '语义待确认', semanticRole: 'unknown' }
  }

  return { semanticAction: side || '语义待确认', semanticRole: 'unknown' }
}

function buildRuntimeSemanticSummary(input: {
  status: AiQuantStrategyRecord['status']
  marketType: AiQuantStrategyRecord['marketType']
  symbol: string
  positionOverview: AiQuantStrategyRecord['positionOverview']
  latestOrders: NonNullable<AiQuantStrategyRecord['latestOrders']>
}): AiQuantStrategyRecord['runtimeSemanticSummary'] {
  const marketType = input.marketType ?? 'unknown'
  const openPositionsCount = input.positionOverview?.openPositionsCount ?? null
  const hasOpenPosition = typeof openPositionsCount === 'number' && openPositionsCount > 0
  const latestEntry = input.latestOrders.find(order => order.semanticRole === 'entry') ?? null
  const latestExit = input.latestOrders.find(order => order.semanticRole === 'exit') ?? null
  const latestSync = input.latestOrders.find(order => order.orderId?.startsWith('sync-')) ?? null
  const entryOrders = input.latestOrders
    .filter(order => order.semanticRole === 'entry')
    .map(order => ({ orderId: order.orderId, executedAt: order.executedAt }))
  const exitOrders = input.latestOrders
    .filter(order => order.semanticRole === 'exit')
    .map(order => ({ orderId: order.orderId, executedAt: order.executedAt }))
  const syncOrders = input.latestOrders
    .filter(order => order.orderId?.startsWith('sync-'))
    .map(order => ({ orderId: order.orderId, executedAt: order.executedAt }))
  const latestSemanticAction = input.latestOrders[0]?.semanticAction ?? null

  const serviceStatusLabel = input.status === 'running'
    ? '运行中'
    : input.status === 'stopped'
      ? '已停止'
      : '草稿'

  let positionStatusLabel = '状态待确认'
  let cycleStatusLabel = '查看成交与规则'
  let explanation = '当前策略类型暂未提供专用语义解释，请结合成交记录、持仓概览和发布快照规则核对。'
  let nextExpectedAction: string | null = null
  let positionState: NonNullable<AiQuantStrategyRecord['runtimeSemanticSummary']>['positionState'] = 'unknown'
  let cycleState: NonNullable<AiQuantStrategyRecord['runtimeSemanticSummary']>['cycleState'] = 'unknown'

  if (marketType === 'spot') {
    if (hasOpenPosition) {
      positionStatusLabel = '持有现货'
      cycleStatusLabel = '等待出场'
      positionState = 'spot_holding'
      cycleState = 'entered'
      explanation = `当前持有 ${input.symbol} 现货仓位，策略服务${serviceStatusLabel}，等待出场条件触发。`
      nextExpectedAction = '等待出场条件触发'
    } else if (latestEntry && latestExit) {
      positionStatusLabel = '空仓'
      cycleStatusLabel = '本轮已完成'
      positionState = 'flat'
      cycleState = 'completed'
      explanation = input.status === 'running'
        ? `本轮现货交易已完成，当前未持有 ${input.symbol}。策略服务运行中，等待下一次入场条件。`
        : `本轮现货交易已完成，当前未持有 ${input.symbol}。策略服务${serviceStatusLabel}。`
      nextExpectedAction = input.status === 'running' ? '等待下一次入场条件' : null
    } else {
      positionStatusLabel = '空仓'
      cycleStatusLabel = '等待入场'
      positionState = 'flat'
      cycleState = 'waiting_entry'
      explanation = `当前未持有 ${input.symbol}。策略服务${serviceStatusLabel}，等待入场条件触发。`
      nextExpectedAction = input.status === 'running' ? '等待入场条件触发' : null
    }
  } else if (marketType === 'perp' || marketType === 'futures' || marketType === 'swap') {
    if (hasOpenPosition) {
      const entryAction = latestEntry?.semanticAction
      if (entryAction === '开多' || entryAction === '开空') {
        positionStatusLabel = entryAction === '开空' ? '持有空头' : '持有多头'
        cycleStatusLabel = '等待出场'
        positionState = entryAction === '开空' ? 'short' : 'long'
        cycleState = 'entered'
        explanation = `当前${positionStatusLabel}仓位，策略服务${serviceStatusLabel}，等待出场条件触发。`
        nextExpectedAction = '等待出场条件触发'
      } else {
        positionStatusLabel = '方向待确认'
        cycleStatusLabel = '查看成交与规则'
        positionState = 'unknown'
        cycleState = 'unknown'
        explanation = `当前存在未平仓位，但最近成交无法确认多空方向。请结合持仓概览、最新成交和发布快照规则核对。`
        nextExpectedAction = null
      }
    } else if (latestExit) {
      positionStatusLabel = '无仓位'
      cycleStatusLabel = '上一轮已平仓'
      positionState = 'flat'
      cycleState = 'completed'
      explanation = input.status === 'running'
        ? `上一轮合约仓位已平，当前无未平仓位。策略服务运行中，等待下一次入场条件。`
        : `上一轮合约仓位已平，当前无未平仓位。策略服务${serviceStatusLabel}。`
      nextExpectedAction = input.status === 'running' ? '等待下一次入场条件' : null
    } else {
      positionStatusLabel = '无仓位'
      cycleStatusLabel = '等待入场'
      positionState = 'flat'
      cycleState = 'waiting_entry'
      explanation = `当前无未平仓位。策略服务${serviceStatusLabel}，等待入场条件触发。`
      nextExpectedAction = input.status === 'running' ? '等待入场条件触发' : null
    }
  }

  if (input.status === 'stopped' && hasOpenPosition) {
    cycleStatusLabel = '需处理'
    cycleState = 'needs_attention'
    explanation = `策略服务已停止，但本地台账仍显示存在未平仓位，请核对交易所仓位和本地记录。`
    nextExpectedAction = '核对并处理未平仓位'
  } else if (input.status === 'stopped' && !hasOpenPosition && cycleState === 'waiting_entry') {
    cycleStatusLabel = '待启动'
    cycleState = 'unknown'
    explanation = `策略服务已停止，当前无未平仓位。启动策略后才会继续等待入场条件。`
    nextExpectedAction = null
  }

  return {
    serviceStatusLabel,
    positionStatusLabel,
    cycleStatusLabel,
    headline: `${serviceStatusLabel} · ${positionStatusLabel} · ${cycleStatusLabel}`,
    explanation,
    nextExpectedAction,
    marketType,
    positionState,
    cycleState,
    evidence: {
      openPositionsCount,
      latestEntryOrderId: latestEntry?.orderId ?? null,
      latestExitOrderId: latestExit?.orderId ?? null,
      latestSyncOrderId: latestSync?.orderId ?? null,
      entryOrders,
      exitOrders,
      syncOrders,
      latestEntryAt: latestEntry?.executedAt ?? null,
      latestExitAt: latestExit?.executedAt ?? null,
      latestSemanticAction,
    },
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

function normalizeRuleSummary(
  summary: AccountAiQuantStrategyDetail['snapshot']['ruleSummary'] | null | undefined,
): AiQuantStrategyRecord['ruleSummary'] {
  if (!summary || !Array.isArray(summary.rules)) return null
  const rules = summary.rules.map(rule => ({
    id: typeof rule.id === 'string' ? rule.id : null,
    phase: typeof rule.phase === 'string' ? rule.phase : null,
    conditionKey: typeof rule.conditionKey === 'string' ? rule.conditionKey : null,
    operator: typeof rule.operator === 'string' ? rule.operator : null,
    value: typeof rule.value === 'number' && Number.isFinite(rule.value) ? rule.value : null,
    actions: Array.isArray(rule.actions)
      ? rule.actions.filter((action): action is string => typeof action === 'string' && action.trim().length > 0)
      : [],
  }))
  return {
    rules,
    executionPolicy: summary.executionPolicy ?? null,
  }
}

function normalizeRuntimeExecutionStates(
  states: AccountAiQuantRuntimeExecutionState[] | null | undefined,
): AiQuantStrategyRecord['runtimeExecutionStates'] {
  if (!Array.isArray(states) || states.length === 0) return []

  return states.map(state => ({
    executionSemanticKey: state.executionSemanticKey,
    status: state.status,
    failureFamily: state.failureFamily ?? null,
    failureReason: state.failureReason ?? null,
    failureCode: state.failureCode ?? null,
    lastAttemptAt: state.lastAttemptAt ?? null,
    consumedAt: state.consumedAt ?? null,
    cooldownUntil: state.cooldownUntil ?? null,
    publishedSnapshotId: state.publishedSnapshotId,
    snapshotHash: state.snapshotHash,
  }))
}

function normalizeRuntimeSemanticSummary(
  summary: AccountAiQuantStrategyDetail['runtimeSemanticSummary'] | null | undefined,
): AiQuantStrategyRecord['runtimeSemanticSummary'] | null {
  if (!summary) return null

  return {
    serviceStatusLabel: summary.serviceStatusLabel,
    positionStatusLabel: summary.positionStatusLabel,
    cycleStatusLabel: summary.cycleStatusLabel,
    headline: summary.headline,
    explanation: summary.explanation,
    nextExpectedAction: summary.nextExpectedAction,
    marketType: normalizeMarketType(summary.marketType),
    positionState: summary.positionState,
    cycleState: summary.cycleState,
    evidence: {
      openPositionsCount: summary.evidence.openPositionsCount,
      latestEntryOrderId: summary.evidence.latestEntryOrderId,
      latestExitOrderId: summary.evidence.latestExitOrderId,
      latestSyncOrderId: summary.evidence.latestSyncOrderId,
      entryOrders: summary.evidence.entryOrders.map(order => ({
        orderId: order.orderId,
        executedAt: fmtTimelineTime(order.executedAt),
      })),
      exitOrders: summary.evidence.exitOrders.map(order => ({
        orderId: order.orderId,
        executedAt: fmtTimelineTime(order.executedAt),
      })),
      syncOrders: summary.evidence.syncOrders.map(order => ({
        orderId: order.orderId,
        executedAt: fmtTimelineTime(order.executedAt),
      })),
      latestEntryAt: summary.evidence.latestEntryAt ? fmtTimelineTime(summary.evidence.latestEntryAt) : null,
      latestExitAt: summary.evidence.latestExitAt ? fmtTimelineTime(summary.evidence.latestExitAt) : null,
      latestSemanticAction: summary.evidence.latestSemanticAction,
    },
  }
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
    exchange: normalizeExchange(item.exchange),
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
  const exchange = normalizeExchange(resolvedExchange)
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
  const hasPublishedSnapshotBinding = Boolean(detail.snapshot.publishedSnapshotId)
  const dynamicParams = mapDynamicParamFields(
    hasPublishedSnapshotBinding ? detail.snapshot.paramSchema : (detail.snapshot.paramSchema ?? detail.paramSchema),
    hasPublishedSnapshotBinding ? detail.snapshot.paramValues : (detail.snapshot.paramValues ?? detail.paramValues),
    hasPublishedSnapshotBinding ? detail.snapshot.schemaVersion : (detail.snapshot.schemaVersion ?? detail.schemaVersion),
  )
  const snapshotMarketType = normalizeMarketType(detail.snapshot.strategyConfig?.marketType)
  const deploymentMarketType = snapshotMarketType === 'unknown' ? null : snapshotMarketType === 'spot' || snapshotMarketType === 'perp' ? snapshotMarketType : null
  const invalidBinding = detail.snapshot.compatibilityMetadata?.invalidBinding === true
  const ruleSummary = normalizeRuleSummary(detail.snapshot.ruleSummary)
  const entryActions = findRuleActions(ruleSummary, 'entry')
  const exitActions = findRuleActions(ruleSummary, 'exit')
  const positionOverview = detail.positionOverview
    ? {
        openPositionsCount: detail.positionOverview.openPositionsCount ?? null,
        closedPositionsCount: detail.positionOverview.closedPositionsCount ?? null,
        totalRealizedPnl: detail.positionOverview.totalRealizedPnl ?? null,
        totalUnrealizedPnl: detail.positionOverview.totalUnrealizedPnl ?? null,
      }
    : undefined
  const latestOrders = Array.isArray(detail.latestOrders)
    ? detail.latestOrders.map((order) => {
        const semantic = classifyOrderSemantic({
          side: order.side,
          marketType: snapshotMarketType,
          entryActions,
          exitActions,
        })
        return {
          executedAt: fmtTimelineTime(order.executedAt),
          side: order.side,
          semanticAction: semantic.semanticAction,
          semanticRole: semantic.semanticRole,
          symbol: order.symbol,
          price: typeof order.price === 'number' && Number.isFinite(order.price) ? order.price : null,
          quantity: typeof order.quantity === 'number' && Number.isFinite(order.quantity) ? order.quantity : null,
          fee: typeof order.fee === 'number' && Number.isFinite(order.fee) ? order.fee : null,
          feeCurrency: order.feeCurrency ?? null,
          orderId: order.orderId ?? null,
          source: order.source,
          ledgerApplied: order.ledgerApplied,
          reconcileRequired: order.reconcileRequired,
          executionStatus: order.executionStatus ?? null,
        }
      })
    : []

  const record: AiQuantStrategyRecord = {
    id: detail.id,
    name: detail.name,
    status: normalizeStatus(detail.status),
    exchange,
    symbol: detail.snapshot.symbol ?? detail.symbol ?? '--',
    marketType: snapshotMarketType,
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
      : normalizeDeploymentExecutionConfig(detail.snapshot.deploymentExecutionBaseline, deploymentMarketType),
    deploymentExecutionCurrent: invalidBinding
      ? null
      : normalizeDeploymentExecutionConfig(detail.snapshot.deploymentExecutionCurrent, deploymentMarketType),
    executionConfigVersion:
      typeof detail.snapshot.executionConfigVersion === 'number'
        ? detail.snapshot.executionConfigVersion
        : null,
    deploymentLeverageRange: !invalidBinding && deploymentMarketType === 'perp'
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
    ruleSummary,
    canEditDeploymentLeverage:
      !invalidBinding
      && deploymentMarketType === 'perp'
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
    positionOverview,
    latestOrders,
    openOrdersCount: typeof detail.openOrdersCount === 'number' && Number.isFinite(detail.openOrdersCount)
      ? detail.openOrdersCount
      : detail.openOrdersCount ?? null,
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
  return {
    ...record,
    runtimeSemanticSummary: normalizeRuntimeSemanticSummary(detail.runtimeSemanticSummary) ?? buildRuntimeSemanticSummary({
      status: record.status,
      marketType: record.marketType,
      symbol: record.symbol,
      positionOverview: record.positionOverview,
      latestOrders,
    }),
  }
}
