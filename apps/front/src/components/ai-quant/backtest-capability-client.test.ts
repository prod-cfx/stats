import { API_BASE_URL } from '@/lib/api-client'
import { ApiError, AuthenticationError } from '@/lib/errors'
import {
  BACKTEST_CAPABILITY_REQUEST_TIMEOUT_MS,
  fetchBacktestCapabilities,
} from './backtest-capability-client'

const mockGetToken = jest.fn()

jest.mock('@/lib/auth-storage', () => ({
  getToken: () => mockGetToken(),
}))

interface MockFetchResponseInit {
  ok: boolean
  status: number
  statusText?: string
  body?: unknown
  jsonRejects?: boolean
}

function mockFetchResponse(init: MockFetchResponseInit) {
  ;(globalThis.fetch as jest.Mock).mockResolvedValue({
    ok: init.ok,
    status: init.status,
    statusText: init.statusText ?? '',
    json: init.jsonRejects
      ? jest.fn().mockRejectedValue(new Error('invalid json'))
      : jest.fn().mockResolvedValue(init.body),
  } as unknown as Response)
}

describe('backtest-capability-client', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn()
    mockGetToken.mockReturnValue('header.payload.signature')
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.resetAllMocks()
  })

  it('success returns allowedSymbols and allowedBaseTimeframes', async () => {
    mockFetchResponse({
      ok: true,
      status: 200,
      body: {
        data: {
          allowedSymbols: ['BTCUSDT', 'ETHUSDT'],
          allowedBaseTimeframes: ['1m', '5m'],
        },
      },
    })

    await expect(fetchBacktestCapabilities()).resolves.toEqual({
      allowedSymbols: ['BTCUSDT', 'ETHUSDT'],
      allowedBaseTimeframes: ['1m', '5m'],
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/backtesting/capabilities`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer header.payload.signature',
      },
      signal: expect.any(AbortSignal),
    })
  })

  it('empty sets are recognized as unavailable and throw ApiError', async () => {
    mockFetchResponse({
      ok: true,
      status: 200,
      body: {
        data: {
          allowedSymbols: [],
          allowedBaseTimeframes: [],
        },
      },
    })

    await expect(fetchBacktestCapabilities()).rejects.toMatchObject({
      code: 'CAPABILITY_UNAVAILABLE',
      statusCode: 503,
    })
  })

  it('non-2xx converts to ApiError', async () => {
    mockFetchResponse({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      body: {
        error: {
          args: { reasonMessage: 'upstream failed by reason message' },
          message: 'should not win',
        },
      },
    })

    const request = fetchBacktestCapabilities()
    await expect(request).rejects.toBeInstanceOf(ApiError)
    await expect(request).rejects.toMatchObject({
      message: expect.stringContaining('upstream failed by reason message'),
      statusCode: 502,
    })
  })

  it('throws auth error when token is missing', async () => {
    mockGetToken.mockReturnValueOnce(null)

    const request = fetchBacktestCapabilities()
    await expect(request).rejects.toBeInstanceOf(AuthenticationError)
    await expect(request).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      statusCode: 401,
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('throws auth error when token format is invalid', async () => {
    mockGetToken.mockReturnValueOnce('not-a-jwt')

    const request = fetchBacktestCapabilities()
    await expect(request).rejects.toBeInstanceOf(AuthenticationError)
    await expect(request).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      statusCode: 401,
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('throws timeout ApiError when request hangs', async () => {
    jest.useFakeTimers()
    ;(globalThis.fetch as jest.Mock).mockImplementation((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })

    const assertion = expect(fetchBacktestCapabilities()).rejects.toMatchObject({
      code: 'API_TIMEOUT',
      statusCode: 408,
    })
    await jest.advanceTimersByTimeAsync(BACKTEST_CAPABILITY_REQUEST_TIMEOUT_MS)
    await assertion
  })

  it('upstream abort follows backtest client semantics and maps to API_ERROR', async () => {
    ;(globalThis.fetch as jest.Mock).mockImplementation((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })

    const controller = new AbortController()
    const assertion = expect(fetchBacktestCapabilities({ signal: controller.signal })).rejects.toMatchObject({
      code: 'API_ERROR',
      message: expect.stringContaining('aborted'),
    })
    controller.abort()
    await assertion
  })

  it('uses statusText fallback when error body is non-JSON', async () => {
    mockFetchResponse({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      jsonRejects: true,
    })

    await expect(fetchBacktestCapabilities()).rejects.toMatchObject({
      message: expect.stringContaining('Bad Gateway'),
      statusCode: 502,
    })
  })

  it('uses statusText fallback when error body is empty', async () => {
    mockFetchResponse({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      body: null,
    })

    await expect(fetchBacktestCapabilities()).rejects.toMatchObject({
      message: expect.stringContaining('Service Unavailable'),
      statusCode: 503,
    })
  })
})
