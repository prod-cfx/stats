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

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

/**
 * Type guard to check if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * Extract user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  return '发生未知错误，请稍后重试'
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
