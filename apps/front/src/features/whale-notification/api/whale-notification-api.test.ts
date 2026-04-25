import type { ApiError } from '@/lib/errors'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockClient = {
  WhaleNotificationInboxController_unreadCount: jest.fn(),
}

const mockGetToken = jest.fn()
const mockLoadStoredSession = jest.fn()

jest.mock('@/lib/api-client', () => ({
  client: mockClient,
  unwrapApiResponse: (response: unknown) => {
    if (response && typeof response === 'object' && 'data' in response) {
      return (response as { data: unknown }).data
    }
    return response
  },
}))

jest.mock('@/lib/auth-storage', () => ({
  getToken: () => mockGetToken(),
  loadStoredSession: () => mockLoadStoredSession(),
}))

describe('whale-notification-api', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
    jest.resetModules()
    mockClient.WhaleNotificationInboxController_unreadCount.mockReset()
    mockGetToken.mockReset()
    mockLoadStoredSession.mockReset()
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
    mockGetToken.mockReturnValue(null)
    mockLoadStoredSession.mockReturnValue(null)

    const { getWhaleNotificationUnreadCount } = await import('./whale-notification-api')
    await expect(getWhaleNotificationUnreadCount()).resolves.toBe(2)
    expect(mockClient.WhaleNotificationInboxController_unreadCount).not.toHaveBeenCalled()
  })

  it('does not fall back to local storage when authenticated unread-count request returns 401', async () => {
    localStorage.setItem(
      'whale_notification_inbox:uid:user-1',
      JSON.stringify([{ id: '1', read: false }]),
    )
    mockGetToken.mockReturnValue('token-1')
    mockLoadStoredSession.mockReturnValue({ userId: 'user-1' })
    mockClient.WhaleNotificationInboxController_unreadCount.mockRejectedValue({
      response: { status: 401 },
      message: 'Unauthorized',
    })

    const { getWhaleNotificationUnreadCount } = await import('./whale-notification-api')
    await expect(getWhaleNotificationUnreadCount()).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      statusCode: 401,
    } satisfies Partial<ApiError>)
  })
})
