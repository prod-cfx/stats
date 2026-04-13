import { SemanticGraphBuilderService } from '../semantic-graph-builder.service'

describe('semanticGraphBuilderService', () => {
  const builder = new SemanticGraphBuilderService()

  it('assigns multi-timeframe context to entry/exit nodes when rule text has no explicit timeframe', () => {
    const result = builder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['当前K线收盘价相对于上一根K线收盘价下跌≥1%时买入开仓'],
      exitRules: ['当前K线收盘价相对于开仓均价上涨≥2%时卖出平仓'],
      riskRules: {
        positionPct: 35,
        stopLossPct: 4,
        maxSingleLossPct: 6,
      },
    })

    expect(result.graph).toBeTruthy()
    expect(result.graph?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'price_change_pct', phase: 'entry' }),
      expect.objectContaining({ kind: 'position_pnl_pct', phase: 'exit' }),
    ]))
    expect(result.graph?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'OPEN_LONG', sizePct: 35 }),
      expect.objectContaining({ kind: 'CLOSE_LONG' }),
    ]))
    expect(result.graph?.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'STOP_LOSS_PCT', valuePct: 4 }),
      expect.objectContaining({ kind: 'MAX_SINGLE_LOSS_PCT', valuePct: 6 }),
    ]))

    const entryNode = result.graph?.nodes.find(node => node.kind === 'price_change_pct' && node.phase === 'entry')
    const exitNode = result.graph?.nodes.find(node => node.kind === 'position_pnl_pct' && node.phase === 'exit')
    expect(entryNode?.kind).toBe('price_change_pct')
    expect(exitNode?.kind).toBe('position_pnl_pct')
    if (!entryNode || entryNode.kind !== 'price_change_pct') {
      throw new Error('expected entry price_change_pct node')
    }
    if (!exitNode || exitNode.kind !== 'position_pnl_pct') {
      throw new Error('expected exit position_pnl_pct node')
    }
    expect(entryNode.params.timeframe).toBe('3m')
    expect(exitNode.params.timeframe).toBe('15m')
  })

  it('uses explicit exit basis metadata to distinguish price-change and position-pnl exits', () => {
    const prevCloseResult = builder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['3 分钟内跌 1% 买入'],
      exitRules: ['15 分钟内涨 2% 卖出'],
      exitRuleBases: { 'exit-1': 'prev_close' },
      riskRules: { positionPct: 10, stopLossPct: 5 },
    })
    const entryPriceResult = builder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['3 分钟内跌 1% 买入'],
      exitRules: ['15 分钟内涨 2% 卖出'],
      exitRuleBases: { 'exit-1': 'entry_avg_price' },
      riskRules: { positionPct: 10, stopLossPct: 5 },
    })

    expect(prevCloseResult.graph?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'price_change_pct',
        phase: 'exit',
        params: expect.objectContaining({ basis: 'prev_close' }),
      }),
    ]))
    expect(entryPriceResult.graph?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'position_pnl_pct',
        phase: 'exit',
        params: expect.objectContaining({ basis: 'entry_avg_price' }),
      }),
    ]))
  })

  it('builds fixed-range grid buy and upper-grid sell graph with position/risk', () => {
    const result = builder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['在固定区间 60000-80000 内执行网格买入，网格步长 1%，共 10 格'],
      exitRules: ['价格触达上方网格时执行网格卖出平仓'],
      riskRules: {
        positionPct: 20,
        stopLossPct: 5,
      },
    })

    expect(result.graph).toBeTruthy()
    expect(result.graph?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'grid_level_touch',
        phase: 'entry',
        params: expect.objectContaining({
          range: { min: 60000, max: 80000 },
          stepPct: 1,
          levelCount: 10,
        }),
      }),
      expect.objectContaining({
        kind: 'grid_level_touch',
        phase: 'exit',
      }),
    ]))
    expect(result.graph?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'OPEN_LONG', sizePct: 20 }),
      expect.objectContaining({ kind: 'CLOSE_LONG' }),
    ]))
    expect(result.graph?.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'STOP_LOSS_PCT', valuePct: 5 }),
    ]))
  })

  it('normalizes per-mille grid steps into percent when explicit grid semantics are present', () => {
    const result = builder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['在固定区间 60000-80000 内执行网格买入，按千分之5步长，共 10 格'],
      exitRules: ['价格触达上方网格时执行网格卖出平仓'],
      riskRules: {
        positionPct: 20,
        stopLossPct: 5,
      },
    })

    expect(result.graph).toBeTruthy()
    expect(result.graph?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'grid_level_touch',
        phase: 'entry',
        params: expect.objectContaining({
          range: { min: 60000, max: 80000 },
          stepPct: 0.5,
          levelCount: 10,
        }),
      }),
      expect.objectContaining({
        kind: 'grid_level_touch',
        phase: 'exit',
        params: expect.objectContaining({
          range: { min: 60000, max: 80000 },
          stepPct: 0.5,
          levelCount: 10,
        }),
      }),
    ]))
  })

  it('builds bollinger long-short-middle-close and 3-bar outside risk graph', () => {
    const result = builder.build({
      symbols: ['ETHUSDT'],
      timeframes: ['5m'],
      entryRules: ['当价格上穿布林带上轨时做空开仓；当价格下穿布林带下轨时做多开仓'],
      exitRules: ['当价格回到布林带中轨时双向平仓'],
      riskRules: {
        note: '若价格连续 3 根 K 线运行在布林带轨外则触发风险控制',
      },
    })

    expect(result.graph).toBeTruthy()
    expect(result.graph?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'bollinger_band_touch', phase: 'entry', params: expect.objectContaining({ band: 'upper', actionBias: 'short' }) }),
      expect.objectContaining({ kind: 'bollinger_band_touch', phase: 'entry', params: expect.objectContaining({ band: 'lower', actionBias: 'long' }) }),
      expect.objectContaining({ kind: 'bollinger_band_touch', phase: 'exit', params: expect.objectContaining({ band: 'middle' }) }),
      expect.objectContaining({ kind: 'bollinger_bars_outside', phase: 'risk', params: expect.objectContaining({ bars: 3 }) }),
    ]))
    expect(result.graph?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'OPEN_SHORT' }),
      expect.objectContaining({ kind: 'OPEN_LONG' }),
      expect.objectContaining({ kind: 'CLOSE_LONG' }),
      expect.objectContaining({ kind: 'CLOSE_SHORT' }),
    ]))
  })

  it('reports incomplete grid semantics instead of silently using placeholders', () => {
    const result = builder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['在固定区间网格买入'],
      exitRules: ['价格触达上方网格时执行网格卖出平仓'],
    })

    expect(result.graph).toBeNull()
    expect(result.diagnostics).toEqual(expect.arrayContaining(['grid_params_missing']))
  })

  it('does not mark unsupported when risk rule keys contain ma substrings', () => {
    const result = builder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['当前K线收盘价相对于上一根K线收盘价下跌≥1%时买入开仓'],
      exitRules: ['当前K线收盘价相对于开仓均价上涨≥2%时卖出平仓'],
      riskRules: {
        maxSingleLossPct: 5,
        marketType: 'spot',
      },
    })

    expect(result.unsupportedFeatures).toEqual([])
    expect(result.graph).toBeTruthy()
  })

  it('keeps graph incomplete when only bollinger lower-band long entry exists without exit', () => {
    const result = builder.build({
      symbols: ['ETHUSDT'],
      timeframes: ['15m'],
      entryRules: ['当价格下穿布林带下轨时做多开仓'],
      exitRules: [],
    })

    expect(result.graph).toBeNull()
  })

  it('marks mixed supported+RSI entry rule as unsupported to avoid silent partial mapping', () => {
    const result = builder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['当前K线收盘价相对于上一根K线收盘价下跌≥1%且RSI<30时买入开仓'],
      exitRules: ['当前K线收盘价相对于开仓均价上涨≥2%时卖出平仓'],
    })

    expect(result.unsupportedFeatures).toEqual(expect.arrayContaining(['RSI 指标语义']))
  })

  it('marks mixed supported+rsi lowercase entry rule as unsupported', () => {
    const result = builder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['当前K线收盘价相对于上一根K线收盘价下跌≥1%且rsi<30时买入开仓'],
      exitRules: ['当前K线收盘价相对于开仓均价上涨≥2%时卖出平仓'],
    })

    expect(result.unsupportedFeatures).toEqual(expect.arrayContaining(['RSI 指标语义']))
  })

  it('maps open-price pnl take-profit rule only once as position_pnl_pct exit node', () => {
    const result = builder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['当前K线收盘价相对于上一根K线收盘价下跌≥1%时买入开仓'],
      exitRules: ['当前K线收盘价相对于开仓均价上涨≥2%时卖出平仓'],
    })

    expect(result.graph).toBeTruthy()
    const pnlExitNodes = result.graph?.nodes.filter(node => node.phase === 'exit' && node.kind === 'position_pnl_pct') ?? []
    const priceExitNodes = result.graph?.nodes.filter(node => node.phase === 'exit' && node.kind === 'price_change_pct') ?? []
    expect(pnlExitNodes).toHaveLength(1)
    expect(priceExitNodes).toHaveLength(0)
  })
})
