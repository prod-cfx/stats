import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { CompiledRuntimeValue } from './evaluate-expr-pool'
import type { CompiledGuardState } from './evaluate-guards'

// MUST match PartialTakeProfitProgramMetadata in
// apps/quantify/src/modules/llm-strategy-codegen/types/partial-take-profit.ts.
// `packages/shared` cannot import quantify types, so this is a documented mirror.
interface PartialTakeProfitMeta {
  memoryKey: string
  tierIndex: number
  totalTiers: number
}

interface AddPositionMeta {
  maxLayers?: number
  maxExposurePct?: number
  stateKey: string
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
  stateKey: string
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
  }
  actions: Array<{
    kind: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'REDUCE_LONG' | 'REDUCE_SHORT' | 'ADD_LONG' | 'ADD_SHORT'
    quantity: {
      mode: 'pct_equity' | 'fixed_quote' | 'fixed_base' | 'position_pct'
      value: number
    }
  }>
}

interface CompiledDecisionState {
  barIndex: number
  lastTriggeredByProgram: Record<string, number>
  previousPositionQty: number
  pendingReverseByProgram: Record<string, {
    toSide: ReversePositionMeta['toSide']
    actionKind: 'OPEN_LONG' | 'OPEN_SHORT'
    quantity: DecisionProgramNode['actions'][number]['quantity']
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
): Readonly<StrategyDecisionV1> {
  const compiledState = ensureCompiledDecisionState(ctx)
  const declaredPartialTakeProfitKeys = collectPartialTakeProfitMemoryKeys(programs)
  resetPartialTakeProfitStateOnEntryEdge(ctx, compiledState, declaredPartialTakeProfitKeys)
  if (guardState.forceExit) {
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
    if (program.phase === 'entry' && guardState.blockNewEntry) {
      continue
    }

    const pendingReverseDecision = evaluatePendingReverse(program, ctx)
    if (pendingReverseDecision) {
      compiledState.lastTriggeredByProgram[program.id] = compiledState.barIndex
      return Object.freeze(pendingReverseDecision)
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
      if (ptpMeta && lifecycleDecision.action !== 'NOOP') {
        markPartialTakeProfitTierFired(ctx, ptpMeta)
      }
      return Object.freeze(lifecycleDecision)
    }

    const decision = buildFirstApplicableDecision(program, ctx)
    if (!decision) continue

    compiledState.lastTriggeredByProgram[program.id] = compiledState.barIndex
    if (ptpMeta) {
      markPartialTakeProfitTierFired(ctx, ptpMeta)
    }
    markPositionLifecycleState(ctx, program, decision)
    return Object.freeze(decision)
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
    if (openAction) {
      markPendingReverse(ctx, program.id, reverseMeta.toSide, openAction)
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
      && exceedsDcaCapitalCap(program, ctx, currentCount.value, dcaMeta.capitalCap)
    ) {
      return {
        action: 'NOOP',
        reason: `compiled.${program.id}.dca_capital_cap`,
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

  if (readCurrentQty(ctx) !== 0) {
    return {
      action: 'NOOP',
      reason: `compiled.${program.id}.reverse.awaiting_flat_position`,
    }
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
): void {
  const compiledState = ensureCompiledDecisionState(ctx)
  compiledState.pendingReverseByProgram[programId] = {
    toSide,
    actionKind: action.kind === 'OPEN_LONG' ? 'OPEN_LONG' : 'OPEN_SHORT',
    quantity: action.quantity,
  }
}

function clearPendingReverse(
  ctx: StrategyExecutionContextV1,
  programId: string,
): void {
  const compiledState = ensureCompiledDecisionState(ctx)
  delete compiledState.pendingReverseByProgram[programId]
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
    ? quantityToExposurePct(nextAction.quantity, ctx, equity)
    : 0

  return currentExposurePct + nextExposurePct > maxExposurePct
}

function exceedsDcaCapitalCap(
  program: DecisionProgramNode,
  ctx: StrategyExecutionContextV1,
  currentCount: number,
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
): number {
  const quoteValue = quantityToQuoteValue(quantity, ctx)
  if (quoteValue === null) {
    return 0
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
    const decision = buildDecision(action, ctx, program.id)
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

function readCurrentQty(ctx: StrategyExecutionContextV1): number {
  const value = ctx.position?.qty
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
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

function readEquity(ctx: StrategyExecutionContextV1): number {
  const accountEquity = ctx.accountEquity
  if (typeof accountEquity === 'number' && Number.isFinite(accountEquity)) {
    return accountEquity
  }

  const value = ctx.portfolio?.equity
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
