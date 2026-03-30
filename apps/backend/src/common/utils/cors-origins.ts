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
