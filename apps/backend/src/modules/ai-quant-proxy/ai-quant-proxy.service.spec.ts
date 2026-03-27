import { ErrorCode } from '@ai/shared'
import { AiQuantProxyService } from './ai-quant-proxy.service'
import { QuantifyClientError } from './clients/quantify-ai-quant.client'

describe('aiQuantProxyService', () => {
  function createService() {
    const quantifyClient = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    }

    const service = new AiQuantProxyService(quantifyClient as any)
    return { service, quantifyClient }
  }

  it('injects user identity and authorization into account strategy list requests', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.get.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

    await service.listAccountStrategies('user-1', 'Bearer token-1', {
      page: 1,
      limit: 20,
      status: 'running',
    })

    expect(quantifyClient.get).toHaveBeenCalledWith(
      '/account/ai-quant/strategies?userId=user-1&page=1&limit=20&status=running',
      { headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' } },
    )
  })

  it('keeps x-user-id header when authorization is absent', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.get.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

    await service.listAccountStrategies('user-1', undefined, {
      page: 1,
      limit: 20,
      status: 'running',
    })

    expect(quantifyClient.get).toHaveBeenCalledWith(
      '/account/ai-quant/strategies?userId=user-1&page=1&limit=20&status=running',
      { headers: { 'x-user-id': 'user-1' } },
    )
  })

  it('injects user identity and authorization into account strategy delete requests', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.delete.mockResolvedValue(undefined)

    await service.deleteAccountStrategy('user-1', 'Bearer token-1', 'strategy-1')

    expect(quantifyClient.delete).toHaveBeenCalledWith(
      '/account/ai-quant/strategies/strategy-1?userId=user-1',
      { headers: { 'x-user-id': 'user-1', authorization: 'Bearer token-1' } },
    )
  })

  it('forwards codegen start payload with authorization header', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.post.mockResolvedValue({ id: 'session-1', status: 'CHECKLIST_GATE' })

    await service.startCodegen('Bearer token-1', {
      initialMessage: 'build me a strategy',
      symbols: ['BTCUSDT'],
    })

    expect(quantifyClient.post).toHaveBeenCalledWith(
      '/llm-strategy-codegen/sessions',
      {
        initialMessage: 'build me a strategy',
        symbols: ['BTCUSDT'],
      },
      {
        headers: { authorization: 'Bearer token-1' },
      },
    )
  })

  it('forwards codegen continue payload without injecting userId', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.post.mockResolvedValue({ id: 'session-1', status: 'CHECKLIST_GATE' })

    await service.continueCodegen('Bearer token-1', 'session-1', {
      message: '继续',
      confirmGenerate: false,
    })

    expect(quantifyClient.post).toHaveBeenCalledWith(
      '/llm-strategy-codegen/sessions/session-1/messages',
      {
        message: '继续',
        confirmGenerate: false,
      },
      {
        headers: { authorization: 'Bearer token-1' },
      },
    )
  })

  it('proxies codegen session retrieval with authorization header', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.get.mockResolvedValue({ id: 'session-1', status: 'DRAFTING' })

    await service.getCodegenSession('Bearer token-1', 'session-1')

    expect(quantifyClient.get).toHaveBeenCalledWith(
      '/llm-strategy-codegen/sessions/session-1',
      {
        headers: { authorization: 'Bearer token-1' },
      },
    )
  })

  it('maps quantify client errors into domain exceptions', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.post.mockRejectedValue(new QuantifyClientError(
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

  it('proxies backtesting capabilities with authorization header', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.get.mockResolvedValue({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m'],
    })

    await service.getBacktestCapabilities('Bearer token-1')

    expect(quantifyClient.get).toHaveBeenCalledWith('/backtesting/capabilities', {
      headers: { authorization: 'Bearer token-1' },
    })
  })

  it('retries backtesting capabilities on transient upstream connection failure', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.get
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
    expect(quantifyClient.get).toHaveBeenCalledTimes(2)
  })

  it('proxies backtesting jobs and result endpoints', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.post.mockResolvedValue({ id: 'job-1', status: 'queued' })
    quantifyClient.get.mockResolvedValue({ id: 'job-1', status: 'running' })

    const payload = { symbols: ['BTCUSDT'] }
    await service.createBacktestJob('Bearer token-1', payload)
    await service.getBacktestJob('Bearer token-1', 'job-1')
    await service.getBacktestJobResult('Bearer token-1', 'job-1')

    expect(quantifyClient.post).toHaveBeenCalledWith('/backtesting/jobs', payload, {
      headers: { authorization: 'Bearer token-1' },
    })
    expect(quantifyClient.get).toHaveBeenNthCalledWith(1, '/backtesting/jobs/job-1', {
      headers: { authorization: 'Bearer token-1' },
    })
    expect(quantifyClient.get).toHaveBeenNthCalledWith(2, '/backtesting/jobs/job-1/result', {
      headers: { authorization: 'Bearer token-1' },
    })
  })
})
