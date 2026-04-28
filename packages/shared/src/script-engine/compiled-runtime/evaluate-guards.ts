import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { CompiledRuntimeValue } from './evaluate-expr-pool'

interface GuardProgramNode {
  id: string
	payload: {
		kind?: 'STOP_LOSS_PCT' | 'TAKE_PROFIT_PCT' | 'TRAILING_STOP_PCT' | 'MAX_POSITION_PCT'
		scope?: 'position' | 'strategy' | 'order_program'
		appliesTo?: 'long' | 'short' | 'both'
		value?: number
		onBreach: 'BLOCK_NEW_ENTRY' | 'FORCE_EXIT' | 'HALT_STRATEGY' | 'CANCEL_ORDER_PROGRAMS'
	}
}

export interface CompiledGuardState {
  strategyHalt: boolean
  blockNewEntry: boolean
  forceExit: boolean
  cancelOrderPrograms: boolean
  triggered: readonly string[]
}

export function evaluateGuards(
  ctx: StrategyExecutionContextV1,
  guards: readonly GuardProgramNode[],
  _exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
  guardOrder: readonly string[],
): Readonly<CompiledGuardState> {
  const guardIndex = new Map(guards.map(guard => [guard.id, guard]))
  const state: CompiledGuardState = {
    strategyHalt: false,
    blockNewEntry: false,
    forceExit: false,
    cancelOrderPrograms: false,
    triggered: [],
  }

  for (const guardId of guardOrder) {
    const guard = guardIndex.get(guardId)
    if (!guard) continue
    const breached = isGuardBreached(ctx, guard)
    if (!breached) continue

    state.triggered = [...state.triggered, guardId]

    switch (guard.payload.onBreach) {
      case 'HALT_STRATEGY':
        state.strategyHalt = true
        break
      case 'BLOCK_NEW_ENTRY':
        state.blockNewEntry = true
        break
      case 'FORCE_EXIT':
        state.forceExit = true
        break
      case 'CANCEL_ORDER_PROGRAMS':
        state.cancelOrderPrograms = true
        break
    }
  }

  return Object.freeze({
    ...state,
    triggered: Object.freeze([...state.triggered]),
  })
}

function isGuardBreached(
  ctx: StrategyExecutionContextV1,
  guard: GuardProgramNode,
): boolean {
  if (guard.payload.kind === 'MAX_POSITION_PCT') {
    return isMaxPositionPctBreached(ctx, guard)
  }

  const qty = readPositionQty(ctx)
  const entryPrice = readEntryPrice(ctx)
  const currentPrice = readCurrentPrice(ctx)
  const thresholdPct = readThresholdPct(guard)

	if (qty === 0 || entryPrice == null || currentPrice == null || thresholdPct == null) {
		return false
	}
	if (!doesGuardApplyToPositionSide(guard, qty)) {
		return false
	}

	switch (guard.payload.kind) {
    case 'STOP_LOSS_PCT':
      return thresholdPct > 0 && readPositionPnlPct(qty, entryPrice, currentPrice) <= -thresholdPct
    case 'TAKE_PROFIT_PCT':
      return thresholdPct > 0 && readPositionPnlPct(qty, entryPrice, currentPrice) >= thresholdPct
    case 'TRAILING_STOP_PCT': {
      const trailingAnchor = readTrailingAnchor(ctx, qty)
      if (trailingAnchor == null) return false

      if (qty > 0) {
        if (trailingAnchor <= entryPrice) return false
        return currentPrice <= trailingAnchor * (1 - thresholdPct / 100)
      }

      if (trailingAnchor >= entryPrice) return false
      return currentPrice >= trailingAnchor * (1 + thresholdPct / 100)
    }
    default:
      return false
	}
}

function doesGuardApplyToPositionSide(
	guard: GuardProgramNode,
	qty: number,
): boolean {
	const appliesTo = guard.payload.appliesTo ?? 'both'
	if (appliesTo === 'both') {
		return true
	}
	return appliesTo === (qty > 0 ? 'long' : 'short')
}

function isMaxPositionPctBreached(
  ctx: StrategyExecutionContextV1,
  guard: GuardProgramNode,
): boolean {
  const maxPct = guard.payload.value
  if (typeof maxPct !== 'number' || !Number.isFinite(maxPct) || maxPct < 0) {
    return false
  }

  const absQty = Math.abs(readPositionQty(ctx))
  if (absQty === 0) {
    return false
  }

  if (maxPct === 0) {
    return true
  }

  const exposurePct = readPositionExposurePct(ctx, absQty)
  return exposurePct !== null && exposurePct > maxPct
}

function readPositionExposurePct(
  ctx: StrategyExecutionContextV1,
  absQty: number,
): number | null {
  const directPct = readFirstPositiveOrZeroNumber([
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

  const equity = readEquity(ctx)
  if (equity === null || equity <= 0) {
    return null
  }

  const notional = readFirstPositiveOrZeroNumber([
    ctx.position?.notional,
    ctx.position?.notionalValue,
    ctx.position?.marketValue,
    ctx.position?.value,
  ])
  if (notional !== null) {
    return (Math.abs(notional) / equity) * 100
  }

  const currentPrice = readCurrentPrice(ctx)
  if (currentPrice === null || currentPrice <= 0) {
    return null
  }

  return (absQty * currentPrice / equity) * 100
}

function readThresholdPct(guard: GuardProgramNode): number | null {
  const value = guard.payload.value
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function readPositionQty(ctx: StrategyExecutionContextV1): number {
  const value = ctx.position?.qty
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readEntryPrice(ctx: StrategyExecutionContextV1): number | null {
  const candidates = [
    ctx.position?.avgEntryPrice,
    ctx.position?.entryPrice,
    ctx.position?.avgPrice,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return candidate
    }
  }

  return null
}

function readCurrentPrice(ctx: StrategyExecutionContextV1): number | null {
  const candidates = [
    ctx.currentPrice,
    ctx.baseTimeframeBar?.close,
    Array.isArray(ctx.bars) && ctx.bars.length > 0 ? ctx.bars[ctx.bars.length - 1]?.close : null,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return candidate
    }
  }

  return null
}

function readEquity(ctx: StrategyExecutionContextV1): number | null {
  return readFirstPositiveOrZeroNumber([
    ctx.equity,
    ctx.accountEquity,
    ctx.portfolio?.equity,
    ctx.account?.equity,
    ctx.balance,
    ctx.accountBalance,
  ])
}

function readFirstPositiveOrZeroNumber(candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) {
      return candidate
    }
  }

  return null
}

function readPositionPnlPct(
  qty: number,
  entryPrice: number,
  currentPrice: number,
): number {
  if (!(entryPrice > 0)) return 0
  return qty > 0
    ? ((currentPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - currentPrice) / entryPrice) * 100
}

function readTrailingAnchor(
  ctx: StrategyExecutionContextV1,
  qty: number,
): number | null {
  const longCandidates = [
    ctx.position?.highestPriceSinceEntry,
    ctx.position?.peakPriceSinceEntry,
    ctx.position?.peakPrice,
    ctx.position?.maxPriceSinceEntry,
  ]
  const shortCandidates = [
    ctx.position?.lowestPriceSinceEntry,
    ctx.position?.troughPriceSinceEntry,
    ctx.position?.troughPrice,
    ctx.position?.minPriceSinceEntry,
  ]
  const candidates = qty > 0 ? longCandidates : shortCandidates

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return candidate
    }
  }

  return null
}
