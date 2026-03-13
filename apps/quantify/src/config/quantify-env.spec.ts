import { applyQuantifyEnvOverrides } from './quantify-env'

describe('applyQuantifyEnvOverrides', () => {
  it('prefers quantify-scoped values over shared runtime keys', () => {
    const env = {
      PORT: '3000',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ai_dev',
      REDIS_URL: 'redis://:redis@localhost:6379/0',
      APP_SECRET: 'backend-secret',
      JWT_SECRET: 'backend-jwt',
      QUANTIFY_PORT: '3010',
      QUANTIFY_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/quantify_dev',
      QUANTIFY_REDIS_URL: 'redis://:redis@localhost:6379/1',
      QUANTIFY_APP_SECRET: 'quantify-secret',
      QUANTIFY_JWT_SECRET: 'quantify-jwt',
    }

    applyQuantifyEnvOverrides(env)

    expect(env.PORT).toBe('3010')
    expect(env.DATABASE_URL).toBe('postgresql://postgres:postgres@localhost:5432/quantify_dev')
    expect(env.REDIS_URL).toBe('redis://:redis@localhost:6379/1')
    expect(env.APP_SECRET).toBe('quantify-secret')
    expect(env.JWT_SECRET).toBe('quantify-jwt')
  })

  it('ignores blank quantify values', () => {
    const env = {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ai_dev',
      QUANTIFY_DATABASE_URL: '   ',
    }

    applyQuantifyEnvOverrides(env)

    expect(env.DATABASE_URL).toBe('postgresql://postgres:postgres@localhost:5432/ai_dev')
  })
})
