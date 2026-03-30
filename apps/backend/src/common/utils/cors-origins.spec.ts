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
