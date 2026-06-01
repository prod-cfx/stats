import type { MarketTimeframe } from '@ai/shared'
import type { Bar, RuntimeEvent } from '@/modules/backtesting/types/backtesting.types'
import { getClosedBarsAsOf, toRuntimeScriptBars } from './runtime-data-portal'

export interface BuildRuntimeMarketContextInput {
  symbol: string
  baseTimeframe: MarketTimeframe
  primaryCloseTs: number
  params: Record<string, unknown>
  barsByTimeframe: Record<string, Bar[]>
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

    dataForPrimary[timeframe] = {
      bars: toRuntimeScriptBars(closedBars),
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
    const visibleEvents = events.filter(event => (
      event
      && typeof event.id === 'string'
      && typeof event.ts === 'number'
      && Number.isFinite(event.ts)
      && event.ts <= primaryCloseTs
      && event.payload
      && typeof event.payload === 'object'
      && !Array.isArray(event.payload)
    ))
    if (visibleEvents.length > 0) {
      eventInbox[feedId] = visibleEvents
    }
  }

  return Object.keys(eventInbox).length > 0 ? eventInbox : undefined
}
