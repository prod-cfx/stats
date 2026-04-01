import { describe, expect, it } from '@jest/globals'

import { isRetryableTelegramDesktopError } from './telegram-callback-retry'

describe('isRetryableTelegramDesktopError', () => {
  it('应将 HTTP_429 识别为可重试错误', () => {
    expect(isRetryableTelegramDesktopError(new Error('HTTP_429'))).toBe(true)
  })

  it('应将 5xx 识别为可重试错误', () => {
    expect(isRetryableTelegramDesktopError(new Error('HTTP_500'))).toBe(true)
    expect(isRetryableTelegramDesktopError(new Error('HTTP_503'))).toBe(true)
  })

  it('应将 HTTP_401 识别为不可重试错误', () => {
    expect(isRetryableTelegramDesktopError(new Error('HTTP_401'))).toBe(false)
  })

  it('应将非 HTTP_<status> 形式错误识别为不可重试', () => {
    expect(isRetryableTelegramDesktopError(new Error('Network Error'))).toBe(false)
    expect(isRetryableTelegramDesktopError('HTTP_429')).toBe(false)
  })
})
