type QuantifyEnv = Record<string, string | undefined>

const SECRET_PLACEHOLDER = '__SET_IN_env.local__'
const E2E_DATABASE_OVERRIDE_KEY = 'QUANTIFY_E2E_DATABASE_URL'

const MAPPINGS = {
  QUANTIFY_PORT: 'PORT',
  QUANTIFY_DATABASE_URL: 'DATABASE_URL',
  QUANTIFY_REDIS_URL: 'REDIS_URL',
  QUANTIFY_APP_SECRET: 'APP_SECRET',
  QUANTIFY_JWT_SECRET: 'JWT_SECRET',
  QUANTIFY_UNIAPI_API_KEY: 'UNIAPI_API_KEY',
  QUANTIFY_EXCHANGE_ACCOUNT_CRYPTO_KEY: 'EXCHANGE_ACCOUNT_CRYPTO_KEY',
} as const

function normalizedValue(value: string | undefined): string | undefined {
  if (value == null) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed === '' || trimmed === SECRET_PLACEHOLDER ? undefined : trimmed
}

export function applyQuantifyEnvOverrides(env: QuantifyEnv = process.env): QuantifyEnv {
  for (const [sourceKey, targetKey] of Object.entries(MAPPINGS)) {
    const value = normalizedValue(env[sourceKey])
    if (value) {
      env[targetKey] = value
    }
  }

  const e2eDatabaseOverride = normalizedValue(env[E2E_DATABASE_OVERRIDE_KEY])
  if (e2eDatabaseOverride) {
    env.QUANTIFY_DATABASE_URL = e2eDatabaseOverride
    env.DATABASE_URL = e2eDatabaseOverride
  }

  return env
}
