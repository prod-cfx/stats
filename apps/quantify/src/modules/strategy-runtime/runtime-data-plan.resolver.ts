import type { MarketTimeframe } from '@ai/shared'
import type {
  RuntimeDataPlan,
  RuntimeEventStreamRequirement,
  RuntimeExternalDataSourceRequirement,
  RuntimeIndicatorRequirement,
  RuntimePrimaryClock,
} from './runtime-data-plan'
import { uniqTimeframes } from './runtime-data-plan'

interface ResolveRuntimeDataPlanInput {
  strictParams: {
    exchange: string
    symbol: string
    marketType: 'spot' | 'perp'
    baseTimeframe: MarketTimeframe
  }
  stateTimeframes: MarketTimeframe[]
  scriptMetadata?: Record<string, unknown>
  orchestrationScopes?: Array<Record<string, unknown>>
  exprPool?: unknown
}

function readIndicators(metadata: Record<string, unknown> | undefined): RuntimeIndicatorRequirement[] {
  const raw = metadata?.indicators
  if (!Array.isArray(raw)) return []

  return raw.flatMap((item): RuntimeIndicatorRequirement[] => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Record<string, unknown>
    if (candidate.indicator !== 'ema') return []
    if (typeof candidate.period !== 'number' || !Number.isFinite(candidate.period) || candidate.period <= 0) return []
    if (typeof candidate.timeframe !== 'string' || candidate.timeframe.trim() === '') return []

    return [{ indicator: 'ema', period: candidate.period, timeframe: candidate.timeframe as MarketTimeframe }]
  })
}

function readExternalDataSources(scopes: Array<Record<string, unknown>> | undefined): RuntimeExternalDataSourceRequirement[] {
  return (scopes ?? []).flatMap((scope): RuntimeExternalDataSourceRequirement[] => {
    if (scope.scopeKind !== 'dataSource') return []

    const role = typeof scope.role === 'string' ? scope.role.trim() : ''
    const feedId = typeof scope.feedId === 'string' ? scope.feedId.trim() : ''
    const schemaRef = typeof scope.schemaRef === 'string' ? scope.schemaRef.trim() : ''
    if (!role || !feedId || !schemaRef) return []

    return [{ role, feedId, schemaRef }]
  })
}

export function readEventStreamsFromExprPool(exprPool: unknown): RuntimeEventStreamRequirement[] {
  if (!Array.isArray(exprPool)) return []

  const streams = exprPool.flatMap((node): RuntimeEventStreamRequirement[] => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return []
    const payload = (node as Record<string, unknown>).payload
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
    const payloadRecord = payload as Record<string, unknown>
    const params = payloadRecord.params
    const paramsRecord = params && typeof params === 'object' && !Array.isArray(params)
      ? params as Record<string, unknown>
      : {}

    if (
      payloadRecord.kind === 'fundingRateCondition'
      || payloadRecord.kind === 'liquidationCondition'
      || payloadRecord.kind === 'orderbookImbalance'
      || payloadRecord.kind === 'openInterestCondition'
    ) {
      const fallback = (() => {
        switch (payloadRecord.kind) {
          case 'fundingRateCondition':
            return { sourceFeedId: 'funding.rate', schemaRef: 'funding' as const }
          case 'liquidationCondition':
            return { sourceFeedId: 'liquidation.events', schemaRef: 'liquidation' as const }
          case 'orderbookImbalance':
            return { sourceFeedId: 'orderbook.imbalance', schemaRef: 'orderbook' as const }
          case 'openInterestCondition':
          default:
            return { sourceFeedId: 'open_interest', schemaRef: 'open_interest' as const }
        }
      })()
      const sourceFeedId = typeof paramsRecord.sourceFeedId === 'string' && paramsRecord.sourceFeedId.trim()
        ? paramsRecord.sourceFeedId.trim()
        : fallback.sourceFeedId
      const schemaRef = paramsRecord.schemaRef === 'funding'
        || paramsRecord.schemaRef === 'liquidation'
        || paramsRecord.schemaRef === 'orderbook'
        || paramsRecord.schemaRef === 'open_interest'
        ? paramsRecord.schemaRef
        : fallback.schemaRef

      return [{
        provider: 'external_feed',
        signalId: sourceFeedId,
        sourceFeedId,
        schemaRef,
      }]
    }

    if (payloadRecord.kind !== 'externalSignal') return []

    const provider = typeof paramsRecord.provider === 'string' && paramsRecord.provider.trim()
      ? paramsRecord.provider.trim()
      : 'webhook'
    const signalId = typeof paramsRecord.signalId === 'string' ? paramsRecord.signalId.trim() : ''
    if (provider !== 'webhook' || !signalId) return []

    const sourceFeedId = typeof paramsRecord.sourceFeedId === 'string' && paramsRecord.sourceFeedId.trim()
      ? paramsRecord.sourceFeedId.trim()
      : `webhook.${signalId}`
    const ttlMs = typeof paramsRecord.ttlMs === 'number' && Number.isFinite(paramsRecord.ttlMs) && paramsRecord.ttlMs > 0
      ? paramsRecord.ttlMs
      : undefined

    return [{
      provider: 'webhook',
      signalId,
      sourceFeedId,
      ...(ttlMs ? { ttlMs } : {}),
      schemaRef: 'webhook_event',
    }]
  })

  const byFeedId = new Map<string, RuntimeEventStreamRequirement>()
  streams.forEach((stream) => {
    if (!byFeedId.has(stream.sourceFeedId)) byFeedId.set(stream.sourceFeedId, stream)
  })
  return [...byFeedId.values()]
}

export function resolveRuntimeDataPlan(input: ResolveRuntimeDataPlanInput): RuntimeDataPlan {
  const primaryClock: RuntimePrimaryClock = {
    exchange: input.strictParams.exchange,
    symbol: input.strictParams.symbol,
    marketType: input.strictParams.marketType,
    timeframe: input.strictParams.baseTimeframe,
  }
  const indicators = readIndicators(input.scriptMetadata)
  const requiredTimeframes = uniqTimeframes([
    input.strictParams.baseTimeframe,
    ...input.stateTimeframes,
    ...indicators.map(item => item.timeframe),
  ])

  return {
    primaryClock,
    marketSeries: requiredTimeframes.map(timeframe => ({
      exchange: input.strictParams.exchange,
      symbol: input.strictParams.symbol,
      marketType: input.strictParams.marketType,
      timeframe,
    })),
    indicators,
    externalDataSources: readExternalDataSources(input.orchestrationScopes),
    eventStreams: readEventStreamsFromExprPool(input.exprPool),
  }
}
