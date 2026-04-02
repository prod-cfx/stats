import { QuantifyAiQuantClient } from './quantify-ai-quant.client'

describe('quantifyAiQuantClient', () => {
  const env = {
    getString: jest.fn((key: string) => key === 'QUANTIFY_API_BASE_URL' ? 'http://quantify.test/api/v1' : undefined),
    getNumber: jest.fn(() => undefined),
  }

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('returns payload.data for successful upstream responses', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        data: {
          id: 'session-1',
          status: 'CHECKLIST_GATE',
        },
      }),
    } as Response)

    const client = new QuantifyAiQuantClient(env as any)

    await expect(client.post('/llm-strategy-codegen/sessions', { foo: 'bar' })).resolves.toEqual({
      id: 'session-1',
      status: 'CHECKLIST_GATE',
    })
  })

  it('throws a 502 client error when quantify returns non-json error bodies', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '<html>bad gateway</html>',
    } as Response)

    const client = new QuantifyAiQuantClient(env as never)

    await expect(client.get('/llm-strategy-instances')).rejects.toMatchObject({
      status: 502,
      message: 'Quantify returned a non-JSON error response',
      args: {
        upstreamBody: '<html>bad gateway</html>',
      },
    })
  })

  it('appends /api/v1 when only QUANTIFY_BASE_URL is configured', async () => {
    const envWithBaseOnly = {
      getString: jest.fn((key: string) => {
        if (key === 'QUANTIFY_API_BASE_URL') return undefined
        if (key === 'QUANTIFY_BASE_URL') return 'http://quantify.test'
        return undefined
      }),
      getNumber: jest.fn(() => undefined),
    }
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { ok: true } }),
    } as Response)

    const client = new QuantifyAiQuantClient(envWithBaseOnly as any)
    await expect(client.get('/llm-strategy-instances')).resolves.toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://quantify.test/api/v1/llm-strategy-instances',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('keeps pathful QUANTIFY_BASE_URL without force-appending /api/v1', async () => {
    const envWithPathBase = {
      getString: jest.fn((key: string) => key === 'QUANTIFY_BASE_URL' ? 'http://quantify.test/gateway/v2' : undefined),
      getNumber: jest.fn(() => undefined),
    }

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { ok: true } }),
    } as Response)

    const client = new QuantifyAiQuantClient(envWithPathBase as any)
    await expect(client.get('/backtesting/capabilities')).resolves.toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://quantify.test/gateway/v2/backtesting/capabilities',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('ignores placeholder QUANTIFY_BASE_URL and falls back to localhost default', async () => {
    const envWithPlaceholder = {
      getString: jest.fn((key: string) => {
        if (key === 'QUANTIFY_API_BASE_URL') return undefined
        if (key === 'QUANTIFY_BASE_URL') return '__SET_IN_env.local__'
        return undefined
      }),
      getNumber: jest.fn(() => undefined),
    }

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { ok: true } }),
    } as Response)

    const client = new QuantifyAiQuantClient(envWithPlaceholder as any)
    await expect(client.get('/llm-strategy-instances')).resolves.toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3010/api/v1/llm-strategy-instances',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('converts request timeouts into QuantifyClientError without leaking raw Error construction', async () => {
    jest.useFakeTimers()
    const abort = jest.spyOn(AbortController.prototype, 'abort')

    jest.spyOn(globalThis, 'fetch').mockImplementation((_, init) => {
      const signal = init?.signal
      return new Promise((_, reject) => {
        signal?.addEventListener(
          'abort',
          () => {
            reject(signal.reason)
          },
          { once: true },
        )
      }) as Promise<Response>
    })

    const envWithTimeout = {
      getString: jest.fn((key: string) => key === 'QUANTIFY_API_BASE_URL' ? 'http://quantify.test/api/v1' : undefined),
      getNumber: jest.fn((key: string) => key === 'QUANTIFY_REQUEST_TIMEOUT_MS' ? 1000 : undefined),
    }

    const client = new QuantifyAiQuantClient(envWithTimeout as any)
    const requestPromise = client.get('/llm-strategy-instances')
    const assertion = expect(requestPromise).rejects.toMatchObject({
      status: 502,
      message: 'Quantify request failed',
      code: 'UPSTREAM_REQUEST_FAILED',
      args: {
        cause: 'timeout after 1000ms',
      },
    })

    await jest.advanceTimersByTimeAsync(1000)

    await assertion
    expect(abort).toHaveBeenCalledWith('timeout after 1000ms')
  })
})
