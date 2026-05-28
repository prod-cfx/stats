import type { SemanticAtomContract, SemanticCapability, SemanticCapabilityDomain, SemanticCapabilityShape, SemanticState } from '../../types/semantic-state'
import type { SemanticNodeStatus } from '../../types/semantic-state'
import { CapabilityEvidenceIndex } from '../capability-evidence-index.service'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeCap(domain: SemanticCapabilityDomain, verb: string, object: string, extra?: SemanticCapabilityShape): SemanticCapability {
  return { domain, verb, object, shape: { ...extra } }
}

function makeContract(id: string, caps: SemanticCapability[]): SemanticAtomContract {
  return {
    id,
    kind: 'action',
    capabilities: caps,
    requires: [],
    params: {},
    runtimeRequirements: [],
    stateRequirements: [],
    orderRequirements: [],
    openSlots: [],
  }
}

function baseState(): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    position: null,
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

// ---------------------------------------------------------------------------
// Case 1: empty state
// ---------------------------------------------------------------------------

describe('CapabilityEvidenceIndex', () => {
  describe('case 1 — empty state', () => {
    const idx = CapabilityEvidenceIndex.build(baseState())

    it('all() returns empty', () => {
      expect(idx.all().length).toBe(0)
    })

    it('byKey on unknown key returns []', () => {
      expect(idx.byKey('x', 'y', 'z')).toEqual([])
    })

    it('byMount action returns []', () => {
      expect(idx.byMount('action')).toEqual([])
    })

    it('byMount position returns []', () => {
      expect(idx.byMount('position')).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // Case 2: one capability per mount point
  // -------------------------------------------------------------------------

  describe('case 2 — 4 mount points, 1 capability each', () => {
    const state: SemanticState = {
      ...baseState(),
      action: [
        {
          id: 'a1',
          key: 'action.buy',
          status: 'locked' as const,
          source: 'user_explicit',
          contracts: [makeContract('c-action', [makeCap('capital', 'allocate', 'fixed_quote')])],
        },
      ] as any,
      risk: [
        {
          id: 'r1',
          key: 'risk.stop_loss',
          params: {},
          status: 'open' as const,
          source: 'user_explicit',
          openSlots: [],
          contracts: [makeContract('c-risk', [makeCap('guard', 'enforce', 'stop_loss')])],
        },
      ] as any,
      position: {
        mode: 'long',
        value: 0,
        positionMode: 'one_way',
        status: 'locked' as const,
        source: 'user_explicit',
        contracts: [makeContract('c-position', [makeCap('exposure', 'cap', 'max_exposure')])],
      } as any,
      positionConstraint: [
        {
          id: 'pc1',
          key: 'position.dca_schedule',
          params: {},
          status: 'open' as const,
          source: 'user_explicit',
          openSlots: [],
          contracts: [makeContract('c-pc', [makeCap('order_program', 'schedule', 'dca')])],
        },
      ] as any,
    }

    const idx = CapabilityEvidenceIndex.build(state)

    it('all() has 4 entries', () => {
      expect(idx.all().length).toBe(4)
    })

    it('byMount action returns 1', () => {
      expect(idx.byMount('action').length).toBe(1)
    })

    it('byMount position_constraint returns 1', () => {
      expect(idx.byMount('position_constraint').length).toBe(1)
    })

    it('byMount risk returns 1', () => {
      expect(idx.byMount('risk').length).toBe(1)
    })

    it('byMount position returns 1', () => {
      expect(idx.byMount('position').length).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // Case 3: same (d,v,o) from two mount points
  // -------------------------------------------------------------------------

  describe('case 3 — same domain:verb:object from two mounts', () => {
    const cap = makeCap('capital', 'allocate', 'per_order_budget')
    const state: SemanticState = {
      ...baseState(),
      action: [
        {
          id: 'a1',
          key: 'action.buy',
          status: 'locked' as const,
          source: 'user_explicit',
          contracts: [makeContract('c-a', [cap])],
        },
      ] as any,
      position: {
        mode: 'long',
        value: 0,
        positionMode: 'one_way',
        status: 'locked' as const,
        source: 'user_explicit',
      } as any,
      positionConstraint: [
        {
          id: 'pc1',
          key: 'position.dca_schedule',
          params: {},
          status: 'locked' as const,
          source: 'inferred',
          openSlots: [],
          contracts: [makeContract('c-pc', [cap])],
        },
      ] as any,
    }

    const idx = CapabilityEvidenceIndex.build(state)

    it('byKey returns 2 entries', () => {
      expect(idx.byKey('capital', 'allocate', 'per_order_budget').length).toBe(2)
    })

    it('mounts are distinct', () => {
      const mounts = idx.byKey('capital', 'allocate', 'per_order_budget').map(e => e.mount)
      expect(mounts).toContain('action')
      expect(mounts).toContain('position_constraint')
    })
  })

  // Issue #1707 Gap B regression：rules-only mode 下 dispatcher emit 的 position.sizing
  // leaf 走 role='position' → mount='position_constraint'，必须合成
  // capital.allocate.per_order_budget evidence，否则 PerTradeSizingResolver (c) 路径拿不到
  // anchor，叠加 (d) 兜底失败导致仓位永远识别不出来。
  describe('rules-only position constraint sizing synthesis (Issue #1707)', () => {
    it('synthesizes per_order_budget evidence at position_constraint mount when params.sizing present', () => {
      const idx = CapabilityEvidenceIndex.build({
        ...baseState(),
        rules: [{
          id: 'rules-pc-sizing',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'volume.threshold', params: { value: 1000 } },
          effects: {
            actions: [],
            risks: [],
            positions: [{
              kind: 'atom',
              key: 'position.sizing',
              params: { sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' } },
            }],
            orchestration: [],
            programs: [],
          },
        }],
      })

      const evidences = idx.byKey('capital', 'allocate', 'per_order_budget')
      const pcEvidence = evidences.find(e => e.mount === 'position_constraint')
      expect(pcEvidence).toBeDefined()
      expect(pcEvidence).toEqual(expect.objectContaining({
        mount: 'position_constraint',
        ownerKey: 'position.sizing',
        ownerStatus: 'locked',
        capability: expect.objectContaining({
          shape: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        }),
      }))
    })
  })

  describe('rules-native facts', () => {
    it('indexes sizing evidence from rules-only action leaves', () => {
      const idx = CapabilityEvidenceIndex.build({
        ...baseState(),
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
      })

      const [evidence] = idx.byKey('capital', 'allocate', 'per_order_budget')
      expect(evidence).toEqual(expect.objectContaining({
        mount: 'action',
        ownerId: 'rules-sizing:rules-0-effects-actions-0',
        ownerStatus: 'locked',
        capability: expect.objectContaining({
          shape: { kind: 'quote', value: 125, asset: 'USDT' },
        }),
      }))
    })
  })

  // -------------------------------------------------------------------------
  // Case 4: ownerStatus transparency — three-state passthrough
  // -------------------------------------------------------------------------

  describe('case 4 — ownerStatus propagation', () => {
    const state: SemanticState = {
      ...baseState(),
      action: [
        {
          id: 'a-locked',
          key: 'action.sell',
          status: 'locked' as const,
          source: 'user_explicit',
          contracts: [makeContract('c1', [makeCap('order', 'place', 'market')])],
        },
      ] as any,
      position: {
        mode: 'long',
        value: 0,
        positionMode: 'one_way',
        status: 'open' as const,
        source: 'user_explicit',
      } as any,
      positionConstraint: [
        {
          id: 'pc1',
          key: 'position.pyramiding_limit',
          params: {},
          status: 'open' as const,
          source: 'inferred',
          openSlots: [],
          contracts: [makeContract('c2', [makeCap('guard', 'limit', 'pyramiding')])],
        },
      ] as any,
    }

    const idx = CapabilityEvidenceIndex.build(state)

    it('locked action → ownerStatus locked', () => {
      const [e] = idx.byMount('action')
      expect(e.ownerStatus).toBe('locked' as SemanticNodeStatus)
    })

    it('open position_constraint → ownerStatus open', () => {
      const [e] = idx.byMount('position_constraint')
      expect(e.ownerStatus).toBe('open' as SemanticNodeStatus)
    })

    it('superseded action → ownerStatus superseded', () => {
      const supersededState: SemanticState = {
        ...baseState(),
        action: [
          {
            id: 'a-superseded',
            key: 'action.buy_old',
            status: 'superseded' as const,
            source: 'user_explicit',
            contracts: [makeContract('c-sup', [makeCap('capital', 'allocate', 'fixed_quote')])],
          },
        ],
      }
      const supersededIdx = CapabilityEvidenceIndex.build(supersededState)
      const [e] = supersededIdx.byMount('action')
      expect(e.ownerStatus).toBe('superseded' as SemanticNodeStatus)
    })
  })

  // -------------------------------------------------------------------------
  // Case 5: shape passthrough
  // -------------------------------------------------------------------------

  describe('case 5 — shape reference preserved', () => {
    const shape = { perOrderSizing: { kind: 'quote', value: 100, unit: 'usdt' } }
    const cap: SemanticCapability = {
      domain: 'capital',
      verb: 'allocate',
      object: 'per_order_budget',
      shape,
    }
    const state: SemanticState = {
      ...baseState(),
      action: [
        {
          id: 'a1',
          key: 'action.buy',
          status: 'locked' as const,
          source: 'user_explicit',
          contracts: [makeContract('c1', [cap])],
        },
      ],
    }

    it('shape reference is identical', () => {
      const idx = CapabilityEvidenceIndex.build(state)
      const [e] = idx.byMount('action')
      expect(e.capability.shape).toBe(shape)
    })
  })
})
