import { evaluateGuards } from './evaluate-guards'

describe('evaluateGuards', () => {
  it('forces a short stop loss and records the stop-loss bar for cooldown', () => {
    const ctx = {
      __compiledDecisionState: { barIndex: 7, lastTriggeredByProgram: {} },
      position: { qty: -1, avgEntryPrice: 100 },
      currentPrice: 103,
      semanticRuntimeState: {},
    }

    const guardState = evaluateGuards(
      ctx,
      [
        {
          id: 'guard_short_stop_loss',
          payload: {
            kind: 'STOP_LOSS_PCT',
            scope: 'position',
            appliesTo: 'short',
            value: 3,
            onBreach: 'FORCE_EXIT',
          },
        },
      ],
      {},
      ['guard_short_stop_loss'],
    )

    expect(guardState.forceExit).toBe(true)
    expect(ctx.semanticRuntimeState).toEqual({
      cooldown: {
        lastExitBarIndex: 7,
        lastExitReason: 'stop_loss',
        lastStopLossBarIndex: 7,
      },
    })
  })
})
