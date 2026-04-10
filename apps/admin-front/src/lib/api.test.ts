/** @jest-environment jsdom */

const mockGetRegisteredKeys = jest.fn()
const mockListExecutions = jest.fn()
const clearSession = jest.fn()
const mockGetToken = jest.fn()

jest.mock('@ai/api-contracts', () => ({
  createApiClient: jest.fn(() => ({
    AdminDataPullTaskController_getRegisteredKeys: mockGetRegisteredKeys,
    AdminDataPullTaskController_listExecutions: mockListExecutions,
  })),
}))

jest.mock('./api-base-url', () => ({
  resolveApiBaseUrl: jest.fn(() => 'http://localhost:3000/api/v1'),
}))

jest.mock('./auth-store', () => ({
  useAuthStore: {
    getState: () => ({
      clearSession,
    }),
  },
}))

jest.mock('./session', () => ({
  getToken: () => mockGetToken(),
}))

describe('admin api transport', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGetRegisteredKeys.mockReset()
    mockListExecutions.mockReset()
    clearSession.mockReset()
    mockGetToken.mockReset()
    mockGetToken.mockReturnValue('admin-token')
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'http://localhost/dashboard' },
    })
  })

  it('fetchRegisteredJobKeys uses the generated client contract and unwraps keys', async () => {
    mockGetRegisteredKeys.mockResolvedValueOnce({
      data: { keys: ['job-a', 'job-b'] },
    })

    const { fetchRegisteredJobKeys } = await import('./api')
    await expect(fetchRegisteredJobKeys()).resolves.toEqual(['job-a', 'job-b'])

    expect(mockGetRegisteredKeys).toHaveBeenCalledWith({
      headers: { Authorization: 'Bearer admin-token' },
    })
  })

  it('clears session and redirects on 401 execution list failures', async () => {
    mockListExecutions.mockRejectedValueOnce({
      response: { status: 401 },
    })

    const { fetchDataPullTaskExecutions } = await import('./api')

    await expect(fetchDataPullTaskExecutions(7)).rejects.toEqual({
      response: { status: 401 },
    })
    expect(clearSession).toHaveBeenCalledTimes(1)
    expect(window.location.href).toContain('/login')
  })

  it('preserves session and rethrows 403 execution list failures', async () => {
    mockListExecutions.mockRejectedValueOnce({
      response: { status: 403 },
      message: 'forbidden',
    })

    const { fetchDataPullTaskExecutions } = await import('./api')

    await expect(fetchDataPullTaskExecutions(7)).rejects.toMatchObject({
      response: { status: 403 },
      message: 'forbidden',
    })
    expect(clearSession).not.toHaveBeenCalled()
    expect(window.location.href).toBe('http://localhost/dashboard')
  })
})
