import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { EntryRuleRequiresEventLeafException } from './entry-rule-requires-event-leaf.exception'

describe('entryRuleRequiresEventLeafException (#1457 闸 2 review round 1 C2)', () => {
  it('携带正确的 ErrorCode', () => {
    const exception = new EntryRuleRequiresEventLeafException({ leafKinds: ['GTE', 'GTE'] })
    expect(exception.code).toBe(ErrorCode.ENTRY_RULE_REQUIRES_EVENT_LEAF)
  })

  it('状态码为 BAD_REQUEST', () => {
    const exception = new EntryRuleRequiresEventLeafException({ leafKinds: ['GTE'] })
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST)
  })

  it('在 args 中携带 ruleId 与 leafKinds', () => {
    const exception = new EntryRuleRequiresEventLeafException({ ruleId: 'entry-1', leafKinds: ['GTE', 'LTE'] })
    expect(exception.args).toEqual({ ruleId: 'entry-1', leafKinds: ['GTE', 'LTE'] })
  })

  it('未传 ruleId 时 args.ruleId 落 null', () => {
    const exception = new EntryRuleRequiresEventLeafException({ leafKinds: ['EQ'] })
    expect(exception.args).toEqual({ ruleId: null, leafKinds: ['EQ'] })
  })

  it('错误消息含全部去重后的 leafKinds 与提示', () => {
    const exception = new EntryRuleRequiresEventLeafException({ leafKinds: ['GTE', 'GTE', 'LTE'] })
    expect(exception.message).toContain('GTE, LTE')
    expect(exception.message).toContain('cross_over')
  })

  it('显式 ruleId 时消息体含 rule id 提示', () => {
    const exception = new EntryRuleRequiresEventLeafException({ ruleId: 'entry-foo', leafKinds: ['GTE'] })
    expect(exception.message).toContain("'entry-foo'")
  })
})
