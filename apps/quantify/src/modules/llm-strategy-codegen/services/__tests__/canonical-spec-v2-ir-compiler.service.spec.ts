import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

describe('canonicalSpecV2IrCompilerService', () => {
  it('compiles canonical spec v2 into deterministic graphSnapshot and IR without reading UI state', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '15m',
        },
        indicators: [{ kind: 'ema', params: { fast: 7, slow: 21 } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [
          {
            id: 'entry-long',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'ma.golden_cross',
              semanticScope: 'market',
              op: 'CROSS_OVER',
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-long',
            phase: 'exit',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'ma.death_cross',
              semanticScope: 'market',
              op: 'CROSS_UNDER',
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallback: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.graphSnapshot.status).toBe('confirmed')
    expect(result.ir.irVersion).toBe('csi.v1')
    expect(result.ir.source.specHash).toMatch(/^sha256:/)
    expect(result.semanticView).toEqual(expect.objectContaining({
      viewType: 'canonical-semantic-view.v1',
      canonicalDigest: result.ir.source.specHash,
    }))
  })

  it('compiles bollinger outside-band reduce rule with okx perp market metadata', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()

    const result = compiler.compile({
      canonicalSpec: {
        version: 2,
        market: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          timeframe: '15m',
        },
        indicators: [{ kind: 'bollingerBands', params: { period: 20, stdDev: 2 } }],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        dataRequirements: {
          requiredTimeframes: ['15m'],
        },
        rules: [
          {
            id: 'risk-outside-band-3-bars',
            phase: 'risk',
            sideScope: 'both',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'bollinger.bars_outside',
              semanticScope: 'market',
              op: 'GTE',
              value: 3,
              params: { bars: 3 },
            },
            actions: [{ type: 'REDUCE_LONG' }, { type: 'REDUCE_SHORT' }],
          },
        ],
      },
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })

    expect(result.ir.market).toEqual(expect.objectContaining({
      venue: 'okx',
      instrumentType: 'perpetual',
      symbol: 'BTCUSDT',
      timeframes: ['15m'],
    }))
    expect(result.ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'BOLLINGER_BARS_OUTSIDE',
        params: expect.objectContaining({ bars: 3 }),
      }),
    ]))
    expect(result.ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'rebalance',
        actions: expect.arrayContaining([
          expect.objectContaining({ kind: 'REDUCE_LONG' }),
          expect.objectContaining({ kind: 'REDUCE_SHORT' }),
        ]),
      }),
    ]))
  })
})
