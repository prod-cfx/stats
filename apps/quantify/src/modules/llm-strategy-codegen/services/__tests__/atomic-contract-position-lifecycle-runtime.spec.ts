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

  it('blocks add_position when position snapshot is missing', () => {
    const program = {
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
    }
    const baseCtx = {
      currentPrice: 100,
      accountEquity: 1_000,
      semanticRuntimeState: {
        pyramiding_layer_count: { value: 1 },
      },
    } as Ctx

    expect(runLifecycleProgram(program, baseCtx)).toEqual({
      action: 'NOOP',
      reason: 'compiled.add-long.position_snapshot_missing',
    })
    expect(runLifecycleProgram(program, {
      ...baseCtx,
      position: { side: 'flat', qty: 0 },
    } as Ctx)).toEqual({
      action: 'NOOP',
      reason: 'compiled.add-long.position_snapshot_missing',
    })
    expect(runLifecycleProgram(program, {
      ...baseCtx,
      position: { side: 'short', qty: -1 },
    } as Ctx)).toEqual({
      action: 'NOOP',
      reason: 'compiled.add-long.position_snapshot_missing',
    })
  })

  it('blocks dca when position snapshot is missing or not same-side', () => {
    const program = {
      id: 'dca-long',
      phase: 'entry',
      priority: 100,
      when: 'ready',
      metadata: {
        dcaSchedule: { maxCount: 4, capitalCap: 500, stateKey: 'dca_fired_count' },
      },
      actions: [
        { kind: 'ADD_LONG', quantity: { mode: 'fixed_quote', value: 100 } },
      ],
    }
    const baseCtx = {
      currentPrice: 100,
      accountEquity: 1_000,
      semanticRuntimeState: {
        dca_fired_count: { value: 1 },
      },
    } as Ctx

    expect(runLifecycleProgram(program, baseCtx)).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-long.position_snapshot_missing',
    })
    expect(runLifecycleProgram(program, {
      ...baseCtx,
      position: { side: 'flat', qty: 0 },
    } as Ctx)).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-long.position_snapshot_missing',
    })
    expect(runLifecycleProgram(program, {
      ...baseCtx,
      position: { side: 'short', qty: -1 },
    } as Ctx)).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-long.position_snapshot_missing',
    })
  })

  it('executes add_position when pyramiding runtime state slot is initialized empty', () => {
    const ctx = {
      position: { side: 'long', qty: 1 },
      currentPrice: 100,
      accountEquity: 1_000,
      semanticRuntimeState: {
        pyramiding_layer_count: {},
      },
    } as Ctx
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
        ...ctx,
      },
    )

    expect(decision).toMatchObject({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.2 },
      reason: 'compiled.add-long',
    })
    expect(decision.reason).not.toBe('compiled.add-long.pyramiding_state_missing')
    expect(ctx.semanticRuntimeState?.pyramiding_layer_count).toEqual({ value: 1 })
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

  it('blocks add_position when projected exposure would exceed max exposure percentage', () => {
    const decision = runLifecycleProgram(
      {
        id: 'add-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          addPosition: {
            maxLayers: 3,
            maxExposurePct: 50,
            stateKey: 'pyramiding_layer_count',
          },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 20 } },
        ],
      },
      {
        position: { side: 'long', qty: 1, exposurePct: 40 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          pyramiding_layer_count: { value: 1 },
        },
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.add-long.max_exposure_pct',
    })
  })

  it('blocks add_position max exposure when next exposure cannot be estimated', () => {
    const decision = runLifecycleProgram(
      {
        id: 'add-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          addPosition: {
            maxLayers: 3,
            maxExposurePct: 50,
            stateKey: 'pyramiding_layer_count',
          },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'fixed_base', value: 2 } },
        ],
      },
      {
        position: { side: 'long', qty: 1, exposurePct: 20 },
        accountEquity: 1_000,
        semanticRuntimeState: {
          pyramiding_layer_count: { value: 1 },
        },
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.add-long.max_exposure_pct',
    })
  })

  it('closes the current long before opening a reverse short on the next bar', () => {
    const program = {
      id: 'reverse-short',
      phase: 'rebalance',
      priority: 100,
      when: 'ready',
      metadata: {
        reversePosition: {
          fromSide: 'long',
          toSide: 'short',
          sameBarPolicy: 'next_bar_only',
          sizingSource: 'current_position',
        },
      },
      actions: [
        { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
        { kind: 'OPEN_SHORT', quantity: { mode: 'position_pct', value: 100 } },
      ],
    }
    const ctx = {
        barIndex: 0,
        position: { side: 'long', qty: 2 },
        currentPrice: 100,
        accountEquity: 1_000,
      } as Ctx

    const decision = runLifecycleProgram(program, ctx)

    expect(decision).toEqual({
      action: 'CLOSE_LONG',
      size: { mode: 'QTY', value: 2 },
      reason: 'compiled.reverse-short.reverse.close_first',
    })

    const followUpDecision = runLifecycleProgram(
      program,
      {
        ...ctx,
        barIndex: 1,
        position: { side: 'flat', qty: 0 },
      } as Ctx,
    )

    expect(followUpDecision).toEqual({
      action: 'OPEN_SHORT',
      size: { mode: 'QTY', value: 2 },
      reason: 'compiled.reverse-short.reverse.open_after_close',
    })
  })

  it('keeps next-bar reverse pending until bar index advances', () => {
    const program = {
      id: 'reverse-short',
      phase: 'rebalance',
      priority: 100,
      when: 'ready',
      metadata: {
        reversePosition: {
          fromSide: 'long',
          toSide: 'short',
          sameBarPolicy: 'next_bar_only',
          sizingSource: 'current_position',
        },
      },
      actions: [
        { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
        { kind: 'OPEN_SHORT', quantity: { mode: 'position_pct', value: 100 } },
      ],
    }
    const ctx = {
      barIndex: 7,
      position: { side: 'long', qty: 2 },
      currentPrice: 100,
      accountEquity: 1_000,
    } as Ctx

    expect(runLifecycleProgram(program, ctx)).toMatchObject({ action: 'CLOSE_LONG' })

    expect(runLifecycleProgram(program, {
      ...ctx,
      barIndex: 7,
      position: { side: 'flat', qty: 0 },
    } as Ctx)).toEqual({
      action: 'NOOP',
      reason: 'compiled.noop',
    })

    expect(runLifecycleProgram(program, {
      ...ctx,
      barIndex: 8,
      position: { side: 'flat', qty: 0 },
    } as Ctx)).toEqual({
      action: 'OPEN_SHORT',
      size: { mode: 'QTY', value: 2 },
      reason: 'compiled.reverse-short.reverse.open_after_close',
    })
  })

  it('executes same-bar reverse as a single delta adjustment', () => {
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
      action: 'ADJUST_POSITION',
      adjustMode: 'DELTA',
      size: { mode: 'QTY', value: -4 },
      reason: 'compiled.reverse-short.reverse.same_bar',
    })
  })

  it('blocks same-bar reverse when orchestration blocks the target entry side', () => {
    const program = {
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
    }

    const decision = runDecisionPrograms(
      {
        position: { side: 'long', qty: 2 },
        currentPrice: 100,
        accountEquity: 1_000,
      } as Ctx,
      [program] as unknown as Programs,
      { ready: true },
      baseGuard,
      ['reverse-short'],
      { blockEntryLong: false, blockEntryShort: true },
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.orchestration.gate.block_entry_short',
    })
  })

  it('uses fixed reverse sizing when sizingSource=fixed', () => {
    const decision = runLifecycleProgram(
      {
        id: 'reverse-short-fixed',
        phase: 'rebalance',
        priority: 100,
        when: 'ready',
        metadata: {
          reversePosition: {
            fromSide: 'long',
            toSide: 'short',
            sameBarPolicy: 'allow',
            sizingSource: 'fixed',
          },
        },
        actions: [
          { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
          { kind: 'OPEN_SHORT', quantity: { mode: 'fixed_base', value: 1 } },
        ],
      },
      {
        position: { side: 'long', qty: 2 },
        currentPrice: 100,
        accountEquity: 1_000,
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'ADJUST_POSITION',
      adjustMode: 'DELTA',
      size: { mode: 'QTY', value: -3 },
      reason: 'compiled.reverse-short-fixed.reverse.same_bar',
    })
  })

  it('uses action sizing when reverse sizingSource=position_sizing', () => {
    const decision = runLifecycleProgram(
      {
        id: 'reverse-short-position-sizing',
        phase: 'rebalance',
        priority: 100,
        when: 'ready',
        metadata: {
          reversePosition: {
            fromSide: 'long',
            toSide: 'short',
            sameBarPolicy: 'allow',
            sizingSource: 'position_sizing',
          },
        },
        actions: [
          { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
          { kind: 'OPEN_SHORT', quantity: { mode: 'pct_equity', value: 50 } },
        ],
      },
      {
        position: { side: 'long', qty: 2 },
        currentPrice: 100,
        accountEquity: 1_000,
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'ADJUST_POSITION',
      adjustMode: 'DELTA',
      size: { mode: 'QTY', value: -7 },
      reason: 'compiled.reverse-short-position-sizing.reverse.same_bar',
    })
  })

  it('continues scanning other programs while a pending reverse waits for a flat position', () => {
    const reverseProgram = {
      id: 'reverse-short',
      phase: 'rebalance',
      priority: 100,
      when: 'reverseReady',
      metadata: {
        reversePosition: {
          fromSide: 'long',
          toSide: 'short',
          sameBarPolicy: 'next_bar_only',
          sizingSource: 'current_position',
        },
      },
      actions: [
        { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
        { kind: 'OPEN_SHORT', quantity: { mode: 'position_pct', value: 100 } },
      ],
    }
    const forceCloseProgram = {
      id: 'force-close',
      phase: 'exit',
      priority: 100,
      when: 'forceCloseReady',
      actions: [
        { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
      ],
    }
    const ctx = {
      position: { side: 'long', qty: 2 },
      currentPrice: 100,
      accountEquity: 1_000,
    } as Ctx

    expect(runDecisionPrograms(
      ctx,
      [reverseProgram] as unknown as Programs,
      { reverseReady: true },
      baseGuard,
      ['reverse-short'],
    )).toMatchObject({ action: 'CLOSE_LONG' })

    const decision = runDecisionPrograms(
      ctx,
      [reverseProgram, forceCloseProgram] as unknown as Programs,
      { reverseReady: true, forceCloseReady: true },
      baseGuard,
      ['reverse-short', 'force-close'],
    )

    expect(decision).toEqual({
      action: 'CLOSE_LONG',
      size: { mode: 'RATIO', value: 1 },
      reason: 'compiled.force-close',
    })
  })

  it('keeps pending reverse waiting when position snapshot is missing', () => {
    const program = {
      id: 'reverse-short',
      phase: 'rebalance',
      priority: 100,
      when: 'ready',
      metadata: {
        reversePosition: {
          fromSide: 'long',
          toSide: 'short',
          sameBarPolicy: 'next_bar_only',
          sizingSource: 'current_position',
        },
      },
      actions: [
        { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
        { kind: 'OPEN_SHORT', quantity: { mode: 'position_pct', value: 100 } },
      ],
    }
    const ctx = {
      position: { side: 'long', qty: 2 },
      currentPrice: 100,
      accountEquity: 1_000,
    } as Ctx

    expect(runLifecycleProgram(program, ctx)).toMatchObject({ action: 'CLOSE_LONG' })

    const followUpDecision = runDecisionPrograms(
      {
        ...ctx,
        position: {},
      } as Ctx,
      [program] as unknown as Programs,
      { ready: false },
      baseGuard,
      ['reverse-short'],
    )

    expect(followUpDecision).toEqual({
      action: 'NOOP',
      reason: 'compiled.noop',
    })
  })

  it('clears pending reverse intent when strategy halt guard fires', () => {
    const program = {
      id: 'reverse-short',
      phase: 'rebalance',
      priority: 100,
      when: 'ready',
      metadata: {
        reversePosition: {
          fromSide: 'long',
          toSide: 'short',
          sameBarPolicy: 'next_bar_only',
          sizingSource: 'current_position',
        },
      },
      actions: [
        { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
        { kind: 'OPEN_SHORT', quantity: { mode: 'position_pct', value: 100 } },
      ],
    }
    const ctx = {
      position: { side: 'long', qty: 2 },
      currentPrice: 100,
      accountEquity: 1_000,
    } as Ctx

    expect(runLifecycleProgram(program, ctx)).toMatchObject({ action: 'CLOSE_LONG' })
    expect(runDecisionPrograms(ctx, [program] as unknown as Programs, { ready: true }, {
      ...baseGuard,
      strategyHalt: true,
    }, ['reverse-short'])).toEqual({
      action: 'NOOP',
      reason: 'compiled.strategy_halt',
    })

    const followUpDecision = runDecisionPrograms(
      {
        ...ctx,
        position: { side: 'flat', qty: 0 },
      } as Ctx,
      [program] as unknown as Programs,
      { ready: false },
      baseGuard,
      ['reverse-short'],
    )

    expect(followUpDecision).toEqual({
      action: 'NOOP',
      reason: 'compiled.noop',
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
    const ctx = {
      position: { side: 'long', qty: 1 },
      currentPrice: 100,
      accountEquity: 1_000,
      semanticRuntimeState: {
        pyramiding_layer_count: { value: 2 },
      },
    } as Ctx
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
      ctx,
    )

    expect(decision).toMatchObject({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.2 },
      reason: 'compiled.add-long',
    })
    expect(decision.action).not.toBe('NOOP')
    expect(ctx.semanticRuntimeState?.pyramiding_layer_count).toEqual({ value: 3 })
  })

  it('uses addRatio as position-relative size for signal_confirm addMode', () => {
    const decision = runLifecycleProgram(
      {
        id: 'add-long-signal',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          addPosition: {
            addMode: 'signal_confirm',
            addRatio: 0.5,
            maxLayers: 3,
            stateKey: 'pyramiding_layer_count',
          },
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
          pyramiding_layer_count: { value: 1 },
        },
      } as Ctx,
    )

    expect(decision).toMatchObject({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.5 },
      reason: 'compiled.add-long-signal',
    })
  })

  it('uses addRatio-resolved size for maxExposurePct checks', () => {
    const decision = runLifecycleProgram(
      {
        id: 'add-long-ratio-cap',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          addPosition: {
            addMode: 'signal_confirm',
            addRatio: 1,
            maxExposurePct: 50,
            maxLayers: 3,
            stateKey: 'pyramiding_layer_count',
          },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 1 } },
        ],
      },
      {
        position: { side: 'long', qty: 4, exposurePct: 40 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          pyramiding_layer_count: { value: 1 },
        },
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.add-long-ratio-cap.max_exposure_pct',
    })
  })

  it('allows profit_pct addMode only when current position is profitable', () => {
    const program = {
      id: 'add-long-profit',
      phase: 'entry',
      priority: 100,
      when: 'ready',
      metadata: {
        addPosition: {
          addMode: 'profit_pct',
          addRatio: 0.3,
          maxLayers: 3,
          stateKey: 'pyramiding_layer_count',
        },
      },
      actions: [
        { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 20 } },
      ],
    }

    expect(runLifecycleProgram(program, {
      position: { side: 'long', qty: 1, avgEntryPrice: 100 },
      currentPrice: 105,
      accountEquity: 1_000,
      semanticRuntimeState: { pyramiding_layer_count: { value: 1 } },
    } as Ctx)).toMatchObject({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.3 },
    })

    expect(runLifecycleProgram(program, {
      position: { side: 'long', qty: 1, avgEntryPrice: 100 },
      currentPrice: 95,
      accountEquity: 1_000,
      semanticRuntimeState: { pyramiding_layer_count: { value: 1 } },
    } as Ctx)).toEqual({
      action: 'NOOP',
      reason: 'compiled.add-long-profit.add_mode_profit_pct_not_met',
    })
  })

  it('allows drawdown_pct addMode only when current position has drawdown', () => {
    const program = {
      id: 'add-long-drawdown',
      phase: 'entry',
      priority: 100,
      when: 'ready',
      metadata: {
        addPosition: {
          addMode: 'drawdown_pct',
          addRatio: 0.2,
          maxLayers: 3,
          stateKey: 'pyramiding_layer_count',
        },
      },
      actions: [
        { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 20 } },
      ],
    }

    expect(runLifecycleProgram(program, {
      position: { side: 'long', qty: 1, highestPriceSinceEntry: 110 },
      currentPrice: 105,
      accountEquity: 1_000,
      semanticRuntimeState: { pyramiding_layer_count: { value: 1 } },
    } as Ctx)).toMatchObject({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.2 },
    })

    expect(runLifecycleProgram(program, {
      position: { side: 'long', qty: 1, highestPriceSinceEntry: 100 },
      currentPrice: 105,
      accountEquity: 1_000,
      semanticRuntimeState: { pyramiding_layer_count: { value: 1 } },
    } as Ctx)).toEqual({
      action: 'NOOP',
      reason: 'compiled.add-long-drawdown.add_mode_drawdown_pct_not_met',
    })
  })

  it('blocks dca when runtime dca count reaches max count', () => {
    const decision = runLifecycleProgram(
      {
        id: 'dca-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: { maxCount: 4, capitalCap: 500, stateKey: 'dca_fired_count' },
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
          dca_fired_count: { value: 4 },
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
          dcaSchedule: { maxCount: 4, capitalCap: 500, stateKey: 'dca_fired_count' },
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
    const ctx = {
      position: { side: 'long', qty: 1 },
      currentPrice: 100,
      accountEquity: 1_000,
      semanticRuntimeState: {
        dca_fired_count: {},
      },
    } as Ctx
    const decision = runLifecycleProgram(
      {
        id: 'dca-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: { maxCount: 4, capitalCap: 500, stateKey: 'dca_fired_count' },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 10 } },
        ],
      },
      ctx,
    )

    expect(decision).toMatchObject({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      reason: 'compiled.dca-long',
    })
    expect(decision.reason).not.toBe('compiled.dca-long.dca_state_missing')
    expect(ctx.semanticRuntimeState?.dca_fired_count).toEqual({
      value: 1,
      spentQuote: 100,
      lastBarIndex: 0,
      lastPrice: 100,
    })
  })

  it('signal triggerMode allows repeated DCA while state limits still apply', () => {
    const ctx = {
      barIndex: 3,
      position: { side: 'long', qty: 1 },
      currentPrice: 100,
      accountEquity: 1_000,
      semanticRuntimeState: {
        dca_fired_count: { value: 1, lastBarIndex: 3, lastPrice: 100 },
      },
    } as Ctx
    const decision = runLifecycleProgram(
      {
        id: 'dca-signal',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: { maxCount: 4, capitalCap: 500, stateKey: 'dca_fired_count', triggerMode: 'signal' },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'fixed_quote', value: 100 } },
        ],
      },
      ctx,
    )

    expect(decision).toMatchObject({ action: 'OPEN_LONG', reason: 'compiled.dca-signal' })
    expect(ctx.semanticRuntimeState?.dca_fired_count).toMatchObject({ value: 2, lastBarIndex: 3, lastPrice: 100 })
  })

  it('time_interval triggerMode waits when DCA already fired on the same bar', () => {
    const decision = runLifecycleProgram(
      {
        id: 'dca-time',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: {
            maxCount: 4,
            capitalCap: 500,
            stateKey: 'dca_fired_count',
            triggerMode: 'time_interval',
            timeIntervalBars: 2,
          },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'fixed_quote', value: 100 } },
        ],
      },
      {
        barIndex: 3,
        position: { side: 'long', qty: 1 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          dca_fired_count: { value: 1, lastBarIndex: 3 },
        },
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-time.dca_time_interval_wait',
    })
  })

  it('price_interval triggerMode waits until the configured price interval is reached', () => {
    const program = {
      id: 'dca-price',
      phase: 'entry',
      priority: 100,
      when: 'ready',
      metadata: {
        dcaSchedule: {
          maxCount: 4,
          capitalCap: 500,
          stateKey: 'dca_fired_count',
          triggerMode: 'price_interval',
          priceIntervalPct: 5,
        },
      },
      actions: [
        { kind: 'ADD_LONG', quantity: { mode: 'fixed_quote', value: 100 } },
      ],
    }

    expect(runLifecycleProgram(program, {
      position: { side: 'long', qty: 1 },
      currentPrice: 100,
      accountEquity: 1_000,
      semanticRuntimeState: {
        dca_fired_count: { value: 1, lastPrice: 100 },
      },
    } as Ctx)).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-price.dca_price_interval_wait',
    })

    expect(runLifecycleProgram(program, {
      position: { side: 'long', qty: 1 },
      currentPrice: 96,
      accountEquity: 1_000,
      semanticRuntimeState: {
        dca_fired_count: { value: 1, lastPrice: 100 },
      },
    } as Ctx)).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-price.dca_price_interval_wait',
    })

    expect(runLifecycleProgram(program, {
      position: { side: 'long', qty: 1 },
      currentPrice: 95,
      accountEquity: 1_000,
      semanticRuntimeState: {
        dca_fired_count: { value: 1, lastPrice: 100 },
      },
    } as Ctx)).toMatchObject({
      action: 'OPEN_LONG',
      reason: 'compiled.dca-price',
    })
  })

  it('dca exitRule cap_only allows normal cap-based DCA', () => {
    const decision = runLifecycleProgram(
      {
        id: 'dca-cap-only',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: {
            maxCount: 4,
            capitalCap: 500,
            stateKey: 'dca_fired_count',
            triggerMode: 'signal',
            exitRule: { type: 'cap_only' },
          },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'fixed_quote', value: 100 } },
        ],
      },
      {
        position: { side: 'long', qty: 1 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          dca_fired_count: { value: 1 },
        },
      } as Ctx,
    )

    expect(decision).toMatchObject({ action: 'OPEN_LONG', reason: 'compiled.dca-cap-only' })
  })

  it('dca exitRule stop_on_break_previous_low stops DCA after previous low breaks', () => {
    const decision = runLifecycleProgram(
      {
        id: 'dca-exit-low',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: {
            maxCount: 4,
            capitalCap: 500,
            stateKey: 'dca_fired_count',
            triggerMode: 'signal',
            exitRule: { type: 'stop_on_break_previous_low', reference: 'previous_low' },
          },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'fixed_quote', value: 100 } },
        ],
      },
      {
        previousLow: 99,
        position: { side: 'long', qty: 1 },
        currentPrice: 98,
        accountEquity: 1_000,
        semanticRuntimeState: {
          dca_fired_count: { value: 1 },
        },
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-exit-low.dca_exit_rule_stop',
    })
  })

  it('blocks dca when runtime dca state value is corrupt', () => {
    const decision = runLifecycleProgram(
      {
        id: 'dca-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: { maxCount: 4, capitalCap: 500, stateKey: 'dca_fired_count' },
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
          dca_fired_count: { value: 'bad' },
        },
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-long.dca_state_missing',
    })
    expect(decision.action).not.toBe('OPEN_LONG')
  })

  it('blocks dca when next order would exceed capital cap', () => {
    const decision = runLifecycleProgram(
      {
        id: 'dca-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: { maxCount: 4, capitalCap: 250, stateKey: 'dca_fired_count' },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'fixed_quote', value: 100 } },
        ],
      },
      {
        position: { side: 'long', qty: 1 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          dca_fired_count: { value: 2 },
        },
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-long.dca_capital_cap',
    })
  })

  it('blocks dca using actual spent quote instead of count times next order estimate', () => {
    const decision = runLifecycleProgram(
      {
        id: 'dca-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: { maxCount: 4, capitalCap: 300, stateKey: 'dca_fired_count' },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'fixed_quote', value: 100 } },
        ],
      },
      {
        position: { side: 'long', qty: 1 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          dca_fired_count: { value: 2, spentQuote: 240 },
        },
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-long.dca_capital_cap',
    })
  })

  it('blocks dca when projected exposure would exceed max exposure percentage', () => {
    const decision = runLifecycleProgram(
      {
        id: 'dca-long',
        phase: 'entry',
        priority: 100,
        when: 'ready',
        metadata: {
          dcaSchedule: {
            maxCount: 4,
            capitalCap: 500,
            maxExposurePct: 45,
            stateKey: 'dca_fired_count',
          },
        },
        actions: [
          { kind: 'ADD_LONG', quantity: { mode: 'fixed_quote', value: 100 } },
        ],
      },
      {
        position: { side: 'long', qty: 1, exposurePct: 40 },
        currentPrice: 100,
        accountEquity: 1_000,
        semanticRuntimeState: {
          dca_fired_count: { value: 1 },
        },
      } as Ctx,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.dca-long.dca_max_exposure_pct',
    })
  })
})
