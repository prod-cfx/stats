import { parseAllowedOrigins } from './kline.gateway'

describe('KlineGateway allowed origins', () => {
  const originalAppEnv = process.env.APP_ENV
  const originalNodeEnv = process.env.NODE_ENV
  const originalFrontendRedirectOrigins = process.env.FRONTEND_REDIRECT_ORIGINS
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS

  afterEach(() => {
    if (originalAppEnv === undefined) {
      delete process.env.APP_ENV
    } else {
      process.env.APP_ENV = originalAppEnv
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }

    if (originalFrontendRedirectOrigins === undefined) {
      delete process.env.FRONTEND_REDIRECT_ORIGINS
    } else {
      process.env.FRONTEND_REDIRECT_ORIGINS = originalFrontendRedirectOrigins
    }

    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins
    }
  })

  it('accepts production coinflux.ai origins from ALLOWED_ORIGINS', () => {
    process.env.APP_ENV = 'production'
    process.env.FRONTEND_REDIRECT_ORIGINS = 'https://www.coinflux.ai'
    process.env.ALLOWED_ORIGINS = 'https://admin.coinflux.ai'

    expect(parseAllowedOrigins()).toEqual([
      'https://www.coinflux.ai',
      'https://admin.coinflux.ai',
    ])
  })

  it('drops non-https production origins', () => {
    process.env.APP_ENV = 'production'
    process.env.FRONTEND_REDIRECT_ORIGINS = ''
    process.env.ALLOWED_ORIGINS = 'http://www.coinflux.ai,https://admin.coinflux.ai'

    expect(parseAllowedOrigins()).toEqual(['https://admin.coinflux.ai'])
  })

  it('falls back to front and admin production origins together', () => {
    process.env.APP_ENV = 'production'
    process.env.FRONTEND_REDIRECT_ORIGINS = ''
    process.env.ALLOWED_ORIGINS = ''

    expect(parseAllowedOrigins()).toEqual([
      'https://www.coinflux.ai',
      'https://admin.coinflux.ai',
    ])
  })

  it('treats APP_ENV production as production even when NODE_ENV is absent', () => {
    process.env.APP_ENV = 'production'
    delete process.env.NODE_ENV
    process.env.FRONTEND_REDIRECT_ORIGINS = ''
    process.env.ALLOWED_ORIGINS = 'http://localhost:3001'

    expect(parseAllowedOrigins()).toEqual([
      'https://www.coinflux.ai',
      'https://admin.coinflux.ai',
    ])
  })
})
