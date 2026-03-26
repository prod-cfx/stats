const test = require('node:test')
const assert = require('node:assert/strict')

const { resolveQuantifyEnv } = require('../quantify-launcher.cjs')

test('maps QUANTIFY_DATABASE_URL to DATABASE_URL', () => {
  const env = resolveQuantifyEnv({
    QUANTIFY_DATABASE_URL: 'postgresql://quant:pass@localhost:5432/quantify',
    QUANTIFY_REDIS_URL: 'redis://:redis@localhost:6379/1',
    QUANTIFY_APP_SECRET: 'app-secret',
    QUANTIFY_JWT_SECRET: 'jwt-secret',
  })

  assert.equal(env.DATABASE_URL, 'postgresql://quant:pass@localhost:5432/quantify')
})

test('does not let blank QUANTIFY_PORT override PORT', () => {
  const env = resolveQuantifyEnv({
    PORT: '3000',
    QUANTIFY_PORT: '   ',
    QUANTIFY_DATABASE_URL: 'postgresql://quant:pass@localhost:5432/quantify',
    QUANTIFY_REDIS_URL: 'redis://:redis@localhost:6379/1',
    QUANTIFY_APP_SECRET: 'app-secret',
    QUANTIFY_JWT_SECRET: 'jwt-secret',
  })

  assert.equal(env.PORT, '3000')
})

test('fails when QUANTIFY_DATABASE_URL equals DATABASE_URL', () => {
  assert.throws(
    () =>
      resolveQuantifyEnv({
        DATABASE_URL: 'postgresql://shared:pass@localhost:5432/shared',
        QUANTIFY_DATABASE_URL: 'postgresql://shared:pass@localhost:5432/shared',
        QUANTIFY_REDIS_URL: 'redis://:redis@localhost:6379/1',
        QUANTIFY_APP_SECRET: 'app-secret',
        QUANTIFY_JWT_SECRET: 'jwt-secret',
      }),
    /quantify database must not equal backend database/,
  )
})

test('fails when QUANTIFY_REDIS_URL is missing', () => {
  assert.throws(
    () =>
      resolveQuantifyEnv({
        QUANTIFY_DATABASE_URL: 'postgresql://quant:pass@localhost:5432/quantify',
        QUANTIFY_APP_SECRET: 'app-secret',
        QUANTIFY_JWT_SECRET: 'jwt-secret',
      }),
    /quantify redis url is required/,
  )
})

test('fails when QUANTIFY_DATABASE_URL is not postgres', () => {
  assert.throws(
    () =>
      resolveQuantifyEnv({
        QUANTIFY_DATABASE_URL: 'mysql://bad',
        QUANTIFY_REDIS_URL: 'redis://:redis@localhost:6379/1',
        QUANTIFY_APP_SECRET: 'app-secret',
        QUANTIFY_JWT_SECRET: 'jwt-secret',
      }),
    /quantify database url must be postgres/,
  )
})

test('fails when QUANTIFY_REDIS_URL is not redis', () => {
  assert.throws(
    () =>
      resolveQuantifyEnv({
        QUANTIFY_DATABASE_URL: 'postgresql://quant:pass@localhost:5432/quantify',
        QUANTIFY_REDIS_URL: 'http://bad',
        QUANTIFY_APP_SECRET: 'app-secret',
        QUANTIFY_JWT_SECRET: 'jwt-secret',
      }),
    /quantify redis url must be redis/,
  )
})

test('fails when QUANTIFY_PORT is invalid', () => {
  assert.throws(
    () =>
      resolveQuantifyEnv({
        QUANTIFY_PORT: '99999',
        QUANTIFY_DATABASE_URL: 'postgresql://quant:pass@localhost:5432/quantify',
        QUANTIFY_REDIS_URL: 'redis://:redis@localhost:6379/1',
        QUANTIFY_APP_SECRET: 'app-secret',
        QUANTIFY_JWT_SECRET: 'jwt-secret',
      }),
    /quantify port must be a valid tcp port/,
  )
})

test('fails when QUANTIFY_APP_SECRET is missing', () => {
  assert.throws(
    () =>
      resolveQuantifyEnv({
        QUANTIFY_DATABASE_URL: 'postgresql://quant:pass@localhost:5432/quantify',
        QUANTIFY_REDIS_URL: 'redis://:redis@localhost:6379/1',
        QUANTIFY_JWT_SECRET: 'jwt-secret',
      }),
    /APP_SECRET is required for quantify/,
  )
})

test('fails when QUANTIFY_JWT_SECRET is missing', () => {
  assert.throws(
    () =>
      resolveQuantifyEnv({
        QUANTIFY_DATABASE_URL: 'postgresql://quant:pass@localhost:5432/quantify',
        QUANTIFY_REDIS_URL: 'redis://:redis@localhost:6379/1',
        QUANTIFY_APP_SECRET: 'app-secret',
      }),
    /JWT_SECRET is required for quantify/,
  )
})

test('preserves extra QUANTIFY_* keys for quantify runtime flags', () => {
  const env = resolveQuantifyEnv({
    QUANTIFY_DATABASE_URL: 'postgresql://quant:pass@localhost:5432/quantify',
    QUANTIFY_REDIS_URL: 'redis://:redis@localhost:6379/1',
    QUANTIFY_APP_SECRET: 'app-secret',
    QUANTIFY_JWT_SECRET: 'jwt-secret',
    QUANTIFY_RUNTIME_PROFILE: 'paper-trading',
  })

  assert.equal(env.QUANTIFY_RUNTIME_PROFILE, 'paper-trading')
})
