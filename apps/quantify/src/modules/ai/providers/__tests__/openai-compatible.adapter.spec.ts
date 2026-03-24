import { OpenAiCompatibleAdapter } from '../openai-compatible.adapter'

describe('OpenAiCompatibleAdapter retry', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  function mockResponse(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    } as unknown as Response
  }

  it('retries on 429 and succeeds', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(mockResponse(429, { error: { message: 'rate limited' } }))
      .mockResolvedValueOnce(mockResponse(200, { choices: [{ message: { content: 'OK' } }] }))
    global.fetch = fetchMock as unknown as typeof fetch

    const adapter = new OpenAiCompatibleAdapter({
      baseUrl: 'https://api.example.com',
      apiKey: 'k',
      timeoutMs: 1000,
      maxRetries: 1,
      retryDelayMs: 0,
    })

    const result = await adapter.sendChatCompletion({
      model: 'm',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(result.content).toBe('OK')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries on aborted error and succeeds', async () => {
    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new Error('This operation was aborted'))
      .mockResolvedValueOnce(mockResponse(200, { choices: [{ message: { content: 'OK2' } }] }))
    global.fetch = fetchMock as unknown as typeof fetch

    const adapter = new OpenAiCompatibleAdapter({
      baseUrl: 'https://api.example.com',
      apiKey: 'k',
      timeoutMs: 1000,
      maxRetries: 1,
      retryDelayMs: 0,
    })

    const result = await adapter.sendChatCompletion({
      model: 'm',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(result.content).toBe('OK2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

