import type { SemanticSlotState, SemanticState } from '../../types/semantic-state'
import { SemanticOpenSlotAnswerResolverService } from '../semantic-open-slot-answer-resolver.service'

describe('SemanticOpenSlotAnswerResolverService', () => {
  const service = new SemanticOpenSlotAnswerResolverService()

  it('writes grid count answers into the open level set density slot and closes it', () => {
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [createOpenSlot('contract.shape.price.level_set.density')],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '20格',
    })

    expect(result.consumed).toBe(true)
    expect(result.answer).toEqual({ gridCount: 20 })
    expect(result.nextState.triggers[0]).toEqual(expect.objectContaining({
      status: 'locked',
      openSlots: [],
    }))
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).toEqual({
      lower: 79200,
      upper: 80200,
      spacingMode: 'arithmetic',
      gridCount: 20,
    })
    expect(state.triggers[0].openSlots).toEqual([createOpenSlot('contract.shape.price.level_set.density')])
  })

  it('maps missing level set requirement slots to the same density answer shape', () => {
    const state = createSemanticState({
      actions: [{
        id: 'action-grid-ladder',
        key: 'open_long',
        status: 'open',
        source: 'derived',
        openSlots: [createOpenSlot(
          'contract.requirement.price.define.level_set',
          'actions[action-grid-ladder].contracts[action-contract-grid-ladder].requires.price.define.level_set',
        )],
        contracts: [{
          id: 'action-contract-grid-ladder',
          kind: 'action',
          capabilities: [{
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
          }],
          requires: [{ domain: 'price', verb: 'define', object: 'level_set' }],
          params: {},
        }],
      }],
    })

    const result = service.resolve({
      currentState: state,
      message: '20 个网格',
    })

    expect(result.consumed).toBe(true)
    expect(result.answer).toEqual({ gridCount: 20 })
    expect(result.nextState.actions[0]).toEqual(expect.objectContaining({
      status: 'locked',
      openSlots: [],
    }))
    expect(result.nextState.actions[0].contracts?.[0].capabilities[0].shape).toEqual(expect.objectContaining({
      gridCount: 20,
    }))
  })

  it('writes absolute spacing answers into the level set shape', () => {
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [createOpenSlot('contract.shape.price.level_set.density')],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '每格 100 USDT',
    })

    expect(result.consumed).toBe(true)
    expect(result.answer).toEqual({ absoluteSpacing: 100 })
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).toEqual(expect.objectContaining({
      absoluteSpacing: 100,
    }))
    expect(result.nextState.triggers[0].openSlots).toEqual([])
  })

  it('writes percent spacing answers into the level set shape', () => {
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { mode: 'centered_percent_range', centerSource: 'last_price', halfRangePct: 1, spacingMode: 'arithmetic' },
        openSlots: [createOpenSlot('contract.shape.price.level_set.density')],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '0.5%间距',
    })

    expect(result.consumed).toBe(true)
    expect(result.answer).toEqual({ spacingPct: 0.5 })
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).toEqual(expect.objectContaining({
      spacingPct: 0.5,
    }))
    expect(result.nextState.triggers[0].openSlots).toEqual([])
  })

  it('opens a business-language conflict slot when one answer provides count and spacing', () => {
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [createOpenSlot('contract.shape.price.level_set.density')],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '20格，每格100 USDT',
    })

    expect(result.consumed).toBe(true)
    expect(result.answer).toEqual({ gridCount: 20, absoluteSpacing: 100 })
    expect(result.nextState.triggers[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [{
        slotKey: 'contract.shape.price.level_set.spacing_conflict',
        fieldPath: 'triggers[trigger-grid-levels].contracts[contract-grid-levels].capabilities[price.define.level_set].shape',
        status: 'open',
        priority: 'core',
        questionHint: '网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。',
        affectsExecution: true,
        evidence: {
          source: 'derived',
          text: 'Open slot answer introduced conflicting level set density fields.',
        },
      }],
    }))
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).toEqual(expect.objectContaining({
      gridCount: 20,
      absoluteSpacing: 100,
    }))
  })

  it('does not consume messages without a matching open slot or parseable density answer', () => {
    const lockedState = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [],
      })],
    })
    const openState = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [createOpenSlot('contract.shape.price.level_set.density')],
      })],
    })

    expect(service.resolve({ currentState: lockedState, message: '20格' })).toEqual({
      consumed: false,
      nextState: lockedState,
    })
    expect(service.resolve({ currentState: openState, message: '随便吧' })).toEqual({
      consumed: false,
      nextState: openState,
    })
  })
})

function createSemanticState(overrides: Partial<SemanticState> = {}): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [],
    actions: [],
    risk: [],
    position: null,
    contextSlots: {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-05T00:00:00.000Z',
    ...overrides,
  }
}

function createLevelSetTrigger(input: {
  shape: Record<string, string | number>
  openSlots: SemanticSlotState[]
}): SemanticState['triggers'][number] {
  return {
    id: 'trigger-grid-levels',
    key: 'custom.price.levels',
    phase: 'entry',
    params: {},
    status: input.openSlots.length ? 'open' : 'locked',
    source: 'derived',
    openSlots: input.openSlots,
    contracts: [{
      id: 'contract-grid-levels',
      kind: 'trigger',
      capabilities: [{
        domain: 'price',
        verb: 'define',
        object: 'level_set',
        shape: input.shape,
      }],
      requires: [],
      params: {},
    }],
  }
}

function createOpenSlot(
  slotKey: 'contract.shape.price.level_set.density' | 'contract.requirement.price.define.level_set',
  fieldPath = 'triggers[trigger-grid-levels].contracts[contract-grid-levels].capabilities[price.define.level_set].shape',
): SemanticSlotState {
  return {
    slotKey,
    fieldPath,
    status: 'open',
    priority: 'core',
    questionHint: '请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。',
    affectsExecution: true,
  }
}
