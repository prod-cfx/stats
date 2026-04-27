import { ConversationSemanticEditService } from '../conversation-semantic-edit.service'
import { buildReplacementSemanticState } from '../../types/semantic-edit'

describe('ConversationSemanticEditService', () => {
  const service = new ConversationSemanticEditService()

  it('classifies explicit context replacement', () => {
    const decision = service.decide({
      status: 'DRAFTING',
      message: '我要把交易标的改为 BTCUSDT',
      semanticState: service.createEmptySemanticStateForTest(),
    })

    expect(decision).toEqual({
      kind: 'APPLY_TO_SEMANTIC_STATE',
      patch: {
        operations: [{ op: 'replace_context', field: 'symbol', value: 'BTCUSDT' }],
      },
    })
  })

  it.each([
    ['把交易标的改成 BTCUSDT'],
    ['把交易标的换成 BTCUSDT'],
    ['把ETHusdt改为BTCUSDT'],
    ['ETHUSDT 换成 BTC-USDT'],
  ])('classifies natural symbol replacement wording: %s', (message) => {
    const decision = service.decide({
      status: 'DRAFTING',
      message,
      semanticState: service.createEmptySemanticStateForTest(),
    })

    expect(decision).toEqual({
      kind: 'APPLY_TO_SEMANTIC_STATE',
      patch: {
        operations: [{ op: 'replace_context', field: 'symbol', value: 'BTCUSDT' }],
      },
    })
  })

  it.each([
    ['把主周期改成 1h', 'timeframe', '1h'],
    ['把交易所换成 OKX', 'exchange', 'okx'],
    ['把市场类型改为现货', 'marketType', 'spot'],
    ['把市场改成永续', 'marketType', 'perp'],
  ])('classifies context parameter replacement wording: %s', (message, field, value) => {
    const decision = service.decide({
      status: 'PUBLISHED',
      message,
      semanticState: service.createEmptySemanticStateForTest(),
    })

    expect(decision).toEqual({
      kind: 'APPLY_TO_SEMANTIC_STATE',
      patch: {
        operations: [{ op: 'replace_context', field, value }],
      },
    })
  })

  it('classifies strategy replacement with seed text', () => {
    const decision = service.decide({
      status: 'PUBLISHED',
      message: '之前策略不对，重新做一个 RSI 策略',
      semanticState: service.createEmptySemanticStateForTest(),
    })

    expect(decision).toEqual({
      kind: 'REPLACE_STRATEGY_DRAFT',
      seedText: '重新做一个 RSI 策略',
    })
  })

  it('asks for replacement seed when user only says restart', () => {
    const decision = service.decide({
      status: 'CONFIRM_GATE',
      message: '之前不对，重新来',
      semanticState: service.createEmptySemanticStateForTest(),
    })

    expect(decision.kind).toBe('ASK_EDIT_CLARIFICATION')
    if (decision.kind !== 'ASK_EDIT_CLARIFICATION') return
    expect(decision.pendingEdit.op).toBe('replace_trigger')
    if (decision.pendingEdit.op !== 'replace_trigger') return
    expect(decision.question).toContain('请描述新的触发、行动、风控、仓位和运行 context')
    expect(decision.pendingEdit.candidate.key).not.toBe('indicator.rsi_threshold')
    expect(decision.pendingEdit.candidate.key).toBe('pending.strategy_replacement_seed')
  })

  it('consumes pending replacement seed as a full strategy replacement', () => {
    const semanticState = service.withStrategyReplacementSeedPendingEditForTest(
      service.createEmptySemanticStateForTest(),
      '之前不对，重新来',
    )

    const decision = service.decide({
      status: 'DRAFTING',
      message: '做一个 RSI 策略',
      semanticState,
    })

    expect(decision).toEqual({
      kind: 'REPLACE_STRATEGY_DRAFT',
      seedText: '做一个 RSI 策略',
    })
  })

  it('classifies a complete new grid description as a full strategy replacement instead of a merge', () => {
    const semanticState = {
      ...service.createEmptySemanticStateForTest(),
      triggers: [
        {
          id: 'entry-dynamic-grid',
          key: 'price.range_position_lte',
          phase: 'entry' as const,
          params: { lookbackBars: 36, positionPct: 20 },
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
        },
        {
          id: 'exit-dynamic-grid',
          key: 'price.range_position_gte',
          phase: 'exit' as const,
          params: { lookbackBars: 36, positionPct: 55 },
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
        },
      ],
      risk: [
        {
          id: 'risk-stop-loss',
          key: 'stop_loss',
          params: { pct: 3 },
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
        },
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0.25,
        positionMode: 'long_only',
        status: 'locked' as const,
        source: 'user_explicit' as const,
        openSlots: [],
      },
    }
    const message = '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈'

    const decision = service.decide({
      status: 'CONFIRM_GATE',
      message,
      semanticState,
    })

    expect(decision).toEqual({
      kind: 'REPLACE_STRATEGY_DRAFT',
      seedText: message,
    })
  })

  it('keeps asking when pending replacement seed follow-up is still generic', () => {
    const semanticState = service.withStrategyReplacementSeedPendingEditForTest(
      service.createEmptySemanticStateForTest(),
      '之前不对，重新来',
    )

    const decision = service.decide({
      status: 'DRAFTING',
      message: '继续',
      semanticState,
    })

    expect(decision.kind).toBe('ASK_EDIT_CLARIFICATION')
    if (decision.kind !== 'ASK_EDIT_CLARIFICATION') return
    expect(decision.pendingEdit.op).toBe('replace_trigger')
    if (decision.pendingEdit.op !== 'replace_trigger') return
    expect(decision.pendingEdit.candidate.key).toBe('pending.strategy_replacement_seed')
  })

  it('rejects edits while generation is processing', () => {
    const decision = service.decide({
      status: 'GENERATING',
      message: '把止损改成 3%',
      semanticState: service.createEmptySemanticStateForTest(),
    })

    expect(decision).toEqual({
      kind: 'REJECT_WHILE_PROCESSING',
      message: '当前策略正在生成或校验，请等待完成后再修改。',
    })
  })

  it('does not reject ordinary processing follow-up messages as edits', () => {
    const decision = service.decide({
      status: 'GENERATING',
      message: '继续',
      semanticState: service.createEmptySemanticStateForTest(),
    })

    expect(decision).toEqual({ kind: 'NO_EDIT' })
  })

  it('applies context replacement without changing triggers', () => {
    const base = service.createEmptySemanticStateForTest()
    const state = {
      ...base,
      triggers: [{
        id: 'trigger-1',
        key: 'indicator.above',
        phase: 'entry' as const,
        params: { indicator: 'ma' },
        status: 'locked' as const,
        source: 'user_explicit' as const,
        openSlots: [],
      }],
    }

    const next = service.applyPatch(state, {
      operations: [{ op: 'replace_context', field: 'symbol', value: 'BTCUSDT' }],
    })

    expect(next.contextSlots.symbol).toEqual(expect.objectContaining({
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: 'BTCUSDT',
      status: 'locked',
    }))
    expect(next.triggers).toEqual(state.triggers)
  })

  it.each([
    ['仓位35%换成20%'],
    ['把仓位35%换成20%'],
    ['仓位改成20%'],
  ])('classifies and applies position replacement wording: %s', (message) => {
    const semanticState = {
      ...service.createEmptySemanticStateForTest(),
      position: {
        mode: 'fixed_ratio',
        value: 0.35,
        positionMode: 'long_only',
        status: 'locked' as const,
        source: 'user_explicit' as const,
      },
    }

    const decision = service.decide({
      status: 'DRAFTING',
      message,
      semanticState,
    })

    expect(decision).toEqual({
      kind: 'APPLY_TO_SEMANTIC_STATE',
      patch: { operations: [{ op: 'replace_position', text: message }] },
    })
    if (decision.kind !== 'APPLY_TO_SEMANTIC_STATE') return

    const next = service.applyPatch(semanticState, decision.patch)

    expect(next.position).toEqual(expect.objectContaining({
      mode: 'fixed_ratio',
      value: 0.2,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }))
  })

  it.each([
    ['把开多改为开空'],
    ['开多换成开空'],
    ['open long 改成 open short'],
  ])('classifies and applies action side replacement wording: %s', (message) => {
    const semanticState = {
      ...service.createEmptySemanticStateForTest(),
      triggers: [
        {
          id: 'entry-bollinger-lower',
          key: 'bollinger.touch_lower',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          params: { period: 20, stdDev: 2 },
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
        },
        {
          id: 'exit-bollinger-middle',
          key: 'bollinger.touch_middle',
          phase: 'exit' as const,
          sideScope: 'long' as const,
          params: { period: 20, stdDev: 2 },
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
        },
      ],
      actions: [
        { id: 'action-open-long', key: 'open_long', status: 'locked' as const, source: 'user_explicit' as const },
        { id: 'action-close-long', key: 'close_long', status: 'locked' as const, source: 'user_explicit' as const },
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0.35,
        positionMode: 'long_only',
        status: 'locked' as const,
        source: 'user_explicit' as const,
      },
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          value: 'okx',
          status: 'locked' as const,
          priority: 'context' as const,
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
        },
        symbol: {
          slotKey: 'symbol',
          fieldPath: 'contextSlots.symbol',
          value: 'ETHUSDT',
          status: 'locked' as const,
          priority: 'context' as const,
          questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
          affectsExecution: true,
        },
        marketType: {
          slotKey: 'marketType',
          fieldPath: 'contextSlots.marketType',
          value: 'perp',
          status: 'locked' as const,
          priority: 'context' as const,
          questionHint: '请确认市场类型（现货或合约/perp）。',
          affectsExecution: true,
        },
        timeframe: {
          slotKey: 'timeframe',
          fieldPath: 'contextSlots.timeframe',
          value: '15m',
          status: 'locked' as const,
          priority: 'context' as const,
          questionHint: '请确认策略主周期（例如 15m 或 1h）。',
          affectsExecution: true,
        },
      },
    }

    const decision = service.decide({
      status: 'DRAFTING',
      message,
      semanticState,
    })

    expect(decision).toEqual({
      kind: 'APPLY_TO_SEMANTIC_STATE',
      patch: { operations: [{ op: 'replace_action', text: message }] },
    })
    if (decision.kind !== 'APPLY_TO_SEMANTIC_STATE') return

    const next = service.applyPatch(semanticState, decision.patch)

    expect(next.contextSlots.exchange?.value).toBe('okx')
    expect(next.actions.map(action => action.key)).toEqual(['open_short', 'close_short'])
    expect(next.triggers.map(trigger => trigger.sideScope)).toEqual(['short', 'short'])
    expect(next.position).toEqual(expect.objectContaining({
      value: 0.35,
      positionMode: 'short_only',
    }))
  })

  it.each([
    ['把MA6换成MA10'],
    ['MA6改成MA10'],
    ['把6周期均线换成10周期均线'],
  ])('classifies and applies moving-average period replacement wording: %s', (message) => {
    const semanticState = {
      ...service.createEmptySemanticStateForTest(),
      triggers: [
        {
          id: 'entry-ma-cross',
          key: 'indicator.cross_over',
          phase: 'entry' as const,
          params: { indicator: 'ma', fastPeriod: 6, slowPeriod: 48 },
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
        },
        {
          id: 'exit-ma-cross',
          key: 'indicator.cross_under',
          phase: 'exit' as const,
          params: { indicator: 'ma', fastPeriod: 6, slowPeriod: 48 },
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
        },
      ],
    }

    const decision = service.decide({
      status: 'DRAFTING',
      message,
      semanticState,
    })

    expect(decision).toEqual({
      kind: 'APPLY_TO_SEMANTIC_STATE',
      patch: {
        operations: [expect.objectContaining({
          op: 'replace_indicator_period',
          from: 6,
          to: 10,
        })],
      },
    })
    if (decision.kind !== 'APPLY_TO_SEMANTIC_STATE') return

    const next = service.applyPatch(semanticState, decision.patch)

    expect(next.triggers).toEqual([
      expect.objectContaining({
        id: 'entry-ma-cross',
        params: expect.objectContaining({ fastPeriod: 10, slowPeriod: 48 }),
      }),
      expect.objectContaining({
        id: 'exit-ma-cross',
        params: expect.objectContaining({ fastPeriod: 10, slowPeriod: 48 }),
      }),
    ])
  })

  it('creates pending edit when trigger replacement text is incomplete', () => {
    const decision = service.decide({
      status: 'CONFIRM_GATE',
      message: '把触发改成 RSI',
      semanticState: service.createEmptySemanticStateForTest(),
    })

    expect(decision.kind).toBe('ASK_EDIT_CLARIFICATION')
    if (decision.kind !== 'ASK_EDIT_CLARIFICATION') return
    expect(decision.pendingEdit.op).toBe('replace_trigger')
    expect(decision.pendingEdit.status).toBe('needs_clarification')
    expect(decision.question).toContain('RSI')
  })

  it('cancels pending edit without changing active state', () => {
    const base = service.createEmptySemanticStateForTest()
    const withPending = service.withPendingEditForTest(base, '把触发改成 RSI')

    const decision = service.decide({
      status: 'DRAFTING',
      message: '算了，保持原来的',
      semanticState: withPending,
    })

    expect(decision).toEqual({
      kind: 'APPLY_TO_SEMANTIC_STATE',
      patch: { operations: [{ op: 'cancel_pending_edit' }] },
    })
    if (decision.kind !== 'APPLY_TO_SEMANTIC_STATE') return
    expect(service.readPendingEditForTest(service.applyPatch(withPending, decision.patch))).toBeNull()
  })

  it('consumes pending trigger replacement when follow-up fills RSI threshold', () => {
    const semanticState = service.withPendingEditForTest(
      service.createEmptySemanticStateForTest(),
      '把触发改成 RSI',
    )

    const decision = service.decide({
      status: 'DRAFTING',
      message: '低于 30',
      semanticState,
    })

    expect(decision).toEqual({
      kind: 'APPLY_TO_SEMANTIC_STATE',
      patch: { operations: [{ op: 'replace_trigger', targetRef: undefined, text: '低于 30' }] },
    })
    if (decision.kind !== 'APPLY_TO_SEMANTIC_STATE') return

    const next = service.applyPatch(semanticState, decision.patch)

    expect(service.readPendingEditForTest(next)).toBeNull()
    expect(next.triggers[0]).toEqual(expect.objectContaining({
      key: 'oscillator.rsi_lte',
      phase: 'entry',
      params: {
        indicator: 'rsi',
        period: 14,
        value: 30,
      },
      status: 'locked',
    }))
  })

  it('replaces the single existing trigger and parses RSI threshold after period', () => {
    const base = {
      ...service.createEmptySemanticStateForTest(),
      triggers: [{
        id: 'trigger-ma',
        key: 'indicator.ma_cross',
        phase: 'entry' as const,
        params: { indicator: 'ma' },
        status: 'locked' as const,
        source: 'user_explicit' as const,
        openSlots: [],
      }],
    }
    const pendingDecision = service.decide({
      status: 'DRAFTING',
      message: '把触发改成 RSI',
      semanticState: base,
    })
    expect(pendingDecision.kind).toBe('ASK_EDIT_CLARIFICATION')
    if (pendingDecision.kind !== 'ASK_EDIT_CLARIFICATION') return
    expect(pendingDecision.pendingEdit.targetRef).toBe('trigger-ma')

    const withPending = service.applyPatch(
      service.withPendingEditForTest(base, '把触发改成 RSI'),
      { operations: [{ op: 'cancel_pending_edit' }] },
    )
    const semanticState = {
      ...withPending,
      pendingEdit: pendingDecision.pendingEdit,
    }
    const applyDecision = service.decide({
      status: 'DRAFTING',
      message: 'RSI 14 周期低于 30',
      semanticState,
    })
    expect(applyDecision.kind).toBe('APPLY_TO_SEMANTIC_STATE')
    if (applyDecision.kind !== 'APPLY_TO_SEMANTIC_STATE') return

    const next = service.applyPatch(semanticState, applyDecision.patch)

    expect(next.triggers).toHaveLength(1)
    expect(next.triggers[0]).toEqual(expect.objectContaining({
      id: 'trigger-ma',
      key: 'oscillator.rsi_lte',
      params: {
        indicator: 'rsi',
        period: 14,
        value: 30,
      },
    }))
  })

  it('keeps asking for target when pending trigger replacement has multiple possible triggers', () => {
    const pendingState = service.withPendingEditForTest(
      service.createEmptySemanticStateForTest(),
      '把触发改成 RSI',
    )
    const semanticState = {
      ...service.createEmptySemanticStateForTest(),
      triggers: [
        {
          id: 'trigger-ma',
          key: 'indicator.ma_cross',
          phase: 'entry' as const,
          params: { indicator: 'ma' },
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
        },
        {
          id: 'trigger-rsi-exit',
          key: 'oscillator.rsi_gte',
          phase: 'exit' as const,
          params: { indicator: 'rsi', value: 70 },
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
        },
      ],
      pendingEdit: service.readPendingEditForTest(pendingState),
    }

    const decision = service.decide({
      status: 'DRAFTING',
      message: '低于 30',
      semanticState,
    })

    expect(decision.kind).toBe('ASK_EDIT_CLARIFICATION')
    if (decision.kind !== 'ASK_EDIT_CLARIFICATION') return
    expect(decision.question).toContain('多个触发')
    expect(service.applyPatch(semanticState, { operations: [{ op: 'replace_trigger', text: '低于 30' }] }).triggers)
      .toEqual(semanticState.triggers)
  })

  it('keeps an empty patch as a no-op even when a pending edit exists', () => {
    const withPending = service.withPendingEditForTest(
      service.createEmptySemanticStateForTest(),
      '把触发改成 RSI',
    )

    expect(service.applyPatch(withPending, { operations: [] })).toBe(withPending)
  })

  it('caps replacement history and stores previous state without edit metadata', () => {
    const base = service.createEmptySemanticStateForTest()
    const previous = service.withStrategyReplacementSeedPendingEditForTest(base, '之前不对，重新来') as any
    previous.previousVersions = Array.from({ length: 6 }, (_, index) => ({
      reason: 'strategy_replacement',
      replacedAt: `2026-04-10T00:00:0${index}.000Z`,
      semanticState: service.createEmptySemanticStateForTest(),
    }))

    const next = buildReplacementSemanticState({
      previous,
      next: service.createEmptySemanticStateForTest(),
    })

    expect(next.previousVersions).toHaveLength(5)
    expect(next.previousVersions?.[0]?.replacedAt).toBe('2026-04-10T00:00:02.000Z')
    expect((next.previousVersions?.at(-1)?.semanticState as any).pendingEdit).toBeUndefined()
    expect((next.previousVersions?.at(-1)?.semanticState as any).previousVersions).toBeUndefined()
  })
})
