type QuantifyEnv = Record<string, string | undefined>

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
  return trimmed === '' ? undefined : trimmed
}

export function applyQuantifyEnvOverrides(env: QuantifyEnv = process.env): QuantifyEnv {
  for (const [sourceKey, targetKey] of Object.entries(MAPPINGS)) {
    const value = normalizedValue(env[sourceKey])
    if (value) {
      env[targetKey] = value
    }
  }

  return env
}
