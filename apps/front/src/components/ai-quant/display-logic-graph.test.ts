import { buildDisplayLogicGraphFromCodegenSpec } from './display-logic-graph'

describe('buildDisplayLogicGraphFromCodegenSpec', () => {
  it('produces a readable fallback graph for malformed or missing specDesc', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: null,
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
      },
    })

    expect(graph.blocks).toHaveLength(1)
    expect(graph.blocks[0].type).toBe('EXECUTE')
    expect(graph.blocks[0].items.map(item => item.text).join(' ')).toContain('OKX')
    expect(graph.blocks[0].items.map(item => item.text).join(' ')).toContain('BTCUSDT')
  })

  it('builds IF, AND_AT_THEN, and EXECUTE display blocks for price-change rules', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'entry-price-drop',
            phase: 'entry',
            condition: {
              key: 'price.change_pct',
              op: 'LTE',
              value: -0.01,
              params: {
                timeframe: '3m',
                basis: 'prev_close',
              },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
          {
            id: 'entry-price-rise',
            phase: 'entry',
            condition: {
              key: 'price.change_pct',
              op: 'GTE',
              value: 0.02,
              params: {
                timeframe: '15m',
                basis: 'prev_close',
              },
            },
            actions: [{ type: 'OPEN_SHORT' }],
          },
        ],
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
        marketType: 'perp',
        executionTags: ['spot', 'isolated'],
      },
    })

    expect(graph.blocks.map(block => block.type)).toEqual(['IF', 'AND_AT_THEN', 'EXECUTE'])
    expect(graph.blocks[0].items[0].text).toContain('3m 内相对前收盘下跌 1%')
    expect(graph.blocks[1].items[0].text).toContain('15m 内相对前收盘上涨 2%')
    expect(graph.blocks[0].items[0]).not.toHaveProperty('key')
    expect(graph.blocks[0].items[1]).not.toHaveProperty('key')
    expect(graph.blocks[2].items.map(item => item.text).join(' ')).toContain('OKX')
    expect(graph.blocks[2].items.map(item => item.text).join(' ')).toContain('BTCUSDT')
    expect(graph.blocks[2].items.map(item => item.text).join(' ')).toContain('15m')
    expect(graph.blocks[2].items.map(item => item.text).join(' ')).toContain('永续')
  })

  it('falls back to legacy entryRules and exitRules when canonical rules are missing', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        entryRules: ['3m 内下跌 1% 买入'],
        exitRules: ['15m 内上涨 2% 卖出'],
        riskRules: {
          maxDrawdownPct: 20,
        },
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
      },
    })

    expect(graph.blocks.map(block => block.type)).toEqual(['IF', 'AND_AT_THEN', 'EXECUTE'])
    expect(graph.blocks[0].items.map(item => item.text).join(' ')).toContain('3m 内下跌 1% 买入')
    expect(graph.blocks[1].items.map(item => item.text).join(' ')).toContain('15m 内上涨 2% 卖出')
  })

  it('falls back neutrally for zero-valued price-change rules', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'price-change-zero',
            phase: 'entry',
            condition: {
              key: 'price.change_pct',
              op: 'GTE',
              value: 0,
              params: {
                timeframe: '3m',
                basis: 'prev_close',
              },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
      },
    })

    const text = graph.blocks[0].items.map(item => item.text).join(' ')

    expect(text).toContain('待补充')
    expect(text).not.toContain('上涨 0%')
    expect(text).not.toContain('下跌 0%')
  })

  it('formats grid range rebalance rules without leaking internal keys', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'grid-rebalance',
            phase: 'entry',
            condition: {
              key: 'grid.range_rebalance',
              params: {
                timeframe: '15m',
                rangeMin: 60000,
                rangeMax: 80000,
                stepPct: 1.67,
                levelCount: 12,
              },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
        lockedParams: {
          exchange: 'binance',
          symbol: 'ETHUSDT',
          timeframe: '1h',
          positionPct: 20,
        },
        canonicalSpec: {
          market: {
            marketType: 'spot',
          },
        },
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(text).toContain('60000')
    expect(text).toContain('80000')
    expect(text).toContain('1.67')
    expect(text).toContain('15m 级别')
    expect(text).toContain('共 12 格')
    expect(text).toContain('现货')
    expect(graph.blocks[0].items[0]).not.toHaveProperty('key')
    expect(text).not.toContain('grid.range_rebalance')
  })

  it('uses canonical timeframe when top-level market timeframes are missing', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        canonicalSpec: {
          market: {
            timeframe: '1h',
          },
        },
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
      },
    })

    const text = graph.blocks[0].items.map(item => item.text).join(' ')

    expect(text).toContain('周期: 1h')
    expect(text).not.toContain('周期: 15m')
  })

  it('shows neutral fallback text for unknown condition keys without leaking the key', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'unknown-condition',
            phase: 'entry',
            condition: {
              key: 'new.future_condition_key',
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      },
      fallbackMeta: {
        exchange: 'binance',
        symbol: 'ETHUSDT',
        timeframe: '1h',
        positionPct: 20,
      },
    })

    const text = graph.blocks[0].items.map(item => item.text).join(' ')

    expect(text).toContain('待补充')
    expect(text).not.toContain('new.future_condition_key')
  })

  it('surfaces unsupported actions as readable fallback text', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'unsupported-action',
            phase: 'entry',
            condition: {
              key: 'price.change_pct',
              op: 'LTE',
              value: -0.01,
            },
            actions: [{ type: 'FUTURE_NEW_ACTION' }],
          },
        ],
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '5m',
        positionPct: 15,
      },
    })

    const text = graph.blocks[0].items.map(item => item.text).join(' ')

    expect(text).toContain('未支持的动作')
    expect(text).not.toContain('FUTURE_NEW_ACTION')
  })

  it('keeps execute output deterministic when metadata is empty', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {},
    })

    expect(graph.blocks).toEqual([
      {
        type: 'EXECUTE',
        items: [
          {
            kind: 'execute',
            id: 'execute-fallback',
            key: 'fallback',
            text: '执行信息待补充',
          },
        ],
      },
    ])
  })
})
