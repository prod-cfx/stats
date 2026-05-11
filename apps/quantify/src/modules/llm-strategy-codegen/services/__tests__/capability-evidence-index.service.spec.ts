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
    triggers: [],
    actions: [],
    risk: [],
    position: null,
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
      actions: [
        {
          id: 'a1',
          key: 'action.buy',
          status: 'locked' as const,
          source: 'user_explicit',
          contracts: [makeContract('c-action', [makeCap('capital', 'allocate', 'fixed_quote')])],
        },
      ],
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
      ],
      position: {
        mode: 'long',
        value: 0,
        positionMode: 'one_way',
        status: 'locked' as const,
        source: 'user_explicit',
        constraints: [
          {
            id: 'pc1',
            key: 'position.dca_schedule',
            params: {},
            status: 'open' as const,
            source: 'user_explicit',
            openSlots: [],
            contracts: [makeContract('c-pc', [makeCap('order_program', 'schedule', 'dca')])],
          },
        ],
        contracts: [makeContract('c-position', [makeCap('exposure', 'cap', 'max_exposure')])],
      },
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
      actions: [
        {
          id: 'a1',
          key: 'action.buy',
          status: 'locked' as const,
          source: 'user_explicit',
          contracts: [makeContract('c-a', [cap])],
        },
      ],
      position: {
        mode: 'long',
        value: 0,
        positionMode: 'one_way',
        status: 'locked' as const,
        source: 'user_explicit',
        constraints: [
          {
            id: 'pc1',
            key: 'position.dca_schedule',
            params: {},
            status: 'locked' as const,
            source: 'inferred',
            openSlots: [],
            contracts: [makeContract('c-pc', [cap])],
          },
        ],
      },
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

  // -------------------------------------------------------------------------
  // Case 4: ownerStatus transparency — three-state passthrough
  // -------------------------------------------------------------------------

  describe('case 4 — ownerStatus propagation', () => {
    const state: SemanticState = {
      ...baseState(),
      actions: [
        {
          id: 'a-locked',
          key: 'action.sell',
          status: 'locked' as const,
          source: 'user_explicit',
          contracts: [makeContract('c1', [makeCap('order', 'place', 'market')])],
        },
      ],
      position: {
        mode: 'long',
        value: 0,
        positionMode: 'one_way',
        status: 'open' as const,
        source: 'user_explicit',
        constraints: [
          {
            id: 'pc1',
            key: 'position.pyramiding_limit',
            params: {},
            status: 'open' as const,
            source: 'inferred',
            openSlots: [],
            contracts: [makeContract('c2', [makeCap('guard', 'limit', 'pyramiding')])],
          },
        ],
      },
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
        actions: [
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
      actions: [
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
