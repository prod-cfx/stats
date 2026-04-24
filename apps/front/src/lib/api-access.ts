import { buildBearerAuthHeaders, getErrorHttpStatus, unwrapTransportResponse } from '@ai/shared'

import { API_BASE_URL, client, unwrapApiResponse, validateId } from './api-client'
import { getToken } from './auth-storage'
import { ApiError, AuthenticationError, logError } from './errors'

const IS_NON_PROD =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_APP_ENV !== 'production'
const ACCOUNT_AI_QUANT_MOCK_FALLBACK_ENABLED =
  IS_NON_PROD && process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK === 'true'

interface BaseResponse<T> {
  data?: T
  message?: string
}

interface PaginatedItemsResponse<T> {
  items?: T[]
}

function isValidJWTFormat(token: string): boolean {
  return /^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)
}

export function getHttpStatusFromError(error: unknown): number | undefined {
  if (error instanceof ApiError && typeof error.statusCode === 'number') {
    return error.statusCode
  }
  return getErrorHttpStatus(error)
}

export function shouldFallbackToMock(error: unknown): boolean {
  if (!IS_NON_PROD) return false
  if (error instanceof AuthenticationError) return false
  return true
}

export function shouldFallbackToAccountAiQuantMock(error: unknown): boolean {
  if (error instanceof AuthenticationError) return false
  return ACCOUNT_AI_QUANT_MOCK_FALLBACK_ENABLED && shouldFallbackToMock(error)
}

export function isRetryableNetworkStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

export function shouldFallbackDeleteAccountAiQuantMock(error: unknown): boolean {
  if (!ACCOUNT_AI_QUANT_MOCK_FALLBACK_ENABLED) return false
  if (!shouldFallbackToAccountAiQuantMock(error)) return false

  const status = getHttpStatusFromError(error)
  if (typeof status === 'number') {
    return isRetryableNetworkStatus(status)
  }

  if (error instanceof ApiError) {
    return error.code === 'API_ERROR' || error.code === 'UNKNOWN_ERROR'
  }

  return false
}

export function unwrapResponse<T>(response: T | BaseResponse<T>): T {
  return unwrapTransportResponse(response)
}

export function unwrapPaginatedItems<T>(
  response: PaginatedItemsResponse<T> | BaseResponse<PaginatedItemsResponse<T>>,
): T[] {
  return unwrapResponse(response).items ?? []
}

export function extractBackendErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const candidate = payload as {
    error?: { args?: { reasonMessage?: unknown } }
    message?: unknown
  }

  if (typeof candidate.error?.args?.reasonMessage === 'string' && candidate.error.args.reasonMessage.trim()) {
    return candidate.error.args.reasonMessage
  }

  if (typeof candidate.message === 'string' && candidate.message.trim()) {
    return candidate.message
  }

  return fallback
}

export function requireAuthHeaders(): Record<string, string> {
  const token = getToken()

  if (!token) {
    throw new AuthenticationError('UNAUTHENTICATED')
  }

  if (!isValidJWTFormat(token)) {
    logError('INVALID_TOKEN_FORMAT', new Error('Token format validation failed'))
    throw new AuthenticationError('INVALID_TOKEN')
  }

  return buildBearerAuthHeaders(token)
}

export function optionalAuthHeaders(): Record<string, string> {
  const token = getToken()

  if (!token) {
    return {}
  }

  if (!isValidJWTFormat(token)) {
    logError('INVALID_TOKEN_FORMAT', new Error('Token format validation failed'))
    return {}
  }

  return buildBearerAuthHeaders(token)
}

export async function apiCall<T>(operation: () => Promise<T>, context: string): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    logError(context, error)

    if (error instanceof AuthenticationError) {
      throw error
    }

    if (error instanceof ApiError) {
      throw error
    }

    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as {
        message?: string
        response?: {
          status?: number
          data?: {
            error?: { code?: unknown; message?: unknown }
          }
        }
      }
      const responseData = axiosError.response?.data

      if (
        responseData
        && typeof responseData === 'object'
        && 'error' in responseData
        && responseData.error
        && typeof responseData.error === 'object'
        && 'code' in responseData.error
        && typeof responseData.error.code === 'string'
      ) {
        const backendError = responseData.error as { code: string; message?: string }
        throw new ApiError(
          backendError.message || axiosError.message || '操作失败',
          backendError.code,
          axiosError.response?.status,
          responseData,
        )
      }
    }

    if (error instanceof Error) {
      throw new ApiError(error.message || '操作失败', 'API_ERROR', undefined, error)
    }

    throw new ApiError('未知错误', 'UNKNOWN_ERROR')
  }
}

export {
  API_BASE_URL,
  ApiError,
  AuthenticationError,
  client,
  unwrapApiResponse,
  validateId,
}
