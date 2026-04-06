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

  it('compiles bollinger upper/lower/middle semantics into band series and predicates', () => {
    const ir = compiler.compile({
      version: 1,
      market: { symbol: 'BTCUSDT', primaryTimeframe: '15m' },
      nodes: [
        {
          id: 'entry-upper-short',
          phase: 'entry',
          kind: 'bollinger_band_touch',
          params: {
            timeframe: '15m',
            band: 'upper',
            direction: 'breakout',
            actionBias: 'short',
            period: 20,
            stdDev: 2,
          },
        },
        {
          id: 'entry-lower-long',
          phase: 'entry',
          kind: 'bollinger_band_touch',
          params: {
            timeframe: '15m',
            band: 'lower',
            direction: 'breakdown',
            actionBias: 'long',
            period: 20,
            stdDev: 2,
          },
        },
        {
          id: 'exit-middle-close',
          phase: 'exit',
          kind: 'bollinger_band_touch',
          params: {
            timeframe: '15m',
            band: 'middle',
            direction: 'breakout',
            actionBias: 'long',
            period: 20,
            stdDev: 2,
          },
        },
      ],
      actions: [
        { id: 'open-long', kind: 'OPEN_LONG', sizePct: 10 },
        { id: 'open-short', kind: 'OPEN_SHORT', sizePct: 10 },
        { id: 'close-long', kind: 'CLOSE_LONG', sizePct: 100 },
        { id: 'close-short', kind: 'CLOSE_SHORT', sizePct: 100 },
      ],
      risk: [],
    })

    expect(ir.portfolio.positionMode).toBe('long_short')
    expect(ir.signalCatalog.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'UPPER_BAND', timeframe: '15m' }),
      expect.objectContaining({ kind: 'MID_BAND', timeframe: '15m' }),
      expect.objectContaining({ kind: 'LOWER_BAND', timeframe: '15m' }),
    ]))
    expect(ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'CROSS_OVER' }),
      expect.objectContaining({ kind: 'CROSS_UNDER' }),
      expect.objectContaining({ kind: 'OR' }),
    ]))
  })

  it('compiles fixed range grid semantics into level sets and touch predicates', () => {
    const ir = compiler.compile({
      version: 1,
      market: { symbol: 'BTCUSDT', primaryTimeframe: '15m' },
      nodes: [
        {
          id: 'entry-grid-touch',
          phase: 'entry',
          kind: 'grid_level_touch',
          params: {
            timeframe: '15m',
            range: { min: 60000, max: 80000 },
            stepPct: 1,
            levelCount: 10,
          },
        },
        {
          id: 'exit-grid-touch',
          phase: 'exit',
          kind: 'grid_level_touch',
          params: {
            timeframe: '15m',
            range: { min: 60000, max: 80000 },
            stepPct: 1,
            levelCount: 10,
          },
        },
      ],
      actions: [
        { id: 'open-long', kind: 'OPEN_LONG', sizePct: 1 },
        { id: 'close-long', kind: 'CLOSE_LONG', sizePct: 100 },
      ],
      risk: [
        { id: 'max-single-loss', kind: 'MAX_SINGLE_LOSS_PCT', valuePct: 2, effect: 'BLOCK_ENTRY' },
      ],
    })

    expect(ir.signalCatalog.levelSets).toEqual([
      expect.objectContaining({
        kind: 'ARITHMETIC_LEVEL_SET',
        spacing: { mode: 'pct', value: 1 },
        levelsPerSide: { down: 0, up: 9 },
      }),
    ])
    expect(ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'TOUCH_LEVEL_DOWN' }),
      expect.objectContaining({ kind: 'TOUCH_LEVEL_UP' }),
    ]))
    expect(ir.riskPolicy.guards).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'MAX_SINGLE_LOSS_PCT', onBreach: 'BLOCK_NEW_ENTRY' }),
    ]))
  })
})
