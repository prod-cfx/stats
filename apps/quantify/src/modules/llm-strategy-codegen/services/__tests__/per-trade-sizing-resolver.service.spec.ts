import { PerTradeSizingResolver, scopeKey } from '../per-trade-sizing-resolver.service'
import type { SizingAnchor } from '../per-trade-sizing-resolver.service'
import type { SemanticState } from '../../types/semantic-state'
import {
  actionScopeId,
  actionScopeKey,
  buildAmbiguousSizingState,
  buildEmptyState,
  buildMultiLegState,
  buildStateWithActionAndConstraint,
  buildStateWithActionPerOrderBudget,
  buildStateWithActionSizingShape,
  buildStateWithChecklistPositionPct,
  buildStateWithDcaPerOrderSizing,
  buildStateWithPositionSizing,
} from './fixtures/sizing-resolver-fixtures'

const PC_KEY = 'position_constraint:position.dca_schedule'

describe('PerTradeSizingResolver', () => {
  const resolver = new PerTradeSizingResolver()

  // ---------------------------------------------------------------------------
  // Group 1: source × scope × predicate
  //
  // Rules-only reality: action / position_constraint facts are always `locked`
  // with empty openSlots, so `fullySpecified` tracks value validity only.
  // Open-status / partial-slot variants survive only for `state.position`.
  // ---------------------------------------------------------------------------

  describe('Group 1 — source × scope × predicate', () => {
    // --- Source: position (state.position.sizing) ---

    describe('source=position / scope=strategy_default', () => {
      it('quote axis: executionAnchored=true, fullySpecified=true (no open slots)', () => {
        const state = buildStateWithPositionSizing({
          sizing: { kind: 'quote', value: 100, asset: 'USDT' },
          status: 'locked',
          hasOpenSlots: false,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('strategy_default') as SizingAnchor
        expect(anchor).toBeDefined()
        expect(anchor.source).toBe('position')
        expect(anchor.executionAnchored).toBe(true)
        expect(anchor.fullySpecified).toBe(true)
        expect(anchor.normalized?.axis).toBe('notional_quote')
        expect(anchor.normalized?.value).toBe(100)
        expect(anchor.normalized?.needsRuntimeResolution).toBe(false)
      })

      it('quote axis: executionAnchored=true, fullySpecified=false (has open slots)', () => {
        const state = buildStateWithPositionSizing({
          sizing: { kind: 'quote', value: 500, asset: 'USDT' },
          status: 'locked',
          hasOpenSlots: true,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('strategy_default') as SizingAnchor
        expect(anchor).toBeDefined()
        expect(anchor.source).toBe('position')
        expect(anchor.executionAnchored).toBe(true)
        expect(anchor.fullySpecified).toBe(false)
        expect(anchor.normalized?.axis).toBe('notional_quote')
      })

      it('base axis: executionAnchored=true, fullySpecified=true', () => {
        const state = buildStateWithPositionSizing({
          sizing: { kind: 'base', value: 0.01, asset: 'BTC' },
          status: 'locked',
          hasOpenSlots: false,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('strategy_default') as SizingAnchor
        expect(anchor).toBeDefined()
        expect(anchor.source).toBe('position')
        expect(anchor.executionAnchored).toBe(true)
        expect(anchor.fullySpecified).toBe(true)
        expect(anchor.normalized?.axis).toBe('base_qty')
        expect(anchor.normalized?.value).toBe(0.01)
        expect(anchor.normalized?.needsRuntimeResolution).toBe(false)
      })

      it('base axis: executionAnchored=true, fullySpecified=false (open slots)', () => {
        const state = buildStateWithPositionSizing({
          sizing: { kind: 'base', value: 1, asset: 'ETH' },
          status: 'locked',
          hasOpenSlots: true,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('strategy_default') as SizingAnchor
        expect(anchor?.executionAnchored).toBe(true)
        expect(anchor?.fullySpecified).toBe(false)
        expect(anchor?.normalized?.axis).toBe('base_qty')
      })

      it('ratio axis: executionAnchored=true, needsRuntimeResolution=true', () => {
        const state = buildStateWithPositionSizing({
          sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
          status: 'locked',
          hasOpenSlots: false,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('strategy_default') as SizingAnchor
        expect(anchor).toBeDefined()
        expect(anchor.source).toBe('position')
        expect(anchor.executionAnchored).toBe(true)
        expect(anchor.fullySpecified).toBe(true)
        expect(anchor.normalized?.axis).toBe('equity_ratio')
        expect(anchor.normalized?.value).toBe(0.1)
        expect(anchor.normalized?.needsRuntimeResolution).toBe(true)
      })

      it('ratio axis (percent unit): value normalized to 0-1 scale', () => {
        const state = buildStateWithPositionSizing({
          sizing: { kind: 'ratio', value: 10, unit: 'percent' },
          status: 'locked',
          hasOpenSlots: false,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('strategy_default') as SizingAnchor
        expect(anchor?.normalized?.axis).toBe('equity_ratio')
        expect(anchor?.normalized?.value).toBeCloseTo(0.1)
        expect(anchor?.normalized?.needsRuntimeResolution).toBe(true)
      })
    })

    // --- Source: action (rule effects.actions[].params.sizing) ---

    describe('source=action / scope=action:<rule-fact-id>', () => {
      it('quote axis: executionAnchored=true, fullySpecified=true (locked rules fact)', () => {
        const state = buildStateWithActionPerOrderBudget({ actionId: 'a1', value: 200, unit: 'quote' })
        const result = resolver.resolve(state)
        const anchor = result.get(actionScopeKey('a1')) as SizingAnchor
        expect(anchor).toBeDefined()
        expect(anchor.source).toBe('action')
        expect(anchor.executionAnchored).toBe(true)
        expect(anchor.fullySpecified).toBe(true)
        expect(anchor.normalized?.axis).toBe('notional_quote')
        expect(anchor.normalized?.value).toBe(200)
        expect(anchor.normalized?.needsRuntimeResolution).toBe(false)
        expect(anchor.evidenceRef?.mount).toBe('action')
        expect(anchor.evidenceRef?.ownerId).toBe(actionScopeId('a1'))
      })

      it('base axis: executionAnchored=true, fullySpecified=true', () => {
        const state = buildStateWithActionPerOrderBudget({ actionId: 'a3', value: 0.05, unit: 'base' })
        const result = resolver.resolve(state)
        const anchor = result.get(actionScopeKey('a3')) as SizingAnchor
        expect(anchor?.executionAnchored).toBe(true)
        expect(anchor?.normalized?.axis).toBe('base_qty')
        expect(anchor?.normalized?.value).toBe(0.05)
        expect(anchor?.normalized?.needsRuntimeResolution).toBe(false)
      })

      it('base axis with asset: NormalizedSizing.asset is populated from sizing shape', () => {
        const state = buildStateWithActionPerOrderBudget({ actionId: 'a-base-asset', value: 0.01, unit: 'base' })
        const result = resolver.resolve(state)
        const anchor = result.get(actionScopeKey('a-base-asset')) as SizingAnchor
        expect(anchor?.executionAnchored).toBe(true)
        expect(anchor?.normalized?.axis).toBe('base_qty')
        expect(anchor?.normalized?.asset).toBe('BTC')
      })

      it('ratio axis: executionAnchored=true, needsRuntimeResolution=true', () => {
        const state = buildStateWithActionPerOrderBudget({ actionId: 'a4', value: 0.2, unit: 'ratio' })
        const result = resolver.resolve(state)
        const anchor = result.get(actionScopeKey('a4')) as SizingAnchor
        expect(anchor?.executionAnchored).toBe(true)
        expect(anchor?.normalized?.axis).toBe('equity_ratio')
        expect(anchor?.normalized?.needsRuntimeResolution).toBe(true)
      })
    })

    // --- Source: position_constraint_params_fallback (rule effects.positions[].params.perOrderSizing) ---

    describe('source=position_constraint_params_fallback / scope=position_constraint:<key>', () => {
      it('quote params fallback: executionAnchored=true, fullySpecified=true', () => {
        const state = buildStateWithDcaPerOrderSizing({ ownerKey: 'position.dca_schedule', value: 100, unit: 'quote' })
        const result = resolver.resolve(state)
        const anchor = result.get(PC_KEY) as SizingAnchor
        expect(anchor).toBeDefined()
        expect(anchor.source).toBe('position_constraint_params_fallback')
        expect(anchor.executionAnchored).toBe(true)
        expect(anchor.fullySpecified).toBe(true)
        expect(anchor.normalized?.axis).toBe('notional_quote')
        expect(anchor.normalized?.value).toBe(100)
        expect(anchor.normalized?.needsRuntimeResolution).toBe(false)
        // No evidenceRef in fallback path
        expect(anchor.evidenceRef).toBeUndefined()
      })

      it('base params fallback: executionAnchored=true', () => {
        const state = buildStateWithDcaPerOrderSizing({ ownerKey: 'position.dca_schedule', value: 0.01, unit: 'base' })
        const result = resolver.resolve(state)
        const anchor = result.get(PC_KEY) as SizingAnchor
        expect(anchor?.source).toBe('position_constraint_params_fallback')
        expect(anchor?.executionAnchored).toBe(true)
        expect(anchor?.normalized?.axis).toBe('base_qty')
        expect(anchor?.normalized?.value).toBe(0.01)
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Group 2: axis boundary cases + risk_budget + percent normalization
  // ---------------------------------------------------------------------------

  describe('Group 2 — axis boundary cases', () => {
    it('notional_quote value=0 → executionAnchored=false', () => {
      const state = buildStateWithPositionSizing({ sizing: { kind: 'quote', value: 0, asset: 'USDT' }, status: 'locked' })
      expect(resolver.resolve(state).get('strategy_default')).toBeUndefined()
    })

    it('notional_quote value=negative → executionAnchored=false', () => {
      const state = buildStateWithPositionSizing({ sizing: { kind: 'quote', value: -100, asset: 'USDT' }, status: 'locked' })
      expect(resolver.resolve(state).get('strategy_default')).toBeUndefined()
    })

    it('notional_quote value=NaN → executionAnchored=false', () => {
      const state = buildStateWithPositionSizing({ sizing: { kind: 'quote', value: Number.NaN, asset: 'USDT' }, status: 'locked' })
      expect(resolver.resolve(state).get('strategy_default')).toBeUndefined()
    })

    it('notional_quote value=Infinity → executionAnchored=false', () => {
      const state = buildStateWithPositionSizing({ sizing: { kind: 'quote', value: Number.POSITIVE_INFINITY, asset: 'USDT' }, status: 'locked' })
      expect(resolver.resolve(state).get('strategy_default')).toBeUndefined()
    })

    it('equity_ratio value=0 → executionAnchored=false', () => {
      const state = buildStateWithPositionSizing({ sizing: { kind: 'ratio', value: 0, unit: 'ratio' }, status: 'locked' })
      expect(resolver.resolve(state).get('strategy_default')).toBeUndefined()
    })

    it('equity_ratio value=1 → executionAnchored=true (boundary inclusive)', () => {
      const state = buildStateWithPositionSizing({ sizing: { kind: 'ratio', value: 1, unit: 'ratio' }, status: 'locked' })
      const anchor = resolver.resolve(state).get('strategy_default')
      expect(anchor?.executionAnchored).toBe(true)
      expect(anchor?.normalized?.value).toBe(1)
    })

    it('equity_ratio value=1.5 → executionAnchored=false (>1 rejected)', () => {
      const state = buildStateWithPositionSizing({ sizing: { kind: 'ratio', value: 1.5, unit: 'ratio' }, status: 'locked' })
      expect(resolver.resolve(state).get('strategy_default')).toBeUndefined()
    })

    it('equity_ratio value=0.5 → executionAnchored=true', () => {
      const state = buildStateWithPositionSizing({ sizing: { kind: 'ratio', value: 0.5, unit: 'ratio' }, status: 'locked' })
      const anchor = resolver.resolve(state).get('strategy_default')
      expect(anchor?.executionAnchored).toBe(true)
      expect(anchor?.normalized?.value).toBe(0.5)
    })

    // risk_budget via action sizing shape (PR4+ atoms can emit this kind)
    it('risk_budget sizing shape value=100 → axis=risk_budget, executionAnchored=true, needsRuntimeResolution=true', () => {
      const state = buildStateWithActionPerOrderBudget({ actionId: 'a-risk-budget', value: 100, unit: 'risk_budget' })
      const result = resolver.resolve(state)
      const anchor = result.get(actionScopeKey('a-risk-budget')) as SizingAnchor
      expect(anchor).toBeDefined()
      expect(anchor.source).toBe('action')
      expect(anchor.executionAnchored).toBe(true)
      expect(anchor.normalized?.axis).toBe('risk_budget')
      expect(anchor.normalized?.value).toBe(100)
      expect(anchor.normalized?.needsRuntimeResolution).toBe(true)
    })

    it('risk_budget sizing shape value=0 → executionAnchored=false (not in map)', () => {
      const state = buildStateWithActionPerOrderBudget({ actionId: 'a-risk-budget-zero', value: 0, unit: 'risk_budget' })
      const result = resolver.resolve(state)
      expect(result.has(actionScopeKey('a-risk-budget-zero'))).toBe(false)
    })

    // percent unit → 0..1 normalization in sizing shape
    it('sizing shape { kind: ratio, value: 50, unit: percent } → axis=equity_ratio, value=0.5', () => {
      const state = buildStateWithActionSizingShape('a-percent', { kind: 'ratio', value: 50, unit: 'percent' })
      const result = resolver.resolve(state)
      const anchor = result.get(actionScopeKey('a-percent')) as SizingAnchor
      expect(anchor).toBeDefined()
      expect(anchor.normalized?.axis).toBe('equity_ratio')
      expect(anchor.normalized?.value).toBeCloseTo(0.5)
      expect(anchor.normalized?.needsRuntimeResolution).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Group 3: negative samples
  // ---------------------------------------------------------------------------

  describe('Group 3 — negative samples', () => {
    it('completely empty state → resolve returns empty Map', () => {
      const result = resolver.resolve(buildEmptyState())
      expect(result.size).toBe(0)
    })

    it('ambiguous sizing state (open position, no sizing contract) → empty Map', () => {
      const result = resolver.resolve(buildAmbiguousSizingState())
      expect(result.size).toBe(0)
    })

    it('locked action but value=0 → not anchored, not in map', () => {
      const state = buildStateWithActionPerOrderBudget({ actionId: 'a-zero', value: 0, unit: 'quote' })
      const result = resolver.resolve(state)
      expect(result.has(actionScopeKey('a-zero'))).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Group 4: axis conflict / coexistence
  // ---------------------------------------------------------------------------

  describe('Group 4 — axis conflict / coexistence', () => {
    it('notional_quote (action) + base_qty (position constraint) → two anchors with distinct axes', () => {
      const state = buildStateWithActionAndConstraint({
        actionId: 'a-leg1',
        actionValue: 300,
        actionUnit: 'quote',
        constraintKey: 'position.dca_schedule',
        constraintValue: 0.01,
        constraintUnit: 'base',
      })
      const result = resolver.resolve(state)
      expect(result.size).toBe(2)
      const actionAnchor = result.get(actionScopeKey('a-leg1')) as SizingAnchor
      const constraintAnchor = result.get(PC_KEY) as SizingAnchor
      expect(actionAnchor?.normalized?.axis).toBe('notional_quote')
      expect(constraintAnchor?.normalized?.axis).toBe('base_qty')
    })

    it('ratio anchor has needsRuntimeResolution=true', () => {
      const state = buildStateWithActionPerOrderBudget({ actionId: 'a-ratio', value: 0.15, unit: 'ratio' })
      const anchor = resolver.resolve(state).get(actionScopeKey('a-ratio'))
      expect(anchor?.normalized?.axis).toBe('equity_ratio')
      expect(anchor?.normalized?.needsRuntimeResolution).toBe(true)
    })

    it('quote anchor has needsRuntimeResolution=false', () => {
      const state = buildStateWithActionPerOrderBudget({ actionId: 'a-quote', value: 100, unit: 'quote' })
      const anchor = resolver.resolve(state).get(actionScopeKey('a-quote'))
      expect(anchor?.normalized?.axis).toBe('notional_quote')
      expect(anchor?.normalized?.needsRuntimeResolution).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Group 5: multi-anchor
  // ---------------------------------------------------------------------------

  describe('Group 5 — multi-anchor', () => {
    it('two action rules with distinct sizing → 2 anchors with distinct scope keys', () => {
      const state = buildMultiLegState({
        legs: [
          { actionId: 'leg-A1', value: 100, unit: 'quote' },
          { actionId: 'leg-A2', value: 200, unit: 'quote' },
        ],
      })
      const result = resolver.resolve(state)
      expect(result.size).toBe(2)
      expect(result.has(actionScopeKey('leg-A1', 0))).toBe(true)
      expect(result.has(actionScopeKey('leg-A2', 1))).toBe(true)

      const a1 = result.get(actionScopeKey('leg-A1', 0)) as SizingAnchor
      const a2 = result.get(actionScopeKey('leg-A2', 1)) as SizingAnchor
      expect(a1.normalized?.value).toBe(100)
      expect(a2.normalized?.value).toBe(200)
      expect(a1.scope).toEqual({ kind: 'action', id: actionScopeId('leg-A1', 0) })
      expect(a2.scope).toEqual({ kind: 'action', id: actionScopeId('leg-A2', 1) })
    })

    it('action + position constraint co-exist → 2 anchors', () => {
      const state = buildStateWithActionAndConstraint({
        actionId: 'main-action',
        actionValue: 500,
        actionUnit: 'quote',
        constraintKey: 'position.dca_schedule',
        constraintValue: 100,
        constraintUnit: 'quote',
      })
      const result = resolver.resolve(state)
      expect(result.size).toBe(2)
      expect(result.has(actionScopeKey('main-action'))).toBe(true)
      expect(result.has(PC_KEY)).toBe(true)
    })
  })

  describe('rules-native facts', () => {
    it('resolves action sizing from rules-only mainflow leaves', () => {
      const state: SemanticState = {
        ...buildEmptyState(),
        rules: [{
          id: 'rules-sizing',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'volume.threshold', params: { value: 1000 } },
          effects: {
            actions: [{
              kind: 'atom',
              key: 'action.open_long',
              params: { sizing: { kind: 'quote', value: 125, asset: 'USDT' } },
            }],
            risks: [],
            positions: [],
            orchestration: [],
            programs: [],
          },
        }],
      }

      const result = resolver.resolve(state)
      const anchor = result.get('action:rules-sizing:rules-0-effects-actions-0') as SizingAnchor

      expect(anchor).toEqual(expect.objectContaining({
        source: 'action',
        executionAnchored: true,
        fullySpecified: true,
        normalized: expect.objectContaining({
          axis: 'notional_quote',
          value: 125,
          asset: 'USDT',
        }),
      }))
    })
  })

  // ---------------------------------------------------------------------------
  // getExecutableLegScopes — only kind==='action' anchors are legs.
  // position_constraint scope（开仓后约束）不构成 leg。
  // ---------------------------------------------------------------------------

  describe('getExecutableLegScopes', () => {
    it('two action anchors → returns 2 scope keys', () => {
      const state = buildMultiLegState({
        legs: [
          { actionId: 'leg-A1', value: 100, unit: 'quote' },
          { actionId: 'leg-A2', value: 200, unit: 'quote' },
        ],
      })
      const scopes = resolver.getExecutableLegScopes(state)
      expect(scopes).toHaveLength(2)
      expect(scopes).toEqual(expect.arrayContaining([actionScopeKey('leg-A1', 0), actionScopeKey('leg-A2', 1)]))
    })

    it('action + position constraint co-exist → only action scope returned', () => {
      const state = buildStateWithActionAndConstraint({
        actionId: 'main-action',
        actionValue: 500,
        actionUnit: 'quote',
        constraintKey: 'position.dca_schedule',
        constraintValue: 100,
        constraintUnit: 'quote',
      })
      const scopes = resolver.getExecutableLegScopes(state)
      expect(scopes).toEqual([actionScopeKey('main-action')])
      expect(scopes).not.toContain(PC_KEY)
    })

    it('empty state → returns []', () => {
      const scopes = resolver.getExecutableLegScopes(buildEmptyState())
      expect(scopes).toEqual([])
    })
  })

  // ---------------------------------------------------------------------------
  // Group 6: degraded path source label
  // ---------------------------------------------------------------------------

  describe('Group 6 — degraded path source label', () => {
    it('DCA params.perOrderSizing → source=position_constraint_params_fallback', () => {
      const state = buildStateWithDcaPerOrderSizing({ ownerKey: 'position.dca_schedule', value: 100, unit: 'quote' })
      const result = resolver.resolve(state)
      const anchor = result.get(PC_KEY) as SizingAnchor
      expect(anchor).toBeDefined()
      expect(anchor.source).toBe('position_constraint_params_fallback')
      expect(anchor.executionAnchored).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // rules-only checklist hard-delete and scopeKey utility
  // ---------------------------------------------------------------------------

  describe('rules-only checklist hard-delete', () => {
    it('no state evidence + positionPct=10 → no checklist-derived anchor', () => {
      const { state } = buildStateWithChecklistPositionPct({ positionPct: 10 })
      const result = resolver.resolve(state)
      expect(result.size).toBe(0)
    })

    it('state has evidence → rules-native sizing is used', () => {
      const actionState: SemanticState = {
        ...buildEmptyState(),
        rules: [{
          id: 'dominant',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'price.threshold', params: { value: 1 } },
          effects: {
            actions: [{
              kind: 'atom',
              key: 'action.open_long',
              params: { sizing: { kind: 'quote', value: 100, asset: 'USDT' } },
            }],
            risks: [],
            positions: [],
            orchestration: [],
            programs: [],
          },
        }],
      }
      const result = resolver.resolve(actionState)
      expect(result.has('strategy_default')).toBe(false)
      expect([...result.keys()]).toEqual(['action:dominant:rules-0-effects-actions-0'])
    })

    it('positionPct=0 → no anchor', () => {
      const { state } = buildStateWithChecklistPositionPct({ positionPct: 0 })
      const result = resolver.resolve(state)
      expect(result.size).toBe(0)
    })
  })

  describe('scopeKey utility', () => {
    it('strategy_default scope key', () => {
      expect(scopeKey({ kind: 'strategy_default' })).toBe('strategy_default')
    })

    it('action scope key', () => {
      expect(scopeKey({ kind: 'action', id: 'my-action' })).toBe('action:my-action')
    })

    it('position_constraint scope key', () => {
      expect(scopeKey({ kind: 'position_constraint', ownerKey: 'position.dca_schedule' })).toBe(
        'position_constraint:position.dca_schedule',
      )
    })
  })

  describe('ReadonlyMap contract', () => {
    it('returned map is a Map instance (ReadonlyMap is TS-only — mutability enforced by type system)', () => {
      const result = resolver.resolve(buildEmptyState())
      // ReadonlyMap<K,V> is a TypeScript-only constraint: the runtime object is still a Map.
      // @ts-expect-error ReadonlyMap does not expose .set — type-level enforcement
      expect(() => result.set('x', {} as SizingAnchor)).not.toThrow()
      expect(result).toBeInstanceOf(Map)
    })
  })
})
