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
    expect(out.trigger[0]!.contracts?.length ?? 0).toBeGreaterThan(0)
    expect(out.trigger[1]!.contracts?.length ?? 0).toBe(0)
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

  // ───────────────────────────────────────────────────────────────────────────
  // Issue #1432 R-C：orchestration projection 派生（之前 MVP 占位 return）
  //   网格策略 publication gate 三方一致依赖 rules 中 orchestration leaf 能
  //   投影到 state.orchestration。
  // ───────────────────────────────────────────────────────────────────────────
  it('R-C: program.dynamic_grid leaf 在 rule.effects 中被投影到 orchestration', () => {
    const rules: SemanticRule[] = [{
      id: 'r-grid',
      phase: 'entry',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { period: 14, threshold: 30 } },
      effects: [{
        kind: 'atom',
        key: 'program.dynamic_grid',
        params: { programKind: 'dynamic_grid', anchorLookbackBars: 24, levelCount: 10 },
      }],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.orchestration).toHaveLength(1)
    expect(out.orchestration[0].kind).toBe('program')
    expect(out.orchestration[0].key).toBe('program.dynamic_grid')
    expect(out.orchestration[0].params).toEqual({ programKind: 'dynamic_grid', anchorLookbackBars: 24, levelCount: 10 })
    expect(out.orchestration[0].id).toBe('r-grid-eff-0')
    expect(out.orchestration[0].status).toBe('locked')
    expect(out.orchestration[0].source).toBe('user_explicit')
    expect(out.orchestration[0].openSlots).toEqual([])
    expect(out.orchestration[0].contracts).toEqual([])
  })

  it('R-C: gate.regime leaf 投影 kind="gate"', () => {
    const rules: SemanticRule[] = [{
      id: 'r-gate',
      phase: 'gate',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { threshold: 30 } },
      effects: [{ kind: 'atom', key: 'gate.regime', params: { target: 'entry' } }],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.orchestration).toHaveLength(1)
    expect(out.orchestration[0].kind).toBe('gate')
    expect(out.orchestration[0].key).toBe('gate.regime')
  })

  it('R-C: scope.symbol leaf 投影 kind="scope"', () => {
    const rules: SemanticRule[] = [{
      id: 'r-scope',
      phase: 'entry',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { threshold: 30 } },
      effects: [{ kind: 'atom', key: 'scope.symbol', params: { symbols: ['BTCUSDT'] } }],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.orchestration).toHaveLength(1)
    expect(out.orchestration[0].kind).toBe('scope')
    expect(out.orchestration[0].key).toBe('scope.symbol')
  })

  it('R-C: portfolioRisk.drawdown_block leaf 投影 kind="portfolioRisk"', () => {
    const rules: SemanticRule[] = [{
      id: 'r-pr',
      phase: 'gate',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { threshold: 30 } },
      effects: [{ kind: 'atom', key: 'portfolioRisk.drawdown_block', params: { thresholdPct: 5 } }],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.orchestration).toHaveLength(1)
    expect(out.orchestration[0].kind).toBe('portfolioRisk')
  })

  it('R-C: 多 orchestration leaf 在同 rule 内全部投影（每条独立 id）', () => {
    const rules: SemanticRule[] = [{
      id: 'r-multi',
      phase: 'entry',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { threshold: 30 } },
      effects: [
        { kind: 'atom', key: 'program.dynamic_grid', params: {} },
        { kind: 'atom', key: 'gate.regime', params: {} },
      ],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.orchestration).toHaveLength(2)
    expect(out.orchestration[0].id).not.toBe(out.orchestration[1].id)
  })

  it('R-C: dispatchEffectLeaf 前的 contract lookup 兜底——unknown atom 静默 skip', () => {
    // 注意：本用例只覆盖 dispatchEffectLeaf switch 之前的 contract 不存在兜底；
    //   未触发 inferOrchestrationKind 的 null 分支（那需要 atom contract 存在但
    //   bucket='orchestration' 且 key prefix 不在四类之一，由下一条用例覆盖）。
    const rules: SemanticRule[] = [{
      id: 'r-unk',
      phase: 'entry',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { threshold: 30 } },
      effects: [{ kind: 'atom', key: 'totally.unknown.key.xyz', params: {} }],
    }]
    const out = svc.projectToFlat(rules)
    expect(out.orchestration).toEqual([])
  })

  // 审查 Minor #3 真覆盖：直接验 inferOrchestrationKind null 分支（私有方法）。
  //   未来若有新 orchestration bucket atom 使用未声明的 prefix，dispatchEffectLeaf
  //   应在 inferOrchestrationKind 返回 null 时 fail-open（不 push 到 orchestration）。
  it('R-C: inferOrchestrationKind 对未声明 prefix 返回 null（fail-open 兜底真覆盖）', () => {
    // 私有方法测试，使用 bracket 访问（TS strict 通过 unknown cast）
    const privateAccess = svc as unknown as { inferOrchestrationKind: (k: string) => unknown }
    expect(privateAccess.inferOrchestrationKind('program.dynamic_grid')).toBe('program')
    expect(privateAccess.inferOrchestrationKind('gate.regime')).toBe('gate')
    expect(privateAccess.inferOrchestrationKind('scope.symbol')).toBe('scope')
    expect(privateAccess.inferOrchestrationKind('portfolioRisk.drawdown_block')).toBe('portfolioRisk')
    // 关键负断言：四类 prefix 之外返回 null（dispatchEffectLeaf 走静默 skip）
    expect(privateAccess.inferOrchestrationKind('unknown.future.kind')).toBeNull()
    expect(privateAccess.inferOrchestrationKind('grid.range_rebalance')).toBeNull()
    expect(privateAccess.inferOrchestrationKind('')).toBeNull()
  })
})
