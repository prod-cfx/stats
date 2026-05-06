import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import type { SemanticCapabilityShape, SemanticSlotState, SemanticState } from '../../types/semantic-state'
import type { SemanticOpenSlotAnswerResolverResult } from '../semantic-open-slot-answer-resolver.service'
import { buildSemanticSlotId } from '../../types/semantic-state'
import { SemanticOpenSlotAnswerResolverService } from '../semantic-open-slot-answer-resolver.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'

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

    expectConsumed(result)
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

    expectConsumed(result)
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

    expectConsumed(result)
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

    expectConsumed(result)
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

    expectConsumed(result)
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

    expectConsumed(result)
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

    expectConsumed(result)
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

    expectConsumed(result)
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

    expectConsumed(countResult)
    expect(countResult.answer).toEqual({ gridCount: 20 })
    expectConsumed(intervalResult)
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

    expectConsumed(result)
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

    expectConsumed(result)
    expect(result.answer).toEqual({ absoluteSpacing: 50 })
    expect(result.nextState.triggers[0].status).toBe('open')
    expect(result.nextState.triggers[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.shape.price.level_set.spacing_conflict',
        questionHint: '网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。',
      }),
    ])
  })

  it('resolves spacing conflict by keeping the grid count', () => {
    const conflictSlot = createOpenSlot('contract.shape.price.level_set.spacing_conflict')
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: {
          lower: 79200,
          upper: 80200,
          gridCount: 20,
          absoluteSpacing: 100,
          spacingMode: 'arithmetic',
        },
        openSlots: [conflictSlot],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '保留网格数量',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotId: buildSemanticSlotId(conflictSlot),
        }],
      },
    })

    expectConsumed(result)
    expect(result.answer).toEqual({ resolveConflictBy: 'gridCount' })
    expect(result.nextState.triggers[0].openSlots).toEqual([])
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).toEqual(expect.objectContaining({
      gridCount: 20,
    }))
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).not.toEqual(expect.objectContaining({
      absoluteSpacing: 100,
    }))
  })

  it('resolves spacing conflict by keeping the spacing', () => {
    const conflictSlot = createOpenSlot('contract.shape.price.level_set.spacing_conflict')
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: {
          lower: 79200,
          upper: 80200,
          gridCount: 20,
          absoluteSpacing: 100,
          spacingMode: 'arithmetic',
        },
        openSlots: [conflictSlot],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '保留每格间距',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotKey: conflictSlot.slotKey,
          fieldPath: conflictSlot.fieldPath,
        }],
      },
    })

    expectConsumed(result)
    expect(result.answer).toEqual({ resolveConflictBy: 'spacing' })
    expect(result.nextState.triggers[0].openSlots).toEqual([])
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).toEqual(expect.objectContaining({
      absoluteSpacing: 100,
    }))
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).not.toEqual(expect.objectContaining({
      gridCount: 20,
    }))
  })

  it('resolves spacing conflict from a bare spacing choice answer', () => {
    const conflictSlot = createOpenSlot('contract.shape.price.level_set.spacing_conflict')
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: {
          lower: 79200,
          upper: 80200,
          gridCount: 20,
          absoluteSpacing: 100,
          spacingMode: 'arithmetic',
        },
        openSlots: [conflictSlot],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '每格间距',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotKey: conflictSlot.slotKey,
          fieldPath: conflictSlot.fieldPath,
        }],
      },
    })

    expectConsumed(result)
    expect(result.answer).toEqual({ resolveConflictBy: 'spacing' })
    expect(result.nextState.triggers[0].openSlots).toEqual([])
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).toEqual(expect.objectContaining({
      absoluteSpacing: 100,
    }))
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).not.toEqual(expect.objectContaining({
      gridCount: 20,
    }))
  })

  it('resolves percent spacing conflict by keeping the spacing', () => {
    const conflictSlot = createOpenSlot('contract.shape.price.level_set.spacing_conflict')
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: {
          lower: 100,
          upper: 110,
          gridCount: 20,
          spacingPct: 0.5,
          spacingMode: 'arithmetic',
        },
        openSlots: [conflictSlot],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '保留每格间距',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotKey: conflictSlot.slotKey,
          fieldPath: conflictSlot.fieldPath,
        }],
      },
    })

    expectConsumed(result)
    expect(result.answer).toEqual({ resolveConflictBy: 'spacing' })
    expect(result.nextState.triggers[0].openSlots).toEqual([])
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).toEqual(expect.objectContaining({
      spacingPct: 0.5,
    }))
    expect(result.nextState.triggers[0].contracts?.[0].capabilities[0].shape).not.toEqual(expect.objectContaining({
      gridCount: 20,
    }))
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

  it('does not fallback to a level set slot when another clarification item is active', () => {
    const positionSlot = {
      slotKey: 'position.sizing',
      fieldPath: 'position.sizing',
      status: 'open',
      priority: 'core',
      questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
      affectsExecution: true,
    } satisfies SemanticSlotState
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [createOpenSlot('contract.shape.price.level_set.density')],
      })],
      position: {
        mode: 'fixed_ratio',
        value: 0,
        positionMode: 'long_only',
        status: 'open',
        source: 'derived',
        openSlots: [positionSlot],
      },
    })

    const result = service.resolve({
      currentState: state,
      message: '10%',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotId: buildSemanticSlotId(positionSlot),
          slotKey: positionSlot.slotKey,
          fieldPath: positionSlot.fieldPath,
        }],
      },
    })

    expect(result).toEqual({
      consumed: false,
      nextState: state,
    })
  })

  it('does not skip the active position clarification to consume a later level set item', () => {
    const positionSlot = {
      slotKey: 'position.sizing',
      fieldPath: 'position.sizing',
      status: 'open',
      priority: 'core',
      questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
      affectsExecution: true,
    } satisfies SemanticSlotState
    const densitySlot = createOpenSlot('contract.shape.price.level_set.density')
    const state = createSemanticState({
      triggers: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [densitySlot],
      })],
      position: {
        mode: 'fixed_ratio',
        value: 0,
        positionMode: 'long_only',
        status: 'open',
        source: 'derived',
        openSlots: [positionSlot],
      },
    })

    const result = service.resolve({
      currentState: state,
      message: '10%',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            status: 'pending',
            slotId: buildSemanticSlotId(positionSlot),
            slotKey: positionSlot.slotKey,
            fieldPath: positionSlot.fieldPath,
          },
          {
            status: 'pending',
            slotId: buildSemanticSlotId(densitySlot),
            slotKey: densitySlot.slotKey,
            fieldPath: densitySlot.fieldPath,
          },
        ],
      },
    })

    expect(result).toEqual({
      consumed: false,
      nextState: state,
    })
  })
})

describe('SemanticOpenSlotAnswerResolverService semantic fragments', () => {
  const service = new SemanticOpenSlotAnswerResolverService(undefined, new SemanticSeedExtractorService())

  it('locks an open symbol context slot from an inferred symbol answer', () => {
    const state = stateWithMissingEntry()
    state.contextSlots.symbol = {
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: null,
      status: 'open',
      priority: 'context',
      questionHint: '请选择标的。',
      affectsExecution: true,
    }

    const result = service.resolve({
      currentState: state,
      message: 'ETH',
    })

    expectConsumed(result)
    expect(result.answer).toEqual({})
    expect(result.closedSlotKeys).toEqual(['symbol'])
    expect(result.closedSlots).toEqual([{ slotKey: 'symbol', fieldPath: 'contextSlots.symbol' }])
    expect(result.nextState.contextSlots.symbol).toEqual(expect.objectContaining({
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: 'ETHUSDT',
      status: 'locked',
      evidence: {
        text: 'ETH',
        source: 'inferred',
      },
      contracts: expect.arrayContaining([
        expect.objectContaining({
          id: 'context-symbol-ETHUSDT',
          kind: 'context',
          capabilities: expect.arrayContaining([
            expect.objectContaining({
              domain: 'market',
              verb: 'identify',
              object: 'instrument',
              shape: expect.objectContaining({
                symbol: 'ETHUSDT',
                base: 'ETH',
                quote: 'USDT',
                source: 'inferred',
                quoteSource: 'default_usdt',
              }),
            }),
          ]),
        }),
      ]),
    }))
  })

  it('locks an open symbol context slot from an explicit usdc symbol answer', () => {
    const state = stateWithMissingEntry()
    state.contextSlots.symbol = {
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: null,
      status: 'open',
      priority: 'context',
      questionHint: '请选择标的。',
      affectsExecution: true,
    }

    const result = service.resolve({
      currentState: state,
      message: 'ETH usdc',
    })

    expectConsumed(result)
    expect(result.nextState.contextSlots.symbol).toEqual(expect.objectContaining({
      value: 'ETHUSDC',
      status: 'locked',
      evidence: {
        text: 'ETH usdc',
        source: 'user_explicit',
      },
      contracts: expect.arrayContaining([
        expect.objectContaining({
          id: 'context-symbol-ETHUSDC',
          params: expect.objectContaining({
            symbol: 'ETHUSDC',
            base: 'ETH',
            quote: 'USDC',
            source: 'user_explicit',
            quoteSource: 'explicit',
          }),
        }),
      ]),
    }))
  })

  it('consumes a complete entry trigger fragment for a missing entry slot', () => {
    const result = service.resolve({
      currentState: stateWithMissingEntry(),
      message: '15min k线在 ema20 上方开多',
    })

    expectConsumed(result)
    if (!result.consumed) return

    expect(result.nextState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          indicator: 'ema',
          'reference.period': 20,
          timeframe: '15m',
        }),
      }),
    ]))
    expect(result.nextState.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
    ]))
    expect(result.nextState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.missing_entry_atom', status: 'open' }),
    ]))
    expect(result.closedSlotKeys).toContain('trigger.entry')
  })

  it('locks an open timeframe context slot from a consumed entry fragment', () => {
    const state = stateWithMissingEntry()
    state.contextSlots.timeframe = {
      slotKey: 'timeframe',
      fieldPath: 'contextSlots.timeframe',
      value: null,
      status: 'open',
      priority: 'context',
      questionHint: '请选择时间周期。',
      affectsExecution: true,
    }

    const result = service.resolve({
      currentState: state,
      message: '15min k线在 ema20 上方开多',
    })

    expectConsumed(result)
    expect(result.nextState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
      }),
    ]))
    expect(result.nextState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.missing_entry_atom', status: 'open' }),
    ]))
    expect(result.nextState.contextSlots.timeframe).toEqual(expect.objectContaining({
      status: 'locked',
      value: '15m',
    }))
  })

  it('closes entry and exit slots when one fragment fulfills both phases', () => {
    const result = service.resolve({
      currentState: stateWithMissingEntryAndExit(),
      message: '15m 收盘价高于开盘价开多，收盘价低于开盘价平多',
    })

    expectConsumed(result)
    expect(result.nextState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'entry' }),
      expect.objectContaining({ phase: 'exit' }),
    ]))
    expect(result.nextState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.missing_entry_atom', status: 'open' }),
    ]))
    expect(result.nextState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.missing_exit_atom', status: 'open' }),
    ]))
    expect(result.closedSlotKeys).toEqual(expect.arrayContaining(['trigger.entry', 'trigger.exit']))
  })

  it('does not merge trigger phases that do not have an open missing slot', () => {
    const result = service.resolve({
      currentState: stateWithMissingEntry(),
      message: '15m 收盘价高于开盘价开多，收盘价低于开盘价平多',
    })

    expectConsumed(result)
    expect(result.nextState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'entry' }),
    ]))
    expect(result.nextState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'exit' }),
    ]))
    expect(result.nextState.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
    ]))
    expect(result.nextState.actions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'close_long' }),
    ]))
    expect(result.closedSlotKeys).toEqual(['trigger.entry'])
  })

  it('keeps complete gate triggers attached to a fulfilled entry fragment', () => {
    const mixedService = new SemanticOpenSlotAnswerResolverService(undefined, new MixedEntryGateExitSeedExtractorService())

    const result = mixedService.resolve({
      currentState: stateWithMissingEntry(),
      message: 'entry with gate and extra exit',
    })

    expectConsumed(result)
    expect(result.nextState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'entry', key: 'indicator.above' }),
      expect.objectContaining({ phase: 'gate', key: 'condition.expression' }),
    ]))
    expect(result.nextState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'exit' }),
    ]))
    expect(result.nextState.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
    ]))
    expect(result.nextState.actions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'close_long' }),
    ]))
  })

  it('does not fulfill an entry slot from an incomplete entry trigger fragment', () => {
    const incompleteService = new SemanticOpenSlotAnswerResolverService(undefined, new IncompleteEntrySeedExtractorService())
    const state = stateWithMissingEntry()

    const result = incompleteService.resolve({
      currentState: state,
      message: 'entry trigger with missing threshold',
    })

    expect(result).toEqual({
      consumed: false,
      nextState: state,
    })
    expect(result.nextState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'locked',
        openSlots: expect.arrayContaining([
          expect.objectContaining({ status: 'open' }),
        ]),
      }),
    ]))
  })

  it('locks structured symbol context fragments using their resolved value', () => {
    const structuredSymbolService = new SemanticOpenSlotAnswerResolverService(undefined, new StructuredSymbolSeedExtractorService())
    const state = {
      ...stateWithMissingEntry(),
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
    }

    const result = structuredSymbolService.resolve({
      currentState: state,
      message: 'ETH usdt 做多',
    })

    expectConsumed(result)
    expect(result.nextState.contextSlots.symbol).toEqual(expect.objectContaining({
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: 'ETHUSDT',
      status: 'locked',
      evidence: {
        text: 'ETH usdt',
        source: 'user_explicit',
      },
      contracts: expect.arrayContaining([
        expect.objectContaining({
          id: 'context-symbol-ETHUSDT',
          kind: 'context',
          capabilities: expect.arrayContaining([
            expect.objectContaining({
              domain: 'market',
              verb: 'identify',
              object: 'instrument',
              shape: expect.objectContaining({
                symbol: 'ETHUSDT',
                base: 'ETH',
                quote: 'USDT',
                source: 'user_explicit',
                quoteSource: 'explicit',
              }),
            }),
          ]),
          params: expect.objectContaining({
            symbol: 'ETHUSDT',
            base: 'ETH',
            quote: 'USDT',
            source: 'user_explicit',
            quoteSource: 'explicit',
          }),
        }),
      ]),
    }))
  })

  it('keeps open non-symbol context slots when fragment value is structured', () => {
    const nonSymbolObjectService = new SemanticOpenSlotAnswerResolverService(undefined, new NonSymbolObjectSeedExtractorService())
    const openTimeframeSlot: SemanticSlotState = {
      slotKey: 'timeframe',
      fieldPath: 'contextSlots.timeframe',
      status: 'open',
      priority: 'context',
      questionHint: '请选择时间周期。',
      affectsExecution: true,
    }
    const state = {
      ...stateWithMissingEntry(),
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: openTimeframeSlot,
      },
    }

    const result = nonSymbolObjectService.resolve({
      currentState: state,
      message: 'entry with structured timeframe',
    })

    expectConsumed(result)
    expect(result.nextState.contextSlots.timeframe).toBe(openTimeframeSlot)
  })
})

class IncompleteEntrySeedExtractorService extends SemanticSeedExtractorService {
  override extract(): CodegenSemanticPatch {
    return {
      triggers: [{
        key: 'indicator.above',
        phase: 'entry',
        params: { indicator: 'ema' },
        openSlots: [{
          slotKey: 'trigger.entry.threshold',
          fieldPath: 'triggers[indicator.above].params.threshold',
          status: 'open',
          priority: 'core',
          questionHint: '请补充阈值。',
          affectsExecution: true,
        }],
      }],
    }
  }
}

class MixedEntryGateExitSeedExtractorService extends SemanticSeedExtractorService {
  override extract(): CodegenSemanticPatch {
    return {
      triggers: [
        {
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ema', 'reference.period': 20 },
        },
        {
          key: 'condition.expression',
          phase: 'gate',
          params: {
            expression: {
              kind: 'predicate',
              op: 'EQ',
              left: { kind: 'position', field: 'has_position', side: 'long' },
              right: { kind: 'constant', value: false },
            },
          },
        },
        {
          key: 'indicator.below',
          phase: 'exit',
          params: { indicator: 'ema', 'reference.period': 20 },
        },
      ],
      actions: [
        { key: 'open_long', params: {} },
        { key: 'close_long', params: {} },
      ],
    }
  }
}

class StructuredSymbolSeedExtractorService extends SemanticSeedExtractorService {
  override extract(): CodegenSemanticPatch {
    return {
      contextSlots: {
        symbol: {
          value: 'ETHUSDT',
          source: 'user_explicit',
          evidenceText: 'ETH usdt',
          base: 'ETH',
          quote: 'USDT',
          quoteSource: 'explicit',
        },
      },
      triggers: [{
        key: 'condition.expression',
        phase: 'entry',
        params: {
          expression: {
            kind: 'predicate',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
            right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
          },
        },
      }],
      actions: [{ key: 'open_long', params: {} }],
    }
  }
}

class NonSymbolObjectSeedExtractorService extends SemanticSeedExtractorService {
  override extract(): CodegenSemanticPatch {
    return {
      contextSlots: {
        timeframe: {
          value: '15m',
          source: 'user_explicit',
          evidenceText: '15m',
          base: 'BTC',
          quote: 'USDT',
          quoteSource: 'explicit',
        },
      },
      triggers: [{
        key: 'condition.expression',
        phase: 'entry',
        params: {
          expression: {
            kind: 'predicate',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
            right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
          },
        },
      }],
      actions: [{ key: 'open_long', params: {} }],
    }
  }
}

function stateWithMissingEntry(): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [{
      id: 'semantic-missing-entry-atom',
      key: 'semantic.missing_entry_atom',
      phase: 'entry',
      params: {},
      status: 'open',
      source: 'derived',
      openSlots: [{
        slotKey: 'trigger.entry',
        fieldPath: 'triggers[entry]',
        status: 'open',
        priority: 'core',
        questionHint: '请补充入场触发条件。',
        affectsExecution: true,
      }],
    }],
    actions: [],
    risk: [],
    position: {
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    },
    contextSlots: {
      exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请选择交易所。', affectsExecution: true },
      symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '请选择标的。', affectsExecution: true },
      marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'perp', status: 'locked', priority: 'context', questionHint: '请选择市场类型。', affectsExecution: true },
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-05T00:00:00.000Z',
  }
}

function stateWithMissingEntryAndExit(): SemanticState {
  const state = stateWithMissingEntry()

  return {
    ...state,
    triggers: [
      ...state.triggers,
      {
        id: 'semantic-missing-exit-atom',
        key: 'semantic.missing_exit_atom',
        phase: 'exit',
        params: {},
        status: 'open',
        source: 'derived',
        openSlots: [{
          slotKey: 'trigger.exit',
          fieldPath: 'triggers[exit]',
          status: 'open',
          priority: 'core',
          questionHint: '请补充出场触发条件。',
          affectsExecution: true,
        }],
      },
    ],
  }
}

function expectConsumed(
  result: SemanticOpenSlotAnswerResolverResult,
): asserts result is Extract<SemanticOpenSlotAnswerResolverResult, { consumed: true }> {
  expect(result.consumed).toBe(true)
}

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
  slotKey: 'contract.shape.price.level_set.density' | 'contract.requirement.price.define.level_set' | 'contract.shape.price.level_set.spacing_conflict',
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
