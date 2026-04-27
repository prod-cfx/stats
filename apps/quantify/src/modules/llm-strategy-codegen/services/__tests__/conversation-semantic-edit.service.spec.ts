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
