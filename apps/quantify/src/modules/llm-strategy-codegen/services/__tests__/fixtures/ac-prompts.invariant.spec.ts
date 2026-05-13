/**
 * Issue #1299 — AC-7 fixture utterance 不得含 webhook 关键字 invariant
 *
 * 来源：PR #1297 review critic B 历史遗留 H4。
 * `external.signal` atom keyword 集合含纯英文 `signal`。若 AC-7 fixture 加入
 * 含 "signal" 字面量的 utterance（如 "RSI signal 触发"），
 * dispatcher-evidence-invariant I3 spec 中"AC-7 prompt 全部 source='user_explicit'"
 * 断言会假阳性——因为该 prompt 会命中 external.signal atom 产 source='webhook'。
 *
 * 守门策略：在 fixture 同目录 spec 锁死 AC-7 utterance 不得含 webhook keyword 集合。
 *
 * Refs: #1299, #1279
 */
import { AC7_USER_PROMPTS } from './ac-prompts'

describe('issue #1299 — AC-7 fixture webhook keyword invariant', () => {
  it('AC-7 fixture 不得含 webhook keyword（webhook / signal / 信号）', () => {
    const webhookKws = ['webhook', 'signal', '信号']
    const violators = AC7_USER_PROMPTS.filter(p =>
      webhookKws.some(k => p.utterance.toLowerCase().includes(k)),
    )
    expect(violators).toEqual([])
  })
})
