import { DomainException } from '@/common/exceptions/domain.exception'
import { DeployIdempotencyConflictException } from '../exceptions'
import { AccountStrategyViewService } from './account-strategy-view.service'

describe('accountStrategyViewService.deployStrategy safety', () => {
  const buildService = (overrides?: Record<string, unknown>) => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      ...(overrides ?? {}),
    }
    const statsService = { calculateStats: jest.fn(), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = {
      ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined),
    }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
      undefined as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-1' } as any)

    return { service, repo }
  }

  it('requires deployRequestId', async () => {
    const { service } = buildService()

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'OKX SOL 5m',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
    } as any)).rejects.toBeInstanceOf(DomainException)
  })

  it('returns existing result for succeeded idempotent request', async () => {
    const { service, repo } = buildService({
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue({
        id: 'req-1',
        deployRequestId: 'same-1',
        payloadHash: 'da9e0957006d451fea0880e20b99900b5fe6f9f9511036865c189e1bcca61244',
        status: 'SUCCEEDED',
        strategyInstanceId: 'inst-existing',
      }),
    })

    await service.deployStrategy({
      userId: 'user-1',
      deployRequestId: 'same-1',
      name: 'OKX SOL 5m',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
    } as any)

    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
    expect(service.getStrategyDetail).toHaveBeenCalledWith('user-1', 'inst-existing')
  })

  it('rejects idempotent conflict when same request id has different payload', async () => {
    const { service } = buildService({
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue({
        id: 'req-1',
        deployRequestId: 'same-1',
        payloadHash: 'different-hash',
        status: 'SUCCEEDED',
        strategyInstanceId: 'inst-existing',
      }),
    })

    await expect(service.deployStrategy({
      userId: 'user-1',
      deployRequestId: 'same-1',
      name: 'OKX SOL 5m',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
    } as any)).rejects.toBeInstanceOf(DeployIdempotencyConflictException)
  })
})
