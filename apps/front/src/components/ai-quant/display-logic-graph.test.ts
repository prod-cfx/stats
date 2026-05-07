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

  it('renders canonical v2 conjunctive atomic EMA stack fallback as one entry block', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'semantic-entry-ema-stack',
            phase: 'entry',
            condition: {
              kind: 'AND',
              children: [20, 60, 144].map(period => ({
                kind: 'atom',
                key: 'indicator.above',
                params: {
                  indicator: 'ema',
                  'reference.period': period,
                  timeframe: '15m',
                },
              })),
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'QUOTE', value: 10, asset: 'USDT' } }],
          },
          {
            id: 'semantic-risk-stop-loss',
            phase: 'risk',
            condition: {
              kind: 'atom',
              key: 'position_loss_pct',
              value: 0.05,
            },
            actions: [{ type: 'FORCE_EXIT' }],
          },
        ],
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        marketType: 'perp',
        sizing: { mode: 'QUOTE', value: 10, asset: 'USDT' },
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(graph.blocks.map(block => block.type)).toEqual(['IF', 'EXECUTE'])
    expect(graph.blocks[0].items.map(item => item.text)).toEqual([
      '15m 价格在 EMA20 上方，且15m 价格在 EMA60 上方，且15m 价格在 EMA144 上方',
      '开多 10 USDT',
    ])
    expect(text).toContain('风控: 亏损达到 5% -> 平仓')
    expect(text).not.toContain('不支持的条件')
    expect(text).not.toContain('待补充')
  })

  it('renders canonical atomic breakout retest and remembered-level stop fallback without unsupported text', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'semantic-entry-breakout-retest',
            phase: 'entry',
            condition: {
              kind: 'atom',
              key: 'condition.sequence',
              params: {
                sequenceKind: 'breakout_retest',
                lookbackWindow: '24h',
                memoryKey: 'breakout',
              },
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
          {
            id: 'semantic-risk-breakout-stop',
            phase: 'risk',
            condition: {
              kind: 'atom',
              key: 'risk.remembered_level_stop',
              params: { levelKey: 'breakout' },
            },
            actions: [{ type: 'FORCE_EXIT' }],
          },
        ],
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(text).toContain('突破后回踩确认（24h 内），记录位 breakout')
    expect(text).toContain('风控: 跌破记录位 breakout 止损 -> 平仓')
    expect(text).not.toContain('不支持的条件')
  })

  it('displays fixed quote position sizing from canonical spec instead of fallback percent', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        canonicalSpec: {
          market: {
            exchange: 'binance',
            symbol: 'BTCUSDT',
            timeframe: '1m',
          },
          sizing: {
            mode: 'QUOTE',
            value: 10,
            asset: 'USDT',
          },
        },
        rules: [
          {
            id: 'entry-close-gt-open',
            phase: 'entry',
            condition: { key: 'condition.expression' },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'QUOTE', value: 10, asset: 'USDT' } }],
          },
        ],
      },
      fallbackMeta: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '1m',
        positionPct: 10,
      },
    })

    const executeText = graph.blocks.at(-1)?.items.map(item => item.text).join(' ') ?? ''

    expect(executeText).toContain('仓位: 10 USDT')
    expect(executeText).not.toContain('仓位: 10%')
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

  it('keeps multiple legacy exit rules on AND_AT_THEN instead of OR_THEN', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        entryRules: ['3m 内下跌 1% 买入'],
        exitRules: ['15m 内上涨 2% 卖出', '30m 内上涨 3% 卖出'],
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
      },
    })

    expect(graph.blocks.map(block => block.type)).toEqual(['IF', 'AND_AT_THEN', 'AND_AT_THEN', 'EXECUTE'])
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

  it('keeps risk-phase rules out of the main trigger blocks and shows them in execute summary', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'entry-1',
            phase: 'entry',
            condition: {
              key: 'price.change_pct',
              op: 'LTE',
              value: -0.01,
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
          {
            id: 'risk-1',
            phase: 'risk',
            condition: {
              key: 'position_loss_pct',
              value: 0.05,
            },
            actions: [{ type: 'FORCE_EXIT' }],
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

    expect(graph.blocks.map(block => block.type)).toEqual(['IF', 'EXECUTE'])
    expect(graph.blocks[0].items.map(item => item.text).join(' ')).not.toContain('风控')
    expect(graph.blocks[1].items.map(item => item.text).join(' ')).toContain('风控:')
    expect(graph.blocks[1].items.map(item => item.text).join(' ')).toContain('亏损达到 5%')
  })

  it('renders start execution entries and take-profit risk rules from published snapshots', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'entry-execution-on_start-210',
            phase: 'entry',
            condition: {
              key: 'execution.on_start',
            },
            actions: [
              {
                type: 'OPEN_LONG',
                sizing: {
                  mode: 'RATIO',
                  value: 0.1,
                },
              },
            ],
          },
          {
            id: 'exit-price-percent_change-140',
            phase: 'exit',
            condition: {
              key: 'price.change_pct',
              op: 'GTE',
              value: 0.02,
              params: {
                basis: 'prev_close',
                timeframe: '3m',
              },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
          {
            id: 'risk-take-profit',
            phase: 'risk',
            condition: {
              key: 'risk.take_profit_pct',
              value: 0.02,
              params: {
                basis: 'entry_avg_price',
              },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
        lockedParams: {
          exchange: 'okx',
          symbol: 'DOGEUSDT',
          timeframe: '3m',
          marketType: 'spot',
          positionPct: 10,
        },
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(graph.blocks.map(block => block.type)).toEqual(['IF', 'AND_AT_THEN', 'EXECUTE'])
    expect(text).toContain('启动时执行')
    expect(text).toContain('开多')
    expect(text).toContain('3m 内相对前收盘上涨 2%')
    expect(text).toContain('风控: 相对开仓均价盈利达到 2% -> 平仓')
    expect(text).not.toContain('不支持的条件，待补充')
  })

  it('does not render position-pnl take-profit rules as entry-price profit', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'risk-take-profit-position-pnl',
            phase: 'risk',
            condition: {
              key: 'risk.take_profit_pct',
              params: {
                basis: 'position_pnl',
                valuePct: 2,
              },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'DOGEUSDT',
        timeframe: '3m',
        positionPct: 10,
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(text).toContain('风控: 持仓收益达到 2% -> 平仓')
    expect(text).not.toContain('相对开仓均价盈利达到 2%')
  })

  it('uses neutral take-profit text when the basis is unknown', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'risk-take-profit-unknown-basis',
            phase: 'risk',
            condition: {
              key: 'risk.take_profit_pct',
              value: 0.02,
              params: {
                basis: 'future_basis',
              },
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'DOGEUSDT',
        timeframe: '3m',
        positionPct: 10,
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(text).toContain('风控: 盈利达到 2% -> 平仓')
    expect(text).not.toContain('相对开仓均价')
    expect(text).not.toContain('future_basis')
  })

  it('renders recognized risk expression as readable risk text', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'risk-expression',
            phase: 'risk',
            condition: {
              key: 'risk.condition_expression',
              params: {
                condition: {
                  kind: 'predicate',
                  left: { kind: 'position', field: 'pnl_pct' },
                  op: 'LTE',
                  right: { kind: 'constant', value: -5, unit: 'percent' },
                },
                effect: { type: 'close_position' },
                scope: 'current_position',
                capabilityStatus: 'recognized_unsupported',
              },
            },
            actions: [],
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

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(text).toContain('风控: 持仓收益率 低于或等于 -5%')
    expect(text).not.toContain('risk.condition_expression')
    expect(text).not.toContain('缺少计算基准')
  })

  it('renders canonical expression risk conditions without leaking internal keys', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'risk-position-pnl-stop',
            phase: 'risk',
            condition: {
              kind: 'expression',
              left: { kind: 'position', field: 'pnl_pct' },
              op: 'LTE',
              right: { kind: 'constant', value: -3, unit: 'percent' },
            },
            actions: [{ type: 'FORCE_EXIT' }],
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

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(text).toContain('风控: 持仓收益率 低于或等于 -3% -> 平仓')
    expect(text).not.toContain('不支持的条件，待补充')
  })

  it('renders the first exit path as AND_AT_THEN instead of OR_THEN', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'entry-1',
            phase: 'entry',
            condition: {
              key: 'price.change_pct',
              op: 'LTE',
              value: -0.01,
            },
            actions: [{ type: 'OPEN_LONG' }],
          },
          {
            id: 'exit-1',
            phase: 'exit',
            condition: {
              key: 'price.change_pct',
              op: 'GTE',
              value: 0.02,
            },
            actions: [{ type: 'CLOSE_LONG' }],
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

    expect(graph.blocks.map(block => block.type)).toEqual(['IF', 'AND_AT_THEN', 'EXECUTE'])
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

  it('renders quote semantic sizing from fallback metadata without appending a percent sign', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: null,
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
        sizing: { mode: 'QUOTE', value: 1000, asset: 'USDT' },
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(text).toContain('仓位: 1000 USDT')
    expect(text).not.toContain('1000%')
  })

  it('renders quote semantic sizing on action labels without appending a percent sign', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
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
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(text).toContain('开多 1000 USDT')
    expect(text).toContain('仓位: 1000 USDT')
    expect(text).not.toContain('1000%')
  })

  it('maps legacy fixed_ratio sizing to semantic ratio instead of stale fallback positionPct', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'entry-legacy-fixed-ratio',
            phase: 'entry',
            condition: { key: 'execution.on_start' },
            actions: [
              {
                type: 'OPEN_LONG',
                sizing: { mode: 'fixed_ratio', value: 0.2 },
              },
            ],
          },
        ],
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 35,
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(text).toContain('开多 20%')
    expect(text).toContain('仓位: 20%')
    expect(text).not.toContain('35%')
  })

  it('renders official strategy plaza atomic conditions without unsupported placeholders', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        rules: [
          {
            id: 'ma-entry',
            phase: 'entry',
            condition: { key: 'ma.golden_cross', params: { indicator: 'sma', fastPeriod: 6, slowPeriod: 48 } },
            actions: [{ type: 'OPEN_LONG' }],
          },
          {
            id: 'grid-entry',
            phase: 'entry',
            condition: { key: 'price.range_position_lte', value: 0.2, params: { period: 36 } },
            actions: [{ type: 'OPEN_LONG' }],
          },
          {
            id: 'breakout-entry',
            phase: 'entry',
            condition: { key: 'breakout.channel_high_break', params: { period: 24, bufferPct: 0.25 } },
            actions: [{ type: 'OPEN_LONG' }],
          },
          {
            id: 'rsi-entry',
            phase: 'entry',
            condition: { key: 'rsi.cross_over', value: 38, params: { period: 14 } },
            actions: [{ type: 'OPEN_LONG' }],
          },
          {
            id: 'macd-entry',
            phase: 'entry',
            condition: { key: 'macd.golden_cross', params: { fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 } },
            actions: [{ type: 'OPEN_LONG' }],
          },
          {
            id: 'bollinger-entry',
            phase: 'entry',
            condition: { key: 'bollinger.lower_break', params: { period: 30, stdDev: 0.9 } },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(text).toContain('SMA6 上穿 SMA48')
    expect(text).toContain('最近 36 根 K 线区间下 20%')
    expect(text).toContain('突破最近 24 根 K 线高点')
    expect(text).toContain('突破缓冲 0.25%')
    expect(text).toContain('RSI14 上穿 38')
    expect(text).toContain('MACD 16/34/12 金叉')
    expect(text).toContain('价格向下突破布林带下轨（30, 0.9）')
    expect(text).not.toContain('不支持的条件，待补充')
  })

  it('prefers server-provided displayLogicGraph over legacy condition-key parsing', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        displayLogicGraph: {
          blocks: [
            {
              type: 'IF',
              items: [
                { kind: 'condition', id: 'condition-entry', text: '收盘价高于前 1 根最高价，且持有多仓等于false' },
                { kind: 'action', id: 'action-entry', text: '开多 3%' },
              ],
            },
            {
              type: 'EXECUTE',
              items: [
                { kind: 'execute', id: 'execute-exchange', key: 'exchange', value: 'okx', text: '交易所: OKX' },
              ],
            },
          ],
        },
        rules: [
          {
            id: 'legacy-unsupported',
            phase: 'entry',
            condition: { key: 'condition.expression' },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(graph.blocks).toHaveLength(2)
    expect(text).toContain('收盘价高于前 1 根最高价')
    expect(text).toContain('开多 3%')
    expect(text).not.toContain('不支持的条件，待补充')
  })

  it('renders server-provided atomic contract display graph without legacy key guessing', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        displayLogicGraph: {
          blocks: [
            {
              type: 'IF',
              items: [
                { kind: 'condition', id: 'condition-bollinger', text: '触及布林带下轨（20, 2）' },
                { kind: 'condition', id: 'condition-volume', text: '成交量高于过去 20 根均量的 1.5 倍' },
                { kind: 'action', id: 'action-entry', text: '开多 10%' },
              ],
            },
            {
              type: 'EXECUTE',
              items: [
                { kind: 'execute', id: 'execute-symbol', key: 'symbol', value: 'BTCUSDT', text: '标的: BTCUSDT' },
              ],
            },
          ],
        },
        rules: [
          {
            id: 'legacy-atomic-key',
            phase: 'entry',
            condition: { key: 'price.detect.indicator_boundary' },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(graph.blocks).toHaveLength(2)
    expect(text).toContain('布林带下轨')
    expect(text).toContain('成交量高于过去 20 根均量的 1.5 倍')
    expect(text).toContain('开多 10%')
    expect(text).not.toContain('不支持的条件')
    expect(text).not.toContain('price.detect.indicator_boundary')
  })

  it('falls back to legacy parsing when server displayLogicGraph has no rule blocks', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        displayLogicGraph: {
          blocks: [
            {
              type: 'EXECUTE',
              items: [
                { kind: 'execute', id: 'execute-exchange', key: 'exchange', value: 'okx', text: '交易所: OKX' },
              ],
            },
          ],
        },
        rules: [
          {
            id: 'legacy-price-drop',
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
        ],
      },
      fallbackMeta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(graph.blocks.map(block => block.type)).toEqual(['IF', 'EXECUTE'])
    expect(text).toContain('3m 内相对前收盘下跌 1%')
    expect(text).toContain('开多')
    expect(text).toContain('标的: BTCUSDT')
  })
})
