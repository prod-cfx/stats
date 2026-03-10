import { describe, expect, it } from '@jest/globals'

import { resolveTelegramCallbackPayload } from './telegram-callback-params'

function encodeBase64(data: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64')
}

function encodeBase64Url(data: Record<string, string | number>): string {
  return encodeBase64(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

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

  it('应解析 hash 中 tgAuthResult(base64) 里的 Telegram 载荷', () => {
    const query = new URLSearchParams('source=web')
    const tgAuthResult = encodeBase64({
      id: '111',
      auth_date: '1735689600',
      hash: 'h111',
      first_name: 'Alice',
      last_name: 'W',
      username: 'alice_w',
      photo_url: 'https://img.example/a.png',
    })

    const result = resolveTelegramCallbackPayload({ query, hash: `#tgAuthResult=${encodeURIComponent(tgAuthResult)}` })

    expect(result.payload.telegramId).toBe('111')
    expect(result.payload.authDate).toBe('1735689600')
    expect(result.payload.hash).toBe('h111')
    expect(result.payload.firstName).toBe('Alice')
    expect(result.payload.lastName).toBe('W')
    expect(result.payload.username).toBe('alice_w')
    expect(result.payload.photoUrl).toBe('https://img.example/a.png')
  })

  it('应解析 hash 中 tgAuthResult(base64url) 里的 Telegram 载荷', () => {
    const query = new URLSearchParams('source=web')
    const tgAuthResult = encodeBase64Url({
      id: '222',
      auth_date: '1735689601',
      hash: 'h222',
      first_name: 'Bob',
    })

    const result = resolveTelegramCallbackPayload({ query, hash: `#tgAuthResult=${tgAuthResult}` })

    expect(result.payload.telegramId).toBe('222')
    expect(result.payload.authDate).toBe('1735689601')
    expect(result.payload.hash).toBe('h222')
    expect(result.payload.firstName).toBe('Bob')
  })

  it('当 tgAuthResult 为未编码 base64 且包含 + 时应正确解析', () => {
    const query = new URLSearchParams('source=web')
    const basePayload = {
      id: '1110614274',
      auth_date: '1773023842',
      hash: '6890a4de1b3b8c73e1e1bdf37c60dc526a40be0d85fd696bdc44245e5a8595b8',
      first_name: 'lisa',
      username: 'TON_future_value',
      photo_url: 'https://t.me/i/userpic/320/rpXAUQCKHrDxOxrBFC9lJtoyq2x9facWNc4LxslyOGM.jpg',
    }
    const tgAuthResult = encodeBase64({ ...basePayload, nonce: '>' })
    expect(tgAuthResult.includes('+')).toBe(true)

    const result = resolveTelegramCallbackPayload({ query, hash: `#tgAuthResult=${tgAuthResult}` })

    expect(result.payload.telegramId).toBe('1110614274')
    expect(result.payload.authDate).toBe('1773023842')
    expect(result.payload.hash).toBe('6890a4de1b3b8c73e1e1bdf37c60dc526a40be0d85fd696bdc44245e5a8595b8')
    expect(result.payload.firstName).toBe('lisa')
    expect(result.payload.username).toBe('TON_future_value')
    expect(result.payload.photoUrl).toContain('https://t.me/i/userpic')
  })

  it('应将 tgAuthResult 中 number 类型的 id/auth_date 转成字符串', () => {
    const query = new URLSearchParams('source=web')
    const tgAuthResult = encodeBase64({
      id: 987654321,
      auth_date: 1735689602,
      hash: 'h333',
      first_name: 'NumUser',
    })

    const result = resolveTelegramCallbackPayload({ query, hash: `#tgAuthResult=${encodeURIComponent(tgAuthResult)}` })

    expect(result.payload.telegramId).toBe('987654321')
    expect(result.payload.authDate).toBe('1735689602')
    expect(result.payload.hash).toBe('h333')
    expect(result.payload.firstName).toBe('NumUser')
  })

  it('当 tgAuthResult 非法时不应抛异常并回退到已有参数', () => {
    const query = new URLSearchParams('source=web')

    expect(() =>
      resolveTelegramCallbackPayload({
        query,
        hash: '#id=999&hash=hh&tgAuthResult=not-a-valid-payload',
      }),
    ).not.toThrow()

    const result = resolveTelegramCallbackPayload({
      query,
      hash: '#id=999&hash=hh&tgAuthResult=not-a-valid-payload',
    })

    expect(result.payload.telegramId).toBe('999')
    expect(result.payload.hash).toBe('hh')
  })

  it('字段优先级保持 query > hash kv > tgAuthResult', () => {
    const query = new URLSearchParams('id=333&auth_date=1735689700&hash=qh')
    const tgAuthResult = encodeBase64({
      id: '111',
      auth_date: '1735689600',
      hash: 'tgh',
      first_name: 'FromTg',
    })

    const result = resolveTelegramCallbackPayload({
      query,
      hash: `#id=222&first_name=FromHash&tgAuthResult=${encodeURIComponent(tgAuthResult)}`,
    })

    expect(result.payload.telegramId).toBe('333')
    expect(result.payload.authDate).toBe('1735689700')
    expect(result.payload.hash).toBe('qh')
    expect(result.payload.firstName).toBe('FromHash')
  })

  it('应保留合法站内 redirect 路径', () => {
    const query = new URLSearchParams('source=web&intent=login&redirect=/zh/ai-quant')

    const result = resolveTelegramCallbackPayload({ query, hash: '#id=1&auth_date=2&hash=3', lng: 'zh' })

    expect(result.redirect).toBe('/zh/ai-quant')
  })

  it('当 redirect 为外链时应回退到账户页', () => {
    const query = new URLSearchParams('source=web&intent=login&redirect=https://evil.com')

    const result = resolveTelegramCallbackPayload({ query, hash: '#id=1&auth_date=2&hash=3', lng: 'zh' })

    expect(result.redirect).toBe('/zh/account')
  })

  it('当 redirect 为协议相对路径时应回退到账户页', () => {
    const query = new URLSearchParams('source=web&intent=login&redirect=//evil.com')

    const result = resolveTelegramCallbackPayload({ query, hash: '#id=1&auth_date=2&hash=3', lng: 'zh' })

    expect(result.redirect).toBe('/zh/account')
  })
})
