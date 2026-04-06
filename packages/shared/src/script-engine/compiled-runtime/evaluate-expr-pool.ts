import type { Bar } from '../helpers'
import type { StrategyExecutionContextV1 } from '../../strategy-protocol'

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
  payload: {
    kind?: string
    field?: 'open' | 'high' | 'low' | 'close'
    value?: number
    params?: Record<string, number>
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

  for (const exprId of exprOrder) {
    const node = exprIndex.get(exprId)
    if (!node) continue
    values[exprId] = evaluateNode(node, values, ctx, executionModel)
  }

  return Object.freeze({ ...values })
}

function evaluateNode(
  node: CompiledExprNode,
  values: Record<string, CompiledRuntimeValue>,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
): CompiledRuntimeValue {
  if (node.nodeType === 'series') {
    return evaluateSeries(node, values, ctx, executionModel)
  }

  return evaluatePredicate(node, values)
}

function evaluateSeries(
  node: CompiledExprNode,
  values: Record<string, CompiledRuntimeValue>,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
): CompiledRuntimeValue {
  const latestBar = Array.isArray(ctx.bars) && ctx.bars.length > 0
    ? ctx.bars[ctx.bars.length - 1] ?? null
    : null

  switch (node.payload.kind) {
    case 'CONST':
      return typeof node.payload.value === 'number' ? node.payload.value : null
    case 'PRICE':
      return readLatestPrice(node.payload.field ?? 'close', latestBar, executionModel)
    default: {
      const firstDep = node.deps?.[0]
      return typeof firstDep === 'string' ? values[firstDep] ?? null : null
    }
  }
}

function evaluatePredicate(
  node: CompiledExprNode,
  values: Record<string, CompiledRuntimeValue>,
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
    case 'CROSS_UNDER':
      return false
    default:
      return false
  }
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
