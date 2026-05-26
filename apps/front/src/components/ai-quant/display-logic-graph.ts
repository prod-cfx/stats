import {
  formatSizing,
  normalizeSizingFromCanonicalValue,
  type QuantSizing,
} from '@/app/[lng]/ai-quant/semantic-sizing'

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
  kind?: string
  key?: string
  text?: string
  op?: string
  value?: unknown
  params?: Record<string, unknown>
  left?: DisplayExpressionOperand
  right?: DisplayExpressionOperand
  children?: DisplayLogicGraphCondition[]
}

type DisplayExpressionOperand =
  | { kind?: 'position'; field?: unknown; side?: unknown }
  | { kind?: 'account'; field?: unknown }
  | { kind?: 'constant'; value?: unknown; unit?: unknown }
  | { kind?: 'series' | 'indicator'; [key: string]: unknown }

interface DisplayLogicGraphAction {
  type?: string
  key?: string
  kind?: string
  params?: Record<string, unknown>
  sizing?: {
    mode?: string
    value?: unknown
    asset?: unknown
  }
}

interface DisplayLogicGraphEffectsByRole {
  actions?: unknown[]
  risks?: unknown[]
  positions?: unknown[]
  orchestration?: unknown[]
  programs?: unknown[]
}

interface DisplayLogicGraphRule {
  id?: string
  phase?: string
  join?: 'AND' | 'OR'
  condition?: DisplayLogicGraphCondition
  actions?: DisplayLogicGraphAction[]
  effects?: unknown
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
  displayLogicGraph?: unknown
  rules?: DisplayLogicGraphRule[]
  entryRules?: unknown
  exitRules?: unknown
  riskRules?: unknown
  lockedParams?: Record<string, unknown>
  canonicalSpec?: {
    market?: DisplayLogicGraphMarket
    sizing?: unknown
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
    sizing?: QuantSizing
    positionSizing?: string
    marketType?: string
    executionTags?: string[]
  }
}

export type DisplayLogicGraphLocale = 'zh' | 'en'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeGraphSizingInput(value: unknown): unknown {
  if (!isRecord(value)) return value
  const rawMode = typeof value.mode === 'string' ? value.mode.trim().toLowerCase().replace(/[\s-]+/g, '_') : ''
  const mode = (() => {
    switch (rawMode) {
      case 'fixed_ratio':
        return 'RATIO'
      case 'fixed_quote':
        return 'QUOTE'
      case 'fixed_qty':
      case 'fixed_quantity':
        return 'QTY'
      default:
        return null
    }
  })()

  return mode ? { ...value, mode } : value
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function isDisplayBlockType(value: unknown): value is DisplayBlockType {
  return value === 'IF' || value === 'AND_AT_THEN' || value === 'OR_THEN' || value === 'EXECUTE'
}

function normalizeServerDisplayLogicGraph(value: unknown): DisplayLogicGraph | null {
  if (!isRecord(value) || !Array.isArray(value.blocks)) return null
  const blocks: DisplayBlock[] = []
  let hasRuleBlock = false
  for (const block of value.blocks) {
    if (!isRecord(block) || !isDisplayBlockType(block.type) || !Array.isArray(block.items)) return null
    const items: DisplayBlock['items'] = []
    for (const item of block.items) {
      if (!isRecord(item)) return null
      const id = asString(item.id)
      const text = asString(item.text)
      if (!id || !text) return null
      if (item.kind === 'condition') {
        items.push({ kind: 'condition', id, text })
        continue
      }
      if (item.kind === 'action') {
        items.push({ kind: 'action', id, text })
        continue
      }
      if (item.kind === 'execute') {
        const key = asString(item.key)
        if (!key) return null
        const valueText = asString(item.value)
        items.push(valueText ? { kind: 'execute', id, key, value: valueText, text } : { kind: 'execute', id, key, text })
        continue
      }
      return null
    }
    if (block.type !== 'EXECUTE' && items.some(item => item.kind === 'condition' || item.kind === 'action')) {
      hasRuleBlock = true
    }
    blocks.push({ type: block.type, items })
  }
  return blocks.length > 0 && hasRuleBlock ? { blocks } : null
}

function hasServerRuleBlocks(graph: DisplayLogicGraph | null): graph is DisplayLogicGraph {
  return Boolean(graph?.blocks.some(block =>
    block.type !== 'EXECUTE' && block.items.some(item => item.kind === 'condition' || item.kind === 'action'),
  ))
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

function formatStopLossCondition(condition: DisplayLogicGraphCondition): string {
  const rawValue = typeof condition.value === 'number' && Number.isFinite(condition.value)
    ? condition.value
    : condition.params?.valuePct
  const percent = formatPercent(rawValue)
  if (!percent) return '止损条件'
  const basis = pickString(condition.params?.basis)
  if (basis === 'entry_avg_price') {
    return `止损：价格相对开仓均价下跌${percent}%`
  }
  if (basis === 'position_pnl') {
    return `止损：持仓收益下跌${percent}%`
  }
  return `止损：价格下跌${percent}%`
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
  const period = formatNumber(condition.params?.period)
  const stdDev = formatNumber(condition.params?.stdDev)
  const suffix = period && stdDev ? `（${period}, ${stdDev}）` : ''
  switch (condition.key) {
    case 'bollinger.upper_break':
      return `价格向上突破布林带上轨${suffix}`
    case 'bollinger.lower_break':
      return `价格向下突破布林带下轨${suffix}`
    case 'bollinger.middle_revert':
      return period ? `价格回到布林带中轨（MA${period}）` : '价格回到布林带中轨'
    case 'bollinger.bars_outside': {
      const bars = formatNumber(condition.value) ?? '3'
      return `价格连续 ${bars} 根 K 线在布林带外`
    }
    default:
      return '布林带条件'
  }
}

function formatRsiCondition(condition: DisplayLogicGraphCondition): string {
  const threshold = formatNumber(condition.value ?? condition.params?.threshold ?? condition.params?.thresholdValue)
  const period = formatNumber(condition.params?.period)
  const label = period ? `RSI${period}` : 'RSI'
  switch (condition.key) {
    case 'rsi.threshold_lte':
    case 'rsi.lte':
      return threshold ? `${label} 低于或等于 ${threshold}` : `${label} 低于阈值`
    case 'rsi.threshold_gte':
    case 'rsi.gte':
      return threshold ? `${label} 高于或等于 ${threshold}` : `${label} 高于阈值`
    case 'rsi.cross_over':
      return threshold ? `${label} 上穿 ${threshold}` : `${label} 上穿阈值`
    case 'rsi.cross_under':
      return threshold ? `${label} 下穿 ${threshold}` : `${label} 下穿阈值`
    default:
      return 'RSI 条件'
  }
}

function formatMacdCondition(condition: DisplayLogicGraphCondition): string {
  const fast = formatNumber(condition.params?.fastPeriod)
  const slow = formatNumber(condition.params?.slowPeriod)
  const signal = formatNumber(condition.params?.signalPeriod)
  const label = fast && slow && signal ? `MACD ${fast}/${slow}/${signal}` : 'MACD'
  switch (condition.key) {
    case 'macd.golden_cross':
      return `${label} 金叉`
    case 'macd.death_cross':
      return `${label} 死叉`
    default:
      return 'MACD 条件'
  }
}

function formatMovingAverageCondition(condition: DisplayLogicGraphCondition): string {
  const indicator = pickString(condition.params?.indicator)?.toUpperCase() ?? 'MA'
  const fast = formatNumber(condition.params?.fastPeriod)
  const slow = formatNumber(condition.params?.slowPeriod)
  const fastLabel = fast ? `${indicator}${fast}` : `${indicator}短周期`
  const slowLabel = slow ? `${indicator}${slow}` : `${indicator}长周期`
  switch (condition.key) {
    case 'ma.golden_cross':
      return `${fastLabel} 上穿 ${slowLabel}`
    case 'ma.death_cross':
      return `${fastLabel} 下穿 ${slowLabel}`
    default:
      return '均线条件'
  }
}

function formatRangePositionCondition(condition: DisplayLogicGraphCondition): string {
  const period = formatNumber(condition.params?.period ?? condition.params?.lookbackBars)
  const threshold = formatPercent(condition.value ?? condition.params?.thresholdPct)
  const side = condition.key === 'price.range_position_lte' ? '下' : '上'
  const prefix = period ? `最近 ${period} 根 K 线` : '最近区间'
  return threshold ? `${prefix}区间${side} ${threshold}%` : `${prefix}区间${side}方`
}

function formatBreakoutCondition(condition: DisplayLogicGraphCondition): string {
  const period = formatNumber(condition.params?.period)
  const buffer = formatNumber(condition.params?.bufferPct)
  const direction = condition.key === 'breakout.channel_high_break'
    ? '突破'
    : '跌回'
  const target = condition.key === 'breakout.channel_high_break'
    ? '高点'
    : '低点'
  const periodText = period ? `最近 ${period} 根 K 线${target}` : `近期${target}`
  return [
    `${direction}${periodText}`,
    buffer ? `突破缓冲 ${buffer}%` : null,
  ].filter((item): item is string => Boolean(item)).join('，')
}

function formatIndicatorLevelCondition(condition: DisplayLogicGraphCondition): string {
  const indicator = pickString(condition.params?.indicator)?.toUpperCase() ?? 'MA'
  const period = formatNumber(condition.params?.['reference.period'] ?? condition.params?.period)
  const timeframe = pickString(condition.params?.timeframe)
  const relation = condition.key === 'indicator.below' ? '低于' : '在'
  const suffix = condition.key === 'indicator.below' ? '' : ' 上方'
  const indicatorText = `${indicator}${period ?? ''}`
  return [timeframe, `价格${relation} ${indicatorText}${suffix}`].filter(Boolean).join(' ')
}

function formatCanonicalAtomCondition(condition: DisplayLogicGraphCondition): string {
  const atomCondition = { ...condition, kind: undefined }
  switch (condition.key) {
    case 'indicator.above':
    case 'indicator.below':
      return formatIndicatorLevelCondition(condition)
    case 'price.rolling_extrema_breakout': {
      const lookbackBars = formatNumber(condition.params?.lookbackBars)
      const timeframe = pickString(condition.params?.timeframe)
      const extrema = pickString(condition.params?.extrema) === 'low' ? '最低价' : '最高价'
      const event = pickString(condition.params?.event)
      const direction = event === 'breakout_down' || extrema === '最低价' ? '跌破' : '突破'
      const range = lookbackBars ? `过去 ${lookbackBars} 根 K 线${extrema}` : `过去区间${extrema}`
      return [timeframe, `${direction}${range}`].filter(Boolean).join(' ')
    }
    case 'volume.relative_average': {
      const lookbackBars = formatNumber(condition.params?.lookbackBars)
      const multiplier = formatNumber(condition.params?.multiplier)
      const comparator = pickString(condition.params?.comparator)
      const direction = comparator === 'lt' || comparator === 'lte' ? '低于' : '高于'
      const inclusive = comparator === 'gte' || comparator === 'lte' ? '或等于' : ''
      if (!lookbackBars || !multiplier) return '成交量条件'
      return `成交量${direction}${inclusive}过去 ${lookbackBars} 根均量的 ${multiplier} 倍`
    }
    case 'condition.sequence': {
      const sequenceKind = pickString(condition.params?.sequenceKind)
      const lookbackWindow = pickString(condition.params?.lookbackWindow)
      const lookbackBars = formatNumber(condition.params?.lookbackBars)
      const windowText = lookbackWindow ? `（${lookbackWindow} 内）` : lookbackBars ? `（${lookbackBars} 根 K 线内）` : ''
      const memoryKey = pickString(condition.params?.memoryKey)
      const memoryText = memoryKey ? `，记录位 ${memoryKey}` : ''
      if (sequenceKind === 'breakout_retest') return `突破后回踩确认${windowText}${memoryText}`
      if (sequenceKind === 'pullback_reclaim') return `回踩关键位后重新站上${windowText}${memoryText}`
      return `序列条件${windowText}${memoryText}`
    }
    case 'risk.atr_multiple_stop': {
      const multiple = formatNumber(condition.params?.multiple)
      return multiple ? `${multiple} 倍 ATR 止损` : 'ATR 止损'
    }
    case 'risk.atr_multiple_take_profit': {
      const multiple = formatNumber(condition.params?.multiple)
      return multiple ? `${multiple} 倍 ATR 止盈` : 'ATR 止盈'
    }
    case 'risk.stop_loss_pct':
      return formatStopLossCondition(condition)
    case 'risk.remembered_level_stop': {
      const levelKey = pickString(condition.params?.levelKey)
      return levelKey ? `跌破记录位 ${levelKey} 止损` : '记录位止损'
    }
    default:
      return formatConditionText(atomCondition)
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
  if (typeof condition.text === 'string' && condition.text.trim()) return condition.text.trim()
  if (condition.kind === 'AND' || condition.kind === 'OR') {
    const joiner = condition.kind === 'AND' ? '，且' : ' 或 '
    const children = Array.isArray(condition.children) ? condition.children : []
    const texts = children.map(child => formatConditionText(child)).filter(text => text.length > 0)
    return texts.length > 0 ? texts.join(joiner) : '条件待补充'
  }
  if (condition.kind === 'atom') {
    return formatCanonicalAtomCondition(condition)
  }
  if (condition.kind === 'expression') {
    return formatExpressionCondition(condition)
  }

  switch (condition.key) {
    case 'execution.on_start':
      return '启动时执行'
    case 'price.change_pct':
      return formatPriceChangeCondition(condition)
    case 'position_gain_pct':
      return formatPositionGainCondition(condition)
    case 'risk.take_profit_pct':
    case 'position_profit_pct':
      return formatTakeProfitCondition(condition)
    case 'risk.stop_loss_pct':
      return formatStopLossCondition(condition)
    case 'position_loss_pct':
      return formatPositionLossCondition(condition)
    case 'bollinger.upper_break':
    case 'bollinger.lower_break':
    case 'bollinger.middle_revert':
    case 'bollinger.bars_outside':
      return formatBollingerCondition(condition)
    case 'ma.golden_cross':
    case 'ma.death_cross':
      return formatMovingAverageCondition(condition)
    case 'rsi.threshold_lte':
    case 'rsi.threshold_gte':
    case 'rsi.lte':
    case 'rsi.gte':
    case 'rsi.cross_over':
    case 'rsi.cross_under':
      return formatRsiCondition(condition)
    case 'macd.golden_cross':
    case 'macd.death_cross':
      return formatMacdCondition(condition)
    case 'price.range_position_lte':
    case 'price.range_position_gte':
      return formatRangePositionCondition(condition)
    case 'breakout.channel_high_break':
    case 'breakout.channel_low_break':
      return formatBreakoutCondition(condition)
    case 'grid.range_rebalance':
      return formatGridCondition(condition)
    case 'risk.condition_expression':
      return formatExpressionCondition(condition.params?.condition as DisplayLogicGraphCondition | undefined)
    default:
      return '不支持的条件，待补充'
  }
}

function isPlaceholderConditionText(text: string): boolean {
  return text === '策略条件'
    || text === '条件待补充'
    || text === '不支持的条件，待补充'
}

function hasOnlyPlaceholderRuleConditions(rules: readonly DisplayLogicGraphRule[]): boolean {
  if (rules.length === 0) return false
  return rules.every((rule) => {
    const text = formatConditionText(rule.condition)
    return isPlaceholderConditionText(text)
  })
}

function formatExpressionCondition(condition: DisplayLogicGraphCondition | undefined): string {
  if (!condition || !condition.op) return '风险表达式已识别'
  const left = formatExpressionOperand(condition.left)
  const right = formatExpressionOperand(condition.right)
  const op = formatExpressionOperator(condition.op)
  return [left, op, right].filter(Boolean).join(' ')
}

function formatExpressionOperand(operand: DisplayExpressionOperand | undefined): string {
  if (!operand || typeof operand !== 'object') return ''
  if (operand.kind === 'position') {
    if (operand.field === 'pnl_pct') return '持仓收益率'
    if (operand.field === 'avg_price') return '持仓均价'
    if (operand.field === 'bars_held') return '持仓 K 线数'
    return '持仓状态'
  }
  if (operand.kind === 'account') {
    if (operand.field === 'drawdown_pct') return '账户回撤'
    return '账户指标'
  }
  if (operand.kind === 'constant') {
    const value = formatNumber(operand.value)
    return operand.unit === 'percent' && value ? `${value}%` : value ?? String(operand.value ?? '')
  }
  return ''
}

function formatExpressionOperator(op: string): string {
  switch (op) {
    case 'LTE':
      return '低于或等于'
    case 'LT':
      return '低于'
    case 'GTE':
      return '高于或等于'
    case 'GT':
      return '高于'
    case 'EQ':
      return '等于'
    case 'CROSS_OVER':
      return '上穿'
    case 'CROSS_UNDER':
      return '下穿'
    default:
      return op
  }
}

function formatActionVerb(action: DisplayLogicGraphAction): string {
  switch (action.key) {
    case 'action.open_long':
      return '开多'
    case 'action.open_short':
      return '开空'
    case 'action.close_long':
      return '平多'
    case 'action.close_short':
      return '平空'
    case 'action.add_position':
      return '加仓'
    case 'action.reduce_position':
      return '减仓'
    default:
      break
  }

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

function formatActionText(action: DisplayLogicGraphAction, fallbackSymbol?: string): string {
  const verb = formatActionVerb(action)
  if (!action.sizing) return verb
  return `${verb} ${formatSizing(
    normalizeSizingFromCanonicalValue(normalizeGraphSizingInput(action.sizing), fallbackSymbol ?? '', 10),
    fallbackSymbol,
  )}`
}

function toPositionPct(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const pct = value <= 1 ? value * 100 : value
  return `${formatNumber(pct)}%`
}

function formatSizingAmount(sizing: DisplayLogicGraphAction['sizing'] | null | undefined): string | null {
  if (!sizing || typeof sizing.value !== 'number' || !Number.isFinite(sizing.value)) return null
  const value = formatNumber(sizing.value)
  if (!value) return null

  if (sizing.mode === 'RATIO') {
    return toPositionPct(sizing.value)
  }

  if (sizing.mode === 'QUOTE' || sizing.mode === 'QTY') {
    const asset = asString(sizing.asset)
    return asset ? `${value} ${asset}` : value
  }

  return null
}

function asDisplayGraphSizing(value: unknown): DisplayLogicGraphAction['sizing'] | null {
  return value && typeof value === 'object'
    ? value as DisplayLogicGraphAction['sizing']
    : null
}

function normalizeActionFromAtomEffect(effect: unknown): DisplayLogicGraphAction | null {
  if (!isRecord(effect)) return null
  const key = asString(effect.key)
  const params = isRecord(effect.params) ? effect.params : {}
  const sizing = asDisplayGraphSizing(params.sizing)
    ?? (typeof params.sizePct === 'number' ? { mode: 'RATIO', value: params.sizePct } : null)
    ?? (typeof params.quoteAmount === 'number' ? { mode: 'QUOTE', value: params.quoteAmount, asset: params.quoteAsset } : null)

  switch (key) {
    case 'action.open_long':
      return { key, type: 'OPEN_LONG', params, ...(sizing ? { sizing } : {}) }
    case 'action.open_short':
      return { key, type: 'OPEN_SHORT', params, ...(sizing ? { sizing } : {}) }
    case 'action.close_long':
      return { key, type: 'CLOSE_LONG', params, ...(sizing ? { sizing } : {}) }
    case 'action.close_short':
      return { key, type: 'CLOSE_SHORT', params, ...(sizing ? { sizing } : {}) }
    case 'action.add_position':
      return { key, type: 'OPEN_LONG', params, ...(sizing ? { sizing } : {}) }
    case 'action.reduce_position':
      return { key, type: 'REDUCE_LONG', params, ...(sizing ? { sizing } : {}) }
    default:
      return null
  }
}

function normalizeDisplayAction(value: unknown): DisplayLogicGraphAction | null {
  if (!isRecord(value)) return null
  const action = value as DisplayLogicGraphAction
  if (asString(action.type)) return action
  return normalizeActionFromAtomEffect(action)
}

function isEffectsByRole(value: unknown): value is DisplayLogicGraphEffectsByRole {
  return isRecord(value) && (
    Array.isArray(value.actions)
    || Array.isArray(value.risks)
    || Array.isArray(value.positions)
    || Array.isArray(value.orchestration)
    || Array.isArray(value.programs)
  )
}

function extractDisplayActions(rule: DisplayLogicGraphRule): DisplayLogicGraphAction[] {
  const legacyActions = Array.isArray(rule.actions)
    ? rule.actions.map(normalizeDisplayAction).filter((action): action is DisplayLogicGraphAction => Boolean(action))
    : []
  if (legacyActions.length > 0) return legacyActions

  if (isEffectsByRole(rule.effects)) {
    return (rule.effects.actions ?? [])
      .map(normalizeDisplayAction)
      .filter((action): action is DisplayLogicGraphAction => Boolean(action))
  }

  if (Array.isArray(rule.effects)) {
    return rule.effects
      .map(normalizeDisplayAction)
      .filter((action): action is DisplayLogicGraphAction => Boolean(action))
  }

  return []
}

function hasTypedRiskEffects(rule: DisplayLogicGraphRule): boolean {
  if (isEffectsByRole(rule.effects)) {
    return (rule.effects.risks ?? [])
      .some(effect => isRecord(effect) && asString(effect.key)?.startsWith('risk.'))
  }

  if (Array.isArray(rule.effects)) {
    return rule.effects
      .some(effect => isRecord(effect) && asString(effect.key)?.startsWith('risk.'))
  }

  return false
}

function isRiskDisplayRule(rule: DisplayLogicGraphRule): boolean {
  return rule.phase === 'risk'
    || Boolean(rule.condition?.key?.startsWith('risk.'))
    || hasTypedRiskEffects(rule)
}

function extractPositionSizing(specDesc: DisplayLogicGraphSpecDesc | null, fallbackPositionPct: unknown): string | null {
  const canonicalSizing = formatSizingAmount(asDisplayGraphSizing(specDesc?.canonicalSpec?.sizing))
  if (canonicalSizing) return canonicalSizing

  const actionSizing = extractRules(specDesc)
    .flatMap(rule => extractDisplayActions(rule))
    .map(action => formatSizingAmount(action.sizing))
    .find((item): item is string => Boolean(item))
  if (actionSizing) return actionSizing

  return toPositionPct(fallbackPositionPct)
}

function extractRules(specDesc: DisplayLogicGraphSpecDesc | null): DisplayLogicGraphRule[] {
  return Array.isArray(specDesc?.rules) ? specDesc.rules : []
}

function buildRiskSummaryText(rule: DisplayLogicGraphRule, fallbackSymbol?: string): string | null {
  const conditionText = formatConditionText(rule.condition)
  const actionText = extractDisplayActions(rule)
    .map(action => formatActionText(action, fallbackSymbol))
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
  const positionSizing = extractPositionSizing(
    specDesc,
    lockedParams.positionPct
      ?? lockedParams.position
      ?? fallbackMeta?.positionPct,
  )
  const sizingInput = specDesc?.canonicalSpec?.sizing
    ?? lockedParams.sizing
    ?? extractRules(specDesc)
      .flatMap(rule => extractDisplayActions(rule))
      .map(action => action.sizing)
      .find(sizing => sizing && typeof sizing === 'object')
    ?? fallbackMeta?.sizing
  const sizing = sizingInput
    ? formatSizing(
        normalizeSizingFromCanonicalValue(
          normalizeGraphSizingInput(sizingInput),
          symbol ?? '',
          typeof fallbackMeta?.positionPct === 'number' ? fallbackMeta.positionPct : 10,
        ),
        symbol ?? undefined,
      )
    : null
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
    positionSizing: sizing ?? positionSizing ?? fallbackMeta?.positionSizing ?? null,
    marketType,
    executionTags,
  }
}

function buildConditionBlock(rule: DisplayLogicGraphRule, index: number, fallbackSymbol?: string): DisplayBlock {
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

  const actionItems: DisplayActionItem[] = extractDisplayActions(rule)
    .map((action, actionIndex) => {
      const text = formatActionText(action, fallbackSymbol)
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

  if (meta.positionSizing) {
    items.push({
      kind: 'execute',
      id: 'execute-position',
      key: 'positionSizing',
      value: meta.positionSizing,
      text: `仓位: ${meta.positionSizing}`,
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
  const serverDisplayGraph = normalizeServerDisplayLogicGraph(specDesc?.displayLogicGraph)
  if (rules.length === 0) {
    if (serverDisplayGraph) return serverDisplayGraph
  }
  if (hasOnlyPlaceholderRuleConditions(rules) && hasServerRuleBlocks(serverDisplayGraph)) {
    return serverDisplayGraph
  }
  const nonRiskRules = rules.filter(rule => !isRiskDisplayRule(rule))
  const executeMeta = extractExecuteMeta(specDesc, nextInput.fallbackMeta)
  const executeBlock = buildExecuteBlock(executeMeta)
  const fallbackSymbol = executeMeta.symbol ?? nextInput.fallbackMeta?.symbol
  const blocks = nonRiskRules.length > 0
    ? nonRiskRules.map((rule, index) => buildConditionBlock(rule, index, fallbackSymbol ?? undefined))
    : buildLegacyRuleBlocks(specDesc)
  const riskSummaries = [
    ...rules
      .filter(rule => isRiskDisplayRule(rule))
      .map(rule => ({
        key: rule.condition?.key ?? 'risk',
        text: buildRiskSummaryText(rule, fallbackSymbol ?? undefined),
      }))
      .filter((item): item is { key: string, text: string } => Boolean(item.text)),
    ...buildLegacyRiskSummaryTexts(specDesc).map(text => ({ key: 'risk', text })),
  ]

  riskSummaries.forEach((summary, index) => {
    executeBlock.items.push({
      kind: 'execute',
      id: `execute-risk-${index}`,
      key: summary.key,
      value: summary.text,
      text: summary.text,
    })
  })

  return {
    blocks: [
      ...blocks,
      executeBlock,
    ],
  }
}

function localizeMarketTypeText(value: string): string {
  switch (value) {
    case '现货':
      return 'Spot'
    case '永续':
      return 'Perpetual'
    default:
      return value
  }
}

function localizeDisplayText(text: string): string {
  let next = text

  next = next
    .replace(/^交易所:\s*/u, 'Exchange: ')
    .replace(/^标的:\s*/u, 'Symbol: ')
    .replace(/^周期:\s*/u, 'Timeframe: ')
    .replace(/^仓位:\s*/u, 'Position: ')
    .replace(/^标签:\s*/u, 'Tag: ')
    .replace(/^执行信息待补充$/u, 'Execution info pending')
    .replace(/^条件待补充$/u, 'Condition pending')
    .replace(/^等待策略规则补充$/u, 'Waiting for strategy rule details')
    .replace(/^不支持的条件，待补充$/u, 'Unsupported condition, pending details')
    .replace(/^未支持的动作，待补充$/u, 'Unsupported action, pending details')
    .replace(/^启动时执行$/u, 'Execute on start')
    .replace(/^市场:\s*(.+)$/u, (_match, value: string) => `Market: ${localizeMarketTypeText(value)}`)

  next = next
    .replace(/风控:/gu, 'Risk:')
    .replace(/开多/gu, 'Open long')
    .replace(/开空/gu, 'Open short')
    .replace(/平多/gu, 'Close long')
    .replace(/平空/gu, 'Close short')
    .replace(/平仓/gu, 'Close position')
    .replace(/减仓/gu, 'Reduce position')

  next = next
    .replace(/上穿阈值/gu, 'crosses above threshold')
    .replace(/下穿阈值/gu, 'crosses below threshold')
    .replace(/高于或等于/gu, 'greater than or equal to')
    .replace(/低于或等于/gu, 'less than or equal to')
    .replace(/高于阈值/gu, 'above threshold')
    .replace(/低于阈值/gu, 'below threshold')
    .replace(/上穿/gu, 'crosses above')
    .replace(/下穿/gu, 'crosses below')
    .replace(/高于/gu, 'above')
    .replace(/低于/gu, 'below')
    .replace(/等于/gu, 'equals')

  next = next
    .replace(/相对前收盘/gu, 'vs previous close ')
    .replace(/相对开仓均价盈利达到/gu, 'profit vs entry average price reaches')
    .replace(/相对开仓均价/gu, 'vs entry average price ')
    .replace(/相对持仓收益/gu, 'vs position P&L ')
    .replace(/持仓收益率/gu, 'Position P&L rate')
    .replace(/持仓收益达到/gu, 'Position P&L reaches')
    .replace(/盈利达到/gu, 'Profit reaches')
    .replace(/亏损达到/gu, 'Loss reaches')
    .replace(/亏损条件/gu, 'Loss condition')
    .replace(/止盈条件/gu, 'Take-profit condition')
    .replace(/价格变化条件待补充/gu, 'Price-change condition pending')
    .replace(/价格变化百分比/gu, 'Price-change percentage')
    .replace(/上涨/gu, 'rises')
    .replace(/下跌/gu, 'drops')
    .replace(/ 内/gu, ' within')

  next = next
    .replace(/价格向上突破布林带上轨/gu, 'Price breaks above Bollinger upper band')
    .replace(/价格向下突破布林带下轨/gu, 'Price breaks below Bollinger lower band')
    .replace(/价格回到布林带中轨/gu, 'Price returns to Bollinger middle band')
    .replace(/价格连续 ([\d.]+) 根 K 线在布林带外/gu, 'Price stays outside Bollinger Bands for $1 candles')
    .replace(/布林带条件/gu, 'Bollinger condition')
    .replace(/均线条件/gu, 'Moving-average condition')
    .replace(/金叉/gu, 'golden cross')
    .replace(/死叉/gu, 'death cross')

  next = next
    .replace(/最近 ([\d.]+) 根 K 线区间下 ([\d.]+)%/gu, 'lower $2% of the last $1-candle range')
    .replace(/最近 ([\d.]+) 根 K 线区间上 ([\d.]+)%/gu, 'upper $2% of the last $1-candle range')
    .replace(/最近区间下方/gu, 'lower part of the recent range')
    .replace(/最近区间上方/gu, 'upper part of the recent range')
    .replace(/突破最近 ([\d.]+) 根 K 线高点/gu, 'breaks the high of the last $1 candles')
    .replace(/跌回最近 ([\d.]+) 根 K 线低点/gu, 'falls back below the low of the last $1 candles')
    .replace(/突破缓冲 ([\d.]+)%/gu, 'breakout buffer $1%')
    .replace(/突破近期高点/gu, 'breaks the recent high')
    .replace(/跌回近期低点/gu, 'falls back below the recent low')

  next = next
    .replace(/价格在 ([A-Z]+[\d.]*) 上方/gu, 'Price is above $1')
    .replace(/价格低于 ([A-Z]+[\d.]*)/gu, 'Price is below $1')
    .replace(/成交量高于或等于过去 ([\d.]+) 根均量的 ([\d.]+) 倍/gu, 'Volume is at least $2x the last $1-candle average')
    .replace(/成交量高于过去 ([\d.]+) 根均量的 ([\d.]+) 倍/gu, 'Volume is above $2x the last $1-candle average')
    .replace(/成交量低于或等于过去 ([\d.]+) 根均量的 ([\d.]+) 倍/gu, 'Volume is at most $2x the last $1-candle average')
    .replace(/成交量低于过去 ([\d.]+) 根均量的 ([\d.]+) 倍/gu, 'Volume is below $2x the last $1-candle average')
    .replace(/成交量条件/gu, 'Volume condition')

  next = next
    .replace(/网格区间/gu, 'Grid range')
    .replace(/级别/gu, 'timeframe')
    .replace(/步长/gu, 'step')
    .replace(/共 ([\d.]+) 格/gu, '$1 levels')
    .replace(/倍 ATR 止损/gu, 'x ATR stop-loss')
    .replace(/倍 ATR 止盈/gu, 'x ATR take-profit')
    .replace(/ATR 止损/gu, 'ATR stop-loss')
    .replace(/ATR 止盈/gu, 'ATR take-profit')
    .replace(/记录位止损/gu, 'remembered-level stop-loss')
    .replace(/跌破记录位 ([\w.-]+) 止损/gu, 'breaks remembered level $1 stop-loss')

  return next.replace(/\s{2,}/gu, ' ').trim()
}

export function localizeDisplayLogicGraph(
  graph: DisplayLogicGraph,
  locale: DisplayLogicGraphLocale,
): DisplayLogicGraph {
  if (locale !== 'en') return graph
  return {
    blocks: graph.blocks.map(block => ({
      ...block,
      items: block.items.map(item => ({
        ...item,
        text: localizeDisplayText(item.text),
        ...(item.kind === 'execute' && item.value
          ? { value: item.value }
          : {}),
      })),
    })),
  }
}
