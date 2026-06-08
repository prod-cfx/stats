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
      NEXT_PUBLIC_BACKEND_API_BASE_URL: 'https://backend.example.com/api/v1',
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('uses full backend API base URL directly for server calls', async () => {
    const { resolveServerApiBaseUrl } = await import('./api-client')

    expect(resolveServerApiBaseUrl('https://backend.example.com/api/v1')).toBe(
      'https://backend.example.com/api/v1',
    )
  })

  it('rejects host-only backend API base URL for server calls', async () => {
    const { resolveServerApiBaseUrl } = await import('./api-client')

    expect(() => resolveServerApiBaseUrl('https://backend.example.com')).toThrow('/api/v1')
  })

  it('uses only the API path for browser calls from full backend API base URL', async () => {
    const { resolveBrowserApiBaseUrl } = await import('./api-client')

    expect(resolveBrowserApiBaseUrl('https://backend.example.com/api/v1')).toBe('/api/v1')
  })

  it('rejects host-only backend API base URL because the API prefix belongs in the env value', async () => {
    const { resolveBrowserApiBaseUrl } = await import('./api-client')

    expect(() => resolveBrowserApiBaseUrl('https://backend.example.com')).toThrow('/api/v1')
  })

  it('rejects relative backend API base URL because the env value must be complete', async () => {
    const { resolveBrowserApiBaseUrl } = await import('./api-client')

    expect(() => resolveBrowserApiBaseUrl('/api/v1')).toThrow('NEXT_PUBLIC_BACKEND_API_BASE_URL')
  })
})
