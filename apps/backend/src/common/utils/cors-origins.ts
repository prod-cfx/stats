import type { AppEnv } from '../env/env.accessor'

function normalizeOrigins(origins: string[]): string[] {
  return origins
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0)
}

function deriveAdminOrigin(origin: string): string | undefined {
  if (!origin.includes('://cfx-www-')) {
    return undefined
  }

  return origin.replace('://cfx-www-', '://cfx-admin-')
}

export function buildCorsOrigins(
  frontendRedirectOrigins: string[] = [],
  allowedOrigins: string[] = [],
): string[] {
  const normalizedOrigins = [...normalizeOrigins(frontendRedirectOrigins), ...normalizeOrigins(allowedOrigins)]
  const derivedAdminOrigins = normalizedOrigins
    .map(origin => deriveAdminOrigin(origin))
    .filter((origin): origin is string => Boolean(origin))

  return [...new Set([...normalizedOrigins, ...derivedAdminOrigins])]
}

export function isValidCorsOrigin(origin: string | undefined, appEnv: AppEnv): boolean {
  if (!origin) {
    return false
  }

  try {
    const url = new URL(origin)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false
    }
    if (appEnv === 'production' && url.protocol !== 'https:') {
      return false
    }
    return true
  } catch {
    return false
  }
}

export function buildValidatedCorsOrigins(
  frontendRedirectOrigins: string[] = [],
  allowedOrigins: string[] = [],
  appEnv: AppEnv = 'development',
  fallbackOrigins: string[] = [],
): string[] {
  const validOrigins = buildCorsOrigins(frontendRedirectOrigins, allowedOrigins)
    .filter(origin => isValidCorsOrigin(origin, appEnv))

  return validOrigins.length > 0 ? validOrigins : fallbackOrigins
}
