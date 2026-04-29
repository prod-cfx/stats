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
        baseTimeframe: '15m',
        positionPct: 10,
        executionTags: ['positionPct: 10', 'maxDrawdownPct: 20'],
      },
      3,
    )

    expect(graph.version).toBe(3)
    expect(graph.trigger).toHaveLength(2)
    expect(graph.actions).toHaveLength(2)
    expect(graph.risk).toContain('maxDrawdownPct: 20')
    expect(graph.meta.symbol).toBe('BTCUSDT')
    expect(graph.meta.timeframe).toBe('15m/30m')
    expect(graph.meta.executionTags).toEqual(['positionPct: 10', 'maxDrawdownPct: 20'])
  })

  it('falls back to params when spec is incomplete', () => {
    const graph = buildLogicGraphFromCodegenSpec(
      {},
      {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        baseTimeframe: '1h',
        positionPct: 25,
      },
      1,
    )

    expect(graph.trigger[0].subject).toBe('ETHUSDT')
    expect(graph.meta.exchange).toBe('okx')
    expect(graph.meta.timeframe).toBe('1h')
    expect(graph.actions).toHaveLength(0)
    expect(graph.risk).toContain('等待风控规则补充')
  })

  it('keeps graph in draft status for manual confirm flow', () => {
    const graph = buildLogicGraphFromCodegenSpec(
      { entryRules: ['a'] },
      {
        exchange: 'binance',
        symbol: 'SOLUSDT',
        baseTimeframe: '5m',
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
        baseTimeframe: '1h',
        positionPct: 10,
      },
      10,
      'confirmed',
    )

    expect(graph.status).toBe('confirmed')
  })

  it('builds graph from canonical specDesc rules and locked params', () => {
    const graph = buildLogicGraphFromCodegenSpec(
      {
        rules: [
          {
            id: 'entry-upper-1',
            phase: 'entry',
            condition: { key: 'bollinger.upper_break', op: 'CROSS_OVER' },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'entry-lower-2',
            phase: 'entry',
            condition: { key: 'bollinger.lower_break', op: 'CROSS_UNDER' },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-middle-1',
            phase: 'exit',
            condition: { key: 'bollinger.middle_revert' },
            actions: [{ type: 'CLOSE_LONG' }, { type: 'CLOSE_SHORT' }],
          },
          {
            id: 'risk-stop-loss',
            phase: 'risk',
            condition: { key: 'position_loss_pct', value: 0.05 },
            actions: [{ type: 'FORCE_EXIT' }],
          },
        ],
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
        },
        lockedParams: {
          exchange: 'okx',
          positionPct: 10,
        },
        canonicalSpec: {
          market: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            timeframe: '15m',
          },
        },
      },
      {
        exchange: 'binance',
        symbol: 'ETHUSDT',
        baseTimeframe: '1h',
        positionPct: 25,
      },
      11,
    )

    expect(graph.meta.exchange).toBe('okx')
    expect(graph.meta.symbol).toBe('BTCUSDT')
    expect(graph.meta.timeframe).toBe('15m')
    expect(graph.meta.positionPct).toBe(10)
    expect(graph.trigger.map(item => item.operator)).toEqual(expect.arrayContaining([
      '价格向上突破布林带上轨',
      '价格向下突破布林带下轨',
      '价格回到布林带中轨（MA20）',
    ]))
    expect(graph.risk).toContain('亏损达到 5% -> FORCE_EXIT')
    expect(graph.actions.map(item => item.action)).toEqual(expect.arrayContaining(['SELL', 'BUY', 'CLOSE']))
  })

  it('uses canonical timeframe when top-level market timeframes are missing', () => {
    const graph = buildLogicGraphFromCodegenSpec(
      {
        canonicalSpec: {
          market: {
            timeframe: '1h',
          },
        },
      },
      {
        exchange: 'binance',
        symbol: 'ETHUSDT',
        baseTimeframe: '15m',
        positionPct: 25,
      },
      13,
    )

    expect(graph.meta.timeframe).toBe('1h')
  })

  it('keeps the first exit trigger joined with AND when entry rules exist', () => {
    const graph = buildLogicGraphFromCodegenSpec(
      {
        entryRules: ['3m 内下跌 1% 买入'],
        exitRules: ['15m 内上涨 2% 卖出'],
      },
      {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      14,
    )

    expect(graph.trigger[1]?.id).toContain('exit')
    expect(graph.trigger[1]?.join).toBe('AND')
  })

  it('describes price.change_pct rules with timeframe, basis, and direction', () => {
    const graph = buildLogicGraphFromCodegenSpec(
      {
        rules: [
          {
            id: 'entry-price-change-1',
            phase: 'entry',
            condition: {
              key: 'price.change_pct',
              op: 'LTE',
              value: -0.01,
              params: {
                timeframe: '3m',
                lookbackBars: 1,
                basis: 'prev_close',
              },
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
          {
            id: 'exit-price-change-1',
            phase: 'exit',
            condition: {
              key: 'price.change_pct',
              op: 'GTE',
              value: 0.02,
              params: {
                timeframe: '15m',
                lookbackBars: 1,
                basis: 'prev_close',
              },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['3m', '15m'],
        },
        lockedParams: {
          exchange: 'okx',
          positionPct: 10,
        },
        canonicalSpec: {
          market: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            timeframe: '3m',
          },
        },
      },
      {
        exchange: 'binance',
        symbol: 'ETHUSDT',
        baseTimeframe: '1h',
        positionPct: 25,
      },
      12,
    )

    expect(graph.trigger).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'trigger-entry-price-change-1',
        operator: '3m 内相对前收盘下跌 1%',
      }),
      expect.objectContaining({
        id: 'trigger-exit-price-change-1',
        operator: '15m 内相对前收盘上涨 2%',
      }),
    ]))
    expect(graph.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'action-entry-price-change-1-0', action: 'BUY' }),
      expect.objectContaining({ id: 'action-exit-price-change-1-0', action: 'CLOSE' }),
    ]))
  })

  it('renders quote semantic sizing without converting it to a percentage', () => {
    const graph = buildLogicGraphFromCodegenSpec(
      {
        rules: [
          {
            id: 'entry-fixed-quote',
            phase: 'entry',
            condition: { key: 'execution.on_start' },
            actions: [
              {
                type: 'OPEN_LONG',
                sizing: { mode: 'QUOTE', value: 1000, asset: 'USDT' },
              },
            ],
          },
        ],
        canonicalSpec: {
          market: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            timeframe: '15m',
          },
        },
      },
      {
        exchange: 'binance',
        symbol: 'ETHUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
      15,
    )

    expect(graph.actions).toEqual([
      expect.objectContaining({
        action: 'BUY',
        amount: '1000 USDT',
      }),
    ])
    expect(graph.meta.positionPct).toBe(10)
    expect(graph.meta.sizing).toEqual({ mode: 'QUOTE', value: 1000, asset: 'USDT' })
    expect(graph.actions.map(action => action.amount).join(' ')).not.toContain('1000%')
  })
})
