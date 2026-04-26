import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { Bar } from '../helpers'
import { atr, bollingerBands, ema, macd, rsi, sma } from '../helpers/technical-indicators'

export type CompiledRuntimeValue =
  | number
  | string
  | boolean
  | null
  | {
    levels: number[]
  }

interface CompiledExprNode {
  id: string
  nodeType: 'series' | 'level_set' | 'predicate'
  deps?: string[]
  sourceRef?: string
  payload: {
    kind?: string
    timeframe?: string
    field?: 'open' | 'high' | 'low' | 'close'
    offsetBars?: number
    inputs?: string[]
    value?: number | string
    params?: Record<string, number | string>
  }
}

export function evaluateExprPool(
  ctx: StrategyExecutionContextV1,
  exprPool: readonly CompiledExprNode[],
  exprOrder: readonly string[],
  executionModel?: Record<string, unknown>,
): Readonly<Record<string, CompiledRuntimeValue>> {
  const exprIndex = new Map(exprPool.map(item => [item.id, item]))
  const values: Record<string, CompiledRuntimeValue> = {}
  const seriesMemo = new Map<string, number | null>()

  for (const exprId of exprOrder) {
    const node = exprIndex.get(exprId)
    if (!node) continue
    values[exprId] = evaluateNode(node, values, ctx, executionModel, exprIndex, seriesMemo)
  }

  return Object.freeze({ ...values })
}

function evaluateNode(
  node: CompiledExprNode,
  values: Record<string, CompiledRuntimeValue>,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
  seriesMemo?: Map<string, number | null>,
): CompiledRuntimeValue {
  if (node.nodeType === 'series') {
    return evaluateSeries(node, values, ctx, executionModel, exprIndex, seriesMemo)
  }

  if (node.nodeType === 'level_set') {
    return evaluateLevelSet(node, values)
  }

  return evaluatePredicate(node, values, ctx, executionModel, exprIndex, seriesMemo)
}

function evaluateSeries(
  node: CompiledExprNode,
  values: Record<string, CompiledRuntimeValue>,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
  seriesMemo?: Map<string, number | null>,
): CompiledRuntimeValue {
  switch (node.payload.kind) {
    case 'CONST':
      return typeof node.payload.value === 'number' || typeof node.payload.value === 'string'
        ? node.payload.value
        : null
    case 'PRICE':
    case 'BAR_INDEX':
    case 'PRICE_CHANGE_PCT':
    case 'RANGE_POSITION_PCT':
    case 'EMA':
    case 'SMA':
    case 'RSI':
    case 'ATR':
    case 'MACD_LINE':
    case 'MACD_SIGNAL':
    case 'HIGHEST_HIGH':
    case 'LOWEST_LOW':
    case 'POSITION_BARS_HELD':
    case 'POSITION_AVG_PRICE':
    case 'POSITION_PNL_PCT':
    case 'UPPER_BAND':
    case 'MID_BAND':
    case 'LOWER_BAND':
    case 'BOLLINGER_BARS_OUTSIDE':
      return resolveSeriesValueAt(node.id, 0, ctx, executionModel, exprIndex, seriesMemo)
    case 'MARKET_REGIME':
      return readStringContextValue(ctx.marketRegime)
    case 'TREND_DIRECTION':
      return readStringContextValue(ctx.trendDirection)
    case 'VOLATILITY_STATE':
      return readStringContextValue(ctx.volatilityState)
    default: {
      const firstDep = node.deps?.[0]
      return typeof firstDep === 'string' ? values[firstDep] ?? null : null
    }
  }
}

function evaluatePredicate(
  node: CompiledExprNode,
  values: Record<string, CompiledRuntimeValue>,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
  seriesMemo?: Map<string, number | null>,
): CompiledRuntimeValue {
  const [leftId, rightId] = node.deps ?? []
  const left = typeof leftId === 'string' ? values[leftId] : null
  const right = typeof rightId === 'string' ? values[rightId] : null

  switch (node.payload.kind) {
    case 'GT':
      return compare(left, right, (a, b) => a > b)
    case 'GTE':
      return compare(left, right, (a, b) => a >= b)
    case 'LT':
      return compare(left, right, (a, b) => a < b)
    case 'LTE':
      return compare(left, right, (a, b) => a <= b)
    case 'EQ':
      return compareEq(left, right)
    case 'AND':
      return (node.deps ?? []).every(dep => values[dep] === true)
    case 'OR':
      return (node.deps ?? []).some(dep => values[dep] === true)
    case 'NOT':
      return node.deps?.[0] ? values[node.deps[0]] !== true : true
    case 'CROSS_OVER':
      return crossesOver(leftId, rightId, ctx, executionModel, exprIndex, seriesMemo)
    case 'CROSS_UNDER':
      return crossesUnder(leftId, rightId, ctx, executionModel, exprIndex, seriesMemo)
    case 'TOUCH_LEVEL_DOWN':
      return touchesLevel(leftId, rightId, values, ctx, executionModel, exprIndex, seriesMemo, 'down')
    case 'TOUCH_LEVEL_UP':
      return touchesLevel(leftId, rightId, values, ctx, executionModel, exprIndex, seriesMemo, 'up')
    default:
      return false
  }
}

function evaluateLevelSet(
  node: CompiledExprNode,
  values: Record<string, CompiledRuntimeValue>,
): CompiledRuntimeValue {
  const anchor = node.deps?.[0] ? values[node.deps[0]] : null
  const lowerBound = node.deps?.[1] ? values[node.deps[1]] : null
  const upperBound = node.deps?.[2] ? values[node.deps[2]] : null
  if (typeof anchor !== 'number') {
    return { levels: [] }
  }

  const payload = node.payload as Record<string, any>
  const spacingMode = payload.params?.mode ?? payload.spacing?.mode
  const spacingValueRaw = payload.params?.value ?? payload.spacing?.value
  const spacingValue = typeof spacingValueRaw === 'number'
    ? spacingValueRaw
    : typeof spacingValueRaw === 'string'
      ? Number(spacingValueRaw)
      : null
  const upLevelsRaw = payload.params?.up ?? payload.levelsPerSide?.up
  const upLevels = typeof upLevelsRaw === 'number'
    ? upLevelsRaw
    : typeof upLevelsRaw === 'string'
      ? Number(upLevelsRaw)
      : 0

  const lower = typeof lowerBound === 'number' ? lowerBound : null
  const upper = typeof upperBound === 'number' ? upperBound : null
  if (spacingMode !== 'pct' || typeof spacingValue !== 'number' || spacingValue <= 0 || upLevels <= 0) {
    return { levels: [] }
  }

  const levels: number[] = []
  const arithmeticStep = anchor * (spacingValue / 100)
  let current: number
  for (let index = 0; index < upLevels; index += 1) {
    if (index === 0) {
      current = anchor
    } else {
      current = anchor + arithmeticStep * index
    }
    if (lower !== null && current < lower) continue
    if (upper !== null && current > upper) break
    levels.push(current)
  }

  return { levels }
}

function crossesOver(
  leftId: string | undefined,
  rightId: string | undefined,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
  seriesMemo?: Map<string, number | null>,
): boolean {
  const currentLeft = resolveSeriesValueAt(leftId, 0, ctx, executionModel, exprIndex, seriesMemo)
  const currentRight = resolveSeriesValueAt(rightId, 0, ctx, executionModel, exprIndex, seriesMemo)
  const previousLeft = resolveSeriesValueAt(leftId, 1, ctx, executionModel, exprIndex, seriesMemo)
  const previousRight = resolveSeriesValueAt(rightId, 1, ctx, executionModel, exprIndex, seriesMemo)

  if (
    currentLeft == null
    || currentRight == null
    || previousLeft == null
    || previousRight == null
  ) {
    return false
  }

  return previousLeft <= previousRight && currentLeft > currentRight
}

function crossesUnder(
  leftId: string | undefined,
  rightId: string | undefined,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
  seriesMemo?: Map<string, number | null>,
): boolean {
  const currentLeft = resolveSeriesValueAt(leftId, 0, ctx, executionModel, exprIndex, seriesMemo)
  const currentRight = resolveSeriesValueAt(rightId, 0, ctx, executionModel, exprIndex, seriesMemo)
  const previousLeft = resolveSeriesValueAt(leftId, 1, ctx, executionModel, exprIndex, seriesMemo)
  const previousRight = resolveSeriesValueAt(rightId, 1, ctx, executionModel, exprIndex, seriesMemo)

  if (
    currentLeft == null
    || currentRight == null
    || previousLeft == null
    || previousRight == null
  ) {
    return false
  }

  return previousLeft >= previousRight && currentLeft < currentRight
}

function compare(
  left: CompiledRuntimeValue,
  right: CompiledRuntimeValue,
  predicate: (left: number, right: number) => boolean,
): boolean {
  if (typeof left !== 'number' || typeof right !== 'number') return false
  return predicate(left, right)
}

function compareEq(
  left: CompiledRuntimeValue,
  right: CompiledRuntimeValue,
): boolean {
  if (typeof left === 'number' && typeof right === 'number') return left === right
  if (typeof left === 'string' && typeof right === 'string') return left === right
  if (typeof left === 'boolean' && typeof right === 'boolean') return left === right
  return false
}

function readStringContextValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function touchesLevel(
  priceExprId: string | undefined,
  levelSetExprId: string | undefined,
  values: Record<string, CompiledRuntimeValue>,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
  seriesMemo?: Map<string, number | null>,
  direction?: 'up' | 'down',
): boolean {
  const currentPrice = resolveSeriesValueAt(priceExprId, 0, ctx, executionModel, exprIndex, seriesMemo)
  const previousPrice = resolveSeriesValueAt(priceExprId, 1, ctx, executionModel, exprIndex, seriesMemo)
  const levelSetNode = levelSetExprId && exprIndex ? exprIndex.get(levelSetExprId) : null
  if (!levelSetNode) return false
  const levelSet = evaluateLevelSet(levelSetNode, values)
  if (typeof currentPrice !== 'number' || typeof previousPrice !== 'number' || !levelSet || typeof levelSet !== 'object' || !Array.isArray(levelSet.levels)) {
    return false
  }

  return levelSet.levels.some((level) => {
    if (direction === 'down') {
      return previousPrice > level && currentPrice <= level
    }
    return previousPrice < level && currentPrice >= level
  })
}

function readLatestPrice(
  field: 'open' | 'high' | 'low' | 'close',
  latestBar: Pick<Bar, 'open' | 'high' | 'low' | 'close'> | null,
  executionModel?: Record<string, unknown>,
): number | null {
  const barValue = latestBar?.[field]
  if (typeof barValue === 'number' && Number.isFinite(barValue)) return barValue

  const currentPrice = executionModel?.currentPrice
  return typeof currentPrice === 'number' && Number.isFinite(currentPrice) ? currentPrice : null
}

function resolveSeriesValueAt(
  nodeId: string | undefined,
  offset: number,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
  seriesMemo?: Map<string, number | null>,
): number | null {
  if (!nodeId || !exprIndex) return null

  const memoKey = `${nodeId}:${offset}`
  if (seriesMemo?.has(memoKey)) {
    return seriesMemo.get(memoKey) ?? null
  }

  const node = exprIndex.get(nodeId)
  if (!node || node.nodeType !== 'series') {
    return null
  }

  const bars = Array.isArray(ctx.bars) ? ctx.bars : []
  const resolved = (() => {
    switch (node.payload.kind) {
      case 'CONST':
        return typeof node.payload.value === 'number' ? node.payload.value : null
      case 'PRICE':
        return readPriceAtOffset(
          node.payload.field ?? 'close',
          bars,
          (node.payload.offsetBars ?? 0) + offset,
          executionModel,
        )
      case 'PRICE_CHANGE_PCT': {
        const [currentSeriesId, compareSeriesId] = resolveSeriesInputNodeIds(node, exprIndex)
        const current = resolveSeriesValueAt(
          currentSeriesId,
          offset + (node.payload.offsetBars ?? 0),
          ctx,
          executionModel,
          exprIndex,
          seriesMemo,
        )
        const previous = resolveSeriesValueAt(
          compareSeriesId,
          offset + (node.payload.offsetBars ?? 0),
          ctx,
          executionModel,
          exprIndex,
          seriesMemo,
        )
        if (current == null || previous == null || previous === 0) return null
        return (current - previous) / previous
      }
      case 'EMA':
      case 'SMA': {
        const inputId = resolveSeriesInputNodeId(node, exprIndex)
        const period = readNumericParam(node.payload.params, 'period') ?? 20
        const history = collectSeriesHistory(inputId, offset + (node.payload.offsetBars ?? 0), ctx, executionModel, exprIndex, seriesMemo)
        if (node.payload.kind === 'EMA') {
          return ema(history, period)
        }
        return sma(history, period)
      }
      case 'RSI': {
        const inputId = resolveSeriesInputNodeId(node, exprIndex)
        const period = readNumericParam(node.payload.params, 'period') ?? 14
        const history = collectSeriesHistory(inputId, offset + (node.payload.offsetBars ?? 0), ctx, executionModel, exprIndex, seriesMemo)
        return rsi(history, period)
      }
      case 'ATR': {
        const period = readNumericParam(node.payload.params, 'period') ?? 14
        const barHistory = collectBarHistory(period + 1, offset + (node.payload.offsetBars ?? 0), bars)
        return atr(barHistory, period)
      }
      case 'MACD_LINE':
      case 'MACD_SIGNAL': {
        const inputId = resolveSeriesInputNodeId(node, exprIndex)
        const fastPeriod = readNumericParam(node.payload.params, 'fastPeriod') ?? 12
        const slowPeriod = readNumericParam(node.payload.params, 'slowPeriod') ?? 26
        const signalPeriod = readNumericParam(node.payload.params, 'signalPeriod') ?? 9
        const history = collectSeriesHistory(inputId, offset + (node.payload.offsetBars ?? 0), ctx, executionModel, exprIndex, seriesMemo)
        const result = macd(history, fastPeriod, slowPeriod, signalPeriod)
        if (!result) return null
        return node.payload.kind === 'MACD_LINE' ? result.macd : result.signal
      }
      case 'HIGHEST_HIGH': {
        const period = readNumericParam(node.payload.params, 'period') ?? 20
        const window = collectBarHistory(period, offset + (node.payload.offsetBars ?? 0) + 1, bars)
        if (window.length === 0) return null
        return Math.max(...window.map(bar => bar.high))
      }
      case 'LOWEST_LOW': {
        const period = readNumericParam(node.payload.params, 'period') ?? 20
        const window = collectBarHistory(period, offset + (node.payload.offsetBars ?? 0) + 1, bars)
        if (window.length === 0) return null
        return Math.min(...window.map(bar => bar.low))
      }
      case 'RANGE_POSITION_PCT': {
        const [closeSeriesId, highSeriesId, lowSeriesId] = resolveSeriesInputNodeIds(node, exprIndex)
        const close = resolveSeriesValueAt(
          closeSeriesId,
          offset + (node.payload.offsetBars ?? 0),
          ctx,
          executionModel,
          exprIndex,
          seriesMemo,
        )
        const high = resolveSeriesValueAt(
          highSeriesId,
          offset + (node.payload.offsetBars ?? 0),
          ctx,
          executionModel,
          exprIndex,
          seriesMemo,
        )
        const low = resolveSeriesValueAt(
          lowSeriesId,
          offset + (node.payload.offsetBars ?? 0),
          ctx,
          executionModel,
          exprIndex,
          seriesMemo,
        )
        if (close == null || high == null || low == null || high <= low) return null
        return (close - low) / (high - low)
      }
      case 'BAR_INDEX': {
        const raw = (ctx as Record<string, unknown>).__compiledDecisionState
        const barIndex = raw && typeof raw === 'object' && !Array.isArray(raw)
          ? (raw as { barIndex?: unknown }).barIndex
          : null
        return typeof barIndex === 'number' && Number.isFinite(barIndex) ? barIndex : null
      }
      case 'POSITION_BARS_HELD': {
        const raw = (ctx.position as Record<string, unknown> | undefined)?.barsHeld
        return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
      }
      case 'POSITION_AVG_PRICE':
        return readPositionAvgPrice(ctx)
      case 'POSITION_PNL_PCT':
        return readPositionPnlPct(ctx, executionModel)
      case 'UPPER_BAND':
      case 'MID_BAND':
      case 'LOWER_BAND': {
        const inputId = resolveSeriesInputNodeId(node, exprIndex)
        const period = readNumericParam(node.payload.params, 'period') ?? 20
        const stdDev = readNumericParam(node.payload.params, 'stdDev') ?? 2
        const bandOffset = offset + (node.payload.offsetBars ?? 0)
        const window = collectSeriesWindow(inputId, period, bandOffset, ctx, executionModel, exprIndex, seriesMemo)
        const band = bollingerBands(window, period, stdDev)
        if (!band) return null
        if (node.payload.kind === 'UPPER_BAND') return band.upper
        if (node.payload.kind === 'LOWER_BAND') return band.lower
        return band.middle
      }
      case 'BOLLINGER_BARS_OUTSIDE': {
        const period = readNumericParam(node.payload.params, 'period') ?? 20
        const stdDev = readNumericParam(node.payload.params, 'stdDev') ?? 2
        const bandSide = readStringParam(node.payload.params, 'bandSide') ?? 'outside'
        const bandShift = node.payload.offsetBars ?? 0
        let streak = 0
        let cursor = offset

        while (true) {
          const close = readPriceAtOffset('close', bars, cursor, executionModel)
          if (close == null) break
          const window = collectPriceWindow(period, cursor + bandShift, bars)
          const band = bollingerBands(window, period, stdDev)
          if (!band) break
          const outside = bandSide === 'upper'
            ? close > band.upper
            : bandSide === 'lower'
              ? close < band.lower
              : close > band.upper || close < band.lower
          if (!outside) break
          streak += 1
          cursor += 1
        }

        return streak
      }
      default: {
        const firstDep = node.deps?.[0]
        return typeof firstDep === 'string'
          ? resolveSeriesValueAt(firstDep, offset, ctx, executionModel, exprIndex, seriesMemo)
          : null
      }
    }
  })()

  seriesMemo?.set(memoKey, resolved)
  return resolved
}

function collectSeriesHistory(
  nodeId: string | undefined,
  offset: number,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
  seriesMemo?: Map<string, number | null>,
): number[] {
  const bars = Array.isArray(ctx.bars) ? ctx.bars : []
  if (bars.length === 0 || offset < 0 || offset >= bars.length) return []

  const result: number[] = []
  for (let relative = bars.length - 1; relative >= offset; relative -= 1) {
    const value = resolveSeriesValueAt(nodeId, relative, ctx, executionModel, exprIndex, seriesMemo)
    if (value == null) return []
    result.push(value)
  }
  return result
}

function collectSeriesWindow(
  nodeId: string | undefined,
  period: number,
  offset: number,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
  seriesMemo?: Map<string, number | null>,
): number[] {
  if (!Number.isFinite(period) || period <= 0) return []

  const result: number[] = []
  for (let relative = period - 1 + offset; relative >= offset; relative -= 1) {
    const value = resolveSeriesValueAt(nodeId, relative, ctx, executionModel, exprIndex, seriesMemo)
    if (value == null) return []
    result.push(value)
  }
  return result
}

function collectPriceWindow(period: number, offset: number, bars: readonly Bar[]): number[] {
  if (!Number.isFinite(period) || period <= 0) return []

  const result: number[] = []
  for (let relative = period - 1 + offset; relative >= offset; relative -= 1) {
    const value = readPriceAtOffset('close', bars, relative)
    if (value == null) return []
    result.push(value)
  }
  return result
}

function collectBarHistory(
  period: number,
  offset: number,
  bars: readonly Pick<Bar, 'open' | 'high' | 'low' | 'close'>[],
): Bar[] {
  if (!Number.isFinite(period) || period <= 0) return []

  const result: Bar[] = []
  for (let relative = period - 1 + offset; relative >= offset; relative -= 1) {
    const bar = bars[bars.length - 1 - relative]
    if (!bar) return []
    result.push({
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: 0,
      timestamp: 0,
    })
  }
  return result
}

function readPriceAtOffset(
  field: 'open' | 'high' | 'low' | 'close',
  bars: readonly Pick<Bar, 'open' | 'high' | 'low' | 'close'>[],
  offset: number,
  executionModel?: Record<string, unknown>,
): number | null {
  const target = bars[bars.length - 1 - offset] ?? null
  return readLatestPrice(field, target, offset === 0 ? executionModel : undefined)
}

function readNumericParam(
  params: Record<string, number | string> | undefined,
  key: string,
): number | null {
  const raw = params?.[key]
  const value = typeof raw === 'string' ? Number(raw) : raw
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readStringParam(
  params: Record<string, number | string> | undefined,
  key: string,
): string | null {
  const raw = params?.[key]
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

function resolveSeriesInputNodeId(
  node: CompiledExprNode,
  exprIndex: ReadonlyMap<string, CompiledExprNode> | undefined,
): string | undefined {
  return resolveSeriesInputNodeIds(node, exprIndex)[0]
}

function resolveSeriesInputNodeIds(
  node: CompiledExprNode,
  exprIndex: ReadonlyMap<string, CompiledExprNode> | undefined,
): string[] {
  if (!exprIndex) {
    return [...(node.deps ?? []), ...(node.payload.inputs ?? [])].filter((value): value is string => typeof value === 'string')
  }

  const resolved: string[] = []
  const candidates = [...(node.deps ?? []), ...(node.payload.inputs ?? [])]
  const seen = new Set<string>()

  for (const candidateId of candidates) {
    if (!candidateId || seen.has(candidateId)) continue
    seen.add(candidateId)
    if (exprIndex.has(candidateId)) {
      resolved.push(candidateId)
      continue
    }

    for (const candidate of exprIndex.values()) {
      if (candidate.sourceRef === candidateId) {
        resolved.push(candidate.id)
        break
      }
    }
  }

  return resolved.length > 0
    ? resolved
    : [...(node.deps ?? []), ...(node.payload.inputs ?? [])].filter((value): value is string => typeof value === 'string')
}

function readPositionAvgPrice(ctx: StrategyExecutionContextV1): number | null {
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

function readPositionPnlPct(
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
): number | null {
  const avgEntryPrice = readPositionAvgPrice(ctx)
  const qty = ctx.position?.qty
  const currentPrice = readLatestPrice('close', ctx.baseTimeframeBar ?? null, executionModel)

  if (
    avgEntryPrice == null
    || typeof qty !== 'number'
    || !Number.isFinite(qty)
    || qty === 0
    || currentPrice == null
  ) {
    return null
  }

  if (qty > 0) {
    return ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100
  }

  return ((avgEntryPrice - currentPrice) / avgEntryPrice) * 100
}
