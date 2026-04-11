import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockClient = {
  AuthController_createTelegramDesktopIntent: jest.fn(),
  AuthController_getTelegramWebAuthorizeUrl: jest.fn(),
  AuthController_sendEmailLoginCode: jest.fn(),
}

jest.mock('@/lib/api-client', () => ({
  client: mockClient,
  unwrapApiResponse: (response: unknown) => {
    if (response && typeof response === 'object' && 'data' in response) {
      return (response as { data: unknown }).data
    }
    return response
  },
}))

describe('auth api telegram redirect passthrough', () => {
  beforeEach(() => {
    jest.resetModules()
    mockClient.AuthController_createTelegramDesktopIntent.mockReset()
    mockClient.AuthController_getTelegramWebAuthorizeUrl.mockReset()
    mockClient.AuthController_sendEmailLoginCode.mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('getTelegramWebAuthorizeUrlRequest should include redirect query when provided', async () => {
    mockClient.AuthController_getTelegramWebAuthorizeUrl.mockResolvedValue({
      data: { authorizeUrl: 'https://oauth.telegram.org/auth?x=1' },
    })

    const { getTelegramWebAuthorizeUrlRequest } = await import('./api')
    await getTelegramWebAuthorizeUrlRequest({
      intent: 'login',
      lng: 'zh',
      redirect: '/zh/ai-quant',
    })

    expect(mockClient.AuthController_getTelegramWebAuthorizeUrl).toHaveBeenCalledWith({
      queries: {
        intent: 'login',
        lng: 'zh',
        redirect: '/zh/ai-quant',
      },
    })
  })

  it('getTelegramWebAuthorizeUrlRequest should not include redirect query when absent', async () => {
    mockClient.AuthController_getTelegramWebAuthorizeUrl.mockResolvedValue({
      data: { authorizeUrl: 'https://oauth.telegram.org/auth?x=1' },
    })

    const { getTelegramWebAuthorizeUrlRequest } = await import('./api')
    await getTelegramWebAuthorizeUrlRequest({
      intent: 'bind',
      lng: 'en',
    })

    expect(mockClient.AuthController_getTelegramWebAuthorizeUrl).toHaveBeenCalledWith({
      queries: {
        intent: 'bind',
        lng: 'en',
      },
    })
  })

  it('createTelegramDesktopIntentRequest should include redirect in request body when provided', async () => {
    mockClient.AuthController_createTelegramDesktopIntent.mockResolvedValue({
      data: {
        intentId: 'intent-1',
        deepLink: 'tg://resolve?domain=bot&start=s1',
        webLink: 'https://t.me/bot?start=s1',
        callbackUrl: 'http://localhost:3001/zh/auth/telegram/callback',
        expiresInSeconds: 300,
      },
    })

    const { createTelegramDesktopIntentRequest } = await import('./api')
    await createTelegramDesktopIntentRequest({
      intent: 'login',
      lng: 'zh',
      redirect: '/zh/ai-quant',
    })

    expect(mockClient.AuthController_createTelegramDesktopIntent).toHaveBeenCalledWith({
      intent: 'login',
      lng: 'zh',
      redirect: '/zh/ai-quant',
    })
  })

  it('sendEmailCodeRequest keeps dev fallback behavior for 5xx responses', async () => {
    mockClient.AuthController_sendEmailLoginCode.mockRejectedValue({
      response: {
        status: 503,
        data: {},
      },
    })

    const { sendEmailCodeRequest } = await import('./api')
    await expect(sendEmailCodeRequest('dev@example.com')).rejects.toThrow('DEV_EMAIL_FALLBACK_CODE_123456')
  })
})
