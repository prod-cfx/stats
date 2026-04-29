import { Injectable } from '@nestjs/common'
import type { StrategyRuleBasis } from '../types/strategy-logic-snapshot'
import type { SemanticExpression, SemanticExpressionOperand, SemanticExpressionOperator, SemanticSlotState, SemanticState } from '../types/semantic-state'
import { normalizeLegacyPositionSizing, validateSemanticPositionContract } from './strategy-semantic-contracts'

export interface SemanticConversationView {
  summary: string
  triggerSummary: string
  riskSummary: string
  positionSummary: string
  executionContext: {
    exchange: string | null
    symbol: string | null
    marketType: string | null
    timeframe: string | null
  }
  hasDeterministicSemantics: boolean
  recommendationSignals: {
    hasShortIntent: boolean
    hasLongIntent: boolean
    hasBidirectionalIntent: boolean
    hasGridIntent: boolean
  }
  inferredDefaults: {
    inferredKeys: Array<'risk.stopLossBasis' | 'risk.takeProfitBasis'>
    stopLossBasis: StrategyRuleBasis['kind'] | null
    takeProfitBasis: StrategyRuleBasis['kind'] | null
  }
}

export type SemanticDisplayBlockType = 'IF' | 'AND_AT_THEN' | 'OR_THEN' | 'EXECUTE'

export interface SemanticDisplayGraphBaseItem {
  id: string
  text: string
}

export interface SemanticDisplayConditionItem extends SemanticDisplayGraphBaseItem {
  kind: 'condition'
}

export interface SemanticDisplayActionItem extends SemanticDisplayGraphBaseItem {
  kind: 'action'
}

export interface SemanticDisplayExecuteItem extends SemanticDisplayGraphBaseItem {
  kind: 'execute'
  key: string
  value?: string
}

export type SemanticDisplayLogicGraphItem =
  | SemanticDisplayConditionItem
  | SemanticDisplayActionItem
  | SemanticDisplayExecuteItem

export interface SemanticDisplayLogicGraphBlock {
  type: SemanticDisplayBlockType
  items: SemanticDisplayLogicGraphItem[]
}

export interface SemanticDisplayLogicGraph {
  blocks: SemanticDisplayLogicGraphBlock[]
}

@Injectable()
export class SemanticStateProjectionService {
  buildConversationView(state: SemanticState): SemanticConversationView {
    const deterministicTriggers = this.filterDeterministicTriggers(state.triggers)
    const deterministicRisk = this.filterDeterministicRisk(state.risk)
    const deterministicActions = this.filterDeterministicActions(state.actions)
    const deterministicSignals = this.buildRecommendationSignals({
      actions: deterministicActions,
      triggers: deterministicTriggers,
      families: state.families,
    })
    const triggerSummary = this.buildTriggerSummary(deterministicTriggers, false)
    const riskSummary = this.buildRiskSummary(deterministicRisk)
    const positionSummary = this.buildPositionSummary(state.position)
    const executionContext = this.buildExecutionContext(state.contextSlots)
    const inferredDefaults = this.buildInferredDefaults(deterministicRisk)
    const hasDeterministicSemantics = this.hasDeterministicSemantics({
      triggers: deterministicTriggers,
      actions: deterministicActions,
      risk: deterministicRisk,
      position: state.position,
      hasGridIntent: deterministicSignals.hasGridIntent,
    })
    const summaryItems = [triggerSummary, riskSummary, positionSummary]
      .filter(item => item.length > 0)

    return {
      summary: summaryItems.length > 0 ? summaryItems.join('；') : '已识别部分条件，但仍未完整。',
      triggerSummary,
      riskSummary,
      positionSummary,
      executionContext,
      hasDeterministicSemantics,
      recommendationSignals: {
        hasShortIntent: deterministicSignals.hasShortIntent,
        hasLongIntent: deterministicSignals.hasLongIntent,
        hasBidirectionalIntent: deterministicSignals.hasBidirectionalIntent,
        hasGridIntent: deterministicSignals.hasGridIntent,
      },
      inferredDefaults,
    }
  }

  buildDisplayLogicGraph(state: SemanticState): SemanticDisplayLogicGraph {
    const triggers = this.filterDeterministicTriggers(state.triggers)
    const actions = this.filterDeterministicActions(state.actions)
    const entryGateText = this.buildDisplayGateText(triggers)
    const ruleBlocks = triggers
      .filter(trigger => trigger.phase === 'entry' || trigger.phase === 'exit')
      .map((trigger, index) => this.buildDisplayRuleBlock({
        trigger,
        blockType: index === 0 ? 'IF' : 'AND_AT_THEN',
        gateText: trigger.phase === 'entry' ? entryGateText : null,
        actions,
        position: state.position,
      }))
      .filter((block): block is SemanticDisplayLogicGraphBlock => Boolean(block))

    return {
      blocks: [
        ...ruleBlocks,
        this.buildDisplayExecuteBlock(state),
      ],
    }
  }

  buildClarificationView(state: SemanticState): {
    summary: string
    nextQuestion: string | null
  } {
    const triggerSummary = this.buildTriggerSummary(state.triggers, true)

    const nextSlot = this.findNextOpenSlot(state)

    return {
      summary: triggerSummary || '已识别部分条件，但仍未完整。',
      nextQuestion: nextSlot?.questionHint ?? null,
    }
  }

  private buildDisplayRuleBlock(input: {
    trigger: SemanticState['triggers'][number]
    blockType: SemanticDisplayBlockType
    gateText: string | null
    actions: SemanticState['actions']
    position: SemanticState['position']
  }): SemanticDisplayLogicGraphBlock | null {
    const conditionText = this.buildDisplayConditionText(input.trigger, input.gateText)
    if (!conditionText) {
      return null
    }

    return {
      type: input.blockType,
      items: [
        {
          kind: 'condition',
          id: `condition-${input.trigger.id}`,
          text: conditionText,
        },
        ...this.buildDisplayActionItems(input.trigger, input.actions, input.position),
      ],
    }
  }

  private buildDisplayConditionText(
    trigger: SemanticState['triggers'][number],
    gateText: string | null,
  ): string {
    const conditionText = trigger.key === 'condition.expression'
      ? this.formatSemanticExpression(trigger.params.expression)
      : this.formatDisplayTriggerCondition(trigger)
    if (!conditionText) {
      return ''
    }

    return gateText ? `${conditionText}，且${gateText}` : conditionText
  }

  private formatDisplayTriggerCondition(trigger: SemanticState['triggers'][number]): string {
    const summary = this.buildTriggerSummary([trigger], true)
    return summary.replace(/^(入场|出场|条件)：/u, '').replace(/时(?:做多开仓|做空开仓|双向开仓|买入|平多|平空|双向平仓|卖出平仓)$/u, '')
  }

  private buildDisplayGateText(triggers: SemanticState['triggers']): string | null {
    const gateTexts = triggers
      .filter(trigger => trigger.phase === 'gate')
      .map(trigger => this.buildDisplayConditionText(trigger, null))
      .filter(text => text.length > 0)
    return gateTexts.length > 0 ? gateTexts.join('，且') : null
  }

  private buildDisplayActionItems(
    trigger: SemanticState['triggers'][number],
    actions: SemanticState['actions'],
    position: SemanticState['position'],
  ): SemanticDisplayActionItem[] {
    const actionKey = trigger.phase === 'entry'
      ? this.pickDisplayActionKey(actions, ['open_long', 'open_short'])
      : this.pickDisplayActionKey(actions, ['close_long', 'close_short', 'reduce_long', 'reduce_short'])
    if (!actionKey) {
      return []
    }

    const text = this.formatDisplayActionText(actionKey, position)
    return text
      ? [{
          kind: 'action',
          id: `action-${trigger.id}-${actionKey}`,
          text,
        }]
      : []
  }

  private pickDisplayActionKey(
    actions: SemanticState['actions'],
    keys: string[],
  ): string | null {
    return actions.find(action => keys.includes(action.key))?.key ?? null
  }

  private formatDisplayActionText(
    actionKey: string,
    position: SemanticState['position'],
  ): string {
    const sizingText = this.buildDisplayPositionSizingValue(position)

    if (actionKey === 'open_long') return sizingText ? `开多 ${sizingText}` : '开多'
    if (actionKey === 'open_short') return sizingText ? `开空 ${sizingText}` : '开空'
    if (actionKey === 'close_long' || actionKey === 'reduce_long') return '平多'
    if (actionKey === 'close_short' || actionKey === 'reduce_short') return '平空'
    return ''
  }

  private buildDisplayExecuteBlock(state: SemanticState): SemanticDisplayLogicGraphBlock {
    const executionContext = this.buildExecutionContext(state.contextSlots)
    const positionSizing = this.buildDisplayPositionSizingValue(state.position)
    const marketType = this.formatDisplayMarketType(executionContext.marketType)
    const riskTexts = this.buildRiskSummary(this.filterDeterministicRisk(state.risk))
      .split('；')
      .filter(text => text.length > 0)
    const items: SemanticDisplayExecuteItem[] = []

    if (executionContext.exchange) {
      items.push({
        kind: 'execute',
        id: 'execute-exchange',
        key: 'exchange',
        value: executionContext.exchange,
        text: `交易所: ${executionContext.exchange.toUpperCase()}`,
      })
    }

    if (executionContext.symbol) {
      items.push({
        kind: 'execute',
        id: 'execute-symbol',
        key: 'symbol',
        value: executionContext.symbol,
        text: `标的: ${executionContext.symbol}`,
      })
    }

    if (executionContext.timeframe) {
      items.push({
        kind: 'execute',
        id: 'execute-timeframe',
        key: 'timeframe',
        value: executionContext.timeframe,
        text: `周期: ${executionContext.timeframe}`,
      })
    }

    if (positionSizing) {
      items.push({
        kind: 'execute',
        id: 'execute-position',
        key: 'positionSizing',
        value: positionSizing,
        text: `仓位: ${positionSizing}`,
      })
    }

    if (marketType) {
      items.push({
        kind: 'execute',
        id: 'execute-market-type',
        key: 'marketType',
        value: marketType,
        text: `市场: ${marketType}`,
      })
    }

    riskTexts.forEach((riskText, index) => {
      const text = `风控: ${riskText} -> 平仓`
      items.push({
        kind: 'execute',
        id: `execute-risk-${index}`,
        key: 'risk',
        value: riskText,
        text,
      })
    })

    return {
      type: 'EXECUTE',
      items,
    }
  }

  private buildDisplayPositionSizingValue(position: SemanticState['position']): string | null {
    const summary = this.buildPositionSummary(position)
    return summary ? summary.replace(/^仓位：/u, '') : null
  }

  private formatDisplayMarketType(marketType: string | null): string | null {
    if (!marketType) {
      return null
    }

    const normalized = marketType.toLowerCase()
    if (normalized === 'perp' || normalized === 'perpetual' || normalized === 'swap') {
      return '永续'
    }
    if (normalized === 'spot') {
      return '现货'
    }
    if (normalized === 'futures' || normalized === 'future') {
      return '交割'
    }
    return marketType
  }

  private buildExecutionContext(slots: {
    exchange: SemanticSlotState | null
    symbol: SemanticSlotState | null
    marketType: SemanticSlotState | null
    timeframe: SemanticSlotState | null
  }): {
    exchange: string | null
    symbol: string | null
    marketType: string | null
    timeframe: string | null
  } {
    return {
      exchange: this.readExecutionContextValue(slots.exchange),
      symbol: this.readExecutionContextValue(slots.symbol),
      marketType: this.readExecutionContextValue(slots.marketType),
      timeframe: this.readExecutionContextValue(slots.timeframe),
    }
  }

  private readExecutionContextValue(slot: SemanticSlotState | null): string | null {
    if (!slot || slot.status !== 'locked') {
      return null
    }

    const value = typeof slot.value === 'string' ? slot.value.trim() : ''
    return value ? value : null
  }

  private buildTriggerSummary(triggers: SemanticState['triggers'], includeSuperseded: boolean): string {
    const sourceTriggers = includeSuperseded
      ? [...triggers]
      : triggers.filter(trigger => trigger.status === 'locked')

    return sourceTriggers
      .sort((left, right) => this.compareTriggers(left, right))
      .map((trigger) => {
        if (trigger.key === 'grid.range_rebalance') {
          const lower = this.readGridRangeValue(trigger.params, 'lower')
          const upper = this.readGridRangeValue(trigger.params, 'upper')
          const stepPct = trigger.params.stepPct
          return [
            '入场：区间网格',
            typeof lower === 'number' && typeof upper === 'number' ? `${lower}-${upper}` : '区间待补充',
            typeof stepPct === 'number' ? `步长 ${this.formatPercent(stepPct)}%` : '步长待补充',
          ].join(' ')
        }

        if (trigger.key === 'execution.on_start') {
          return trigger.phase === 'entry'
            ? '入场：立即开始时市价执行一次'
            : '出场：立即开始时市价执行一次'
        }

        if (trigger.key === 'condition.expression') {
          const condition = this.formatSemanticExpression(trigger.params.expression)
          if (!condition) return ''
          const phase = trigger.phase === 'entry'
            ? '入场'
            : trigger.phase === 'exit'
              ? '出场'
              : '条件'
          return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
        }

        if (trigger.key === 'price.percent_change') {
          const basis = typeof trigger.params.basis === 'string' ? trigger.params.basis : 'prev_close'
          const basisLabel = basis === 'entry_avg_price' || basis === 'position_pnl'
            ? '开仓均价'
            : '前收盘'
          const direction = typeof trigger.params.valuePct === 'number' && trigger.params.valuePct > 0 ? '上涨' : '下跌'
          const pctText = typeof trigger.params.valuePct === 'number' ? `${this.formatPercent(Math.abs(trigger.params.valuePct))}%` : '阈值待补充'
          return `${trigger.phase === 'entry' ? '入场' : '出场'}：价格相对${basisLabel}${direction}${pctText}`
        }

        if (trigger.key === 'indicator.above' && trigger.params['reference.period']) {
          const condition = `突破 MA${trigger.params['reference.period']}`
          return `入场：${condition}${this.formatActionSuffix(trigger, condition)}`
        }

        if (trigger.key === 'indicator.below' && trigger.params['reference.period']) {
          const condition = `跌破 MA${trigger.params['reference.period']}`
          return `出场：${condition}${this.formatActionSuffix(trigger, condition)}`
        }

        if (trigger.key === 'indicator.cross_over' || trigger.key === 'indicator.cross_under') {
          return this.formatCrossTriggerSummary(trigger)
        }

        if (trigger.key === 'oscillator.rsi_gte' || trigger.key === 'oscillator.rsi_lte') {
          const period = typeof trigger.params.period === 'number' ? trigger.params.period : 14
          const value = typeof trigger.params.value === 'number' ? trigger.params.value : null
          const direction = trigger.key === 'oscillator.rsi_gte' ? '高于或等于' : '低于或等于'
          const phase = trigger.phase === 'entry' ? '入场' : '出场'
          const condition = value === null ? `RSI${period} ${direction}阈值` : `RSI${period} ${direction} ${value}`
          return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
        }

        if (trigger.key === 'price.range_position_lte' || trigger.key === 'price.range_position_gte') {
          const lookbackBars = typeof trigger.params.lookbackBars === 'number' ? trigger.params.lookbackBars : null
          const thresholdPct = typeof trigger.params.thresholdPct === 'number' ? trigger.params.thresholdPct : null
          const side = trigger.key === 'price.range_position_lte' ? '下' : '上'
          const phase = trigger.phase === 'entry' ? '入场' : '出场'
          const rangeText = lookbackBars === null ? '最近区间' : `最近 ${lookbackBars} 根 K 线区间`
          const thresholdText = thresholdPct === null ? '阈值待补充' : `${this.formatPercent(thresholdPct)}%`
          const condition = `价格位于${rangeText}${side} ${thresholdText}`
          return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
        }

        if (trigger.key === 'price.breakout_up' || trigger.key === 'price.breakout_down') {
          const period = typeof trigger.params.period === 'number' ? trigger.params.period : null
          const bufferPct = typeof trigger.params.bufferPct === 'number' ? trigger.params.bufferPct : null
          const phase = trigger.phase === 'entry' ? '入场' : '出场'
          const direction = trigger.key === 'price.breakout_up' ? '突破' : '跌回'
          const target = trigger.key === 'price.breakout_up' ? '高点' : '低点'
          const periodText = period === null ? `近期${target}` : `最近 ${period} 根 K 线${target}`
          const bufferText = bufferPct === null ? '' : `，突破缓冲 ${this.formatNumber(bufferPct)}%`
          const condition = `价格${direction}${periodText}${bufferText}`
          return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
        }

        if (
          (trigger.key === 'bollinger.touch_upper' || trigger.key === 'bollinger.touch_lower' || trigger.key === 'bollinger.touch_middle')
          && trigger.params.period !== undefined
        ) {
          const period = typeof trigger.params.period === 'number' ? trigger.params.period : null
          const stdDev = typeof trigger.params.stdDev === 'number' ? trigger.params.stdDev : null
          const band = trigger.key === 'bollinger.touch_upper'
            ? '上轨'
            : trigger.key === 'bollinger.touch_lower'
              ? '下轨'
              : '中轨'
          const condition = period !== null && stdDev !== null
            ? `触及布林带 ${this.formatNumber(period)} 周期 ${this.formatNumber(stdDev)} 倍标准差${band}`
            : `触及 ${period === null ? '周期待补充' : `MA${this.formatNumber(period)}`} 的布林带${band}`
          return `${trigger.phase === 'entry' ? '入场' : '出场'}：${condition}${this.formatActionSuffix(trigger, condition)}`
        }

        return trigger.key
      })
      .filter(item => item.length > 0)
      .join('；')
  }

  private readGridRangeValue(
    params: Record<string, unknown>,
    side: 'lower' | 'upper',
  ): number | null {
    const flatKeys = side === 'lower'
      ? ['rangeMin', 'rangeLower']
      : ['rangeMax', 'rangeUpper']
    for (const key of flatKeys) {
      const value = params[key]
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }
    }

    const range = params.range
    if (range && typeof range === 'object' && !Array.isArray(range)) {
      const nested = (range as Record<string, unknown>)[side]
      if (typeof nested === 'number' && Number.isFinite(nested)) {
        return nested
      }
    }

    return null
  }

  private formatCrossTriggerSummary(trigger: SemanticState['triggers'][number]): string {
    const indicator = typeof trigger.params.indicator === 'string'
      ? trigger.params.indicator.trim().toLowerCase()
      : ''
    const phase = trigger.phase === 'entry' ? '入场' : '出场'
    const direction = trigger.key === 'indicator.cross_over' ? '上穿' : '下穿'

    if (indicator === 'macd') {
      const fast = typeof trigger.params.fastPeriod === 'number' ? trigger.params.fastPeriod : 12
      const slow = typeof trigger.params.slowPeriod === 'number' ? trigger.params.slowPeriod : 26
      const signal = typeof trigger.params.signalPeriod === 'number' ? trigger.params.signalPeriod : 9
      const condition = `MACD ${fast}/${slow}/${signal} ${direction === '上穿' ? '金叉' : '死叉'}`
      return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
    }

    if (indicator === 'rsi') {
      const period = typeof trigger.params.period === 'number' ? trigger.params.period : 14
      const value = typeof trigger.params.value === 'number' ? trigger.params.value : null
      const condition = value === null ? `RSI${period} ${direction}阈值` : `RSI${period} ${direction} ${value}`
      return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
    }

    const label = indicator === 'ema'
      ? 'EMA'
      : 'MA'
    const fast = typeof trigger.params.fastPeriod === 'number' ? trigger.params.fastPeriod : null
    const slow = typeof trigger.params.slowPeriod === 'number' ? trigger.params.slowPeriod : null
    const fastLabel = fast === null ? `${label}短周期` : `${label}${fast}`
    const slowLabel = slow === null ? `${label}长周期` : `${label}${slow}`
    const condition = `${fastLabel} ${direction} ${slowLabel}`
    return `${phase}：${condition}${this.formatActionSuffix(trigger, condition)}`
  }

  private formatActionSuffix(trigger: SemanticState['triggers'][number], conditionText: string): string {
    const evidenceText = typeof trigger.evidence?.text === 'string' ? trigger.evidence.text : ''
    const separator = /[A-Za-z0-9%]$/u.test(conditionText) ? ' ' : ''
    if (trigger.phase === 'entry') {
      if (/买入|买进/u.test(evidenceText) && !/做多|开多/u.test(evidenceText)) {
        return `${separator}时买入`
      }
      if (trigger.sideScope === 'short') return `${separator}时做空开仓`
      if (trigger.sideScope === 'both') return `${separator}时双向开仓`
      return `${separator}时做多开仓`
    }

    if (trigger.phase === 'exit') {
      if (/卖出/u.test(evidenceText) && !/平多|平空/u.test(evidenceText)) {
        return `${separator}时卖出平仓`
      }
      if (trigger.sideScope === 'short') return `${separator}时平空`
      if (trigger.sideScope === 'both') return `${separator}时双向平仓`
      return `${separator}时平多`
    }

    return ''
  }

  private formatSemanticExpression(expression: unknown): string {
    if (!this.isSemanticExpression(expression)) {
      return ''
    }

    if (expression.kind === 'predicate') {
      const left = this.formatSemanticExpressionOperand(expression.left)
      const right = this.formatSemanticExpressionOperand(expression.right)
      const operator = this.formatSemanticExpressionOperator(expression.op)
      if (!left || !right || !operator) {
        return ''
      }
      return `${left}${operator}${right}`
    }

    const children = expression.children
      .map(child => this.formatSemanticExpression(child))
      .filter(item => item.length > 0)
    if (children.length === 0) {
      return ''
    }
    if (expression.kind === 'NOT') {
      return `非（${children[0]}）`
    }
    return children.join(expression.kind === 'AND' ? '且' : '或')
  }

  private formatSemanticExpressionOperand(operand: SemanticExpressionOperand): string {
    if (operand.kind === 'series' && operand.source === 'bar') {
      const fieldLabels: Record<typeof operand.field, string> = {
        open: '开盘价',
        high: '最高价',
        low: '最低价',
        close: '收盘价',
      }
      const offset = typeof operand.offsetBars === 'number' && operand.offsetBars > 0
        ? `前 ${operand.offsetBars} 根`
        : ''
      return `${offset}${fieldLabels[operand.field]}`
    }

    if (operand.kind === 'indicator') {
      const name = operand.name.toUpperCase()
      const period = typeof operand.params.period === 'number' ? `${operand.params.period}` : ''
      const output = operand.output && operand.output !== 'value' ? ` ${operand.output}` : ''
      return `${name}${period}${output}`
    }

    if (operand.kind === 'position') {
      const fieldLabels: Record<typeof operand.field, string> = {
        avg_price: '持仓均价',
        pnl_pct: '持仓收益率',
        bars_held: '持仓 K 线数',
        has_position: operand.side === 'short' ? '持有空仓' : operand.side === 'both' ? '持有仓位' : '持有多仓',
      }
      return fieldLabels[operand.field]
    }

    if (operand.kind === 'constant') {
      if (operand.unit === 'percent') return `${operand.value}%`
      return String(operand.value)
    }

    return ''
  }

  private formatSemanticExpressionOperator(op: SemanticExpressionOperator): string {
    switch (op) {
      case 'GT':
        return '高于'
      case 'GTE':
        return '高于或等于'
      case 'LT':
        return '低于'
      case 'LTE':
        return '低于或等于'
      case 'EQ':
        return '等于'
      case 'CROSS_OVER':
        return '上穿'
      case 'CROSS_UNDER':
        return '下穿'
      default:
        return ''
    }
  }

  private isSemanticExpression(expression: unknown): expression is SemanticExpression {
    if (!expression || typeof expression !== 'object') {
      return false
    }
    const kind = (expression as { kind?: unknown }).kind
    if (kind === 'predicate') {
      const predicate = expression as { op?: unknown; left?: unknown; right?: unknown }
      return typeof predicate.op === 'string'
        && this.isSemanticExpressionOperand(predicate.left)
        && this.isSemanticExpressionOperand(predicate.right)
    }
    if (kind === 'AND' || kind === 'OR' || kind === 'NOT') {
      return Array.isArray((expression as { children?: unknown }).children)
        && (expression as { children: unknown[] }).children.every(child => this.isSemanticExpression(child))
    }
    return false
  }

  private isSemanticExpressionOperand(operand: unknown): operand is SemanticExpressionOperand {
    return !!operand
      && typeof operand === 'object'
      && typeof (operand as { kind?: unknown }).kind === 'string'
  }

  private buildRiskSummary(riskItems: SemanticState['risk']): string {
    return riskItems
      .filter(risk => risk.status === 'locked')
      .sort((left, right) => this.compareRiskAtoms(left, right))
      .map((risk) => {
        const valuePct = risk.params.valuePct
        if (typeof valuePct !== 'number' || !Number.isFinite(valuePct) || valuePct <= 0) {
          return ''
        }

        if (risk.key === 'risk.stop_loss_pct') {
          const basis = this.describeRiskBasis(risk.params.basis)
          return `止损：价格相对${basis}下跌${this.formatPercent(valuePct)}% 强制平仓`
        }

        if (risk.key === 'risk.take_profit_pct') {
          const basis = this.describeRiskBasis(risk.params.basis)
          return `止盈：价格相对${basis}上涨${this.formatPercent(valuePct)}% 平仓`
        }

        if (risk.key === 'risk.max_drawdown_pct') {
          return `回撤：下跌${this.formatPercent(valuePct)}% 平仓`
        }

        if (risk.key === 'risk.max_single_loss_pct') {
          return `单笔止损：下跌${this.formatPercent(valuePct)}%`
        }

        return ''
      })
      .filter(item => item.length > 0)
      .join('；')
  }

  private describeRiskBasis(rawBasis: unknown): string {
    if (rawBasis === 'entry_avg_price' || rawBasis === 'position_pnl') {
      return '入场均价'
    }

    if (rawBasis === 'peak_position_pnl' || rawBasis === 'peak_equity') {
      return '持仓收益高点'
    }

    if (rawBasis === 'upper_band') {
      return '布林带上轨'
    }

    if (rawBasis === 'lower_band') {
      return '布林带下轨'
    }

    if (rawBasis === 'middle_band') {
      return '布林带中轨'
    }

    return '前收盘'
  }

  private buildPositionSummary(position: SemanticState['position']): string {
    if (!this.hasValidLockedPosition(position)) {
      return ''
    }

    const sizing = position.sizing ?? normalizeLegacyPositionSizing(position)
    if (!sizing) {
      return ''
    }

    if (sizing.kind === 'ratio') {
      const ratioValue = sizing.unit === 'percent' ? sizing.value : sizing.value * 100
      return `仓位：${this.formatPercent(ratioValue)}%`
    }

    if (sizing.kind === 'quote' || sizing.kind === 'base') {
      return `仓位：${this.formatNumber(sizing.value)} ${sizing.asset}`
    }

    return ''
  }

  private hasValidLockedPosition(position: SemanticState['position']): position is SemanticState['position'] & { status: 'locked' } {
    return position?.status === 'locked'
      && validateSemanticPositionContract(position).ok
  }

  private buildRecommendationSignals(input: {
    actions: SemanticState['actions']
    triggers: SemanticState['triggers']
    families: SemanticState['families']
  }): {
    hasShortIntent: boolean
    hasLongIntent: boolean
    hasBidirectionalIntent: boolean
    hasGridIntent: boolean
  } {
    const hasGridFamily = input.families.includes('grid.range_rebalance')
      || input.families.some(family => family.includes('grid'))
    const hasGridTrigger = input.triggers.some(trigger =>
      trigger.key.includes('grid')
    )
    const hasGridIntent = hasGridTrigger
      || (hasGridFamily && (input.actions.length > 0 || input.triggers.length > 0))

    const hasLongIntentFromActions = input.actions
      .some(action => action.key === 'open_long' || action.key === 'close_long' || action.key === 'reduce_long')

    const hasShortIntentFromActions = input.actions
      .some(action => action.key === 'open_short' || action.key === 'close_short' || action.key === 'reduce_short')

    const hasLongIntentFromTrigger = input.triggers
      .some(trigger => trigger.sideScope === 'long')

    const hasShortIntentFromTrigger = input.triggers
      .some(trigger => trigger.sideScope === 'short')

    const hasBidirectionalFromSideScope = input.triggers
      .some(trigger => trigger.sideScope === 'both')

    const hasBidirectionalGridSideMode = input.triggers
      .some(trigger => trigger.key === 'grid.range_rebalance' && trigger.params.sideMode === 'bidirectional')

    const hasLongIntent = hasLongIntentFromActions || hasLongIntentFromTrigger
    const hasShortIntent = hasShortIntentFromActions || hasShortIntentFromTrigger
    const hasBidirectionalIntent = (hasLongIntent && hasShortIntent)
      || hasBidirectionalFromSideScope
      || hasBidirectionalGridSideMode

    return {
      hasShortIntent,
      hasLongIntent,
      hasBidirectionalIntent,
      hasGridIntent,
    }
  }

  private hasDeterministicSemantics(
    input: {
      triggers: SemanticState['triggers']
      actions: SemanticState['actions']
      risk: SemanticState['risk']
      position: SemanticState['position']
      hasGridIntent: boolean
    },
  ): boolean {
    return input.triggers.length > 0
      || input.actions.length > 0
      || input.risk.length > 0
      || this.hasValidLockedPosition(input.position)
      || input.hasGridIntent
  }

  private compareTriggers(left: SemanticState['triggers'][number], right: SemanticState['triggers'][number]): number {
    const phaseOrder: Record<'entry' | 'exit' | 'risk' | 'gate', number> = {
      entry: 0,
      exit: 1,
      risk: 2,
      gate: 3,
    }
    if (left.phase !== right.phase) {
      return phaseOrder[left.phase] - phaseOrder[right.phase]
    }

    if (left.key !== right.key) {
      return left.key.localeCompare(right.key)
    }

    return left.id.localeCompare(right.id)
  }

  private compareRiskAtoms(
    left: SemanticState['risk'][number],
    right: SemanticState['risk'][number],
  ): number {
    if (left.key !== right.key) {
      return left.key.localeCompare(right.key)
    }

    return left.id.localeCompare(right.id)
  }

  private filterDeterministicAtoms<T extends {
    id: string
    status: 'open' | 'locked' | 'superseded'
    supersedes?: string[]
  }>(atoms: T[]): T[] {
    const supersededIds = new Set(
      atoms
        .flatMap(atom => atom.supersedes ?? [])
        .filter(supersededId => typeof supersededId === 'string'),
    )

    return atoms
      .filter(atom => atom.status === 'locked')
      .filter(atom => !supersededIds.has(atom.id))
      .sort((left, right) => this.compareDeterministicAtoms(left, right))
  }

  private filterDeterministicRisk(riskItems: SemanticState['risk']): SemanticState['risk'] {
    return this.filterDeterministicAtoms(riskItems)
  }

  private filterDeterministicTriggers(triggers: SemanticState['triggers']): SemanticState['triggers'] {
    return this.filterDeterministicAtoms(triggers)
      .sort((left, right) => this.compareTriggers(left, right))
  }

  private filterDeterministicActions(actions: SemanticState['actions']): SemanticState['actions'] {
    return this.filterDeterministicAtoms(actions)
      .sort((left, right) => this.compareActionAtoms(left, right))
  }

  private formatPercent(value: number): string {
    const normalized = Number.parseFloat(Number(value).toFixed(6))
    return `${normalized}`
  }

  private formatNumber(value: number): string {
    const normalized = Number.parseFloat(Number(value).toFixed(6))
    return `${normalized}`
  }

  private buildInferredDefaults(riskItems: SemanticState['risk']): {
    inferredKeys: Array<'risk.stopLossBasis' | 'risk.takeProfitBasis'>
    stopLossBasis: StrategyRuleBasis['kind'] | null
    takeProfitBasis: StrategyRuleBasis['kind'] | null
  } {
    const inferred: {
      inferredKeys: Array<'risk.stopLossBasis' | 'risk.takeProfitBasis'>
      stopLossBasis: StrategyRuleBasis['kind'] | null
      takeProfitBasis: StrategyRuleBasis['kind'] | null
    } = {
      inferredKeys: [],
      stopLossBasis: null,
      takeProfitBasis: null,
    }

    for (const risk of riskItems) {
      const basis = this.readStrategyRuleBasisKind(risk.params.basis)
      if (!basis || risk.params.basisSource !== 'system_default') {
        continue
      }

      if (risk.key === 'risk.stop_loss_pct' && !inferred.inferredKeys.includes('risk.stopLossBasis')) {
        inferred.inferredKeys.push('risk.stopLossBasis')
        inferred.stopLossBasis = basis
      }

      if (risk.key === 'risk.take_profit_pct' && !inferred.inferredKeys.includes('risk.takeProfitBasis')) {
        inferred.inferredKeys.push('risk.takeProfitBasis')
        inferred.takeProfitBasis = basis
      }
    }

    return inferred
  }

  private readStrategyRuleBasisKind(value: unknown): StrategyRuleBasis['kind'] | null {
    if (
      value === 'prev_close'
      || value === 'entry_avg_price'
      || value === 'position_pnl'
      || value === 'peak_equity'
      || value === 'peak_position_pnl'
      || value === 'upper_band'
      || value === 'lower_band'
      || value === 'middle_band'
      || value === 'last_high'
      || value === 'last_low'
    ) {
      return value
    }
    return null
  }

  private findNextOpenSlot(state: SemanticState): SemanticSlotState | null {
    const triggerPhaseOrder: Array<'entry' | 'exit' | 'risk' | 'gate'> = ['entry', 'exit', 'risk', 'gate']
    const openTriggerSlots = triggerPhaseOrder.flatMap(phase =>
      state.triggers
        .filter(trigger => trigger.phase === phase && trigger.status !== 'superseded')
        .flatMap(trigger => trigger.openSlots)
        .filter(slot => slot.status === 'open'),
    )
    const behaviorTriggerSlot = openTriggerSlots.find(slot =>
      slot.priority === 'behavior' || slot.slotKey === 'regimeDefinition',
    )
    if (behaviorTriggerSlot) {
      return behaviorTriggerSlot
    }

    const firstBlockingTriggerSlot = openTriggerSlots[0] ?? null
    if (firstBlockingTriggerSlot) {
      return firstBlockingTriggerSlot
    }

    const positionSlot = state.position?.openSlots?.find(slot => slot.status === 'open') ?? null
    if (positionSlot) {
      return positionSlot
    }

    const actionSlot = state.actions
      .flatMap(action => action.openSlots ?? [])
      .find(slot => slot.status === 'open')
    if (actionSlot) {
      return actionSlot
    }

    const riskSlot = state.risk
      .flatMap(risk => risk.openSlots)
      .find(slot => slot.status === 'open')
    if (riskSlot) {
      return riskSlot
    }

    return Object.values(state.contextSlots).find(slot => slot?.status === 'open') ?? null
  }

  private compareActionAtoms(left: SemanticState['actions'][number], right: SemanticState['actions'][number]): number {
    if (left.key !== right.key) {
      return left.key.localeCompare(right.key)
    }

    return left.id.localeCompare(right.id)
  }

  private compareDeterministicAtoms(
    left: {
      id: string
      status: 'open' | 'locked' | 'superseded'
      supersedes?: string[]
    },
    right: {
      id: string
      status: 'open' | 'locked' | 'superseded'
      supersedes?: string[]
    },
  ): number {
    return left.id.localeCompare(right.id)
  }
}
