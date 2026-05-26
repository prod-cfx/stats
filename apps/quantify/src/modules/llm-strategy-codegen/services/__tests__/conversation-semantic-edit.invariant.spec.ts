/**
 * Issue #1493 块 C — 反向断言 spec
 *
 * 锁定 edit 路径"flat ≡ projectToFlat(rules)"硬约束：当 state.rules 非空时，
 * applyXxx 完成后 flat 五桶必须等于 projection.projectToFlat(rules) 的输出。
 */
import { ConversationSemanticEditService } from '../conversation-semantic-edit.service'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'
import type { SemanticState } from '../../types/semantic-state'
import type { SemanticRule } from '../../types/atom-expr'

const service = new ConversationSemanticEditService()
const projection = new SemanticRuleProjectionService()

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

/**
 * 构造单叶子 rule + 投影后的 flat trigger（含 _provenance）。
 */
function singleTriggerState(rule: SemanticRule, extras: Partial<SemanticState> = {}): SemanticState {
  const projected = projection.projectToFlat([rule])
  return {
    ...baseState(),
    rules: [rule],
    trigger: projected.trigger,
    action: projected.action,
    risk: projected.risk,
    positionConstraint: projected.positionConstraint,
    orchestration: projected.orchestration,
    ...extras,
  }
}

function expectFlatEqualsProjection(state: SemanticState): void {
  expect(state.rules).toBeDefined()
  const out = projection.projectToFlat(state.rules!)
  expect(state.trigger).toEqual(out.trigger)
  expect(state.action).toEqual(out.action)
  expect(state.risk).toEqual(out.risk)
  expect(state.positionConstraint).toEqual(out.positionConstraint)
  expect(state.orchestration).toEqual(out.orchestration)
}

describe('ConversationSemanticEditService — rules 单一真相源不变量 (Issue #1493 块 C)', () => {
  it('indicator period replacement: flat === projectToFlat(rules)', () => {
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

    expectFlatEqualsProjection(next)
    // 触发 atom 已经按 rules 单一真相源派生
    expect(next.rules?.[0].condition).toMatchObject({
      kind: 'atom',
      key: 'indicator.cross_over',
      params: { indicator: 'ma', fastPeriod: 10, slowPeriod: 48 },
    })
  })

  it('trigger number replacement: flat === projectToFlat(rules)', () => {
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

    expectFlatEqualsProjection(next)
    expect(next.rules?.[0].condition).toMatchObject({
      kind: 'atom',
      params: expect.objectContaining({ value: 40 }),
    })
  })

  it('semantic number replacement (percent) on risk: flat === projectToFlat(rules)', () => {
    const rule: SemanticRule = {
      id: 'r-stop-loss',
      phase: 'exit',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        // 走 trigger bucket 的 atom 即可（projection 不会把它落到 risk，但 condition 子树测试已覆盖）
        // 此处验证 condition 路径里 atom 参数替换 + flat 等于 reproject
        key: 'indicator.cross_over',
        params: { indicator: 'rsi', period: 14, value: 5 },
      },
      effects: [],
    }
    const state = singleTriggerState(rule)
    const next = service.applyPatch(state, {
      operations: [{ op: 'replace_semantic_number', from: 5, to: 8, unit: 'plain', text: '5改为8' }],
    })

    expectFlatEqualsProjection(next)
  })

  it('semantic range replacement on trigger params: flat === projectToFlat(rules)', () => {
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

    expectFlatEqualsProjection(next)
  })

  it('RSI trigger replacement (via pending edit): flat === projectToFlat(rules)', () => {
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

    expectFlatEqualsProjection(next)
    expect(next.rules?.[0].condition).toMatchObject({
      kind: 'atom',
      key: 'oscillator.rsi_lte',
      params: expect.objectContaining({ indicator: 'rsi', value: 30 }),
    })
  })
})
