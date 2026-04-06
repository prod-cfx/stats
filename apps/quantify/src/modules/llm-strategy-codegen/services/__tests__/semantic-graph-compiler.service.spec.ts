import { SemanticGraphCompilerService } from '../semantic-graph-compiler.service'

describe('SemanticGraphCompilerService', () => {
  const compiler = new SemanticGraphCompilerService()

  it('compiles price-change and position-pnl nodes into canonical IR', () => {
    const ir = compiler.compile({
      version: 1,
      market: { symbol: 'BTCUSDT', primaryTimeframe: '3m' },
      nodes: [
        {
          id: 'entry-drop-1',
          phase: 'entry',
          kind: 'price_change_pct',
          params: {
            timeframe: '3m',
            left: { source: 'close', offsetBars: 0 },
            right: { source: 'close', offsetBars: 1 },
            op: 'lte',
            valuePct: -1,
          },
        },
        {
          id: 'exit-pnl-1',
          phase: 'exit',
          kind: 'position_pnl_pct',
          params: {
            timeframe: '15m',
            op: 'gte',
            valuePct: 2,
          },
        },
      ],
      actions: [
        { id: 'open-long', kind: 'OPEN_LONG', sizePct: 10 },
        { id: 'close-long', kind: 'CLOSE_LONG', sizePct: 100 },
      ],
      risk: [],
    })

    expect(ir.market.timeframes).toEqual(['15m', '3m'])
    expect(ir.ruleBlocks.map(item => item.phase)).toEqual(['entry', 'exit'])
    expect(ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'PRICE_CHANGE_PCT', timeframe: '3m' }),
      expect.objectContaining({ kind: 'POSITION_PNL_PCT', timeframe: '15m' }),
    ]))
  })
})
