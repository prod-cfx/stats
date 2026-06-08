jest.mock('@ai/api-contracts', () => ({
  createApiClient: jest.fn(() => ({})),
}), { virtual: true })

jest.mock('@ai/shared', () => ({
  unwrapTransportResponse: jest.fn((value: unknown) => value),
}), { virtual: true })

describe('front API base URL resolution', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_API_BASE_URL: '/api/v1',
      NEXT_PUBLIC_API_SERVER_URL: 'https://backend.example.com',
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('requires explicit server URL when browser API base URL is relative', async () => {
    const { resolveServerApiBaseUrl } = await import('./api-client')

    expect(() => resolveServerApiBaseUrl('/api/v1', undefined)).toThrow('NEXT_PUBLIC_API_SERVER_URL')
  })

  it('uses absolute API base URL directly for server calls', async () => {
    const { resolveServerApiBaseUrl } = await import('./api-client')

    expect(resolveServerApiBaseUrl('https://backend.example.com/api/v1', undefined)).toBe(
      'https://backend.example.com/api/v1',
    )
  })
})
