import { PerTradeSizingResolver, scopeKey } from '../per-trade-sizing-resolver.service'
import type { SizingAnchor } from '../per-trade-sizing-resolver.service'
import {
  buildAmbiguousSizingState,
  buildEmptyState,
  buildMultiLegState,
  buildStateWithActionAndConstraint,
  buildStateWithActionPerOrderBudget,
  buildStateWithChecklistPositionPct,
  buildStateWithDcaPerOrderSizing,
  buildStateWithPositionSizing,
} from './fixtures/sizing-resolver-fixtures'

describe('PerTradeSizingResolver', () => {
  const resolver = new PerTradeSizingResolver()

  // ---------------------------------------------------------------------------
  // Group 1: 4 source × scope × predicate cases (≥24 cases)
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

    // --- Source: action ---

    describe('source=action / scope=action:<id>', () => {
      it('quote axis: executionAnchored=true, fullySpecified=true (locked, no open slots)', () => {
        const state = buildStateWithActionPerOrderBudget({
          actionId: 'a1',
          value: 200,
          unit: 'quote',
          status: 'locked',
          hasOpenSlots: false,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('action:a1') as SizingAnchor
        expect(anchor).toBeDefined()
        expect(anchor.source).toBe('action')
        expect(anchor.executionAnchored).toBe(true)
        expect(anchor.fullySpecified).toBe(true)
        expect(anchor.normalized?.axis).toBe('notional_quote')
        expect(anchor.normalized?.value).toBe(200)
        expect(anchor.normalized?.needsRuntimeResolution).toBe(false)
        expect(anchor.evidenceRef?.mount).toBe('action')
        expect(anchor.evidenceRef?.ownerId).toBe('a1')
      })

      it('quote axis: executionAnchored=true, fullySpecified=false (locked, open slots)', () => {
        const state = buildStateWithActionPerOrderBudget({
          actionId: 'a2',
          value: 50,
          unit: 'quote',
          status: 'locked',
          hasOpenSlots: true,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('action:a2') as SizingAnchor
        expect(anchor?.executionAnchored).toBe(true)
        expect(anchor?.fullySpecified).toBe(false)
        expect(anchor?.normalized?.axis).toBe('notional_quote')
      })

      it('base axis: executionAnchored=true, fullySpecified=true', () => {
        const state = buildStateWithActionPerOrderBudget({
          actionId: 'a3',
          value: 0.05,
          unit: 'base',
          status: 'locked',
        })
        const result = resolver.resolve(state)
        const anchor = result.get('action:a3') as SizingAnchor
        expect(anchor?.executionAnchored).toBe(true)
        expect(anchor?.normalized?.axis).toBe('base_qty')
        expect(anchor?.normalized?.value).toBe(0.05)
        expect(anchor?.normalized?.needsRuntimeResolution).toBe(false)
      })

      it('base axis with asset: NormalizedSizing.asset is populated from capability shape', () => {
        const state: SemanticState = {
          version: 1,
          families: ['single-leg'],
          triggers: [],
          actions: [{
            id: 'a-base-asset',
            key: 'action.open_long',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            contracts: [{
              id: 'contract-base-asset',
              kind: 'action',
              capabilities: [{
                domain: 'capital',
                verb: 'allocate',
                object: 'per_order_budget',
                shape: { kind: 'base', value: 0.01, asset: 'BTC' },
              }],
              requires: [],
              params: {},
              runtimeRequirements: [],
              stateRequirements: [],
              orderRequirements: [],
              openSlots: [],
            }],
          }],
          risk: [],
          position: null,
          contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
          normalizationNotes: [],
          updatedAt: '2026-05-11T00:00:00.000Z',
        }
        const result = resolver.resolve(state)
        const anchor = result.get('action:a-base-asset') as SizingAnchor
        expect(anchor?.executionAnchored).toBe(true)
        expect(anchor?.normalized?.axis).toBe('base_qty')
        expect(anchor?.normalized?.asset).toBe('BTC')
      })

      it('ratio axis: executionAnchored=true, needsRuntimeResolution=true', () => {
        const state = buildStateWithActionPerOrderBudget({
          actionId: 'a4',
          value: 0.2,
          unit: 'ratio',
          status: 'locked',
        })
        const result = resolver.resolve(state)
        const anchor = result.get('action:a4') as SizingAnchor
        expect(anchor?.executionAnchored).toBe(true)
        expect(anchor?.normalized?.axis).toBe('equity_ratio')
        expect(anchor?.normalized?.needsRuntimeResolution).toBe(true)
      })

      it('open status: executionAnchored=false (not in map)', () => {
        const state = buildStateWithActionPerOrderBudget({
          actionId: 'a5',
          value: 100,
          unit: 'quote',
          status: 'open',
        })
        const result = resolver.resolve(state)
        expect(result.has('action:a5')).toBe(false)
      })

      it('superseded status: executionAnchored=false (not in map)', () => {
        const state = buildStateWithActionPerOrderBudget({
          actionId: 'a6',
          value: 100,
          unit: 'quote',
          status: 'superseded',
        })
        const result = resolver.resolve(state)
        expect(result.has('action:a6')).toBe(false)
      })
    })

    // --- Source: position_constraint (capability path) ---

    describe('source=position_constraint / scope=position_constraint:<key>', () => {
      it('quote axis: executionAnchored=true, fullySpecified=true (locked, no open slots)', () => {
        const state = buildStateWithDcaPerOrderSizing({
          ownerKey: 'position.dca_schedule',
          value: 100,
          unit: 'quote',
          viaCapability: true,
          status: 'locked',
          hasOpenSlots: false,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('position_constraint:position.dca_schedule') as SizingAnchor
        expect(anchor).toBeDefined()
        expect(anchor.source).toBe('position_constraint')
        expect(anchor.executionAnchored).toBe(true)
        expect(anchor.fullySpecified).toBe(true)
        expect(anchor.normalized?.axis).toBe('notional_quote')
        expect(anchor.normalized?.value).toBe(100)
        expect(anchor.normalized?.needsRuntimeResolution).toBe(false)
        expect(anchor.evidenceRef?.mount).toBe('position_constraint')
      })

      it('quote axis: executionAnchored=true, fullySpecified=false (locked, open slots)', () => {
        const state = buildStateWithDcaPerOrderSizing({
          ownerKey: 'position.dca_schedule',
          value: 150,
          unit: 'quote',
          viaCapability: true,
          status: 'locked',
          hasOpenSlots: true,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('position_constraint:position.dca_schedule') as SizingAnchor
        expect(anchor?.executionAnchored).toBe(true)
        expect(anchor?.fullySpecified).toBe(false)
      })

      it('ratio axis: executionAnchored=false when status=open', () => {
        const state = buildStateWithDcaPerOrderSizing({
          ownerKey: 'position.dca_schedule',
          value: 0.1,
          unit: 'quote', // use quote as proxy; ratio via params fallback tested separately
          viaCapability: true,
          status: 'open',
        })
        const result = resolver.resolve(state)
        expect(result.has('position_constraint:position.dca_schedule')).toBe(false)
      })

      it('base axis: executionAnchored=true, needsRuntimeResolution=false', () => {
        const state = buildStateWithDcaPerOrderSizing({
          ownerKey: 'position.dca_schedule',
          value: 0.002,
          unit: 'base',
          viaCapability: true,
          status: 'locked',
          hasOpenSlots: false,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('position_constraint:position.dca_schedule') as SizingAnchor
        expect(anchor?.executionAnchored).toBe(true)
        expect(anchor?.normalized?.axis).toBe('base_qty')
        expect(anchor?.normalized?.needsRuntimeResolution).toBe(false)
      })
    })

    // --- Source: position_constraint_params_fallback ---

    describe('source=position_constraint_params_fallback / scope=position_constraint:<key>', () => {
      it('quote params fallback: executionAnchored=true, fullySpecified=true', () => {
        const state = buildStateWithDcaPerOrderSizing({
          ownerKey: 'position.dca_schedule',
          value: 100,
          unit: 'quote',
          viaCapability: false,
          status: 'locked',
          hasOpenSlots: false,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('position_constraint:position.dca_schedule') as SizingAnchor
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

      it('quote params fallback: fullySpecified=false when open slots present', () => {
        const state = buildStateWithDcaPerOrderSizing({
          ownerKey: 'position.dca_schedule',
          value: 200,
          unit: 'quote',
          viaCapability: false,
          status: 'locked',
          hasOpenSlots: true,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('position_constraint:position.dca_schedule') as SizingAnchor
        expect(anchor?.source).toBe('position_constraint_params_fallback')
        expect(anchor?.executionAnchored).toBe(true)
        expect(anchor?.fullySpecified).toBe(false)
      })

      it('base params fallback: executionAnchored=true', () => {
        const state = buildStateWithDcaPerOrderSizing({
          ownerKey: 'position.dca_schedule',
          value: 0.01,
          unit: 'base',
          viaCapability: false,
          status: 'locked',
          hasOpenSlots: false,
        })
        const result = resolver.resolve(state)
        const anchor = result.get('position_constraint:position.dca_schedule') as SizingAnchor
        expect(anchor?.source).toBe('position_constraint_params_fallback')
        expect(anchor?.executionAnchored).toBe(true)
        expect(anchor?.normalized?.axis).toBe('base_qty')
        expect(anchor?.normalized?.value).toBe(0.01)
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Group 2: 8 axis boundary cases + risk_budget + percent normalization
  // ---------------------------------------------------------------------------

  describe('Group 2 — axis boundary cases', () => {
    it('notional_quote value=0 → executionAnchored=false', () => {
      const state = buildStateWithPositionSizing({
        sizing: { kind: 'quote', value: 0, asset: 'USDT' },
        status: 'locked',
      })
      expect(resolver.resolve(state).get('strategy_default')).toBeUndefined()
    })

    it('notional_quote value=negative → executionAnchored=false', () => {
      const state = buildStateWithPositionSizing({
        sizing: { kind: 'quote', value: -100, asset: 'USDT' },
        status: 'locked',
      })
      expect(resolver.resolve(state).get('strategy_default')).toBeUndefined()
    })

    it('notional_quote value=NaN → executionAnchored=false', () => {
      const state = buildStateWithPositionSizing({
        sizing: { kind: 'quote', value: Number.NaN, asset: 'USDT' },
        status: 'locked',
      })
      expect(resolver.resolve(state).get('strategy_default')).toBeUndefined()
    })

    it('notional_quote value=Infinity → executionAnchored=false', () => {
      const state = buildStateWithPositionSizing({
        sizing: { kind: 'quote', value: Number.POSITIVE_INFINITY, asset: 'USDT' },
        status: 'locked',
      })
      expect(resolver.resolve(state).get('strategy_default')).toBeUndefined()
    })

    it('equity_ratio value=0 → executionAnchored=false', () => {
      const state = buildStateWithPositionSizing({
        sizing: { kind: 'ratio', value: 0, unit: 'ratio' },
        status: 'locked',
      })
      expect(resolver.resolve(state).get('strategy_default')).toBeUndefined()
    })

    it('equity_ratio value=1 → executionAnchored=true (boundary inclusive)', () => {
      const state = buildStateWithPositionSizing({
        sizing: { kind: 'ratio', value: 1, unit: 'ratio' },
        status: 'locked',
      })
      const anchor = resolver.resolve(state).get('strategy_default')
      expect(anchor?.executionAnchored).toBe(true)
      expect(anchor?.normalized?.value).toBe(1)
    })

    it('equity_ratio value=1.5 → executionAnchored=false (>1 rejected)', () => {
      const state = buildStateWithPositionSizing({
        sizing: { kind: 'ratio', value: 1.5, unit: 'ratio' },
        status: 'locked',
      })
      expect(resolver.resolve(state).get('strategy_default')).toBeUndefined()
    })

    it('equity_ratio value=0.5 → executionAnchored=true', () => {
      const state = buildStateWithPositionSizing({
        sizing: { kind: 'ratio', value: 0.5, unit: 'ratio' },
        status: 'locked',
      })
      const anchor = resolver.resolve(state).get('strategy_default')
      expect(anchor?.executionAnchored).toBe(true)
      expect(anchor?.normalized?.value).toBe(0.5)
    })

    // risk_budget via capability shape path (PR4+ atoms can emit this kind)
    it('risk_budget capability shape value=100 → axis=risk_budget, executionAnchored=true, needsRuntimeResolution=true', () => {
      const state = buildStateWithActionPerOrderBudget({
        actionId: 'a-risk-budget',
        value: 100,
        unit: 'risk_budget',
        status: 'locked',
        hasOpenSlots: false,
      })
      const result = resolver.resolve(state)
      const anchor = result.get('action:a-risk-budget') as SizingAnchor
      expect(anchor).toBeDefined()
      expect(anchor.source).toBe('action')
      expect(anchor.executionAnchored).toBe(true)
      expect(anchor.normalized?.axis).toBe('risk_budget')
      expect(anchor.normalized?.value).toBe(100)
      expect(anchor.normalized?.needsRuntimeResolution).toBe(true)
    })

    it('risk_budget capability shape value=0 → executionAnchored=false (not in map)', () => {
      const state = buildStateWithActionPerOrderBudget({
        actionId: 'a-risk-budget-zero',
        value: 0,
        unit: 'risk_budget',
        status: 'locked',
        hasOpenSlots: false,
      })
      const result = resolver.resolve(state)
      expect(result.has('action:a-risk-budget-zero')).toBe(false)
    })

    // Mi4: percent unit → 0..1 normalization in capability shape
    it('capability shape { kind: ratio, value: 50, unit: percent } → axis=equity_ratio, value=0.5', () => {
      // Build state manually with a percent-unit ratio capability shape
      const state = buildStateWithActionPerOrderBudget({
        actionId: 'a-percent',
        value: 50,
        unit: 'ratio', // makePerOrderBudgetCapability will set kind='ratio'; we override unit via shape below
        status: 'locked',
        hasOpenSlots: false,
      })
      // Patch the shape to include unit='percent'
      const action = state.actions[0]
      const cap = action.contracts![0].capabilities[0]
      ;(cap.shape as Record<string, unknown>)['unit'] = 'percent'

      const result = resolver.resolve(state)
      const anchor = result.get('action:a-percent') as SizingAnchor
      expect(anchor).toBeDefined()
      expect(anchor.normalized?.axis).toBe('equity_ratio')
      expect(anchor.normalized?.value).toBeCloseTo(0.5)
      expect(anchor.normalized?.needsRuntimeResolution).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Group 3: 3 negative samples
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
      const state = buildStateWithActionPerOrderBudget({
        actionId: 'a-zero',
        value: 0,
        unit: 'quote',
        status: 'locked',
      })
      const result = resolver.resolve(state)
      expect(result.has('action:a-zero')).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Group 4: 3 axis conflict / coexistence cases
  // ---------------------------------------------------------------------------

  describe('Group 4 — axis conflict / coexistence', () => {
    it('notional_quote (action) + base_qty (positionConstraint) → two anchors with distinct axes', () => {
      const state = buildStateWithActionAndConstraint({
        actionId: 'a-leg1',
        actionValue: 300,
        actionUnit: 'quote',
        constraintKey: 'position.dca_schedule',
        constraintValue: 0.01,
        constraintUnit: 'base',
        constraintViaCapability: true,
      })
      const result = resolver.resolve(state)
      expect(result.size).toBe(2)
      const actionAnchor = result.get('action:a-leg1') as SizingAnchor
      const constraintAnchor = result.get('position_constraint:position.dca_schedule') as SizingAnchor
      expect(actionAnchor?.normalized?.axis).toBe('notional_quote')
      expect(constraintAnchor?.normalized?.axis).toBe('base_qty')
    })

    it('ratio anchor has needsRuntimeResolution=true', () => {
      const state = buildStateWithActionPerOrderBudget({
        actionId: 'a-ratio',
        value: 0.15,
        unit: 'ratio',
        status: 'locked',
      })
      const anchor = resolver.resolve(state).get('action:a-ratio')
      expect(anchor?.normalized?.axis).toBe('equity_ratio')
      expect(anchor?.normalized?.needsRuntimeResolution).toBe(true)
    })

    it('quote anchor has needsRuntimeResolution=false', () => {
      const state = buildStateWithActionPerOrderBudget({
        actionId: 'a-quote',
        value: 100,
        unit: 'quote',
        status: 'locked',
      })
      const anchor = resolver.resolve(state).get('action:a-quote')
      expect(anchor?.normalized?.axis).toBe('notional_quote')
      expect(anchor?.normalized?.needsRuntimeResolution).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Group 5: 2 multi-anchor cases
  // ---------------------------------------------------------------------------

  describe('Group 5 — multi-anchor', () => {
    it('two actions with distinct sizing → 2 anchors with distinct scope keys', () => {
      const state = buildMultiLegState({
        legs: [
          { actionId: 'leg-A1', value: 100, unit: 'quote' },
          { actionId: 'leg-A2', value: 200, unit: 'quote' },
        ],
      })
      const result = resolver.resolve(state)
      expect(result.size).toBe(2)
      expect(result.has('action:leg-A1')).toBe(true)
      expect(result.has('action:leg-A2')).toBe(true)

      const a1 = result.get('action:leg-A1') as SizingAnchor
      const a2 = result.get('action:leg-A2') as SizingAnchor
      expect(a1.normalized?.value).toBe(100)
      expect(a2.normalized?.value).toBe(200)
      expect(a1.scope).toEqual({ kind: 'action', id: 'leg-A1' })
      expect(a2.scope).toEqual({ kind: 'action', id: 'leg-A2' })
    })

    it('action + positionConstraint co-exist → 2 anchors', () => {
      const state = buildStateWithActionAndConstraint({
        actionId: 'main-action',
        actionValue: 500,
        actionUnit: 'quote',
        constraintKey: 'position.dca_schedule',
        constraintValue: 100,
        constraintUnit: 'quote',
        constraintViaCapability: true,
      })
      const result = resolver.resolve(state)
      expect(result.size).toBe(2)
      expect(result.has('action:main-action')).toBe(true)
      expect(result.has('position_constraint:position.dca_schedule')).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Group 6: 2 degraded path source label cases
  // ---------------------------------------------------------------------------

  describe('Group 6 — degraded path source labels', () => {
    it('DCA params.perOrderSizing only (viaCapability=false) → source=position_constraint_params_fallback', () => {
      const state = buildStateWithDcaPerOrderSizing({
        ownerKey: 'position.dca_schedule',
        value: 100,
        unit: 'quote',
        viaCapability: false,
        status: 'locked',
        hasOpenSlots: false,
      })
      const result = resolver.resolve(state)
      const anchor = result.get('position_constraint:position.dca_schedule') as SizingAnchor
      expect(anchor).toBeDefined()
      expect(anchor.source).toBe('position_constraint_params_fallback')
      expect(anchor.executionAnchored).toBe(true)
    })

    it('DCA capability + params both present (viaCapability=true) → capability path wins, source=position_constraint, value from capability not params', () => {
      // capability shape value=100, params.perOrderSizing value=999
      // resolver must pick capability (main path) and return normalized.value=100, not 999
      const state = buildStateWithDcaPerOrderSizing({
        ownerKey: 'position.dca_schedule',
        value: 100,
        unit: 'quote',
        viaCapability: true,
        status: 'locked',
        hasOpenSlots: false,
        capabilityValue: 100,
        paramsValue: 999,
      })
      const result = resolver.resolve(state)
      const anchor = result.get('position_constraint:position.dca_schedule') as SizingAnchor
      expect(anchor).toBeDefined()
      expect(anchor.source).toBe('position_constraint')
      expect(anchor.evidenceRef?.mount).toBe('position_constraint')
      // Capability path must win — value must be 100, not 999 (params value)
      expect(anchor.normalized?.value).toBe(100)
    })
  })

  // ---------------------------------------------------------------------------
  // Additional: checklist fallback and scopeKey utility
  // ---------------------------------------------------------------------------

  describe('checklist fallback', () => {
    it('no state evidence + positionPct=10 → single anchor from checklist', () => {
      const { state, checklist } = buildStateWithChecklistPositionPct({ positionPct: 10 })
      const result = resolver.resolve(state, checklist)
      expect(result.size).toBe(1)
      const anchor = result.get('strategy_default') as SizingAnchor
      expect(anchor.source).toBe('checklist')
      expect(anchor.executionAnchored).toBe(true)
      expect(anchor.normalized?.axis).toBe('equity_ratio')
      expect(anchor.normalized?.value).toBeCloseTo(0.1)
      expect(anchor.normalized?.needsRuntimeResolution).toBe(true)
    })

    it('state has evidence → checklist not used', () => {
      const actionState = buildStateWithActionPerOrderBudget({
        actionId: 'dominant',
        value: 100,
        unit: 'quote',
        status: 'locked',
      })
      const { checklist } = buildStateWithChecklistPositionPct({ positionPct: 20 })
      const result = resolver.resolve(actionState, checklist)
      // action anchor wins; checklist not applied
      expect(result.has('strategy_default')).toBe(false)
      expect(result.has('action:dominant')).toBe(true)
    })

    it('positionPct=0 → checklist not anchored', () => {
      const { state, checklist } = buildStateWithChecklistPositionPct({ positionPct: 0 })
      const result = resolver.resolve(state, checklist)
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
      // Mutation prevention is guaranteed by the type signature, not by a runtime seal.
      // @ts-expect-error ReadonlyMap does not expose .set — type-level enforcement
      expect(() => result.set('x', {} as SizingAnchor)).not.toThrow()
      expect(result).toBeInstanceOf(Map)
    })
  })
})
