import type { BacktestCapabilities } from './backtest-capability-client'

export interface StrategyParamSyncFallback {
  exchange: 'binance' | 'okx' | 'hyperliquid'
  symbol: string
  baseTimeframe: string
  positionPct: number
}

export interface StrategyParamSyncResult {
  paramSchema: Record<string, unknown>
  paramValues: Record<string, unknown>
  normalized: StrategyParamSyncFallback
  executionTags: string[]
}

const STRATEGY_PARAM_KEYS = new Set([
  'exchange',
  'marketType',
  'symbol',
  'baseTimeframe',
  'buyWindowMin',
  'buyDropPct',
  'sellWindowMin',
  'sellRisePct',
  'positionPct',
  'entryPrice',
  'exitPrice',
  'stopLossPct',
  'maxDrawdownPct',
  'gridLower',
  'gridUpper',
  'gridCount',
  'gridStepPct',
])

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeSymbol(raw: string): string {
  return raw.replace('/', '').replace(/\s+/g, '').toUpperCase()
}

function mergeUnique(listA: string[], listB: string[]): string[] {
  const next = new Set<string>()
  for (const value of [...listA, ...listB]) {
    if (value.trim()) {
      next.add(value)
    }
  }
  return [...next]
}

function inferExchange(text: string, fallback: StrategyParamSyncFallback['exchange']): StrategyParamSyncFallback['exchange'] {
  if (/okx|欧易/i.test(text)) return 'okx'
  if (/hyperliquid/i.test(text)) return 'hyperliquid'
  if (/binance|币安/i.test(text)) return 'binance'
  return fallback
}

function inferMarketType(text: string): 'spot' | 'perp' | null {
  if (/永续|perp|perpetual|swap|合约/i.test(text)) return 'perp'
  if (/现货|spot/i.test(text)) return 'spot'
  return null
}

function inferSymbol(text: string, fallback: string, latest = false): string {
  const matches = text.matchAll(/\b([A-Z]{2,10}\/[A-Z]{2,10}|[A-Z]{2,10}USDT|[A-Z]{2,10}USDC)\b/gi)
  const symbols = [...matches].map(item => normalizeSymbol(item[1]))
  if (!symbols.length) return fallback
  return latest ? symbols[symbols.length - 1] : symbols[0]
}

function inferBaseTimeframe(specTimeframes: string[], fallback: string, allowedBaseTimeframes: string[]): string {
  const candidate = specTimeframes[0] ?? fallback
  if (allowedBaseTimeframes.length === 0) return candidate
  return allowedBaseTimeframes.includes(candidate) ? candidate : (allowedBaseTimeframes[0] ?? candidate)
}

function setNumberField(
  properties: Record<string, unknown>,
  required: string[],
  values: Record<string, unknown>,
  key: string,
  title: string,
  value: number | null,
  options?: { minimum?: number, maximum?: number },
) {
  if (value === null) return
  properties[key] = {
    type: Number.isInteger(value) ? 'integer' : 'number',
    title,
    ...(options?.minimum !== undefined ? { minimum: options.minimum } : {}),
    ...(options?.maximum !== undefined ? { maximum: options.maximum } : {}),
  }
  values[key] = value
  required.push(key)
}

function extractWindowDropRule(rule: string): { windowMin: number, pct: number } | null {
  const match = rule.match(/(\d+)\s*m\s*内下跌\s*([0-9]+(?:\.[0-9]+)?)%/i)
  if (!match) return null
  return { windowMin: Number(match[1]), pct: Number(match[2]) }
}

function extractWindowRiseRule(rule: string): { windowMin: number, pct: number } | null {
  const match = rule.match(/(\d+)\s*m\s*内上涨\s*([0-9]+(?:\.[0-9]+)?)%/i)
  if (!match) return null
  return { windowMin: Number(match[1]), pct: Number(match[2]) }
}

function extractPriceRule(rule: string): number | null {
  const match = rule.match(/价格(?:达到|到达|上涨到|涨到|跌到|触及)\s*([0-9]+(?:\.[0-9]+)?)/)
  return match ? Number(match[1]) : null
}

function extractPriceRange(text: string): { lower: number, upper: number } | null {
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*[-~到至]\s*([0-9]+(?:\.[0-9]+)?)/)
  if (!match?.[1] || !match[2]) return null
  const lower = Number(match[1])
  const upper = Number(match[2])
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return null
  return lower <= upper ? { lower, upper } : { lower: upper, upper: lower }
}

function findFirstMappedValue<T, TValue>(
  items: T[],
  mapper: (item: T) => TValue | null | undefined,
): TValue | null {
  for (const item of items) {
    const value = mapper(item)
    if (value !== null && value !== undefined) {
      return value
    }
  }

  return null
}

export function syncStrategyParamsFromCodegen(args: {
  spec: unknown
  fallback: StrategyParamSyncFallback
  currentValues?: Record<string, unknown> | null
  capabilities?: BacktestCapabilities | null
  contextText?: string
}): StrategyParamSyncResult {
  const typed = asObject(args.spec) ?? {}
  const market = asObject(typed.market) ?? {}
  const riskRules = asObject(typed.riskRules) ?? {}
  const entryRules = asStringArray(typed.entryRules)
  const exitRules = asStringArray(typed.exitRules)
  const marketSymbols = asStringArray(market.symbols)
  const marketTimeframes = asStringArray(market.timeframes)
  const allowedSymbols = args.capabilities?.allowedSymbols ?? []
  const allowedBaseTimeframes = args.capabilities?.allowedBaseTimeframes ?? []
  const contextText = `${args.contextText ?? ''} ${entryRules.join(' ')} ${exitRules.join(' ')}`.trim()

  const nextExchange = inferExchange(contextText, args.fallback.exchange)
  const currentValues = args.currentValues ?? {}
  const symbolFromMarket = inferSymbol(marketSymbols[0] ?? '', args.fallback.symbol)
  const symbolFromContext = inferSymbol(contextText, args.fallback.symbol, true)
  const nextSymbol = symbolFromContext !== args.fallback.symbol ? symbolFromContext : symbolFromMarket
  const symbolEnum = [nextSymbol, ...allowedSymbols.filter(item => item !== nextSymbol)]
  const nextBaseTimeframe = inferBaseTimeframe(marketTimeframes, args.fallback.baseTimeframe, allowedBaseTimeframes)
  const parsedPositionPct = parseNumber(riskRules.positionPct)
    ?? parseNumber(contextText.match(/([0-9]+(?:\.[0-9]+)?)%\s*(?:仓位|总仓位|仓位的)/)?.[1])
    ?? args.fallback.positionPct
  const nextMarketType = (() => {
    const fromRiskRules = parseString(riskRules.marketType)?.toLowerCase()
    if (fromRiskRules === 'spot' || fromRiskRules === 'perp') return fromRiskRules
    const fromCurrentValues = parseString(currentValues.marketType)?.toLowerCase()
    const inferred = inferMarketType(contextText)
    if (inferred) return inferred
    if (fromCurrentValues === 'spot' || fromCurrentValues === 'perp') return fromCurrentValues
    return null
  })()
  const inferredRange = extractPriceRange(contextText)
  const gridLower = parseNumber(riskRules.gridLower) ?? parseNumber(currentValues.gridLower) ?? inferredRange?.lower ?? null
  const gridUpper = parseNumber(riskRules.gridUpper) ?? parseNumber(currentValues.gridUpper) ?? inferredRange?.upper ?? null
  const gridCount = parseNumber(riskRules.gridCount) ?? parseNumber(currentValues.gridCount)
  const gridStepPct = parseNumber(riskRules.gridStepPct) ?? parseNumber(currentValues.gridStepPct)

  const preservedValues = Object.fromEntries(
    Object.entries(currentValues).filter(([key]) => !STRATEGY_PARAM_KEYS.has(key)),
  )
  const values: Record<string, unknown> = {
    ...preservedValues,
    exchange: nextExchange,
    symbol: nextSymbol,
    baseTimeframe: nextBaseTimeframe,
    positionPct: parsedPositionPct,
  }
  if (nextMarketType) {
    values.marketType = nextMarketType
  }

  const properties: Record<string, unknown> = {
    exchange: {
      type: 'string',
      title: 'Exchange',
      enum: ['binance', 'okx', 'hyperliquid'],
    },
    symbol: {
      type: 'string',
      title: 'Symbol',
      enum: symbolEnum,
    },
    baseTimeframe: {
      type: 'string',
      title: 'Base Timeframe',
      enum: allowedBaseTimeframes.length > 0 ? allowedBaseTimeframes : [nextBaseTimeframe],
    },
    positionPct: {
      type: Number.isInteger(parsedPositionPct) ? 'integer' : 'number',
      title: 'Position %',
      minimum: 1,
      maximum: 100,
    },
  }
  const required = ['exchange', 'symbol', 'baseTimeframe', 'positionPct']
  if (nextMarketType) {
    properties.marketType = {
      type: 'string',
      title: 'Market Type',
      enum: ['spot', 'perp'],
    }
    required.push('marketType')
  }

  const entryWindowRule = findFirstMappedValue(entryRules, extractWindowDropRule)
  const exitWindowRule = findFirstMappedValue(exitRules, extractWindowRiseRule)
  const entryPrice = findFirstMappedValue(entryRules, extractPriceRule)
  const exitPrice = findFirstMappedValue(exitRules, extractPriceRule)

  setNumberField(properties, required, values, 'buyWindowMin', 'Buy Window (min)', entryWindowRule?.windowMin ?? null, { minimum: 1 })
  setNumberField(properties, required, values, 'buyDropPct', 'Buy Drop %', entryWindowRule?.pct ?? null, { minimum: 0 })
  setNumberField(properties, required, values, 'sellWindowMin', 'Sell Window (min)', exitWindowRule?.windowMin ?? null, { minimum: 1 })
  setNumberField(properties, required, values, 'sellRisePct', 'Sell Rise %', exitWindowRule?.pct ?? null, { minimum: 0 })
  setNumberField(properties, required, values, 'entryPrice', 'Entry Price', entryPrice, { minimum: 0 })
  setNumberField(properties, required, values, 'exitPrice', 'Exit Price', exitPrice, { minimum: 0 })
  setNumberField(properties, required, values, 'stopLossPct', 'Stop Loss %', parseNumber(riskRules.stopLossPct), { minimum: 0 })
  setNumberField(properties, required, values, 'maxDrawdownPct', 'Max Drawdown %', parseNumber(riskRules.maxDrawdownPct), { minimum: 0, maximum: 100 })
  setNumberField(properties, required, values, 'gridLower', 'Grid Lower', gridLower, { minimum: 0 })
  setNumberField(properties, required, values, 'gridUpper', 'Grid Upper', gridUpper, { minimum: 0 })
  setNumberField(properties, required, values, 'gridCount', 'Grid Count', gridCount, { minimum: 1 })
  setNumberField(properties, required, values, 'gridStepPct', 'Grid Step %', gridStepPct, { minimum: 0 })

  const executionTags = Object.entries(values)
    .filter(([key]) => !['exchange', 'symbol', 'baseTimeframe'].includes(key))
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => `${key}: ${String(value)}`)

  return {
    paramSchema: {
      type: 'object',
      required,
      properties,
    },
    paramValues: values,
    normalized: {
      exchange: nextExchange,
      symbol: nextSymbol,
      baseTimeframe: nextBaseTimeframe,
      positionPct: parsedPositionPct,
    },
    executionTags,
  }
}

export function applyCapabilitiesToParamSchema(
  schema: Record<string, unknown> | null | undefined,
  capabilities: BacktestCapabilities | null,
): Record<string, unknown> | null {
  if (!schema) return schema ?? null
  const typed = asObject(schema)
  const properties = asObject(typed?.properties)
  if (!typed || !properties) return schema

  const nextProperties = {
    ...properties,
  }

  const symbolProperty = asObject(properties.symbol)
  if (symbolProperty) {
    const nextSymbolEnum = capabilities?.allowedSymbols?.length
      ? mergeUnique(asStringArray(symbolProperty.enum), capabilities.allowedSymbols)
      : asStringArray(symbolProperty.enum)
    nextProperties.symbol = {
      ...symbolProperty,
      enum: nextSymbolEnum,
    }
  }

  const timeframeProperty = asObject(properties.baseTimeframe)
  if (timeframeProperty) {
    nextProperties.baseTimeframe = {
      ...timeframeProperty,
      enum: capabilities?.allowedBaseTimeframes?.length ? capabilities.allowedBaseTimeframes : timeframeProperty.enum,
    }
  }

  return {
    ...typed,
    properties: nextProperties,
  }
}
