import { restoreProcessEnv, snapshotProcessEnv } from '../common/env/env.accessor'
import { jwtConfig } from './configuration'

const JWT_ENV_KEYS = [
  'APP_ENV',
  'NODE_ENV',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'JWT_ACCESS_EXPIRATION',
] as const

describe('jwtConfig', () => {
  let snapshot: Record<string, string | undefined>

  beforeEach(() => {
    snapshot = snapshotProcessEnv(JWT_ENV_KEYS)
    for (const key of JWT_ENV_KEYS) {
      delete process.env[key]
    }
    process.env.APP_ENV = 'development'
    process.env.JWT_SECRET = 'test-secret'
  })

  afterEach(() => {
    restoreProcessEnv(snapshot)
  })

  it('uses short access-token and seven-day refresh-token defaults', () => {
    const config = jwtConfig()

    expect(config.accessExpiresIn).toBe('30m')
    expect(config.refreshExpiresIn).toBe('7d')
    expect(config.expiresIn).toBe('30m')
    expect(config.accessExpiration).toBe(30 * 60)
  })

  it('keeps JWT_EXPIRES_IN as access-token compatibility fallback', () => {
    process.env.JWT_EXPIRES_IN = '45m'

    const config = jwtConfig()

    expect(config.accessExpiresIn).toBe('45m')
    expect(config.expiresIn).toBe('45m')
    expect(config.refreshExpiresIn).toBe('7d')
  })
})
