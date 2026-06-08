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

  const normalizedApiServerUrl = normalizePublicUrlEnv(apiServerUrl)
  if (!normalizedApiServerUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL or NEXT_PUBLIC_API_SERVER_URL is required')
  }

  return `${normalizedApiServerUrl}/api/v1`
}
