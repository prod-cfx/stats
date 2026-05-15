/**
 * Issue #1383 Lane A — Invariant：codegen-conversation.service.ts 不得再包含
 * 硬编码的 capability.domain === 'order_program' / capability.verb === 'maintain' /
 * 'schedule' / 'place' / 'rebalance' 等串判定。
 *
 * 这类判定必须由 SemanticExecutableSemanticsService 通过 ATOM_FULFILLS_STRATEGY_PHASE
 * 表派生；conversation service 内出现即视为退化，本不变量 fail-loud。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CONVERSATION_SERVICE_PATH = resolve(
  __dirname,
  '..',
  'codegen-conversation.service.ts',
)

describe('codegen-conversation.service.ts — no hardcoded capability judgement (Issue #1383)', () => {
  const source = readFileSync(CONVERSATION_SERVICE_PATH, 'utf8')

  it('does not test capability.domain === "order_program"', () => {
    const pattern = /capability\.domain\s*===\s*['"]order_program['"]/
    expect(pattern.test(source)).toBe(false)
  })

  it('does not test capability.verb against hardcoded order_program verbs', () => {
    const verbs = ['maintain', 'schedule', 'place', 'rebalance']
    for (const verb of verbs) {
      const pattern = new RegExp(`capability\\.verb\\s*===\\s*['"]${verb}['"]`)
      expect({ verb, hit: pattern.test(source) }).toEqual({ verb, hit: false })
    }
  })

  it('does not test capability.object === "dca_orders"', () => {
    const pattern = /capability\.object\s*===\s*['"]dca_orders['"]/
    expect(pattern.test(source)).toBe(false)
  })
})
