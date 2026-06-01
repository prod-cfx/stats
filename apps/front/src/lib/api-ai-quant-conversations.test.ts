/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const originalFetch = globalThis.fetch

jest.mock('./auth-storage', () => ({
  getToken: () => 'header.payload.signature',
}))

jest.mock('@ai/shared', () => ({
  buildBearerAuthHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
  getErrorHttpStatus: () => undefined,
  unwrapTransportResponse: (value: unknown) => {
    if (value && typeof value === 'object' && 'data' in value) return (value as { data?: unknown }).data
    return value
  },
}), { virtual: true })

describe('listAiQuantConversations', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    if (originalFetch) {
      globalThis.fetch = originalFetch
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch
    }
  })

  it('aborts conversation list requests after the frontend timeout', async () => {
    let requestSignal: AbortSignal | undefined
    const fetchMock = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { listAiQuantConversations } = await import('./api-ai-quant-domain')
    const request = listAiQuantConversations()

    expect(requestSignal).toBeDefined()

    jest.advanceTimersByTime(12_000)

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(requestSignal?.aborted).toBe(true)
  })
})
