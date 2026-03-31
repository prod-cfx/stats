function normalizePublicUrlEnv(value?: string): string | undefined {
  const normalized = value?.trim()
  if (!normalized || normalized === '__SET_IN_env.local__') {
    return undefined
  }

  return normalized.replace(/\/$/, '')
}

export function resolveApiBaseUrl(
  explicitApiBaseUrl?: string,
  apiServerUrl?: string,
): string {
  const normalizedApiBaseUrl = normalizePublicUrlEnv(explicitApiBaseUrl)
  if (normalizedApiBaseUrl) {
    return normalizedApiBaseUrl
  }

  const normalizedApiServerUrl = normalizePublicUrlEnv(apiServerUrl) ?? 'http://localhost:3000'
  return `${normalizedApiServerUrl}/api/v1`
}
