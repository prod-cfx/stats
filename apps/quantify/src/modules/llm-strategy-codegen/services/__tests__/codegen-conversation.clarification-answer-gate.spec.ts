import { CodegenConversationService } from '../codegen-conversation.service'

/**
 * Fix #1691 ROOT CAUSE 1:
 * NEEDS_CLARIFICATION 会话中，用户的"澄清回答"消息不得触发
 * conversationSemanticEdit.decide → REPLACE_STRATEGY_DRAFT，
 * 否则原始 prompt 会被当作新种子重新规划，导致 rules 漂移。
 *
 * 通过断言 isLikelyClarificationAnswerMessage 的通用判定规则覆盖：
 *   - 非空 clarificationAnswers
 *   - "<key>:" 前缀命中 pending 项 key
 *   - "<key>:" 前缀命中通用 clarification key 前缀
 *   - 普通对话消息不命中
 */

const stub = Object.create(CodegenConversationService.prototype)

function helper(
  message: string | null | undefined,
  clarificationAnswers: Record<string, unknown> | null | undefined,
  clarificationState: any,
): boolean {
  return (stub as any).isLikelyClarificationAnswerMessage(message, clarificationAnswers, clarificationState)
}

function pendingState(keys: string[]) {
  return {
    status: 'NEEDS_CLARIFICATION',
    items: keys.map(key => ({
      key,
      blocking: true,
      status: 'pending',
      reason: 'missing_entry_rules',
      priority: 90,
      question: 'q',
    })),
  }
}

describe('CodegenConversationService.isLikelyClarificationAnswerMessage', () => {
  it('returns true when clarificationAnswers record is non-empty', () => {
    expect(helper('任意消息', { foo: 'bar' }, null)).toBe(true)
  })

  it('returns true when message starts with a pending clarification key followed by colon', () => {
    const state = pendingState(['rulesMainflow.missing_entry_rules'])
    const msg = 'rulesMainflow.missing_entry_rules: 在 OKX 交易 BTCUSDT 永续合约'
    expect(helper(msg, null, state)).toBe(true)
  })

  it('returns true when message starts with the namespace prefix of any active pending key (#1691 review m3)', () => {
    // m3 review: prefix list is derived dynamically from pending keys instead of a hard-coded
    // allow-list. A pending `rulesMainflow.x` registers prefix `rulesMainflow.`; an indexed
    // pending key `rules[0].condition` registers `rules[`. Messages starting with those
    // prefixes are treated as clarification answers even without explicit `<key>:` form.
    expect(helper('rulesMainflow.foo bar', null, pendingState(['rulesMainflow.missing_entry_rules']))).toBe(true)
    expect(helper('semantic.x y', null, pendingState(['semantic.position.sizing']))).toBe(true)
    expect(helper('grid.range foo', null, pendingState(['grid.range.lower']))).toBe(true)
    expect(helper('rules[0] foo', null, pendingState(['rules[0].condition']))).toBe(true)
  })

  it('returns true when message names a parent path of an indexed pending key (#1691 review m4)', () => {
    // m4 review: candidate `<key>:` should match a pending key like `<key>.sub` or `<key>[idx]`,
    // not just an exact equality.
    const state = pendingState(['rules[0].condition.params.valuePct'])
    expect(helper('rules[0]: foo bar', null, state)).toBe(true)
    const state2 = pendingState(['position.sizing.value'])
    expect(helper('position: 10%', null, state2)).toBe(true)
  })

  it('returns false when message uses a prefix not present in any pending key (#1691 review m3)', () => {
    // No pending key has the `rulesMainflow.` namespace → message starting with that prefix
    // is no longer auto-treated as a clarification answer.
    const state = pendingState(['other.key'])
    expect(helper('rulesMainflow.foo bar', null, state)).toBe(false)
  })

  it('returns false for ordinary chat messages without pending clarification', () => {
    expect(helper('你好，请生成一个 BTC 策略', null, null)).toBe(false)
  })

  it('returns false for ordinary chat messages even with pending clarifications when no prefix matches', () => {
    const state = pendingState(['rulesMainflow.missing_entry_rules'])
    expect(helper('你好，请帮我生成策略', null, state)).toBe(false)
  })

  it('returns false for empty / whitespace-only messages with no answers', () => {
    expect(helper('   ', null, pendingState(['k']))).toBe(false)
    expect(helper('', null, pendingState(['k']))).toBe(false)
    expect(helper(null, null, pendingState(['k']))).toBe(false)
  })
})
