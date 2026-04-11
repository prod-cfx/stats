import { createQuantifyApiClient } from '@ai/api-contracts'
import { QuantifyAiQuantClient } from './quantify-ai-quant.client'

jest.mock('@ai/api-contracts', () => ({
  createQuantifyApiClient: jest.fn(),
}))

describe('quantifyAiQuantClient', () => {
  const mockedCreateQuantifyApiClient = jest.mocked(createQuantifyApiClient)

  function createContractMock() {
    return {
      AccountStrategyViewController_list: jest.fn(),
      LiveLlmStrategyCodegenController_startSession: jest.fn(),
      LiveLlmStrategyCodegenController_getSession: jest.fn(),
      LiveLlmStrategyCodegenController_continueSession: jest.fn(),
      LiveLlmStrategyInstancesController_list: jest.fn(),
    }
  }

  const env = {
    getString: jest.fn((key: string) => key === 'QUANTIFY_API_BASE_URL' ? 'http://quantify.test/api/v1' : undefined),
    getNumber: jest.fn(() => undefined),
  }

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('creates the quantify contract client with the configured api base url', () => {
    mockedCreateQuantifyApiClient.mockReturnValue(createContractMock() as never)

    new QuantifyAiQuantClient(env as any)

    expect(mockedCreateQuantifyApiClient).toHaveBeenCalledWith('http://quantify.test/api/v1', {
      validate: 'all',
    })
  })

  it('appends /api/v1 when only QUANTIFY_BASE_URL is configured', () => {
    mockedCreateQuantifyApiClient.mockReturnValue(createContractMock() as never)

    const envWithBaseOnly = {
      getString: jest.fn((key: string) => {
        if (key === 'QUANTIFY_API_BASE_URL') return undefined
        if (key === 'QUANTIFY_BASE_URL') return 'http://quantify.test'
        return undefined
      }),
      getNumber: jest.fn(() => undefined),
    }

    new QuantifyAiQuantClient(envWithBaseOnly as any)

    expect(mockedCreateQuantifyApiClient).toHaveBeenCalledWith('http://quantify.test/api/v1', {
      validate: 'all',
    })
  })

  it('keeps pathful QUANTIFY_BASE_URL without force-appending /api/v1', () => {
    mockedCreateQuantifyApiClient.mockReturnValue(createContractMock() as never)

    const envWithPathBase = {
      getString: jest.fn((key: string) => key === 'QUANTIFY_BASE_URL' ? 'http://quantify.test/gateway/v2' : undefined),
      getNumber: jest.fn(() => undefined),
    }

    new QuantifyAiQuantClient(envWithPathBase as any)

    expect(mockedCreateQuantifyApiClient).toHaveBeenCalledWith('http://quantify.test/gateway/v2', {
      validate: 'all',
    })
  })

  it('ignores placeholder QUANTIFY_BASE_URL and falls back to localhost default', () => {
    mockedCreateQuantifyApiClient.mockReturnValue(createContractMock() as never)

    const envWithPlaceholder = {
      getString: jest.fn((key: string) => {
        if (key === 'QUANTIFY_API_BASE_URL') return undefined
        if (key === 'QUANTIFY_BASE_URL') return '__SET_IN_env.local__'
        return undefined
      }),
      getNumber: jest.fn(() => undefined),
    }

    new QuantifyAiQuantClient(envWithPlaceholder as any)

    expect(mockedCreateQuantifyApiClient).toHaveBeenCalledWith('http://localhost:3010/api/v1', {
      validate: 'all',
    })
  })

  it('falls back to localhost when staging config points to the public quantify domain', () => {
    mockedCreateQuantifyApiClient.mockReturnValue(createContractMock() as never)

    const envWithPublicStagingDomain = {
      getString: jest.fn((key: string) => {
        if (key === 'APP_ENV') return 'staging'
        if (key === 'QUANTIFY_API_BASE_URL') return 'https://cfx-quantify-staging.devbase.cloud/api/v1'
        return undefined
      }),
      getNumber: jest.fn(() => undefined),
    }

    new QuantifyAiQuantClient(envWithPublicStagingDomain as any)

    expect(mockedCreateQuantifyApiClient).toHaveBeenCalledWith('http://127.0.0.1:3010/api/v1', {
      validate: 'all',
    })
  })

  it('calls the quantify contract alias instead of assembling account strategy urls by hand', async () => {
    const contract = createContractMock()
    contract.AccountStrategyViewController_list.mockResolvedValue({
      data: {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      },
    })
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const client = new QuantifyAiQuantClient(env as any)

    await expect(client.listAccountStrategies({
      page: 1,
      limit: 20,
      status: 'running',
      subscribedOnly: true,
      excludeDraft: true,
    }, {
      userId: 'user-1',
      headers: { authorization: 'Bearer token-1' },
    })).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    })

    expect(contract.AccountStrategyViewController_list).toHaveBeenCalledWith({
      queries: {
        userId: 'user-1',
        page: 1,
        limit: 20,
        status: 'running',
        subscribedOnly: true,
        excludeDraft: true,
      },
      headers: {
        'x-user-id': 'user-1',
        authorization: 'Bearer token-1',
      },
    })
  })

  it('returns payload.data for successful codegen responses', async () => {
    const contract = createContractMock()
    contract.LiveLlmStrategyCodegenController_startSession.mockResolvedValue({
      data: {
        id: 'session-1',
        status: 'CHECKLIST_GATE',
      },
    })
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const client = new QuantifyAiQuantClient(env as any)

    await expect(client.startCodegen({ foo: 'bar' }, {
      userId: 'user-1',
      headers: { authorization: 'Bearer test-token' },
    })).resolves.toEqual({
      id: 'session-1',
      status: 'CHECKLIST_GATE',
    })
  })

  it('throws a 502 client error when quantify returns non-json error bodies', async () => {
    const contract = createContractMock()
    contract.LiveLlmStrategyInstancesController_list.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 502,
        data: '<html>bad gateway</html>',
      },
    })
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const client = new QuantifyAiQuantClient(env as never)

    await expect(client.listLlmInstances({})).rejects.toMatchObject({
      status: 502,
      message: 'Quantify returned a non-JSON error response',
      args: {
        upstreamBody: '<html>bad gateway</html>',
      },
    })
  })

  it('converts request timeouts into QuantifyClientError without leaking raw Error construction', async () => {
    jest.useFakeTimers()
    const contract = createContractMock()
    contract.LiveLlmStrategyCodegenController_getSession.mockImplementation((config?: { signal?: AbortSignal }) => {
      const signal = config?.signal
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    })
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const envWithTimeout = {
      getString: jest.fn((key: string) => key === 'QUANTIFY_API_BASE_URL' ? 'http://quantify.test/api/v1' : undefined),
      getNumber: jest.fn((key: string) => key === 'QUANTIFY_REQUEST_TIMEOUT_MS' ? 1000 : undefined),
    }

    const client = new QuantifyAiQuantClient(envWithTimeout as any)
    const requestPromise = client.getCodegenSession('session-1', {
      userId: 'user-1',
      headers: { authorization: 'Bearer test-token' },
    })

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
  })

  it('prefers per-request timeout overrides over the global timeout setting', async () => {
    jest.useFakeTimers()
    const contract = createContractMock()
    contract.LiveLlmStrategyCodegenController_getSession.mockImplementation((config?: { signal?: AbortSignal }) => {
      const signal = config?.signal
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    })
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const envWithTimeout = {
      getString: jest.fn((key: string) => key === 'QUANTIFY_API_BASE_URL' ? 'http://quantify.test/api/v1' : undefined),
      getNumber: jest.fn((key: string) => key === 'QUANTIFY_REQUEST_TIMEOUT_MS' ? 1000 : undefined),
    }

    const client = new QuantifyAiQuantClient(envWithTimeout as any)
    const requestPromise = client.getCodegenSession('session-1', {
      userId: 'user-1',
      timeoutMs: 2500,
      headers: { authorization: 'Bearer test-token' },
    })

    const assertion = expect(requestPromise).rejects.toMatchObject({
      status: 502,
      message: 'Quantify request failed',
      code: 'UPSTREAM_REQUEST_FAILED',
      args: {
        cause: 'timeout after 2500ms',
      },
    })

    await jest.advanceTimersByTimeAsync(2500)

    await assertion
  })
})
