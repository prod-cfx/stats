import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { SizingEvidenceMissingException } from './sizing-evidence-missing.exception'

describe('SizingEvidenceMissingException (#1230)', () => {
  it('should have correct error code', () => {
    const exception = new SizingEvidenceMissingException({ ruleId: 'entry_long', actionType: 'OPEN_LONG' })
    expect(exception.code).toBe(ErrorCode.SIZING_EVIDENCE_MISSING)
  })

  it('should have UNPROCESSABLE_ENTITY status', () => {
    const exception = new SizingEvidenceMissingException({ ruleId: 'entry_long', actionType: 'OPEN_LONG' })
    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
  })

  it('should carry ruleId and actionType in args', () => {
    const exception = new SizingEvidenceMissingException({ ruleId: 'rule-abc', actionType: 'OPEN_SHORT' })
    expect(exception.args).toEqual({ ruleId: 'rule-abc', actionType: 'OPEN_SHORT' })
  })

  it('should produce a stable message', () => {
    const exception = new SizingEvidenceMissingException({ ruleId: 'entry_long', actionType: 'ADD_LONG' })
    expect(exception.message).toContain('sizing evidence missing')
  })
})
