import { semanticStrategyGraphSchema } from '../../types/semantic-strategy-graph.zod'

describe('semanticStrategyGraph contract', () => {
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
