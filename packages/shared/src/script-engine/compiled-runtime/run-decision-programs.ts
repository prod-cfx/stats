import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { CompiledRuntimeValue } from './evaluate-expr-pool'
import type { CompiledGuardState } from './evaluate-guards'

interface PartialTakeProfitMeta {
  memoryKey: string
  tierIndex: number
  totalTiers: number
}

interface DecisionProgramNode {
  id: string
  phase: 'entry' | 'exit' | 'rebalance'
  priority: number
  when: string
  cooldownBars?: number
  metadata?: {
    partialTakeProfit?: PartialTakeProfitMeta
  }
  actions: Array<{
    kind: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'REDUCE_LONG' | 'REDUCE_SHORT'
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

    const decision = buildFirstApplicableDecision(program, ctx)
    if (!decision) continue

    compiledState.lastTriggeredByProgram[program.id] = compiledState.barIndex
    if (ptpMeta) {
      markPartialTakeProfitTierFired(ctx, ptpMeta)
    }
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
    return c as CompiledDecisionState
  }

  const fallback: CompiledDecisionState = {
    barIndex: 0,
    lastTriggeredByProgram: {},
    previousPositionQty: readCurrentQty(ctx),
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
    const semanticState = (ctx as { semanticRuntimeState?: Record<string, Record<string, unknown>> }).semanticRuntimeState
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
  const semanticState = (ctx as { semanticRuntimeState?: Record<string, Record<string, unknown>> }).semanticRuntimeState
  const slot = semanticState?.[meta.memoryKey]
  if (!slot || typeof slot !== 'object') return false
  return slot[`tier_${meta.tierIndex}_fired`] === true
}

function markPartialTakeProfitTierFired(
  ctx: StrategyExecutionContextV1,
  meta: PartialTakeProfitMeta,
): void {
  const root = ctx as { semanticRuntimeState?: Record<string, Record<string, unknown>> }
  if (!root.semanticRuntimeState || typeof root.semanticRuntimeState !== 'object') {
    root.semanticRuntimeState = {}
  }
  if (!root.semanticRuntimeState[meta.memoryKey] || typeof root.semanticRuntimeState[meta.memoryKey] !== 'object') {
    root.semanticRuntimeState[meta.memoryKey] = {}
  }
  root.semanticRuntimeState[meta.memoryKey][`tier_${meta.tierIndex}_fired`] = true
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

  switch (action.quantity.mode) {
    case 'position_pct':
      return direction * Math.abs(context.currentQty) * (Math.abs(rawValue) / 100)
    case 'fixed_base':
      return direction * Math.abs(rawValue)
    case 'fixed_quote':
      return context.currentPrice > 0
        ? direction * (Math.abs(rawValue) / context.currentPrice)
        : 0
    case 'pct_equity':
      return context.currentPrice > 0
        ? direction * ((Math.max(0, context.equity) * Math.abs(rawValue)) / 100 / context.currentPrice)
        : 0
  }
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
  const value = ctx.portfolio?.equity
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
