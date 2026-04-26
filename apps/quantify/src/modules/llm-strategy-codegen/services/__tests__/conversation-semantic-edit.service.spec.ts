import { ConversationSemanticEditService } from '../conversation-semantic-edit.service'

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
    expect(decision.question).toContain('请描述新的触发、行动、风控、仓位和运行 context')
    expect(decision.pendingEdit.candidate.key).not.toBe('indicator.rsi_threshold')
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
    expect(service.readPendingEditForTest(service.applyPatch(withPending, decision.patch))).toBeNull()
  })

  it('keeps an empty patch as a no-op even when a pending edit exists', () => {
    const withPending = service.withPendingEditForTest(
      service.createEmptySemanticStateForTest(),
      '把触发改成 RSI',
    )

    expect(service.applyPatch(withPending, { operations: [] })).toBe(withPending)
  })
})
