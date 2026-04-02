import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { postBacktestSymbolSupportCheck } from '@/lib/api'
import { AuthenticationError, ApiError } from '@/lib/errors'
import { checkBacktestSymbolSupport } from './backtest-symbol-support-client'

vi.mock('@/lib/api', () => ({
  postBacktestSymbolSupportCheck: vi.fn(),
}))

describe('backtest-symbol-support-client', () => {
  const mockPostBacktestSymbolSupportCheck = vi.mocked(postBacktestSymbolSupportCheck)

  beforeEach(() => {
    mockPostBacktestSymbolSupportCheck.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls unified api layer and returns supported status', async () => {
    mockPostBacktestSymbolSupportCheck.mockResolvedValueOnce({
      status: 'supported',
    })

    const result = await checkBacktestSymbolSupport({
      exchange: 'okx',
      symbol: 'ETHUSDC',
    })

    expect(result).toEqual({ status: 'supported' })
    expect(mockPostBacktestSymbolSupportCheck).toHaveBeenCalledWith({
      exchange: 'okx',
      symbol: 'ETHUSDC',
    })
  })

  it('rethrows auth errors from unified api layer', async () => {
    mockPostBacktestSymbolSupportCheck.mockRejectedValueOnce(new AuthenticationError('UNAUTHENTICATED'))
    const request = checkBacktestSymbolSupport({ exchange: 'okx', symbol: 'ETHUSDC' })

    await expect(request).rejects.toBeInstanceOf(AuthenticationError)
    await expect(request).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      statusCode: 401,
    })
  })

  it('rethrows ApiError from unified api layer', async () => {
    mockPostBacktestSymbolSupportCheck.mockRejectedValueOnce(new ApiError('Request timeout', 'API_TIMEOUT', 408))
    const request = checkBacktestSymbolSupport({ exchange: 'okx', symbol: 'ETHUSDC' })

    await expect(request).rejects.toBeInstanceOf(ApiError)
    await expect(request).rejects.toMatchObject({
      code: 'API_TIMEOUT',
      statusCode: 408,
    })
  })

  it('throws ApiError when api payload has unsupported status', async () => {
    mockPostBacktestSymbolSupportCheck.mockResolvedValueOnce({
      status: 'unexpected',
    } as never)
    const request = checkBacktestSymbolSupport({ exchange: 'okx', symbol: 'ETHUSDC' })

    await expect(request).rejects.toBeInstanceOf(ApiError)
    await expect(request).rejects.toMatchObject({
      code: 'API_ERROR',
      statusCode: 500,
      message: expect.stringContaining('Invalid symbol support payload'),
    })
  })
})
