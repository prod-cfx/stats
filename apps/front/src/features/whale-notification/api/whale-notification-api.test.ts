import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { getWhaleNotificationUnreadCount } from './whale-notification-api'

describe('getWhaleNotificationUnreadCount', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
  })

  it('uses local guest inbox directly when anonymous (no API request)', async () => {
    localStorage.setItem(
      'whale_notification_inbox:guest',
      JSON.stringify([
        { id: '1', read: false },
        { id: '2', read: true },
        { id: '3', read: false },
      ]),
    )

    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Unauthorized' }),
    }))

    ;(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as typeof fetch

    await expect(getWhaleNotificationUnreadCount()).resolves.toBe(2)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
