import { createQuantifyApiClient } from '@ai/api-contracts'
import { QuantifyAiQuantClient } from './quantify-ai-quant.client'

jest.mock('@ai/api-contracts', () => ({
  createQuantifyApiClient: jest.fn(),
}))

describe('quantifyAiQuantClient', () => {
  const mockedCreateQuantifyApiClient = jest.mocked(createQuantifyApiClient)

  function createContractMock() {
    return {
      AccountStrategyViewController_detail: jest.fn(),
      AccountStrategyViewController_list: jest.fn(),
      AccountStrategyViewController_deploy: jest.fn(),
      AccountStrategyViewController_updateDeploymentLeverage: jest.fn(),
      BacktestingController_getCapabilities: jest.fn(),
      BacktestingController_createJob: jest.fn(),
      BacktestingController_checkSymbolSupport: jest.fn(),
      BacktestingController_getJob: jest.fn(),
      BacktestingController_getJobResult: jest.fn(),
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
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('creates the quantify contract client with the configured api base url', () => {
    mockedCreateQuantifyApiClient.mockReturnValue(createContractMock() as never)

    const client = new QuantifyAiQuantClient(env as any)

    expect(client).toBeInstanceOf(QuantifyAiQuantClient)
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

    const client = new QuantifyAiQuantClient(envWithBaseOnly as any)

    expect(client).toBeInstanceOf(QuantifyAiQuantClient)
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

    const client = new QuantifyAiQuantClient(envWithPathBase as any)

    expect(client).toBeInstanceOf(QuantifyAiQuantClient)
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

    const client = new QuantifyAiQuantClient(envWithPlaceholder as any)

    expect(client).toBeInstanceOf(QuantifyAiQuantClient)
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

    const client = new QuantifyAiQuantClient(envWithPublicStagingDomain as any)

    expect(client).toBeInstanceOf(QuantifyAiQuantClient)
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

  it('uses the detail contract alias for account strategy detail passthrough', async () => {
    const contract = createContractMock()
    contract.AccountStrategyViewController_detail.mockResolvedValue({
      data: {
        id: 'strategy-1',
        snapshot: {
          backtestConfigDefaults: { leverage: 1 },
          deploymentExecutionBaseline: { leverage: 2 },
          deploymentExecutionCurrent: { leverage: 3 },
          compatibilityMetadata: { isLegacySnapshot: false },
          executionConfigVersion: 1,
        },
      },
    })
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const client = new QuantifyAiQuantClient(env as any)

    await expect(client.getAccountStrategyDetail('strategy-1', {
      userId: 'user-1',
      headers: { authorization: 'Bearer token-1' },
    })).resolves.toEqual({
      id: 'strategy-1',
      snapshot: {
        backtestConfigDefaults: { leverage: 1 },
        deploymentExecutionBaseline: { leverage: 2 },
        deploymentExecutionCurrent: { leverage: 3 },
        compatibilityMetadata: { isLegacySnapshot: false },
        executionConfigVersion: 1,
      },
    })

    expect(contract.AccountStrategyViewController_detail).toHaveBeenCalledWith({
      params: { id: 'strategy-1' },
      headers: {
        'x-user-id': 'user-1',
        authorization: 'Bearer token-1',
      },
    })
  })

  it('uses the deploy contract alias for execution-config passthrough', async () => {
    const contract = createContractMock()
    contract.AccountStrategyViewController_deploy.mockResolvedValue({
      data: {
        id: 'strategy-1',
        snapshot: {
          deploymentExecutionCurrent: { leverage: 4 },
          executionConfigVersion: 1,
        },
      },
    })
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const client = new QuantifyAiQuantClient(env as any)

    await expect(client.deployAccountStrategy({
      publishedSnapshotId: 'snapshot-1',
      name: 'My Strategy',
      deployRequestId: 'deploy-1',
      deploymentExecutionConfig: { leverage: 4 },
    }, {
      userId: 'user-1',
      headers: { authorization: 'Bearer token-1' },
    })).resolves.toEqual({
      id: 'strategy-1',
      snapshot: {
        deploymentExecutionCurrent: { leverage: 4 },
        executionConfigVersion: 1,
      },
    })

    expect(contract.AccountStrategyViewController_deploy).toHaveBeenCalledWith({
      publishedSnapshotId: 'snapshot-1',
      name: 'My Strategy',
      deployRequestId: 'deploy-1',
      deploymentExecutionConfig: { leverage: 4 },
    }, {
      headers: {
        'x-user-id': 'user-1',
        authorization: 'Bearer token-1',
      },
    })
  })

  it('uses the leverage-only contract alias for post-deploy execution updates', async () => {
    const contract = createContractMock()
    contract.AccountStrategyViewController_updateDeploymentLeverage.mockResolvedValue({
      data: {
        id: 'strategy-1',
        snapshot: {
          deploymentExecutionCurrent: { leverage: 6 },
          executionConfigVersion: 2,
        },
      },
    })
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const client = new QuantifyAiQuantClient(env as any)

    await expect(client.updateAccountStrategyExecutionLeverage('strategy-1', {
      leverage: 6,
    }, {
      userId: 'user-1',
      headers: { authorization: 'Bearer token-1' },
    })).resolves.toEqual({
      id: 'strategy-1',
      snapshot: {
        deploymentExecutionCurrent: { leverage: 6 },
        executionConfigVersion: 2,
      },
    })

    expect(contract.AccountStrategyViewController_updateDeploymentLeverage).toHaveBeenCalledWith({
      leverage: 6,
    }, {
      params: { id: 'strategy-1' },
      headers: {
        'x-user-id': 'user-1',
        authorization: 'Bearer token-1',
      },
    })
  })

  it('unwraps transport-envelope backtesting capabilities responses from the contract alias', async () => {
    const contract = createContractMock()
    contract.BacktestingController_getCapabilities.mockResolvedValue({
      data: {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m'],
      },
      message: 'Success',
    })
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const client = new QuantifyAiQuantClient(env as any)

    await expect(client.getBacktestCapabilities({
      headers: {
        authorization: 'Bearer token-1',
        'x-request-id': 'req-1',
      },
    })).resolves.toEqual({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m'],
    })

    expect(contract.BacktestingController_getCapabilities).toHaveBeenCalledWith({
      headers: {
        authorization: 'Bearer token-1',
        'x-request-id': 'req-1',
      },
    })
  })

  it('unwraps transport-envelope create-job responses from the contract alias', async () => {
    const contract = createContractMock()
    contract.BacktestingController_createJob.mockResolvedValue({
      data: {
        id: 'job-1',
        status: 'queued',
      },
      message: 'Success',
    })
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const client = new QuantifyAiQuantClient(env as any)

    await expect(client.createBacktestJob({
      symbol: 'BTCUSDT',
    }, {
      userId: 'user-1',
      headers: {
        authorization: 'Bearer token-1',
        'x-request-id': 'req-1',
      },
    })).resolves.toEqual({
      id: 'job-1',
      status: 'queued',
    })

    expect(contract.BacktestingController_createJob).toHaveBeenCalledWith({
      symbol: 'BTCUSDT',
    }, {
      headers: {
        'x-user-id': 'user-1',
        authorization: 'Bearer token-1',
        'x-request-id': 'req-1',
      },
    })
  })

  it('uses the raw json transport for startCodegen when the contract lane is unavailable', async () => {
    const contract = createContractMock()
    contract.LiveLlmStrategyCodegenController_startSession.mockRejectedValue(new Error('zod parse failed'))
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({
        data: {
          id: 'session-1',
          status: 'CONFIRM_GATE',
        },
      }),
    } as Response)

    const client = new QuantifyAiQuantClient(env as any)

    await expect(client.startCodegen({ foo: 'bar' }, {
      userId: 'user-1',
      headers: { authorization: 'Bearer test-token' },
    })).resolves.toEqual({
      id: 'session-1',
      status: 'CONFIRM_GATE',
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://quantify.test/api/v1/llm-strategy-codegen/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-user-id': 'user-1',
          authorization: 'Bearer test-token',
        }),
        body: JSON.stringify({ foo: 'bar' }),
      }),
    )
  })

  it('uses the raw json transport for getCodegenSession when the contract lane is unavailable', async () => {
    const contract = createContractMock()
    contract.LiveLlmStrategyCodegenController_getSession.mockRejectedValue(new Error('zod parse failed'))
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        data: {
          id: 'session-1',
          status: 'DRAFTING',
          conversationId: null,
        },
      }),
    } as Response)

    const client = new QuantifyAiQuantClient(env as any)

    await expect(client.getCodegenSession('session-1', {
      userId: 'user-1',
      headers: { authorization: 'Bearer test-token' },
    })).resolves.toEqual({
      id: 'session-1',
      status: 'DRAFTING',
      conversationId: null,
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://quantify.test/api/v1/llm-strategy-codegen/sessions/session-1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-user-id': 'user-1',
          authorization: 'Bearer test-token',
        }),
      }),
    )
  })

  it('uses the raw json transport for continueCodegen when the contract lane is unavailable', async () => {
    const contract = createContractMock()
    contract.LiveLlmStrategyCodegenController_continueSession.mockRejectedValue(new Error('zod parse failed'))
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => JSON.stringify({
        data: {
          id: 'session-1',
          status: 'GENERATING',
        },
      }),
    } as Response)

    const client = new QuantifyAiQuantClient(env as any)

    await expect(client.continueCodegen('session-1', { confirmedCanonicalDigest: 'sha256:abc' }, {
      userId: 'user-1',
      headers: { authorization: 'Bearer test-token' },
    })).resolves.toEqual({
      id: 'session-1',
      status: 'GENERATING',
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://quantify.test/api/v1/llm-strategy-codegen/sessions/session-1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-user-id': 'user-1',
          authorization: 'Bearer test-token',
        }),
        body: JSON.stringify({ confirmedCanonicalDigest: 'sha256:abc' }),
      }),
    )
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

  it('falls back to localhost when staging QUANTIFY_BASE_URL points to the public quantify domain', async () => {
    const envWithPublicStagingBaseUrl = {
      getString: jest.fn((key: string) => {
        if (key === 'APP_ENV') return 'staging'
        if (key === 'QUANTIFY_API_BASE_URL') return undefined
        if (key === 'QUANTIFY_BASE_URL') return 'https://cfx-quantify-staging.devbase.cloud'
        return undefined
      }),
      getNumber: jest.fn(() => undefined),
    }

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { ok: true } }),
    } as Response)

    const client = new QuantifyAiQuantClient(envWithPublicStagingBaseUrl as any)
    await expect(client.get('/account/ai-quant/conversations')).resolves.toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:3010/api/v1/account/ai-quant/conversations',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('converts request timeouts into QuantifyClientError without leaking raw Error construction', async () => {
    jest.useFakeTimers()
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation((_, config) => {
      const signal = (config as { signal?: AbortSignal } | undefined)?.signal
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    })
    mockedCreateQuantifyApiClient.mockReturnValue(createContractMock() as never)

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
    fetchSpy.mockRestore()
  })

  it('prefers per-request timeout overrides over the global timeout setting', async () => {
    jest.useFakeTimers()
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation((_, config) => {
      const signal = (config as { signal?: AbortSignal } | undefined)?.signal
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    })
    mockedCreateQuantifyApiClient.mockReturnValue(createContractMock() as never)

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
    fetchSpy.mockRestore()
  })
})
