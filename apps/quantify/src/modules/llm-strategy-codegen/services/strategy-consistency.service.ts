import type { CanonicalAction, CanonicalStrategySpec } from '../types/canonical-strategy-spec'
import type { StrategyConsistencyCheck, StrategyConsistencyReport } from '../types/strategy-consistency-report'
import type { StrategySemanticProfile, StrategySemanticRuleKey } from '../types/strategy-semantic-profile'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { ScriptProfileExtractorService } from './script-profile-extractor.service'

@Injectable()
export class StrategyConsistencyService {
  constructor(private readonly scriptProfileExtractor: ScriptProfileExtractorService) {}

  evaluate(input: {
    canonicalSpec: CanonicalStrategySpec
    scriptCode: string
  }): StrategyConsistencyReport {
    const scriptProfile = this.scriptProfileExtractor.extract(input.scriptCode)
    const specProfile = this.specToProfile(input.canonicalSpec)
    const checks: StrategyConsistencyCheck[] = []

    checks.push(this.checkFallback(scriptProfile))
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
      sizing: spec.sizing ?? null,
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
    if (!specProfile.sizing || !scriptProfile.sizing) {
      return {
        key: 'sizing.mode',
        level: 'warning',
        status: 'unprovable',
        expected: specProfile.sizing,
        actual: scriptProfile.sizing,
        message: '仓位语义不足，跳过仓位比对。',
      }
    }

    if (specProfile.sizing.mode !== scriptProfile.sizing.mode) {
      return {
        key: 'sizing.mode',
        level: 'warning',
        status: 'failed',
        expected: specProfile.sizing.mode,
        actual: scriptProfile.sizing.mode,
        message: '脚本仓位模式与 canonical spec 不一致。',
      }
    }

    return {
      key: 'sizing.mode',
      level: 'warning',
      status: 'passed',
      expected: specProfile.sizing.mode,
      actual: scriptProfile.sizing.mode,
      message: '仓位模式一致。',
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

  private buildRuleMappings(spec: CanonicalStrategySpec): StrategySemanticProfile['ruleMappings'] {
    const hasBollinger = spec.indicators.some(item => item.kind === 'bollingerBands')
    if (!hasBollinger) {
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
    }

    spec.entries.forEach(rule => register(rule.trigger, rule.action))
    spec.exits.forEach(rule => register(rule.trigger, rule.action))

    return Array.from(mappings.entries()).map(([key, action]) => ({ key, action }))
  }
}
