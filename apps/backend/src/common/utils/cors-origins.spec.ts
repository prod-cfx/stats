describe('buildCorsOrigins', () => {
  it('merges frontend redirect origins and allowed origins without duplicates', async () => {
    const { buildCorsOrigins } = await import('./cors-origins')

    expect(
      buildCorsOrigins(
        ['https://cfx-www-staging.devbase.cloud'],
        ['https://cfx-admin-staging.devbase.cloud', 'https://cfx-www-staging.devbase.cloud'],
      ),
    ).toEqual([
      'https://cfx-www-staging.devbase.cloud',
      'https://cfx-admin-staging.devbase.cloud',
    ])
  })

  it('skips empty origins after trimming', async () => {
    const { buildCorsOrigins } = await import('./cors-origins')

    expect(
      buildCorsOrigins(
        [' https://cfx-www-staging.devbase.cloud ', ''],
        ['   ', 'https://cfx-admin-staging.devbase.cloud'],
      ),
    ).toEqual([
      'https://cfx-www-staging.devbase.cloud',
      'https://cfx-admin-staging.devbase.cloud',
    ])
  })

  it('derives the admin staging origin from the www staging origin', async () => {
    const { buildCorsOrigins } = await import('./cors-origins')

    expect(buildCorsOrigins(['https://cfx-www-staging.devbase.cloud'], [])).toEqual([
      'https://cfx-www-staging.devbase.cloud',
      'https://cfx-admin-staging.devbase.cloud',
    ])
  })
})

describe('buildValidatedCorsOrigins', () => {
  it('drops non-https origins in production', async () => {
    const { buildValidatedCorsOrigins } = await import('./cors-origins')

    expect(
      buildValidatedCorsOrigins(
        ['http://www.coinflux.ai'],
        ['https://admin.coinflux.ai'],
        'production',
        ['https://www.coinflux.ai'],
      ),
    ).toEqual(['https://admin.coinflux.ai'])
  })

  it('returns the fallback origins when all configured origins are invalid', async () => {
    const { buildValidatedCorsOrigins } = await import('./cors-origins')

    expect(
      buildValidatedCorsOrigins(
        ['not-a-url'],
        ['ftp://admin.coinflux.ai'],
        'production',
        ['https://www.coinflux.ai', 'https://admin.coinflux.ai'],
      ),
    ).toEqual(['https://www.coinflux.ai', 'https://admin.coinflux.ai'])
  })

  it('keeps local http origins in development', async () => {
    const { buildValidatedCorsOrigins } = await import('./cors-origins')

    expect(
      buildValidatedCorsOrigins(
        ['http://localhost:3001'],
        [],
        'development',
        [],
      ),
    ).toEqual(['http://localhost:3001'])
  })
})
