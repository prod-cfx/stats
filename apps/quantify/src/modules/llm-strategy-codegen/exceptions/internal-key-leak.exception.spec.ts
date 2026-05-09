import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { InternalKeyLeakDetectedException } from './internal-key-leak.exception'

describe('InternalKeyLeakDetectedException', () => {
  it('should have correct error code', () => {
    const exception = new InternalKeyLeakDetectedException({ key: 'risk.atr_take_profit' })
    expect(exception.code).toBe(ErrorCode.INTERNAL_KEY_LEAK_DETECTED)
  })

  it('should have INTERNAL_SERVER_ERROR status', () => {
    const exception = new InternalKeyLeakDetectedException({ key: 'some.key' })
    expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
  })

  it('should carry args with key and details', () => {
    const exception = new InternalKeyLeakDetectedException({
      key: 'some.key',
      details: 'semantic_presentation_internal_key_leak:some.key',
    })
    expect(exception.args).toEqual({
      key: 'some.key',
      details: 'semantic_presentation_internal_key_leak:some.key',
    })
  })

  it('preserves legacy raw error message format for backward compatibility', () => {
    // 历史 raw `throw new Error('semantic_presentation_internal_key_leak:<key>')` 的格式必须保留，
    // 避免破坏现存 string-match 测试与调用方。
    const exception = new InternalKeyLeakDetectedException({ key: 'condition.expression' })
    expect(exception.message).toBe('semantic_presentation_internal_key_leak:condition.expression')
  })
})
