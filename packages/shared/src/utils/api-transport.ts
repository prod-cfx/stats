export interface TransportEnvelope<T> {
  data?: T
  message?: string
}

export interface TransportItemsEnvelope<T> {
  items?: T[]
}

export function unwrapTransportResponse<T>(response: T | TransportEnvelope<T>): T {
  if (response && typeof response === 'object' && 'data' in response) {
    const data = (response as TransportEnvelope<T>).data
    if (data !== undefined) {
      return data
    }
  }

  return response as T
}

export function unwrapTransportItems<T>(
  response: T[] | TransportItemsEnvelope<T> | TransportEnvelope<TransportItemsEnvelope<T>>,
): T[] {
  const unwrapped = unwrapTransportResponse(response as TransportItemsEnvelope<T> | TransportEnvelope<TransportItemsEnvelope<T>>)

  if (Array.isArray(unwrapped)) {
    return unwrapped
  }

  if (unwrapped && typeof unwrapped === 'object' && Array.isArray(unwrapped.items)) {
    return unwrapped.items
  }

  return []
}

export function buildBearerAuthHeaders(token: string): Record<'Authorization', string> {
  return { Authorization: `Bearer ${token}` }
}

export function getErrorHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  const directStatus = (error as { status?: unknown; statusCode?: unknown }).status
  if (typeof directStatus === 'number') {
    return directStatus
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode
  if (typeof statusCode === 'number') {
    return statusCode
  }

  if (!('response' in error)) {
    return undefined
  }

  const response = (error as { response?: unknown }).response
  if (!response || typeof response !== 'object') {
    return undefined
  }

  const nestedStatus = (response as { status?: unknown }).status
  return typeof nestedStatus === 'number' ? nestedStatus : undefined
}
