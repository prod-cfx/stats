import { runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime'

type Programs = Parameters<typeof runDecisionPrograms>[1]
type Ctx = Parameters<typeof runDecisionPrograms>[0]
type Guard = Parameters<typeof runDecisionPrograms>[3]

const baseGuard = { forceExit: false, blockNewEntry: false, strategyHalt: false } as Guard

function runLifecycleProgram(
  program: Record<string, unknown>,
  ctx: Ctx,
) {
  return runDecisionPrograms(
    ctx,
    [program] as unknown as Programs,
    { ready: true },
    baseGuard,
    [String(program.id)],
  )
}

describe('atomic contract position lifecycle compiled runtime', () => {
  it('truncates reduce_position to current long quantity and never reverses', () => {
    const decision = runLifecycleProgram(
      {
        id: 'reduce-long',
        phase: 'exit',
        priority: 100,
        when: 'ready',
        actions: [
          { kind: 'REDUCE_LONG', quantity: { mode: 'fixed_base', value: 5 } },
        ],
      },
      {
        position: { side: 'long', qty: 2 },
        currentPrice: 100,
        accountEquity: 1_000,
      } as Ctx,
    )

    expect(decision).toMatchObject({
      action: 'ADJUST_POSITION',
      adjustMode: 'DELTA',
      size: { mode: 'QTY', value: -2 },
      reason: 'compiled.reduce-long',
    })
  })

  it('blocks add_position when pyramiding layer count reaches max layers', () => {
    const decision = runLifecycleProgram(
      {
        id: 'add-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          addPosition: { maxLayers: 3, stateKey: 'pyramiding_layer_count' },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 20 } },
        ],
      },
      {
        position: { side: 'long', qty: 1 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          pyramiding_layer_count: { value: 3 },
        },
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.add-long.pyramiding_limit',
    })
  })

  it('blocks add_position when pyramiding runtime state is missing', () => {
    const decision = runLifecycleProgram(
      {
        id: 'add-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          addPosition: { maxLayers: 3, stateKey: 'pyramiding_layer_count' },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 20 } },
        ],
      },
      {
        position: { side: 'long', qty: 1 },
        currentPrice: 100,
        accountEquity: 1_000,
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.add-long.pyramiding_state_missing',
    })
    expect(decision.action).not.toBe('OPEN_LONG')
  })

  it('executes add_position when pyramiding runtime state slot is initialized empty', () => {
    const decision = runLifecycleProgram(
      {
        id: 'add-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          addPosition: { maxLayers: 3, stateKey: 'pyramiding_layer_count' },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 20 } },
        ],
      },
      {
        position: { side: 'long', qty: 1 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          pyramiding_layer_count: {},
        },
      } as Ctx,
    )

    expect(decision).toMatchObject({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.2 },
      reason: 'compiled.add-long',
    })
    expect(decision.reason).not.toBe('compiled.add-long.pyramiding_state_missing')
  })

  it('blocks add_position when pyramiding runtime state value is corrupt', () => {
    const decision = runLifecycleProgram(
      {
        id: 'add-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          addPosition: { maxLayers: 3, stateKey: 'pyramiding_layer_count' },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 20 } },
        ],
      },
      {
        position: { side: 'long', qty: 1 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          pyramiding_layer_count: { value: 'bad' },
        },
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.add-long.pyramiding_state_missing',
    })
    expect(decision.action).not.toBe('OPEN_LONG')
  })

  it('closes the current long before opening a reverse short', () => {
    const decision = runLifecycleProgram(
      {
        id: 'reverse-short',
        phase: 'rebalance',
        priority: 100,
        when: 'ready',
        metadata: {
          reversePosition: {
            fromSide: 'long',
            toSide: 'short',
            sameBarPolicy: 'allow',
            sizingSource: 'current_position',
          },
        },
        actions: [
          { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
          { kind: 'OPEN_SHORT', quantity: { mode: 'position_pct', value: 100 } },
        ],
      },
      {
        position: { side: 'long', qty: 2 },
        currentPrice: 100,
        accountEquity: 1_000,
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'CLOSE_LONG',
      size: { mode: 'QTY', value: 2 },
      reason: 'compiled.reverse-short.reverse.close_first',
    })
  })

  it('blocks reverse when current signed quantity does not match fromSide', () => {
    const decision = runLifecycleProgram(
      {
        id: 'reverse-short',
        phase: 'rebalance',
        priority: 100,
        when: 'ready',
        metadata: {
          reversePosition: {
            fromSide: 'long',
            toSide: 'short',
            sameBarPolicy: 'allow',
            sizingSource: 'current_position',
          },
        },
        actions: [
          { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
          { kind: 'OPEN_SHORT', quantity: { mode: 'position_pct', value: 100 } },
        ],
      },
      {
        position: { side: 'short', qty: -2 },
        currentPrice: 100,
        accountEquity: 1_000,
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.reverse-short.reverse.side_mismatch',
    })
  })

  it('executes add_position when pyramiding layer count is below max layers', () => {
    const decision = runLifecycleProgram(
      {
        id: 'add-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          addPosition: { maxLayers: 3, stateKey: 'pyramiding_layer_count' },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 20 } },
        ],
      },
      {
        position: { side: 'long', qty: 1 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          pyramiding_layer_count: { value: 2 },
        },
      } as Ctx,
    )

    expect(decision).toMatchObject({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.2 },
      reason: 'compiled.add-long',
    })
    expect(decision.action).not.toBe('NOOP')
  })

  it('blocks dca when runtime dca count reaches max count', () => {
    const decision = runLifecycleProgram(
      {
        id: 'dca-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: { maxCount: 4, capitalCap: 0.5, stateKey: 'dca_count' },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 10 } },
        ],
      },
      {
        position: { side: 'long', qty: 1 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          dca_count: { value: 4 },
        },
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-long.dca_max_count',
    })
  })

  it('blocks dca when runtime dca state is missing', () => {
    const decision = runLifecycleProgram(
      {
        id: 'dca-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: { maxCount: 4, capitalCap: 0.5, stateKey: 'dca_count' },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 10 } },
        ],
      },
      {
        position: { side: 'long', qty: 1 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {},
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-long.dca_state_missing',
    })
    expect(decision.action).not.toBe('OPEN_LONG')
  })

  it('executes dca when runtime dca state slot is initialized empty', () => {
    const decision = runLifecycleProgram(
      {
        id: 'dca-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: { maxCount: 4, capitalCap: 0.5, stateKey: 'dca_fired_count' },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 10 } },
        ],
      },
      {
        position: { side: 'long', qty: 1 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          dca_fired_count: {},
        },
      } as Ctx,
    )

    expect(decision).toMatchObject({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      reason: 'compiled.dca-long',
    })
    expect(decision.reason).not.toBe('compiled.dca-long.dca_state_missing')
  })

  it('blocks dca when runtime dca state value is corrupt', () => {
    const decision = runLifecycleProgram(
      {
        id: 'dca-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: { maxCount: 4, capitalCap: 0.5, stateKey: 'dca_count' },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 10 } },
        ],
      },
      {
        position: { side: 'long', qty: 1 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          dca_count: { value: 'bad' },
        },
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-long.dca_state_missing',
    })
    expect(decision.action).not.toBe('OPEN_LONG')
  })
})
