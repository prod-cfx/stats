import type { SemanticCapabilityShape, SemanticSlotState, SemanticState } from '../../types/semantic-state'
import { buildSemanticSlotId } from '../../types/semantic-state'
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

  it('uses clarificationState pending semantic item before the first open slot', () => {
    const firstSlot = createOpenSlot(
      'contract.shape.price.level_set.density',
      'triggers[trigger-grid-levels].contracts[contract-grid-levels].capabilities[price.define.level_set].shape',
    )
    const targetSlot = createOpenSlot(
      'contract.shape.price.level_set.density',
      'triggers[trigger-second-levels].contracts[contract-second-levels].capabilities[price.define.level_set].shape',
    )
    const state = createSemanticState({
      triggers: [
        createLevelSetTrigger({
          id: 'trigger-grid-levels',
          contractId: 'contract-grid-levels',
          shape: { lower: 100, upper: 200, spacingMode: 'arithmetic' },
          openSlots: [firstSlot],
        }),
        createLevelSetTrigger({
          id: 'trigger-second-levels',
          contractId: 'contract-second-levels',
          shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
          openSlots: [targetSlot],
        }),
      ],
    })

    const result = service.resolve({
      currentState: state,
      message: '20格',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          blocking: true,
          slotId: buildSemanticSlotId(targetSlot),
          slotKey: targetSlot.slotKey,
          fieldPath: targetSlot.fieldPath,
        }],
      },
    })

    expect(result.consumed).toBe(true)
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).toEqual({
      lower: 100,
      upper: 200,
      spacingMode: 'arithmetic',
    })
    expect(result.nextState.triggers[0].openSlots).toEqual([firstSlot])
    expect(result.nextState.triggers[1].contracts?.[0].capabilities[0].shape).toEqual(expect.objectContaining({
      gridCount: 20,
    }))
    expect(result.nextState.triggers[1].openSlots).toEqual([])
  })

  it('updates only the capability targeted by fieldPath when one owner has multiple level sets', () => {
    const targetSlot = createOpenSlot(
      'contract.shape.price.level_set.density',
      'triggers[trigger-grid-levels].contracts[contract-target-levels].capabilities[price.define.level_set].shape',
    )
    const siblingSlot = createOpenSlot(
      'contract.shape.price.level_set.density',
      'triggers[trigger-grid-levels].contracts[contract-sibling-levels].capabilities[price.define.level_set].shape',
    )
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { lower: 100, upper: 200, spacingMode: 'arithmetic' },
        openSlots: [targetSlot, siblingSlot],
        contracts: [
          createLevelSetContract('contract-target-levels', { lower: 100, upper: 200, spacingMode: 'arithmetic' }),
          createLevelSetContract('contract-sibling-levels', { lower: 1000, upper: 2000, spacingMode: 'arithmetic' }),
        ],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '网格数量 20',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotKey: targetSlot.slotKey,
          fieldPath: targetSlot.fieldPath,
        }],
      },
    })

    expect(result.consumed).toBe(true)
    expect(result.answer).toEqual({ gridCount: 20 })
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).toEqual(expect.objectContaining({
      gridCount: 20,
    }))
    expect(result.nextState.triggers[0].contracts?.[1].capabilities[0].shape).toEqual({
      lower: 1000,
      upper: 2000,
      spacingMode: 'arithmetic',
    })
    expect(result.nextState.triggers[0].openSlots).toEqual([siblingSlot])
  })

  it('keeps same-key open slots with different fieldPath when closing the consumed slot', () => {
    const consumedSlot = createOpenSlot(
      'contract.shape.price.level_set.density',
      'triggers[trigger-grid-levels].contracts[contract-grid-levels].capabilities[price.define.level_set].shape',
    )
    const siblingSlot = createOpenSlot(
      'contract.shape.price.level_set.density',
      'triggers[trigger-grid-levels].contracts[contract-sibling-levels].capabilities[price.define.level_set].shape',
    )
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        openSlots: [consumedSlot, siblingSlot],
        contracts: [
          createLevelSetContract('contract-grid-levels', { lower: 79200, upper: 80200, spacingMode: 'arithmetic' }),
          createLevelSetContract('contract-sibling-levels', { lower: 100, upper: 200, spacingMode: 'arithmetic' }),
        ],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '20格',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotId: buildSemanticSlotId(consumedSlot),
        }],
      },
    })

    expect(result.consumed).toBe(true)
    expect(result.nextState.triggers[0].openSlots).toEqual([siblingSlot])
    expect(result.nextState.triggers[0].status).toBe('open')
  })

  it('parses grid count labels and interval answers', () => {
    const countState = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [createOpenSlot('contract.shape.price.level_set.density')],
      })],
    })
    const intervalState = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [createOpenSlot('contract.shape.price.level_set.density')],
      })],
    })

    const countResult = service.resolve({ currentState: countState, message: '网格数量 20' })
    const intervalResult = service.resolve({ currentState: intervalState, message: '20个间隔' })

    expect(countResult.consumed).toBe(true)
    expect(countResult.answer).toEqual({ gridCount: 20 })
    expect(intervalResult.consumed).toBe(true)
    expect(intervalResult.answer).toEqual({ gridIntervals: 20, gridCount: 21 })
    expect(intervalResult.nextState.triggers[0].contracts?.[0].capabilities[0].shape).toEqual(expect.objectContaining({
      gridIntervals: 20,
      gridCount: 21,
    }))
  })

  it('does not open conflict when merged grid count and absolute spacing are consistent', () => {
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [createOpenSlot('contract.shape.price.level_set.density')],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '11格，每格100 USDT',
    })

    expect(result.consumed).toBe(true)
    expect(result.nextState.triggers[0].status).toBe('locked')
    expect(result.nextState.triggers[0].openSlots).toEqual([])
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).toEqual(expect.objectContaining({
      gridCount: 11,
      absoluteSpacing: 100,
    }))
  })

  it('opens conflict when existing grid count disagrees with a later spacing answer', () => {
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, gridCount: 11, spacingMode: 'arithmetic' },
        openSlots: [createOpenSlot('contract.shape.price.level_set.density')],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '间距50',
    })

    expect(result.consumed).toBe(true)
    expect(result.answer).toEqual({ absoluteSpacing: 50 })
    expect(result.nextState.triggers[0].status).toBe('open')
    expect(result.nextState.triggers[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.shape.price.level_set.spacing_conflict',
        questionHint: '网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。',
      }),
    ])
  })

  it('does not consume invalid grid count numbers', () => {
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [createOpenSlot('contract.shape.price.level_set.density')],
      })],
    })

    for (const message of ['-20格', '20.5格', '10000格']) {
      expect(service.resolve({ currentState: state, message })).toEqual({
        consumed: false,
        nextState: state,
      })
    }
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
  id?: string
  contractId?: string
  shape?: Record<string, string | number>
  openSlots: SemanticSlotState[]
  contracts?: SemanticState['triggers'][number]['contracts']
}): SemanticState['triggers'][number] {
  return {
    id: input.id ?? 'trigger-grid-levels',
    key: 'custom.price.levels',
    phase: 'entry',
    params: {},
    status: input.openSlots.length ? 'open' : 'locked',
    source: 'derived',
    openSlots: input.openSlots,
    contracts: input.contracts ?? [createLevelSetContract(
      input.contractId ?? 'contract-grid-levels',
      input.shape ?? { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
    )],
  }
}

function createLevelSetContract(id: string, shape: SemanticCapabilityShape): NonNullable<SemanticState['triggers'][number]['contracts']>[number] {
  return {
    id,
    kind: 'trigger',
    capabilities: [{
      domain: 'price',
      verb: 'define',
      object: 'level_set',
      shape,
    }],
    requires: [],
    params: {},
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
