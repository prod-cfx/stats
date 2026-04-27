import { ErrorCode } from '@ai/shared'
import { AiQuantProxyService } from './ai-quant-proxy.service'
import { QuantifyClientError } from './clients/quantify-ai-quant.client'

describe('aiQuantProxyService', () => {
  const codegenTimeoutMs = 60_000

  function createService() {
    const quantifyClient = {
      listAccountStrategies: jest.fn(),
      get: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      performAccountStrategyAction: jest.fn(),
      deleteAccountStrategy: jest.fn(),
      listStrategyPlazaTemplates: jest.fn(),
      getStrategyPlazaTemplateDetail: jest.fn(),
      runStrategyPlazaTemplate: jest.fn(),
      startStrategyPlazaEditSession: jest.fn(),
      getDeployResult: jest.fn(),
      deployAccountStrategy: jest.fn(),
      updateAccountStrategyExecutionLeverage: jest.fn(),
      startCodegen: jest.fn(),
      continueCodegen: jest.fn(),
      getCodegenSession: jest.fn(),
      createLlmSubscription: jest.fn(),
      getBacktestCapabilities: jest.fn(),
      createBacktestJob: jest.fn(),
      checkBacktestSymbolSupport: jest.fn(),
      getBacktestJob: jest.fn(),
      getBacktestJobResult: jest.fn(),
    }
    const exchangeAccountsService = {
      list: jest.fn().mockResolvedValue([]),
    }

    const service = new AiQuantProxyService(quantifyClient as any, exchangeAccountsService as any)
    return { service, quantifyClient, exchangeAccountsService }
  }

  it('injects user identity and authorization into account strategy list requests', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.listAccountStrategies.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

    await service.listAccountStrategies('user-1', 'Bearer token-1', {
      page: 1,
      limit: 20,
      status: 'running',
      subscribedOnly: true,
      excludeDraft: true,
    })

    expect(quantifyClient.listAccountStrategies).toHaveBeenCalledWith(
      {
        page: 1,
        limit: 20,
        status: 'running',
        subscribedOnly: true,
        excludeDraft: true,
      },
      { userId: 'user-1', headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' } },
    )
  })

  it('keeps x-user-id header when authorization is absent', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.listAccountStrategies.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

    await service.listAccountStrategies('user-1', undefined, {
      page: 1,
      limit: 20,
      status: 'running',
      subscribedOnly: true,
      excludeDraft: true,
    })

    expect(quantifyClient.listAccountStrategies).toHaveBeenCalledWith(
      {
        page: 1,
        limit: 20,
        status: 'running',
        subscribedOnly: true,
        excludeDraft: true,
      },
      { userId: 'user-1', headers: { 'x-user-id': 'user-1' } },
    )
  })

  it('injects user identity and authorization into account strategy delete requests', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.deleteAccountStrategy.mockResolvedValue(undefined)

    await service.deleteAccountStrategy('user-1', 'Bearer token-1', 'strategy-1')

    expect(quantifyClient.deleteAccountStrategy).toHaveBeenCalledWith(
      'strategy-1',
      { userId: 'user-1', headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' } },
    )
  })

  it('forces caller identity when forwarding liquidate_and_stop strategy actions', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.performAccountStrategyAction.mockResolvedValue({ id: 'strategy-1', status: 'stopped' })

    await service.performAccountStrategyAction('user-1', 'Bearer token-1', 'strategy-1', {
      action: 'liquidate_and_stop',
      userId: 'attacker',
    })

    expect(quantifyClient.performAccountStrategyAction).toHaveBeenCalledWith(
      'strategy-1',
      {
        action: 'liquidate_and_stop',
        userId: 'user-1',
      },
      { userId: 'user-1', headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' } },
    )
  })

  it('forwards deploy payload with publishedSnapshotId as runtime truth', async () => {
    const { service, quantifyClient, exchangeAccountsService } = createService()
    quantifyClient.deployAccountStrategy.mockResolvedValue({ id: 'strategy-1', status: 'draft' })
    exchangeAccountsService.list.mockResolvedValue([{ id: 'acc-1' }])

    await service.deployAccountStrategy('user-1', 'Bearer token-1', {
      name: 'My Strategy',
      deployRequestId: 'deploy-req-1',
      publishedSnapshotId: 'snapshot-1',
      exchangeAccountId: 'acc-1',
      deploymentExecutionConfig: { leverage: 4 },
    })

    expect(quantifyClient.deployAccountStrategy).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        name: 'My Strategy',
        deployRequestId: 'deploy-req-1',
        publishedSnapshotId: 'snapshot-1',
        exchangeAccountId: 'acc-1',
        deploymentExecutionConfig: { leverage: 4 },
      },
      { userId: 'user-1', headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' } },
    )
  })

  it('forwards leverage-only execution updates with backend-controlled user identity', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.updateAccountStrategyExecutionLeverage.mockResolvedValue({ id: 'strategy-1', status: 'draft' })

    await service.updateAccountStrategyExecutionLeverage('user-1', 'Bearer token-1', 'strategy-1', {
      leverage: 6,
    })

    expect(quantifyClient.updateAccountStrategyExecutionLeverage).toHaveBeenCalledWith(
      'strategy-1',
      {
        userId: 'user-1',
        leverage: 6,
      },
      { userId: 'user-1', headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' } },
    )
  })

  it('retries deploy when quantify is transiently unavailable', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.deployAccountStrategy
      .mockRejectedValueOnce(new QuantifyClientError('upstream timeout', 502, 'UPSTREAM_REQUEST_FAILED'))
      .mockResolvedValueOnce({ id: 'strategy-1', status: 'draft' })

    await expect(service.deployAccountStrategy('user-1', 'Bearer token-1', {
      name: 'My Strategy',
      deployRequestId: 'deploy-req-retry-1',
      publishedSnapshotId: 'snapshot-retry-1',
    })).resolves.toEqual({ id: 'strategy-1', status: 'draft' })

    expect(quantifyClient.deployAccountStrategy).toHaveBeenCalledTimes(2)
  })

  it('reconciles deploy success by deployRequestId after the final transient upstream failure', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.deployAccountStrategy
      .mockRejectedValue(new QuantifyClientError('upstream timeout', 502, 'UPSTREAM_REQUEST_FAILED'))
    quantifyClient.getDeployResult.mockResolvedValue({ id: 'strategy-1', status: 'running' })

    await expect(service.deployAccountStrategy('user-1', 'Bearer token-1', {
      name: 'My Strategy',
      deployRequestId: 'deploy-req-reconcile-1',
      publishedSnapshotId: 'snapshot-reconcile-1',
    })).resolves.toEqual({ id: 'strategy-1', status: 'running' })

    expect(quantifyClient.deployAccountStrategy).toHaveBeenCalledTimes(3)
    expect(quantifyClient.getDeployResult).toHaveBeenCalledWith(
      'deploy-req-reconcile-1',
      { userId: 'user-1', headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' } },
    )
  })

  it('does not retry deploy for business validation errors', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.deployAccountStrategy.mockRejectedValue(new QuantifyClientError(
      'bad request',
      400,
      ErrorCode.BAD_REQUEST,
      { reasonMessage: 'bad request' },
    ))

    await expect(service.deployAccountStrategy('user-1', 'Bearer token-1', {
      name: 'My Strategy',
      deployRequestId: 'deploy-req-bad-1',
      publishedSnapshotId: 'snapshot-bad-1',
    })).rejects.toMatchObject({
      status: 400,
      code: ErrorCode.BAD_REQUEST,
    })

    expect(quantifyClient.deployAccountStrategy).toHaveBeenCalledTimes(1)
  })

  it('returns exchange account not found before calling quantify deploy', async () => {
    const { service, quantifyClient, exchangeAccountsService } = createService()
    exchangeAccountsService.list.mockResolvedValue([{ id: 'acc-1' }])

    await expect(service.deployAccountStrategy('user-1', 'Bearer token-1', {
      name: 'My Strategy',
      deployRequestId: 'deploy-req-account-not-found',
      publishedSnapshotId: 'snapshot-account-missing',
      exchangeAccountId: 'missing-acc',
    })).rejects.toMatchObject({
      status: 404,
      code: ErrorCode.EXCHANGE_ACCOUNT_NOT_FOUND,
    })

    expect(quantifyClient.deployAccountStrategy).not.toHaveBeenCalled()
  })

  it('forwards codegen start payload with authorization header', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.startCodegen.mockResolvedValue({ id: 'session-1', status: 'CONFIRM_GATE' })

    await service.startCodegen('user-1', 'Bearer token-1', {
      initialMessage: 'build me a strategy',
      guideConfig: { symbolExample: 'BTCUSDT' },
    })

    expect(quantifyClient.startCodegen).toHaveBeenCalledWith(
      {
        initialMessage: 'build me a strategy',
        guideConfig: { symbolExample: 'BTCUSDT' },
      },
      {
        userId: 'user-1',
        timeoutMs: codegenTimeoutMs,
        headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' },
      },
    )
  })

  it('forwards codegen continue payload without injecting userId', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.continueCodegen.mockResolvedValue({ id: 'session-1', status: 'CONFIRM_GATE' })

    await service.continueCodegen('user-1', 'Bearer token-1', 'session-1', {
      message: '继续',
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:canonical-1',
    })

    expect(quantifyClient.continueCodegen).toHaveBeenCalledWith(
      'session-1',
      {
        message: '继续',
        confirmGenerate: true,
        confirmedCanonicalDigest: 'sha256:canonical-1',
      },
      {
        userId: 'user-1',
        timeoutMs: codegenTimeoutMs,
        headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' },
      },
    )
  })

  it('proxies codegen session retrieval with authorization header', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.getCodegenSession.mockResolvedValue({ id: 'session-1', status: 'DRAFTING' })

    await service.getCodegenSession('user-1', 'Bearer token-1', 'session-1')

    expect(quantifyClient.getCodegenSession).toHaveBeenCalledWith(
      'session-1',
      {
        userId: 'user-1',
        timeoutMs: codegenTimeoutMs,
        headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' },
      },
    )
  })

  it('proxies AI Quant conversation list with authorization header', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.get.mockResolvedValue([{
      id: 'conv-1',
      activeCodegenSessionId: 'session-1',
      lastBacktestRef: {
        jobId: 'btjob-1',
        publishedSnapshotId: 'snapshot-1',
        summary: { maxDrawdownPct: 8, totalReturnPct: 12, winRatePct: 60, tradeCount: 5 },
        completedAt: '2026-04-23T00:04:00.000Z',
      },
    }])

    await expect(service.listAiQuantConversations('user-1', 'Bearer token-1')).resolves.toEqual([{
      id: 'conv-1',
      activeCodegenSessionId: 'session-1',
      lastBacktestRef: {
        jobId: 'btjob-1',
        publishedSnapshotId: 'snapshot-1',
        summary: { maxDrawdownPct: 8, totalReturnPct: 12, winRatePct: 60, tradeCount: 5 },
        completedAt: '2026-04-23T00:04:00.000Z',
      },
    }])

    expect(quantifyClient.get).toHaveBeenCalledWith(
      '/account/ai-quant/conversations',
      {
        timeoutMs: codegenTimeoutMs,
        headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' },
      },
    )
  })

  it('publicly proxies strategy plaza template list without user headers', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.listStrategyPlazaTemplates.mockResolvedValue([{ id: 'ma-cross' }])

    await expect(service.listStrategyPlazaTemplates()).resolves.toEqual([{ id: 'ma-cross' }])

    expect(quantifyClient.listStrategyPlazaTemplates).toHaveBeenCalledWith()
  })

  it('forwards strategy plaza run with user/auth headers and only runRequestId', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.runStrategyPlazaTemplate.mockResolvedValue({ id: 'strategy-1' })

    await service.runStrategyPlazaTemplate('user-1', 'Bearer token-1', 'ma-cross', {
      runRequestId: 'plaza-run-12345678',
      marketType: 'spot',
      symbol: 'ETH-USDT',
      positionPct: 99,
      leverage: 99,
    })

    expect(quantifyClient.runStrategyPlazaTemplate).toHaveBeenCalledWith(
      'ma-cross',
      { runRequestId: 'plaza-run-12345678' },
      { userId: 'user-1', headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' } },
    )
  })

  it('forwards strategy plaza edit session with user/auth headers and no body', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.startStrategyPlazaEditSession.mockResolvedValue({
      sessionId: 'session-1',
      templateId: 'ma-cross',
      initialMessage: 'Edit this strategy',
    })

    await service.startStrategyPlazaEditSession('user-1', 'Bearer token-1', 'ma-cross')

    expect(quantifyClient.startStrategyPlazaEditSession).toHaveBeenCalledWith(
      'ma-cross',
      { userId: 'user-1', headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' } },
    )
  })

  it('preserves strategy plaza okx demo key code and reason after service mapping', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.runStrategyPlazaTemplate.mockRejectedValue(new QuantifyClientError(
      'strategy_plaza.okx_demo_api_key_required',
      400,
      'strategy_plaza.okx_demo_api_key_required',
      {
        userId: 'user-1',
        reasonMessage: '请先绑定 OKX 模拟盘 API Key',
      },
    ))

    await expect(service.runStrategyPlazaTemplate('user-1', 'Bearer token-1', 'ma-cross', {
      runRequestId: 'plaza-run-12345678',
    })).rejects.toMatchObject({
      status: 400,
      code: 'strategy_plaza.okx_demo_api_key_required',
      message: '请先绑定 OKX 模拟盘 API Key',
      args: {
        userId: 'user-1',
        reasonMessage: '请先绑定 OKX 模拟盘 API Key',
      },
    })
  })

  it('maps transient AI Quant conversation list failures to service unavailable', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.get.mockRejectedValue(new QuantifyClientError(
      'Quantify returned a non-JSON error response',
      502,
      'UPSTREAM_INVALID_RESPONSE',
      { upstreamBody: '<html>502 Bad Gateway</html>' },
    ))

    await expect(service.listAiQuantConversations('user-1', 'Bearer token-1')).rejects.toMatchObject({
      status: 503,
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      args: expect.objectContaining({
        retryable: true,
        upstreamCode: 'UPSTREAM_INVALID_RESPONSE',
      }),
    })
  })

  it('proxies AI Quant backtest draft updates with authorization header', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.patch.mockResolvedValue(undefined)

    await expect(service.updateAiQuantConversationBacktestDraft(
      'user-1',
      'Bearer token-1',
      'conv-1',
      {
        backtestDraftConfig: {
          range: { preset: '7D' },
          execution: {
            initialCash: 10000,
            leverage: null,
            slippageBps: 10,
            feeBps: 5,
            priceSource: 'close',
            allowPartial: false,
          },
        },
      },
    )).resolves.toBeUndefined()

    expect(quantifyClient.patch).toHaveBeenCalledWith(
      '/account/ai-quant/conversations/conv-1/backtest-draft',
      {
        backtestDraftConfig: {
          range: { preset: '7D' },
          execution: {
            initialCash: 10000,
            leverage: null,
            slippageBps: 10,
            feeBps: 5,
            priceSource: 'close',
            allowPartial: false,
          },
        },
      },
      {
        timeoutMs: codegenTimeoutMs,
        headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' },
      },
    )
  })

  it('maps quantify client errors into domain exceptions', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.createLlmSubscription.mockRejectedValue(new QuantifyClientError(
      'exchange account not found',
      404,
      ErrorCode.EXCHANGE_ACCOUNT_NOT_FOUND,
      { reasonMessage: 'exchange account not found' },
    ))

    await expect(service.createLlmSubscription('user-1', {
      llmStrategyInstanceId: 'instance-1',
      exchangeAccountId: 'account-1',
    })).rejects.toMatchObject({
      code: ErrorCode.EXCHANGE_ACCOUNT_NOT_FOUND,
      message: 'exchange account not found',
    })
  })

  it('maps transient account strategy list upstream failures to service unavailable', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.listAccountStrategies.mockRejectedValue(new QuantifyClientError(
      'Quantify returned a non-JSON error response',
      502,
      'UPSTREAM_INVALID_RESPONSE',
      { upstreamBody: '<html>502 Bad Gateway</html>' },
    ))

    await expect(service.listAccountStrategies('user-1', 'Bearer token-1', {
      page: 1,
      limit: 20,
      subscribedOnly: true,
      excludeDraft: true,
    })).rejects.toMatchObject({
      status: 503,
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      message: '量化服务暂时不可用，请稍后重试',
      args: expect.objectContaining({
        reasonMessage: '量化服务暂时不可用，请稍后重试',
        retryable: true,
        upstreamCode: 'UPSTREAM_INVALID_RESPONSE',
      }),
    })
  })

  it('proxies backtesting capabilities with authorization header', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.getBacktestCapabilities.mockResolvedValue({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m'],
    })

    await service.getBacktestCapabilities('Bearer token-1')

    expect(quantifyClient.getBacktestCapabilities).toHaveBeenCalledWith({
      headers: { authorization: 'Bearer token-1' },
    })
  })

  it('forwards x-request-id header to backtesting capabilities proxy', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.getBacktestCapabilities.mockResolvedValue({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m'],
    })

    await service.getBacktestCapabilities('Bearer token-1', 'req-1')

    expect(quantifyClient.getBacktestCapabilities).toHaveBeenCalledWith({
      headers: { authorization: 'Bearer token-1', 'x-request-id': 'req-1' },
    })
  })

  it('retries backtesting capabilities on transient upstream connection failure', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.getBacktestCapabilities
      .mockRejectedValueOnce(new QuantifyClientError('Quantify request failed', 502, 'UPSTREAM_REQUEST_FAILED'))
      .mockResolvedValueOnce({
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m'],
      })

    const result = await service.getBacktestCapabilities('Bearer token-1')

    expect(result).toEqual({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m'],
    })
    expect(quantifyClient.getBacktestCapabilities).toHaveBeenCalledTimes(2)
  })

  it('surfaces transient upstream capability failures explicitly after retry exhaustion', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.getBacktestCapabilities.mockRejectedValue(new QuantifyClientError('Quantify request failed', 502, 'UPSTREAM_REQUEST_FAILED'))

    await expect(service.getBacktestCapabilities('Bearer token-1')).rejects.toMatchObject({
      status: 503,
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      message: '量化服务暂时不可用，请稍后重试',
      args: expect.objectContaining({
        reasonMessage: '量化服务暂时不可用，请稍后重试',
        retryable: true,
        upstreamCode: 'UPSTREAM_REQUEST_FAILED',
      }),
    })
    expect(quantifyClient.getBacktestCapabilities).toHaveBeenCalledTimes(3)
  })

  it('keeps business error semantics for backtesting capabilities', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.getBacktestCapabilities.mockRejectedValue(new QuantifyClientError(
      'not found',
      404,
      ErrorCode.NOT_FOUND,
      { reasonMessage: 'not found' },
    ))

    await expect(service.getBacktestCapabilities('Bearer token-1')).rejects.toMatchObject({
      status: 404,
      code: ErrorCode.NOT_FOUND,
      message: 'not found',
    })
  })

  it('does not degrade internal exceptions for backtesting capabilities', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.getBacktestCapabilities.mockRejectedValue(new Error('unexpected'))

    await expect(service.getBacktestCapabilities('Bearer token-1')).rejects.toMatchObject({
      status: 500,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Quantify request failed',
    })
  })

  it('proxies backtesting jobs and result endpoints', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.createBacktestJob.mockResolvedValue({ id: 'job-1', status: 'queued' })
    quantifyClient.getBacktestJob.mockResolvedValue({ id: 'job-1', status: 'running' })
    quantifyClient.getBacktestJobResult.mockResolvedValue({ id: 'job-1', status: 'running' })

    const payload = { symbols: ['BTCUSDT'] }
    await service.createBacktestJob('user-1', 'Bearer token-1', payload)
    await service.getBacktestJob('user-1', 'Bearer token-1', 'job-1')
    await service.getBacktestJobResult('user-1', 'Bearer token-1', 'job-1')

    expect(quantifyClient.createBacktestJob).toHaveBeenCalledWith(payload, {
      userId: 'user-1',
      headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' },
    })
    expect(quantifyClient.getBacktestJob).toHaveBeenCalledWith('job-1', {
      userId: 'user-1',
      headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' },
    })
    expect(quantifyClient.getBacktestJobResult).toHaveBeenCalledWith('job-1', {
      userId: 'user-1',
      headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' },
    })
  })

  it('proxies backtesting symbol support check', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.checkBacktestSymbolSupport.mockResolvedValue({ status: 'supported' })

    await expect(service.checkBacktestSymbolSupport('user-1', 'Bearer token-1', {
      exchange: 'okx',
      symbol: 'ETHUSDC',
    })).resolves.toEqual({ status: 'supported' })

    expect(quantifyClient.checkBacktestSymbolSupport).toHaveBeenCalledWith({
      exchange: 'okx',
      symbol: 'ETHUSDC',
    }, {
      userId: 'user-1',
      headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' },
    })
  })

  it('forwards x-request-id header for backtesting jobs endpoints', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.createBacktestJob.mockResolvedValue({ id: 'job-1', status: 'queued' })
    quantifyClient.getBacktestJob.mockResolvedValue({ id: 'job-1', status: 'running' })
    quantifyClient.getBacktestJobResult.mockResolvedValue({ id: 'job-1', status: 'running' })

    await service.createBacktestJob('user-1', 'Bearer token-1', { symbols: ['BTCUSDT'] }, 'req-1')
    await service.getBacktestJob('user-1', 'Bearer token-1', 'job-1', 'req-1')
    await service.getBacktestJobResult('user-1', 'Bearer token-1', 'job-1', 'req-1')

    expect(quantifyClient.createBacktestJob).toHaveBeenCalledWith({ symbols: ['BTCUSDT'] }, {
      userId: 'user-1',
      headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1', 'x-request-id': 'req-1' },
    })
    expect(quantifyClient.getBacktestJob).toHaveBeenCalledWith('job-1', {
      userId: 'user-1',
      headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1', 'x-request-id': 'req-1' },
    })
    expect(quantifyClient.getBacktestJobResult).toHaveBeenCalledWith('job-1', {
      userId: 'user-1',
      headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1', 'x-request-id': 'req-1' },
    })
  })

  it('forwards x-request-id header for backtesting symbol support check', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.checkBacktestSymbolSupport.mockResolvedValue({ status: 'supported' })

    await service.checkBacktestSymbolSupport('user-1', 'Bearer token-1', {
      exchange: 'okx',
      symbol: 'ETHUSDC',
    }, 'req-1')

    expect(quantifyClient.checkBacktestSymbolSupport).toHaveBeenCalledWith({
      exchange: 'okx',
      symbol: 'ETHUSDC',
    }, {
      userId: 'user-1',
      headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1', 'x-request-id': 'req-1' },
    })
  })

  it('maps transient upstream error to retryable error for create backtesting job', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.createBacktestJob.mockRejectedValue(new QuantifyClientError('upstream timeout', 502, 'UPSTREAM_REQUEST_FAILED'))

    await expect(service.createBacktestJob('user-1', 'Bearer token-1', { symbols: ['BTCUSDT'] })).rejects.toMatchObject({
      status: 503,
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
    })
  })

  it('maps transient upstream error to retryable error for get backtesting job', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.getBacktestJob.mockRejectedValue(new QuantifyClientError('gateway', 503, 'UPSTREAM_REQUEST_FAILED'))

    await expect(service.getBacktestJob('user-1', 'Bearer token-1', 'job-1')).rejects.toMatchObject({
      status: 503,
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
    })
  })

  it('retries transient upstream failure for get backtesting job and eventually succeeds', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.getBacktestJob
      .mockRejectedValueOnce(new QuantifyClientError('gateway', 503, 'UPSTREAM_REQUEST_FAILED'))
      .mockResolvedValueOnce({ id: 'job-1', status: 'running' })

    await expect(service.getBacktestJob('user-1', 'Bearer token-1', 'job-1', 'req-1')).resolves.toEqual({
      id: 'job-1',
      status: 'running',
    })

    expect(quantifyClient.getBacktestJob).toHaveBeenCalledTimes(2)
  })

  it('maps transient upstream error to retryable error for get backtesting job result', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.getBacktestJobResult.mockRejectedValue(new QuantifyClientError('gateway', 502, 'UPSTREAM_INVALID_RESPONSE'))

    await expect(service.getBacktestJobResult('user-1', 'Bearer token-1', 'job-1')).rejects.toMatchObject({
      status: 503,
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
    })
  })

  it('retries transient upstream failure for get backtesting job result and eventually succeeds', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.getBacktestJobResult
      .mockRejectedValueOnce(new QuantifyClientError('gateway', 502, 'UPSTREAM_INVALID_RESPONSE'))
      .mockResolvedValueOnce({ id: 'job-1', status: 'succeeded' })

    await expect(service.getBacktestJobResult('user-1', 'Bearer token-1', 'job-1', 'req-1')).resolves.toEqual({
      id: 'job-1',
      status: 'succeeded',
    })

    expect(quantifyClient.getBacktestJobResult).toHaveBeenCalledTimes(2)
  })

  it('preserves business error when creating backtesting job fails', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.createBacktestJob.mockRejectedValue(new QuantifyClientError(
      'bad request',
      400,
      ErrorCode.BAD_REQUEST,
      { reasonMessage: 'bad request' },
    ))

    await expect(service.createBacktestJob('user-1', 'Bearer token-1', { symbols: ['BTCUSDT'] })).rejects.toMatchObject({
      status: 400,
      code: ErrorCode.BAD_REQUEST,
      message: 'bad request',
    })
  })
})
