/**
 * Issue #1493 块 A — reprojectFromRules 单测
 *
 * 验证：
 *   - rules 空时不动 flat（保持老 fixture 兼容）
 *   - rules 非空时 flat 等于 projectToFlat(rules)
 *   - 非派生字段（position / contextSlots / orchestrationContracts / updatedAt / rules 本身）
 *     保留原引用或原值
 */
import { Test } from '@nestjs/testing'

import type { SemanticRule } from '../../types/atom-expr'
import type { SemanticState } from '../../types/semantic-state'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'

describe('SemanticRuleProjectionService.reprojectFromRules (Issue #1493)', () => {
  let svc: SemanticRuleProjectionService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SemanticRuleProjectionService],
    }).compile()
    svc = moduleRef.get(SemanticRuleProjectionService)
  })

  function makeBaseState(overrides: Partial<SemanticState> = {}): SemanticState {
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
      ...overrides,
    } as SemanticState
  }

  it('rules 为 undefined → 直接 return 原 state', () => {
    const state = makeBaseState({
      trigger: [{ id: 'pre-existing-trigger', key: 'x', phase: 'entry', params: {}, status: 'locked', source: 'user_explicit', openSlots: [] }] as any,
    })
    const out = svc.reprojectFromRules(state)
    expect(out).toBe(state)
  })

  it('rules 为空数组 → 直接 return 原 state，不清空 flat', () => {
    const state = makeBaseState({
      rules: [],
      trigger: [{ id: 'pre-existing-trigger', key: 'x', phase: 'entry', params: {}, status: 'locked', source: 'user_explicit', openSlots: [] }] as any,
    })
    const out = svc.reprojectFromRules(state)
    expect(out).toBe(state)
    expect(out.trigger).toHaveLength(1)
  })

  it('rules 非空 → flat 等于 projectToFlat(rules) 输出', () => {
    const rules: SemanticRule[] = [{
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, threshold: 65 } },
      effects: [],
    }]
    const state = makeBaseState({ rules })
    const projected = svc.projectToFlat(rules)
    const out = svc.reprojectFromRules(state)

    expect(out.trigger).toEqual(projected.trigger)
    expect(out.action).toEqual(projected.action)
    expect(out.risk).toEqual(projected.risk)
    expect(out.positionConstraint).toEqual(projected.positionConstraint)
    expect(out.orchestration).toEqual(projected.orchestration)
  })

  it('rules 非空 → 非派生字段保留原引用/原值', () => {
    const contextSlots = {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    }
    const orchestrationContracts: any[] = []
    const position = null
    const updatedAt = '2026-05-18T12:34:56Z'
    const rules: SemanticRule[] = [{
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, threshold: 65 } },
      effects: [],
    }]
    const state = makeBaseState({
      rules,
      contextSlots,
      orchestrationContracts,
      position,
      updatedAt,
    })
    const out = svc.reprojectFromRules(state)

    // 非派生字段引用 / 值不变
    expect(out.contextSlots).toBe(contextSlots)
    expect(out.orchestrationContracts).toBe(orchestrationContracts)
    expect(out.position).toBe(position)
    expect(out.updatedAt).toBe(updatedAt)
    expect(out.rules).toBe(rules)
    expect(out.version).toBe(1)
  })

  it('返回新对象引用（不可变语义）', () => {
    const rules: SemanticRule[] = [{
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, threshold: 65 } },
      effects: [],
    }]
    const state = makeBaseState({ rules })
    const out = svc.reprojectFromRules(state)
    expect(out).not.toBe(state)
  })
})
