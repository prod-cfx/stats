import type { AuthenticatedUser } from '../../common/types/authenticated-user.type'
import { ErrorCode } from '@ai/shared'
import { AiQuantProxyService } from './ai-quant-proxy.service'
import { QuantifyClientError } from './clients/quantify-ai-quant.client'

describe('aiQuantProxyService', () => {
  const authenticatedUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'user-1@example.com',
    roles: [],
    principalType: 'user',
  }

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

  it('injects authenticated user id into codegen start requests', async () => {
    const { service, quantifyClient } = createService()
    quantifyClient.post.mockResolvedValue({ id: 'session-1', status: 'CHECKLIST_GATE' })

    await service.startCodegen(authenticatedUser, {
      initialMessage: 'build me a strategy',
      symbols: ['BTCUSDT'],
    })

    expect(quantifyClient.post).toHaveBeenCalledWith('/llm-strategy-codegen/sessions', {
      userId: 'user-1',
      initialMessage: 'build me a strategy',
      symbols: ['BTCUSDT'],
    })
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
