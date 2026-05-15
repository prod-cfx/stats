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
})
