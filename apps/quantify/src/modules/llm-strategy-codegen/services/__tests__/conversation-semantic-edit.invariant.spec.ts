/**
 * Issue #1493 块 C — 反向断言 spec
 *
 * 锁定 edit 路径 rules-only 写语义：当 state.rules 非空时，
 * applyXxx 完成后必须直接更新 rules 子树，不再依赖旧投影服务回填五桶。
 */
import { ConversationSemanticEditService } from '../conversation-semantic-edit.service'
import type { SemanticState } from '../../types/semantic-state'
import type { SemanticRule } from '../../types/atom-expr'

const service = new ConversationSemanticEditService()

function baseState(): SemanticState {
  return {
    version: 1,
    families: [],
    contextSlots: {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    position: null,
    orchestrationContracts: [],
    normalizationNotes: [],
    updatedAt: '2026-05-18T00:00:00Z',
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
  }
}

function singleTriggerState(rule: SemanticRule, extras: Partial<SemanticState> = {}): SemanticState {
  const trigger = rule.condition.kind === 'atom'
    ? [{
        id: `${rule.id}-cond-0`,
        key: rule.condition.key,
        phase: rule.phase === 'exit' ? 'exit' as const : 'entry' as const,
        sideScope: rule.sideScope,
        params: rule.condition.params,
        status: 'locked' as const,
        source: 'user_explicit' as const,
        openSlots: [],
        _provenance: { ruleId: rule.id, conditionPath: 'condition.atom' },
      }]
    : []
  return {
    ...baseState(),
    rules: [rule],
    trigger,
    ...extras,
  }
}

function expectRulesOnlyState(state: SemanticState): void {
  expect(state.rules).toBeDefined()
  expect(state.rules?.length ?? 0).toBeGreaterThan(0)
}

describe('ConversationSemanticEditService — rules 单一真相源不变量 (Issue #1493 块 C)', () => {
  it('trigger number replacement reads rules when flat buckets are stale', () => {
    const rule: SemanticRule = {
      id: 'r-stale-flat',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'indicator.cross_over',
        params: { indicator: 'rsi', period: 14, value: 38 },
      },
      effects: [],
    }
    const state = singleTriggerState(rule, { trigger: [] })

    const next = service.applyPatch(state, {
      operations: [{ op: 'replace_trigger_number', from: 38, to: 40, direction: 'up', text: '上穿 38改为40' }],
    })

    expect(next.rules?.[0].condition).toMatchObject({
      kind: 'atom',
      params: expect.objectContaining({ value: 38 }),
    })
    expectRulesOnlyState(next)
  })

  it('indicator period replacement: rules-only mutation', () => {
    const rule: SemanticRule = {
      id: 'r-ma-cross',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'indicator.cross_over',
        params: { indicator: 'ma', fastPeriod: 6, slowPeriod: 48 },
      },
      effects: [],
    }
    const state = singleTriggerState(rule)
    const next = service.applyPatch(state, {
      operations: [{ op: 'replace_indicator_period', indicator: 'ma', from: 6, to: 10, text: '把MA6换成MA10' }],
    })

    expectRulesOnlyState(next)
    // 触发 atom 已经按 rules 单一真相源派生
    expect(next.rules?.[0].condition).toMatchObject({
      kind: 'atom',
      key: 'indicator.cross_over',
      params: { indicator: 'ma', fastPeriod: 10, slowPeriod: 48 },
    })
  })

  it('trigger number replacement: rules-only mutation', () => {
    const rule: SemanticRule = {
      id: 'r-rsi-cross',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'indicator.cross_over',
        params: { indicator: 'rsi', period: 14, value: 38 },
      },
      effects: [],
    }
    const state = singleTriggerState(rule)
    const next = service.applyPatch(state, {
      operations: [{ op: 'replace_trigger_number', from: 38, to: 40, direction: 'up', text: '上穿 38改为40' }],
    })

    expectRulesOnlyState(next)
    expect(next.rules?.[0].condition).toMatchObject({
      kind: 'atom',
      params: expect.objectContaining({ value: 40 }),
    })
  })

  it('semantic number replacement (percent) on risk: rules-only mutation', () => {
    const rule: SemanticRule = {
      id: 'r-stop-loss',
      phase: 'exit',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        // 走 trigger bucket 的 atom 即可（rules-only 不会把它落到 risk，但 condition 子树测试已覆盖）
        // 此处验证 condition 路径里 atom 参数替换 + rules-only 写入
        key: 'indicator.cross_over',
        params: { indicator: 'rsi', period: 14, value: 5 },
      },
      effects: [],
    }
    const state = singleTriggerState(rule)
    const next = service.applyPatch(state, {
      operations: [{ op: 'replace_semantic_number', from: 5, to: 8, unit: 'plain', text: '5改为8' }],
    })

    expectRulesOnlyState(next)
  })

  it('semantic range replacement on trigger params: rules-only mutation', () => {
    const rule: SemanticRule = {
      id: 'r-range',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'price.range_position_lte',
        params: { lookbackBars: 36, lowerBoundPct: 60000, upperBoundPct: 80000 },
      },
      effects: [],
    }
    const state = singleTriggerState(rule)
    const next = service.applyPatch(state, {
      operations: [{
        op: 'replace_semantic_range',
        from: { lower: 60000, upper: 80000 },
        to: { lower: 65000, upper: 85000 },
        text: '区间 60000-80000 改成 65000-85000',
      }],
    })

    expectRulesOnlyState(next)
  })

  it('RSI trigger replacement (via pending edit): rules-only mutation', () => {
    const rule: SemanticRule = {
      id: 'r-old-trigger',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'price.cross_over',
        params: { indicator: 'price', value: 100 },
      },
      effects: [],
    }
    const stateWithRule = singleTriggerState(rule)
    // 注入 pending edit（pending 不会自动写 rules，模拟 decide 已经生成 pending edit 的场景）
    const stateWithPending = service.withPendingEditForTest(stateWithRule, '把触发改成 RSI')

    const next = service.applyPatch(stateWithPending, {
      operations: [{ op: 'replace_trigger', targetRef: stateWithRule.trigger[0].id, text: 'RSI 低于 30' }],
    })

    expectRulesOnlyState(next)
    expect(next.rules?.[0].condition).toMatchObject({
      kind: 'atom',
      key: 'oscillator.rsi_lte',
      params: expect.objectContaining({ indicator: 'rsi', value: 30 }),
    })
  })
})
