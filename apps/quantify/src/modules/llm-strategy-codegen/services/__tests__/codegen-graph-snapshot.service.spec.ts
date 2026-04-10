import { CodegenGraphSnapshotService } from '../codegen-graph-snapshot.service'

describe('codegenGraphSnapshotService', () => {
  it('builds a server-side graph snapshot matching checklist gate semantics', () => {
    const service = new CodegenGraphSnapshotService()

    const snapshot = service.build({
      version: 3,
      specDesc: {
        market: { symbols: ['BTCUSDT'], timeframes: ['1h'] },
        entryRules: ['CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))'],
        exitRules: ['CROSS_UNDER(EMA(CLOSE,7),EMA(CLOSE,21))'],
        riskRules: { stopLoss: 'STOP_LOSS_PCT(4)' },
      },
      fallback: { exchange: 'binance', symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 25 },
    })

    expect(snapshot).toEqual({
      version: 3,
      status: 'confirmed',
      trigger: [
        {
          id: 'trigger-entry-3-0',
          phase: 'entry',
          operator: 'CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))',
          join: undefined,
        },
        {
          id: 'trigger-exit-3-0',
          phase: 'exit',
          operator: 'CROSS_UNDER(EMA(CLOSE,7),EMA(CLOSE,21))',
          join: 'AND',
        },
      ],
      actions: [
        {
          id: 'action-buy-3',
          action: 'BUY',
          target: 'BTCUSDT',
          amount: '25%',
        },
        {
          id: 'action-sell-3',
          action: 'SELL',
          target: 'BTCUSDT',
          amount: '25%',
        },
      ],
      risk: ['stopLoss: STOP_LOSS_PCT(4)'],
      meta: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        positionPct: 25,
        executionTags: [],
      },
    })
  })

  it('does not emit display-only fallback trigger or risk placeholders', () => {
    const service = new CodegenGraphSnapshotService()

    const snapshot = service.build({
      version: 1,
      specDesc: {},
      fallback: { exchange: 'okx', symbol: 'ETHUSDT', baseTimeframe: '15m', positionPct: 10 },
    })

    expect(snapshot.trigger).toEqual([])
    expect(snapshot.actions).toEqual([])
    expect(snapshot.risk).toEqual([])
    expect(snapshot.meta).toEqual({
      exchange: 'okx',
      symbol: 'ETHUSDT',
      timeframe: '15m',
      positionPct: 10,
      executionTags: [],
    })
  })
})
