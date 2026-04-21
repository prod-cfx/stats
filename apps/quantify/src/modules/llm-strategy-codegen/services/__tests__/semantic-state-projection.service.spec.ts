import { SemanticStateProjectionService } from '../semantic-state-projection.service'

describe('SemanticStateProjectionService', () => {
  const service = new SemanticStateProjectionService()

  it('builds summary and next question from semanticState instead of checklist text', () => {
    const result = service.buildClarificationView({
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
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
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
      updatedAt: '2026-04-15T10:00:00.000Z',
    })

    expect(result.summary).toContain('MA50')
    expect(result.nextQuestion).toBe('突破按收盘确认还是盘中触发？')
  })

  it('surfaces unsupported open work as a blocking fallback next question instead of hiding it', () => {
    const result = service.buildClarificationView({
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-custom',
          key: 'indicator.above',
          phase: 'entry',
          params: {
            indicator: 'ma',
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'pivot.definition.entry',
              fieldPath: 'triggers[0].params.pivot.definition',
              status: 'open',
              priority: 'core',
              questionHint: '这里的关键位置怎么定义？',
              affectsExecution: true,
            },
          ],
        },
      ],
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
          status: 'open',
          priority: 'context',
          questionHint: '周期是多少？',
          affectsExecution: true,
        },
      },
      normalizationNotes: [],
      updatedAt: '2026-04-15T10:00:00.000Z',
    })

    expect(result.nextQuestion).toBe('这里的关键位置怎么定义？')
  })

  it('prefers an open trigger slot over an open context slot', () => {
    const result = service.buildClarificationView({
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
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
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
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'open',
          priority: 'context',
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
        },
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    })

    expect(result.nextQuestion).toBe('突破按收盘确认还是盘中触发？')
  })

  it('builds a grid summary and surfaces the next open grid slot before context slots', () => {
    const view = service.buildClarificationView({
      version: 1,
      families: ['grid.range_rebalance'],
      triggers: [
        {
          id: 'grid-entry',
          key: 'grid.range_rebalance',
          phase: 'entry',
          params: { breakoutAction: 'pause' },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'grid.range.lower',
              fieldPath: 'triggers[0].params.rangeLower',
              status: 'open',
              priority: 'core',
              questionHint: '请确认网格区间下界。',
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
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
        },
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    })

    expect(view.summary).toContain('网格')
    expect(view.nextQuestion).toBe('请确认网格区间下界。')
  })

  it('surfaces an open position sizing slot before context slots', () => {
    const result = service.buildClarificationView({
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-1',
          key: 'price.percent_change',
          phase: 'entry',
          params: { valuePct: -1, basis: 'prev_close' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [{ id: 'action-1', key: 'open_long', status: 'locked', source: 'user_explicit' }],
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0,
        positionMode: 'long_only',
        status: 'open',
        source: 'derived',
        openSlots: [
          {
            slotKey: 'position.sizing',
            fieldPath: 'position.value',
            status: 'open',
            priority: 'risk',
            questionHint: '请确认单笔仓位百分比（例如 10%）。',
            affectsExecution: true,
          },
        ],
      },
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'open',
          priority: 'context',
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
        },
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-21T00:00:00.000Z',
    })

    expect(result.nextQuestion).toBe('请确认单笔仓位百分比（例如 10%）。')
  })

  it('surfaces an open position sizing slot before an open risk slot', () => {
    const result = service.buildClarificationView({
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-1',
          key: 'price.percent_change',
          phase: 'entry',
          params: { valuePct: -1, basis: 'prev_close' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [{ id: 'action-1', key: 'open_long', status: 'locked', source: 'user_explicit' }],
      risk: [
        {
          id: 'risk-1',
          key: 'stop_loss.percent',
          params: {},
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'risk.stop_loss',
              fieldPath: 'risk[0].params.stopLossPct',
              status: 'open',
              priority: 'risk',
              questionHint: '请确认止损百分比。',
              affectsExecution: true,
            },
          ],
        },
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0,
        positionMode: 'long_only',
        status: 'open',
        source: 'derived',
        openSlots: [
          {
            slotKey: 'position.sizing',
            fieldPath: 'position.value',
            status: 'open',
            priority: 'risk',
            questionHint: '请确认单笔仓位百分比（例如 10%）。',
            affectsExecution: true,
          },
        ],
      },
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'open',
          priority: 'context',
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
        },
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-21T00:00:00.000Z',
    })

    expect(result.nextQuestion).toBe('请确认单笔仓位百分比（例如 10%）。')
  })
})
