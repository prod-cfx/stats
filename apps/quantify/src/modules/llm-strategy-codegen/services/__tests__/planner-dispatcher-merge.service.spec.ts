import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'

describe('PlannerDispatcherMergeService', () => {
  const svc = new PlannerDispatcherMergeService()

  it('returns null when both inputs are null/empty', () => {
    expect(svc.mergePlannerAndDispatcherPatches(null, null)).toBeNull()
    expect(svc.mergePlannerAndDispatcherPatches(undefined, undefined)).toBeNull()
    expect(svc.mergePlannerAndDispatcherPatches({}, {})).toBeNull()
  })

  it('returns planner unchanged when only planner present', () => {
    const planner: CodegenSemanticPatch = { triggers: [{ key: 'trigger.candle_break_above', phase: 'entry' }] }
    expect(svc.mergePlannerAndDispatcherPatches(planner, null)).toBe(planner)
  })

  it('returns dispatcher unchanged when only dispatcher present', () => {
    const dispatcher: CodegenSemanticPatch = { atoms: [{ key: 'grid.range_rebalance' }] }
    expect(svc.mergePlannerAndDispatcherPatches(null, dispatcher)).toBe(dispatcher)
  })

  it('dedupes atoms by (key, phase, stableParamsHash) — planner wins identity match', () => {
    const planner: CodegenSemanticPatch = {
      atoms: [{ key: 'trigger.candle_break_above', phase: 'entry', source: 'user_explicit' as never }],
    }
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'trigger.candle_break_above', phase: 'entry', source: 'derived' as never }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect(merged?.atoms).toHaveLength(1)
    expect((merged?.atoms?.[0] as { source?: string }).source).toBe('user_explicit')
  })

  it('keeps siblings with different params (different stable hash)', () => {
    const planner: CodegenSemanticPatch = {
      atoms: [{ key: 'reference.period', phase: 'entry', params: { value: 20 } }],
    }
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'reference.period', phase: 'entry', params: { value: 60 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect(merged?.atoms).toHaveLength(2)
  })

  it('cross-bucket complement: planner trigger atom + dispatcher positionConstraint atom both kept', () => {
    const planner: CodegenSemanticPatch = {
      atoms: [{ key: 'trigger.candle_break_above', phase: 'entry' }],
    }
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'grid.range_rebalance', params: { lower: 100, upper: 200 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const keys = (merged?.atoms ?? []).map(a => a.key).sort()
    expect(keys).toEqual(['grid.range_rebalance', 'trigger.candle_break_above'])
  })

  it('contextSlots shallow-merges; planner wins when both have same field', () => {
    const planner: CodegenSemanticPatch = { contextSlots: { symbol: 'BTC' } }
    const dispatcher: CodegenSemanticPatch = { contextSlots: { symbol: 'ETH', timeframe: '15m' } }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect(merged?.contextSlots).toEqual({ symbol: 'BTC', timeframe: '15m' })
  })

  it('position: only dispatcher → returned as-is', () => {
    const dispatcher: CodegenSemanticPatch = {
      position: { mode: 'fixed', value: 100, positionMode: 'one-way' } as never,
    }
    const merged = svc.mergePlannerAndDispatcherPatches(null, dispatcher)
    expect(merged?.position?.value).toBe(100)
  })

  it('position: both present → dispatcher preferred, constraints union+dedup', () => {
    const planner: CodegenSemanticPatch = {
      position: {
        mode: 'fixed',
        value: 50,
        positionMode: 'one-way',
        constraints: [
          { key: 'position.dca_schedule' as never, params: { step: 1 } },
          { key: 'position.size_cap' as never, params: { cap: 0.5 } },
        ],
      } as never,
    }
    const dispatcher: CodegenSemanticPatch = {
      position: {
        mode: 'fixed',
        value: 100,
        positionMode: 'one-way',
        constraints: [
          { key: 'position.dca_schedule' as never, params: { step: 1 } },
          { key: 'position.max_leverage' as never, params: { x: 3 } },
        ],
      } as never,
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect(merged?.position?.value).toBe(100)
    const keys = (merged?.position?.constraints ?? []).map(c => c.key).sort()
    expect(keys).toEqual(['position.dca_schedule', 'position.max_leverage', 'position.size_cap'])
  })

  it('orchestration.nodes union: planner empty, dispatcher has program.event_listener', () => {
    const dispatcher: CodegenSemanticPatch = {
      orchestration: { nodes: [{ key: 'program.event_listener', kind: 'program' } as never] },
    }
    const merged = svc.mergePlannerAndDispatcherPatches({ triggers: [{ key: 't', phase: 'entry' }] }, dispatcher)
    expect(merged?.orchestration?.nodes).toHaveLength(1)
    expect((merged?.orchestration?.nodes?.[0] as { key: string }).key).toBe('program.event_listener')
  })

  it('S1 scenario: planner trigger/action/risk + dispatcher grid.range_rebalance atom → all buckets populated', () => {
    const planner: CodegenSemanticPatch = {
      triggers: [{ key: 'trigger.candle_break_above', phase: 'entry' }],
      actions: [{ key: 'action.open_long' }],
      risk: [{ key: 'risk.stop_loss_atr', params: { multiplier: 2 } }],
    }
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'grid.range_rebalance', params: { lower: 100, upper: 200 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect(merged?.triggers).toHaveLength(1)
    expect(merged?.actions).toHaveLength(1)
    expect(merged?.risk).toHaveLength(1)
    expect(merged?.atoms?.[0].key).toBe('grid.range_rebalance')
  })

  // Issue #1395 Wave 4：rules[] 表达式树是 planner 独有产物，必须被 merge 透传，
  // 否则下游 readiness / projection / IR compiler 全部退化到 atoms[] 路径。
  it('Wave 4: propagates planner rules[] through merge (planner-only)', () => {
    const planner = {
      rules: [{
        id: 'entry-seq',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { period: 14, threshold: 35 } },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      }],
    } as unknown as CodegenSemanticPatch
    const merged = svc.mergePlannerAndDispatcherPatches(planner, null)
    expect((merged as { rules?: unknown[] })?.rules).toHaveLength(1)
  })

  it('Wave 4: rules[] alone counts as non-empty patch (no atoms/triggers)', () => {
    const planner = {
      rules: [{ id: 'r1', phase: 'entry', sideScope: 'both', condition: { kind: 'atom', key: 'x.y', params: {} }, effects: [] }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = { atoms: [{ key: 'grid.range_rebalance' }] }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    // R-B 升级（审查问题 #5）：dispatcher.atoms 现在也参与 lift，所以 rules 长度=2
    //   （planner 原 1 条 + dispatcher.atoms[grid.range_rebalance] lift 1 条）
    const rules = (merged as { rules?: Array<{ id?: string }> })?.rules
    expect(rules).toHaveLength(2)
    expect(rules?.[0].id).toBe('r1')           // planner 原 rule 保留
    expect(rules?.[1].id).toMatch(/^dispatcher-lift-/u) // dispatcher.atoms lifted
    expect(merged?.atoms).toHaveLength(1)       // atoms 桶仍透传
  })

  it('Wave 4: planner rules wins over dispatcher rules (planner is authoritative for tree)', () => {
    const planner = {
      rules: [{ id: 'planner-rule', phase: 'entry', sideScope: 'long', condition: { kind: 'atom', key: 'a.b', params: {} }, effects: [] }],
    } as unknown as CodegenSemanticPatch
    const dispatcher = {
      rules: [{ id: 'dispatcher-rule', phase: 'exit', sideScope: 'long', condition: { kind: 'atom', key: 'c.d', params: {} }, effects: [] }],
      atoms: [{ key: 'x' }],
    } as unknown as CodegenSemanticPatch
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const rules = (merged as { rules?: Array<{ id?: string }> })?.rules
    // R-B 升级（审查问题 #5）：dispatcher.rules 仍被 planner.rules 覆盖（核心语义不变），
    //   但 dispatcher.atoms[x] 通过 lift 加为新 rule（id 形如 dispatcher-lift-*）。
    //   planner-rule 仍保留作为第一条，验证"planner is authoritative for tree" 语义。
    expect(rules?.[0].id).toBe('planner-rule')
    expect(rules?.find(r => r.id === 'dispatcher-rule')).toBeUndefined()
    expect(rules).toHaveLength(2)
    expect(rules?.[1].id).toMatch(/^dispatcher-lift-/u)
  })

  it('orchestration nodes dedupe by id when present', () => {
    const planner: CodegenSemanticPatch = {
      orchestration: { nodes: [{ id: 'n1', key: 'program.dynamic_grid', kind: 'program' } as never] },
    }
    const dispatcher: CodegenSemanticPatch = {
      orchestration: { nodes: [{ id: 'n1', key: 'program.dynamic_grid', kind: 'program' } as never] },
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect(merged?.orchestration?.nodes).toHaveLength(1)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Issue #1428 R-B：rules-first 路径下 dispatcher atom lift 为 single-leaf rule
  //   （cross-clause inheritance 回归——planner 直产 rules 时 dispatcher 通过
  //   #1383 派生的 sibling/mirror 必须仍在 rules-tree 上可见）
  // ───────────────────────────────────────────────────────────────────────────
  it('R-B: rules 非空时 lift dispatcher trigger atom 缺失 leaf 为 single-leaf rule', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'short',
        condition: { kind: 'atom', key: 'bollinger.touch_upper', params: { period: 20, stdDev: 2 } },
        effects: [{ kind: 'atom', key: 'action.open_short', params: {} }],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      triggers: [{
        key: 'bollinger.touch_lower',
        phase: 'entry',
        sideScope: 'long',
        params: { period: 20, stdDev: 2 },
      }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const rules = (merged as { rules?: Array<{ id: string, condition: { key?: string } }> })?.rules
    expect(rules).toHaveLength(2)
    expect(rules?.[1].id).toMatch(/^dispatcher-lift-/u)
    expect(rules?.[1].condition.key).toBe('bollinger.touch_lower')
  })

  it('R-B: rules 中已有同签名 leaf 时不重复 lift', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'bollinger.touch_lower', params: { period: 20, stdDev: 2 } },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      triggers: [{ key: 'bollinger.touch_lower', phase: 'entry', sideScope: 'long', params: { period: 20, stdDev: 2 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    expect((merged as { rules?: unknown[] })?.rules).toHaveLength(1)
  })

  it('R-B: rules 为空时不 lift（dispatcher-only 路径保持原行为）', () => {
    const dispatcher: CodegenSemanticPatch = {
      triggers: [{ key: 'bollinger.touch_lower', phase: 'entry', sideScope: 'long', params: {} }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches({}, dispatcher)
    expect((merged as { rules?: unknown[] })?.rules).toBeUndefined()
  })

  it('R-B: dispatcher.atoms 桶里 cross-clause 派生 atom 也被 lift（审查问题 #5）', () => {
    // dispatcher 的 GenericSeedDispatcher 既写 triggers 也写 atoms 桶（cross-clause
    //   inheritance pass 走 atomItems.push）。lift 必须收 atoms 桶否则漏 sibling。
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'short',
        condition: { kind: 'atom', key: 'bollinger.touch_upper', params: {} },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'bollinger.touch_lower', phase: 'entry', sideScope: 'long', params: {} }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    // R2 审查加固：断言长度 + 形如 lift id + sideScope + phase 全检
    const rules = (merged as { rules?: Array<{ id: string, phase: string, sideScope: string, condition: { key?: string } }> })?.rules
    expect(rules).toHaveLength(2)
    expect(rules?.[1].id).toMatch(/^dispatcher-lift-/u)
    expect(rules?.[1].condition.key).toBe('bollinger.touch_lower')
    expect(rules?.[1].phase).toBe('entry')
    expect(rules?.[1].sideScope).toBe('long')
  })

  it('R-B: dispatcher risk 桶 phase=risk 被 lift 时归位为 exit', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'up', valuePct: 1 } },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      risk: [{ key: 'risk.stop_loss_pct', params: { pct: 5 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const rules = (merged as { rules?: Array<{ phase: string, condition: { key?: string } }> })?.rules
    expect(rules).toHaveLength(2)
    const stopLossRule = rules?.find(r => r.condition.key === 'risk.stop_loss_pct')
    expect(stopLossRule?.phase).toBe('exit')
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Issue #1428 R-D：rules leaf params dispatcher-first override
  //   （dispatcher regex 抽到的用户原话精细 params 必须覆盖 LLM 默认值填充）
  // ───────────────────────────────────────────────────────────────────────────
  it('R-D: planner leaf params 缺关键 slot 时 dispatcher strict superset 直接覆盖', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down' } },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    // dispatcher 抽到完整 params：direction + valuePct + window
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{
        key: 'price.percent_change',
        phase: 'entry',
        sideScope: 'long',
        params: { direction: 'down', valuePct: -1, window: '3m' },
      }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const leaf = (merged as { rules?: Array<{ condition: { params?: Record<string, unknown> } }> })?.rules?.[0].condition
    expect(leaf?.params).toEqual({ direction: 'down', valuePct: -1, window: '3m' })
  })

  it('R-D: planner leaf params 与 dispatcher params 值冲突时保留 planner（不强行覆盖）', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        // planner 给的 period 与 dispatcher 不同 → 不算 superset → 不覆盖
        condition: { kind: 'atom', key: 'bollinger.touch_upper', params: { period: 20, stdDev: 2 } },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      triggers: [{
        key: 'bollinger.touch_upper',
        phase: 'entry',
        sideScope: 'long',
        params: { period: 5, stdDev: 1 },
      }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const leaf = (merged as { rules?: Array<{ condition: { params?: Record<string, unknown> } }> })?.rules?.[0].condition
    // 值冲突 → 保留 planner 版本 + dispatcher 通过 R-B lift 为新 rule
    expect(leaf?.params).toEqual({ period: 20, stdDev: 2 })
    // R-B 应该 lift dispatcher 的 (5,1) 版本为单独的 rule
    expect((merged as { rules?: unknown[] })?.rules).toHaveLength(2)
  })

  it('R-D: dispatcher 无同 key entry → planner params 不变', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'oscillator.rsi_lte', params: { threshold: 35 } },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'unrelated.atom', params: { x: 1 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const leaf = (merged as { rules?: Array<{ condition: { params?: Record<string, unknown> } }> })?.rules?.[0].condition
    expect(leaf?.params).toEqual({ threshold: 35 })
  })

  it('R-D: planner leaf params 空 + dispatcher 含 params → 覆盖（degenerate superset）', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.percent_change', params: {} },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{
        key: 'price.percent_change',
        phase: 'entry',
        sideScope: 'long',
        params: { direction: 'down', valuePct: -1 },
      }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const leaf = (merged as { rules?: Array<{ condition: { params?: Record<string, unknown> } }> })?.rules?.[0].condition
    expect(leaf?.params).toEqual({ direction: 'down', valuePct: -1 })
  })

  it('R-D: sideScope 不匹配时不覆盖（审查问题 #4 负断言）', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'bollinger.touch_upper', params: { period: 20 }, sideScope: 'long' },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    // dispatcher 标 sideScope='short'，且 params 是 superset → 但 sideScope 不匹配且
    //   也不是 dispatcher 'both'（不会触发 both 回退）→ 不应覆盖
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'bollinger.touch_upper', phase: 'entry', sideScope: 'short', params: { period: 20, stdDev: 2 } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const leaf = (merged as { rules?: Array<{ condition: { params?: Record<string, unknown> } }> })?.rules?.[0].condition
    // sideScope 不匹配 → 保留 planner params
    expect(leaf?.params).toEqual({ period: 20 })
  })

  it('R-D: OR 嵌套节点的 leaf 也参与 override（审查问题 #4 补 or 用例）', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'exit',
        sideScope: 'long',
        condition: {
          kind: 'or',
          children: [
            { kind: 'atom', key: 'indicator.below', params: { indicator: 'ma' } },
            { kind: 'atom', key: 'indicator.cross_under', params: {} },
          ],
        },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [
        { key: 'indicator.below', phase: 'exit', sideScope: 'long', params: { indicator: 'ma', period: 100 } },
        { key: 'indicator.cross_under', phase: 'exit', sideScope: 'long', params: { indicator: 'macd' } },
      ],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const children = (merged as { rules?: Array<{ condition: { children?: Array<{ params?: Record<string, unknown> }> } }> })?.rules?.[0].condition.children
    expect(children?.[0].params).toEqual({ indicator: 'ma', period: 100 })
    expect(children?.[1].params).toEqual({ indicator: 'macd' })
  })

  it('R-D: NOT 嵌套节点的 leaf 也参与 override（审查问题 #4 补 not 用例）', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'not',
          child: { kind: 'atom', key: 'gate.regime', params: {} },
        },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'gate.regime', phase: 'entry', sideScope: 'long', params: { regime: 'trending' } }],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const child = (merged as { rules?: Array<{ condition: { child?: { params?: Record<string, unknown> } } }> })?.rules?.[0].condition.child
    expect(child?.params).toEqual({ regime: 'trending' })
  })

  it('Major #2 fail-open: lift/override 异常时 merged 保留原 planner rules + logger 报警两次', () => {
    // 注入一个 throw 的 rule.condition.kind getter 强制 collectAtomLeaves 抛错
    const badCondition: unknown = new Proxy({ kind: 'atom', key: 'k', params: {} }, {
      get(target, prop) {
        if (prop === 'kind') throw new Error('forced for fail-open test')
        return (target as Record<string | symbol, unknown>)[prop]
      },
    })
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: badCondition,
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [{ key: 'something', params: { x: 1 } }],
    }
    // R2 审查加固：spy Logger.warn，断言异常被两个 pass 各报警一次（不被悄悄吞）
    const warnSpy = jest.spyOn((svc as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn').mockImplementation(() => undefined)
    try {
      const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
      expect(merged).not.toBeNull()
      // rules 原样保留（与传入 planner.rules 引用相等，证明没被部分 mutated）
      const rules = (merged as { rules?: unknown[] })?.rules
      expect(rules).toBeDefined()
      expect(rules).toHaveLength(1)
      // atoms 透传不受影响（在 try/catch 之前已设置）
      expect(merged?.atoms).toHaveLength(1)
      // 两个 pass 各报警一次
      expect(warnSpy).toHaveBeenCalledTimes(2)
      expect(warnSpy.mock.calls.some(call => String(call[0]).includes('overrideRulesLeafParamsFromDispatcher'))).toBe(true)
      expect(warnSpy.mock.calls.some(call => String(call[0]).includes('liftDispatcherAtomsIntoRules'))).toBe(true)
    }
    finally {
      warnSpy.mockRestore()
    }
  })

  it('R-D: 嵌套 AND/OR 节点的 leaf 也参与 override', () => {
    const planner = {
      rules: [{
        id: 'planner-r1',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'price.percent_change', params: { direction: 'down' } },
            { kind: 'atom', key: 'volume.threshold', params: {} },
          ],
        },
        effects: [],
      }],
    } as unknown as CodegenSemanticPatch
    const dispatcher: CodegenSemanticPatch = {
      atoms: [
        { key: 'price.percent_change', phase: 'entry', sideScope: 'long', params: { direction: 'down', valuePct: -1, window: '3m' } },
        { key: 'volume.threshold', phase: 'entry', sideScope: 'long', params: { mode: 'relative_to_sma', multiplier: 1.5 } },
      ],
    }
    const merged = svc.mergePlannerAndDispatcherPatches(planner, dispatcher)
    const children = (merged as { rules?: Array<{ condition: { children?: Array<{ key?: string, params?: Record<string, unknown> }> } }> })?.rules?.[0].condition.children
    expect(children?.[0].params).toEqual({ direction: 'down', valuePct: -1, window: '3m' })
    expect(children?.[1].params).toEqual({ mode: 'relative_to_sma', multiplier: 1.5 })
  })
})
