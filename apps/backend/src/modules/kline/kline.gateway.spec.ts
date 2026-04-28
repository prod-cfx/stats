import { parseAllowedOrigins } from './kline.gateway'

describe('KlineGateway allowed origins', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }

    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins
    }
  })

  it('accepts production coinflux.ai origins from ALLOWED_ORIGINS', () => {
    process.env.NODE_ENV = 'production'
    process.env.ALLOWED_ORIGINS = 'https://www.coinflux.ai,https://admin.coinflux.ai'

    expect(parseAllowedOrigins()).toEqual([
      'https://www.coinflux.ai',
      'https://admin.coinflux.ai',
    ])
  })

  it('drops non-https production origins', () => {
    process.env.NODE_ENV = 'production'
    process.env.ALLOWED_ORIGINS = 'http://www.coinflux.ai,https://admin.coinflux.ai'

    expect(parseAllowedOrigins()).toEqual(['https://admin.coinflux.ai'])
  })
})
