const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { resolve } = require('node:path')

const { resolveQuantifyEnv } = require('../quantify-launcher.cjs')

// ---------------------------------------------------------------------------
// Helpers for process-level exit-code tests
// ---------------------------------------------------------------------------

const LAUNCHER = resolve(__dirname, '../quantify-launcher.cjs')

/** Minimal valid QUANTIFY_* env that passes resolveQuantifyEnv validation.
 *  DATABASE_URL is intentionally different to avoid the "must not equal" check.
 */
const VALID_QUANTIFY_ENV = {
  // Strip any inherited env that might load .env.* files and conflict
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  // Required quantify vars
  QUANTIFY_DATABASE_URL: 'postgresql://quant:pass@localhost:5432/quantify_test',
  QUANTIFY_REDIS_URL: 'redis://:redis@localhost:6379/1',
  QUANTIFY_APP_SECRET: 'test-app-secret',
  QUANTIFY_JWT_SECRET: 'test-jwt-secret',
  // Backend URL distinct from QUANTIFY_DATABASE_URL
  DATABASE_URL: 'postgresql://backend:pass@localhost:5432/backend_test',
  // Prevent launcher from reading any .env file (APP_ENV controls which file)
  APP_ENV: 'nonexistent-env-for-tests',
}

function runLauncher(childArgs) {
  return spawnSync(
    process.execPath,
    [LAUNCHER, ...childArgs],
    { env: VALID_QUANTIFY_ENV, timeout: 10_000 },
  )
}

// ---------------------------------------------------------------------------
// Process-level exit-code contract tests
// ---------------------------------------------------------------------------

test('launcher passes through exit code 0 from child', () => {
  const result = runLauncher([process.execPath, '-e', 'process.exit(0)'])
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}`)
})

test('launcher passes through non-zero exit code from child (exit 7)', () => {
  const result = runLauncher([process.execPath, '-e', 'process.exit(7)'])
  assert.equal(
    result.status,
    7,
    `exit code was not passed through: expected 7, got ${result.status}. ` +
    'This means the wrapper swallowed the child exit code.',
  )
})

test('launcher exits non-zero when child is killed by signal', () => {
  // Child kills itself with SIGTERM; launcher should exit non-zero (not 0)
  const result = runLauncher([
    process.execPath,
    '-e',
    "process.kill(process.pid, 'SIGTERM')",
  ])
  const exitedNonZero = result.status !== 0 || result.signal != null
  assert.ok(
    exitedNonZero,
    `launcher returned exit 0 for a signal-killed child — exit code swallowed`,
  )
})

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
