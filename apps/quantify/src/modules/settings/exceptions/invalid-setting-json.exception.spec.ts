import { ErrorCode } from '@ai/shared'
import { InvalidSettingJsonException } from './invalid-setting-json.exception'

describe('invalidSettingJsonException', () => {
  it('should create exception with correct error code and args', () => {
    const key = 'payment.config'
    const error = 'Unexpected token'

    const exception = new InvalidSettingJsonException({ key, error })

    expect(exception.code).toBe(ErrorCode.SETTINGS_INVALID_JSON)
    expect(exception.args).toEqual({ key, error })
    expect(exception.getStatus()).toBe(400)
  })

  it('should have correct error message format', () => {
    const exception = new InvalidSettingJsonException({ key: 'test.key', error: 'parse error' })

    expect(exception.message).toBe('Invalid JSON for setting')
  })
})
