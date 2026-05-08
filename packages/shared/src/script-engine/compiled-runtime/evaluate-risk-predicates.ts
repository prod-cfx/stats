import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { CompiledGuardState } from './evaluate-guards'
import { atr } from '../helpers/technical-indicators'

interface RiskPredicateProgramNode {
  id: string
  payload: {
    id?: string
    kind?: 'atrMultipleStop' | 'atrMultipleTakeProfit' | 'rememberedLevelStop' | 'timeStopBars'
    params?: Readonly<Record<string, number | string | boolean>>
    actions?: ReadonlyArray<{
      kind?: 'FORCE_EXIT' | 'CLOSE_LONG' | 'CLOSE_SHORT'
    }>
  }
}

export function evaluateRiskPredicates(
  ctx: StrategyExecutionContextV1,
  riskPredicates: readonly RiskPredicateProgramNode[] | null | undefined,
  baseGuardState: Readonly<CompiledGuardState>,
  riskPredicateOrder?: readonly string[],
): Readonly<CompiledGuardState> {
  if (!riskPredicates || riskPredicates.length === 0) {
    return freezeGuardState(baseGuardState)
  }

  const triggered = [...baseGuardState.triggered]
  let forceExit = baseGuardState.forceExit
  const predicateIndex = new Map(riskPredicates.map(predicate => [predicate.id, predicate]))
  const orderedPredicates = (riskPredicateOrder && riskPredicateOrder.length > 0
    ? riskPredicateOrder.map(id => predicateIndex.get(id)).filter((predicate): predicate is RiskPredicateProgramNode => predicate !== undefined)
    : [...riskPredicates])

  for (const predicate of orderedPredicates) {
    if (!isRiskPredicateBreached(ctx, predicate)) {
      continue
    }

    if (shouldForceExit(ctx, predicate)) {
      triggered.push(predicate.id)
      forceExit = true
    }
  }

  return Object.freeze({
    strategyHalt: baseGuardState.strategyHalt,
    blockNewEntry: baseGuardState.blockNewEntry,
    forceExit,
    cancelOrderPrograms: baseGuardState.cancelOrderPrograms,
    triggered: Object.freeze(triggered),
  })
}

function shouldForceExit(
  ctx: StrategyExecutionContextV1,
  predicate: RiskPredicateProgramNode,
): boolean {
  const actions = predicate.payload.actions
  if (!actions || actions.length === 0 || actions.some(action => action.kind === 'FORCE_EXIT')) {
    return true
  }

  const qty = readPositionQty(ctx)
  if (qty > 0) return actions.some(action => action.kind === 'CLOSE_LONG')
  if (qty < 0) return actions.some(action => action.kind === 'CLOSE_SHORT')
  return false
}

function freezeGuardState(
  guardState: Readonly<CompiledGuardState>,
): Readonly<CompiledGuardState> {
  return Object.freeze({
    ...guardState,
    triggered: Object.freeze([...guardState.triggered]),
  })
}

function isRiskPredicateBreached(
  ctx: StrategyExecutionContextV1,
  predicate: RiskPredicateProgramNode,
): boolean {
  switch (predicate.payload.kind) {
    case 'atrMultipleStop':
      return isAtrMultipleBreached(ctx, predicate, 'stop')
    case 'atrMultipleTakeProfit':
      return isAtrMultipleBreached(ctx, predicate, 'takeProfit')
    case 'rememberedLevelStop':
      return isRememberedLevelStopBreached(ctx, predicate)
    case 'timeStopBars':
      return isTimeStopBarsBreached(ctx, predicate)
    default:
      return false
  }
}

function isTimeStopBarsBreached(
  ctx: StrategyExecutionContextV1,
  predicate: RiskPredicateProgramNode,
): boolean {
  const position = ctx.position as Record<string, unknown> | undefined
  if (!position) return false

  const qty = readPositionQty(ctx)
  if (qty === 0) return false

  const scope = typeof predicate.payload.params?.scope === 'string'
    ? predicate.payload.params.scope
    : 'both'
  if (scope === 'long' && qty <= 0) return false
  if (scope === 'short' && qty >= 0) return false

  const barsHeldRaw = position.barsHeld
  if (typeof barsHeldRaw !== 'number' || !Number.isFinite(barsHeldRaw)) return false

  const entryTimeframeRaw = position.entryTimeframe
  if (typeof entryTimeframeRaw === 'string' && entryTimeframeRaw.length > 0) {
    if (entryTimeframeRaw !== ctx.timeframe) return false
  }

  const maxBarsRaw = predicate.payload.params?.maxBars
  const maxBars = typeof maxBarsRaw === 'number' ? maxBarsRaw : Number(maxBarsRaw)
  if (!Number.isInteger(maxBars) || maxBars <= 0) return false

  return barsHeldRaw >= maxBars
}

function isAtrMultipleBreached(
  ctx: StrategyExecutionContextV1,
  predicate: RiskPredicateProgramNode,
  mode: 'stop' | 'takeProfit',
): boolean {
  const qty = readPositionQty(ctx)
  const entryPrice = readEntryPrice(ctx)
  const currentPrice = readCurrentPrice(ctx)
  const multiple = readPositiveNumber(predicate.payload.params?.multiple)
  const period = readPositiveNumber(predicate.payload.params?.period) ?? 14
  const atrValue = readAtr(ctx, period)

  if (qty === 0 || entryPrice === null || currentPrice === null || multiple === null || atrValue === null) {
    return false
  }

  const threshold = atrValue * multiple
  if (qty > 0) {
    return mode === 'stop'
      ? currentPrice <= entryPrice - threshold
      : currentPrice >= entryPrice + threshold
  }

  return mode === 'stop'
    ? currentPrice >= entryPrice + threshold
    : currentPrice <= entryPrice - threshold
}

function isRememberedLevelStopBreached(
  ctx: StrategyExecutionContextV1,
  predicate: RiskPredicateProgramNode,
): boolean {
  const levelKey = typeof predicate.payload.params?.levelKey === 'string'
    ? predicate.payload.params.levelKey.trim()
    : ''
  if (!levelKey) return false

  const qty = readPositionQty(ctx)
  const currentPrice = readCurrentPrice(ctx)
  const level = readRememberedLevel(ctx, levelKey)
  if (qty === 0 || currentPrice === null || level === null) {
    return false
  }

  return qty > 0 ? currentPrice <= level : currentPrice >= level
}

function readAtr(
  ctx: StrategyExecutionContextV1,
  period: number,
): number | null {
  const bars = Array.isArray(ctx.bars) ? ctx.bars : []
  if (bars.length < period + 1) return null
  return atr(bars.slice(-(period + 1)), period)
}

function readRememberedLevel(
  ctx: StrategyExecutionContextV1,
  levelKey: string,
): number | null {
  const semanticRuntimeState = (ctx as Record<string, unknown>).semanticRuntimeState
  if (!semanticRuntimeState || typeof semanticRuntimeState !== 'object' || Array.isArray(semanticRuntimeState)) {
    return null
  }

  const state = (semanticRuntimeState as Record<string, unknown>)[levelKey]
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return null
  }

  return readFirstFiniteNumber([
    (state as Record<string, unknown>).rememberedLevel,
    (state as Record<string, unknown>).level,
    (state as Record<string, unknown>).price,
    (state as Record<string, unknown>).stopLevel,
    (state as Record<string, unknown>).value,
  ])
}

function readPositionQty(ctx: StrategyExecutionContextV1): number {
  const value = ctx.position?.qty
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readEntryPrice(ctx: StrategyExecutionContextV1): number | null {
  return readFirstPositiveNumber([
    ctx.position?.avgEntryPrice,
    ctx.position?.entryPrice,
    ctx.position?.avgPrice,
  ])
}

function readCurrentPrice(ctx: StrategyExecutionContextV1): number | null {
  return readFirstPositiveNumber([
    ctx.currentPrice,
    ctx.baseTimeframeBar?.close,
    Array.isArray(ctx.bars) && ctx.bars.length > 0 ? ctx.bars[ctx.bars.length - 1]?.close : null,
  ])
}

function readPositiveNumber(value: unknown): number | null {
  const normalized = typeof value === 'string' ? Number(value) : value
  return typeof normalized === 'number' && Number.isFinite(normalized) && normalized > 0 ? normalized : null
}

function readFirstPositiveNumber(candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    const value = readPositiveNumber(candidate)
    if (value !== null) return value
  }

  return null
}

function readFirstFiniteNumber(candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
  }

  return null
}
