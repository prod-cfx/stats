import type { EnvService } from '@/common/services/env.service'

const ENV_PLACEHOLDER_VALUE = '__SET_IN_env.local__'

type BackendApiBaseUrlEnv = Pick<EnvService, 'getString'>

function normalizeEnvUrl(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === ENV_PLACEHOLDER_VALUE) {
    return null
  }
  return trimmed.replace(/\/+$/, '')
}

export function resolveBackendApiBaseUrl(env: BackendApiBaseUrlEnv): string {
  const configuredApiUrl = normalizeEnvUrl(env.getString('BACKEND_API_BASE_URL'))
  if (configuredApiUrl) {
    if (!configuredApiUrl.endsWith('/api/v1')) {
      throw new Error('BACKEND_API_BASE_URL must include /api/v1')
    }
    return configuredApiUrl
  }

  throw new Error('BACKEND_API_BASE_URL is required')
}
