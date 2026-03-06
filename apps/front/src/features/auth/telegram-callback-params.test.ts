import { describe, expect, it } from '@jest/globals'

import { resolveTelegramCallbackPayload } from './telegram-callback-params'

describe('resolveTelegramCallbackPayload', () => {
  it('当 Telegram 参数出现在 hash 时，应该正确解析登录载荷', () => {
    const query = new URLSearchParams('source=web&intent=login')
    const hash = '#id=123456&auth_date=1735689600&hash=abcd1234&first_name=Alice&username=alice'

    const result = resolveTelegramCallbackPayload({ query, hash })

    expect(result.payload.telegramId).toBe('123456')
    expect(result.payload.authDate).toBe('1735689600')
    expect(result.payload.hash).toBe('abcd1234')
    expect(result.payload.firstName).toBe('Alice')
    expect(result.payload.username).toBe('alice')
    expect(result.payload.photoUrl).toBeUndefined()
    expect(result.source).toBe('web')
    expect(result.intent).toBe('login')
  })
})
