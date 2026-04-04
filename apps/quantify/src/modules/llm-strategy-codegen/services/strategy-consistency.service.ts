import type { CanonicalAction, CanonicalStrategySpec } from '../types/canonical-strategy-spec'
import type { StrategyConsistencyCheck, StrategyConsistencyReport } from '../types/strategy-consistency-report'
import type { StrategySemanticProfile, StrategySemanticRuleKey } from '../types/strategy-semantic-profile'
import type { StrategySummary } from '../types/strategy-summary'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { ScriptProfileExtractorService } from './script-profile-extractor.service'

const ENTRY_ACTIONS = new Set(['OPEN_LONG', 'OPEN_SHORT'])
const EXIT_ACTIONS = new Set(['CLOSE_LONG', 'CLOSE_SHORT', 'ADJUST_POSITION'])

@Injectable()
export class StrategyConsistencyService {
  constructor(private readonly scriptProfileExtractor: ScriptProfileExtractorService) {}

  evaluate(input: {
    canonicalSpec: CanonicalStrategySpec
    scriptCode: string
    userIntentSummary?: StrategySummary
    strategySummary?: StrategySummary
    scriptSummary?: StrategySummary
  }): StrategyConsistencyReport {
    const scriptProfile = this.scriptProfileExtractor.extract(input.scriptCode)
    const derivedScriptSummary = input.scriptSummary ?? this.buildScriptSummaryFromProfile(scriptProfile)
    const specProfile = this.specToProfile(input.canonicalSpec)
    const checks: StrategyConsistencyCheck[] = []

    checks.push(this.checkFallback(scriptProfile))
    checks.push(this.checkSummaryAlignment({
      userIntentSummary: input.userIntentSummary,
      strategySummary: input.strategySummary,
      scriptSummary: derivedScriptSummary,
    }))
    checks.push(this.checkIndicators(specProfile, scriptProfile))
    checks.push(this.checkRuleMappings(specProfile, scriptProfile))
    checks.push(this.checkActions(specProfile, scriptProfile))
    checks.push(this.checkSizing(specProfile, scriptProfile))

    const summary = this.buildSummary(checks)

    return {
      status: summary.criticalFailed > 0 ? 'FAILED' : 'PASSED',
      specProfile,
      scriptProfile,
      checks,
      summary,
    }
  }

  private specToProfile(spec: CanonicalStrategySpec): StrategySemanticProfile {
    const actions = new Set<CanonicalAction>()
    for (const rule of spec.entries) actions.add(rule.action)
    for (const rule of spec.exits) actions.add(rule.action)

    return {
      indicators: spec.indicators,
      actions: Array.from(actions),
      ruleMappings: this.buildRuleMappings(spec),
      sizing: spec.sizing
        ? {
          ...spec.sizing,
          source: 'literal',
        }
        : null,
      requiredParams: [],
      fallbackDetected: false,
    }
  }

  private checkFallback(scriptProfile: StrategySemanticProfile): StrategyConsistencyCheck {
    if (scriptProfile.fallbackDetected) {
      return {
        key: 'script.fallback_forbidden',
        level: 'critical',
        status: 'failed',
        expected: false,
        actual: true,
        message: '检测到通用 fallback 脚本，禁止直接发布。',
      }
    }

    return {
      key: 'script.fallback_forbidden',
      level: 'critical',
      status: 'passed',
      expected: false,
      actual: false,
      message: '未检测到 fallback 脚本。',
    }
  }

  private checkIndicators(
    specProfile: StrategySemanticProfile,
    scriptProfile: StrategySemanticProfile,
  ): StrategyConsistencyCheck {
    const expected = specProfile.indicators
      .map(item => item.kind)
      .filter(kind => kind !== 'custom')
    const actual = scriptProfile.indicators.map(item => item.kind)
    const missing = expected.filter(kind => !actual.includes(kind))
    const mismatchedParams = specProfile.indicators
      .filter(item => item.kind === 'bollingerBands')
      .flatMap((indicator) => {
        const actualIndicator = scriptProfile.indicators.find(item => item.kind === indicator.kind)
        if (!actualIndicator) return []

        const diffKeys = Object.entries(indicator.params)
          .filter(([key, value]) => actualIndicator.params[key] !== value)
          .map(([key]) => key)
        if (diffKeys.length === 0) return []

        return [`${indicator.kind}(${diffKeys.join(', ')})`]
      })

    if (expected.length === 0) {
      return {
        key: 'indicators.required',
        level: 'warning',
        status: 'unprovable',
        expected,
        actual,
        message: 'canonical spec 未声明可验证指标，跳过指标强校验。',
      }
    }

    if (missing.length > 0 || mismatchedParams.length > 0) {
      return {
        key: 'indicators.required',
        level: 'critical',
        status: 'failed',
        expected: specProfile.indicators.filter(item => item.kind !== 'custom'),
        actual,
        message: [
          missing.length > 0 ? `脚本缺少关键指标: ${missing.join(', ')}` : '',
          mismatchedParams.length > 0 ? `脚本指标参数不匹配: ${mismatchedParams.join(', ')}` : '',
        ].filter(Boolean).join('；'),
      }
    }

    return {
      key: 'indicators.required',
      level: 'critical',
      status: 'passed',
      expected: specProfile.indicators.filter(item => item.kind !== 'custom'),
      actual,
      message: '脚本指标与 canonical spec 一致。',
    }
  }

  private checkSummaryAlignment(input: {
    userIntentSummary?: StrategySummary
    strategySummary?: StrategySummary
    scriptSummary?: StrategySummary
  }): StrategyConsistencyCheck {
    const userIntentSummary = input.userIntentSummary
    const strategySummary = input.strategySummary
    const scriptSummary = input.scriptSummary

    if (!userIntentSummary || !strategySummary || !scriptSummary) {
      return {
        key: 'summary.alignment',
        level: 'warning',
        status: 'unprovable',
        expected: {
          userIntentSummary: userIntentSummary ?? null,
          strategySummary: strategySummary ?? null,
        },
        actual: scriptSummary ?? null,
        message: '缺少 userIntentSummary/strategySummary/scriptSummary，跳过 summary 强校验。',
      }
    }

    const mismatches = [
      ...this.compareSummaries('用户意图', userIntentSummary, '策略描述', strategySummary),
      ...this.compareSummaries('策略描述', strategySummary, '脚本语义', scriptSummary),
    ]

    if (mismatches.length > 0) {
      return {
        key: 'summary.alignment',
        level: 'critical',
        status: 'failed',
        expected: {
          userIntentSummary,
          strategySummary,
        },
        actual: scriptSummary,
        message: `summary 对齐失败：${mismatches.join('；')}`,
      }
    }

    return {
      key: 'summary.alignment',
      level: 'critical',
      status: 'passed',
      expected: {
        userIntentSummary,
        strategySummary,
      },
      actual: scriptSummary,
      message: 'userIntentSummary / strategySummary / scriptSummary 对齐一致。',
    }
  }

  private checkRuleMappings(
    specProfile: StrategySemanticProfile,
    scriptProfile: StrategySemanticProfile,
  ): StrategyConsistencyCheck {
    if (specProfile.ruleMappings.length === 0) {
      return {
        key: 'rules.mapping',
        level: 'warning',
        status: 'unprovable',
        expected: [],
        actual: scriptProfile.ruleMappings,
        message: 'canonical spec 未生成规则级语义映射，跳过规则强校验。',
      }
    }

    const missing: string[] = []
    const mismatched: string[] = []

    specProfile.ruleMappings.forEach((expectedRule) => {
      const actualRule = scriptProfile.ruleMappings.find(item => item.key === expectedRule.key)
      if (!actualRule) {
        missing.push(expectedRule.key)
        return
      }

      if (actualRule.action !== expectedRule.action) {
        mismatched.push(`${expectedRule.key}: expected=${expectedRule.action}, actual=${actualRule.action}`)
      }
    })

    if (missing.length > 0 || mismatched.length > 0) {
      return {
        key: 'rules.mapping',
        level: 'critical',
        status: 'failed',
        expected: specProfile.ruleMappings,
        actual: scriptProfile.ruleMappings,
        message: [
          missing.length > 0 ? `脚本缺少关键规则映射: ${missing.join(', ')}` : '',
          mismatched.length > 0 ? `脚本规则动作不匹配: ${mismatched.join(' | ')}` : '',
        ].filter(Boolean).join('；'),
      }
    }

    return {
      key: 'rules.mapping',
      level: 'critical',
      status: 'passed',
      expected: specProfile.ruleMappings,
      actual: scriptProfile.ruleMappings,
      message: '脚本规则级语义与 canonical spec 一致。',
    }
  }

  private checkActions(
    specProfile: StrategySemanticProfile,
    scriptProfile: StrategySemanticProfile,
  ): StrategyConsistencyCheck {
    const expected = specProfile.actions.filter(action => action.startsWith('OPEN_'))
    const actual = scriptProfile.actions
    const missing = expected.filter(action => !actual.includes(action))

    if (actual.length === 0) {
      return {
        key: 'actions.required',
        level: 'warning',
        status: 'unprovable',
        expected,
        actual,
        message: '脚本未显式声明 action 字段（可能是旧协议），动作比对降级为 warning。',
      }
    }

    if (expected.length === 0) {
      return {
        key: 'actions.required',
        level: 'warning',
        status: 'unprovable',
        expected,
        actual,
        message: 'canonical spec 未声明关键开仓动作，跳过强校验。',
      }
    }

    if (missing.length > 0) {
      return {
        key: 'actions.required',
        level: 'critical',
        status: 'failed',
        expected,
        actual,
        message: `脚本缺少关键动作: ${missing.join(', ')}`,
      }
    }

    return {
      key: 'actions.required',
      level: 'warning',
      status: 'passed',
      expected,
      actual,
      message: '脚本动作与 canonical spec 一致。',
    }
  }

  private checkSizing(
    specProfile: StrategySemanticProfile,
    scriptProfile: StrategySemanticProfile,
  ): StrategyConsistencyCheck {
    const requiresSizingEvidence = specProfile.actions.some(action => action.startsWith('OPEN_'))
      || scriptProfile.actions.some(action => action.startsWith('OPEN_'))

    if (!specProfile.sizing) {
      return {
        key: 'sizing.mode',
        level: 'warning',
        status: 'unprovable',
        expected: specProfile.sizing,
        actual: scriptProfile.sizing,
        message: 'canonical spec 未声明仓位规则，跳过仓位比对。',
      }
    }

    if (!requiresSizingEvidence) {
      return {
        key: 'sizing.mode',
        level: 'warning',
        status: 'unprovable',
        expected: specProfile.sizing,
        actual: scriptProfile.sizing,
        message: '当前脚本未呈现可校验的开仓仓位语义，跳过 sizing 强校验。',
      }
    }

    if (!scriptProfile.sizing) {
      return {
        key: 'sizing.mode',
        level: 'critical',
        status: 'failed',
        expected: specProfile.sizing,
        actual: null,
        message: '脚本缺少可验证的仓位声明，禁止发布。',
      }
    }

    if (specProfile.sizing.mode !== scriptProfile.sizing.mode) {
      return {
        key: 'sizing.mode',
        level: 'critical',
        status: 'failed',
        expected: specProfile.sizing.mode,
        actual: scriptProfile.sizing.mode,
        message: '脚本仓位模式与 canonical spec 不一致。',
      }
    }

    if (scriptProfile.sizing.source === 'positionPct_raw') {
      return {
        key: 'sizing.mode',
        level: 'critical',
        status: 'failed',
        expected: specProfile.sizing,
        actual: scriptProfile.sizing,
        message: '脚本直接把 positionPct 当作 RATIO 使用，缺少百分比归一化。',
      }
    }

    if (scriptProfile.sizing.source === 'unknown') {
      return {
        key: 'sizing.mode',
        level: 'critical',
        status: 'failed',
        expected: specProfile.sizing,
        actual: scriptProfile.sizing,
        message: '脚本仓位表达式无法证明与 canonical spec 一致，禁止发布。',
      }
    }

    if (scriptProfile.sizing.source === 'literal') {
      const actualValue = scriptProfile.sizing.value
      const expectedValue = specProfile.sizing.value
      if (typeof actualValue !== 'number' || Math.abs(actualValue - expectedValue) > 0.0001) {
        return {
          key: 'sizing.mode',
          level: 'critical',
          status: 'failed',
          expected: specProfile.sizing,
          actual: scriptProfile.sizing,
          message: '脚本仓位值与 canonical spec 不一致。',
        }
      }
    }

    return {
      key: 'sizing.mode',
      level: 'critical',
      status: 'passed',
      expected: specProfile.sizing,
      actual: scriptProfile.sizing,
      message: '仓位语义与 canonical spec 一致。',
    }
  }

  private buildSummary(checks: StrategyConsistencyCheck[]): StrategyConsistencyReport['summary'] {
    return checks.reduce(
      (acc, check) => {
        if (check.status === 'unprovable') acc.unprovable += 1
        if (check.level === 'critical' && check.status === 'failed') acc.criticalFailed += 1
        if (check.level === 'warning' && check.status === 'failed') acc.warningFailed += 1
        return acc
      },
      {
        criticalFailed: 0,
        warningFailed: 0,
        unprovable: 0,
      },
    )
  }

  private compareSummaries(
    leftLabel: string,
    left: StrategySummary,
    rightLabel: string,
    right: StrategySummary,
  ): string[] {
    const issues: string[] = []
    if (left.strategyType !== right.strategyType) {
      issues.push(`${leftLabel}.strategyType=${left.strategyType} != ${rightLabel}.strategyType=${right.strategyType}`)
    }

    const leftIndicators = [...left.indicators].sort()
    const rightIndicators = [...right.indicators].sort()
    if (leftIndicators.join('|') !== rightIndicators.join('|')) {
      issues.push(`${leftLabel}.indicators 与 ${rightLabel}.indicators 不一致`)
    }

    if (left.entryRule !== right.entryRule) {
      issues.push(`${leftLabel}.entryRule=${left.entryRule} != ${rightLabel}.entryRule=${right.entryRule}`)
    }

    if (left.exitRule !== right.exitRule) {
      issues.push(`${leftLabel}.exitRule=${left.exitRule} != ${rightLabel}.exitRule=${right.exitRule}`)
    }

    if (left.sizing && right.sizing) {
      const leftSizing = `${left.sizing.mode}:${left.sizing.evidence}`
      const rightSizing = `${right.sizing.mode}:${right.sizing.evidence}`
      if (leftSizing !== rightSizing) {
        issues.push(`${leftLabel}.sizing=${leftSizing} != ${rightLabel}.sizing=${rightSizing}`)
      }
    }

    return issues
  }

  private buildScriptSummaryFromProfile(profile: StrategySemanticProfile): StrategySummary {
    const indicators = Array.from(new Set(
      profile.indicators
        .map(item => item.kind)
        .filter((kind): kind is Exclude<typeof kind, 'custom'> => kind !== 'custom'),
    ))

    const strategyType: StrategySummary['strategyType'] = indicators.includes('bollingerBands')
      ? 'bollinger'
      : (indicators.includes('sma') || indicators.includes('ema'))
          ? 'movingAverage'
          : (indicators.includes('rsi') || indicators.includes('macd'))
              ? 'momentum'
              : indicators.includes('atr')
                  ? 'volatility'
                  : 'custom'

    const upperRule = profile.ruleMappings.find(item => item.key === 'bollinger.upper_break')
    const lowerRule = profile.ruleMappings.find(item => item.key === 'bollinger.lower_break')
    const hasMiddleRule = profile.ruleMappings.some(item => item.key === 'bollinger.middle_revert')
    const movingAverageEntryRule = this.resolveMovingAverageSummaryRule(profile, ENTRY_ACTIONS)
    const movingAverageExitRule = this.resolveMovingAverageSummaryRule(profile, EXIT_ACTIONS)

    const entryRule = upperRule?.action === 'OPEN_SHORT'
      ? 'bollinger.upper_break_short'
      : lowerRule?.action === 'OPEN_LONG'
          ? 'bollinger.lower_break_long'
          : (strategyType === 'movingAverage' && movingAverageEntryRule)
              ? movingAverageEntryRule
              : 'custom'
    const exitRule = hasMiddleRule
      ? 'bollinger.middle_revert'
      : (strategyType === 'movingAverage' && movingAverageExitRule)
          ? movingAverageExitRule
          : 'custom'

    return {
      strategyType,
      indicators,
      entryRule,
      exitRule,
      market: {},
      sizing: profile.sizing
        ? {
          mode: profile.sizing.mode,
          evidence: profile.sizing.source === 'literal' || profile.sizing.source === 'positionPct_normalized'
            ? 'explicit'
            : 'unresolved',
        }
        : null,
    }
  }

  private buildRuleMappings(spec: CanonicalStrategySpec): StrategySemanticProfile['ruleMappings'] {
    const hasBollinger = spec.indicators.some(item => item.kind === 'bollingerBands')
    const hasMovingAverage = spec.indicators.some(item => item.kind === 'sma' || item.kind === 'ema')
    if (!hasBollinger && !hasMovingAverage) {
      return []
    }

    const mappings = new Map<StrategySemanticRuleKey, CanonicalAction>()
    const register = (trigger: string, action: CanonicalAction) => {
      if (/上轨|upper/i.test(trigger)) {
        mappings.set('bollinger.upper_break', action)
      }
      if (/下轨|lower/i.test(trigger)) {
        mappings.set('bollinger.lower_break', action)
      }
      if (/中轨|middle|ma20/i.test(trigger)) {
        mappings.set('bollinger.middle_revert', action)
      }
      if (/金叉|上穿/i.test(trigger) && /均线|\bma\b|\bsma\b|\bema\b/i.test(trigger)) {
        mappings.set('ma.golden_cross', action)
      }
      if (/死叉|下穿/i.test(trigger) && /均线|\bma\b|\bsma\b|\bema\b/i.test(trigger)) {
        mappings.set('ma.death_cross', action)
      }
    }

    spec.entries.forEach(rule => register(rule.trigger, rule.action))
    spec.exits.forEach(rule => register(rule.trigger, rule.action))

    return Array.from(mappings.entries()).map(([key, action]) => ({ key, action }))
  }

  private resolveMovingAverageSummaryRule(
    profile: StrategySemanticProfile,
    actionSet: Set<string>,
  ): 'ma.golden_cross' | 'ma.death_cross' | null {
    const matchedKeys = Array.from(new Set(
      profile.ruleMappings
        .filter(item => actionSet.has(item.action))
        .map(item => item.key)
        .filter((key): key is 'ma.golden_cross' | 'ma.death_cross' =>
          key === 'ma.golden_cross' || key === 'ma.death_cross'),
    ))

    return matchedKeys.length === 1 ? matchedKeys[0] : null
  }
}
