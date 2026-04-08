import type { Bar } from '../helpers'
import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import { bollingerBands } from '../helpers/technical-indicators'

export type CompiledRuntimeValue =
  | number
  | boolean
  | null
  | {
    levels: number[]
  }

interface CompiledExprNode {
  id: string
  nodeType: 'series' | 'predicate'
  deps?: string[]
  sourceRef?: string
  payload: {
    kind?: string
    timeframe?: string
    field?: 'open' | 'high' | 'low' | 'close'
    offsetBars?: number
    inputs?: string[]
    value?: number
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
      return typeof node.payload.value === 'number' ? node.payload.value : null
    case 'PRICE':
    case 'UPPER_BAND':
    case 'MID_BAND':
    case 'LOWER_BAND':
    case 'BOLLINGER_BARS_OUTSIDE':
      return resolveSeriesValueAt(node.id, 0, ctx, executionModel, exprIndex, seriesMemo)
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
      return compare(left, right, (a, b) => a === b)
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
    default:
      return false
  }
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
  if (!exprIndex) return node.deps?.[0] ?? node.payload.inputs?.[0]

  for (const depId of node.deps ?? []) {
    if (exprIndex.has(depId)) return depId
  }

  for (const inputId of node.payload.inputs ?? []) {
    if (exprIndex.has(inputId)) return inputId
  }

  for (const inputId of node.payload.inputs ?? []) {
    for (const candidate of exprIndex.values()) {
      if (candidate.sourceRef === inputId) {
        return candidate.id
      }
    }
  }

  return node.deps?.[0] ?? node.payload.inputs?.[0]
}
