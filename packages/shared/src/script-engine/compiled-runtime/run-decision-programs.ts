import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { CompiledRuntimeValue } from './evaluate-expr-pool'
import type { CompiledGuardState } from './evaluate-guards'
import type { OrchestrationGateState } from './evaluate-orchestration-gates'
import type { OrchestrationPortfolioRiskState } from './evaluate-orchestration-portfolio-risks'

// MUST match PartialTakeProfitProgramMetadata in
// apps/quantify/src/modules/llm-strategy-codegen/types/partial-take-profit.ts.
// `packages/shared` cannot import quantify types, so this is a documented mirror.
interface PartialTakeProfitMeta {
  memoryKey: string
  tierIndex: number
  totalTiers: number
  cumulativeReduceRatio?: number
}

interface AddPositionMeta {
  maxLayers?: number
  maxExposurePct?: number
  stateKey: string
  addMode?: 'signal_confirm' | 'profit_pct' | 'drawdown_pct' | string
  addRatio?: number
}

interface ReversePositionMeta {
  fromSide: 'long' | 'short'
  toSide: 'long' | 'short'
  sameBarPolicy: 'allow' | 'next_bar_only'
  sizingSource: 'current_position' | 'fixed' | 'position_sizing'
}

interface DcaScheduleMeta {
  maxCount: number
  capitalCap: number
  maxExposurePct?: number
  stateKey: string
  triggerMode?: 'price_interval' | 'time_interval' | 'signal' | string
  priceIntervalPct?: number
  priceIntervalQuote?: number
  timeIntervalBars?: number
  timeIntervalMs?: number
  exitRule?: Record<string, string>
}

interface SemanticRuntimeStateNumber {
  present: boolean
  value: number
}

interface DecisionProgramNode {
  id: string
  phase: 'entry' | 'exit' | 'rebalance'
  priority: number
  when: string
  cooldownBars?: number
  metadata?: {
    partialTakeProfit?: PartialTakeProfitMeta
    addPosition?: AddPositionMeta
    reversePosition?: ReversePositionMeta
    dcaSchedule?: DcaScheduleMeta
    /** Phase 5 S2 (#1104): 多 scope 策略下该 program 归属的 scope.symbol id */
    symbolScopeRef?: string
    /** Phase 5 S11 (#1112): 多 leg 策略下该 program 归属的 scope.leg id */
    legScopeRef?: string
  }
  actions: Array<{
    kind: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'REDUCE_LONG' | 'REDUCE_SHORT' | 'ADD_LONG' | 'ADD_SHORT'
    quantity: {
      mode: 'pct_equity' | 'fixed_quote' | 'fixed_base' | 'position_pct'
      value: number
    }
  }>
}

// Phase 5 S2 (#1104): scope.symbol substrate compiled runtime
export interface CompiledOrchestrationScope {
  id: string
  scopeKind: 'symbol'
  symbols: readonly string[]
  primarySymbol?: string
}

// Phase 5 S11 (#1112): scope.leg substrate compiled runtime
export interface CompiledOrchestrationLegSizing {
  mode: 'fixed_pct' | 'fixed_quote' | 'fixed_ratio'
  value: number
  pairedLegId?: string
}

export interface CompiledOrchestrationLegScope {
  id: string
  scopeKind: 'leg'
  legId: string
  direction: 'long' | 'short'
  instrumentRef: string
  legSizing?: CompiledOrchestrationLegSizing
  // S11 仅声明透传，runtime 当前不读；follow-up 接入 cross-program 同步触发聚合
  syncTriggerRequired?: boolean
}

interface CompiledDecisionState {
  barIndex: number
  lastTriggeredByProgram: Record<string, number>
  previousPositionQty: number
  pendingReverseByProgram: Record<string, {
    toSide: ReversePositionMeta['toSide']
    actionKind: 'OPEN_LONG' | 'OPEN_SHORT'
    quantity: DecisionProgramNode['actions'][number]['quantity']
    createdBarIndex: number
  }>
}

const PHASE_RANK: Record<DecisionProgramNode['phase'], number> = {
  exit: 0,
  rebalance: 1,
  entry: 2,
}

export function runDecisionPrograms(
  ctx: StrategyExecutionContextV1,
  programs: readonly DecisionProgramNode[],
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
  guardState: Readonly<CompiledGuardState>,
  decisionOrder: readonly string[],
  orchestrationGateState?: OrchestrationGateState,
  portfolioRiskState?: OrchestrationPortfolioRiskState,
  // Phase 5 S2 (#1104): scope.symbol substrate fail-closed
  orchestrationScopes?: readonly CompiledOrchestrationScope[],
  // Phase 5 S11 (#1112): scope.leg substrate fail-closed
  orchestrationLegScopes?: readonly CompiledOrchestrationLegScope[],
): Readonly<StrategyDecisionV1> {
  const compiledState = ensureCompiledDecisionState(ctx)
  compiledState.barIndex = readCurrentBarIndex(ctx, compiledState.barIndex)
  const declaredPartialTakeProfitKeys = collectPartialTakeProfitMemoryKeys(programs)
  resetPartialTakeProfitStateOnEntryEdge(ctx, compiledState, declaredPartialTakeProfitKeys)
  if (guardState.forceExit) {
    clearAllPendingReverse(ctx)
    const currentQty = readCurrentQty(ctx)
    if (currentQty === 0) {
      return Object.freeze({
        action: 'NOOP',
        reason: 'compiled.force_exit.noop',
      })
    }

    return Object.freeze({
      action: currentQty < 0 ? 'CLOSE_SHORT' : 'CLOSE_LONG',
      size: {
        mode: 'QTY' as const,
        value: Math.abs(currentQty),
      },
      reason: 'compiled.force_exit',
    })
  }

  if (guardState.strategyHalt) {
    clearAllPendingReverse(ctx)
    return Object.freeze({
      action: 'NOOP',
      reason: 'compiled.strategy_halt',
    })
  }

  const decisionIndex = new Map(programs.map(program => [program.id, program]))
  const orderedPrograms = decisionOrder
    .map(id => decisionIndex.get(id))
    .filter((program): program is DecisionProgramNode => program !== undefined)
    .sort((left, right) => {
      const phaseDiff = PHASE_RANK[left.phase] - PHASE_RANK[right.phase]
      if (phaseDiff !== 0) return phaseDiff
      if (left.priority !== right.priority) return left.priority - right.priority
      return left.id.localeCompare(right.id)
    })

  for (const program of orderedPrograms) {
    // Phase 5 S11 (#1112): 多 leg 策略 fail-closed 路由 — 先于 symbol 路由
    //   - legScopes.length <= 1: 'continue' 走兜底（单/0 leg 旧策略零侵入）
    //   - legScopes.length >= 2: 'continue' / 'skip' / 失败 decision
    //   - 'skip' = per-program continue（program-A skip 不影响 program-B 执行）
    const legRouting = applyLegScopeRouting(program, ctx, orchestrationLegScopes)
    if (legRouting === 'skip') continue
    if (legRouting !== 'continue') {
      const gated = applyOrchestrationGate(legRouting, orchestrationGateState, portfolioRiskState, ctx)
      return Object.freeze(gated)
    }
    // Phase 5 S2 (#1104): 多 scope 策略 fail-closed 路由
    //   - scopes.length <= 1: 'continue' 走兜底（单/0 scope 旧策略零侵入）
    //   - scopes.length >= 2: 'continue' / 'skip' / 失败 decision
    //   - 失败 decision 走 applyOrchestrationGate 保留 portfolioRisk observedBreaches
    const scopeRouting = applySymbolScopeRouting(program, ctx, orchestrationScopes)
    if (scopeRouting === 'skip') continue
    if (scopeRouting !== 'continue') {
      const gated = applyOrchestrationGate(scopeRouting, orchestrationGateState, portfolioRiskState, ctx)
      return Object.freeze(gated)
    }

    if (program.phase === 'entry' && guardState.blockNewEntry) {
      continue
    }

    const pendingReverseDecision = evaluatePendingReverse(program, ctx)
    if (pendingReverseDecision) {
      compiledState.lastTriggeredByProgram[program.id] = compiledState.barIndex
      const gated = applyOrchestrationGate(pendingReverseDecision, orchestrationGateState, portfolioRiskState, ctx)
      return Object.freeze(gated)
    }
    if (hasPendingReverseForProgram(program, ctx)) {
      continue
    }

    if (
      typeof program.cooldownBars === 'number'
      && program.cooldownBars > 0
      && typeof compiledState.lastTriggeredByProgram[program.id] === 'number'
      && (compiledState.barIndex - compiledState.lastTriggeredByProgram[program.id] < program.cooldownBars)
    ) {
      continue
    }

    if (exprValues[program.when] !== true) {
      continue
    }

    const ptpMeta = program.metadata?.partialTakeProfit
    if (ptpMeta && isPartialTakeProfitTierFired(ctx, ptpMeta)) {
      continue
    }

    const lifecycleDecision = evaluatePositionLifecycle(program, ctx)
    if (lifecycleDecision) {
      compiledState.lastTriggeredByProgram[program.id] = compiledState.barIndex
      const gatedLifecycleDecision = applyOrchestrationGate(
        lifecycleDecision,
        orchestrationGateState,
        portfolioRiskState,
        ctx,
      )
      if (ptpMeta && gatedLifecycleDecision.action !== 'NOOP') {
        markPartialTakeProfitTierFired(ctx, ptpMeta)
      }
      return Object.freeze(gatedLifecycleDecision)
    }

    const decision = buildFirstApplicableDecision(program, ctx)
    if (!decision) continue

    const gatedDecision = applyOrchestrationGate(decision, orchestrationGateState, portfolioRiskState, ctx)
    compiledState.lastTriggeredByProgram[program.id] = compiledState.barIndex
    if (ptpMeta && gatedDecision.action !== 'NOOP') {
      markPartialTakeProfitTierFired(ctx, ptpMeta)
    }
    if (gatedDecision.action !== 'NOOP') {
      markPositionLifecycleState(ctx, program, gatedDecision)
    }
    return Object.freeze(gatedDecision)
  }

  return Object.freeze({
    action: 'NOOP',
    reason: 'compiled.noop',
  })
}

function ensureCompiledDecisionState(
  ctx: StrategyExecutionContextV1,
): CompiledDecisionState {
  const current = (ctx as Record<string, unknown>).__compiledDecisionState
  if (
    current
    && typeof current === 'object'
    && !Array.isArray(current)
    && typeof (current as { barIndex?: unknown }).barIndex === 'number'
    && typeof (current as { lastTriggeredByProgram?: unknown }).lastTriggeredByProgram === 'object'
  ) {
    const c = current as Partial<CompiledDecisionState> & {
      barIndex: number
      lastTriggeredByProgram: Record<string, number>
    }
    if (typeof c.previousPositionQty !== 'number') {
      c.previousPositionQty = 0
    }
    if (
      !c.pendingReverseByProgram
      || typeof c.pendingReverseByProgram !== 'object'
      || Array.isArray(c.pendingReverseByProgram)
    ) {
      c.pendingReverseByProgram = {}
    }
    return c as CompiledDecisionState
  }

  const fallback: CompiledDecisionState = {
    barIndex: 0,
    lastTriggeredByProgram: {},
    previousPositionQty: 0,
    pendingReverseByProgram: {},
  }
  ;(ctx as Record<string, unknown>).__compiledDecisionState = fallback
  return fallback
}

function collectPartialTakeProfitMemoryKeys(
  programs: readonly DecisionProgramNode[],
): ReadonlySet<string> {
  const keys = new Set<string>()
  for (const program of programs) {
    const meta = program.metadata?.partialTakeProfit
    if (meta?.memoryKey) keys.add(meta.memoryKey)
  }
  return keys
}

function resetPartialTakeProfitStateOnEntryEdge(
  ctx: StrategyExecutionContextV1,
  compiledState: CompiledDecisionState,
  memoryKeys: ReadonlySet<string>,
): void {
  const currentQty = readCurrentQty(ctx)
  const prevQty = compiledState.previousPositionQty
  if (prevQty === 0 && currentQty !== 0 && memoryKeys.size > 0) {
    const semanticState = ctx.semanticRuntimeState
    if (semanticState && typeof semanticState === 'object' && !Array.isArray(semanticState)) {
      for (const key of memoryKeys) {
        if (Object.prototype.hasOwnProperty.call(semanticState, key)) {
          semanticState[key] = {}
        }
      }
    }
  }
  compiledState.previousPositionQty = currentQty
}

function isPartialTakeProfitTierFired(
  ctx: StrategyExecutionContextV1,
  meta: PartialTakeProfitMeta,
): boolean {
  const semanticState = ctx.semanticRuntimeState
  const slot = semanticState?.[meta.memoryKey]
  if (!slot || typeof slot !== 'object') return false
  return slot[`tier_${meta.tierIndex}_fired`] === true
}

function markPartialTakeProfitTierFired(
  ctx: StrategyExecutionContextV1,
  meta: PartialTakeProfitMeta,
): void {
  if (!ctx.semanticRuntimeState || typeof ctx.semanticRuntimeState !== 'object') {
    ctx.semanticRuntimeState = {}
  }
  if (!ctx.semanticRuntimeState[meta.memoryKey] || typeof ctx.semanticRuntimeState[meta.memoryKey] !== 'object') {
    ctx.semanticRuntimeState[meta.memoryKey] = {}
  }
  ctx.semanticRuntimeState[meta.memoryKey][`tier_${meta.tierIndex}_fired`] = true
  const firedTiers = readFiredPartialTakeProfitTierCount(ctx.semanticRuntimeState[meta.memoryKey], meta.totalTiers)
  ctx.semanticRuntimeState[meta.memoryKey].firedTiers = firedTiers
  ctx.semanticRuntimeState[meta.memoryKey].lastTierIndex = meta.tierIndex
  if (typeof meta.cumulativeReduceRatio === 'number' && Number.isFinite(meta.cumulativeReduceRatio)) {
    ctx.semanticRuntimeState[meta.memoryKey].cumulativeReduceRatio = meta.cumulativeReduceRatio
  }
}

function readFiredPartialTakeProfitTierCount(
  slot: Record<string, unknown>,
  totalTiers: number,
): number {
  let count = 0
  for (let i = 0; i < totalTiers; i += 1) {
    if (slot[`tier_${i}_fired`] === true) {
      count += 1
    }
  }
  return count
}

function markPositionLifecycleState(
  ctx: StrategyExecutionContextV1,
  program: DecisionProgramNode,
  decision: Readonly<StrategyDecisionV1>,
): void {
  if (decision.action !== 'OPEN_LONG' && decision.action !== 'OPEN_SHORT') {
    return
  }

  const addMeta = program.metadata?.addPosition
  if (addMeta) {
    incrementSemanticRuntimeStateNumber(ctx, addMeta.stateKey)
  }

  const dcaMeta = program.metadata?.dcaSchedule
  if (dcaMeta) {
    incrementSemanticRuntimeStateNumber(ctx, dcaMeta.stateKey)
    incrementDcaSpentQuote(ctx, dcaMeta.stateKey, program)
  }
}

function evaluatePositionLifecycle(
  program: DecisionProgramNode,
  ctx: StrategyExecutionContextV1,
): StrategyDecisionV1 | null {
  const reverseMeta = program.metadata?.reversePosition
  if (reverseMeta) {
    const currentQty = readCurrentQty(ctx)
    if (currentQty === 0) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.reverse.no_position`,
      }
    }
    if (!doesPositionQtyMatchSide(currentQty, reverseMeta.fromSide)) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.reverse.side_mismatch`,
      }
    }

    const openAction = findReverseOpenAction(program, reverseMeta.toSide)
    const resolvedOpenQuantity = openAction
      ? resolveReverseOpenQuantity(openAction, ctx, Math.abs(currentQty), reverseMeta.sizingSource)
      : null
    if (reverseMeta.sameBarPolicy === 'allow' && openAction) {
      const oppositeQty = resolvedOpenQuantity
        ? resolveOpenActionQty(resolvedOpenQuantity, ctx, Math.abs(currentQty))
        : 0
      if (oppositeQty <= 0) {
        return {
          action: 'NOOP',
          reason: `compiled.${program.id}.reverse.open_size_unresolved`,
        }
      }

      const deltaDirection = reverseMeta.toSide === 'long' ? 1 : -1
      return {
        action: 'ADJUST_POSITION',
        adjustMode: 'DELTA',
        size: {
          mode: 'QTY',
          value: (-currentQty) + (deltaDirection * oppositeQty),
        },
        reason: `compiled.${program.id}.reverse.same_bar`,
      }
    }

    if (openAction && resolvedOpenQuantity) {
      markPendingReverse(ctx, program.id, reverseMeta.toSide, openAction, resolvedOpenQuantity)
    }

    return {
      action: reverseMeta.fromSide === 'long' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
      size: {
        mode: 'QTY',
        value: Math.abs(currentQty),
      },
      reason: `compiled.${program.id}.reverse.close_first`,
    }
  }

  const addMeta = program.metadata?.addPosition
  if (addMeta) {
    const modeDecision = evaluateAddPositionMode(program, ctx, addMeta)
    if (modeDecision) return modeDecision

    if (!hasSameSidePositionSnapshot(ctx, program)) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.position_snapshot_missing`,
      }
    }

    const currentLayers = readSemanticRuntimeStateNumber(ctx, addMeta.stateKey)
    if (!currentLayers.present) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.pyramiding_state_missing`,
      }
    }

    if (
      typeof addMeta.maxLayers === 'number'
      && Number.isFinite(addMeta.maxLayers)
      && currentLayers.value >= addMeta.maxLayers
    ) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.pyramiding_limit`,
      }
    }

    if (
      typeof addMeta.maxExposurePct === 'number'
      && Number.isFinite(addMeta.maxExposurePct)
      && exceedsMaxExposurePct(program, ctx, addMeta.maxExposurePct)
    ) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.max_exposure_pct`,
      }
    }
  }

  const dcaMeta = program.metadata?.dcaSchedule
  if (dcaMeta && Number.isFinite(dcaMeta.maxCount)) {
    const exitDecision = evaluateDcaExitRule(program, ctx, dcaMeta)
    if (exitDecision) return exitDecision

    const triggerDecision = evaluateDcaTriggerMode(program, ctx, dcaMeta)
    if (triggerDecision) return triggerDecision

    if (!hasSameSidePositionSnapshot(ctx, program)) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.position_snapshot_missing`,
      }
    }

    const currentCount = readSemanticRuntimeStateNumber(ctx, dcaMeta.stateKey)
    if (!currentCount.present) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_state_missing`,
      }
    }

    if (currentCount.value >= dcaMeta.maxCount) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_max_count`,
      }
    }

    if (
      Number.isFinite(dcaMeta.capitalCap)
      && exceedsDcaCapitalCap(program, ctx, currentCount.value, dcaMeta.stateKey, dcaMeta.capitalCap)
    ) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_capital_cap`,
      }
    }

    if (
      typeof dcaMeta.maxExposurePct === 'number'
      && Number.isFinite(dcaMeta.maxExposurePct)
      && exceedsMaxExposurePct(program, ctx, dcaMeta.maxExposurePct)
    ) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_max_exposure_pct`,
      }
    }
  }

  return null
}

function evaluatePendingReverse(
  program: DecisionProgramNode,
  ctx: StrategyExecutionContextV1,
): StrategyDecisionV1 | null {
  const reverseMeta = program.metadata?.reversePosition
  const pendingReverse = reverseMeta
    ? readPendingReverse(ctx, program.id, reverseMeta.toSide)
    : null
  if (!pendingReverse) {
    return null
  }

  const currentQty = readCurrentQtyValue(ctx)
  if (currentQty === null || currentQty !== 0) {
    return null
  }

  const compiledState = ensureCompiledDecisionState(ctx)
  if (compiledState.barIndex <= pendingReverse.createdBarIndex) {
    return null
  }

  clearPendingReverse(ctx, program.id)
  return {
    action: pendingReverse.actionKind,
    size: {
      mode: mapSizeMode(pendingReverse.quantity.mode),
      value: normalizeSizeValue(pendingReverse.quantity.mode, pendingReverse.quantity.value),
    },
    reason: `compiled.${program.id}.reverse.open_after_close`,
  }
}

function hasPendingReverseForProgram(
  program: DecisionProgramNode,
  ctx: StrategyExecutionContextV1,
): boolean {
  const reverseMeta = program.metadata?.reversePosition
  return reverseMeta ? readPendingReverse(ctx, program.id, reverseMeta.toSide) !== null : false
}

function findReverseOpenAction(
  program: DecisionProgramNode,
  toSide: ReversePositionMeta['toSide'],
): DecisionProgramNode['actions'][number] | null {
  const expectedKind = toSide === 'long' ? 'OPEN_LONG' : 'OPEN_SHORT'
  return program.actions.find(action => action.kind === expectedKind) ?? null
}

function readPendingReverse(
  ctx: StrategyExecutionContextV1,
  programId: string,
  toSide: ReversePositionMeta['toSide'],
): CompiledDecisionState['pendingReverseByProgram'][string] | null {
  const compiledState = ensureCompiledDecisionState(ctx)
  const pending = compiledState.pendingReverseByProgram[programId]
  if (!pending || pending.toSide !== toSide) {
    return null
  }
  return pending
}

function markPendingReverse(
  ctx: StrategyExecutionContextV1,
  programId: string,
  toSide: ReversePositionMeta['toSide'],
  action: DecisionProgramNode['actions'][number],
  quantity: DecisionProgramNode['actions'][number]['quantity'] = action.quantity,
): void {
  const compiledState = ensureCompiledDecisionState(ctx)
  compiledState.pendingReverseByProgram[programId] = {
    toSide,
    actionKind: action.kind === 'OPEN_LONG' ? 'OPEN_LONG' : 'OPEN_SHORT',
    quantity,
    createdBarIndex: compiledState.barIndex,
  }
}

function resolveReverseOpenQuantity(
  action: DecisionProgramNode['actions'][number],
  ctx: StrategyExecutionContextV1,
  currentAbsQty: number,
  sizingSource: ReversePositionMeta['sizingSource'],
): DecisionProgramNode['actions'][number]['quantity'] {
  if (sizingSource === 'current_position') {
    return { mode: 'fixed_base', value: currentAbsQty }
  }

  if (sizingSource === 'fixed' || sizingSource === 'position_sizing') {
    return action.quantity
  }

  return action.quantity
}

function clearPendingReverse(
  ctx: StrategyExecutionContextV1,
  programId: string,
): void {
  const compiledState = ensureCompiledDecisionState(ctx)
  delete compiledState.pendingReverseByProgram[programId]
}

function clearAllPendingReverse(ctx: StrategyExecutionContextV1): void {
  const compiledState = ensureCompiledDecisionState(ctx)
  compiledState.pendingReverseByProgram = {}
}

function exceedsMaxExposurePct(
  program: DecisionProgramNode,
  ctx: StrategyExecutionContextV1,
  maxExposurePct: number,
): boolean {
  if (maxExposurePct < 0) {
    return false
  }
  const equity = readEquity(ctx)
  if (equity <= 0) {
    return true
  }

  const currentExposurePct = readPositionExposurePct(ctx, equity)
  const nextAction = findFirstAddAction(program)
  const nextExposurePct = nextAction
    ? quantityToExposurePct(resolveLifecycleAction(program, nextAction).quantity, ctx, equity)
    : 0
  if (nextExposurePct === null) {
    return true
  }

  return currentExposurePct + nextExposurePct > maxExposurePct
}

function exceedsDcaCapitalCap(
  program: DecisionProgramNode,
  ctx: StrategyExecutionContextV1,
  currentCount: number,
  stateKey: string,
  capitalCap: number,
): boolean {
  if (capitalCap < 0) {
    return false
  }
  const nextAction = findFirstAddAction(program)
  if (!nextAction) {
    return false
  }

  const nextQuote = quantityToQuoteValue(nextAction.quantity, ctx)
  if (nextQuote === null) {
    return true
  }

  const spentQuote = readDcaSpentQuote(ctx, stateKey)
  if (spentQuote !== null) {
    return spentQuote + nextQuote > capitalCap
  }

  if (nextAction.quantity.mode !== 'fixed_quote' && currentCount > 0) {
    return true
  }

  return (currentCount * nextQuote) + nextQuote > capitalCap
}

function findFirstAddAction(
  program: DecisionProgramNode,
): DecisionProgramNode['actions'][number] | null {
  return program.actions.find(action => action.kind === 'ADD_LONG' || action.kind === 'ADD_SHORT') ?? null
}

function readPositionExposurePct(
  ctx: StrategyExecutionContextV1,
  equity: number,
): number {
  const directPct = readFirstFinitePositiveOrZeroNumber([
    ctx.position?.exposurePct,
    ctx.position?.positionPct,
    ctx.position?.notionalPct,
    ctx.position?.exposurePercent,
    ctx.position?.positionPercent,
    ctx.position?.notionalPercent,
  ])
  if (directPct !== null) {
    return directPct
  }

  const notional = readFirstFinitePositiveOrZeroNumber([
    ctx.position?.notional,
    ctx.position?.notionalValue,
    ctx.position?.marketValue,
    ctx.position?.value,
  ])
  if (notional !== null) {
    return (Math.abs(notional) / equity) * 100
  }

  const currentPrice = readCurrentPrice(ctx)
  const qty = Math.abs(readCurrentQty(ctx))
  if (currentPrice <= 0 || qty === 0) {
    return 0
  }

  return (qty * currentPrice / equity) * 100
}

function quantityToExposurePct(
  quantity: DecisionProgramNode['actions'][number]['quantity'],
  ctx: StrategyExecutionContextV1,
  equity: number,
): number | null {
  const quoteValue = quantityToQuoteValue(quantity, ctx)
  if (quoteValue === null) {
    return null
  }

  return (quoteValue / equity) * 100
}

function quantityToQuoteValue(
  quantity: DecisionProgramNode['actions'][number]['quantity'],
  ctx: StrategyExecutionContextV1,
): number | null {
  const rawValue = quantity.value
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return null
  }

  switch (quantity.mode) {
    case 'fixed_quote':
      return rawValue
    case 'pct_equity': {
      const equity = readEquity(ctx)
      return equity > 0 ? equity * rawValue / 100 : null
    }
    case 'fixed_base': {
      const currentPrice = readCurrentPrice(ctx)
      return currentPrice > 0 ? rawValue * currentPrice : null
    }
    case 'position_pct': {
      const currentPrice = readCurrentPrice(ctx)
      const currentQty = Math.abs(readCurrentQty(ctx))
      return currentPrice > 0 ? currentQty * currentPrice * rawValue / 100 : null
    }
  }
}

function readFirstFinitePositiveOrZeroNumber(candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) {
      return candidate
    }
  }

  return null
}

function readSemanticRuntimeStateNumber(
  ctx: StrategyExecutionContextV1,
  stateKey: string,
): SemanticRuntimeStateNumber {
  const root = ctx.semanticRuntimeState
  if (!root || typeof root !== 'object' || !Object.prototype.hasOwnProperty.call(root, stateKey)) {
    return { present: false, value: 0 }
  }

  const slot = root[stateKey]
  if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
    return { present: false, value: 0 }
  }

  if (!Object.prototype.hasOwnProperty.call(slot, 'value')) {
    return { present: true, value: 0 }
  }

  const value = slot.value
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { present: true, value }
  }

  return { present: false, value: 0 }
}

function incrementSemanticRuntimeStateNumber(
  ctx: StrategyExecutionContextV1,
  stateKey: string,
): void {
  const current = readSemanticRuntimeStateNumber(ctx, stateKey)
  if (!current.present) {
    return
  }

  if (!ctx.semanticRuntimeState) {
    ctx.semanticRuntimeState = {}
  }
  const slot = ctx.semanticRuntimeState[stateKey]
  if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
    return
  }

  slot.value = current.value + 1
}

function readDcaSpentQuote(
  ctx: StrategyExecutionContextV1,
  stateKey: string,
): number | null {
  const slot = ctx.semanticRuntimeState?.[stateKey]
  if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
    return null
  }

  const value = slot.spentQuote
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function incrementDcaSpentQuote(
  ctx: StrategyExecutionContextV1,
  stateKey: string,
  program: DecisionProgramNode,
): void {
  if (!ctx.semanticRuntimeState) {
    return
  }
  const slot = ctx.semanticRuntimeState[stateKey]
  if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
    return
  }

  const nextAction = findFirstAddAction(program)
  const quoteValue = nextAction ? quantityToQuoteValue(nextAction.quantity, ctx) : null
  if (quoteValue === null) {
    return
  }

  slot.spentQuote = (readDcaSpentQuote(ctx, stateKey) ?? 0) + quoteValue
  const currentPrice = readCurrentPrice(ctx)
  if (currentPrice > 0) {
    slot.lastPrice = currentPrice
  }
  const currentTimestamp = readCurrentTimestamp(ctx)
  if (currentTimestamp !== null) {
    slot.lastTimestamp = currentTimestamp
  }
  slot.lastBarIndex = ensureCompiledDecisionState(ctx).barIndex
}

function doesPositionQtyMatchSide(
  qty: number,
  side: ReversePositionMeta['fromSide'],
): boolean {
  return side === 'long' ? qty > 0 : qty < 0
}

function buildFirstApplicableDecision(
  program: DecisionProgramNode,
  ctx: StrategyExecutionContextV1,
): StrategyDecisionV1 | null {
  for (const action of program.actions) {
    const decision = buildDecision(resolveLifecycleAction(program, action), ctx, program.id)
    if (decision.action !== 'NOOP') {
      return decision
    }
  }

  return null
}

function buildDecision(
  action: DecisionProgramNode['actions'][number],
  ctx: StrategyExecutionContextV1,
  programId: string,
): StrategyDecisionV1 {
  if (action.kind === 'REDUCE_LONG' || action.kind === 'REDUCE_SHORT') {
    const currentQty = readCurrentQty(ctx)
    const currentPrice = readCurrentPrice(ctx)
    const equity = readEquity(ctx)
    const deltaQty = resolveReduceDeltaQty(action, { currentQty, currentPrice, equity })

    if (deltaQty === 0) {
      return {
        action: 'NOOP',
        reason: `compiled.${programId}.noop`,
      }
    }

    return {
      action: 'ADJUST_POSITION',
      adjustMode: 'DELTA',
      size: {
        mode: 'QTY',
        value: deltaQty,
      },
      reason: `compiled.${programId}`,
    }
  }

  return {
    action: mapAction(action.kind),
    size: {
      mode: mapSizeMode(action.quantity.mode),
      value: normalizeSizeValue(action.quantity.mode, action.quantity.value),
    },
    reason: `compiled.${programId}`,
  }
}

function resolveLifecycleAction(
  program: DecisionProgramNode,
  action: DecisionProgramNode['actions'][number],
): DecisionProgramNode['actions'][number] {
  const addMeta = program.metadata?.addPosition
  if (
    addMeta
    && (action.kind === 'ADD_LONG' || action.kind === 'ADD_SHORT')
    && typeof addMeta.addRatio === 'number'
    && Number.isFinite(addMeta.addRatio)
    && addMeta.addRatio > 0
  ) {
    return {
      ...action,
      quantity: {
        mode: 'position_pct',
        value: Math.min(addMeta.addRatio, 1) * 100,
      },
    }
  }

  return action
}

function mapAction(
  action: DecisionProgramNode['actions'][number]['kind'],
): StrategyDecisionV1['action'] {
  switch (action) {
    case 'OPEN_LONG':
    case 'OPEN_SHORT':
    case 'CLOSE_LONG':
    case 'CLOSE_SHORT':
      return action
    case 'ADD_LONG':
      return 'OPEN_LONG'
    case 'ADD_SHORT':
      return 'OPEN_SHORT'
    case 'REDUCE_LONG':
      return 'ADJUST_POSITION'
    case 'REDUCE_SHORT':
      return 'ADJUST_POSITION'
  }
}

function mapSizeMode(
  mode: DecisionProgramNode['actions'][number]['quantity']['mode'],
): NonNullable<StrategyDecisionV1['size']>['mode'] {
  switch (mode) {
    case 'pct_equity':
    case 'position_pct':
      return 'RATIO'
    case 'fixed_quote':
      return 'QUOTE'
    case 'fixed_base':
      return 'QTY'
  }
}

function normalizeSizeValue(
  mode: DecisionProgramNode['actions'][number]['quantity']['mode'],
  value: number,
): number {
  if (mode === 'pct_equity' || mode === 'position_pct') {
    return value / 100
  }
  return value
}

function resolveReduceDeltaQty(
  action: DecisionProgramNode['actions'][number],
  context: {
    currentQty: number
    currentPrice: number
    equity: number
  },
): number {
  const direction = action.kind === 'REDUCE_LONG' ? -1 : 1
  if (action.kind === 'REDUCE_LONG' && context.currentQty <= 0) return 0
  if (action.kind === 'REDUCE_SHORT' && context.currentQty >= 0) return 0

  const rawValue = action.quantity.value
  if (!Number.isFinite(rawValue) || rawValue === 0) return 0

  let requestedQty = 0
  switch (action.quantity.mode) {
    case 'position_pct':
      requestedQty = Math.abs(context.currentQty) * (Math.abs(rawValue) / 100)
      break
    case 'fixed_base':
      requestedQty = Math.abs(rawValue)
      break
    case 'fixed_quote':
      requestedQty = context.currentPrice > 0
        ? Math.abs(rawValue) / context.currentPrice
        : 0
      break
    case 'pct_equity':
      requestedQty = context.currentPrice > 0
        ? (Math.max(0, context.equity) * Math.abs(rawValue)) / 100 / context.currentPrice
        : 0
      break
  }

  return direction * Math.min(requestedQty, Math.abs(context.currentQty))
}

function resolveOpenActionQty(
  quantityOrAction: DecisionProgramNode['actions'][number] | DecisionProgramNode['actions'][number]['quantity'],
  ctx: StrategyExecutionContextV1,
  currentAbsQty: number,
): number {
  const quantity = 'quantity' in quantityOrAction ? quantityOrAction.quantity : quantityOrAction
  const rawValue = quantity.value
  if (!Number.isFinite(rawValue) || rawValue <= 0) return 0

  switch (quantity.mode) {
    case 'position_pct':
      return currentAbsQty * rawValue / 100
    case 'fixed_base':
      return rawValue
    case 'fixed_quote': {
      const currentPrice = readCurrentPrice(ctx)
      return currentPrice > 0 ? rawValue / currentPrice : 0
    }
    case 'pct_equity': {
      const currentPrice = readCurrentPrice(ctx)
      const equity = readEquity(ctx)
      return currentPrice > 0 && equity > 0 ? equity * rawValue / 100 / currentPrice : 0
    }
  }
}

function evaluateAddPositionMode(
  program: DecisionProgramNode,
  ctx: StrategyExecutionContextV1,
  meta: AddPositionMeta,
): StrategyDecisionV1 | null {
  const mode = meta.addMode ?? 'signal_confirm'
  if (mode === 'signal_confirm') {
    return null
  }

  const pnlPct = readPositionPnlPct(ctx)
  if (mode === 'profit_pct') {
    if (pnlPct !== null && pnlPct > 0) return null
    return {
      action: 'NOOP',
      reason: `compiled.${program.id}.add_mode_profit_pct_not_met`,
    }
  }

  if (mode === 'drawdown_pct') {
    const drawdownPct = readPositionDrawdownPct(ctx)
    if ((drawdownPct !== null && drawdownPct > 0) || (pnlPct !== null && pnlPct < 0)) return null
    return {
      action: 'NOOP',
      reason: `compiled.${program.id}.add_mode_drawdown_pct_not_met`,
    }
  }

  return {
    action: 'NOOP',
    reason: `compiled.${program.id}.add_mode_unsupported`,
  }
}

function evaluateDcaTriggerMode(
  program: DecisionProgramNode,
  ctx: StrategyExecutionContextV1,
  meta: DcaScheduleMeta,
): StrategyDecisionV1 | null {
  const mode = meta.triggerMode ?? 'signal'
  if (mode === 'signal') {
    return null
  }

  const slot = ctx.semanticRuntimeState?.[meta.stateKey]
  if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
    return null
  }

  if (mode === 'time_interval') {
    const timeIntervalBars = readPositiveFiniteNumber(meta.timeIntervalBars)
    const timeIntervalMs = readPositiveFiniteNumber(meta.timeIntervalMs)
    if (timeIntervalBars === null && timeIntervalMs === null) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_time_interval_unresolved`,
      }
    }

    const lastBarIndex = slot.lastBarIndex
    if (
      timeIntervalBars !== null
      && typeof lastBarIndex === 'number'
      && Number.isFinite(lastBarIndex)
      && ensureCompiledDecisionState(ctx).barIndex - lastBarIndex < timeIntervalBars
    ) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_time_interval_wait`,
      }
    }

    if (timeIntervalMs !== null) {
      const lastTimestamp = slot.lastTimestamp
      const currentTimestamp = readCurrentTimestamp(ctx)
      if (
        typeof lastTimestamp === 'number'
        && Number.isFinite(lastTimestamp)
        && currentTimestamp === null
      ) {
        return {
          action: 'NOOP',
          reason: `compiled.${program.id}.dca_time_interval_time_missing`,
        }
      }
      if (
        typeof lastTimestamp === 'number'
        && Number.isFinite(lastTimestamp)
        && currentTimestamp !== null
        && currentTimestamp - lastTimestamp < timeIntervalMs
      ) {
        return {
          action: 'NOOP',
          reason: `compiled.${program.id}.dca_time_interval_wait`,
        }
      }
    }

    return null
  }

  if (mode === 'price_interval') {
    const priceIntervalPct = readPositiveFiniteNumber(meta.priceIntervalPct)
    const priceIntervalQuote = readPositiveFiniteNumber(meta.priceIntervalQuote)
    if (priceIntervalPct === null && priceIntervalQuote === null) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_price_interval_unresolved`,
      }
    }

    const currentPrice = readCurrentPrice(ctx)
    if (currentPrice <= 0) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_price_interval_price_missing`,
      }
    }
    const lastPrice = slot.lastPrice
    if (typeof lastPrice !== 'number' || !Number.isFinite(lastPrice) || lastPrice <= 0) {
      return null
    }

    const nextAction = findFirstAddAction(program)
    const isLongDca = nextAction?.kind !== 'ADD_SHORT'
    const thresholdMove = priceIntervalQuote ?? (lastPrice * (priceIntervalPct ?? 0) / 100)
    const intervalMet = isLongDca
      ? currentPrice <= lastPrice - thresholdMove
      : currentPrice >= lastPrice + thresholdMove
    if (!intervalMet) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_price_interval_wait`,
      }
    }
    return null
  }

  return {
    action: 'NOOP',
    reason: `compiled.${program.id}.dca_trigger_mode_unsupported`,
  }
}

function evaluateDcaExitRule(
  program: DecisionProgramNode,
  ctx: StrategyExecutionContextV1,
  meta: DcaScheduleMeta,
): StrategyDecisionV1 | null {
  const ruleType = meta.exitRule?.type
  if (!ruleType || ruleType === 'cap_only') {
    return null
  }

  if (ruleType === 'stop_dca') {
    return {
      action: 'NOOP',
      reason: `compiled.${program.id}.dca_exit_rule_stop`,
    }
  }

  if (ruleType === 'stop_on_break_previous_low') {
    const currentPrice = readCurrentPrice(ctx)
    const previousLow = readPreviousLow(ctx)
    if (currentPrice <= 0 || previousLow === null) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_exit_rule_unresolved`,
      }
    }
    if (currentPrice < previousLow) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_exit_rule_stop`,
      }
    }
    return null
  }

  if (ruleType === 'stop_on_break_previous_high') {
    const currentPrice = readCurrentPrice(ctx)
    const previousHigh = readPreviousHigh(ctx)
    if (currentPrice <= 0 || previousHigh === null) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_exit_rule_unresolved`,
      }
    }
    if (currentPrice > previousHigh) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_exit_rule_stop`,
      }
    }
    return null
  }

  return {
    action: 'NOOP',
    reason: `compiled.${program.id}.dca_exit_rule_unsupported`,
  }
}

function readCurrentQty(ctx: StrategyExecutionContextV1): number {
  const value = ctx.position?.qty
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readCurrentBarIndex(
  ctx: StrategyExecutionContextV1,
  fallback: number,
): number {
  const candidates = [
    ctx.barIndex,
    ctx.currentBarIndex,
    ctx.baseTimeframeBar?.index,
    ctx.bar?.index,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) {
      return candidate
    }
  }
  return fallback
}

function readCurrentTimestamp(ctx: StrategyExecutionContextV1): number | null {
  const candidates = [
    ctx.timestamp,
    ctx.baseTimeframeBar?.timestamp,
    ctx.baseTimeframeBar?.time,
    ctx.bar?.timestamp,
    ctx.bar?.time,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
  }
  return null
}

function hasSameSidePositionSnapshot(
  ctx: StrategyExecutionContextV1,
  program: DecisionProgramNode,
): boolean {
  const nextAction = findFirstAddAction(program)
  if (!nextAction || !ctx.position || typeof ctx.position !== 'object' || Array.isArray(ctx.position)) {
    return false
  }

  const currentQty = readCurrentQtyValue(ctx)
  if (currentQty === null || currentQty === 0) {
    return false
  }

  return nextAction.kind === 'ADD_LONG' ? currentQty > 0 : currentQty < 0
}

function readCurrentQtyValue(ctx: StrategyExecutionContextV1): number | null {
  const value = ctx.position?.qty
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readCurrentPrice(ctx: StrategyExecutionContextV1): number {
  const currentPrice = ctx.currentPrice
  if (typeof currentPrice === 'number' && Number.isFinite(currentPrice) && currentPrice > 0) {
    return currentPrice
  }

  const barClose = ctx.baseTimeframeBar?.close
  if (typeof barClose === 'number' && Number.isFinite(barClose) && barClose > 0) {
    return barClose
  }

  return 0
}

function readPositionPnlPct(ctx: StrategyExecutionContextV1): number | null {
  const position = ctx.position as Record<string, unknown> | undefined
  const direct = readFirstFiniteNumber([
    position?.pnlPct,
    position?.pnlPercent,
    position?.unrealizedPnlPct,
    position?.unrealizedPnlPercent,
    ctx.positionPnlPct,
    ctx.positionPnlPercent,
  ])
  if (direct !== null) return direct

  const currentPrice = readCurrentPrice(ctx)
  const entryPrice = readFirstFiniteNumber([
    ctx.position?.avgEntryPrice,
    ctx.position?.entryPrice,
    ctx.position?.avgPrice,
  ])
  const qty = readCurrentQty(ctx)
  if (currentPrice <= 0 || entryPrice === null || entryPrice <= 0 || qty === 0) {
    return null
  }

  const direction = qty > 0 ? 1 : -1
  return ((currentPrice - entryPrice) / entryPrice) * 100 * direction
}

function readPositionDrawdownPct(ctx: StrategyExecutionContextV1): number | null {
  const position = ctx.position as Record<string, unknown> | undefined
  const direct = readFirstFinitePositiveOrZeroNumber([
    position?.drawdownPct,
    position?.drawdownPercent,
    ctx.positionDrawdownPct,
    ctx.positionDrawdownPercent,
  ])
  if (direct !== null) return direct

  const currentPrice = readCurrentPrice(ctx)
  if (currentPrice <= 0) return null

  const qty = readCurrentQty(ctx)
  const referencePrice = qty < 0
    ? readFirstFiniteNumber([
      ctx.position?.lowestPriceSinceEntry,
      ctx.position?.troughPriceSinceEntry,
      ctx.position?.troughPrice,
      ctx.position?.minPriceSinceEntry,
    ])
    : readFirstFiniteNumber([
      ctx.position?.highestPriceSinceEntry,
      ctx.position?.peakPriceSinceEntry,
      ctx.position?.peakPrice,
      ctx.position?.maxPriceSinceEntry,
    ])

  if (referencePrice === null || referencePrice <= 0) return null
  const drawdown = qty < 0
    ? (currentPrice - referencePrice) / referencePrice
    : (referencePrice - currentPrice) / referencePrice
  return Math.max(0, drawdown * 100)
}

function readPreviousLow(ctx: StrategyExecutionContextV1): number | null {
  const direct = readFirstFiniteNumber([
    ctx.previousLow,
    ctx.prevLow,
    ctx.baseTimeframeBar?.previousLow,
    ctx.bar?.previousLow,
  ])
  if (direct !== null) return direct

  const bars = Array.isArray(ctx.bars) ? ctx.bars : []
  const previous = bars.length >= 2 ? bars.at(-2) : null
  return typeof previous?.low === 'number' && Number.isFinite(previous.low) ? previous.low : null
}

function readPreviousHigh(ctx: StrategyExecutionContextV1): number | null {
  const direct = readFirstFiniteNumber([
    ctx.previousHigh,
    ctx.prevHigh,
    ctx.baseTimeframeBar?.previousHigh,
    ctx.bar?.previousHigh,
  ])
  if (direct !== null) return direct

  const bars = Array.isArray(ctx.bars) ? ctx.bars : []
  const previous = bars.length >= 2 ? bars.at(-2) : null
  return typeof previous?.high === 'number' && Number.isFinite(previous.high) ? previous.high : null
}

function readFirstFiniteNumber(candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
  }

  return null
}

function readPositiveFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function applyOrchestrationGate(
  decision: StrategyDecisionV1,
  gateState: OrchestrationGateState | undefined,
  portfolioRiskState: OrchestrationPortfolioRiskState | undefined,
  ctx: StrategyExecutionContextV1,
): StrategyDecisionV1 {
  const observedBreaches = portfolioRiskState?.observedBreaches ?? []
  const hasObservedBreaches = observedBreaches.length > 0
  const attachBreaches = (d: StrategyDecisionV1): StrategyDecisionV1 => {
    if (!hasObservedBreaches) return d
    return {
      ...d,
      meta: {
        ...(d.meta ?? {}),
        observedBreaches: [...observedBreaches],
      },
    }
  }

  if (!gateState && !portfolioRiskState) return decision

  if (decision.action === 'OPEN_LONG') {
    const portfolioBlocks = portfolioRiskState?.blockEntryLong === true
    const gateBlocks = gateState?.blockEntryLong === true
    if (portfolioBlocks || gateBlocks) {
      const reason = portfolioBlocks
        ? 'compiled.orchestration.portfolio_risk.block_entry_long'
        : 'compiled.orchestration.gate.block_entry_long'
      return attachBreaches({ action: 'NOOP', reason })
    }
  }
  if (decision.action === 'OPEN_SHORT') {
    const portfolioBlocks = portfolioRiskState?.blockEntryShort === true
    const gateBlocks = gateState?.blockEntryShort === true
    if (portfolioBlocks || gateBlocks) {
      const reason = portfolioBlocks
        ? 'compiled.orchestration.portfolio_risk.block_entry_short'
        : 'compiled.orchestration.gate.block_entry_short'
      return attachBreaches({ action: 'NOOP', reason })
    }
  }

  const adjustedEntrySide = resolveAdjustedEntrySide(decision, ctx)
  if (adjustedEntrySide === 'long') {
    const portfolioBlocks = portfolioRiskState?.blockEntryLong === true
    const gateBlocks = gateState?.blockEntryLong === true
    if (portfolioBlocks || gateBlocks) {
      const reason = portfolioBlocks
        ? 'compiled.orchestration.portfolio_risk.block_entry_long'
        : 'compiled.orchestration.gate.block_entry_long'
      return attachBreaches({ action: 'NOOP', reason })
    }
  }
  if (adjustedEntrySide === 'short') {
    const portfolioBlocks = portfolioRiskState?.blockEntryShort === true
    const gateBlocks = gateState?.blockEntryShort === true
    if (portfolioBlocks || gateBlocks) {
      const reason = portfolioBlocks
        ? 'compiled.orchestration.portfolio_risk.block_entry_short'
        : 'compiled.orchestration.gate.block_entry_short'
      return attachBreaches({ action: 'NOOP', reason })
    }
  }

  return attachBreaches(decision)
}

function resolveAdjustedEntrySide(
  decision: StrategyDecisionV1,
  ctx: StrategyExecutionContextV1,
): 'long' | 'short' | null {
  if (decision.action !== 'ADJUST_POSITION' || !decision.size || decision.size.mode !== 'QTY') {
    return null
  }

  const sizeValue = decision.size.value
  if (!Number.isFinite(sizeValue)) {
    return null
  }

  const currentQty = readCurrentQty(ctx)
  const targetQty = decision.adjustMode === 'TARGET' ? sizeValue : currentQty + sizeValue
  const currentSide = currentQty > 0 ? 'long' : currentQty < 0 ? 'short' : null
  const targetSide = targetQty > 0 ? 'long' : targetQty < 0 ? 'short' : null
  return targetSide !== null && targetSide !== currentSide ? targetSide : null
}

/**
 * Phase 5 S11 (#1112): scope.leg substrate runtime fail-closed 路由（与 applySymbolScopeRouting 严格同形）
 *
 * 决策表：
 *   legScopes 缺失 / length <= 1 → 'continue' （单/0 leg 走兜底）
 *   legScopes.length >= 2 时：
 *     activeLegScopeId trim 后空 → fail-closed.no_active_leg
 *     activeId 不在 legScopes id 集合 → fail-closed.unknown_active_leg
 *     program.metadata.legScopeRef trim 后空 → fail-closed.unbound_program
 *     program ref ≠ activeId → 'skip' （该 program 不属当前 leg，下个 program）
 *     program ref === activeId → 'continue' （正常进入决策）
 */
export function applyLegScopeRouting(
  program: { metadata?: { legScopeRef?: string } },
  ctx: StrategyExecutionContextV1,
  legScopes: readonly CompiledOrchestrationLegScope[] | undefined,
): 'continue' | 'skip' | StrategyDecisionV1 {
  if (!legScopes || legScopes.length <= 1) return 'continue'

  const activeIdRaw = (ctx as { activeLegScopeId?: unknown }).activeLegScopeId
  const activeId = typeof activeIdRaw === 'string' ? activeIdRaw.trim() : ''
  if (activeId === '') {
    return {
      action: 'NOOP',
      reason: 'compiled.orchestration.leg.fail_closed.no_active_leg',
    }
  }
  if (!legScopes.some(l => l.id === activeId)) {
    return {
      action: 'NOOP',
      reason: 'compiled.orchestration.leg.fail_closed.unknown_active_leg',
    }
  }

  const programRefRaw = program.metadata?.legScopeRef
  const programRef = typeof programRefRaw === 'string' ? programRefRaw.trim() : ''
  if (programRef === '') {
    return {
      action: 'NOOP',
      reason: 'compiled.orchestration.leg.fail_closed.unbound_program',
    }
  }
  if (programRef !== activeId) return 'skip'
  return 'continue'
}

/**
 * Phase 5 S2 (#1104): scope.symbol substrate runtime fail-closed 路由
 *
 * 决策表：
 *   scopes 缺失 / length <= 1 → 'continue' （单/0 scope 走兜底）
 *   scopes.length >= 2 时：
 *     activeSymbolScopeId trim 后空 → fail-closed.no_active_scope
 *     activeId 不在 scopes id 集合 → fail-closed.unknown_active_scope
 *     program.metadata.symbolScopeRef trim 后空 → fail-closed.unbound_program
 *     program ref ≠ activeId → 'skip' （该 program 不属当前 scope，下个 program）
 *     program ref === activeId → 'continue' （正常进入决策）
 */
export function applySymbolScopeRouting(
  program: { metadata?: { symbolScopeRef?: string } },
  ctx: StrategyExecutionContextV1,
  scopes: readonly CompiledOrchestrationScope[] | undefined,
): 'continue' | 'skip' | StrategyDecisionV1 {
  if (!scopes || scopes.length <= 1) return 'continue'

  const activeIdRaw = (ctx as { activeSymbolScopeId?: unknown }).activeSymbolScopeId
  const activeId = typeof activeIdRaw === 'string' ? activeIdRaw.trim() : ''
  if (activeId === '') {
    return {
      action: 'NOOP',
      reason: 'compiled.orchestration.scope.fail_closed.no_active_scope',
    }
  }
  if (!scopes.some(s => s.id === activeId)) {
    return {
      action: 'NOOP',
      reason: 'compiled.orchestration.scope.fail_closed.unknown_active_scope',
    }
  }

  const programRefRaw = program.metadata?.symbolScopeRef
  const programRef = typeof programRefRaw === 'string' ? programRefRaw.trim() : ''
  if (programRef === '') {
    return {
      action: 'NOOP',
      reason: 'compiled.orchestration.scope.fail_closed.unbound_program',
    }
  }
  if (programRef !== activeId) return 'skip'
  return 'continue'
}

function readEquity(ctx: StrategyExecutionContextV1): number {
  const accountEquity = ctx.accountEquity
  if (typeof accountEquity === 'number' && Number.isFinite(accountEquity)) {
    return accountEquity
  }

  const value = ctx.portfolio?.equity
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
