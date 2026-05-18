import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { ExecutionModelFieldUnsourcedException } from './execution-model-field-unsourced.exception'

describe('executionModelFieldUnsourcedException (#1459 闸 4)', () => {
  it('携带正确的 ErrorCode', () => {
    const exception = new ExecutionModelFieldUnsourcedException({ field: 'symbol', reason: 'missing' })
    expect(exception.code).toBe(ErrorCode.EXECUTION_MODEL_FIELD_UNSOURCED)
  })

  it('状态码为 BAD_REQUEST', () => {
    const exception = new ExecutionModelFieldUnsourcedException({ field: 'venue', reason: 'missing' })
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST)
  })

  it('reason=missing 时 args.actualSource 为 null', () => {
    const exception = new ExecutionModelFieldUnsourcedException({ field: 'symbol', reason: 'missing' })
    expect(exception.args).toEqual({ field: 'symbol', reason: 'missing', actualSource: null })
  })

  it('reason=inferred 时 args 含 actualSource', () => {
    const exception = new ExecutionModelFieldUnsourcedException({
      field: 'venue',
      reason: 'inferred',
      actualSource: 'inferred',
    })
    expect(exception.args).toEqual({ field: 'venue', reason: 'inferred', actualSource: 'inferred' })
    expect(exception.message).toContain('source=inferred')
  })

  it('支持 primaryTimeframe / instrumentType 字段', () => {
    const tf = new ExecutionModelFieldUnsourcedException({ field: 'primaryTimeframe', reason: 'missing' })
    const inst = new ExecutionModelFieldUnsourcedException({ field: 'instrumentType', reason: 'missing' })
    expect(tf.message).toContain('primaryTimeframe')
    expect(inst.message).toContain('instrumentType')
  })
})
