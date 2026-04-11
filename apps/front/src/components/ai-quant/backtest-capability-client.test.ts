import { ApiError, AuthenticationError } from '@/lib/errors'
import {
  BACKTEST_CAPABILITY_REQUEST_TIMEOUT_MS,
  fetchBacktestCapabilities,
} from './backtest-capability-client'

const mockGetToken = jest.fn()

jest.mock('@/lib/api-client', () => ({
  client: {
    BacktestingProxyController_capabilities: jest.fn(),
  },
  unwrapApiResponse: (response: unknown) => {
    if (response && typeof response === 'object' && 'data' in response) {
      return (response as { data: unknown }).data
    }
    return response
  },
}))

jest.mock('@/lib/auth-storage', () => ({
  getToken: () => mockGetToken(),
}))

const { client: mockClient } = jest.requireMock('@/lib/api-client') as {
  client: {
    BacktestingProxyController_capabilities: jest.Mock
  }
}

describe('backtest-capability-client', () => {
  beforeEach(() => {
    mockGetToken.mockReset()
    mockGetToken.mockReturnValue('header.payload.signature')
    mockClient.BacktestingProxyController_capabilities.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.resetAllMocks()
  })

  it('success returns allowedSymbols and allowedBaseTimeframes', async () => {
    mockClient.BacktestingProxyController_capabilities.mockResolvedValue({
      data: {
        allowedSymbols: ['BTCUSDT', 'ETHUSDT'],
        allowedBaseTimeframes: ['1m', '5m'],
      },
    })

    await expect(fetchBacktestCapabilities()).resolves.toEqual({
      allowedSymbols: ['BTCUSDT', 'ETHUSDT'],
      allowedBaseTimeframes: ['1m', '5m'],
    })

    expect(mockClient.BacktestingProxyController_capabilities).toHaveBeenCalledWith({
      headers: expect.objectContaining({
        Authorization: 'Bearer header.payload.signature',
        'x-request-id': expect.stringContaining('front-backtest:capabilities:'),
      }),
      signal: expect.anything(),
    })
  })

  it('empty sets are recognized as unavailable and throw ApiError', async () => {
    mockClient.BacktestingProxyController_capabilities.mockResolvedValue({
      data: {
        allowedSymbols: [],
        allowedBaseTimeframes: [],
      },
    })

    await expect(fetchBacktestCapabilities()).rejects.toMatchObject({
      code: 'CAPABILITY_UNAVAILABLE',
      statusCode: 503,
    })
  })

  it('non-2xx converts to ApiError', async () => {
    mockClient.BacktestingProxyController_capabilities.mockRejectedValue({
      response: {
        status: 502,
        statusText: 'Bad Gateway',
        data: {
          error: {
            code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
            stage: 'capability',
            requestId: 'cap-req-1',
            args: { reasonMessage: 'upstream failed by reason message' },
            message: 'should not win',
          },
        },
      },
      message: 'Request failed',
    })

    const request = fetchBacktestCapabilities()
    await expect(request).rejects.toBeInstanceOf(ApiError)
    await expect(request).rejects.toMatchObject({
      message: 'upstream failed by reason message capability (SERVICE_TEMPORARILY_UNAVAILABLE, HTTP 502, requestId cap-req-1)',
      statusCode: 502,
    })
  })

  it('retries transient 502 and succeeds on next attempt', async () => {
    mockClient.BacktestingProxyController_capabilities
      .mockRejectedValueOnce({
        response: {
          status: 502,
          statusText: 'Bad Gateway',
          data: { message: 'upstream down' },
        },
      })
      .mockResolvedValueOnce({
        data: {
          allowedSymbols: ['BTCUSDT'],
          allowedBaseTimeframes: ['15m'],
        },
      })

    await expect(fetchBacktestCapabilities()).resolves.toEqual({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m'],
    })
    expect(mockClient.BacktestingProxyController_capabilities).toHaveBeenCalledTimes(2)
  })

  it('throws auth error when token is missing', async () => {
    mockGetToken.mockReturnValueOnce(null)

    const request = fetchBacktestCapabilities()
    await expect(request).rejects.toBeInstanceOf(AuthenticationError)
    await expect(request).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      statusCode: 401,
    })
    expect(mockClient.BacktestingProxyController_capabilities).not.toHaveBeenCalled()
  })

  it('throws auth error when token format is invalid', async () => {
    mockGetToken.mockReturnValueOnce('not-a-jwt')

    const request = fetchBacktestCapabilities()
    await expect(request).rejects.toBeInstanceOf(AuthenticationError)
    await expect(request).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      statusCode: 401,
    })
    expect(mockClient.BacktestingProxyController_capabilities).not.toHaveBeenCalled()
  })

  it('throws timeout ApiError when request hangs', async () => {
    jest.useFakeTimers()
    mockClient.BacktestingProxyController_capabilities.mockImplementation(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    )

    const assertion = expect(fetchBacktestCapabilities()).rejects.toMatchObject({
      code: 'API_TIMEOUT',
      statusCode: 408,
    })
    await jest.advanceTimersByTimeAsync(BACKTEST_CAPABILITY_REQUEST_TIMEOUT_MS)
    await assertion
  })

  it('upstream abort follows backtest client semantics and maps to API_ERROR', async () => {
    mockClient.BacktestingProxyController_capabilities.mockImplementation(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    )

    const controller = new AbortController()
    const assertion = expect(fetchBacktestCapabilities({ signal: controller.signal })).rejects.toMatchObject({
      code: 'API_ERROR',
      message: expect.stringContaining('aborted'),
    })
    controller.abort()
    await assertion
    expect(mockClient.BacktestingProxyController_capabilities).toHaveBeenCalledTimes(1)
  })

  it('uses statusText fallback when error body is empty', async () => {
    mockClient.BacktestingProxyController_capabilities.mockRejectedValue({
      response: {
        status: 503,
        statusText: 'Service Unavailable',
        data: null,
      },
    })

    await expect(fetchBacktestCapabilities()).rejects.toMatchObject({
      message: expect.stringContaining('Service Unavailable'),
      statusCode: 503,
    })
  })
})
