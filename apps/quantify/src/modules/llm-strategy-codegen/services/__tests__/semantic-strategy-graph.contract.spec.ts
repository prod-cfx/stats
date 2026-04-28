import { semanticStrategyGraphSchema } from '../../types/semantic-strategy-graph.zod'

describe('semanticStrategyGraph contract', () => {
  it('accepts v2 series-vs-series predicate graph nodes', () => {
    const parsed = semanticStrategyGraphSchema.parse({
      version: 2,
      nodes: [
        {
          id: 'entry-close-gt-open',
          kind: 'predicate',
          phase: 'entry',
          op: 'GT',
          left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
          right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
        },
      ],
      edges: [],
    })

    expect(parsed.version).toBe(2)
    expect(parsed.nodes[0]).toEqual(expect.objectContaining({
      id: 'entry-close-gt-open',
      kind: 'predicate',
      op: 'GT',
    }))
  })

  it.each([
    [
      'series-vs-constant',
      {
        id: 'entry-close-gt-price',
        kind: 'predicate',
        phase: 'entry',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
        right: { kind: 'constant', value: 100, unit: 'price' },
      },
    ],
    [
      'indicator-vs-series',
      {
        id: 'entry-ema-gt-close',
        kind: 'predicate',
        phase: 'entry',
        op: 'GT',
        left: { kind: 'indicator', name: 'ema', params: { period: 20 }, output: 'value' },
        right: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
      },
    ],
    [
      'indicator-vs-constant',
      {
        id: 'exit-rsi-lt-threshold',
        kind: 'predicate',
        phase: 'exit',
        op: 'LT',
        left: { kind: 'indicator', name: 'rsi', params: { period: 14 }, output: 'value' },
        right: { kind: 'constant', value: 30 },
      },
    ],
  ])('accepts v2 %s predicate graph nodes', (_name, node) => {
    expect(() =>
      semanticStrategyGraphSchema.parse({
        version: 2,
        nodes: [node],
        edges: [],
      }),
    ).not.toThrow()
  })

  it.each(['atr', 'bollinger', 'custom'])('rejects v2 unsupported %s indicator predicate operands', (indicator) => {
    expect(() =>
      semanticStrategyGraphSchema.parse({
        version: 2,
        nodes: [
          {
            id: `entry-${indicator}-gt-close`,
            kind: 'predicate',
            phase: 'entry',
            op: 'GT',
            left: { kind: 'indicator', name: indicator, params: { period: 14 }, output: 'value' },
            right: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
          },
        ],
        edges: [],
      }),
    ).toThrow()
  })

  it('rejects v2 BETWEEN predicate graph nodes until compiler support exists', () => {
    expect(() =>
      semanticStrategyGraphSchema.parse({
        version: 2,
        nodes: [
          {
            id: 'entry-close-between',
            kind: 'predicate',
            phase: 'entry',
            op: 'BETWEEN',
            left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
            right: { kind: 'constant', value: 100, unit: 'price' },
          },
        ],
        edges: [],
      }),
    ).toThrow()
  })

  it('accepts v2 logical group nodes with member references', () => {
    const parsed = semanticStrategyGraphSchema.parse({
      version: 2,
      nodes: [
        {
          id: 'entry-close-gt-open',
          kind: 'predicate',
          phase: 'entry',
          op: 'GT',
          left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
          right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
        },
        {
          id: 'entry-rsi-lt-70',
          kind: 'predicate',
          phase: 'entry',
          op: 'LT',
          left: { kind: 'indicator', name: 'rsi', params: { period: 14 }, output: 'value' },
          right: { kind: 'constant', value: 70 },
        },
        {
          id: 'entry-group',
          kind: 'logical_group',
          phase: 'entry',
          join: 'AND',
          members: ['entry-close-gt-open', 'entry-rsi-lt-70'],
        },
      ],
      edges: [],
    })

    expect(parsed.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-group',
        kind: 'logical_group',
        join: 'AND',
        members: ['entry-close-gt-open', 'entry-rsi-lt-70'],
      }),
    ]))
  })

  it('rejects v2 logical group members that reference unknown nodes', () => {
    expect(() =>
      semanticStrategyGraphSchema.parse({
        version: 2,
        nodes: [
          {
            id: 'entry-group',
            kind: 'logical_group',
            phase: 'entry',
            join: 'OR',
            members: ['missing-node'],
          },
        ],
        edges: [],
      }),
    ).toThrow()
  })

  it('rejects v2 NOT logical groups with more than one member', () => {
    const predicate = (id: string) => ({
      id,
      kind: 'predicate' as const,
      phase: 'entry' as const,
      op: 'GT' as const,
      left: { kind: 'series' as const, source: 'bar' as const, field: 'close' as const, offsetBars: 0 },
      right: { kind: 'series' as const, source: 'bar' as const, field: 'open' as const, offsetBars: 0 },
    })

    expect(() =>
      semanticStrategyGraphSchema.parse({
        version: 2,
        nodes: [
          predicate('entry-a'),
          predicate('entry-b'),
          {
            id: 'entry-not',
            kind: 'logical_group',
            phase: 'entry',
            join: 'NOT',
            members: ['entry-a', 'entry-b'],
          },
        ],
        edges: [],
      }),
    ).toThrow()
  })

  it('accepts typed price-change and position-pnl nodes', () => {
    const parsed = semanticStrategyGraphSchema.parse({
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
      risk: [
        { id: 'stop-loss', kind: 'STOP_LOSS_PCT', valuePct: 5, effect: 'FORCE_EXIT' },
      ],
    })

    expect(parsed.nodes[0].kind).toBe('price_change_pct')
  })

  it('accepts bollinger, grid, and logical grouping nodes', () => {
    const parsed = semanticStrategyGraphSchema.parse({
      version: 1,
      market: { symbol: 'BTCUSDT', primaryTimeframe: '15m' },
      nodes: [
        {
          id: 'bollinger-entry',
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
          id: 'risk-bollinger-outside',
          phase: 'risk',
          kind: 'bollinger_bars_outside',
          params: {
            timeframe: '15m',
            bandSide: 'outside',
            bars: 3,
            effect: 'REDUCE_POSITION',
          },
        },
        {
          id: 'grid-entry',
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
          id: 'logic-group',
          phase: 'entry',
          kind: 'logical_group',
          params: {
            join: 'AND',
            members: ['bollinger-entry', 'grid-entry'],
          },
        },
      ],
      actions: [],
      risk: [],
    })

    expect(parsed.nodes.map((node) => node.kind)).toEqual(
      expect.arrayContaining(['bollinger_band_touch', 'grid_level_touch', 'logical_group']),
    )
  })

  it('rejects duplicate node ids', () => {
    expect(() =>
      semanticStrategyGraphSchema.parse({
        version: 1,
        market: { symbol: 'BTCUSDT', primaryTimeframe: '3m' },
        nodes: [
          {
            id: 'dup',
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
            id: 'dup',
            phase: 'exit',
            kind: 'position_pnl_pct',
            params: {
              timeframe: '3m',
              op: 'gte',
              valuePct: 2,
            },
          },
        ],
        actions: [],
        risk: [],
      }),
    ).toThrow()
  })

  it('rejects logical group members that reference unknown nodes', () => {
    expect(() =>
      semanticStrategyGraphSchema.parse({
        version: 1,
        market: { symbol: 'BTCUSDT', primaryTimeframe: '3m' },
        nodes: [
          {
            id: 'entry',
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
            id: 'group',
            phase: 'entry',
            kind: 'logical_group',
            params: {
              join: 'AND',
              members: ['does-not-exist'],
            },
          },
        ],
        actions: [],
        risk: [],
      }),
    ).toThrow()
  })

  it('rejects grid ranges where min is greater than max', () => {
    expect(() =>
      semanticStrategyGraphSchema.parse({
        version: 1,
        market: { symbol: 'BTCUSDT', primaryTimeframe: '15m' },
        nodes: [
          {
            id: 'grid',
            phase: 'entry',
            kind: 'grid_level_touch',
            params: {
              timeframe: '15m',
              range: { min: 90000, max: 80000 },
              stepPct: 1,
              levelCount: 5,
            },
          },
        ],
        actions: [],
        risk: [],
      }),
    ).toThrow()
  })

  it('rejects free-text operator nodes', () => {
    expect(() =>
      semanticStrategyGraphSchema.parse({
        version: 1,
        market: { symbol: 'BTCUSDT', primaryTimeframe: '15m' },
        nodes: [{ id: 'n1', phase: 'entry', operator: '价格跌了就买' }],
        actions: [],
        risk: [],
      }),
    ).toThrow()
  })
})
