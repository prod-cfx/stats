import { SemanticStateMergeService } from '../semantic-state-merge.service'

describe('SemanticStateMergeService', () => {
  const service = new SemanticStateMergeService()

  it('preserves locked grid atoms when the current round only contributes a timeframe context slot', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['grid.range_rebalance'],
        triggers: [
          {
            id: 'grid-entry',
            key: 'grid.range_rebalance',
            phase: 'entry',
            params: {
              rangeLower: 60000,
              rangeUpper: 80000,
              stepPct: 0.5,
              sideMode: 'bidirectional',
              recycle: true,
              breakoutAction: 'pause',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: [],
        triggers: [],
        actions: [],
        risk: [],
        position: null,
        contextSlots: {
          exchange: null,
          symbol: null,
          marketType: null,
          timeframe: {
            slotKey: 'timeframe',
            fieldPath: 'contextSlots.timeframe',
            value: '15m',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认策略主周期（例如 15m 或 1h）。',
            affectsExecution: true,
          },
        },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'grid.range_rebalance', status: 'locked' }),
    ]))
    expect(merged.contextSlots.timeframe?.value).toBe('15m')
  })

  it('keeps unresolved slots open when the current round only answers one part of a trigger', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        triggers: [
          {
            id: 'entry-ma',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'reference.period.entry',
                fieldPath: 'triggers[0].params.reference.period',
                status: 'open',
                priority: 'core',
                questionHint: '长期均线是多少？',
                affectsExecution: true,
              },
              {
                slotKey: 'confirmationMode.entry',
                fieldPath: 'triggers[0].params.confirmationMode',
                status: 'open',
                priority: 'core',
                questionHint: '突破按收盘确认还是盘中触发？',
                affectsExecution: true,
              },
            ],
          },
        ],
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        triggers: [
          {
            id: 'entry-1',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
              'reference.period': 50,
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'reference.period.entry',
                fieldPath: 'triggers[0].params.reference.period',
                value: 50,
                status: 'locked',
                priority: 'core',
                questionHint: '长期均线是多少？',
                affectsExecution: true,
              },
              {
                slotKey: 'confirmationMode.entry',
                fieldPath: 'triggers[0].params.confirmationMode',
                status: 'open',
                priority: 'core',
                questionHint: '突破按收盘确认还是盘中触发？',
                affectsExecution: true,
              },
            ],
          },
        ],
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.triggers[0]?.params['reference.period']).toBe(50)
    expect(merged.triggers[0]?.status).toBe('open')
    expect(merged.triggers[0]?.openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: 'reference.period.entry',
        status: 'locked',
        value: 50,
      }),
      expect.objectContaining({
        slotKey: 'confirmationMode.entry',
        status: 'open',
      }),
    ]))
  })

  it('keeps stronger persisted trigger params and context slots when a weaker derived round omits or loosens them', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        triggers: [
          {
            id: 'entry-ma',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
              'reference.period': 50,
              confirmationMode: 'close_confirm',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        actions: [],
        risk: [],
        position: null,
        contextSlots: {
          exchange: {
            slotKey: 'exchange',
            fieldPath: 'contextSlots.exchange',
            value: 'okx',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认交易所。',
            affectsExecution: true,
          },
          symbol: {
            slotKey: 'symbol',
            fieldPath: 'contextSlots.symbol',
            value: 'BTCUSDT',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认交易标的。',
            affectsExecution: true,
          },
          marketType: {
            slotKey: 'marketType',
            fieldPath: 'contextSlots.marketType',
            value: 'perp',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认市场类型。',
            affectsExecution: true,
          },
          timeframe: {
            slotKey: 'timeframe',
            fieldPath: 'contextSlots.timeframe',
            value: '1h',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认主周期。',
            affectsExecution: true,
          },
        },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        triggers: [
          {
            id: 'derived-entry-ma',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
            },
            status: 'open',
            source: 'derived',
            openSlots: [
              {
                slotKey: 'reference.period.entry',
                fieldPath: 'triggers[0].params.reference.period',
                status: 'open',
                priority: 'core',
                questionHint: '长期均线是多少？',
                affectsExecution: true,
              },
            ],
          },
        ],
        actions: [],
        risk: [],
        position: null,
        contextSlots: {
          exchange: {
            slotKey: 'exchange',
            fieldPath: 'contextSlots.exchange',
            status: 'open',
            priority: 'context',
            questionHint: '请确认交易所。',
            affectsExecution: true,
          },
          symbol: {
            slotKey: 'symbol',
            fieldPath: 'contextSlots.symbol',
            status: 'open',
            priority: 'context',
            questionHint: '请确认交易标的。',
            affectsExecution: true,
          },
          marketType: {
            slotKey: 'marketType',
            fieldPath: 'contextSlots.marketType',
            status: 'open',
            priority: 'context',
            questionHint: '请确认市场类型。',
            affectsExecution: true,
          },
          timeframe: {
            slotKey: 'timeframe',
            fieldPath: 'contextSlots.timeframe',
            value: '15m',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认主周期。',
            affectsExecution: true,
          },
        },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.triggers[0]).toEqual(expect.objectContaining({
      id: 'entry-ma',
      status: 'locked',
      source: 'user_explicit',
      params: expect.objectContaining({
        indicator: 'ma',
        referenceRole: 'long_term',
        'reference.period': 50,
        confirmationMode: 'close_confirm',
      }),
    }))
    expect(merged.contextSlots.exchange).toEqual(expect.objectContaining({
      value: 'okx',
      status: 'locked',
    }))
    expect(merged.contextSlots.symbol).toEqual(expect.objectContaining({
      value: 'BTCUSDT',
      status: 'locked',
    }))
    expect(merged.contextSlots.marketType).toEqual(expect.objectContaining({
      value: 'perp',
      status: 'locked',
    }))
    expect(merged.contextSlots.timeframe).toEqual(expect.objectContaining({
      value: '15m',
      status: 'locked',
    }))
  })

  it('matches the same trigger when only one side omits sideScope', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['grid.range_rebalance'],
        triggers: [
          {
            id: 'grid-entry',
            key: 'grid.range_rebalance',
            phase: 'entry',
            sideScope: 'both',
            params: {
              rangeLower: 60000,
              rangeUpper: 80000,
              stepPct: 0.5,
              sideMode: 'bidirectional',
              breakoutAction: 'pause',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['grid.range_rebalance'],
        triggers: [
          {
            id: 'derived-grid-entry',
            key: 'grid.range_rebalance',
            phase: 'entry',
            params: {
              rangeLower: 60000,
              rangeUpper: 80000,
              stepPct: 0.5,
              sideMode: 'bidirectional',
              breakoutAction: 'pause',
            },
            status: 'open',
            source: 'derived',
            openSlots: [],
          },
        ],
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.triggers).toHaveLength(1)
    expect(merged.triggers[0]).toEqual(expect.objectContaining({
      id: 'grid-entry',
      key: 'grid.range_rebalance',
      sideScope: 'both',
      status: 'locked',
    }))
  })

  it('keeps stronger persisted position, actions, and risk atoms when a weaker derived round only provides looser replacements', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [
          { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
          { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
        ],
        risk: [
          {
            id: 'stop-loss',
            key: 'stop_loss_pct',
            params: { value: 5 },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        position: {
          mode: 'fixed_ratio',
          value: 0.1,
          positionMode: 'long_only',
          status: 'locked',
          source: 'user_explicit',
        },
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        triggers: [],
        actions: [
          { id: 'derived-open-long', key: 'open_long', status: 'open', source: 'derived' },
        ],
        risk: [
          {
            id: 'derived-stop-loss',
            key: 'stop_loss_pct',
            params: {},
            status: 'open',
            source: 'derived',
            openSlots: [
              {
                slotKey: 'risk.stopLossPct',
                fieldPath: 'risk[0].params.value',
                status: 'open',
                priority: 'risk',
                questionHint: '止损比例是多少？',
                affectsExecution: true,
              },
            ],
          },
        ],
        position: {
          mode: 'fixed_ratio',
          value: 0.1,
          positionMode: 'long_only',
          status: 'open',
          source: 'derived',
        },
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.position).toEqual(expect.objectContaining({
      status: 'locked',
      source: 'user_explicit',
      value: 0.1,
    }))
    expect(merged.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'open-long',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
      }),
      expect.objectContaining({
        id: 'close-long',
        key: 'close_long',
        status: 'locked',
        source: 'user_explicit',
      }),
    ]))
    expect(merged.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'stop-loss',
        key: 'stop_loss_pct',
        status: 'locked',
        source: 'user_explicit',
        params: expect.objectContaining({ value: 5 }),
      }),
    ]))
  })

  it('matches each derived trigger at most once so persisted sibling atoms stay distinct', () => {
    const merged = service.merge({
      persisted: {
        version: 1,
        families: ['single-leg'],
        triggers: [
          {
            id: 'entry-sibling-a',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'reference.period.entry.a',
                fieldPath: 'triggers[0].params.reference.period',
                status: 'open',
                priority: 'core',
                questionHint: '第一个条件的长期均线周期是多少？',
                affectsExecution: true,
              },
            ],
          },
          {
            id: 'entry-sibling-b',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'reference.period.entry.b',
                fieldPath: 'triggers[1].params.reference.period',
                status: 'open',
                priority: 'core',
                questionHint: '第二个条件的长期均线周期是多少？',
                affectsExecution: true,
              },
            ],
          },
        ],
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      derived: {
        version: 1,
        families: ['single-leg'],
        triggers: [
          {
            id: 'derived-entry-open',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
            },
            status: 'open',
            source: 'derived',
            openSlots: [
              {
                slotKey: 'reference.period.entry',
                fieldPath: 'triggers[0].params.reference.period',
                status: 'open',
                priority: 'core',
                questionHint: '长期均线周期是多少？',
                affectsExecution: true,
              },
            ],
          },
        ],
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:01:00.000Z',
      },
    })

    expect(merged.triggers).toHaveLength(2)
    expect(merged.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-sibling-a',
      }),
      expect.objectContaining({
        id: 'entry-sibling-b',
      }),
    ]))
  })
})
