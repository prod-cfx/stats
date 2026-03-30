describe('resolveApiBaseUrl', () => {
  it('falls back to NEXT_PUBLIC_API_SERVER_URL when NEXT_PUBLIC_API_BASE_URL is placeholder text', async () => {
    const { resolveApiBaseUrl } = await import('./api-base-url')

    expect(resolveApiBaseUrl('__SET_IN_env.local__', 'https://cfx-backend-staging.devbase.cloud')).toBe(
      'https://cfx-backend-staging.devbase.cloud/api/v1',
    )
  })

  it('prefers NEXT_PUBLIC_API_BASE_URL when it is a valid explicit URL', async () => {
    const { resolveApiBaseUrl } = await import('./api-base-url')

    expect(
      resolveApiBaseUrl(
        'https://cfx-backend-staging.devbase.cloud/api/v1/',
        'https://cfx-backend-staging.devbase.cloud',
      ),
    ).toBe('https://cfx-backend-staging.devbase.cloud/api/v1')
  })
})
