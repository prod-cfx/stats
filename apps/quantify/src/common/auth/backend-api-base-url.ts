import type { EnvService } from '@/common/services/env.service'

const DEFAULT_BACKEND_API_BASE_URL = 'http://127.0.0.1:3000/api/v1'
const ENV_PLACEHOLDER_VALUE = '__SET_IN_env.local__'

type BackendApiBaseUrlEnv = Pick<EnvService, 'getString'>

function normalizeEnvUrl(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === ENV_PLACEHOLDER_VALUE) {
    return null
  }
  return trimmed.replace(/\/+$/, '')
}

function appendApiPrefix(baseUrl: string): string {
  if (baseUrl.endsWith('/api/v1')) {
    return baseUrl
  }
  return `${baseUrl}/api/v1`
}

export function resolveBackendApiBaseUrl(env: BackendApiBaseUrlEnv): string {
  const configuredApiUrl = normalizeEnvUrl(env.getString('BACKEND_API_BASE_URL'))
  if (configuredApiUrl) {
    return configuredApiUrl
  }

  const configuredServerUrl = normalizeEnvUrl(env.getString('NEXT_PUBLIC_API_SERVER_URL'))
  if (configuredServerUrl) {
    return appendApiPrefix(configuredServerUrl)
  }

  return DEFAULT_BACKEND_API_BASE_URL
}
