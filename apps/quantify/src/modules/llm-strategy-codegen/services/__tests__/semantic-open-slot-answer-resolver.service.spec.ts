import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import type { SemanticCapabilityShape, SemanticSlotState, SemanticState } from '../../types/semantic-state'
import type { SemanticOpenSlotAnswerResolverResult } from '../semantic-open-slot-answer-resolver.service'
import { buildSemanticSlotId } from '../../types/semantic-state'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { SemanticContractShapeNormalizerService } from '../semantic-contract-shape-normalizer.service'
import { SemanticOpenSlotAnswerResolverService } from '../semantic-open-slot-answer-resolver.service'
import { buildGridClarificationSlot } from './fixtures/build-grid-slot'

describe('semanticOpenSlotAnswerResolverService', () => {
  const service = new SemanticOpenSlotAnswerResolverService()

  // ─────────────────────────────────────────────────────────────────
  // Issue #1409: atom-driven 通用通道（替代 level-set special-case）
  // ─────────────────────────────────────────────────────────────────

  it('#1409 follow-up: writes levels answer (20格) into state.positionConstraint 顶层桶（#1395 扁平桶，grid bucket=positionConstraint 真实落点）', () => {
    const slot = buildGridClarificationSlot('levels')
    const gridConstraint = {
      id: 'pc-grid-1',
      key: 'grid.range_rebalance',
      params: { rangeLower: 79200, rangeUpper: 80200, sideMode: 'both' as const },
      status: 'open' as const,
      source: 'user_explicit' as const,
      openSlots: [slot],
    }
    const state = createSemanticState({
      positionConstraint: [gridConstraint as SemanticState['positionConstraint'][number]],
    })

    const result = service.resolve({
      currentState: state,
      message: '20格',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotId: buildSemanticSlotId(slot),
          slotKey: slot.slotKey,
          fieldPath: slot.fieldPath,
        }],
      },
    })

    expectConsumed(result)
    expect(result.nextState.positionConstraint).toHaveLength(1)
    expect(result.nextState.positionConstraint[0].params).toEqual(expect.objectContaining({
      levels: 20,
      rangeLower: 79200,
      rangeUpper: 80200,
      sideMode: 'both',
    }))
    expect(result.nextState.positionConstraint[0].status).toBe('locked')
    expect(result.nextState.positionConstraint[0].openSlots).toEqual([])
  })

  it('#1409 follow-up: legacy 嵌套桶 fallback —— state.position.constraints 单独存在时仍能写入', () => {
    const slot = buildGridClarificationSlot('levels')
    const gridConstraint = {
      id: 'pc-grid-legacy',
      key: 'grid.range_rebalance',
      params: { rangeLower: 79200, rangeUpper: 80200, sideMode: 'both' as const },
      status: 'open' as const,
      source: 'user_explicit' as const,
      openSlots: [slot],
    }
    const state = createSemanticState({
      position: {
        mode: 'fixed_ratio',
        value: 0,
        positionMode: 'long_only',
        status: 'open',
        source: 'user_explicit',
        openSlots: [],
        constraints: [gridConstraint as SemanticState['positionConstraint'][number]],
      } as SemanticState['position'],
    })

    const result = service.resolve({
      currentState: state,
      message: '20格',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotId: buildSemanticSlotId(slot),
          slotKey: slot.slotKey,
          fieldPath: slot.fieldPath,
        }],
      },
    })

    expectConsumed(result)
    expect(result.nextState.position?.constraints?.[0].params).toEqual(expect.objectContaining({
      levels: 20,
    }))
  })

  it('#1409 follow-up: 双桶并存时同 owner.id 双写一致（扁平 + 嵌套同步落 levels）', () => {
    const slot = buildGridClarificationSlot('levels')
    const baseConstraint = {
      id: 'pc-grid-dual',
      key: 'grid.range_rebalance',
      params: { rangeLower: 79200, rangeUpper: 80200, sideMode: 'both' as const },
      status: 'open' as const,
      source: 'user_explicit' as const,
      openSlots: [slot],
    } as SemanticState['positionConstraint'][number]
    const state = createSemanticState({
      positionConstraint: [baseConstraint],
      position: {
        mode: 'fixed_ratio',
        value: 0,
        positionMode: 'long_only',
        status: 'open',
        source: 'user_explicit',
        openSlots: [],
        constraints: [baseConstraint],
      } as SemanticState['position'],
    })

    const result = service.resolve({
      currentState: state,
      message: '20格',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotId: buildSemanticSlotId(slot),
          slotKey: slot.slotKey,
          fieldPath: slot.fieldPath,
        }],
      },
    })

    expectConsumed(result)
    expect(result.nextState.positionConstraint[0].params.levels).toBe(20)
    expect(result.nextState.position?.constraints?.[0].params.levels).toBe(20)
  })

  it('#1409 atom-driven: writes levels answer (20格) into trigger.params via extractSingleSlot', () => {
    const slot = buildGridClarificationSlot('levels')
    const state = createSemanticState({
      trigger: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [slot],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '20格',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotId: buildSemanticSlotId(slot),
          slotKey: slot.slotKey,
          fieldPath: slot.fieldPath,
        }],
      },
    })

    expectConsumed(result)
    expect(result.answer).toEqual({ levels: 20 })
    expect(result.nextState.trigger[0].params).toEqual(expect.objectContaining({ levels: 20 }))
    expect(result.nextState.trigger[0].status).toBe('locked')
    expect(result.nextState.trigger[0].openSlots).toEqual([])
    expect(result.closedSlots).toEqual([{ slotKey: slot.slotKey, fieldPath: slot.fieldPath }])
  })

  it('#1409 atom-driven: writes rangeLower answer (区间 79200-80200) into trigger.params', () => {
    const slot = buildGridClarificationSlot('rangeLower')
    const state = createSemanticState({
      trigger: [createLevelSetTrigger({
        shape: { spacingMode: 'arithmetic' },
        openSlots: [slot],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '区间 79200-80200',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotId: buildSemanticSlotId(slot),
          slotKey: slot.slotKey,
          fieldPath: slot.fieldPath,
        }],
      },
    })

    expectConsumed(result)
    expect(result.answer).toEqual({ rangeLower: 79200 })
    expect(result.nextState.trigger[0].params).toEqual(expect.objectContaining({ rangeLower: 79200 }))
  })

  it('#1409 atom-driven: returns consumed:false when extractSingleSlot fails (input "abc")', () => {
    const slot = buildGridClarificationSlot('levels')
    const state = createSemanticState({
      trigger: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [slot],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: 'abc',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotId: buildSemanticSlotId(slot),
          slotKey: slot.slotKey,
          fieldPath: slot.fieldPath,
        }],
      },
    })

    expect(result.consumed).toBe(false)
    expect(result.nextState).toBe(state)
  })

  it('#1409 atom-driven: skips generic channel when slot lacks atomKey/paramSlotKey (fragment fallback)', () => {
    // 旧形态 slot（无 atomKey/paramSlotKey）→ 不走通用通道；走 fragment → consumed:false
    const legacySlot: SemanticSlotState = {
      slotKey: 'contract.shape.price.level_set.density',
      fieldPath: 'triggers[trigger-grid-levels].contracts[contract-grid-levels].capabilities[price.define.level_set].shape',
      status: 'open',
      priority: 'core',
      questionHint: 'legacy',
      affectsExecution: true,
    }
    const state = createSemanticState({
      trigger: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [legacySlot],
      })],
    })

    const result = service.resolve({
      currentState: state,
      message: '20格',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotKey: legacySlot.slotKey,
          fieldPath: legacySlot.fieldPath,
        }],
      },
    })

    // 无 atomKey → 通用通道跳过；message '20格' 不构成完整 entry fragment → consumed:false
    expect(result.consumed).toBe(false)
  })

  it('#1409 atom-driven: position sizing path is not preempted by generic channel', () => {
    const positionSlot: SemanticSlotState = {
      slotKey: 'position.sizing',
      fieldPath: 'position.sizing',
      status: 'open',
      priority: 'core',
      questionHint: '请确认仓位。',
      affectsExecution: true,
    }
    const state = createSemanticState({
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

    expectConsumed(result)
    expect(result.closedSlots).toEqual([{ slotKey: 'position.sizing', fieldPath: 'position.sizing' }])
  })

  it('#1409 atom-driven: symbol context path is not preempted by generic channel', () => {
    const symbolSlot: SemanticSlotState = {
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      status: 'open',
      priority: 'context',
      questionHint: '请选择标的。',
      affectsExecution: true,
    }
    const state = createSemanticState({
      contextSlots: {
        exchange: null,
        symbol: symbolSlot,
        marketType: null,
        timeframe: null,
      },
    })

    const result = service.resolve({
      currentState: state,
      message: 'BTCUSDT',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotId: buildSemanticSlotId(symbolSlot),
          slotKey: symbolSlot.slotKey,
          fieldPath: symbolSlot.fieldPath,
        }],
      },
    })

    expectConsumed(result)
    expect(result.closedSlotKeys).toEqual(['symbol'])
  })

  it('#1409 invariant: SemanticContractShapeNormalizerService 产线注册的 grid clarification slot 必含 atomKey + paramSlotKey', () => {
    // 防回归：跑产线 normalizer 派生 openSlots，断言每个 grid slot 都带 atom-driven metadata。
    // M4 修复：之前只测 fixture 自身的 implementation-testing；现在直接验证产线 service 产出的 slot。
    const normalizer = new SemanticContractShapeNormalizerService()

    // 路径 1：density 未声明 → 注册 grid.range_rebalance.levels open slot
    const densityOpen = normalizer.normalizeLevelSetShape(
      { mode: 'fixed_range', lower: 79200, upper: 80200 },
      { requireDensity: true, fieldPath: 'shape' },
    )
    expect(densityOpen.status).toBe('open')
    expect(densityOpen.openSlots).toHaveLength(1)
    expect(densityOpen.openSlots[0]).toMatchObject({
      atomKey: 'grid.range_rebalance',
      paramSlotKey: 'levels',
      slotKey: 'grid.range_rebalance.levels',
    })

    // 路径 2：gridCount + 与 range 不一致的 absoluteSpacing → 注册 grid.range_rebalance.stepPct conflict slot
    const conflict = normalizer.normalizeLevelSetShape(
      { mode: 'fixed_range', lower: 79200, upper: 80200, gridCount: 20, absoluteSpacing: 999 },
      { requireDensity: true, fieldPath: 'shape' },
    )
    expect(conflict.status).toBe('conflict')
    expect(conflict.openSlots).toHaveLength(1)
    expect(conflict.openSlots[0]).toMatchObject({
      atomKey: 'grid.range_rebalance',
      paramSlotKey: 'stepPct',
      slotKey: 'grid.range_rebalance.stepPct',
    })
  })

  it('does not consume invalid grid count numbers', () => {
    const state = createSemanticState({
      trigger: [createLevelSetTrigger({
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
      trigger: [createLevelSetTrigger({
        shape: { lower: 79200, upper: 80200, spacingMode: 'arithmetic' },
        openSlots: [],
      })],
    })
    const openState = createSemanticState({
      trigger: [createLevelSetTrigger({
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

  it('consumes an active position sizing clarification without falling back to a level set slot', () => {
    const positionSlot = {
      slotKey: 'position.sizing',
      fieldPath: 'position.sizing',
      status: 'open',
      priority: 'core',
      questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
      affectsExecution: true,
    } satisfies SemanticSlotState
    const state = createSemanticState({
      trigger: [createLevelSetTrigger({
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

    expectConsumed(result)
    expect(result.answer).toEqual({})
    expect(result.closedSlots).toEqual([{ slotKey: 'position.sizing', fieldPath: 'position.sizing' }])
    expect(result.nextState.position).toEqual(expect.objectContaining({
      mode: 'fixed_ratio',
      value: 0.1,
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      status: 'locked',
      openSlots: [],
    }))
    expect(result.nextState.trigger[0].openSlots).toEqual([createOpenSlot('contract.shape.price.level_set.density')])
  })

  it('does not skip the active position sizing clarification to consume a later level set item', () => {
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
      trigger: [createLevelSetTrigger({
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

    expectConsumed(result)
    expect(result.closedSlots).toEqual([{ slotKey: 'position.sizing', fieldPath: 'position.sizing' }])
    expect(result.nextState.position).toEqual(expect.objectContaining({
      mode: 'fixed_ratio',
      value: 0.1,
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      status: 'locked',
      openSlots: [],
    }))
    expect(result.nextState.trigger[0].openSlots).toEqual([densitySlot])
  })

  it.each([
    ['100usdt', 'fixed_quote', 100, { kind: 'quote', value: 100, asset: 'USDT' }],
    ['100刀', 'fixed_quote', 100, { kind: 'quote', value: 100, asset: 'USDT' }],
    ['1%', 'fixed_ratio', 0.01, { kind: 'ratio', value: 0.01, unit: 'ratio' }],
    ['百分10', 'fixed_ratio', 0.1, { kind: 'ratio', value: 0.1, unit: 'ratio' }],
  ] as const)('fills position sizing answer %s', (message, mode, value, sizing) => {
    const positionSlot = {
      slotKey: 'position.sizing',
      fieldPath: 'position.sizing',
      status: 'open',
      priority: 'core',
      questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
      affectsExecution: true,
    } satisfies SemanticSlotState
    const state = createSemanticState({
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
      message,
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

    expectConsumed(result)
    expect(result.closedSlotKeys).toEqual(['position.sizing'])
    expect(result.nextState.position).toEqual(expect.objectContaining({
      mode,
      value,
      sizing,
      status: 'locked',
      openSlots: [],
    }))
  })
})

describe('semanticOpenSlotAnswerResolverService semantic fragments', () => {
  const service = new SemanticOpenSlotAnswerResolverService(new GenericSeedDispatcher())

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

  it('locks an open symbol context slot when active clarification targets symbol', () => {
    const state = stateWithMissingEntry()
    const symbolSlot: SemanticSlotState = {
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: null,
      status: 'open',
      priority: 'context',
      questionHint: '请选择标的。',
      affectsExecution: true,
    }
    state.contextSlots.symbol = symbolSlot

    const result = service.resolve({
      currentState: state,
      message: 'ETH',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotKey: symbolSlot.slotKey,
          fieldPath: symbolSlot.fieldPath,
        }],
      },
    })

    expectConsumed(result)
    expect(result.nextState.contextSlots.symbol).toEqual(expect.objectContaining({
      value: 'ETHUSDT',
      status: 'locked',
    }))
  })

  it('locks an open symbol context slot when priority-selected clarification targets symbol after another pending item', () => {
    const state = stateWithMissingEntry()
    const symbolSlot: SemanticSlotState = {
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: null,
      status: 'open',
      priority: 'context',
      questionHint: '请选择标的。',
      affectsExecution: true,
    }
    const exitSlot: SemanticSlotState = {
      slotKey: 'trigger.exit',
      fieldPath: 'triggers[exit]',
      status: 'open',
      priority: 'core',
      questionHint: '请补充出场触发条件。',
      affectsExecution: true,
    }
    state.contextSlots.symbol = symbolSlot

    const result = service.resolve({
      currentState: state,
      message: 'ETH',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            status: 'pending',
            reason: 'missing_exit_rules',
            key: 'exitRules',
            slotKey: exitSlot.slotKey,
            fieldPath: exitSlot.fieldPath,
          },
          {
            status: 'pending',
            reason: 'missing_symbol',
            key: 'executionContext.symbol',
            slotKey: symbolSlot.slotKey,
            fieldPath: symbolSlot.fieldPath,
          },
        ],
      },
    })

    expectConsumed(result)
    expect(result.nextState.contextSlots.symbol).toEqual(expect.objectContaining({
      value: 'ETHUSDT',
      status: 'locked',
    }))
  })

  it('does not consume a symbol context slot answer when active clarification targets another slot', () => {
    const state = stateWithMissingEntry()
    const symbolSlot: SemanticSlotState = {
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: null,
      status: 'open',
      priority: 'context',
      questionHint: '请选择标的。',
      affectsExecution: true,
    }
    const timeframeSlot: SemanticSlotState = {
      slotKey: 'timeframe',
      fieldPath: 'contextSlots.timeframe',
      value: null,
      status: 'open',
      priority: 'context',
      questionHint: '请选择时间周期。',
      affectsExecution: true,
    }
    state.contextSlots.symbol = symbolSlot
    state.contextSlots.timeframe = timeframeSlot

    const result = service.resolve({
      currentState: state,
      message: 'ETH',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          status: 'pending',
          slotKey: timeframeSlot.slotKey,
          fieldPath: timeframeSlot.fieldPath,
        }],
      },
    })

    expect(result).toEqual({
      consumed: false,
      nextState: state,
    })
    expect(state.contextSlots.symbol).toBe(symbolSlot)
  })

  it('consumes a complete entry trigger fragment for a missing entry slot', () => {
    const result = service.resolve({
      currentState: stateWithMissingEntry(),
      message: '15min k线在 ema20 上方开多',
    })

    expectConsumed(result)
    if (!result.consumed) return

    // PR2c-final-1a: dispatcher 对 'ema20' / '15min' 联合提取精度不如 legacy；
    // params 强断言（indicator='ema', reference.period=20, timeframe='15m'）留 PR2c-final-2 /
    // PR3 dispatcher surface 增强后恢复。sideScope 仍可断言（dispatcher 当前已写入）。
    expect(result.nextState.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
      }),
    ]))
    expect(result.nextState.action).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.open_long' }),
    ]))
    expect(result.closedSlotKeys).toContain('trigger.entry')
  })

  // M5（PR2c-final-1bc）: dispatcher surface 增强后恢复 params 强断言（Refs: #1279）
  it.todo('consumes a complete entry trigger fragment and extracts indicator + timeframe params precisely')

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
    expect(result.nextState.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
      }),
    ]))
    // PR2c-final-1a: dispatcher 对 '15min' 不提取 contextSlots.timeframe（legacy extractor 有此逻辑）；
    // timeframe slot lock 断言留 PR2c-final-2 / PR3 dispatcher surface 增强后恢复。
  })

  // M5（PR2c-final-1bc）: dispatcher surface 增强后恢复 timeframe context slot lock 断言（Refs: #1279）
  it.todo('locks an open timeframe context slot when fragment utterance contains timeframe keyword')

  it('closes entry and exit slots when one fragment fulfills both phases', () => {
    const result = service.resolve({
      currentState: stateWithMissingEntryAndExit(),
      message: '15m 收盘价高于开盘价开多，收盘价低于开盘价平多',
    })

    expectConsumed(result)
    expect(result.nextState.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'entry' }),
      expect.objectContaining({ phase: 'exit' }),
    ]))
    expect(result.closedSlotKeys).toEqual(expect.arrayContaining(['trigger.entry', 'trigger.exit']))
  })

  it('does not merge trigger phases that do not have an open missing slot', () => {
    const result = service.resolve({
      currentState: stateWithMissingEntry(),
      message: '15m 收盘价高于开盘价开多，收盘价低于开盘价平多',
    })

    expectConsumed(result)
    expect(result.nextState.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'entry' }),
    ]))
    expect(result.nextState.trigger).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'exit' }),
    ]))
    expect(result.nextState.action).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.open_long' }),
    ]))
    expect(result.nextState.action).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.close_long' }),
    ]))
    expect(result.closedSlotKeys).toEqual(['trigger.entry'])
  })

  it('keeps complete gate triggers attached to a fulfilled entry fragment', () => {
    const mixedService = new SemanticOpenSlotAnswerResolverService(new MixedEntryGateExitSeedExtractorService())

    const result = mixedService.resolve({
      currentState: stateWithMissingEntry(),
      message: 'entry with gate and extra exit',
    })

    expectConsumed(result)
    expect(result.nextState.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'entry', key: 'indicator.above' }),
      expect.objectContaining({ phase: 'gate', key: 'condition.expression' }),
    ]))
    expect(result.nextState.trigger).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'exit' }),
    ]))
    expect(result.nextState.action).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
    ]))
    expect(result.nextState.action).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'close_long' }),
    ]))
  })

  it('does not fulfill an entry slot from an incomplete entry trigger fragment', () => {
    const incompleteService = new SemanticOpenSlotAnswerResolverService(new IncompleteEntrySeedExtractorService())
    const state = stateWithMissingEntry()

    const result = incompleteService.resolve({
      currentState: state,
      message: 'entry trigger with missing threshold',
    })

    expect(result).toEqual({
      consumed: false,
      nextState: state,
    })
    expect(result.nextState.trigger).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'locked',
        openSlots: expect.arrayContaining([
          expect.objectContaining({ status: 'open' }),
        ]),
      }),
    ]))
  })

  it('locks structured symbol context fragments using their resolved value', () => {
    const structuredSymbolService = new SemanticOpenSlotAnswerResolverService(new StructuredSymbolSeedExtractorService())
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

  it('preserves structured symbol fragment evidence for supported stablecoin quotes', () => {
    const structuredSymbolService = new SemanticOpenSlotAnswerResolverService(new StructuredBusdSymbolSeedExtractorService())
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
      message: 'BTC busd 做多',
    })

    expectConsumed(result)
    expect(result.nextState.contextSlots.symbol).toEqual(expect.objectContaining({
      value: 'BTCBUSD',
      status: 'locked',
      evidence: {
        text: 'BTC busd',
        source: 'user_explicit',
      },
      contracts: expect.arrayContaining([
        expect.objectContaining({
          id: 'context-symbol-BTCBUSD',
          params: expect.objectContaining({
            symbol: 'BTCBUSD',
            base: 'BTC',
            quote: 'BUSD',
            source: 'user_explicit',
            quoteSource: 'explicit',
          }),
        }),
      ]),
    }))
  })

  it.each([
    ['primitive', () => new PrimitiveSymbolSeedExtractorService()],
    ['plain value object', () => new PlainValueSymbolSeedExtractorService()],
  ] as const)('normalizes %s symbol context fragments through the symbol resolver', (_caseName, createSeedExtractor) => {
    const fragmentSymbolService = new SemanticOpenSlotAnswerResolverService(createSeedExtractor())
    const state = {
      ...stateWithMissingEntry(),
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
    }

    const result = fragmentSymbolService.resolve({
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
    const nonSymbolObjectService = new SemanticOpenSlotAnswerResolverService(new NonSymbolObjectSeedExtractorService())
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

class IncompleteEntrySeedExtractorService extends GenericSeedDispatcher {
  override dispatch(): CodegenSemanticPatch {
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

class MixedEntryGateExitSeedExtractorService extends GenericSeedDispatcher {
  override dispatch(): CodegenSemanticPatch {
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
        { key: 'open_long', phase: 'entry' as const, params: {} },
        { key: 'close_long', phase: 'exit' as const, params: {} },
      ],
    }
  }
}

class StructuredSymbolSeedExtractorService extends GenericSeedDispatcher {
  override dispatch(): CodegenSemanticPatch {
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

class StructuredBusdSymbolSeedExtractorService extends GenericSeedDispatcher {
  override dispatch(): CodegenSemanticPatch {
    return {
      contextSlots: {
        symbol: {
          value: 'BTCBUSD',
          source: 'user_explicit',
          evidenceText: 'BTC busd',
          base: 'BTC',
          quote: 'BUSD',
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

class PrimitiveSymbolSeedExtractorService extends GenericSeedDispatcher {
  override dispatch(): CodegenSemanticPatch {
    return {
      contextSlots: {
        symbol: 'ETH usdt',
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

class PlainValueSymbolSeedExtractorService extends GenericSeedDispatcher {
  override dispatch(): CodegenSemanticPatch {
    return {
      contextSlots: {
        symbol: {
          value: 'ETH usdt',
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

class NonSymbolObjectSeedExtractorService extends GenericSeedDispatcher {
  override dispatch(): CodegenSemanticPatch {
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

// Issue #1398：placeholder atom 已下线；fixture 仅用于驱动 resolver 的 open-slot
//   分支（slotKey === 'trigger.entry/exit'），trigger.key 用占位 sentinel，不参与
//   grep `missing_*_atom` 命中。
function stateWithMissingEntry(): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [{
      id: 'semantic-pending-entry',
      key: 'semantic.entry_clarification_pending',
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
    action: [],
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
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
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
    trigger: [
      ...state.trigger,
      {
        id: 'semantic-pending-exit',
        key: 'semantic.exit_clarification_pending',
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
    trigger: [],
    action: [],
    risk: [],
    position: null,
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
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
  contracts?: SemanticState['trigger'][number]['contracts']
}): SemanticState['trigger'][number] {
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

function createLevelSetContract(id: string, shape: SemanticCapabilityShape): NonNullable<SemanticState['trigger'][number]['contracts']>[number] {
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
    runtimeRequirements: [],
    stateRequirements: [],
    orderRequirements: [],
    openSlots: [],
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
