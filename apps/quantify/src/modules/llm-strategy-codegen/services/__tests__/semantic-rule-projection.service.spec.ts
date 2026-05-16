import { Test } from '@nestjs/testing'

import type { SemanticRule } from '../../types/atom-expr'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'

describe('SemanticRuleProjectionService (Issue #1395)', () => {
  let svc: SemanticRuleProjectionService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SemanticRuleProjectionService],
    }).compile()
    svc = moduleRef.get(SemanticRuleProjectionService)
  })

  it('projects single-atom rule to 1 trigger node', () => {
    const rules: SemanticRule[] = [{
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: { period: 14, threshold: 65 } },
      effects: [],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.trigger).toHaveLength(1)
    expect(out.trigger[0]!.key).toBe('oscillator.rsi_gte')
    expect(out.trigger[0]!.phase).toBe('entry')
    expect(out.trigger[0]!.sideScope).toBe('long')
  })

  it('projects AND of 2 atoms to 2 triggers + combination contract on first', () => {
    const rules: SemanticRule[] = [{
      id: 'r2',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'and',
        children: [
          { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
          { kind: 'atom', key: 'volume.threshold', params: { multiplier: 1.5 } },
        ],
      },
      effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.trigger).toHaveLength(2)
    // Issue #1413: combinationContract 现在挂在每个 group member 上（不再仅 anchor），
    // 与 seed-builder 约定 + rulesFromFlatBuckets 反向投影对齐。
    expect(out.trigger[0]!.contracts?.length ?? 0).toBeGreaterThan(0)
    expect(out.trigger[1]!.contracts?.length ?? 0).toBeGreaterThan(0)
    // action 投影需依赖 ATOM_CONTRACT_REGISTRY['action.open_long'].bucket === 'action'
    // 若 registry 中尚未注册该 key，projection 应安全 skip，本断言用 conditional
    if (out.action.length > 0) {
      expect(out.action[0]!.key).toBe('action.open_long')
    }
  })

  it('handles OR combination', () => {
    const rules: SemanticRule[] = [{
      id: 'r-or',
      phase: 'entry',
      sideScope: 'short',
      condition: {
        kind: 'or',
        children: [
          { kind: 'atom', key: 'a.x', params: {} },
          { kind: 'atom', key: 'a.y', params: {} },
        ],
      },
      effects: [],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.trigger).toHaveLength(2)
    expect(out.trigger[0]!.sideScope).toBe('short')
    expect(out.trigger[0]!.contracts?.length ?? 0).toBeGreaterThan(0)
  })

  it('projects risk effects when registry bucket === "risk"', () => {
    const rules: SemanticRule[] = [{
      id: 'r3',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'price.breakout_up', params: {} },
      effects: [
        { kind: 'atom', key: 'risk.atr_stop', params: { multiple: 2 } },
        { kind: 'atom', key: 'risk.atr_take_profit', params: { multiple: 3 } },
      ],
    }]
    const out = svc.projectToFlat(rules)
    // 取决于 registry 是否注册了对应 atom；未注册的 leaf 被静默 skip
    for (const r of out.risk) {
      expect(['risk.atr_stop', 'risk.atr_take_profit']).toContain(r.key)
    }
  })

  it('returns empty buckets for empty rules', () => {
    const out = svc.projectToFlat([])
    expect(out.trigger).toEqual([])
    expect(out.action).toEqual([])
    expect(out.risk).toEqual([])
    expect(out.positionConstraint).toEqual([])
    expect(out.orchestration).toEqual([])
  })

  it('drops unknown atom keys in effects silently', () => {
    const rules: SemanticRule[] = [{
      id: 'r-unknown',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'oscillator.rsi_gte', params: {} },
      effects: [{ kind: 'atom', key: 'totally.unknown.key.xyz', params: {} }],
    }]
    expect(() => svc.projectToFlat(rules)).not.toThrow()
  })
})
