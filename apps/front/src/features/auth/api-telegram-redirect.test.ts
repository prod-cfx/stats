import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { createTelegramDesktopIntentRequest, getTelegramWebAuthorizeUrlRequest } from './api'

describe('auth api telegram redirect passthrough', () => {
  const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch

  afterEach(() => {
    jest.restoreAllMocks()
    if (originalFetch) {
      ;(globalThis as { fetch?: typeof fetch }).fetch = originalFetch
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch
    }
  })

  it('getTelegramWebAuthorizeUrlRequest should include redirect query when provided', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { authorizeUrl: 'https://oauth.telegram.org/auth?x=1' } }),
    } as Response)
    ;(globalThis as { fetch?: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch

    await getTelegramWebAuthorizeUrlRequest({
      intent: 'login',
      lng: 'zh',
      redirect: '/zh/ai-quant',
    })

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '')
    expect(calledUrl).toContain('/auth/telegram/web/authorize-url?')
    expect(calledUrl).toContain('intent=login')
    expect(calledUrl).toContain('lng=zh')
    expect(calledUrl).toContain('redirect=%2Fzh%2Fai-quant')
  })

  it('getTelegramWebAuthorizeUrlRequest should not include redirect query when absent', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { authorizeUrl: 'https://oauth.telegram.org/auth?x=1' } }),
    } as Response)
    ;(globalThis as { fetch?: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch

    await getTelegramWebAuthorizeUrlRequest({
      intent: 'bind',
      lng: 'en',
    })

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '')
    expect(calledUrl).toContain('intent=bind')
    expect(calledUrl).toContain('lng=en')
    expect(calledUrl).not.toContain('redirect=')
  })

  it('createTelegramDesktopIntentRequest should include redirect in request body when provided', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          intentId: 'intent-1',
          deepLink: 'tg://resolve?domain=bot&start=s1',
          webLink: 'https://t.me/bot?start=s1',
          callbackUrl: 'http://localhost:3001/zh/auth/telegram/callback',
          expiresInSeconds: 300,
        },
      }),
    } as Response)
    ;(globalThis as { fetch?: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch

    await createTelegramDesktopIntentRequest({
      intent: 'login',
      lng: 'zh',
      redirect: '/zh/ai-quant',
    })

    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(requestInit.method).toBe('POST')
    expect(requestInit.body).toContain('"redirect":"/zh/ai-quant"')
  })
})
