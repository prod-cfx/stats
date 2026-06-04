import type { BulkTarget } from './bulk-action'
import { aggregateBulkSettledResults, toErrorMessage } from './bulk-action'

describe('aggregateBulkSettledResults', () => {
  const targets: BulkTarget[] = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
    { id: 3, name: 'C' },
  ]

  it('handles all success results', () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: { ok: true } },
      { status: 'fulfilled', value: { ok: true } },
      { status: 'fulfilled', value: { ok: true } },
    ]

    const aggregate = aggregateBulkSettledResults(targets, results)

    expect(aggregate.total).toBe(3)
    expect(aggregate.successCount).toBe(3)
    expect(aggregate.failureCount).toBe(0)
    expect(aggregate.failures).toEqual([])
  })

  it('handles partial failures and missing results', () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: { ok: true } },
      {
        status: 'rejected',
        reason: { response: { data: { message: '请求失败' } } },
      },
    ]

    const aggregate = aggregateBulkSettledResults(targets, results)

    expect(aggregate.total).toBe(3)
    expect(aggregate.successCount).toBe(1)
    expect(aggregate.failureCount).toBe(2)
    expect(aggregate.failures).toEqual([
      { target: targets[1], errorMessage: '请求失败' },
      { target: targets[2], errorMessage: '未知错误' },
    ])
  })

  it('handles empty input', () => {
    const aggregate = aggregateBulkSettledResults([], [])

    expect(aggregate.total).toBe(0)
    expect(aggregate.successCount).toBe(0)
    expect(aggregate.failureCount).toBe(0)
    expect(aggregate.failures).toEqual([])
  })

  it('supports bulk update enabled with partial failures', () => {
    const updateTargets: BulkTarget[] = [
      { id: 10, name: 'Enable A' },
      { id: 11, name: 'Enable B' },
    ]

    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: { id: 10, enabled: true } },
      { status: 'rejected', reason: new Error('更新失败') },
    ]

    const aggregate = aggregateBulkSettledResults(updateTargets, results)
    expect(aggregate.total).toBe(2)
    expect(aggregate.successCount).toBe(1)
    expect(aggregate.failureCount).toBe(1)
    expect(aggregate.failures).toEqual([{ target: updateTargets[1], errorMessage: '更新失败' }])
  })

  it('uses backend error args reason when response message is absent', () => {
    const message = toErrorMessage({
      response: {
        data: {
          error: {
            code: 'DATA_SYNC_CONFIG_MISSING',
            args: {
              reason: 'userAddress is required in cursor',
            },
          },
        },
      },
    })

    expect(message).toBe('userAddress is required in cursor')
  })

  it('prefers backend error args reason over axios error message', () => {
    const error = new Error('Request failed with status code 500') as Error & {
      response?: Record<string, unknown>
    }
    error.response = {
      data: {
        error: {
          code: 'DATA_SYNC_API_ERROR',
          args: {
            reason: 'BBX API request failed after 3/3: status=401 Unauthorized',
          },
        },
      },
    }

    expect(toErrorMessage(error)).toBe(
      'BBX API request failed after 3/3: status=401 Unauthorized',
    )
  })

  it('uses backend error args reason from nested cause', () => {
    const error = new Error('Request failed with status code 500') as Error & {
      cause?: unknown
    }
    error.cause = {
      response: {
        data: {
          error: {
            args: {
              reason: 'BBX_ACCESS_KEY_ID and BBX_ACCESS_SECRET are required',
            },
          },
        },
      },
    }

    expect(toErrorMessage(error)).toBe('BBX_ACCESS_KEY_ID and BBX_ACCESS_SECRET are required')
  })
})
