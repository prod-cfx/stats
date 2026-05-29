import type { MarketTimeframe } from '@ai/shared'
import type {
  RuntimeDataPlan,
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
    eventStreams: [],
  }
}
