import { createApiClient } from '@ai/api-contracts'
import { buildBearerAuthHeaders, getErrorHttpStatus, unwrapTransportItems, unwrapTransportResponse } from '@ai/shared'

import { resolveApiBaseUrl } from './api-base-url'
import { useAuthStore } from './auth-store'
import { getToken } from './session'

export function unwrapListResponse<T>(response: unknown): T[] {
  return unwrapTransportItems<T>(response as { data?: { items?: T[] } } | { items?: T[] } | T[])
}

export function unwrapResponse<T>(response: T | { data?: T; message?: string }): T {
  return unwrapTransportResponse(response)
}

const API_BASE_URL = resolveApiBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  process.env.NEXT_PUBLIC_API_SERVER_URL,
)

export const client = createApiClient(API_BASE_URL, { validate: 'request' })

export function requireAuthHeaders() {
  const token = getToken()
  if (!token) throw new Error('登录状态已失效，请重新登录')
  return buildBearerAuthHeaders(token)
}

export async function withAuthErrorHandling<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error: any) {
    const status = getErrorHttpStatus(error)

    if (status === 401) {
      try {
        useAuthStore.getState().clearSession()
      } catch {}

      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }

    throw error
  }
}
