function normalizePublicUrlEnv(value?: string): string | undefined {
  const normalized = value?.trim()
  if (!normalized || normalized === '__SET_IN_env.local__') {
    return undefined
  }

  return normalized.replace(/\/$/, '')
}

export function resolveApiBaseUrl(
  backendApiBaseUrl?: string,
): string {
  const normalizedBackendApiBaseUrl = normalizePublicUrlEnv(backendApiBaseUrl)
  if (!normalizedBackendApiBaseUrl) {
    throw new Error('NEXT_PUBLIC_BACKEND_API_BASE_URL is required')
  }
  if (!normalizedBackendApiBaseUrl.endsWith('/api/v1')) {
    throw new Error('NEXT_PUBLIC_BACKEND_API_BASE_URL must include /api/v1')
  }

  return normalizedBackendApiBaseUrl
}
