describe('resolveApiBaseUrl', () => {
  it('uses NEXT_PUBLIC_BACKEND_API_BASE_URL as the complete API base URL', async () => {
    const { resolveApiBaseUrl } = await import('./api-base-url')

    expect(resolveApiBaseUrl('https://cfx-backend-staging.devbase.cloud/api/v1/')).toBe(
      'https://cfx-backend-staging.devbase.cloud/api/v1',
    )
  })

  it('treats placeholders as missing', async () => {
    const { resolveApiBaseUrl } = await import('./api-base-url')

    expect(() => resolveApiBaseUrl('__SET_IN_env.local__')).toThrow('NEXT_PUBLIC_BACKEND_API_BASE_URL')
  })

  it('throws when backend API base URL is missing', async () => {
    const { resolveApiBaseUrl } = await import('./api-base-url')

    expect(() => resolveApiBaseUrl(undefined)).toThrow('NEXT_PUBLIC_BACKEND_API_BASE_URL')
  })

  it('rejects host-only backend API base URL', async () => {
    const { resolveApiBaseUrl } = await import('./api-base-url')

    expect(() => resolveApiBaseUrl('https://cfx-backend-staging.devbase.cloud')).toThrow('/api/v1')
  })
})
