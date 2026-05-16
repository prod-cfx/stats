/**
 * Issue #1413 — rulesFromFlatBuckets 反向投影单测
 *
 * 覆盖：
 *   - 单 atom trigger → single-leaf rule
 *   - AND/OR combinationContract group → 组合 rule
 *   - action / risk / positionConstraint effects 挂回 rule（按 id 优先 + phase fallback）
 *   - 空桶 → 空 rules
 *   - Round-trip：rules → SemanticRuleProjectionService.projectToFlat
 *     → rulesFromFlatBuckets → canonicalize → 与原 rules canonical 等价
 */

import type { SemanticRule } from '../atom-expr'
import {
  canonicalizeSemanticRules,
  rulesFromFlatBuckets,
} from '../atom-expr'
import { SemanticRuleProjectionService } from '../../services/semantic-rule-projection.service'
import { buildTriggerCombinationContract } from '../../services/semantic-state-normalization'

describe('rulesFromFlatBuckets (Issue #1413)', () => {
  it('returns [] for fully empty buckets', () => {
    expect(rulesFromFlatBuckets({
      trigger: [],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
    })).toEqual([])
  })

  it('single-atom trigger → 1 single-leaf rule', () => {
    const rules = rulesFromFlatBuckets({
      trigger: [{
        id: 'r1-cond-0',
        key: 'oscillator.rsi_gte',
        phase: 'entry',
        params: { threshold: 65 },
        sideScope: 'long',
      }],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
    })
    expect(rules).toHaveLength(1)
    expect(rules[0]!.phase).toBe('entry')
    expect(rules[0]!.sideScope).toBe('long')
    expect(rules[0]!.condition).toEqual({
      kind: 'atom',
      key: 'oscillator.rsi_gte',
      params: { threshold: 65 },
      sideScope: 'long',
    })
    expect(rules[0]!.id).toBe('r1') // 从 trigger.id `r1-cond-0` 反推
  })

  it('two triggers sharing AND combinationContract → 1 AND rule', () => {
    const contract = buildTriggerCombinationContract({
      groupId: 'rule-r-and-grp',
      join: 'AND',
      phase: 'entry',
      sideScope: 'long',
    })
    const rules = rulesFromFlatBuckets({
      trigger: [
        {
          id: 'r-and-cond-0',
          key: 'bollinger.touch_lower',
          phase: 'entry',
          params: {},
          sideScope: 'long',
          contracts: [contract],
        },
        {
          id: 'r-and-cond-1',
          key: 'volume.threshold',
          phase: 'entry',
          params: { multiplier: 1.5 },
          sideScope: 'long',
          contracts: [contract],
        },
      ],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
    })
    expect(rules).toHaveLength(1)
    expect(rules[0]!.id).toBe('r-and')
    expect(rules[0]!.condition.kind).toBe('and')
    if (rules[0]!.condition.kind === 'and') {
      expect(rules[0]!.condition.children).toHaveLength(2)
      expect(rules[0]!.condition.children[0]!).toMatchObject({
        kind: 'atom',
        key: 'bollinger.touch_lower',
      })
      expect(rules[0]!.condition.children[1]!).toMatchObject({
        kind: 'atom',
        key: 'volume.threshold',
        params: { multiplier: 1.5 },
      })
    }
  })

  it('OR combinationContract → OR condition', () => {
    const contract = buildTriggerCombinationContract({
      groupId: 'rule-r-or-grp',
      join: 'OR',
      phase: 'entry',
      sideScope: 'short',
    })
    const rules = rulesFromFlatBuckets({
      trigger: [
        { id: 'r-or-cond-0', key: 'a.x', phase: 'entry', params: {}, sideScope: 'short', contracts: [contract] },
        { id: 'r-or-cond-1', key: 'a.y', phase: 'entry', params: {}, sideScope: 'short', contracts: [contract] },
      ],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
    })
    expect(rules).toHaveLength(1)
    expect(rules[0]!.condition.kind).toBe('or')
    expect(rules[0]!.sideScope).toBe('short')
  })

  it('effect.id `${ruleId}-eff-${i}` → 挂回原 rule.effects', () => {
    const rules = rulesFromFlatBuckets({
      trigger: [
        { id: 'rE-cond-0', key: 'price.breakout_up', phase: 'entry', params: {}, sideScope: 'long' },
      ],
      action: [{ id: 'rE-eff-0', key: 'action.open_long', params: {} }],
      risk: [{ id: 'rE-eff-1', key: 'risk.atr_stop', params: { multiple: 2 } }],
      positionConstraint: [],
      orchestration: [],
    })
    expect(rules).toHaveLength(1)
    expect(rules[0]!.id).toBe('rE')
    expect(rules[0]!.effects).toHaveLength(2)
    const keys = rules[0]!.effects.map(e => e.kind === 'atom' ? e.key : '')
    expect(keys).toContain('action.open_long')
    expect(keys).toContain('risk.atr_stop')
  })

  it('effect 无 id 匹配时按 phase fallback：risk → exit rule', () => {
    const rules = rulesFromFlatBuckets({
      trigger: [
        { id: 'entry-trigger', key: 'price.breakout_up', phase: 'entry', params: {}, sideScope: 'long' },
        { id: 'exit-trigger', key: 'price.breakdown', phase: 'exit', params: {}, sideScope: 'long' },
      ],
      action: [],
      risk: [{ id: 'orphan-risk', key: 'risk.atr_stop', params: { multiple: 2 } }],
      positionConstraint: [],
      orchestration: [],
    })
    // 'risk' bucket fallback → 第一个 phase='exit' 的 rule
    const exitRule = rules.find(r => r.phase === 'exit')
    expect(exitRule).toBeDefined()
    expect(exitRule!.effects).toHaveLength(1)
    expect(exitRule!.effects[0]).toMatchObject({ kind: 'atom', key: 'risk.atr_stop' })
  })

  it('effect 无 rule 可挂时丢弃孤儿 effect（不伪造 ghost rule）', () => {
    // 反 M1：旧实现把 action atom 当作 condition 塞进新 rule，违反 condition 的
    // trigger/predicate 语义契约。当前正确行为：丢弃孤儿 effect，返回空 rules。
    const rules = rulesFromFlatBuckets({
      trigger: [],
      action: [{ id: 'lone-action', key: 'action.open_long', params: {} }],
      risk: [],
      positionConstraint: [],
      orchestration: [],
    })
    expect(rules).toEqual([])
  })

  it('trigger `risk` phase → rule phase `gate`（已知有损映射）', () => {
    // SemanticRulePhase 域无 'risk'；rules-first 派生时映射为 'gate'。
    const rules = rulesFromFlatBuckets({
      trigger: [{ id: 'risk-gate-cond-0', key: 'risk.gate', phase: 'risk', params: {}, sideScope: 'both' }],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
    })
    expect(rules[0]!.phase).toBe('gate')
  })

  it('round-trip 显式 negative：risk-phase trigger 经 reverse → forward 后丢失 `risk` 标记', () => {
    // 反 M2：当前 rule.phase 域无 'risk'，所以 trigger.phase='risk' 经
    // rulesFromFlatBuckets → SemanticRuleProjectionService.projectToFlat 来回后
    // 会变成 trigger.phase='gate'。该测试显式锁定该已知有损行为；若未来扩
    // SemanticRulePhase 支持 'risk'，本断言会失败，提示同步修订映射策略与文档。
    const { SemanticRuleProjectionService } = require('../../services/semantic-rule-projection.service')
    const projector = new SemanticRuleProjectionService()
    const input = {
      trigger: [{
        id: 'orig-risk-cond-0',
        key: 'risk.atr_stop',
        phase: 'risk' as const,
        params: { multiple: 2 },
        sideScope: 'both' as const,
      }],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
    }
    const rules = rulesFromFlatBuckets(input)
    expect(rules[0]!.phase).toBe('gate')
    const flatBack = projector.projectToFlat(rules)
    expect(flatBack.trigger[0]!.phase).toBe('gate') // 期望：信息丢失（不是 'risk'）
  })

  it('positionConstraint 桶按 id 挂回 rule', () => {
    const rules = rulesFromFlatBuckets({
      trigger: [{ id: 'rPC-cond-0', key: 'price.breakout_up', phase: 'entry', params: {}, sideScope: 'long' }],
      action: [],
      risk: [],
      positionConstraint: [{ id: 'rPC-eff-0', key: 'position.pyramiding_limit', params: { limit: 3 } }],
      orchestration: [],
    })
    expect(rules).toHaveLength(1)
    expect(rules[0]!.effects).toHaveLength(1)
    expect(rules[0]!.effects[0]).toMatchObject({ kind: 'atom', key: 'position.pyramiding_limit' })
  })
})

describe('rulesFromFlatBuckets — round-trip via SemanticRuleProjectionService', () => {
  const projector = new SemanticRuleProjectionService()

  function roundTrip(rules: SemanticRule[]): SemanticRule[] {
    const flat = projector.projectToFlat(rules)
    return rulesFromFlatBuckets(flat)
  }

  function expectRoundTripEqualUnderCanonical(rules: SemanticRule[]): void {
    const back = roundTrip(rules)
    expect(canonicalizeSemanticRules(back)).toEqual(canonicalizeSemanticRules(rules))
  }

  it('round-trip: 单 atom rule（无 effects）', () => {
    const rules: SemanticRule[] = [{
      id: 'r-single',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, threshold: 65 } },
      effects: [],
    }]
    expectRoundTripEqualUnderCanonical(rules)
  })

  it('round-trip: AND 双叶 rule', () => {
    const rules: SemanticRule[] = [{
      id: 'r-and-2',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'and',
        children: [
          { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          { kind: 'atom', key: 'volume.threshold', params: { multiplier: 1.5 } },
        ],
      },
      effects: [],
    }]
    expectRoundTripEqualUnderCanonical(rules)
  })

  it('round-trip: OR 三叶 rule', () => {
    const rules: SemanticRule[] = [{
      id: 'r-or-3',
      phase: 'entry',
      sideScope: 'short',
      condition: {
        kind: 'or',
        children: [
          { kind: 'atom', key: 'a.x', params: {} },
          { kind: 'atom', key: 'a.y', params: {} },
          { kind: 'atom', key: 'a.z', params: { foo: 1 } },
        ],
      },
      effects: [],
    }]
    expectRoundTripEqualUnderCanonical(rules)
  })

  it('round-trip: 多 rule + 已注册 effects（risk）', () => {
    const rules: SemanticRule[] = [
      {
        id: 'r-entry',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { threshold: 70 } },
        effects: [],
      },
      {
        id: 'r-exit',
        phase: 'exit',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { threshold: 30 } },
        effects: [],
      },
    ]
    // 这里不带 effects（registry 未必都注册 effects atoms 与 bucket）；
    // 已注册 effects 的 round-trip 由专门的 fixture spec 覆盖。
    expectRoundTripEqualUnderCanonical(rules)
  })

  it('round-trip: AND + OR 混合（多 rule）', () => {
    const rules: SemanticRule[] = [
      {
        id: 'r-and-mix',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'a.x', params: {} },
            { kind: 'atom', key: 'a.y', params: {} },
          ],
        },
        effects: [],
      },
      {
        id: 'r-or-mix',
        phase: 'exit',
        sideScope: 'long',
        condition: {
          kind: 'or',
          children: [
            { kind: 'atom', key: 'b.x', params: {} },
            { kind: 'atom', key: 'b.y', params: {} },
          ],
        },
        effects: [],
      },
    ]
    expectRoundTripEqualUnderCanonical(rules)
  })
})
