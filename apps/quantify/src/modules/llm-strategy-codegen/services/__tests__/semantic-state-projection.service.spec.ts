import type { SemanticRiskState, SemanticState, SemanticTriggerState } from '../../types/semantic-state'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

describe('SemanticStateProjectionService', () => {
  const service = new SemanticStateProjectionService()

  it('builds display logic graph from locked semantic atoms for previous candle breakout strategy', () => {
    const state: SemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'semantic-entry-1',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'high', offsetBars: 1 },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'semantic-exit-1',
          key: 'condition.expression',
          phase: 'exit',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'LT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'low', offsetBars: 1 },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'semantic-gate-1',
          key: 'condition.expression',
          phase: 'gate',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'EQ',
              left: { kind: 'position', field: 'has_position', side: 'long' },
              right: { kind: 'constant', value: false },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      risk: [
        {
          id: 'risk-stop-loss',
          key: 'risk.stop_loss_pct',
          params: { valuePct: 1, basis: 'entry_avg_price' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      position: {
        sizing: { kind: 'ratio', value: 0.03, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.03,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          value: 'okx',
          status: 'locked',
          priority: 'context',
          questionHint: '请选择交易所',
          affectsExecution: true,
        },
        symbol: {
          slotKey: 'symbol',
          fieldPath: 'contextSlots.symbol',
          value: 'BTCUSDT',
          status: 'locked',
          priority: 'context',
          questionHint: '请选择交易标的',
          affectsExecution: true,
        },
        marketType: {
          slotKey: 'marketType',
          fieldPath: 'contextSlots.marketType',
          value: 'perp',
          status: 'locked',
          priority: 'context',
          questionHint: '请选择市场类型',
          affectsExecution: true,
        },
        timeframe: {
          slotKey: 'timeframe',
          fieldPath: 'contextSlots.timeframe',
          value: '1m',
          status: 'locked',
          priority: 'context',
          questionHint: '请选择周期',
          affectsExecution: true,
        },
      },
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    }

    const graph = service.buildDisplayLogicGraph(state)
    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(graph.blocks.map(block => block.type)).toEqual(['IF', 'AND_AT_THEN', 'EXECUTE'])
    expect(graph.blocks[0]?.items.map(item => item.text)).toEqual([
      '收盘价高于前 1 根最高价，且持有多仓等于false',
      '开多 3%',
    ])
    expect(graph.blocks[1]?.items.map(item => item.text)).toEqual([
      '收盘价低于前 1 根最低价',
      '平多',
    ])
    expect(text).toContain('交易所: OKX')
    expect(text).toContain('标的: BTCUSDT')
    expect(text).toContain('周期: 1m')
    expect(text).toContain('仓位: 3%')
    expect(text).toContain('市场: 永续')
    expect(text).toContain('风控: 止损：价格相对入场均价下跌1% 强制平仓 -> 平仓')
    expect(text).not.toContain('不支持的条件')
    expect(text).not.toContain('待补充')
  })

  it('skips malformed expression operands instead of throwing while building display graph', () => {
    const state = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'malformed-entry',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'indicator', name: 'rsi' },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      risk: [],
      position: {
        sizing: { kind: 'ratio', value: 0.03, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.03,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    } as unknown as SemanticState

    expect(() => service.buildDisplayLogicGraph(state)).not.toThrow()
    expect(service.buildDisplayLogicGraph(state).blocks).toEqual([
      {
        type: 'EXECUTE',
        items: [
          {
            kind: 'execute',
            id: 'execute-position',
            key: 'positionSizing',
            value: '3%',
            text: '仓位: 3%',
          },
        ],
      },
    ])
  })

  it('selects entry action by trigger side for bidirectional display logic graph', () => {
    const state: SemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-long',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'open' },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'entry-short',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'short',
          params: {
            expression: {
              kind: 'predicate',
              op: 'LT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'open' },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'open-short', key: 'open_short', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      risk: [],
      position: {
        sizing: { kind: 'ratio', value: 0.05, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.05,
        positionMode: 'long_short',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    }

    const graph = service.buildDisplayLogicGraph(state)
    const shortEntryTexts = graph.blocks[1]?.items.map(item => item.text) ?? []

    expect(shortEntryTexts).toContain('开空 5%')
    expect(shortEntryTexts).not.toContain('开多 5%')
  })

  it('selects short exit action by trigger side for display logic graph', () => {
    const state: SemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'exit-long',
          key: 'condition.expression',
          phase: 'exit',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'LT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'open' },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-short',
          key: 'condition.expression',
          phase: 'exit',
          sideScope: 'short',
          params: {
            expression: {
              kind: 'predicate',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'open' },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'close-short', key: 'close_short', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      risk: [],
      position: {
        sizing: { kind: 'ratio', value: 0.05, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.05,
        positionMode: 'long_short',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    }

    const graph = service.buildDisplayLogicGraph(state)
    const shortExitTexts = graph.blocks[1]?.items.map(item => item.text) ?? []

    expect(shortExitTexts).toContain('平空')
    expect(shortExitTexts).not.toContain('平多')
  })

  it('filters entry gates by side compatibility in display logic graph', () => {
    const state: SemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-long',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'open' },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'entry-short',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'short',
          params: {
            expression: {
              kind: 'predicate',
              op: 'LT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'open' },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'gate-long',
          key: 'condition.expression',
          phase: 'gate',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'EQ',
              left: { kind: 'position', field: 'has_position', side: 'long' },
              right: { kind: 'constant', value: false },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'gate-short',
          key: 'condition.expression',
          phase: 'gate',
          sideScope: 'short',
          params: {
            expression: {
              kind: 'predicate',
              op: 'EQ',
              left: { kind: 'position', field: 'has_position', side: 'short' },
              right: { kind: 'constant', value: false },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'open-short', key: 'open_short', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      risk: [],
      position: {
        sizing: { kind: 'ratio', value: 0.05, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.05,
        positionMode: 'long_short',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    }

    const graph = service.buildDisplayLogicGraph(state)
    const longCondition = graph.blocks[0]?.items[0]?.text ?? ''
    const shortCondition = graph.blocks[1]?.items[0]?.text ?? ''

    expect(longCondition).toContain('持有多仓等于false')
    expect(longCondition).not.toContain('持有空仓等于false')
    expect(shortCondition).toContain('持有空仓等于false')
    expect(shortCondition).not.toContain('持有多仓等于false')
  })

  it('infers omitted gate side from position expression operand in display logic graph', () => {
    const state: SemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-long',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'open' },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'entry-short',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'short',
          params: {
            expression: {
              kind: 'predicate',
              op: 'LT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'open' },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'gate-long',
          key: 'condition.expression',
          phase: 'gate',
          params: {
            expression: {
              kind: 'predicate',
              op: 'EQ',
              left: { kind: 'position', field: 'has_position', side: 'long' },
              right: { kind: 'constant', value: false },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'gate-short',
          key: 'condition.expression',
          phase: 'gate',
          params: {
            expression: {
              kind: 'predicate',
              op: 'EQ',
              left: { kind: 'position', field: 'has_position', side: 'short' },
              right: { kind: 'constant', value: false },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'open-short', key: 'open_short', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      risk: [],
      position: {
        sizing: { kind: 'ratio', value: 0.05, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.05,
        positionMode: 'long_short',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    }

    const graph = service.buildDisplayLogicGraph(state)
    const longCondition = graph.blocks[0]?.items[0]?.text ?? ''
    const shortCondition = graph.blocks[1]?.items[0]?.text ?? ''

    expect(longCondition).toContain('持有多仓等于false')
    expect(longCondition).not.toContain('持有空仓等于false')
    expect(shortCondition).toContain('持有空仓等于false')
    expect(shortCondition).not.toContain('持有多仓等于false')
  })

  const closeOpenExpressionState = (): SemanticState => ({
    version: 1,
    families: ['single-leg'],
    triggers: [
      {
        id: 'entry-close-gt-open',
        key: 'condition.expression',
        phase: 'entry',
        sideScope: 'long',
        params: {
          expression: {
            kind: 'predicate',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'series', source: 'bar', field: 'open' },
          },
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      {
        id: 'exit-close-lt-open',
        key: 'condition.expression',
        phase: 'exit',
        sideScope: 'long',
        params: {
          expression: {
            kind: 'predicate',
            op: 'LT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'series', source: 'bar', field: 'open' },
          },
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      {
        id: 'gate-no-position',
        key: 'condition.expression',
        phase: 'gate',
        params: {
          expression: {
            kind: 'NOT',
            children: [
              {
                kind: 'predicate',
                op: 'EQ',
                left: { kind: 'position', field: 'has_position', side: 'long' },
                right: { kind: 'constant', value: true },
              },
            ],
          },
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    actions: [
      { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
    ],
    risk: [],
    position: {
      mode: 'fixed_quote',
      value: 10,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
    },
    contextSlots: {
      exchange: {
        slotKey: 'exchange',
        fieldPath: 'contextSlots.exchange',
        value: null,
        status: 'open',
        priority: 'context',
        questionHint: '请选择交易所',
        affectsExecution: true,
      },
      symbol: {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        value: 'BTCUSDT',
        status: 'locked',
        priority: 'context',
        questionHint: '请选择交易标的',
        affectsExecution: true,
      },
      marketType: {
        slotKey: 'marketType',
        fieldPath: 'contextSlots.marketType',
        value: null,
        status: 'open',
        priority: 'context',
        questionHint: '请选择市场类型',
        affectsExecution: true,
      },
      timeframe: {
        slotKey: 'timeframe',
        fieldPath: 'contextSlots.timeframe',
        value: '1m',
        status: 'locked',
        priority: 'context',
        questionHint: '请选择周期',
        affectsExecution: true,
      },
    },
    normalizationNotes: [],
    updatedAt: '2026-04-28T00:00:00.000Z',
  })

  it('formats generic close-open expressions', () => {
    const result = service.buildClarificationView(closeOpenExpressionState())

    expect(result.summary).toContain('入场：收盘价高于开盘价时做多开仓')
    expect(result.summary).toContain('出场：收盘价低于开盘价时平多')
    expect(result.nextQuestion).toBe('请选择交易所')
  })

  it('asks action open slot questions after trigger and position slots are closed', () => {
    const state = closeOpenExpressionState()
    state.contextSlots.exchange = null
    state.contextSlots.marketType = null
    state.actions[0] = {
      ...state.actions[0]!,
      status: 'open',
      openSlots: [{
        slotKey: 'action.order_type',
        fieldPath: 'actions[0].params.orderType',
        status: 'open',
        priority: 'behavior',
        questionHint: '请确认开仓订单类型。',
        affectsExecution: true,
      }],
    }

    expect(service.buildClarificationView(state).nextQuestion).toBe('请确认开仓订单类型。')
  })

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

  it('describes official strategy plaza atomic triggers with concrete params and actions', () => {
    const result = service.buildConversationView({
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-ma-cross',
          key: 'indicator.cross_over',
          phase: 'entry',
          sideScope: 'long',
          params: { indicator: 'ma', fastPeriod: 6, slowPeriod: 48 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-ma-cross',
          key: 'indicator.cross_under',
          phase: 'exit',
          sideScope: 'long',
          params: { indicator: 'ma', fastPeriod: 6, slowPeriod: 48 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'entry-breakout',
          key: 'price.breakout_up',
          phase: 'entry',
          sideScope: 'long',
          params: { period: 24, bufferPct: 0.25 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'entry-range',
          key: 'price.range_position_lte',
          phase: 'entry',
          sideScope: 'long',
          params: { lookbackBars: 36, thresholdPct: 20 },
          status: 'locked',
          source: 'user_explicit',
          evidence: { text: '价格位于最近 36 根 K 线区间下 20% 时买入', source: 'user_explicit' },
          openSlots: [],
        },
        {
          id: 'exit-range',
          key: 'price.range_position_gte',
          phase: 'exit',
          sideScope: 'long',
          params: { lookbackBars: 36, thresholdPct: 55 },
          status: 'locked',
          source: 'user_explicit',
          evidence: { text: '价格回到区间上 55% 时卖出平仓', source: 'user_explicit' },
          openSlots: [],
        },
        {
          id: 'entry-rsi',
          key: 'indicator.cross_over',
          phase: 'entry',
          sideScope: 'long',
          params: { indicator: 'rsi', period: 14, value: 38 },
          status: 'locked',
          source: 'user_explicit',
          evidence: { text: 'RSI14 从 38 下方向上穿回 38 时买入', source: 'user_explicit' },
          openSlots: [],
        },
        {
          id: 'entry-bollinger',
          key: 'bollinger.touch_lower',
          phase: 'entry',
          sideScope: 'long',
          params: { period: 30, stdDev: 0.9 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-bollinger',
          key: 'bollinger.touch_middle',
          phase: 'exit',
          sideScope: 'long',
          params: { period: 30, stdDev: 0.9 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'entry-macd',
          key: 'indicator.cross_over',
          phase: 'entry',
          sideScope: 'long',
          params: { indicator: 'macd', fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 },
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
      updatedAt: '2026-04-15T10:00:00.000Z',
    })

    expect(result.summary).toContain('入场：MA6 上穿 MA48 时做多开仓')
    expect(result.summary).toContain('出场：MA6 下穿 MA48 时平多')
    expect(result.summary).toContain('入场：价格突破最近 24 根 K 线高点，突破缓冲 0.25% 时做多开仓')
    expect(result.summary).toContain('入场：价格位于最近 36 根 K 线区间下 20% 时买入')
    expect(result.summary).toContain('出场：价格位于最近 36 根 K 线区间上 55% 时卖出平仓')
    expect(result.summary).toContain('入场：RSI14 上穿 38 时买入')
    expect(result.summary).toContain('入场：触及布林带 30 周期 0.9 倍标准差下轨时做多开仓')
    expect(result.summary).toContain('出场：触及布林带 30 周期 0.9 倍标准差中轨时平多')
    expect(result.summary).toContain('入场：MACD 16/34/12 金叉时做多开仓')
    expect(result.summary).not.toContain('bollinger.touch_lower')
    expect(result.summary).not.toContain('bollinger.touch_middle')
    expect(result.summary).not.toContain('indicator.cross_over')
    expect(result.summary).not.toContain('price.breakout_up')
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

  it('formats grid summaries from canonical rangeMin/rangeMax params', () => {
    const view = service.buildClarificationView({
      version: 1,
      families: ['grid.range_rebalance'],
      triggers: [
        {
          id: 'grid-entry',
          key: 'grid.range_rebalance',
          phase: 'entry',
          params: { rangeMin: 100, rangeMax: 110, stepPct: 1 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    })

    expect(view.summary).toContain('100-110')
    expect(view.summary).toContain('步长 1%')
    expect(view.summary).not.toContain('区间待补充')
  })

  it('formats grid summaries from nested range params', () => {
    const view = service.buildClarificationView({
      version: 1,
      families: ['grid.range_rebalance'],
      triggers: [
        {
          id: 'grid-entry',
          key: 'grid.range_rebalance',
          phase: 'entry',
          params: { range: { lower: 90, upper: 120 }, stepPct: 2 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    })

    expect(view.summary).toContain('90-120')
    expect(view.summary).toContain('步长 2%')
    expect(view.summary).not.toContain('区间待补充')
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
            fieldPath: 'position.sizing',
            status: 'open',
            priority: 'risk',
            questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
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

    expect(result.nextQuestion).toBe('请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。')
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
            fieldPath: 'position.sizing',
            status: 'open',
            priority: 'risk',
            questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
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

    expect(result.nextQuestion).toBe('请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。')
  })

  it('builds deterministic MA conversation view with execution context and inferred stop-loss basis', () => {
    const view = service.buildConversationView({
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
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        {
          id: 'open-long',
          key: 'open_long',
          status: 'locked',
          source: 'user_explicit',
        },
      ],
      risk: [
        {
          id: 'sl',
          key: 'risk.stop_loss_pct',
          params: {
            valuePct: 5,
            basis: 'entry_avg_price',
            basisSource: 'system_default',
          },
          status: 'locked',
          source: 'derived',
          openSlots: [],
        },
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          value: 'okx',
          status: 'locked',
          priority: 'context',
          questionHint: '',
          affectsExecution: true,
        },
        symbol: {
          slotKey: 'symbol',
          fieldPath: 'contextSlots.symbol',
          value: 'BTCUSDT',
          status: 'locked',
          priority: 'context',
          questionHint: '',
          affectsExecution: true,
        },
        marketType: {
          slotKey: 'marketType',
          fieldPath: 'contextSlots.marketType',
          value: 'spot',
          status: 'locked',
          priority: 'context',
          questionHint: '',
          affectsExecution: true,
        },
        timeframe: {
          slotKey: 'timeframe',
          fieldPath: 'contextSlots.timeframe',
          value: '15m',
          status: 'locked',
          priority: 'context',
          questionHint: '',
          affectsExecution: true,
        },
      },
      normalizationNotes: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    })

    expect(view.summary).toContain('MA50')
    expect(view.hasDeterministicSemantics).toBe(true)
    expect(view.executionContext).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      timeframe: '15m',
    })
    expect(view.recommendationSignals.hasLongIntent).toBe(true)
    expect(view.inferredDefaults).toEqual({
      inferredKeys: ['risk.stopLossBasis'],
      stopLossBasis: 'entry_avg_price',
      takeProfitBasis: null,
    })
  })

  it('renders structured risk condition expressions in server-side conversation summaries', () => {
    const view = service.buildConversationView({
      version: 1,
      families: ['single-leg'],
      triggers: [],
      actions: [],
      risk: [
        {
          id: 'daily-loss-halt',
          key: 'risk.condition_expression',
          params: {
            condition: {
              kind: 'predicate',
              op: 'LTE',
              left: { kind: 'position', field: 'pnl_pct' },
              right: { kind: 'constant', value: -5, unit: 'percent' },
            },
            effect: { type: 'pause_strategy' },
            scope: 'strategy',
            capabilityStatus: 'recognized_unsupported',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-21T00:00:00.000Z',
    })

    expect(view.riskSummary).toContain('风控：当持仓收益率低于或等于-5%时暂停策略')
  })

  it('builds grid recommendation signal from grid triggers and family', () => {
    const view = service.buildConversationView({
      version: 1,
      families: ['grid.range_rebalance'],
      triggers: [
        {
          id: 'grid',
          key: 'grid.range_rebalance',
          phase: 'entry',
          params: {
            rangeLower: 100,
            rangeUpper: 110,
            stepPct: 1,
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
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    })

    expect(view.recommendationSignals.hasGridIntent).toBe(true)
  })

  it('builds short recommendation signal from short side scope', () => {
    const view = service.buildConversationView({
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'bollinger-short',
          key: 'bollinger.touch_upper',
          phase: 'entry',
          params: {
            period: 20,
            stdDev: 2,
          },
          sideScope: 'short',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    })

    expect(view.recommendationSignals.hasShortIntent).toBe(true)
  })

  it('builds percent-change conversation view with basis wording', () => {
    const view = service.buildConversationView({
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'percent',
          key: 'price.percent_change',
          phase: 'entry',
          params: {
            valuePct: -2,
            basis: 'prev_close',
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
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    })

    expect(view.summary).toContain('价格相对前收盘')
  })

  it('does not mark deterministic semantics when only open/incomplete atoms exist', () => {
    const view = service.buildConversationView({
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
              questionHint: '确认方式',
              affectsExecution: true,
            },
          ],
        },
      ],
      actions: [
        {
          id: 'action-open',
          key: 'open_long',
          status: 'open',
          source: 'user_explicit',
        },
      ],
      risk: [
        {
          id: 'risk-open',
          key: 'risk.stop_loss_pct',
          params: {
            valuePct: 5,
            basis: 'entry_avg_price',
            basisSource: 'system_default',
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0,
        positionMode: 'long_only',
        status: 'open',
        source: 'user_explicit',
      },
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-21T00:00:00.000Z',
    })

    expect(view.hasDeterministicSemantics).toBe(false)
    expect(view.summary).toBe('已识别部分条件，但仍未完整。')
    expect(view.triggerSummary).toBe('')
    expect(view.riskSummary).toBe('')
    expect(view.positionSummary).toBe('')
    expect(view.recommendationSignals).toEqual({
      hasShortIntent: false,
      hasLongIntent: false,
      hasBidirectionalIntent: false,
      hasGridIntent: false,
    })
  })

  it('buildClarificationView still surfaces open next question', () => {
    const clarification = service.buildClarificationView({
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
              questionHint: '突破请确认后续动作',
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
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    })

    expect(clarification.nextQuestion).toBe('突破请确认后续动作')
  })

  it('excludes superseded locked semantic atoms from deterministic summary and signals', () => {
    const view = service.buildConversationView({
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'trigger-legacy',
          key: 'indicator.above',
          phase: 'entry',
          params: {
            indicator: 'ma',
            referenceRole: 'long_term',
            'reference.period': 50,
          },
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'trigger-active',
          key: 'price.percent_change',
          phase: 'exit',
          params: {
            valuePct: -2,
            basis: 'prev_close',
          },
          sideScope: 'short',
          status: 'locked',
          source: 'user_explicit',
          supersedes: ['trigger-legacy'],
          openSlots: [],
        },
      ],
      actions: [],
      risk: [
        {
          id: 'risk-legacy',
          key: 'risk.stop_loss_pct',
          params: {
            valuePct: 1,
            basis: 'entry_avg_price',
            basisSource: 'system_default',
          },
          status: 'locked',
          source: 'derived',
          openSlots: [],
        },
        {
          id: 'risk-active',
          key: 'risk.stop_loss_pct',
          params: {
            valuePct: 2.5,
            basis: 'entry_avg_price',
            basisSource: 'system_default',
          },
          status: 'locked',
          source: 'derived',
          supersedes: ['risk-legacy'],
          openSlots: [],
        },
      ],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    })

    expect(view.triggerSummary).not.toContain('MA50')
    expect(view.summary).toContain('价格相对前收盘下跌2%')
    expect(view.riskSummary).toContain('2.5%')
    expect(view.riskSummary).not.toContain('1%')
    expect(view.recommendationSignals.hasLongIntent).toBe(false)
    expect(view.recommendationSignals.hasShortIntent).toBe(true)
    expect(view.recommendationSignals.hasBidirectionalIntent).toBe(false)
  })

  it('ignores superseded trigger open slots when selecting next clarification question', () => {
    const result = service.buildClarificationView({
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'old-open',
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ma' },
          status: 'superseded',
          source: 'user_explicit',
          openSlots: [{
            slotKey: 'old.slot',
            fieldPath: 'triggers[0].params.old',
            status: 'open',
            priority: 'core',
            questionHint: '不应该再问这个旧问题',
            affectsExecution: true,
          }],
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
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    })

    expect(result.nextQuestion).toBe('请确认交易所。')
  })

  it('does not fabricate MA0 for bollinger triggers without numeric period', () => {
    const view = service.buildConversationView({
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'bollinger-missing-period',
          key: 'bollinger.touch_middle',
          phase: 'exit',
          params: { indicator: 'bollinger', period: 'unknown' },
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
      updatedAt: '2026-04-22T00:00:00.000Z',
    })

    expect(view.summary).toContain('周期待补充')
    expect(view.summary).not.toContain('MA0')
  })

  it('trims locked execution context values and treats blank values as missing', () => {
    const view = service.buildConversationView({
      version: 1,
      families: [],
      triggers: [],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: ' okx ', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
        symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: '   ', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    })

    expect(view.executionContext.exchange).toBe('okx')
    expect(view.executionContext.symbol).toBeNull()
  })

  it('ignores user_explicit risk basis for inferred defaults', () => {
    const view = service.buildConversationView({
      version: 1,
      families: ['single-leg'],
      triggers: [],
      actions: [],
      risk: [
        {
          id: 'risk-user-explicit',
          key: 'risk.stop_loss_pct',
          params: {
            valuePct: 5,
            basis: 'position_pnl',
            basisSource: 'user_explicit',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    })

    expect(view.inferredDefaults).toEqual({
      inferredKeys: [],
      stopLossBasis: null,
      takeProfitBasis: null,
    })
  })

  it('keeps inferred basis as metadata without creating open risk slots', () => {
    const state: SemanticState = {
      version: 1,
      families: [],
      triggers: [],
      actions: [],
      risk: [{
        id: 'risk-1',
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5, basis: 'entry_avg_price', basisSource: 'system_default' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    }

    const view = service.buildConversationView(state)
    const clarification = service.buildClarificationView(state)

    expect(view.inferredDefaults.inferredKeys).toContain('risk.stopLossBasis')
    expect(clarification.nextQuestion).toBeNull()
    expect(state.risk).not.toContainEqual(expect.objectContaining({
      openSlots: expect.arrayContaining([
        expect.objectContaining({
          fieldPath: expect.stringMatching(/basis/u),
        }),
      ]),
    }))
  })

  it('keeps conversation summary stable for the same locked atoms with different order', () => {
    const makeState = (reverseTriggerOrder = false, reverseRiskOrder = false): ReturnType<typeof service.buildConversationView> => {
      const triggers: SemanticTriggerState[] = [
        {
          id: 'trigger-exit',
          key: 'execution.on_start',
          phase: 'exit',
          params: {},
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'trigger-entry',
          key: 'indicator.above',
          phase: 'entry',
          params: {
            indicator: 'ma',
            referenceRole: 'long_term',
            'reference.period': 20,
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ]

      const risks: SemanticRiskState[] = [
        {
          id: 'risk-stop',
          key: 'risk.stop_loss_pct',
          params: {
            valuePct: 3,
            basis: 'entry_avg_price',
            basisSource: 'system_default',
          },
          status: 'locked',
          source: 'derived',
          openSlots: [],
        },
        {
          id: 'risk-take',
          key: 'risk.take_profit_pct',
          params: {
            valuePct: 2,
            basis: 'entry_avg_price',
            basisSource: 'system_default',
          },
          status: 'locked',
          source: 'derived',
          openSlots: [],
        },
      ]

      return service.buildConversationView({
        version: 1,
        families: ['single-leg'],
        triggers: reverseTriggerOrder ? [...triggers].reverse() : triggers,
        actions: [],
        risk: reverseRiskOrder ? [...risks].reverse() : risks,
        position: {
          mode: 'fixed_ratio',
          value: 0.1,
          positionMode: 'long_only',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        contextSlots: {
          exchange: null,
          symbol: null,
          marketType: null,
          timeframe: null,
        },
        normalizationNotes: [],
        updatedAt: '2026-04-22T00:00:00.000Z',
      })
    }

    const viewA = makeState()
    const viewB = makeState(true, true)

    expect(viewA.summary).toBe(viewB.summary)
    expect(viewA.triggerSummary).toBe(viewB.triggerSummary)
    expect(viewA.riskSummary).toBe(viewB.riskSummary)
    expect(viewA.positionSummary).toBe(viewB.positionSummary)
  })

  it('formats floating-point position ratios safely', () => {
    const view = service.buildConversationView({
      version: 1,
      families: ['single-leg'],
      triggers: [],
      actions: [],
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0.30000000000000004,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    })

    expect(view.positionSummary).toBe('仓位：30%')
  })

  it('formats fixed quote position sizing as quote currency instead of a percent', () => {
    const view = service.buildConversationView({
      version: 1,
      families: ['single-leg'],
      triggers: [],
      actions: [],
      risk: [],
      position: {
        mode: 'fixed_quote',
        value: 10,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    })

    expect(view.positionSummary).toBe('仓位：10 USDT')
    expect(view.hasDeterministicSemantics).toBe(true)
  })

  describe('position sizing contract', () => {
    const buildView = (position: SemanticState['position']) => service.buildConversationView({
      version: 1,
      families: ['single-leg'],
      triggers: [],
      actions: [],
      risk: [],
      position,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-28T00:00:00.000Z',
    })

    it('formats locked ratio sizing contract deterministically', () => {
      const view = buildView({
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      })

      expect(view.positionSummary).toBe('仓位：10%')
      expect(view.hasDeterministicSemantics).toBe(true)
    })

    it('formats locked quote sizing contract deterministically', () => {
      const view = buildView({
        sizing: { kind: 'quote', value: 10, asset: 'USDT' },
        mode: 'fixed_quote',
        value: 10,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      })

      expect(view.positionSummary).toBe('仓位：10 USDT')
      expect(view.hasDeterministicSemantics).toBe(true)
    })

    it('formats locked base sizing contract deterministically', () => {
      const view = buildView({
        sizing: { kind: 'base', value: 0.001, asset: 'BTC' },
        mode: 'fixed_qty',
        value: 0.001,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      })

      expect(view.positionSummary).toBe('仓位：0.001 BTC')
      expect(view.hasDeterministicSemantics).toBe(true)
    })
  })
})
