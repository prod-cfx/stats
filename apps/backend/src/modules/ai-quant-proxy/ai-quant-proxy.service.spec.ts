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

  it('forwards x-request-id header to backtesting capabilities proxy', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.get.mockResolvedValue({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m'],
    })

    await service.getBacktestCapabilities('Bearer token-1', 'req-1')

    expect(quantifyClient.get).toHaveBeenCalledWith('/backtesting/capabilities', {
      headers: { authorization: 'Bearer token-1', 'x-request-id': 'req-1' },
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

  it('returns empty capabilities when transient upstream errors persist', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.get.mockRejectedValue(new QuantifyClientError('Quantify request failed', 502, 'UPSTREAM_REQUEST_FAILED'))

    await expect(service.getBacktestCapabilities('Bearer token-1')).resolves.toEqual({
      allowedSymbols: [],
      allowedBaseTimeframes: [],
    })
    expect(quantifyClient.get).toHaveBeenCalledTimes(3)
  })

  it('keeps business error semantics for backtesting capabilities', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.get.mockRejectedValue(new QuantifyClientError(
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
    quantifyClient.get.mockRejectedValue(new Error('unexpected'))

    await expect(service.getBacktestCapabilities('Bearer token-1')).rejects.toMatchObject({
      status: 500,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Quantify request failed',
    })
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

  it('forwards x-request-id header for backtesting jobs endpoints', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.post.mockResolvedValue({ id: 'job-1', status: 'queued' })
    quantifyClient.get.mockResolvedValue({ id: 'job-1', status: 'running' })

    await service.createBacktestJob('Bearer token-1', { symbols: ['BTCUSDT'] }, 'req-1')
    await service.getBacktestJob('Bearer token-1', 'job-1', 'req-1')
    await service.getBacktestJobResult('Bearer token-1', 'job-1', 'req-1')

    expect(quantifyClient.post).toHaveBeenCalledWith('/backtesting/jobs', { symbols: ['BTCUSDT'] }, {
      headers: { authorization: 'Bearer token-1', 'x-request-id': 'req-1' },
    })
    expect(quantifyClient.get).toHaveBeenNthCalledWith(1, '/backtesting/jobs/job-1', {
      headers: { authorization: 'Bearer token-1', 'x-request-id': 'req-1' },
    })
    expect(quantifyClient.get).toHaveBeenNthCalledWith(2, '/backtesting/jobs/job-1/result', {
      headers: { authorization: 'Bearer token-1', 'x-request-id': 'req-1' },
    })
  })

  it('maps transient upstream error to retryable error for create backtesting job', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.post.mockRejectedValue(new QuantifyClientError('upstream timeout', 502, 'UPSTREAM_REQUEST_FAILED'))

    await expect(service.createBacktestJob('Bearer token-1', { symbols: ['BTCUSDT'] })).rejects.toMatchObject({
      status: 503,
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
    })
  })

  it('maps transient upstream error to retryable error for get backtesting job', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.get.mockRejectedValue(new QuantifyClientError('gateway', 503, 'UPSTREAM_REQUEST_FAILED'))

    await expect(service.getBacktestJob('Bearer token-1', 'job-1')).rejects.toMatchObject({
      status: 503,
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
    })
  })

  it('maps transient upstream error to retryable error for get backtesting job result', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.get.mockRejectedValue(new QuantifyClientError('gateway', 502, 'UPSTREAM_INVALID_RESPONSE'))

    await expect(service.getBacktestJobResult('Bearer token-1', 'job-1')).rejects.toMatchObject({
      status: 503,
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
    })
  })

  it('preserves business error when creating backtesting job fails', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.post.mockRejectedValue(new QuantifyClientError(
      'bad request',
      400,
      ErrorCode.BAD_REQUEST,
      { reasonMessage: 'bad request' },
    ))

    await expect(service.createBacktestJob('Bearer token-1', { symbols: ['BTCUSDT'] })).rejects.toMatchObject({
      status: 400,
      code: ErrorCode.BAD_REQUEST,
      message: 'bad request',
    })
  })
})
