import { CodegenGraphSnapshotService } from '../codegen-graph-snapshot.service'

const close = {
  kind: 'series' as const,
  source: 'bar' as const,
  field: 'close' as const,
  offsetBars: 0,
}
const open = {
  kind: 'series' as const,
  source: 'bar' as const,
  field: 'open' as const,
  offsetBars: 0,
}
const high = {
  kind: 'series' as const,
  source: 'bar' as const,
  field: 'high' as const,
  offsetBars: 0,
}
const low = {
  kind: 'series' as const,
  source: 'bar' as const,
  field: 'low' as const,
  offsetBars: 0,
}

function createCanonicalSpec(rules: Parameters<CodegenGraphSnapshotService['buildFromSemanticArtifacts']>[0]['canonicalSpec']['rules']) {
  return {
    version: 2 as const,
    market: {
      exchange: 'binance' as const,
      symbol: 'BTCUSDT',
      marketType: 'perp' as const,
      defaultTimeframe: '1m',
    },
    indicators: [],
    sizing: { mode: 'RATIO' as const, value: 0.25 },
    executionPolicy: {
      signalTiming: 'BAR_CLOSE' as const,
      fillTiming: 'NEXT_BAR_OPEN' as const,
    },
    dataRequirements: {
      requiredTimeframes: ['1m'],
    },
    rules,
  }
}

describe('codegenGraphSnapshotService', () => {
  it('builds legacy checklist graph snapshot matching checklist gate semantics', () => {
    const service = new CodegenGraphSnapshotService()

    const snapshot = service.build({
      version: 3,
      specDesc: {
        market: { symbols: ['BTCUSDT'], timeframes: ['1h'] },
        entryRules: ['CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))'],
        exitRules: ['CROSS_UNDER(EMA(CLOSE,7),EMA(CLOSE,21))'],
        riskRules: { stopLoss: 'STOP_LOSS_PCT(4)' },
      },
      fallback: { exchange: 'binance', symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 25 },
    })

    expect(snapshot).toEqual({
      version: 3,
      status: 'confirmed',
      trigger: [
        {
          id: 'trigger-entry-3-0',
          phase: 'entry',
          operator: 'CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))',
          join: undefined,
        },
        {
          id: 'trigger-exit-3-0',
          phase: 'exit',
          operator: 'CROSS_UNDER(EMA(CLOSE,7),EMA(CLOSE,21))',
          join: 'AND',
        },
      ],
      actions: [
        {
          id: 'action-buy-3',
          action: 'BUY',
          target: 'BTCUSDT',
          amount: '25%',
        },
        {
          id: 'action-sell-3',
          action: 'SELL',
          target: 'BTCUSDT',
          amount: '25%',
        },
      ],
      risk: ['stopLoss: STOP_LOSS_PCT(4)'],
      meta: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        positionPct: 25,
        executionTags: [],
      },
    })
  })

  it('builds predicate graph from semantic canonical artifacts', () => {
    const service = new CodegenGraphSnapshotService()

    const snapshot = service.buildFromSemanticArtifacts({
      canonicalSpec: createCanonicalSpec([
          {
            id: 'entry-close-gt-open',
            phase: 'entry',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'expression',
              op: 'GT',
              left: close,
              right: open,
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.25 } }],
            metadata: { label: '收盘价大于开盘价时买入' },
          },
          {
            id: 'exit-close-lt-open',
            phase: 'exit',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'expression',
              op: 'LT',
              left: close,
              right: open,
            },
            actions: [{ type: 'CLOSE_LONG' }],
            metadata: { label: '收盘价小于开盘价时卖出' },
          },
        ]),
    })

    expect(snapshot).toEqual({
      version: 2,
      nodes: [
        {
          id: 'entry-close-gt-open',
          kind: 'predicate',
          phase: 'entry',
          op: 'GT',
          left: close,
          right: open,
        },
        {
          id: 'exit-close-lt-open',
          kind: 'predicate',
          phase: 'exit',
          op: 'LT',
          left: close,
          right: open,
        },
      ],
      edges: [],
    })
    expect(JSON.stringify(snapshot)).not.toContain('收盘价大于开盘价时买入')
    expect(JSON.stringify(snapshot)).not.toContain('收盘价小于开盘价时卖出')
  })

  it('builds nested logical predicate graph from semantic canonical artifacts', () => {
    const service = new CodegenGraphSnapshotService()

    const snapshot = service.buildFromSemanticArtifacts({
      canonicalSpec: createCanonicalSpec([
        {
          id: 'entry-nested',
          phase: 'entry',
          sideScope: 'long',
          priority: 100,
          condition: {
            kind: 'AND',
            children: [
              {
                kind: 'expression',
                op: 'GT',
                left: close,
                right: open,
              },
              {
                kind: 'OR',
                children: [
                  {
                    kind: 'expression',
                    op: 'LT',
                    left: low,
                    right: open,
                  },
                  {
                    kind: 'NOT',
                    children: [
                      {
                        kind: 'expression',
                        op: 'GT',
                        left: high,
                        right: open,
                      },
                    ],
                  },
                ],
              },
            ],
          },
          actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.25 } }],
        },
      ]),
    })

    const groups = snapshot.nodes.filter(node => node.kind === 'logical_group')

    expect(snapshot.edges).toEqual([])
    expect(groups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-nested',
        join: 'AND',
        members: ['entry-nested-and-1', 'entry-nested-and-2'],
      }),
      expect.objectContaining({
        id: 'entry-nested-and-2',
        join: 'OR',
        members: ['entry-nested-and-2-or-1', 'entry-nested-and-2-or-2'],
      }),
      expect.objectContaining({
        id: 'entry-nested-and-2-or-2',
        join: 'NOT',
        members: ['entry-nested-and-2-or-2-not-1'],
      }),
    ]))
    expect(snapshot.nodes.filter(node => node.kind === 'predicate')).toHaveLength(3)
  })

  it('throws on unsupported canonical phases when building predicate graph', () => {
    const service = new CodegenGraphSnapshotService()

    expect(() =>
      service.buildFromSemanticArtifacts({
        canonicalSpec: createCanonicalSpec([
          {
            id: 'rebalance-close-gt-open',
            phase: 'rebalance',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'expression',
              op: 'GT',
              left: close,
              right: open,
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.25 } }],
          },
        ]),
      }),
    ).toThrow('codegen.semantic_graph_phase_unsupported:rebalance')
  })

  it('does not emit display-only fallback trigger or risk placeholders', () => {
    const service = new CodegenGraphSnapshotService()

    const snapshot = service.build({
      version: 1,
      specDesc: {},
      fallback: { exchange: 'okx', symbol: 'ETHUSDT', baseTimeframe: '15m', positionPct: 10 },
    })

    expect(snapshot.trigger).toEqual([])
    expect(snapshot.actions).toEqual([])
    expect(snapshot.risk).toEqual([])
    expect(snapshot.meta).toEqual({
      exchange: 'okx',
      symbol: 'ETHUSDT',
      timeframe: '15m',
      positionPct: 10,
      executionTags: [],
    })
  })
})
