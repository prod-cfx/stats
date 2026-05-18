import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { ExecutionModelSymbolMalformedException } from './execution-model-symbol-malformed.exception'

describe('executionModelSymbolMalformedException (#1459 闸 4)', () => {
  it('携带正确的 ErrorCode', () => {
    const exception = new ExecutionModelSymbolMalformedException({ symbol: '', reason: 'empty' })
    expect(exception.code).toBe(ErrorCode.EXECUTION_MODEL_SYMBOL_MALFORMED)
  })

  it('状态码为 BAD_REQUEST', () => {
    const exception = new ExecutionModelSymbolMalformedException({ symbol: 'X', reason: 'illegal_chars' })
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST)
  })

  it('携带 symbol 与 reason 到 args', () => {
    const exception = new ExecutionModelSymbolMalformedException({
      symbol: 'BTCUSDTUSDT',
      reason: 'duplicated_quote',
    })
    expect(exception.args).toEqual({ symbol: 'BTCUSDTUSDT', reason: 'duplicated_quote' })
    expect(exception.message).toContain('BTCUSDTUSDT')
    expect(exception.message).toContain('duplicated_quote')
  })

  it('reason 集合覆盖 empty / too_long / illegal_chars / duplicated_quote', () => {
    const reasons: Array<'empty' | 'too_long' | 'illegal_chars' | 'duplicated_quote'> = [
      'empty', 'too_long', 'illegal_chars', 'duplicated_quote',
    ]
    for (const reason of reasons) {
      const exception = new ExecutionModelSymbolMalformedException({ symbol: 'X', reason })
      expect(exception.args.reason).toBe(reason)
    }
  })
})
