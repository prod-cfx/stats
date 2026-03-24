import { buildLogicGraphFromCodegenSpec } from './llm-logic-graph'

describe('buildLogicGraphFromCodegenSpec', () => {
  it('maps entry/exit/risk rules from codegen spec into graph nodes', () => {
    const graph = buildLogicGraphFromCodegenSpec(
      {
        entryRules: ['15m 内下跌 2% 买入'],
        exitRules: ['30m 内上涨 3% 卖出'],
        riskRules: { maxDrawdownPct: 20, positionPct: 10 },
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m', '30m'],
        },
      },
      {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        positionPct: 10,
      },
      3,
    )

    expect(graph.version).toBe(3)
    expect(graph.trigger).toHaveLength(2)
    expect(graph.actions).toHaveLength(2)
    expect(graph.risk).toContain('maxDrawdownPct: 20')
    expect(graph.meta.symbol).toBe('BTCUSDT')
    expect(graph.meta.timeframe).toBe('15m/30m')
  })

  it('falls back to params when spec is incomplete', () => {
    const graph = buildLogicGraphFromCodegenSpec(
      {},
      {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        positionPct: 25,
      },
      1,
    )

    expect(graph.trigger[0].subject).toBe('ETHUSDT')
    expect(graph.meta.exchange).toBe('okx')
    expect(graph.actions).toHaveLength(0)
    expect(graph.risk).toContain('等待风控规则补充')
  })

  it('keeps graph in draft status for manual confirm flow', () => {
    const graph = buildLogicGraphFromCodegenSpec(
      { entryRules: ['a'] },
      {
        exchange: 'binance',
        symbol: 'SOLUSDT',
        positionPct: 12,
      },
      9,
    )

    expect(graph.status).toBe('draft')
  })

  it('preserves confirmed status when rebuilding a published graph', () => {
    const graph = buildLogicGraphFromCodegenSpec(
      { entryRules: ['a'] },
      {
        exchange: 'okx',
        symbol: 'SOLUSDT',
        positionPct: 10,
      },
      10,
      'confirmed',
    )

    expect(graph.status).toBe('confirmed')
  })
})
