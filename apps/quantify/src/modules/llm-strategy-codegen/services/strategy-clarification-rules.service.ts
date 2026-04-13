import type { ChecklistPayload } from '../types/codegen-checklist'
import type { StrategyClarificationItem, StrategyClarificationState } from '../types/strategy-clarification'
import { Injectable } from '@nestjs/common'
import { isEquivalentMarketScopeValue } from './market-scope-equivalence'
import { classifyPercentageRuleFamily } from './rule-family-default-semantics'

type ClarificationChecklistInput = ChecklistPayload

interface MarketScopeConflict {
  field: 'exchange' | 'marketType' | 'symbol' | 'timeframe'
  previous: string
  next: string
}

const LONG_DIRECTION_PATTERN = /做多|多单|开多|long|买入/u
const SHORT_DIRECTION_PATTERN = /做空|空单|开空|short|卖出/u
const UPPER_BAND_PATTERN = /(?:布林|bollinger).{0,8}(?:上轨|upper)|(?:上轨|upper).{0,8}(?:布林|bollinger)|突破.{0,8}(?:上轨|upper)/iu
const LOWER_BAND_PATTERN = /(?:布林|bollinger).{0,8}(?:下轨|lower)|(?:下轨|lower).{0,8}(?:布林|bollinger)|跌破.{0,8}(?:下轨|lower)|突破.{0,8}(?:下轨|lower)/iu
const PERCENTAGE_THRESHOLD_PATTERN = /\d+(?:\.\d+)?\s*%/u

@Injectable()
export class StrategyClarificationRulesService {
  detect(input: ClarificationChecklistInput): StrategyClarificationState {
    const entryDetection = this.detectEntryItems(input.entryRules ?? [])
    const items: StrategyClarificationItem[] = [
      ...this.detectRequiredRuleItems(input),
      ...entryDetection.items,
      ...this.detectMarketItems(
        input,
        entryDetection.hasShortEntry,
        entryDetection.hasActionUniquenessConflict,
      ),
      ...this.detectSizingItems(input.riskRules),
      ...this.detectBasisItems(input),
      ...this.detectRiskItems(input.riskRules ?? {}),
    ]

    if (items.length === 0) {
      return {
        status: 'CLEAR',
        items: [],
      }
    }

    return {
      status: 'NEEDS_CLARIFICATION',
      items,
    }
  }

  private detectEntryItems(entryRules: string[]): {
    items: StrategyClarificationItem[]
    hasActionUniquenessConflict: boolean
    hasShortEntry: boolean
  } {
    const items: StrategyClarificationItem[] = []
    let sideQuestionAdded = false
    let hasShortEntry = false
    let hasActionUniquenessConflict = false

    for (const [index, rawRule] of entryRules.entries()) {
      const rule = rawRule.trim()
      if (!rule) continue

      const hasLongDirection = LONG_DIRECTION_PATTERN.test(rule)
      const hasShortDirection = SHORT_DIRECTION_PATTERN.test(rule)
      if (hasShortDirection) {
        hasShortEntry = true
      }

      if (hasLongDirection && hasShortDirection) {
        hasActionUniquenessConflict = true
        items.push({
          key: `entry.action_uniqueness.${index + 1}`,
          ruleId: `entry-${index + 1}`,
          reason: 'missing_action_uniqueness',
          field: 'positionMode',
          allowedAnswers: ['long', 'short'],
          blocking: true,
          question: '这条入场规则同时包含做多和做空，请确认最终只保留哪个方向？',
          status: 'pending',
        })
        continue
      }

      if (sideQuestionAdded || hasLongDirection || hasShortDirection) continue

      if (UPPER_BAND_PATTERN.test(rule)) {
        items.push({
          key: `entry.side.${index + 1}`,
          ruleId: `entry-${index + 1}`,
          reason: 'missing_side_scope',
          field: 'positionMode',
          allowedAnswers: ['long', 'short'],
          blocking: true,
          question: '突破上轨时是只做空，还是也允许做多？',
          status: 'pending',
        })
        sideQuestionAdded = true
        continue
      }

      if (LOWER_BAND_PATTERN.test(rule)) {
        items.push({
          key: `entry.side.${index + 1}`,
          ruleId: `entry-${index + 1}`,
          reason: 'missing_side_scope',
          field: 'positionMode',
          allowedAnswers: ['long', 'short'],
          blocking: true,
          question: '跌破下轨时是只做多，还是也允许做空？',
          status: 'pending',
        })
        sideQuestionAdded = true
      }
    }

    return {
      items,
      hasActionUniquenessConflict,
      hasShortEntry,
    }
  }

  private detectMarketItems(
    input: ClarificationChecklistInput,
    hasShortEntry: boolean,
    hasActionUniquenessConflict: boolean,
  ): StrategyClarificationItem[] {
    if (hasActionUniquenessConflict) return []

    const conflicts = this.readMarketScopeConflicts(input.riskRules)
    if (conflicts.length > 0) {
      return conflicts.map((conflict) => ({
        key: `market.conflict.${conflict.field}`,
        reason: 'conflicting_market_scope',
        field: conflict.field,
        allowedAnswers: [conflict.previous, conflict.next],
        blocking: true,
        question: `当前会话里的${this.renderMarketFieldLabel(conflict.field)}存在冲突：之前是 ${conflict.previous}，本轮变成了 ${conflict.next}。请确认最终以哪个为准？`,
        status: 'pending',
      }))
    }

    const items: StrategyClarificationItem[] = []

    if (!this.hasPrimaryValue(input.symbols)) {
      items.push({
        key: 'market.symbol',
        reason: 'missing_symbol',
        field: 'symbol',
        blocking: true,
        question: '请确认策略交易标的（例如 BTCUSDT）。',
        status: 'pending',
      })
    }

    if (!this.hasPrimaryValue(input.timeframes)) {
      items.push({
        key: 'market.timeframe',
        reason: 'missing_timeframe',
        field: 'timeframe',
        blocking: true,
        question: '请确认策略主周期（例如 15m 或 1h）。',
        status: 'pending',
      })
    }

    const exchange = this.readExchange(input.riskRules)
    if (!exchange) {
      items.push({
        key: 'market.exchange',
        reason: 'missing_exchange',
        field: 'exchange',
        blocking: true,
        question: '请确认交易所（binance / okx / hyperliquid）。',
        status: 'pending',
      })
    }

    const marketType = this.readMarketType(input.riskRules)
    if (!marketType) {
      items.push({
        key: 'market.marketType',
        reason: 'missing_market_type',
        field: 'marketType',
        blocking: true,
        question: '该策略运行在现货还是合约市场？',
        status: 'pending',
      })
      return items
    }

    if (marketType === 'spot' && hasShortEntry) {
      items.push({
        key: 'market.marketType',
        reason: 'invalid_spot_short_combo',
        field: 'marketType',
        blocking: true,
        question: '现货市场不支持做空，请改为合约市场(perp)或移除做空规则。',
        status: 'pending',
      })
    }

    return items
  }

  private detectRequiredRuleItems(input: ClarificationChecklistInput): StrategyClarificationItem[] {
    const items: StrategyClarificationItem[] = []

    if (!this.hasAnyRule(input.entryRules)) {
      items.push({
        key: 'entry.rules',
        reason: 'missing_entry_rules',
        field: 'entryRules',
        blocking: true,
        question: '请补充至少一条明确的入场规则。',
        status: 'pending',
      })
    }

    if (!this.hasAnyRule(input.exitRules)) {
      items.push({
        key: 'exit.rules',
        reason: 'missing_exit_rules',
        field: 'exitRules',
        blocking: true,
        question: '请补充至少一条明确的出场规则。',
        status: 'pending',
      })
    }

    if (!this.hasStopLossRule(input)) {
      items.push({
        key: 'risk.stopLoss.rule',
        reason: 'missing_stop_loss_rule',
        field: 'riskRules.stopLossPct',
        blocking: true,
        question: '请确认止损规则（例如亏损 5% 止损）。',
        status: 'pending',
      })
    }

    if (!this.hasTakeProfitRule(input)) {
      items.push({
        key: 'risk.takeProfit.rule',
        reason: 'missing_take_profit_rule',
        field: 'riskRules.takeProfitPct',
        blocking: true,
        question: '请确认止盈规则（例如盈利 10% 止盈）。',
        status: 'pending',
      })
    }

    return items
  }

  private detectSizingItems(riskRules: Record<string, unknown> | undefined): StrategyClarificationItem[] {
    if (typeof riskRules?.positionPct === 'number') {
      return []
    }

    return [{
      key: 'sizing.positionPct',
      reason: 'missing_position_pct',
      field: 'riskRules.positionPct',
      blocking: true,
      question: '请确认单笔仓位百分比（例如 10%）。',
      status: 'pending',
    }]
  }

  private hasPrimaryValue(list: string[] | undefined): boolean {
    return typeof list?.[0] === 'string' && list[0].trim().length > 0
  }

  private hasAnyRule(list: string[] | undefined): boolean {
    return Array.isArray(list) && list.some(rule => typeof rule === 'string' && rule.trim().length > 0)
  }

  private readMarketType(riskRules: Record<string, unknown> | undefined): 'spot' | 'perp' | null {
    const raw = riskRules?.marketType
    if (typeof raw !== 'string') return null
    const normalized = raw.trim().toLowerCase()
    return normalized === 'spot' || normalized === 'perp' ? normalized : null
  }

  private readExchange(
    riskRules: Record<string, unknown> | undefined,
  ): 'binance' | 'okx' | 'hyperliquid' | null {
    const raw = riskRules?.exchange
    if (typeof raw !== 'string') return null
    const normalized = raw.trim().toLowerCase()
    if (normalized === 'binance' || normalized === 'okx' || normalized === 'hyperliquid') {
      return normalized
    }
    return null
  }

  private detectRiskItems(riskRules: Record<string, unknown>): StrategyClarificationItem[] {
    const riskTexts = Object.values(riskRules)
      .filter((value): value is string => typeof value === 'string' && !!value.trim())

    const hasAmbiguousEffect = riskTexts.some((text) => {
      const hasOutsideBand = /轨外|outside/iu.test(text)
      const hasThreeBars = /连续\s*3|3\s*根|三根/u.test(text)
      const hasCloseAction = /提前止损|止损|全平|全部平仓|清仓|强平|平仓|force\s*exit|force\s*close|close|exit/iu.test(text)
      const hasReduce = /减仓|reduce/iu.test(text)
      return hasOutsideBand && hasThreeBars && hasCloseAction && hasReduce
    })

    if (!hasAmbiguousEffect) return []

    return [{
      key: 'riskRules.earlyStop.action',
      reason: 'ambiguous_risk_effect',
      field: 'riskRules.earlyStop.action',
      allowedAnswers: ['reduce', 'close'],
      blocking: true,
      question: '轨外连续3根K线时，应执行减仓还是直接平仓？',
      status: 'pending',
    }]
  }

  private detectBasisItems(input: ClarificationChecklistInput): StrategyClarificationItem[] {
    const items: StrategyClarificationItem[] = []
    const exitRules = input.exitRules ?? []

    items.push(...this.detectRuleBasisItems(
      input.entryRules ?? [],
      input.entryRuleBases,
      'entry',
      'entryRules.basis',
    ))
    items.push(...this.detectRuleBasisItems(
      input.exitRules ?? [],
      input.exitRuleBases,
      'exit',
      'exitRules.basis',
    ))

    if (
      typeof input.riskRules?.stopLossPct === 'number'
      && !this.hasNamedBasis(input.riskRules?.stopLossBasis)
      && classifyPercentageRuleFamily({
        phase: 'risk',
        rule: `止损 ${input.riskRules.stopLossPct}%`,
      }).requiresUserBasis
      && !this.hasPendingExitBasisRule(exitRules, 'stopLoss')
    ) {
      items.push({
        key: 'risk.stopLoss.basis',
        reason: 'ambiguous_condition_basis',
        field: 'riskRules.stopLossBasis',
        blocking: true,
        question: '这里的止损百分比是按持仓亏损，还是按价格相对入场价计算？',
        status: 'pending',
      })
    }

    if (
      typeof input.riskRules?.takeProfitPct === 'number'
      && !this.hasNamedBasis(input.riskRules?.takeProfitBasis)
      && classifyPercentageRuleFamily({
        phase: 'risk',
        rule: `止盈 ${input.riskRules.takeProfitPct}%`,
      }).requiresUserBasis
      && !this.hasPendingExitBasisRule(exitRules, 'takeProfit')
    ) {
      items.push({
        key: 'risk.takeProfit.basis',
        reason: 'ambiguous_condition_basis',
        field: 'riskRules.takeProfitBasis',
        blocking: true,
        question: '这里的止盈百分比是按持仓收益率、价格相对入场价，还是别的基准？',
        status: 'pending',
      })
    }

    return items
  }

  private detectRuleBasisItems(
    rules: string[],
    bases: Record<string, unknown> | undefined,
    scope: 'entry' | 'exit',
    field: 'entryRules.basis' | 'exitRules.basis',
  ): StrategyClarificationItem[] {
    return rules.flatMap((rawRule, index) => {
      const rule = rawRule.trim()
      const semantics = classifyPercentageRuleFamily({ phase: scope, rule })
      if (!rule || !this.ruleNeedsBasis(rule, semantics.requiresUserBasis)) {
        return []
      }

      const ruleId = `${scope}-${index + 1}`
      if (this.hasNamedBasis(bases?.[ruleId])) {
        return []
      }

      return [{
        key: `${scope}.basis.${index + 1}`,
        ruleId,
        reason: 'ambiguous_condition_basis',
        field,
        blocking: true,
        question: this.buildRuleBasisQuestion(scope, rule),
        status: 'pending',
      }]
    })
  }

  private buildRuleBasisQuestion(scope: 'entry' | 'exit', rule: string): string {
    const trimmedRule = rule.trim()
    if (!trimmedRule) {
      return '这里的百分比条件是相对上一根 K 线收盘价、开仓均价、持仓收益，还是别的基准？'
    }

    const phaseLabel = scope === 'entry' ? '入场规则' : '出场规则'
    return `${phaseLabel}“${trimmedRule}”里的百分比条件，是相对上一根 K 线收盘价、开仓均价、持仓收益，还是别的基准？`
  }

  private ruleNeedsBasis(rule: string, requiresUserBasis: boolean): boolean {
    if (!PERCENTAGE_THRESHOLD_PATTERN.test(rule)) {
      return false
    }

    if (!requiresUserBasis) {
      return false
    }

    if (this.hasExplicitBasisInText(rule)) {
      return false
    }

    if (/网格|步长/u.test(rule)) {
      return false
    }

    return /买入|卖出|开仓|平仓|止盈|止损|离场|出场|收益率|盈利|亏损|回撤|连续\s*\d+\s*根/u.test(rule)
  }

  private hasNamedBasis(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0
  }

  private hasExplicitBasisInText(rule: string): boolean {
    return /相对于上一根K线收盘价|相对于开仓均价|持仓收益率|持仓盈亏|收益率|盈亏|价格相对入场价/u.test(rule)
  }

  private hasPendingExitBasisRule(
    rules: string[],
    semantic: 'stopLoss' | 'takeProfit',
  ): boolean {
    const matcher = semantic === 'stopLoss'
      ? /止损|亏损/u
      : /止盈|盈利|收益率/u

    return rules.some(rule => {
      const normalized = rule.trim()
      const semantics = classifyPercentageRuleFamily({ phase: 'exit', rule: normalized })
      return normalized.length > 0
        && matcher.test(normalized)
        && this.ruleNeedsBasis(normalized, semantics.requiresUserBasis)
    })
  }

  private hasStopLossRule(input: ClarificationChecklistInput): boolean {
    if (typeof input.riskRules?.stopLossPct === 'number') {
      return true
    }

    return this.hasRiskRuleText(input.riskRules, /止损|stop[\s_-]?loss/i)
      || this.hasRuleText(input.exitRules, /止损|stop[\s_-]?loss/i)
  }

  private hasTakeProfitRule(input: ClarificationChecklistInput): boolean {
    if (typeof input.riskRules?.takeProfitPct === 'number') {
      return true
    }

    return this.hasRiskRuleText(input.riskRules, /止盈|take[\s_-]?profit/i)
      || this.hasRuleText(input.exitRules, /止盈|take[\s_-]?profit/i)
  }

  private hasRiskRuleText(riskRules: Record<string, unknown> | undefined, pattern: RegExp): boolean {
    return Object.values(riskRules ?? {}).some(
      value => typeof value === 'string' && pattern.test(value),
    )
  }

  private hasRuleText(rules: string[] | undefined, pattern: RegExp): boolean {
    return Array.isArray(rules) && rules.some(rule => typeof rule === 'string' && pattern.test(rule))
  }

  private readMarketScopeConflicts(
    riskRules: Record<string, unknown> | undefined,
  ): MarketScopeConflict[] {
    const raw = riskRules?._marketScopeConflicts
    if (!Array.isArray(raw)) return []

    return raw.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return []
      const field = (item as { field?: unknown }).field
      const previous = (item as { previous?: unknown }).previous
      const next = (item as { next?: unknown }).next
      if (
        (field !== 'exchange' && field !== 'marketType' && field !== 'symbol' && field !== 'timeframe')
        || typeof previous !== 'string'
        || typeof next !== 'string'
        || !previous.trim()
        || !next.trim()
      ) {
        return []
      }

      if (isEquivalentMarketScopeValue(field, previous, next)) {
        return []
      }

      return [{
        field,
        previous: previous.trim(),
        next: next.trim(),
      }]
    })
  }

  private renderMarketFieldLabel(field: MarketScopeConflict['field']): string {
    if (field === 'exchange') return '交易所'
    if (field === 'marketType') return '市场类型'
    if (field === 'symbol') return '交易标的'
    return '主周期'
  }
}
