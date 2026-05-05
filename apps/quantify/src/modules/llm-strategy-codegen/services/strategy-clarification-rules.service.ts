import type { StrategyLogicSnapshot } from '../types/strategy-logic-snapshot'
import type { AtomicIntentResolution, StrategyAmbiguity } from '../types/strategy-ambiguity'
import type { StrategyClarificationItem, StrategyClarificationState } from '../types/strategy-clarification'
import type { StrategyExecutionContextResolution } from '../types/strategy-execution-context'
import { Injectable } from '@nestjs/common'
import { isEquivalentMarketScopeValue } from './market-scope-equivalence'
import { classifyPercentageRuleFamily } from './rule-family-default-semantics'
import { buildSemanticSlotId } from '../types/semantic-state'
import { resolveSemanticClarificationMetadata } from './semantic-clarification-metadata'

type StrategyClarificationInput = StrategyLogicSnapshot

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
const GRID_STRATEGY_PATTERN = /网格|grid/iu
const STATE_GATE_PATTERN = /趋势|震荡|波动|regime|volatility|trend/iu
const BOLLINGER_RULE_PATTERN = /布林|bollinger|上轨|下轨|中轨|upper|lower|middle|ma20|均线20/iu
const TOUCH_CONFIRMATION_PATTERN = /触及|触碰|碰到|touch/iu
const CLOSE_CONFIRMATION_PATTERN = /收盘|收于|收在|close/iu

@Injectable()
export class StrategyClarificationRulesService {
  detectFromAmbiguities(input: {
    executionContext: StrategyExecutionContextResolution
    atomicResolution: AtomicIntentResolution
    checklist?: StrategyClarificationInput | null
  }): StrategyClarificationState {
    const items: StrategyClarificationItem[] = [
      ...this.fromExecutionContextAmbiguities(input.executionContext),
      ...this.fromAtomicAmbiguities(input.atomicResolution.ambiguities, input.checklist),
    ]

    if (items.length > 0) {
      return {
        status: 'NEEDS_CLARIFICATION',
        items,
      }
    }

    return {
      status: 'CLEAR',
      items: [],
    }
  }

  detect(input: StrategyClarificationInput): StrategyClarificationState {
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
      ...this.detectGridItems(input),
      ...this.detectStateGateItems(input),
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

  collectEvidence(input: StrategyClarificationInput): {
    clarificationState: StrategyClarificationState
    evidence: Array<{ key: string, reason: string, priority: number, question?: string }>
    blockingReasons: Array<{ key: string, reason: string, priority: number, question: string }>
    inferredAssumptions: []
  } {
    const clarificationState = this.detect(input)
    const hasClosedLoopGrid = this.hasClosedLoopExitSemantics(input)
    const rawEvidence = clarificationState.items
      .filter((item) => !(
        hasClosedLoopGrid
        && (item.reason === 'missing_exit_rules'
          || item.reason === 'missing_stop_loss_rule'
          || item.reason === 'missing_take_profit_rule')
      ))
      .map((item) => ({
        key: item.key,
        reason: item.reason,
        priority: this.readReasonPriority(item.reason),
        question: item.question,
      }))

    const evidence = hasClosedLoopGrid
      ? [
          ...rawEvidence,
          { key: 'closed_loop_exit_detected', reason: 'closed_loop_exit_detected', priority: 60 },
        ]
      : rawEvidence

    return {
      clarificationState,
      evidence,
      blockingReasons: rawEvidence.filter((item): item is { key: string, reason: string, priority: number, question: string } => typeof item.question === 'string'),
      inferredAssumptions: [],
    }
  }

  private fromExecutionContextAmbiguities(
    resolution: StrategyExecutionContextResolution,
  ): StrategyClarificationItem[] {
    return resolution.ambiguities.map((ambiguity) => ({
      key: `executionContext.${ambiguity.field}`,
      reason: ambiguity.reason,
      field: ambiguity.field,
      blocking: true,
      question: this.renderExecutionContextQuestion(ambiguity.field),
      status: 'pending',
    }))
  }

  private fromAtomicAmbiguities(
    ambiguities: StrategyAmbiguity[],
    checklist?: StrategyClarificationInput | null,
  ): StrategyClarificationItem[] {
    return ambiguities.flatMap<StrategyClarificationItem>((ambiguity) => {
      if (ambiguity.kind === 'open_semantic_slot' || ambiguity.kind === 'semantic_conflict') {
        const slotKey = ambiguity.slotKey ?? ambiguity.field
        const fieldPath = ambiguity.fieldPath
        const slotId = ambiguity.slotId ?? (fieldPath ? buildSemanticSlotId({ slotKey, fieldPath }) : undefined)
        const semanticMetadata = resolveSemanticClarificationMetadata(slotKey)

        return [{
          key: `semantic.${slotKey}`,
          reason: semanticMetadata.reason,
          field: semanticMetadata.field,
          blocking: true,
          question: ambiguity.question ?? ambiguity.message,
          status: 'pending',
          slotId,
          slotKey,
          fieldPath,
          ...(ambiguity.choices?.length ? { allowedAnswers: ambiguity.choices } : {}),
          ...(typeof ambiguity.priority === 'number' ? { priority: ambiguity.priority } : {}),
        }]
      }

      if (ambiguity.kind !== 'atomic_semantic_fork') {
        return []
      }

      const targetRule = this.findFirstAmbiguousBollingerRule(checklist)
      if (!targetRule) {
        return []
      }

      return [{
        key: `${targetRule.phase}.trigger.confirmation.${targetRule.index + 1}`,
        ruleId: `${targetRule.phase}-${targetRule.index + 1}`,
        reason: 'atomic_semantic_fork',
        field: 'trigger.confirmation',
        ...(ambiguity.choices?.length ? { allowedAnswers: ambiguity.choices } : {}),
        blocking: true,
        question: this.renderAtomicForkQuestion(ambiguity, targetRule.phase, targetRule.text),
        status: 'pending',
      }]
    })
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
    input: StrategyClarificationInput,
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

    if (!this.hasPrimaryValue(input.timeframes) && !this.hasClosedLoopExitSemantics(input)) {
      items.push({
        key: 'market.timeframe',
        reason: 'missing_timeframe',
        field: 'timeframe',
        blocking: true,
        question: '请确认策略主周期（例如 15m 或 1h）。',
        status: 'pending',
      })
    }

    const exchange = this.readExchange(input.riskRules, input.market)
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

    const marketType = this.readMarketType(input.riskRules, input.market)
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

  private detectRequiredRuleItems(input: StrategyClarificationInput): StrategyClarificationItem[] {
    const items: StrategyClarificationItem[] = []
    const hasClosedLoopSemantics = this.hasClosedLoopExitSemantics(input)
    const hasSelfContainedGridSemantics = this.hasSelfContainedGridSemantics(input)

    if (!this.hasAnyRule(input.entryRules) && !hasSelfContainedGridSemantics) {
      items.push({
        key: 'entry.rules',
        reason: 'missing_entry_rules',
        field: 'entryRules',
        blocking: true,
        question: '请补充至少一条明确的入场规则。',
        status: 'pending',
      })
    }

    if (!this.hasAnyRule(input.exitRules) && !hasClosedLoopSemantics && !hasSelfContainedGridSemantics) {
      items.push({
        key: 'exit.rules',
        reason: 'missing_exit_rules',
        field: 'exitRules',
        blocking: true,
        question: '请补充至少一条明确的出场规则。',
        status: 'pending',
      })
    }

    if (!this.hasStopLossRule(input) && !this.riskRulesOptionalUnderCurrentSemantics(input)) {
      items.push({
        key: 'risk.stopLoss.rule',
        reason: 'missing_stop_loss_rule',
        field: 'riskRules.stopLossPct',
        blocking: true,
        question: '请确认止损规则（例如亏损 5% 止损）。',
        status: 'pending',
      })
    }

    if (!this.hasTakeProfitRule(input) && !this.riskRulesOptionalUnderCurrentSemantics(input)) {
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
      question: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
      status: 'pending',
    }]
  }

  private detectGridItems(input: StrategyClarificationInput): StrategyClarificationItem[] {
    if (!this.looksLikeGridStrategy(input)) {
      return []
    }

    const items: StrategyClarificationItem[] = []
    const range = this.readGridRange(input)

    if (typeof range.lower !== 'number') {
      items.push({
        key: 'grid.lower',
        reason: 'grid_params_missing',
        field: 'grid.lower',
        blocking: true,
        question: '请确认网格下沿价格。',
        status: 'pending',
      })
    }

    if (typeof range.upper !== 'number') {
      items.push({
        key: 'grid.upper',
        reason: 'grid_params_missing',
        field: 'grid.upper',
        blocking: true,
        question: '请确认网格上沿价格。',
        status: 'pending',
      })
    }

    if (typeof this.readGridStepPct(input) !== 'number') {
      items.push({
        key: 'grid.stepPct',
        reason: 'grid_params_missing',
        field: 'grid.stepPct',
        blocking: true,
        question: '请确认网格步长（例如每格 0.5%）。',
        status: 'pending',
      })
    }

    if (!this.hasGridSideMode(input)) {
      items.push({
        key: 'grid.sideMode',
        reason: 'missing_side_scope',
        field: 'grid.sideMode',
        allowedAnswers: ['long_only', 'short_only', 'bidirectional'],
        blocking: true,
        question: '请确认网格方向：只做多、只做空，还是双向低买高卖？',
        status: 'pending',
      })
    }

    return items
  }

  private detectStateGateItems(input: StrategyClarificationInput): StrategyClarificationItem[] {
    if (!this.looksLikeStateGate(input)) {
      return []
    }

    if (
      input.stateGates?.trendDirection
      || input.stateGates?.marketRegime
      || input.stateGates?.volatilityState
    ) {
      return []
    }

    return [{
      key: 'state.marketRegime',
      reason: 'ambiguous_state_gate',
      field: 'stateGates.marketRegime',
      blocking: true,
      question: '这里的状态门控是趋势、震荡，还是高/低波动？请明确到白名单状态。',
      status: 'pending',
    }]
  }

  private hasPrimaryValue(list: string[] | undefined): boolean {
    return typeof list?.[0] === 'string' && list[0].trim().length > 0
  }

  private hasAnyRule(list: string[] | undefined): boolean {
    return Array.isArray(list) && list.some(rule => typeof rule === 'string' && rule.trim().length > 0)
  }

  private readMarketType(
    riskRules: Record<string, unknown> | undefined,
    market?: StrategyClarificationInput['market'],
  ): 'spot' | 'perp' | null {
    const raw = typeof market?.marketType === 'string' ? market.marketType : riskRules?.marketType
    if (typeof raw !== 'string') return null
    const normalized = raw.trim().toLowerCase()
    return normalized === 'spot' || normalized === 'perp' ? normalized : null
  }

  private readExchange(
    riskRules: Record<string, unknown> | undefined,
    market?: StrategyClarificationInput['market'],
  ): 'binance' | 'okx' | 'hyperliquid' | null {
    const raw = typeof market?.exchange === 'string' ? market.exchange : riskRules?.exchange
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

  private detectBasisItems(input: StrategyClarificationInput): StrategyClarificationItem[] {
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

  private hasStopLossRule(input: StrategyClarificationInput): boolean {
    if (typeof input.riskRules?.stopLossPct === 'number') {
      return true
    }

    return this.hasRiskRuleText(input.riskRules, /止损|stop[\s_-]?loss/i)
      || this.hasRuleText(input.exitRules, /止损|stop[\s_-]?loss/i)
  }

  private hasTakeProfitRule(input: StrategyClarificationInput): boolean {
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

  private looksLikeGridStrategy(input: StrategyClarificationInput): boolean {
    if (
      typeof input.grid?.lower === 'number'
      || typeof input.grid?.upper === 'number'
      || typeof input.grid?.stepPct === 'number'
      || typeof input.grid?.sideMode === 'string'
    ) {
      return true
    }

    return this.collectRuleTexts(input).some(text => GRID_STRATEGY_PATTERN.test(text))
  }

  private looksLikeStateGate(input: StrategyClarificationInput): boolean {
    if (
      input.stateGates?.trendDirection
      || input.stateGates?.marketRegime
      || input.stateGates?.volatilityState
    ) {
      return true
    }

    return this.collectRuleTexts(input).some(text => STATE_GATE_PATTERN.test(text))
  }

  private collectRuleTexts(input: StrategyClarificationInput): string[] {
    const riskTexts = Object.values(input.riskRules ?? {}).flatMap((value) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        return [value.trim()]
      }
      return []
    })

    return [
      ...(input.entryRules ?? []),
      ...(input.exitRules ?? []),
      ...riskTexts,
    ]
      .map(text => text.trim())
      .filter(text => text.length > 0)
  }

  private readGridRange(input: StrategyClarificationInput): { lower?: number, upper?: number } {
    if (typeof input.grid?.lower === 'number' && typeof input.grid?.upper === 'number') {
      return {
        lower: input.grid.lower,
        upper: input.grid.upper,
      }
    }

    for (const text of this.collectRuleTexts(input)) {
      const match = text.match(/(\d+(?:\.\d+)?)\s*[-到至]\s*(\d+(?:\.\d+)?)/u)
      if (!match) continue

      const lower = Number.parseFloat(match[1])
      const upper = Number.parseFloat(match[2])
      if (!Number.isFinite(lower) || !Number.isFinite(upper)) continue

      return {
        lower: Math.min(lower, upper),
        upper: Math.max(lower, upper),
      }
    }

    return {
      lower: input.grid?.lower,
      upper: input.grid?.upper,
    }
  }

  private readGridStepPct(input: StrategyClarificationInput): number | null {
    if (typeof input.grid?.stepPct === 'number') {
      return input.grid.stepPct
    }

    for (const text of this.collectRuleTexts(input)) {
      const percentMatch = text.match(/每一格\s*(\d+(?:\.\d+)?)\s*%/u)
      if (percentMatch) {
        const value = Number.parseFloat(percentMatch[1])
        if (Number.isFinite(value)) {
          return value
        }
      }

      const permilleMatch = text.match(/每一格\s*千分之\s*(\d+(?:\.\d+)?)/u)
      if (permilleMatch) {
        const value = Number.parseFloat(permilleMatch[1])
        if (Number.isFinite(value)) {
          return value / 10
        }
      }
    }

    return null
  }

  private hasGridSideMode(input: StrategyClarificationInput): boolean {
    if (
      input.grid?.sideMode === 'long_only'
      || input.grid?.sideMode === 'short_only'
      || input.grid?.sideMode === 'bidirectional'
    ) {
      return true
    }

    const text = this.collectRuleTexts(input).join(' ')
    return /双向/u.test(text)
      || /做多网格|多头网格/u.test(text)
      || /做空网格|空头网格/u.test(text)
      || /低买高卖|高卖低买/u.test(text)
  }

  private hasSelfContainedGridSemantics(input: StrategyClarificationInput): boolean {
    if (!this.looksLikeGridStrategy(input)) {
      return false
    }

    const range = this.readGridRange(input)
    return typeof range.lower === 'number'
      && typeof range.upper === 'number'
      && typeof this.readGridStepPct(input) === 'number'
      && this.hasGridSideMode(input)
  }

  private hasClosedLoopExitSemantics(input: StrategyClarificationInput): boolean {
    if (this.hasSelfContainedGridSemantics(input)) {
      return true
    }

    const text = this.collectRuleTexts(input).join(' ')
    if (!text) return false

    return /网格/u.test(text) && /低买高卖|高卖低买|上方网格卖出|网格卖出/u.test(text)
  }

  private riskRulesOptionalUnderCurrentSemantics(input: StrategyClarificationInput): boolean {
    return this.hasClosedLoopExitSemantics(input)
  }

  private readReasonPriority(reason: StrategyClarificationItem['reason']): number {
    if (reason === 'conflicting_market_scope' || reason === 'invalid_spot_short_combo') return 100
    if (reason === 'missing_entry_rules' || reason === 'missing_exit_rules' || reason === 'missing_action_uniqueness' || reason === 'missing_side_scope' || reason === 'direction_ambiguous' || reason === 'atomic_semantic_fork') return 90
    if (reason === 'missing_stop_loss_rule' || reason === 'missing_take_profit_rule' || reason === 'grid_params_missing' || reason === 'ambiguous_risk_effect' || reason === 'ambiguous_state_gate') return 70
    if (reason === 'missing_exchange' || reason === 'missing_symbol' || reason === 'missing_market_type' || reason === 'missing_timeframe' || reason === 'missing_position_pct' || reason === 'missing_position_mode') return 60
    if (reason === 'ambiguous_condition_basis') return 50
    if (
      reason === 'missing_semantic_trigger'
      || reason === 'missing_semantic_action'
      || reason === 'missing_semantic_contract_requirement'
    ) return 90
    if (
      reason === 'missing_semantic_position_sizing'
      || reason === 'missing_semantic_position_mode'
      || reason === 'missing_semantic_risk'
    ) return 70
    return 10
  }

  private renderExecutionContextQuestion(
    field: 'exchange' | 'symbol' | 'marketType' | 'timeframe',
  ): string {
    if (field === 'exchange') {
      return '请确认交易所（binance / okx / hyperliquid）。'
    }
    if (field === 'symbol') {
      return '请确认策略交易标的（例如 BTCUSDT）。'
    }
    if (field === 'marketType') {
      return '请确认市场类型（现货或合约/perp）。'
    }
    return '请确认策略主周期（例如 15m 或 1h）。'
  }

  private renderAtomicForkQuestion(
    ambiguity: StrategyAmbiguity,
    phase?: 'entry' | 'exit',
    ruleText?: string,
  ): string {
    if (ambiguity.field === 'trigger.confirmation') {
      if (ruleText) {
        const phaseLabel = phase === 'exit' ? '出场规则' : '入场规则'
        return `${phaseLabel}“${ruleText}”是触碰即触发，还是收盘确认后触发？`
      }
      return '该布林带条件是触碰即触发，还是收盘确认后触发？'
    }

    return ambiguity.message
  }

  private findFirstAmbiguousBollingerRule(
    checklist?: StrategyClarificationInput | null,
  ): { phase: 'entry' | 'exit', index: number, text: string } | null {
    if (!checklist) return null

    const candidates: Array<{ phase: 'entry' | 'exit', rules: string[] | undefined }> = [
      { phase: 'entry', rules: checklist.entryRules },
      { phase: 'exit', rules: checklist.exitRules },
    ]

    for (const candidate of candidates) {
      for (const [index, rawRule] of (candidate.rules ?? []).entries()) {
        const text = rawRule.trim()
        if (!text) continue
        if (!BOLLINGER_RULE_PATTERN.test(text)) continue
        if (this.resolveBollingerConfirmationHint(text) !== 'ambiguous_touch_or_close_confirm') continue
        if (!(TOUCH_CONFIRMATION_PATTERN.test(text) && CLOSE_CONFIRMATION_PATTERN.test(text))) continue
        return {
          phase: candidate.phase,
          index,
          text,
        }
      }
    }

    return null
  }

  private resolveBollingerConfirmationHint(
    rule: string,
  ): 'touch' | 'close_confirm' | 'ambiguous_touch_or_close_confirm' {
    const hasTouchCue = TOUCH_CONFIRMATION_PATTERN.test(rule)
    const hasCloseCue = CLOSE_CONFIRMATION_PATTERN.test(rule)

    if (hasTouchCue && hasCloseCue) {
      return 'ambiguous_touch_or_close_confirm'
    }
    if (hasCloseCue) {
      return 'close_confirm'
    }
    if (hasTouchCue) {
      return 'touch'
    }

    return 'ambiguous_touch_or_close_confirm'
  }
}
