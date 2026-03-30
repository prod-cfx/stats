function normalizeOrigins(origins: string[]): string[] {
  return origins
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0)
}

export function buildCorsOrigins(
  frontendRedirectOrigins: string[] = [],
  allowedOrigins: string[] = [],
): string[] {
  return [...new Set([...normalizeOrigins(frontendRedirectOrigins), ...normalizeOrigins(allowedOrigins)])]
}
