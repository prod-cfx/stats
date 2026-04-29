import type { BacktestCapabilities } from './backtest-capability-client'
import {
  derivePositionPctFromSizing,
  normalizeSizingFromCanonicalValue,
  type QuantSizing,
} from '@/app/[lng]/ai-quant/semantic-sizing'

export interface StrategyParamSyncFallback {
  exchange: 'binance' | 'okx' | 'hyperliquid'
  symbol: string
  baseTimeframe: string
  positionPct: number
  sizing?: QuantSizing
}

export interface StrategyParamSyncResult {
  paramSchema: Record<string, unknown>
  paramValues: Record<string, unknown>
  normalized: StrategyParamSyncFallback & { sizing: QuantSizing }
  executionTags: string[]
}

interface CanonicalRuleCondition {
  key?: string
  value?: unknown
}

interface CanonicalRuleAction {
  type?: string
  sizing?: {
    mode?: string
    value?: unknown
    asset?: unknown
  }
}

interface CanonicalRule {
  phase?: string
  condition?: CanonicalRuleCondition
  actions?: CanonicalRuleAction[]
}

function deriveEntryRulesFromCanonicalRules(rules: CanonicalRule[]): string[] {
  return rules
    .filter(rule => rule.phase === 'entry')
    .flatMap((rule) => {
      switch (rule.condition?.key) {
        case 'bollinger.upper_break':
          return ['突破布林带上轨']
        case 'bollinger.lower_break':
          return ['突破布林带下轨']
        default:
          return []
      }
    })
}

function deriveExitRulesFromCanonicalRules(rules: CanonicalRule[]): string[] {
  return rules
    .filter(rule => rule.phase === 'exit')
    .flatMap(rule => rule.condition?.key === 'bollinger.middle_revert' ? ['价格回到布林带中轨（MA20）平仓'] : [])
}

const STRATEGY_PARAM_KEYS = new Set([
  'exchange',
  'marketType',
  'symbol',
  'baseTimeframe',
  'sizing',
  'buyWindowMin',
  'buyDropPct',
  'sellWindowMin',
  'sellRisePct',
  'positionPct',
  'positionAmount',
  'sizingAsset',
  'entryPrice',
  'exitPrice',
  'stopLossPct',
  'maxDrawdownPct',
  'gridLower',
  'gridUpper',
  'gridCount',
  'gridStepPct',
])

const EXECUTION_TAG_EXCLUDED_KEYS = new Set([
  'backtestRangePreset',
  'backtestStart',
  'backtestEnd',
  'backtestInitialCash',
  'backtestLeverage',
  'backtestSlippageBps',
  'backtestFeeBps',
  'backtestPriceSource',
  'backtestAllowPartial',
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

function parseExchange(value: unknown): StrategyParamSyncFallback['exchange'] | null {
  const normalized = parseString(value)?.toLowerCase()
  if (normalized === 'binance' || normalized === 'okx' || normalized === 'hyperliquid') return normalized
  return null
}

function normalizeSymbol(raw: string): string {
  return raw.replace('/', '').replace(/\s+/g, '').toUpperCase()
}

function inferExchange(text: string, fallback: StrategyParamSyncFallback['exchange']): StrategyParamSyncFallback['exchange'] {
  if (/okx|欧易/i.test(text)) return 'okx'
  if (/hyperliquid/i.test(text)) return 'hyperliquid'
  if (/binance|币安/i.test(text)) return 'binance'
  return fallback
}

function inferMarketType(text: string): 'spot' | 'perp' | null {
  if (/永续|perpetual|perp|swap|合约/i.test(text)) return 'perp'
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

function readMarketStrings(market: Record<string, unknown>, pluralKey: string, singularKey: string): string[] {
  const pluralValues = asStringArray(market[pluralKey])
  if (pluralValues.length > 0) return pluralValues
  const singularValue = parseString(market[singularKey])
  return singularValue ? [singularValue] : []
}

function hasSizingShape(value: unknown): value is Record<string, unknown> {
  const raw = asObject(value)
  const mode = parseString(raw?.mode)?.toUpperCase()
  return Boolean(
    raw
    && (mode === 'RATIO' || mode === 'QUOTE' || mode === 'QTY')
    && parseNumber(raw.value) !== null,
  )
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
  const match = rule.match(/(\d+)\s*m\s*内下跌\s*(\d+(?:\.\d+)?)%/i)
  if (!match) return null
  return { windowMin: Number(match[1]), pct: Number(match[2]) }
}

function extractWindowRiseRule(rule: string): { windowMin: number, pct: number } | null {
  const match = rule.match(/(\d+)\s*m\s*内上涨\s*(\d+(?:\.\d+)?)%/i)
  if (!match) return null
  return { windowMin: Number(match[1]), pct: Number(match[2]) }
}

function extractPriceRule(rule: string): number | null {
  const match = rule.match(/价格(?:达到|到达|上涨到|涨到|跌到|触及)\s*(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : null
}

function extractPriceRange(text: string): { lower: number, upper: number } | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*[-~到至]\s*(\d+(?:\.\d+)?)/)
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
  const canonicalSpec = asObject(typed.canonicalSpec) ?? {}
  const canonicalMarket = asObject(canonicalSpec.market) ?? {}
  const topLevelRules = Array.isArray(typed.rules)
    ? typed.rules as CanonicalRule[]
    : (Array.isArray(canonicalSpec.rules) ? canonicalSpec.rules as CanonicalRule[] : [])
  const market = asObject(typed.market) ?? canonicalMarket
  const derivedRiskRules = (() => {
    if (topLevelRules.length === 0) return {}
    const next: Record<string, unknown> = {}
    const lockedParams = asObject(typed.lockedParams)
    const exchange = parseExchange(lockedParams?.exchange) ?? parseExchange(canonicalMarket.exchange)
    if (exchange) next.exchange = exchange
    const marketType = parseString(canonicalMarket.marketType)
    if (marketType) next.marketType = marketType
    const positionPct = parseNumber(lockedParams?.positionPct)
      ?? (() => {
        const openAction = topLevelRules.flatMap(rule => rule.actions ?? []).find(action => action.sizing)
        if (openAction?.sizing?.mode !== 'RATIO') return null
        const sizingValue = parseNumber(openAction?.sizing?.value)
        if (sizingValue === null) return null
        return sizingValue <= 1 ? sizingValue * 100 : sizingValue
      })()
    if (positionPct !== null) next.positionPct = positionPct

    for (const rule of topLevelRules) {
      if (rule.phase !== 'risk') continue
      if (rule.condition?.key === 'position_loss_pct') {
        const stopLossPct = parseNumber(rule.condition.value)
        if (stopLossPct !== null) {
          next.stopLossPct = stopLossPct <= 1 ? stopLossPct * 100 : stopLossPct
        }
      }
      if (rule.condition?.key === 'bollinger.bars_outside') {
        const bars = parseNumber(rule.condition.value) ?? 3
        const actions = (rule.actions ?? [])
          .map(action => action.type)
          .filter((value): value is string => typeof value === 'string')
        next.earlyStop = `价格连续${bars}根K线在轨外时${actions.includes('FORCE_EXIT') ? '提前止损' : '减仓'}`
      }
    }
    return next
  })()
  const riskRules = asObject(typed.riskRules) ?? derivedRiskRules
  const entryRules = topLevelRules.length > 0
    ? deriveEntryRulesFromCanonicalRules(topLevelRules)
    : asStringArray(typed.entryRules)
  const exitRules = topLevelRules.length > 0
    ? deriveExitRulesFromCanonicalRules(topLevelRules)
    : asStringArray(typed.exitRules)
  const marketSymbols = readMarketStrings(market, 'symbols', 'symbol')
  const marketTimeframes = readMarketStrings(market, 'timeframes', 'timeframe')
  const allowedBaseTimeframes = args.capabilities?.allowedBaseTimeframes ?? []
  const contextText = `${args.contextText ?? ''} ${entryRules.join(' ')} ${exitRules.join(' ')}`.trim()

  const currentValues = args.currentValues ?? {}
  const nextExchange = parseExchange(riskRules.exchange)
    ?? parseExchange(canonicalMarket.exchange)
    ?? inferExchange(contextText, args.fallback.exchange)
  const symbolFromMarket = inferSymbol(marketSymbols[0] ?? '', args.fallback.symbol)
  const symbolFromContext = inferSymbol(contextText, args.fallback.symbol, true)
  const nextSymbol = symbolFromContext !== args.fallback.symbol ? symbolFromContext : symbolFromMarket
  const nextBaseTimeframe = inferBaseTimeframe(marketTimeframes, args.fallback.baseTimeframe, allowedBaseTimeframes)
  const canonicalSizing = asObject(canonicalSpec.sizing)
  const actionSizing = topLevelRules
    .flatMap(rule => rule.actions ?? [])
    .map(action => action.sizing)
    .find((value): value is { mode?: string, value?: unknown } => Boolean(value))
  const legacyPositionPct = parseNumber(riskRules.positionPct)
    ?? parseNumber(contextText.match(/(\d+(?:\.\d+)?)%\s*(?:总仓位|仓位)/)?.[1])
    ?? args.fallback.positionPct
  const hasCanonicalOrActionSizing = Boolean(canonicalSizing || actionSizing)
  const parsedSizing = normalizeSizingFromCanonicalValue(
    canonicalSizing ?? actionSizing ?? null,
    nextSymbol,
    legacyPositionPct,
  )
  const retainedSizing = hasSizingShape(currentValues.sizing)
    ? normalizeSizingFromCanonicalValue(currentValues.sizing, nextSymbol, legacyPositionPct)
    : args.fallback.sizing
  const nextSizing = hasCanonicalOrActionSizing
    ? parsedSizing
    : (retainedSizing ?? { mode: 'RATIO', value: legacyPositionPct })
  const parsedPositionPct = derivePositionPctFromSizing(nextSizing) ?? legacyPositionPct
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
    sizing: nextSizing,
  }
  if (nextSizing.mode === 'RATIO') {
    values.positionPct = parsedPositionPct
  }
  else {
    values.positionAmount = nextSizing.value
    if ('asset' in nextSizing && nextSizing.asset) values.sizingAsset = nextSizing.asset
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
      enum: [nextSymbol],
    },
    baseTimeframe: {
      type: 'string',
      title: 'Base Timeframe',
      enum: allowedBaseTimeframes.length > 0 ? allowedBaseTimeframes : [nextBaseTimeframe],
    },
  }
  const required = ['exchange', 'symbol', 'baseTimeframe']
  if (nextSizing.mode === 'RATIO') {
    properties.positionPct = {
      type: Number.isInteger(parsedPositionPct) ? 'integer' : 'number',
      title: 'Position %',
      minimum: 1,
      maximum: 100,
    }
    required.push('positionPct')
  }
  else {
    properties.positionAmount = {
      type: Number.isInteger(nextSizing.value) ? 'integer' : 'number',
      title: nextSizing.mode === 'QUOTE' ? 'Position Amount' : 'Position Quantity',
      minimum: 0,
    }
    properties.sizingAsset = {
      type: 'string',
      title: 'Sizing Asset',
    }
    required.push('positionAmount')
  }
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
    .filter(([key]) => !EXECUTION_TAG_EXCLUDED_KEYS.has(key))
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
      sizing: nextSizing,
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
    nextProperties.symbol = {
      ...symbolProperty,
      enum: asStringArray(symbolProperty.enum),
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
