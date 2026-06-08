describe('getWsBaseUrl', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_WS_URL
    delete process.env.NEXT_PUBLIC_API_SERVER_URL
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('requires explicit websocket or API server URL', async () => {
    const { getWsBaseUrl } = await import('./ws')

    expect(() => getWsBaseUrl()).toThrow('NEXT_PUBLIC_WS_URL')
  })

  it('prefers explicit websocket URL', async () => {
    process.env.NEXT_PUBLIC_WS_URL = 'wss://backend.example.com/'
    process.env.NEXT_PUBLIC_API_SERVER_URL = 'https://backend.example.com'

    const { getWsBaseUrl } = await import('./ws')

    expect(getWsBaseUrl()).toBe('wss://backend.example.com')
  })
})
