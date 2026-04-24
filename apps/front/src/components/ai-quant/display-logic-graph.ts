type DisplayBlockType = 'IF' | 'AND_AT_THEN' | 'OR_THEN' | 'EXECUTE'

interface DisplayBaseItem {
  id: string
  text: string
}

export interface DisplayConditionItem extends DisplayBaseItem {
  kind: 'condition'
}

export interface DisplayActionItem extends DisplayBaseItem {
  kind: 'action'
}

export interface DisplayExecuteItem extends DisplayBaseItem {
  kind: 'execute'
  key: string
  value?: string
}

export interface DisplayBlock {
  type: DisplayBlockType
  items: Array<DisplayConditionItem | DisplayActionItem | DisplayExecuteItem>
}

export interface DisplayLogicGraph {
  blocks: DisplayBlock[]
}

interface DisplayLogicGraphCondition {
  key?: string
  op?: string
  value?: unknown
  params?: Record<string, unknown>
}

interface DisplayLogicGraphAction {
  type?: string
  sizing?: {
    mode?: string
    value?: unknown
  }
}

interface DisplayLogicGraphRule {
  id?: string
  phase?: string
  join?: 'AND' | 'OR'
  condition?: DisplayLogicGraphCondition
  actions?: DisplayLogicGraphAction[]
}

interface DisplayLogicGraphMarket {
  exchange?: unknown
  symbol?: unknown
  timeframe?: unknown
  marketType?: unknown
  symbols?: unknown
  timeframes?: unknown
}

interface DisplayLogicGraphSpecDesc {
  rules?: DisplayLogicGraphRule[]
  entryRules?: unknown
  exitRules?: unknown
  riskRules?: unknown
  lockedParams?: Record<string, unknown>
  canonicalSpec?: {
    market?: DisplayLogicGraphMarket
  }
  market?: DisplayLogicGraphMarket
}

export interface BuildDisplayLogicGraphInput {
  specDesc?: unknown
  fallbackMeta?: {
    exchange?: string
    symbol?: string
    timeframe?: string
    baseTimeframe?: string
    positionPct?: number
    marketType?: string
    executionTags?: string[]
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(asString).filter((item): item is string => Boolean(item))
}

function formatNumber(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(2).replace(/\.?0+$/, '')
}

function formatPercent(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const pct = Math.abs(value) <= 1 ? Math.abs(value) * 100 : Math.abs(value)
  return formatNumber(pct)
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    const text = asString(value)
    if (text) return text
  }
  return null
}

function humanizeMarketType(value: string | null): string | null {
  switch (value) {
    case 'spot':
      return '现货'
    case 'perp':
      return '永续'
    default:
      return value
  }
}

function formatPriceChangeCondition(condition: DisplayLogicGraphCondition): string {
  const timeframe = pickString(condition.params?.timeframe)
  const basis = pickString(condition.params?.basis)
  const rawValue = typeof condition.value === 'number' && Number.isFinite(condition.value)
    ? condition.value
    : null
  if (rawValue === null || rawValue === 0) return '价格变化条件待补充'
  const percent = formatPercent(rawValue)
  if (!percent) return '价格变化百分比'

  const direction = rawValue !== null && (rawValue < 0 || condition.op === 'LTE')
    ? '下跌'
    : '上涨'
  const basisText = basis === 'prev_close'
    ? '相对前收盘'
    : basis === 'entry_avg_price'
      ? '相对开仓均价'
      : basis === 'position_pnl'
        ? '相对持仓收益'
        : ''

  return `${timeframe ? `${timeframe} 内` : ''}${basisText}${direction} ${percent}%`
}

function formatPositionGainCondition(condition: DisplayLogicGraphCondition): string {
  const rawValue = typeof condition.value === 'number' && Number.isFinite(condition.value)
    ? condition.value
    : null
  const percent = formatPercent(rawValue)
  if (!percent) return '持仓收益条件'
  return `相对开仓均价盈利达到 ${percent}%`
}

function formatTakeProfitCondition(condition: DisplayLogicGraphCondition): string {
  const rawValue = typeof condition.value === 'number' && Number.isFinite(condition.value)
    ? condition.value
    : condition.params?.valuePct
  const percent = formatPercent(rawValue)
  if (!percent) return '止盈条件'
  const basis = pickString(condition.params?.basis)
  if (basis === 'entry_avg_price') {
    return `相对开仓均价盈利达到 ${percent}%`
  }
  if (basis === 'position_pnl') {
    return `持仓收益达到 ${percent}%`
  }
  return `盈利达到 ${percent}%`
}

function formatPositionLossCondition(condition: DisplayLogicGraphCondition): string {
  const rawValue = typeof condition.value === 'number' && Number.isFinite(condition.value)
    ? condition.value
    : null
  const percent = formatPercent(rawValue)
  if (!percent) return '亏损条件'
  return `亏损达到 ${percent}%`
}

function formatBollingerCondition(condition: DisplayLogicGraphCondition): string {
  switch (condition.key) {
    case 'bollinger.upper_break':
      return '价格向上突破布林带上轨'
    case 'bollinger.lower_break':
      return '价格向下突破布林带下轨'
    case 'bollinger.middle_revert':
      return '价格回到布林带中轨（MA20）'
    case 'bollinger.bars_outside': {
      const bars = formatNumber(condition.value) ?? '3'
      return `价格连续 ${bars} 根 K 线在布林带外`
    }
    default:
      return '布林带条件'
  }
}

function formatRsiCondition(condition: DisplayLogicGraphCondition): string {
  const threshold = formatNumber(condition.value)
  switch (condition.key) {
    case 'rsi.threshold_lte':
      return threshold ? `RSI 低于或等于 ${threshold}` : 'RSI 低于阈值'
    case 'rsi.threshold_gte':
      return threshold ? `RSI 高于或等于 ${threshold}` : 'RSI 高于阈值'
    case 'rsi.cross_over':
      return threshold ? `RSI 上穿 ${threshold}` : 'RSI 上穿阈值'
    case 'rsi.cross_under':
      return threshold ? `RSI 下穿 ${threshold}` : 'RSI 下穿阈值'
    default:
      return 'RSI 条件'
  }
}

function formatMacdCondition(condition: DisplayLogicGraphCondition): string {
  switch (condition.key) {
    case 'macd.golden_cross':
      return 'MACD 金叉'
    case 'macd.death_cross':
      return 'MACD 死叉'
    default:
      return 'MACD 条件'
  }
}

function formatGridCondition(condition: DisplayLogicGraphCondition): string {
  const payload = isRecord(condition.params)
    ? condition.params
    : isRecord(condition.value)
      ? condition.value
      : {}
  const lower = formatNumber(payload.rangeMin ?? payload.lower)
  const upper = formatNumber(payload.rangeMax ?? payload.upper)
  const stepPct = formatPercent(payload.stepPct ?? payload.stepPercent)
  const count = formatNumber(payload.levelCount ?? payload.count)
  const timeframe = pickString(payload.timeframe)
  const parts = [
    lower && upper ? `网格区间 ${lower} - ${upper}` : '网格区间',
    timeframe ? `${timeframe} 级别` : null,
    stepPct ? `步长 ${stepPct}%` : null,
    count ? `共 ${count} 格` : null,
  ].filter((item): item is string => Boolean(item))
  return parts.join('，')
}

function formatConditionText(condition: DisplayLogicGraphCondition | undefined): string {
  if (!condition) return '条件待补充'

  switch (condition.key) {
    case 'execution.on_start':
      return '启动时执行'
    case 'price.change_pct':
      return formatPriceChangeCondition(condition)
    case 'position_gain_pct':
      return formatPositionGainCondition(condition)
    case 'risk.take_profit_pct':
      return formatTakeProfitCondition(condition)
    case 'position_loss_pct':
      return formatPositionLossCondition(condition)
    case 'bollinger.upper_break':
    case 'bollinger.lower_break':
    case 'bollinger.middle_revert':
    case 'bollinger.bars_outside':
      return formatBollingerCondition(condition)
    case 'rsi.threshold_lte':
    case 'rsi.threshold_gte':
    case 'rsi.cross_over':
    case 'rsi.cross_under':
      return formatRsiCondition(condition)
    case 'macd.golden_cross':
    case 'macd.death_cross':
      return formatMacdCondition(condition)
    case 'grid.range_rebalance':
      return formatGridCondition(condition)
    default:
      return '不支持的条件，待补充'
  }
}

function formatActionText(action: DisplayLogicGraphAction): string {
  switch (action.type) {
    case 'OPEN_LONG':
      return '开多'
    case 'OPEN_SHORT':
      return '开空'
    case 'CLOSE_LONG':
    case 'CLOSE_SHORT':
    case 'FORCE_EXIT':
      return '平仓'
    case 'REDUCE_LONG':
    case 'REDUCE_SHORT':
      return '减仓'
    default:
      return '未支持的动作，待补充'
  }
}

function toPositionPct(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const pct = value <= 1 ? value * 100 : value
  return `${formatNumber(pct)}%`
}

function extractRules(specDesc: DisplayLogicGraphSpecDesc | null): DisplayLogicGraphRule[] {
  return Array.isArray(specDesc?.rules) ? specDesc.rules : []
}

function buildRiskSummaryText(rule: DisplayLogicGraphRule): string | null {
  const conditionText = formatConditionText(rule.condition)
  const actionText = (rule.actions ?? [])
    .map(action => formatActionText(action))
    .filter(Boolean)
    .join(' / ')
  if (!conditionText) return null
  return actionText ? `风控: ${conditionText} -> ${actionText}` : `风控: ${conditionText}`
}

function buildLegacyRiskSummaryTexts(specDesc: DisplayLogicGraphSpecDesc | null): string[] {
  if (!isRecord(specDesc?.riskRules)) return []
  return Object.entries(specDesc.riskRules)
    .map(([key, value]) => {
      const formatted = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value)
      return `风控: ${key} = ${formatted}`
    })
}

function buildLegacyRuleBlocks(specDesc: DisplayLogicGraphSpecDesc | null): DisplayBlock[] {
  if (!specDesc) return []

  const entryRules = asStringList(specDesc.entryRules)
  const exitRules = asStringList(specDesc.exitRules)

  const entryBlocks: DisplayBlock[] = entryRules.map((rule, index) => ({
    type: index === 0 ? 'IF' : 'AND_AT_THEN',
    items: [
      {
        kind: 'condition' as const,
        id: `legacy-entry-${index}`,
        text: rule,
      },
    ],
  }))

  const exitBlocks: DisplayBlock[] = exitRules.map((rule, index) => ({
    type: entryBlocks.length === 0 && index === 0 ? 'IF' : 'AND_AT_THEN',
    items: [
      {
        kind: 'condition' as const,
        id: `legacy-exit-${index}`,
        text: rule,
      },
    ],
  }))

  return [...entryBlocks, ...exitBlocks]
}

function extractExecuteMeta(specDesc: DisplayLogicGraphSpecDesc | null, fallbackMeta: BuildDisplayLogicGraphInput['fallbackMeta']) {
  const lockedParams = specDesc?.lockedParams ?? {}
  const market = specDesc?.canonicalSpec?.market ?? specDesc?.market ?? {}
  const exchange = pickString(lockedParams.exchange, market.exchange, fallbackMeta?.exchange)
  const symbol = pickString(lockedParams.symbol, market.symbol, fallbackMeta?.symbol)
  const timeframe = pickString(
    lockedParams.timeframe,
    market.timeframe,
    (() => {
      const timeframes = asStringList(market.timeframes)
      if (timeframes.length > 0) return timeframes.join('/')
      return null
    })(),
    fallbackMeta?.timeframe,
    fallbackMeta?.baseTimeframe,
  )
  const positionPct = toPositionPct(
    lockedParams.positionPct
      ?? lockedParams.position
      ?? fallbackMeta?.positionPct,
  )
  const marketType = humanizeMarketType(
    pickString(lockedParams.marketType, market.marketType, fallbackMeta?.marketType),
  )
  const executionTags = [
    ...asStringList(lockedParams.executionTags),
    ...(fallbackMeta?.executionTags ?? []),
  ]

  return {
    exchange,
    symbol,
    timeframe,
    positionPct,
    marketType,
    executionTags,
  }
}

function buildConditionBlock(rule: DisplayLogicGraphRule, index: number): DisplayBlock {
  const blockType: DisplayBlockType = index === 0
    ? 'IF'
    : rule.join === 'OR'
      ? 'OR_THEN'
      : 'AND_AT_THEN'

  const conditionItem: DisplayConditionItem = {
    kind: 'condition',
    id: rule.id ? `condition-${rule.id}` : `condition-${index}`,
    text: formatConditionText(rule.condition),
  }

  const actionItems: DisplayActionItem[] = (rule.actions ?? [])
    .map((action, actionIndex) => {
      const text = formatActionText(action)
      return {
        kind: 'action',
        id: rule.id ? `action-${rule.id}-${actionIndex}` : `action-${index}-${actionIndex}`,
        text,
      } satisfies DisplayActionItem
    })

  return {
    type: blockType,
    items: [conditionItem, ...actionItems],
  }
}

function buildExecuteBlock(meta: ReturnType<typeof extractExecuteMeta>): DisplayBlock {
  const items: DisplayExecuteItem[] = []

  if (meta.exchange) {
    items.push({
      kind: 'execute',
      id: 'execute-exchange',
      key: 'exchange',
      value: meta.exchange,
      text: `交易所: ${meta.exchange.toUpperCase()}`,
    })
  }

  if (meta.symbol) {
    items.push({
      kind: 'execute',
      id: 'execute-symbol',
      key: 'symbol',
      value: meta.symbol,
      text: `标的: ${meta.symbol}`,
    })
  }

  if (meta.timeframe) {
    items.push({
      kind: 'execute',
      id: 'execute-timeframe',
      key: 'timeframe',
      value: meta.timeframe,
      text: `周期: ${meta.timeframe}`,
    })
  }

  if (meta.positionPct) {
    items.push({
      kind: 'execute',
      id: 'execute-position',
      key: 'positionPct',
      value: meta.positionPct,
      text: `仓位: ${meta.positionPct}`,
    })
  }

  if (meta.marketType) {
    items.push({
      kind: 'execute',
      id: 'execute-market-type',
      key: 'marketType',
      value: meta.marketType,
      text: `市场: ${meta.marketType}`,
    })
  }

  meta.executionTags.forEach((tag, index) => {
    items.push({
      kind: 'execute',
      id: `execute-tag-${index}`,
      key: 'executionTag',
      value: tag,
      text: `标签: ${tag}`,
    })
  })

  if (items.length === 0) {
    items.push({
      kind: 'execute',
      id: 'execute-fallback',
      key: 'fallback',
      text: '执行信息待补充',
    })
  }

  return {
    type: 'EXECUTE',
    items,
  }
}

export function buildDisplayLogicGraphFromCodegenSpec(input: BuildDisplayLogicGraphInput | null | undefined): DisplayLogicGraph {
  const nextInput = input ?? {}
  const specDesc = isRecord(nextInput.specDesc) ? nextInput.specDesc as DisplayLogicGraphSpecDesc : null
  const rules = extractRules(specDesc)
  const nonRiskRules = rules.filter(rule => rule.phase !== 'risk')
  const blocks = nonRiskRules.length > 0
    ? nonRiskRules.map((rule, index) => buildConditionBlock(rule, index))
    : buildLegacyRuleBlocks(specDesc)
  const executeMeta = extractExecuteMeta(specDesc, nextInput.fallbackMeta)
  const executeBlock = buildExecuteBlock(executeMeta)
  const riskSummaries = [
    ...rules
      .filter(rule => rule.phase === 'risk')
      .map(buildRiskSummaryText)
      .filter((item): item is string => Boolean(item)),
    ...buildLegacyRiskSummaryTexts(specDesc),
  ]

  riskSummaries.forEach((text, index) => {
    executeBlock.items.push({
      kind: 'execute',
      id: `execute-risk-${index}`,
      key: 'risk',
      value: text,
      text,
    })
  })

  return {
    blocks: [
      ...blocks,
      executeBlock,
    ],
  }
}
