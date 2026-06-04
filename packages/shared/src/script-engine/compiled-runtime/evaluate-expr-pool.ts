import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { Bar } from '../helpers'
import { atr, bollingerBands, chartPatternDetector, ema, macd, priceHighsLows, rsi, sma } from '../helpers/technical-indicators'
import { candlePatternDetector } from '../helpers/candle-pattern-detector'
import { liquiditySweepDetector } from './liquidity-sweep-detector'

export type CompiledRuntimeValue =
  | number
  | string
  | boolean
  | null
  | {
    levels: number[]
  }

interface CompiledTimeWindow {
  readonly daysOfWeek?: readonly number[]
  readonly start: string
  readonly end: string
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
    params?: Record<string, number | string | boolean>
    memoryKey?: string
    path?: string[]
    timezone?: string
    windows?: ReadonlyArray<CompiledTimeWindow>
  }
}

type RuntimeFeedEvent = { id?: unknown; ts?: unknown; payload?: unknown }

const sortedFeedEventsCache = new WeakMap<ReadonlyArray<RuntimeFeedEvent>, ReadonlyArray<RuntimeFeedEvent>>()

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
    case 'DEPLOYMENT_PRICE':
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
    case 'LIQUIDITY_SWEEP':
    case 'VOLUME':
    case 'SMA_VOLUME':
    case 'POSITION_BARS_HELD':
    case 'POSITION_AVG_PRICE':
    case 'POSITION_PNL_PCT':
    case 'UPPER_BAND':
    case 'MID_BAND':
    case 'LOWER_BAND':
    case 'BOLLINGER_BARS_OUTSIDE':
    case 'CANDLE_PATTERN':
    case 'INDICATOR_DIVERGENCE':
    case 'CHART_PATTERN':
      return resolveSeriesValueAt(node.id, 0, ctx, executionModel, exprIndex, seriesMemo)
    case 'MARKET_REGIME':
      return readStringContextValue(ctx.marketRegime)
    case 'TREND_DIRECTION':
      return readStringContextValue(ctx.trendDirection)
    case 'VOLATILITY_STATE':
      return readStringContextValue(ctx.volatilityState)
    case 'MEMORY':
      return evaluateMemoryOperand(node, ctx)
    case 'IN_TIME_WINDOW': {
      const bars = Array.isArray(ctx.bars) ? ctx.bars as Array<{ timestamp?: unknown }> : []
      const nowRaw = typeof ctx.timestamp === 'number' && Number.isFinite(ctx.timestamp)
        ? ctx.timestamp
        : bars.length > 0
          ? (bars[bars.length - 1]?.timestamp ?? null)
          : null
      if (typeof nowRaw !== 'number' || !Number.isFinite(nowRaw)) return false
      const timezone = readStringValue(node.payload.timezone) ?? 'UTC'
      const windows = node.payload.windows ?? []
      return evaluateInTimeWindow(nowRaw, timezone, windows)
    }
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
    case 'allOf':
      return (node.deps ?? []).every(dep => values[dep] === true)
    case 'anyOf':
      return (node.deps ?? []).some(dep => values[dep] === true)
    case 'NOT':
      return node.deps?.[0] ? values[node.deps[0]] !== true : true
    case 'CROSS_OVER':
      return crossesOver(leftId, rightId, ctx, executionModel, exprIndex, seriesMemo)
    case 'CROSS_UNDER':
      return crossesUnder(leftId, rightId, ctx, executionModel, exprIndex, seriesMemo)
    case 'compare':
      return evaluateGenericCompare(node, left, right, ctx, executionModel, exprIndex, seriesMemo)
    case 'cross':
      return evaluateGenericCross(node, ctx, executionModel, exprIndex, seriesMemo)
    case 'externalSignal':
      return evaluateExternalSignal(node, ctx)
    case 'fundingRateCondition':
      return evaluateFundingRateCondition(node, ctx)
    case 'liquidationCondition':
      return evaluateLiquidationCondition(node, ctx)
    case 'orderbookImbalance':
      return evaluateOrderbookImbalance(node, ctx)
    case 'openInterestCondition':
      return evaluateOpenInterestCondition(node, ctx)
    case 'indicatorSlope':
      return evaluateIndicatorSlope(node, ctx)
    case 'volumeConfirmation':
      return evaluateVolumeConfirmation(node, ctx)
    case 'cooldownWindow':
      return evaluateCooldownWindow(node, ctx)
    case 'sequence':
      return evaluateGenericSequence(node, values, ctx)
    case 'TOUCH_LEVEL_DOWN':
      return touchesLevel(leftId, rightId, values, ctx, executionModel, exprIndex, seriesMemo, 'down')
    case 'TOUCH_LEVEL_UP':
      return touchesLevel(leftId, rightId, values, ctx, executionModel, exprIndex, seriesMemo, 'up')
    case 'WITHIN_LEVEL_SET':
      return isWithinLevelSet(leftId, rightId, values, ctx, executionModel, exprIndex, seriesMemo)
    default:
      return false
  }
}

function evaluateExternalSignal(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): boolean {
  const provider = typeof node.payload.params?.provider === 'string'
    ? node.payload.params.provider
    : 'webhook'
  const signalId = typeof node.payload.params?.signalId === 'string'
    ? node.payload.params.signalId
    : ''
  if (provider !== 'webhook' || signalId.length === 0) {
    return false
  }

  const sourceFeedId = typeof node.payload.params?.sourceFeedId === 'string' && node.payload.params.sourceFeedId.length > 0
    ? node.payload.params.sourceFeedId
    : `webhook.${signalId}`
  const ttlMs = typeof node.payload.params?.ttlMs === 'number' && Number.isFinite(node.payload.params.ttlMs)
    ? node.payload.params.ttlMs
    : 60_000
  const now = resolveRuntimeTimestamp(ctx)
  if (now === null) {
    return false
  }

  const inbox = ctx.eventInbox?.[sourceFeedId]
    ?? ctx.eventInbox?.[`webhook:${signalId}`]
  if (!Array.isArray(inbox)) {
    return false
  }

  return inbox.some((event) => {
    if (
      !event
      || typeof event.id !== 'string'
      || event.id.length === 0
      || typeof event.ts !== 'number'
      || !Number.isFinite(event.ts)
      || now - event.ts > ttlMs
      || isExternalSignalEventConsumed(ctx, event.id)
    ) {
      return false
    }
    const payload = event?.payload
    if (!payload || typeof payload !== 'object') {
      return false
    }
    return payload.signalId === signalId
      || payload.signal_id === signalId
      || payload.id === signalId
  })
}

function evaluateFundingRateCondition(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): boolean {
  const sourceFeedId = readStringParam(node.payload.params, 'sourceFeedId') ?? 'funding.rate'
  const threshold = readNumberParam(node.payload.params, 'value') ?? 0
  const operator = readStringParam(node.payload.params, 'operator') ?? 'GT'
  const events = readVisibleFeedEvents(ctx, sourceFeedId)

  return events.some((event) => {
    const payload = readPayloadRecord(event.payload)
    if (!payload) return false
    const rate = readFirstNumber(payload, ['fundingRate', 'funding_rate', 'rate', 'value'])
    return rate !== null && compareByOperator(rate, threshold, operator)
  })
}

function evaluateLiquidationCondition(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): boolean {
  const sourceFeedId = readStringParam(node.payload.params, 'sourceFeedId') ?? 'liquidation.events'
  const threshold = readNumberParam(node.payload.params, 'value') ?? 0
  const operator = readStringParam(node.payload.params, 'operator') ?? 'GT'
  const side = readStringParam(node.payload.params, 'side')?.toLowerCase() ?? 'both'
  const events = readVisibleFeedEvents(ctx, sourceFeedId)

  return events.some((event) => {
    const payload = readPayloadRecord(event.payload)
    if (!payload) return false
    const eventSide = readFirstString(payload, ['side', 'liquidationSide', 'positionSide', 'direction'])?.toLowerCase() ?? 'both'
    if (side !== 'both' && eventSide !== side) return false
    const notional = readFirstNumber(payload, ['notionalUsd', 'notionalUSDT', 'notional_usd', 'notional', 'value'])
    return notional !== null && compareByOperator(notional, threshold, operator)
  })
}

function evaluateOrderbookImbalance(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): boolean {
  const sourceFeedId = readStringParam(node.payload.params, 'sourceFeedId') ?? 'orderbook.imbalance'
  const metric = readStringParam(node.payload.params, 'metric')?.toLowerCase() ?? 'depth_ratio'
  const threshold = readNumberParam(node.payload.params, 'value')
    ?? readNumberParam(node.payload.params, 'valuePct')
    ?? readNumberParam(node.payload.params, 'ratio')
    ?? 1
  const operator = readStringParam(node.payload.params, 'operator') ?? 'GT'
  const side = readStringParam(node.payload.params, 'side')?.toLowerCase() ?? 'bid'
  const event = readLatestVisibleFeedEvent(ctx, sourceFeedId)
  if (!event) return false

  const payload = readPayloadRecord(event.payload)
  if (!payload) return false
  if (metric === 'spread_pct') {
    const directSpread = readFirstNumber(payload, ['spreadPct', 'spread_pct', 'bidAskSpreadPct', 'bid_ask_spread_pct'])
    if (directSpread !== null) return compareByOperator(directSpread, threshold, operator)
    const bidPrice = readFirstNumber(payload, ['bestBid', 'best_bid', 'bidPrice', 'bid_price'])
    const askPrice = readFirstNumber(payload, ['bestAsk', 'best_ask', 'askPrice', 'ask_price'])
    if (bidPrice === null || askPrice === null || bidPrice <= 0 || askPrice <= 0 || askPrice < bidPrice) return false
    const mid = (bidPrice + askPrice) / 2
    if (mid <= 0) return false
    return compareByOperator(((askPrice - bidPrice) / mid) * 100, threshold, operator)
  }
  const bidDepth = readFirstNumber(payload, ['bidDepth', 'bid_depth', 'bidLiquidity', 'bid_liquidity', 'bids', 'bid'])
  const askDepth = readFirstNumber(payload, ['askDepth', 'ask_depth', 'askLiquidity', 'ask_liquidity', 'asks', 'ask'])
  if (bidDepth === null || askDepth === null || bidDepth <= 0 || askDepth <= 0) return false
  const ratio = side === 'ask' || side === 'sell'
    ? askDepth / bidDepth
    : bidDepth / askDepth
  return Number.isFinite(ratio) && compareByOperator(ratio, threshold, operator)
}

function evaluateOpenInterestCondition(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): boolean {
  const sourceFeedId = readStringParam(node.payload.params, 'sourceFeedId') ?? 'open_interest'
  const threshold = readNumberParam(node.payload.params, 'value')
    ?? readNumberParam(node.payload.params, 'changePct')
    ?? 0
  const operator = readStringParam(node.payload.params, 'operator') ?? 'GT'
  const direction = readStringParam(node.payload.params, 'direction')?.toLowerCase() ?? 'up'
  const values = readVisibleFeedEvents(ctx, sourceFeedId)
    .slice()
    .sort((left, right) => Number(left.ts ?? 0) - Number(right.ts ?? 0))
    .map(event => {
      const payload = readPayloadRecord(event.payload)
      return payload ? readFirstNumber(payload, ['openInterest', 'open_interest', 'oi', 'value']) : null
    })
    .filter((value): value is number => value !== null && value > 0)
  if (values.length < 2) return false

  const previous = values[values.length - 2]
  const current = values[values.length - 1]
  const changePct = ((current - previous) / previous) * 100
  const comparable = direction === 'down' ? -changePct : changePct
  return Number.isFinite(comparable) && compareByOperator(comparable, threshold, operator)
}

function evaluateIndicatorSlope(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): boolean {
  const period = Math.max(2, Math.floor(readNumberParam(node.payload.params, 'period') ?? 3))
  const direction = readStringParam(node.payload.params, 'direction')?.toLowerCase() ?? 'up'
  const bars = resolveBarsForNode(node, ctx)
  if (bars.length < period) return false
  const window = bars.slice(-period)
  const first = window[0]?.close
  const last = window[window.length - 1]?.close
  if (typeof first !== 'number' || typeof last !== 'number' || !Number.isFinite(first) || !Number.isFinite(last)) {
    return false
  }

  if (direction === 'down') return last < first
  if (direction === 'flat') return last === first
  return last > first
}

function evaluateVolumeConfirmation(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): boolean {
  const refWindow = Math.max(1, Math.floor(readNumberParam(node.payload.params, 'refWindow') ?? 20))
  const multiplier = readNumberParam(node.payload.params, 'multiplier') ?? 1.5
  const bars = resolveBarsForNode(node, ctx)
  if (bars.length < refWindow + 1 || multiplier <= 0) return false
  const currentVolume = bars[bars.length - 1]?.volume
  if (typeof currentVolume !== 'number' || !Number.isFinite(currentVolume)) return false
  const previousVolumes = bars
    .slice(-(refWindow + 1), -1)
    .map(bar => bar.volume)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (previousVolumes.length !== refWindow) return false
  const average = previousVolumes.reduce((sum, value) => sum + value, 0) / refWindow
  return average > 0 && currentVolume >= average * multiplier
}

function evaluateCooldownWindow(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): boolean {
  const durationBars = readNumberParam(node.payload.params, 'durationBars')
    ?? readNumberParam(node.payload.params, 'bars')
  if (typeof durationBars === 'number') {
    const currentBarIndex = readNestedNumber(ctx, ['__compiledDecisionState', 'barIndex'])
      ?? readNestedNumber(ctx, ['semanticRuntimeState', 'cooldown', 'currentBarIndex'])
    const lastExitBarIndex = readNestedNumber(ctx, ['semanticRuntimeState', 'cooldown', 'lastExitBarIndex'])
      ?? readNestedNumber(ctx, ['semanticRuntimeState', 'cooldown', 'lastStopLossBarIndex'])
    if (currentBarIndex === null || lastExitBarIndex === null) return false
    return currentBarIndex - lastExitBarIndex >= durationBars
  }

  const durationMs = readNumberParam(node.payload.params, 'durationMs')
  if (typeof durationMs !== 'number') return false
  const now = resolveRuntimeTimestamp(ctx)
  const lastExitTs = readNestedNumber(ctx, ['semanticRuntimeState', 'cooldown', 'lastExitTs'])
    ?? readNestedNumber(ctx, ['semanticRuntimeState', 'cooldown', 'lastStopLossTs'])
  if (now === null || lastExitTs === null) return false
  return now - lastExitTs >= durationMs
}

function readVisibleFeedEvents(
  ctx: StrategyExecutionContextV1,
  sourceFeedId: string,
): ReadonlyArray<RuntimeFeedEvent> {
  const inbox = ctx.eventInbox?.[sourceFeedId]
  if (!Array.isArray(inbox)) return []
  const now = resolveRuntimeTimestamp(ctx)
  return inbox.filter(event => {
    if (!event || typeof event !== 'object') return false
    const ts = (event as { ts?: unknown }).ts
    return now === null || (typeof ts === 'number' && Number.isFinite(ts) && ts <= now)
  })
}

function readLatestVisibleFeedEvent(
  ctx: StrategyExecutionContextV1,
  sourceFeedId: string,
): RuntimeFeedEvent | null {
  const inbox = ctx.eventInbox?.[sourceFeedId]
  if (!Array.isArray(inbox) || inbox.length === 0) return null
  const now = resolveRuntimeTimestamp(ctx)
  if (now === null) return readLatestSortedFeedEvent(inbox as RuntimeFeedEvent[])

  const events = getSortedFeedEvents(inbox as RuntimeFeedEvent[])
  let low = 0
  let high = events.length - 1
  let latest: RuntimeFeedEvent | null = null
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const event = events[mid]
    const ts = readEventTimestamp(event)
    if (ts !== null && ts <= now) {
      latest = event
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return latest
}

function getSortedFeedEvents(events: ReadonlyArray<RuntimeFeedEvent>): ReadonlyArray<RuntimeFeedEvent> {
  const cached = sortedFeedEventsCache.get(events)
  if (cached) return cached
  const sorted = events
    .filter(event => event && typeof event === 'object' && readEventTimestamp(event) !== null)
    .slice()
    .sort((left, right) => (readEventTimestamp(left) ?? 0) - (readEventTimestamp(right) ?? 0))
  sortedFeedEventsCache.set(events, sorted)
  return sorted
}

function readLatestSortedFeedEvent(events: ReadonlyArray<RuntimeFeedEvent>): RuntimeFeedEvent | null {
  const sorted = getSortedFeedEvents(events)
  return sorted[sorted.length - 1] ?? null
}

function readEventTimestamp(event: RuntimeFeedEvent): number | null {
  const ts = event.ts
  return typeof ts === 'number' && Number.isFinite(ts) ? ts : null
}

function readPayloadRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readFirstNumber(record: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const raw = record[key]
    const value = typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : NaN
    if (Number.isFinite(value)) return value
  }
  return null
}

function readFirstString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const raw = record[key]
    if (typeof raw === 'string' && raw.trim() !== '') return raw.trim()
  }
  return null
}

function compareByOperator(left: number, right: number, operator: string): boolean {
  switch (operator.toUpperCase()) {
    case 'GTE':
    case '>=':
      return left >= right
    case 'LT':
    case '<':
      return left < right
    case 'LTE':
    case '<=':
      return left <= right
    case 'EQ':
    case '=':
    case '==':
      return left === right
    case 'GT':
    case '>':
    default:
      return left > right
  }
}

function resolveRuntimeTimestamp(ctx: StrategyExecutionContextV1): number | null {
  if (typeof ctx.timestamp === 'number' && Number.isFinite(ctx.timestamp)) {
    return ctx.timestamp
  }
  const bars = Array.isArray(ctx.bars) ? ctx.bars : []
  const lastBar = bars[bars.length - 1]
  return typeof lastBar?.timestamp === 'number' && Number.isFinite(lastBar.timestamp)
    ? lastBar.timestamp
    : null
}

function isExternalSignalEventConsumed(ctx: StrategyExecutionContextV1, eventId: string): boolean {
  const consumed = ctx.consumedEventIds ?? ctx.semanticRuntimeState?.externalSignal?.consumedEventIds
  if (Array.isArray(consumed)) {
    return consumed.includes(eventId)
  }
  if (consumed instanceof Set) {
    return consumed.has(eventId)
  }
  if (consumed && typeof consumed === 'object') {
    return Boolean((consumed as Record<string, unknown>)[eventId])
  }
  return false
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
  const downLevelsRaw = payload.params?.down ?? payload.levelsPerSide?.down
  const downLevels = typeof downLevelsRaw === 'number'
    ? downLevelsRaw
    : typeof downLevelsRaw === 'string'
      ? Number(downLevelsRaw)
      : 0

  const lower = typeof lowerBound === 'number' ? lowerBound : null
  const upper = typeof upperBound === 'number' ? upperBound : null
  if (typeof spacingValue !== 'number' || spacingValue <= 0 || upLevels < 0 || downLevels < 0) {
    return { levels: [] }
  }

  const levels: number[] = []
  const levelSetKind = node.payload.kind
  for (let index = -downLevels; index <= upLevels; index += 1) {
    const current = spacingMode === 'pct'
      ? levelSetKind === 'GEOMETRIC_LEVEL_SET'
        ? anchor * Math.pow(1 + spacingValue / 100, index)
        : anchor + anchor * (spacingValue / 100) * index
      : anchor + spacingValue * index
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

function resolveBarsForNode(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): readonly Bar[] {
  const timeframe = typeof node.payload.timeframe === 'string' && node.payload.timeframe.length > 0
    ? node.payload.timeframe
    : null
  if (timeframe) {
    const scopedBars = readRuntimeDataBars(ctx, timeframe)
    if (scopedBars) return scopedBars
  }
  return Array.isArray(ctx.bars) ? ctx.bars : []
}

function readRuntimeDataBars(
  ctx: StrategyExecutionContextV1,
  timeframe: string,
): readonly Bar[] | null {
  const data = ctx.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const primary = (data as { primary?: unknown }).primary
  if (!primary || typeof primary !== 'object' || Array.isArray(primary)) return null
  const timeframeData = (primary as Record<string, unknown>)[timeframe]
  if (!timeframeData || typeof timeframeData !== 'object' || Array.isArray(timeframeData)) return null
  const bars = (timeframeData as { bars?: unknown }).bars
  return Array.isArray(bars) ? bars as Bar[] : null
}

function resolvePriceIndicatorValue(
  kind: 'EMA' | 'SMA',
  inputId: string | undefined,
  period: number,
  offset: number,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
): number | null | undefined {
  if (!inputId || !exprIndex || offset < 0) return undefined
  const inputNode = exprIndex.get(inputId)
  if (!inputNode || inputNode.nodeType !== 'series' || inputNode.payload.kind !== 'PRICE') return undefined
  const bars = resolveBarsForNode(inputNode, ctx)
  const endExclusive = bars.length - offset
  if (endExclusive <= 0) return null
  const field = inputNode.payload.field ?? 'close'
  const cache = resolvePriceIndicatorCache(ctx, `${kind}:${inputId}:${period}:${field}`)
  if (cache) {
    extendPriceIndicatorCache(cache, kind, bars, field, period, endExclusive, executionModel)
    return cache.values[endExclusive - 1] ?? null
  }

  if (kind === 'SMA') {
    const start = Math.max(0, endExclusive - period)
    let sum = 0
    let count = 0
    for (let index = start; index < endExclusive; index += 1) {
      const value = readBarField(bars[index], field, executionModel)
      if (value === null) return null
      sum += value
      count += 1
    }
    return count > 0 ? sum / count : null
  }

  const first = readBarField(bars[0], field, executionModel)
  if (first === null) return null
  const multiplier = 2 / (period + 1)
  let current = first
  for (let index = 1; index < endExclusive; index += 1) {
    const value = readBarField(bars[index], field, executionModel)
    if (value === null) return null
    current = (value - current) * multiplier + current
  }
  return current
}

interface PriceIndicatorCacheEntry {
  values: number[]
  prefixSums: number[]
}

function resolvePriceIndicatorCache(ctx: StrategyExecutionContextV1, key: string): PriceIndicatorCacheEntry | null {
  const state = (ctx as { __compiledDecisionState?: Record<string, unknown> }).__compiledDecisionState
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null
  const record = state as Record<string, unknown>
  const caches = record.__priceIndicatorCache && typeof record.__priceIndicatorCache === 'object' && !Array.isArray(record.__priceIndicatorCache)
    ? record.__priceIndicatorCache as Record<string, PriceIndicatorCacheEntry>
    : {}
  if (!record.__priceIndicatorCache) record.__priceIndicatorCache = caches
  caches[key] ??= { values: [], prefixSums: [] }
  return caches[key]
}

function extendPriceIndicatorCache(
  cache: PriceIndicatorCacheEntry,
  kind: 'EMA' | 'SMA',
  bars: readonly Bar[],
  field: 'open' | 'high' | 'low' | 'close',
  period: number,
  endExclusive: number,
  executionModel?: Record<string, unknown>,
): void {
  const multiplier = 2 / (period + 1)
  for (let index = cache.values.length; index < endExclusive; index += 1) {
    const price = readBarField(bars[index], field, executionModel)
    if (price === null) return
    const previousPrefix = index > 0 ? cache.prefixSums[index - 1] ?? 0 : 0
    cache.prefixSums[index] = previousPrefix + price
    if (kind === 'EMA') {
      cache.values[index] = index === 0
        ? price
        : (price - (cache.values[index - 1] ?? price)) * multiplier + (cache.values[index - 1] ?? price)
      continue
    }
    const start = Math.max(0, index + 1 - period)
    const before = start > 0 ? cache.prefixSums[start - 1] ?? 0 : 0
    cache.values[index] = ((cache.prefixSums[index] ?? 0) - before) / (index - start + 1)
  }
}

function readBarField(
  bar: Bar | undefined,
  field: 'open' | 'high' | 'low' | 'close',
  executionModel?: Record<string, unknown>,
): number | null {
  const value = bar?.[field]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (field === 'close') {
    const currentPrice = executionModel?.currentPrice
    if (typeof currentPrice === 'number' && Number.isFinite(currentPrice)) return currentPrice
  }
  return null
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

  const bars = resolveBarsForNode(node, ctx)
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
      case 'DEPLOYMENT_PRICE':
        return readDeploymentPrice(node.payload.field ?? 'close', bars)
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
        const directPriceValue = resolvePriceIndicatorValue(node.payload.kind, inputId, period, offset + (node.payload.offsetBars ?? 0), ctx, executionModel, exprIndex)
        if (directPriceValue !== undefined) return directPriceValue
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
      case 'LIQUIDITY_SWEEP': {
        const direction = readStringParam(node.payload.params, 'direction')
        const reference = readStringParam(node.payload.params, 'reference')
        const reclaimBars = readNumericParam(node.payload.params, 'reclaimBars') ?? undefined
        const timezone = readStringParam(node.payload.params, 'timezone') ?? readStringValue(node.payload.timezone) ?? 'UTC'
        const endIndex = bars.length - offset
        if (endIndex <= 0) return null
        const sweepBars = offset === 0 ? bars : bars.slice(0, endIndex)
        return liquiditySweepDetector({
          bars: sweepBars,
          direction,
          reference,
          reclaimBars,
          timezone,
        })
          ? 1
          : 0
      }
      case 'VOLUME':
        return readVolumeAtOffset(bars, offset + (node.payload.offsetBars ?? 0))
      case 'SMA_VOLUME': {
        const period = readNumericParam(node.payload.params, 'period') ?? 20
        const multiplier = readNumericParam(node.payload.params, 'multiplier') ?? 1
        const volumeOffset = offset + (node.payload.offsetBars ?? 0) + 1
        const window = collectVolumeWindow(period, volumeOffset, bars)
        const average = sma(window, period)
        return average == null ? null : average * multiplier
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
      case 'CANDLE_PATTERN':
        return evaluateCandlePatternSeries(node, bars, offset + (node.payload.offsetBars ?? 0))
      case 'INDICATOR_DIVERGENCE':
        return evaluateIndicatorDivergence(node, bars, offset + (node.payload.offsetBars ?? 0))
      case 'CHART_PATTERN':
        return evaluateChartPattern(node, bars)
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

function evaluateGenericCompare(
  node: CompiledExprNode,
  left: CompiledRuntimeValue,
  right: CompiledRuntimeValue,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
  seriesMemo?: Map<string, number | null>,
): boolean {
  const [leftId, rightId] = node.deps ?? []
  const op = readGenericComparisonOp(node.payload.params, 'op', 'GT')
  if (op === null) return false

  switch (op) {
    case 'GTE':
      return compare(left, right, (a, b) => a >= b)
    case 'LT':
      return compare(left, right, (a, b) => a < b)
    case 'LTE':
      return compare(left, right, (a, b) => a <= b)
    case 'EQ':
      return compareEq(left, right)
    case 'CROSS_OVER':
      return crossesOver(leftId, rightId, ctx, executionModel, exprIndex, seriesMemo)
    case 'CROSS_UNDER':
      return crossesUnder(leftId, rightId, ctx, executionModel, exprIndex, seriesMemo)
    case 'GT':
    default:
      return compare(left, right, (a, b) => a > b)
  }
}

function evaluateGenericCross(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
  seriesMemo?: Map<string, number | null>,
): boolean {
  const [leftId, rightId] = node.deps ?? []
  const direction = readGenericCrossOp(node.payload.params)
  if (direction === null) return false
  if (direction === 'CROSS_UNDER') {
    return crossesUnder(leftId, rightId, ctx, executionModel, exprIndex, seriesMemo)
  }
  return crossesOver(leftId, rightId, ctx, executionModel, exprIndex, seriesMemo)
}

function evaluateGenericSequence(
  node: CompiledExprNode,
  values: Record<string, CompiledRuntimeValue>,
  ctx: StrategyExecutionContextV1,
): boolean {
  const memoryKey = readStringParam(node.payload.params, 'memoryKey')
  const state = memoryKey ? readSemanticRuntimeState(ctx, memoryKey) : null
  const stateDecision = state ? readSequenceStateDecision(state) : null
  if (stateDecision !== null) {
    return stateDecision
  }

  const sequenceDecision = evaluateSequenceFromBars(node, ctx)
  if (sequenceDecision !== null) {
    return sequenceDecision
  }

  const deps = node.deps ?? []
  return deps.length > 0 && deps.every(dep => values[dep] === true)
}

function evaluateSequenceFromBars(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): boolean | null {
  const sequenceKind = readStringParam(node.payload.params, 'sequenceKind')
  if (sequenceKind === 'consecutive_candles') {
    return evaluateConsecutiveCandlesSequence(node, ctx)
  }
  if (sequenceKind === 'breakout_retest') {
    return evaluateBreakoutRetestSequence(node, ctx)
  }
  return null
}

function evaluateConsecutiveCandlesSequence(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): boolean | null {
  const count = Math.floor(readNumericParam(node.payload.params, 'count') ?? 0)
  const direction = readStringParam(node.payload.params, 'direction') ?? 'down'
  const bars = Array.isArray(ctx.bars) ? ctx.bars : []
  if (count <= 0 || bars.length < count) return false

  const window = bars.slice(Math.max(0, bars.length - count))
  if (window.length !== count) return false

  if (direction === 'up') {
    return window.every(bar => bar.close > bar.open)
  }

  return window.every(bar => bar.close < bar.open)
}

function evaluateBreakoutRetestSequence(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): boolean | null {
  const bars = Array.isArray(ctx.bars) ? ctx.bars : []
  const lookbackBars = resolveSequenceLookbackBars(node, ctx)
  if (lookbackBars <= 1 || bars.length < lookbackBars + 2) return false

  const current = bars[bars.length - 1]
  if (!current) return false

  const searchStart = Math.max(lookbackBars, bars.length - lookbackBars - 1)
  for (let breakoutIndex = searchStart; breakoutIndex < bars.length - 1; breakoutIndex += 1) {
    const breakoutBar = bars[breakoutIndex]
    if (!breakoutBar) continue

    const priorWindow = bars.slice(Math.max(0, breakoutIndex - lookbackBars), breakoutIndex)
    if (priorWindow.length < 2) continue

    const breakoutLevel = Math.max(...priorWindow.map(bar => bar.high))
    if (!Number.isFinite(breakoutLevel) || breakoutBar.close <= breakoutLevel) continue

    const postBreakoutBars = bars.slice(breakoutIndex + 1)
    if (postBreakoutBars.some(bar => bar.close < breakoutLevel)) continue

    if (current.low <= breakoutLevel && current.close >= breakoutLevel) {
      return true
    }
  }

  return false
}

function resolveSequenceLookbackBars(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): number {
  const explicit = readNumericParam(node.payload.params, 'lookbackBars')
  if (explicit && explicit > 0) return Math.floor(explicit)

  const lookbackWindow = readStringParam(node.payload.params, 'lookbackWindow')
  const timeframe = typeof ctx.timeframe === 'string' ? ctx.timeframe : null
  const windowMinutes = parseDurationMinutes(lookbackWindow)
  const timeframeMinutes = parseDurationMinutes(timeframe)
  if (windowMinutes && timeframeMinutes && timeframeMinutes > 0) {
    return Math.max(1, Math.floor(windowMinutes / timeframeMinutes))
  }

  return 24
}

function parseDurationMinutes(value: string | null): number | null {
  const matched = value?.trim().match(/^(\d+(?:\.\d+)?)\s*(m|min|分钟|h|小时|d|天)$/iu)
  if (!matched?.[1] || !matched[2]) return null

  const amount = Number(matched[1])
  if (!Number.isFinite(amount) || amount <= 0) return null

  const unit = matched[2].toLowerCase()
  if (unit === 'm' || unit === 'min' || unit === '分钟') return amount
  if (unit === 'h' || unit === '小时') return amount * 60
  return amount * 24 * 60
}

function readGenericComparisonOp(
  params: Record<string, number | string | boolean> | undefined,
  key: string,
  defaultOp: string,
): string | null {
  const raw = readStringParam(params, key)
  if (!raw) return defaultOp
  return normalizeComparisonOp(raw)
}

function readGenericCrossOp(
  params: Record<string, number | string | boolean> | undefined,
): string | null {
  const direction = readStringParam(params, 'direction')
  if (direction) return normalizeCrossOp(direction)

  const op = readStringParam(params, 'op')
  if (op) return normalizeCrossOp(op)

  return 'CROSS_OVER'
}

function normalizeCrossOp(op: string): 'CROSS_OVER' | 'CROSS_UNDER' | null {
  const normalized = op.trim().toUpperCase()
  if (normalized === 'OVER' || normalized === 'CROSS_OVER') return 'CROSS_OVER'
  if (normalized === 'UNDER' || normalized === 'CROSS_UNDER') return 'CROSS_UNDER'
  return null
}

function normalizeComparisonOp(op: string): string | null {
  const normalized = op.trim().toUpperCase()
  if (normalized === 'OVER') return 'CROSS_OVER'
  if (normalized === 'UNDER') return 'CROSS_UNDER'
  if (
    normalized === 'GT'
    || normalized === 'GTE'
    || normalized === 'LT'
    || normalized === 'LTE'
    || normalized === 'EQ'
    || normalized === 'CROSS_OVER'
    || normalized === 'CROSS_UNDER'
  ) {
    return normalized
  }
  return null
}

function readSemanticRuntimeState(
  ctx: StrategyExecutionContextV1,
  memoryKey: string,
): Record<string, unknown> | null {
  const semanticRuntimeState = (ctx as Record<string, unknown>).semanticRuntimeState
  if (!semanticRuntimeState || typeof semanticRuntimeState !== 'object' || Array.isArray(semanticRuntimeState)) {
    return null
  }

  const state = (semanticRuntimeState as Record<string, unknown>)[memoryKey]
  return state && typeof state === 'object' && !Array.isArray(state)
    ? state as Record<string, unknown>
    : null
}

function readSequenceStateDecision(state: Record<string, unknown>): boolean | null {
  const candidates = [
    state.completed,
    state.matched,
    state.ready,
    state.triggered,
    state.confirmed,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') return candidate
  }

  return null
}

function isWithinLevelSet(
  priceExprId: string | undefined,
  levelSetExprId: string | undefined,
  values: Record<string, CompiledRuntimeValue>,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
  seriesMemo?: Map<string, number | null>,
): boolean {
  const currentPrice = resolveSeriesValueAt(priceExprId, 0, ctx, executionModel, exprIndex, seriesMemo)
  const levelSetNode = levelSetExprId && exprIndex ? exprIndex.get(levelSetExprId) : null
  if (!levelSetNode) return false
  const levelSet = evaluateLevelSet(levelSetNode, values)
  if (typeof currentPrice !== 'number' || !levelSet || typeof levelSet !== 'object' || !Array.isArray(levelSet.levels) || levelSet.levels.length === 0) {
    return false
  }

  const lower = Math.min(...levelSet.levels)
  const upper = Math.max(...levelSet.levels)
  return currentPrice >= lower && currentPrice <= upper
}

function evaluateChartPattern(
  node: CompiledExprNode,
  bars: readonly Bar[],
): number | null {
  const pattern = readStringParam(node.payload.params, 'pattern')
  const direction = readStringParam(node.payload.params, 'direction')
  if (
    (
      pattern !== 'head_and_shoulders'
      && pattern !== 'double_top'
      && pattern !== 'double_bottom'
      && pattern !== 'triangle'
    )
    || (direction !== 'bullish' && direction !== 'bearish')
  ) {
    return null
  }

  return chartPatternDetector([...bars], pattern, direction, {
    pivotWindow: readNumericParam(node.payload.params, 'pivotWindow') ?? 2,
    confirmationBars: readNumericParam(node.payload.params, 'confirmationBars') ?? 1,
    tolerancePct: readNumericParam(node.payload.params, 'tolerancePct') ?? 0.04,
    minBreakoutPct: readNumericParam(node.payload.params, 'minBreakoutPct') ?? 0,
    minSwingPct: readNumericParam(node.payload.params, 'minSwingPct') ?? 0.02,
    lookbackBars: readNumericParam(node.payload.params, 'lookbackBars') ?? 80,
  })
}

function evaluateIndicatorDivergence(
  node: CompiledExprNode,
  bars: readonly Bar[],
  offset: number,
): number | null {
  const indicator = readStringParam(node.payload.params, 'indicator')
  const direction = readStringParam(node.payload.params, 'direction')
  if ((indicator !== 'rsi' && indicator !== 'macd') || (direction !== 'bullish' && direction !== 'bearish')) {
    return null
  }

  const pivotWindow = Math.max(1, Math.floor(readNumericParam(node.payload.params, 'pivotWindow') ?? 14))
  const confirmationBars = Math.max(0, Math.floor(readNumericParam(node.payload.params, 'confirmationBars') ?? 3))
  if (offset < 0 || offset >= bars.length) return null

  const endExclusive = bars.length - offset
  const scopedBars = bars.slice(0, endExclusive)
  if (scopedBars.length < pivotWindow + 2) return 0

  const indicatorValues = buildDivergenceIndicatorSeries(scopedBars, indicator)
  const pivots = priceHighsLows([...scopedBars], pivotWindow, confirmationBars)
  const candidates = direction === 'bearish' ? pivots.highs : pivots.lows
  const confirmed = candidates.filter((pivot) => {
    const value = indicatorValues[pivot.index]
    return typeof value === 'number' && Number.isFinite(value)
  })
  if (confirmed.length < 2) return 0

  const current = confirmed[confirmed.length - 1]!
  const previous = confirmed[confirmed.length - 2]!
  if (scopedBars.length - 1 - current.index > confirmationBars) return 0

  const currentIndicator = indicatorValues[current.index]
  const previousIndicator = indicatorValues[previous.index]
  if (typeof currentIndicator !== 'number' || typeof previousIndicator !== 'number') return 0

  const diverged = direction === 'bearish'
    ? current.value > previous.value && currentIndicator <= previousIndicator
    : current.value < previous.value && currentIndicator >= previousIndicator

  return diverged ? 1 : 0
}

function buildDivergenceIndicatorSeries(
  bars: readonly Bar[],
  indicator: 'rsi' | 'macd',
): Array<number | null> {
  const closes = bars.map(bar => bar.close)
  return closes.map((_close, index) => {
    const history = closes.slice(0, index + 1)
    if (indicator === 'rsi') {
      return rsi(history, 14)
    }
    return macd(history)?.macd ?? null
  })
}

function collectSeriesHistory(
  nodeId: string | undefined,
  offset: number,
  ctx: StrategyExecutionContextV1,
  executionModel?: Record<string, unknown>,
  exprIndex?: ReadonlyMap<string, CompiledExprNode>,
  seriesMemo?: Map<string, number | null>,
): number[] {
  const node = nodeId && exprIndex ? exprIndex.get(nodeId) : null
  const bars = node ? resolveBarsForNode(node, ctx) : Array.isArray(ctx.bars) ? ctx.bars : []
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

function collectVolumeWindow(
  period: number,
  offset: number,
  bars: readonly Pick<Bar, 'volume'>[],
): number[] {
  if (!Number.isFinite(period) || period <= 0) return []

  const result: number[] = []
  for (let relative = period - 1 + offset; relative >= offset; relative -= 1) {
    const value = readVolumeAtOffset(bars, relative)
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

function readVolumeAtOffset(
  bars: readonly Pick<Bar, 'volume'>[],
  offset: number,
): number | null {
  if (offset < 0 || offset >= bars.length) return null
  const value = bars[bars.length - 1 - offset]?.volume
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readDeploymentPrice(
  field: 'open' | 'high' | 'low' | 'close',
  bars: readonly Pick<Bar, 'open' | 'high' | 'low' | 'close'>[],
): number | null {
  const deploymentBar = bars[0] ?? null
  return readLatestPrice(field, deploymentBar)
}

function readNumericParam(
  params: Record<string, number | string | boolean> | undefined,
  key: string,
): number | null {
  const raw = params?.[key]
  const value = typeof raw === 'string' ? Number(raw) : raw
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function evaluateCandlePatternSeries(
  node: CompiledExprNode,
  bars: readonly Pick<Bar, 'open' | 'high' | 'low' | 'close'>[],
  offset: number,
): number | null {
  if (offset < 0 || offset >= bars.length) return null

  const pattern = readStringParam(node.payload.params, 'pattern')
  const direction = readStringParam(node.payload.params, 'direction')
  if (!isCandlePattern(pattern) || !isCandlePatternDirection(direction)) return null

  const minBars = pattern === 'consecutive_body'
    ? readNumericParam(node.payload.params, 'minBars') ?? undefined
    : undefined
  const endExclusive = bars.length - offset
  const scopedBars = bars.slice(0, endExclusive)

  return candlePatternDetector(scopedBars, { pattern, direction, minBars }) ? 1 : 0
}

function isCandlePattern(value: string | null): value is 'engulfing' | 'hammer' | 'doji' | 'consecutive_body' | 'single_bull_bar' | 'single_bear_bar' {
  return value === 'engulfing'
    || value === 'hammer'
    || value === 'doji'
    || value === 'consecutive_body'
    || value === 'single_bull_bar'
    || value === 'single_bear_bar'
}

function isCandlePatternDirection(value: string | null): value is 'bullish' | 'bearish' {
  return value === 'bullish' || value === 'bearish'
}

function readStringParam(
  params: Record<string, number | string | boolean> | undefined,
  key: string,
): string | null {
  const raw = params?.[key]
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

function readNumberParam(
  params: Record<string, number | string | boolean> | undefined,
  key: string,
): number | null {
  const raw = params?.[key]
  const value = typeof raw === 'number'
    ? raw
    : typeof raw === 'string' && raw.trim() !== ''
      ? Number(raw)
      : NaN
  return Number.isFinite(value) ? value : null
}

function readNestedNumber(
  record: Record<string, unknown>,
  path: readonly string[],
): number | null {
  let current: unknown = record
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'number' && Number.isFinite(current) ? current : null
}

function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
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

function evaluateMemoryOperand(
  node: CompiledExprNode,
  ctx: StrategyExecutionContextV1,
): CompiledRuntimeValue {
  const memoryKey = typeof node.payload.memoryKey === 'string' ? node.payload.memoryKey : null
  if (!memoryKey) return null

  const root = (ctx as Record<string, unknown>).semanticRuntimeState
  if (!root || typeof root !== 'object' || Array.isArray(root)) return null

  let cur: unknown = (root as Record<string, unknown>)[memoryKey]
  if (cur === undefined || cur === null) return null

  const path = Array.isArray(node.payload.path) ? node.payload.path : []
  for (const seg of path) {
    if (cur == null || typeof cur !== 'object' || Array.isArray(cur)) return null
    cur = (cur as Record<string, unknown>)[seg]
    if (cur === undefined) return null
  }

  if (cur === null) return null
  if (typeof cur === 'number' || typeof cur === 'string' || typeof cur === 'boolean') {
    return cur
  }
  return null
}

// ---------------------------------------------------------------------------
// IN_TIME_WINDOW evaluator
// ---------------------------------------------------------------------------
// Converts a UTC ms timestamp to local time in the given IANA timezone using
// Intl.DateTimeFormat, then checks whether the local time falls inside any of
// the configured windows.  Each window specifies:
//   start / end  — "H:MM" or "HH:MM" 24-hour local time strings (start inclusive,
//                  end exclusive). Single-digit hour accepted ("9:30" == "09:30").
//                  Minutes must be 2 digits.
//   daysOfWeek   — optional array of integers in [0, 6] (0=Sunday).
//
// Asymmetric defaults (be explicit when configuring):
//   - `windows: []` (empty array)        → never matches (fail-closed default)
//   - `daysOfWeek` omitted on a window   → allows all 7 days
//   - `daysOfWeek: []` (empty array)     → window never matches (`[].every()` is
//                                          vacuously true so the day-range guard
//                                          passes, but `[].includes(x)` is always
//                                          false → always `continue` → window is
//                                          effectively disabled. Same end-result as
//                                          fail-closed, just semantically distinct
//                                          from "no constraint")
//
// Returns true if the timestamp falls inside at least one window; false otherwise.
// Non-parseable payload, missing timestamp, invalid timezone, out-of-range
// daysOfWeek, or zero-duration windows (end === start) → fail-closed (false / skip).
// ---------------------------------------------------------------------------

function parseHHMM(value: string): number | null {
  // Accepts "H:MM" or "HH:MM" (single-digit hour like "9:30" is intentional).
  // Minutes must be exactly 2 digits to disambiguate "9:0" (rejected) vs "9:00".
  const matched = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!matched) return null
  const hours = Number(matched[1])
  const minutes = Number(matched[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

// Module-level constants for IN_TIME_WINDOW evaluator hot path —
// avoid re-allocating per-bar
const WEEKDAY_MAP: Readonly<Record<string, number>> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

// Module-level cache: timezones are a finite set fixed at strategy compile time
// (typically 1 per strategy), so caching formatters avoids creating a new
// Intl.DateTimeFormat instance on every bar (hot path, 1m-level strategies).
// Stores `null` for timezones that throw (invalid IANA name) so we don't retry.
//
// Test isolation: Jest resets module state across test *files* (via --resetModules
// or fresh require), but NOT between `describe` / `it` within a single file. Tests
// that mutate this cache (e.g. "invalid timezone" path) share the null-sentinel
// with later tests in the same file. Add a manual cache clear in `beforeEach` if a
// future test needs to verify "recover after invalid timezone".
const TIME_WINDOW_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat | null>()

function getTimeWindowFormatter(timezone: string): Intl.DateTimeFormat | null {
  const cached = TIME_WINDOW_FORMATTER_CACHE.get(timezone)
  if (cached !== undefined) return cached
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      hourCycle: 'h23',
    })
    TIME_WINDOW_FORMATTER_CACHE.set(timezone, formatter)
    return formatter
  }
  catch {
    TIME_WINDOW_FORMATTER_CACHE.set(timezone, null)
    return null
  }
}

function evaluateInTimeWindow(
  nowMs: number,
  timezone: string,
  windows: ReadonlyArray<CompiledTimeWindow>,
): boolean {
  if (windows.length === 0) return false

  // Reuse cached formatter per timezone; null means timezone is invalid (IANA-unknown)
  const formatter = getTimeWindowFormatter(timezone)
  if (formatter === null) return false

  let localMinutes: number
  let localDayOfWeek: number
  try {
    // formatToParts accepts number directly — no Date() wrapper needed
    const parts = formatter.formatToParts(nowMs)
    const hourPart = parts.find(p => p.type === 'hour')?.value
    const minutePart = parts.find(p => p.type === 'minute')?.value
    const weekdayPart = parts.find(p => p.type === 'weekday')?.value
    if (!hourPart || !minutePart || !weekdayPart) return false
    const localHour = Number(hourPart)
    const localMinute = Number(minutePart)
    if (!Number.isFinite(localHour) || !Number.isFinite(localMinute)) return false
    localMinutes = localHour * 60 + localMinute
    const mapped = WEEKDAY_MAP[weekdayPart]
    if (mapped === undefined) return false
    localDayOfWeek = mapped
  }
  catch {
    return false
  }

  for (const window of windows) {
    if (!window || typeof window !== 'object') continue
    const start = typeof window.start === 'string' ? parseHHMM(window.start) : null
    const end = typeof window.end === 'string' ? parseHHMM(window.end) : null
    if (start === null || end === null) continue

    const daysOfWeek = window.daysOfWeek
    if (daysOfWeek !== undefined) {
      if (!Array.isArray(daysOfWeek)) continue
      // fail-closed: every day must be a finite integer in [0, 6]; NaN / 7 / strings reject the window
      const allowed = daysOfWeek.every(
        (d): d is number =>
          typeof d === 'number' && Number.isFinite(d) && Number.isInteger(d) && d >= 0 && d <= 6,
      )
      if (!allowed) continue
      if (!daysOfWeek.includes(localDayOfWeek)) continue
    }

    // Zero-duration window (start === end): fail-closed treats as "never matches"
    // rather than the previous accidental "all day" behavior (start <= end branch
    // collapsed to `>= start || < start` which is tautologically true).
    if (end === start) continue
    // Window spans midnight (e.g. 22:00–02:00) — split into two sub-ranges
    if (end < start) {
      if (localMinutes >= start || localMinutes < end) return true
    }
    else {
      if (localMinutes >= start && localMinutes < end) return true
    }
  }

  return false
}

export function invalidateMemoryOperand(
  ctx: { semanticRuntimeState?: Record<string, unknown> | Record<string, Record<string, unknown>> } | StrategyExecutionContextV1,
  memoryKey: string,
): void {
  const state = (ctx as { semanticRuntimeState?: Record<string, unknown> }).semanticRuntimeState
  if (state && Object.prototype.hasOwnProperty.call(state, memoryKey)) {
    delete state[memoryKey]
  }
}
