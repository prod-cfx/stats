import type { StrategyLogicGraph } from './logic-graph-model'

interface CodegenSpecMarket {
  symbols?: string[]
  timeframes?: string[]
}

interface CodegenSpecRuleCondition {
  key?: string
  kind?: string
  op?: string
  value?: unknown
  params?: Record<string, unknown>
}

interface CodegenSpecRuleAction {
  type?: string
  sizing?: {
    mode?: string
    value?: unknown
    asset?: unknown
  }
}

interface CodegenSpecRule {
  id?: string
  phase?: string
  condition?: CodegenSpecRuleCondition
  actions?: CodegenSpecRuleAction[]
}

interface CanonicalSpecMarket {
  exchange?: string | null
  symbol?: string | null
  timeframe?: string | null
}

interface CanonicalSpec {
  market?: CanonicalSpecMarket
  sizing?: CodegenSpecRuleAction['sizing']
}

interface CodegenSpec {
  entryRules?: string[]
  exitRules?: string[]
  riskRules?: Record<string, unknown>
  market?: CodegenSpecMarket
  rules?: CodegenSpecRule[]
  lockedParams?: Record<string, unknown>
  canonicalSpec?: CanonicalSpec
}

interface GraphFallbackMeta {
  exchange: 'binance' | 'okx' | 'hyperliquid'
  symbol: string
  baseTimeframe: string
  positionPct: number
  executionTags?: string[]
}

function asStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function stringifyRiskRule(key: string, value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${key}: ${String(value)}`
  }
  return `${key}: ${JSON.stringify(value)}`
}

function formatPct(raw: number): string {
  const pct = Math.abs(raw) * 100
  if (Number.isInteger(pct)) {
    return String(pct)
  }
  return pct.toFixed(2).replace(/\.?0+$/, '')
}

function describeBasis(basis: unknown): string {
  switch (basis) {
    case 'prev_close':
      return '相对前收盘'
    case 'entry_avg_price':
      return '相对开仓均价'
    case 'position_pnl':
      return '相对持仓收益'
    default:
      return ''
  }
}

function readConditionTimeframe(condition: CodegenSpecRuleCondition | undefined): string | null {
  if (typeof condition?.params?.timeframe !== 'string') return null
  const timeframe = condition.params.timeframe.trim()
  return timeframe.length > 0 ? timeframe : null
}

function describeRuleCondition(condition: CodegenSpecRuleCondition | undefined): string | null {
  if (!condition) return null
  const key = condition.key
  switch (key) {
    case 'price.change_pct': {
      const value = typeof condition.value === 'number' && Number.isFinite(condition.value)
        ? condition.value
        : null
      if (value === null || value === 0) return '价格变化百分比'
      const timeframe = readConditionTimeframe(condition)
      const basis = describeBasis(condition.params?.basis)
      const direction = value < 0 || condition.op === 'LTE' ? '下跌' : '上涨'
      return `${timeframe ? `${timeframe} 内` : ''}${basis}${direction} ${formatPct(value)}%`
    }
    case 'bollinger.upper_break':
      return '价格向上突破布林带上轨'
    case 'bollinger.lower_break':
      return '价格向下突破布林带下轨'
    case 'bollinger.middle_revert':
      return '价格回到布林带中轨（MA20）'
    case 'position_loss_pct':
      return `亏损达到 ${(Number(condition.value ?? 0) * 100).toFixed(0)}%`
    case 'bollinger.bars_outside':
      return `价格连续${String(condition.value ?? 3)}根K线在轨外`
    default:
      return typeof key === 'string' && key.trim() ? key.trim() : null
  }
}

function mapRuleAction(action: CodegenSpecRuleAction | undefined): StrategyLogicGraph['actions'][number]['action'] | null {
  switch (action?.type) {
    case 'OPEN_LONG':
      return 'BUY'
    case 'OPEN_SHORT':
      return 'SELL'
    case 'CLOSE_LONG':
    case 'CLOSE_SHORT':
    case 'FORCE_EXIT':
    case 'REDUCE_LONG':
    case 'REDUCE_SHORT':
      return 'CLOSE'
    default:
      return null
  }
}

function extractPositionPct(spec: CodegenSpec, fallback: GraphFallbackMeta): number {
  const lockedPositionPct = spec.lockedParams?.positionPct
  if (typeof lockedPositionPct === 'number' && Number.isFinite(lockedPositionPct)) {
    return lockedPositionPct
  }
  const firstSizing = spec.rules
    ?.flatMap(rule => rule.actions ?? [])
    .find(action => action.sizing && typeof action.sizing.value === 'number')
  const sizingValue = firstSizing?.sizing?.value
  if (typeof sizingValue === 'number' && Number.isFinite(sizingValue)) {
    return sizingValue <= 1 ? sizingValue * 100 : sizingValue
  }
  return fallback.positionPct
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(8).replace(/\.?0+$/, '')
}

function formatSizingAmount(sizing: CodegenSpecRuleAction['sizing'] | null | undefined): string | null {
  if (!sizing || typeof sizing.value !== 'number' || !Number.isFinite(sizing.value)) return null

  if (sizing.mode === 'RATIO') {
    return `${formatNumber(sizing.value <= 1 ? sizing.value * 100 : sizing.value)}%`
  }

  if (sizing.mode === 'QUOTE' || sizing.mode === 'QTY') {
    return typeof sizing.asset === 'string' && sizing.asset.trim().length > 0
      ? `${formatNumber(sizing.value)} ${sizing.asset.trim()}`
      : formatNumber(sizing.value)
  }

  return null
}

function extractPositionSizing(spec: CodegenSpec, fallback: GraphFallbackMeta): string {
  const canonicalSizing = formatSizingAmount(spec.canonicalSpec?.sizing)
  if (canonicalSizing) return canonicalSizing

  const actionSizing = spec.rules
    ?.flatMap(rule => rule.actions ?? [])
    .map(action => formatSizingAmount(action.sizing))
    .find((item): item is string => Boolean(item))
  if (actionSizing) return actionSizing

  return `${extractPositionPct(spec, fallback)}%`
}

function extractTimeframe(spec: CodegenSpec, fallback: GraphFallbackMeta): string {
  const canonicalTimeframe = typeof spec.canonicalSpec?.market?.timeframe === 'string'
    ? spec.canonicalSpec.market.timeframe.trim()
    : ''
  if (canonicalTimeframe.length > 0) return canonicalTimeframe

  const marketTimeframes = asStringList(spec.market?.timeframes)
  if (marketTimeframes.length > 0) return marketTimeframes.join('/')

  return fallback.baseTimeframe
}

export function buildLogicGraphFromCodegenSpec(
  spec: unknown,
  fallback: GraphFallbackMeta,
  version: number,
  status: StrategyLogicGraph['status'] = 'draft',
): StrategyLogicGraph {
  const typed = (spec && typeof spec === 'object' ? spec : {}) as CodegenSpec
  const topLevelRules = Array.isArray(typed.rules) ? typed.rules : []
  const entryPhaseRules = topLevelRules.filter(rule => rule.phase === 'entry')
  const exitPhaseRules = topLevelRules.filter(rule => rule.phase === 'exit')
  const entryRules = topLevelRules.length > 0
    ? entryPhaseRules
        .map(rule => describeRuleCondition(rule.condition))
        .filter((rule): rule is string => typeof rule === 'string' && rule.trim().length > 0)
    : asStringList(typed.entryRules)
  const exitRules = topLevelRules.length > 0
    ? exitPhaseRules
        .map(rule => describeRuleCondition(rule.condition))
        .filter((rule): rule is string => typeof rule === 'string' && rule.trim().length > 0)
    : asStringList(typed.exitRules)
  const marketSymbols = asStringList(typed.market?.symbols)
  const riskRules = topLevelRules.length > 0
    ? topLevelRules
        .filter(rule => rule.phase === 'risk')
        .map(rule => {
          const condition = describeRuleCondition(rule.condition)
          const action = rule.actions?.map(item => item.type).filter(Boolean).join(' / ')
          if (!condition) return null
          return action ? `${condition} -> ${action}` : condition
        })
        .filter((rule): rule is string => typeof rule === 'string' && rule.trim().length > 0)
    : Object.entries(typed.riskRules && typeof typed.riskRules === 'object' ? typed.riskRules : {})
        .map(([key, value]) => stringifyRiskRule(key, value))

  const symbol = marketSymbols[0]
    || (typeof typed.canonicalSpec?.market?.symbol === 'string' ? typed.canonicalSpec.market.symbol : null)
    || fallback.symbol
  const positionPct = extractPositionPct(typed, fallback)
  const positionSizing = extractPositionSizing(typed, fallback)
  const timeframe = extractTimeframe(typed, fallback)
  const trigger = [
    ...entryRules.map((rule, idx) => ({
      id: entryPhaseRules[idx]?.id
        ? `trigger-${entryPhaseRules[idx].id}`
        : `trigger-entry-${version}-${idx}`,
      subject: symbol,
      operator: rule,
      value: 'true',
      join: (idx > 0 ? 'AND' : undefined) as 'AND' | undefined,
    })),
    ...exitRules.map((rule, idx) => ({
      id: exitPhaseRules[idx]?.id
        ? `trigger-${exitPhaseRules[idx].id}`
        : `trigger-exit-${version}-${idx}`,
      subject: symbol,
      operator: rule,
      value: 'true',
      join: ((idx > 0 || entryRules.length > 0) ? 'AND' : undefined) as 'AND' | undefined,
    })),
  ]

  const risk = riskRules
  if (risk.length === 0) {
    risk.push('等待风控规则补充')
  }

  const actions: StrategyLogicGraph['actions'] = topLevelRules.length > 0
    ? topLevelRules
        .flatMap((rule, ruleIndex) =>
          (rule.actions ?? []).map((action, actionIndex) => {
            const mappedAction = mapRuleAction(action)
            if (!mappedAction) return null
            return {
              id: rule.id
                ? `action-${rule.id}-${actionIndex}`
                : `action-${version}-${ruleIndex}-${actionIndex}`,
              action: mappedAction,
              target: symbol,
              amount: formatSizingAmount(action.sizing) ?? positionSizing,
            } satisfies StrategyLogicGraph['actions'][number]
          }),
        )
        .filter((action): action is StrategyLogicGraph['actions'][number] => action !== null)
    : (() => {
        const fallbackActions: StrategyLogicGraph['actions'] = []
        if (entryRules.length > 0) {
          fallbackActions.push({
            id: `action-buy-${version}`,
            action: 'BUY',
            target: symbol,
            amount: positionSizing,
          })
        }
        if (exitRules.length > 0) {
          fallbackActions.push({
            id: `action-sell-${version}`,
            action: 'SELL',
            target: symbol,
            amount: positionSizing,
          })
        }
        return fallbackActions
      })()

  return {
    version,
    status,
    trigger: trigger.length > 0
      ? trigger
      : [{
          id: `trigger-default-${version}`,
          subject: symbol,
          operator: '等待策略规则补充',
          value: 'true',
        }],
    actions,
    risk,
    meta: {
      exchange:
        typed.lockedParams?.exchange === 'binance' || typed.lockedParams?.exchange === 'okx' || typed.lockedParams?.exchange === 'hyperliquid'
          ? typed.lockedParams.exchange
          : typed.canonicalSpec?.market?.exchange === 'binance' || typed.canonicalSpec?.market?.exchange === 'okx' || typed.canonicalSpec?.market?.exchange === 'hyperliquid'
            ? typed.canonicalSpec.market.exchange
            : fallback.exchange,
      symbol,
      timeframe,
      positionPct,
      positionSizing,
      executionTags: fallback.executionTags ?? [],
    },
  }
}
