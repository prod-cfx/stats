import { ErrorCode } from '@ai/shared'
import {
  InvalidSettingTypeException,
  JsonExpectedObjectOrArrayException,
} from './invalid-setting-type.exception'

describe('invalidSettingTypeException', () => {
  it('should create exception with correct error code and args', () => {
    const key = 'site.config'
    const expectedType = 'string'
    const actualType = 'number'

    const exception = new InvalidSettingTypeException({ key, expectedType, actualType })

    expect(exception.code).toBe(ErrorCode.SETTINGS_TYPE_MISMATCH)
    expect(exception.args).toEqual({ key, expectedType, actualType })
    expect(exception.getStatus()).toBe(400)
  })

  it('should have correct error message format', () => {
    const exception = new InvalidSettingTypeException({ key: 'test.key', expectedType: 'boolean', actualType: 'string' })

    expect(exception.message).toBe('Setting type mismatch')
  })
})

describe('jsonExpectedObjectOrArrayException', () => {
  it('should create exception with correct error code and args', () => {
    const key = 'json.config'
    const actualType = 'string'

    const exception = new JsonExpectedObjectOrArrayException({ key, actualType })

    expect(exception.code).toBe(ErrorCode.SETTINGS_JSON_EXPECTED_OBJECT_OR_ARRAY)
    expect(exception.args).toEqual({ key, actualType })
    expect(exception.getStatus()).toBe(400)
  })

  it('should have correct error message format', () => {
    const exception = new JsonExpectedObjectOrArrayException({ key: 'test.json', actualType: 'number' })

    expect(exception.message).toBe('Setting expected JSON object or array')
  })
})
