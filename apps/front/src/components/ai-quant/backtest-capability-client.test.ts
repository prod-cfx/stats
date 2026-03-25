import { API_BASE_URL } from '@/lib/api-client'
import { ApiError } from '@/lib/errors'
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
      body: { message: 'upstream failed' },
    })

    await expect(fetchBacktestCapabilities()).rejects.toBeInstanceOf(ApiError)
    await expect(fetchBacktestCapabilities()).rejects.toMatchObject({
      message: expect.stringContaining('upstream failed'),
      statusCode: 502,
    })
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

  it('maps upstream abort signal to API_ABORTED', async () => {
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
      code: 'API_ABORTED',
    })
    controller.abort()
    await assertion
  })
})
