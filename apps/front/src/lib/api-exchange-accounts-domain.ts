import type { UserExchangeAccountStatus, UpsertUserExchangeAccountPayload } from './api'

import {
  ApiError,
  apiCall,
  client,
  extractBackendErrorMessage,
  getHttpStatusFromError,
  requireAuthHeaders,
  unwrapResponse,
} from './api-access'

async function requestAccountExchangeAccounts<T>(
  operation: 'list' | 'upsert' | 'delete',
  options?: { exchangeId?: string; payload?: unknown },
): Promise<T> {
  const accountExchangeClient = client as any
  const authHeaders = requireAuthHeaders()
  try {
    if (operation === 'list') {
      const response = await accountExchangeClient.AccountExchangeAccountsController_list({
        headers: authHeaders,
      })
      return unwrapResponse(response as T | { data?: T; message?: string })
    }

    if (operation === 'upsert') {
      const response = await accountExchangeClient.AccountExchangeAccountsController_upsert(options?.payload, {
        headers: authHeaders,
      })
      return unwrapResponse(response as T | { data?: T; message?: string })
    }

    if (!options?.exchangeId) {
      throw new ApiError('exchangeId is required', 'INVALID_INPUT')
    }

    const response = await accountExchangeClient.AccountExchangeAccountsController_delete({
      headers: authHeaders,
      params: { exchangeId: options.exchangeId },
    })

    return unwrapResponse(response as T | { data?: T; message?: string })
  } catch (error) {
    const status = getHttpStatusFromError(error) ?? 500
    const payload = error instanceof ApiError ? error.details : null
    const message = extractBackendErrorMessage(payload, error instanceof Error ? error.message : '操作失败')
    const code = error instanceof ApiError ? error.code : 'API_ERROR'
    throw new ApiError(message, code, status, payload)
  }
}

export async function fetchUserExchangeAccountStatuses(): Promise<UserExchangeAccountStatus[]> {
  return apiCall(
    () => requestAccountExchangeAccounts<UserExchangeAccountStatus[]>('list'),
    'FETCH_USER_EXCHANGE_ACCOUNT_STATUSES',
  )
}

export async function upsertUserExchangeAccount(
  payload: UpsertUserExchangeAccountPayload,
): Promise<UserExchangeAccountStatus> {
  return apiCall(
    () => requestAccountExchangeAccounts<UserExchangeAccountStatus>('upsert', { payload }),
    'UPSERT_USER_EXCHANGE_ACCOUNT',
  )
}

export async function deleteUserExchangeAccount(exchangeId: string): Promise<void> {
  return apiCall(
    () => requestAccountExchangeAccounts<void>('delete', { exchangeId }),
    'DELETE_USER_EXCHANGE_ACCOUNT',
  )
}
