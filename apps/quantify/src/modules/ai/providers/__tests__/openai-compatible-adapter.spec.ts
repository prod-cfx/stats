import { OpenAiCompatibleAdapter } from '../openai-compatible.adapter'

describe('openAiCompatibleAdapter retry', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
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
    globalThis.fetch = fetchMock as unknown as typeof fetch

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
    globalThis.fetch = fetchMock as unknown as typeof fetch

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

  it('uses max_completion_tokens for gpt-5 models', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(mockResponse(200, { choices: [{ message: { content: 'OK3' } }] }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const adapter = new OpenAiCompatibleAdapter({
      baseUrl: 'https://api.example.com',
      apiKey: 'k',
      timeoutMs: 1000,
      maxRetries: 0,
      retryDelayMs: 0,
    })

    await adapter.sendChatCompletion({
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 321,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const payload = JSON.parse(String(init.body))
    expect(payload.max_completion_tokens).toBe(321)
    expect(payload.max_tokens).toBeUndefined()
  })
})
