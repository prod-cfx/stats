/**
 * Custom error classes for better error handling
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class AuthenticationError extends ApiError {
  constructor(code: 'UNAUTHENTICATED' | 'INVALID_TOKEN' | 'TOKEN_EXPIRED') {
    super('Authentication required', code, 401)
    this.name = 'AuthenticationError'
  }
}

/**
 * Log error to monitoring service (placeholder)
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  // TODO: Integrate with error tracking service (Sentry, etc.)
  console.error(`[${context}]`, error, metadata)
}
