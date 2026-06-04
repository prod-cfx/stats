import type { MarketTimeframe } from '@ai/shared'
import type { RuntimeScriptBar } from './runtime-data-portal'
import type { Bar, RuntimeEvent } from '@/modules/backtesting/types/backtesting.types'
import { getClosedBarsAsOf, toRuntimeScriptBars } from './runtime-data-portal'

const sortedRuntimeEventCache = new WeakMap<RuntimeEvent[], RuntimeEvent[]>()

export interface BuildRuntimeMarketContextInput {
  symbol: string
  baseTimeframe: MarketTimeframe
  primaryCloseTs: number
  params: Record<string, unknown>
  barsByTimeframe: Record<string, Bar[]>
  scriptBarsByTimeframe?: Record<string, RuntimeScriptBar[]>
  eventStreams?: Record<string, RuntimeEvent[]>
}

export function buildRuntimeMarketContext(input: BuildRuntimeMarketContextInput) {
  const primaryLegId = 'primary'
  const dataForPrimary: Record<
    string,
    {
      bars: ReturnType<typeof toRuntimeScriptBars>
      indicators: Record<string, number>
      currentPrice: number
    }
  > = {}

  for (const [timeframe, bars] of Object.entries(input.barsByTimeframe)) {
    const closedBars = getClosedBarsAsOf(bars, input.primaryCloseTs)
    if (closedBars.length === 0) continue
    const prebuiltScriptBars = input.scriptBarsByTimeframe?.[timeframe]
    const canReusePrebuiltBars = Array.isArray(prebuiltScriptBars)
      && prebuiltScriptBars.length === closedBars.length
      && bars[bars.length - 1]?.closeTime <= input.primaryCloseTs

    dataForPrimary[timeframe] = {
      bars: canReusePrebuiltBars ? prebuiltScriptBars : toRuntimeScriptBars(closedBars),
      indicators: {},
      currentPrice: closedBars[closedBars.length - 1]!.close,
    }
  }

  const eventInbox = buildEventInboxAsOf(input.eventStreams, input.primaryCloseTs)
  const dataSourceFeeds = buildDataSourceFeeds(input.eventStreams, eventInbox)

  return {
    data: { [primaryLegId]: dataForPrimary },
    execution: { timeframe: input.baseTimeframe },
    legs: [{ id: primaryLegId, symbol: input.symbol, role: 'primary' }],
    dataRequirements: { [primaryLegId]: Object.keys(dataForPrimary) },
    timestamp: input.primaryCloseTs,
    params: input.params,
    ...(eventInbox ? { eventInbox } : {}),
    ...(dataSourceFeeds ? { dataSourceFeeds } : {}),
  }
}

function buildDataSourceFeeds(
  eventStreams: Record<string, RuntimeEvent[]> | undefined,
  eventInbox: Record<string, RuntimeEvent[]> | undefined,
) {
  if (!eventStreams) return undefined

  const feeds: Record<string, {
    schema: 'funding' | 'liquidation' | 'orderbook' | 'open_interest' | 'webhook_event'
    permissionGranted: boolean
    hasData: boolean
  }> = {}

  for (const feedId of Object.keys(eventStreams)) {
    feeds[feedId] = {
      schema: inferEventFeedSchema(feedId),
      permissionGranted: true,
      hasData: Boolean(eventInbox?.[feedId]?.length),
    }
  }

  return Object.keys(feeds).length > 0 ? feeds : undefined
}

function inferEventFeedSchema(feedId: string): 'funding' | 'liquidation' | 'orderbook' | 'open_interest' | 'webhook_event' {
  if (/funding/iu.test(feedId)) return 'funding'
  if (/liquidation|liq/iu.test(feedId)) return 'liquidation'
  if (/orderbook|book/iu.test(feedId)) return 'orderbook'
  if (/open[_-]?interest|\boi\b/iu.test(feedId)) return 'open_interest'
  return 'webhook_event'
}

function buildEventInboxAsOf(
  eventStreams: Record<string, RuntimeEvent[]> | undefined,
  primaryCloseTs: number,
): Record<string, RuntimeEvent[]> | undefined {
  if (!eventStreams) return undefined

  const eventInbox: Record<string, RuntimeEvent[]> = {}
  for (const [feedId, events] of Object.entries(eventStreams)) {
    if (!Array.isArray(events)) continue
    const visibleEvents = selectVisibleRuntimeEvents(feedId, events, primaryCloseTs)
    if (visibleEvents.length > 0) {
      eventInbox[feedId] = visibleEvents
    }
  }

  return Object.keys(eventInbox).length > 0 ? eventInbox : undefined
}

function selectVisibleRuntimeEvents(feedId: string, events: RuntimeEvent[], primaryCloseTs: number): RuntimeEvent[] {
  const sorted = getSortedRuntimeEvents(events)
  const endExclusive = findVisibleEventEndIndex(sorted, primaryCloseTs)
  if (endExclusive <= 0) return []

  const schema = inferEventFeedSchema(feedId)
  if (schema === 'orderbook') {
    return [sorted[endExclusive - 1]!]
  }
  if (schema === 'open_interest') {
    return sorted.slice(Math.max(0, endExclusive - 2), endExclusive)
  }

  return sorted.slice(0, endExclusive)
}

function getSortedRuntimeEvents(events: RuntimeEvent[]): RuntimeEvent[] {
  const cached = sortedRuntimeEventCache.get(events)
  if (cached) return cached
  const sorted = events
    .filter(isValidRuntimeEvent)
    .slice()
    .sort((left, right) => left.ts - right.ts)
  sortedRuntimeEventCache.set(events, sorted)
  return sorted
}

function findVisibleEventEndIndex(events: RuntimeEvent[], primaryCloseTs: number): number {
  let low = 0
  let high = events.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (events[mid]!.ts <= primaryCloseTs) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

function isValidRuntimeEvent(event: RuntimeEvent): boolean {
  return Boolean(
    event
    && typeof event.id === 'string'
    && typeof event.ts === 'number'
    && Number.isFinite(event.ts)
    && event.payload
    && typeof event.payload === 'object'
    && !Array.isArray(event.payload),
  )
}
