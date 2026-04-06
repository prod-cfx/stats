import { createHash } from 'node:crypto'

import { DomainException } from '@/common/exceptions/domain.exception'
import { DeployIdempotencyConflictException } from '../exceptions'
import { AccountStrategyViewService } from './account-strategy-view.service'

function buildDeployPayloadHash(input: {
  name: string
  publishedSnapshotId?: string
  exchangeAccountId?: string
  strategyInstanceId?: string
  mode?: string
}): string {
  return createHash('sha256')
    .update(JSON.stringify({
      name: input.name,
      publishedSnapshotId: input.publishedSnapshotId,
      exchangeAccountId: input.exchangeAccountId ?? null,
      strategyInstanceId: input.strategyInstanceId ?? null,
      mode: input.mode ?? null,
    }))
    .digest('hex')
}

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
    const dto = {
      userId: 'user-1',
      deployRequestId: 'same-1',
      name: 'OKX SOL 5m',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
    } as const
    const { service, repo } = buildService({
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue({
        id: 'req-1',
        deployRequestId: 'same-1',
        payloadHash: buildDeployPayloadHash({
          name: dto.name,
        }),
        status: 'SUCCEEDED',
        strategyInstanceId: 'inst-existing',
      }),
    })

    await service.deployStrategy(dto as any)

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

  it('maps create-deploy unique conflict (P2002) to idempotency conflict', async () => {
    const { service } = buildService({
      createDeployRequestProcessing: jest.fn().mockRejectedValue({ code: 'P2002' }),
      findDeployRequestByUserAndRequestId: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'req-1',
          deployRequestId: 'same-2',
          payloadHash: 'same-hash',
          status: 'PROCESSING',
          strategyInstanceId: null,
        }),
    })

    await expect(service.deployStrategy({
      userId: 'user-1',
      deployRequestId: 'same-2',
      name: 'OKX SOL 5m',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
    } as any)).rejects.toBeInstanceOf(DeployIdempotencyConflictException)
  })

  it('rethrows non-unique create-deploy errors instead of turning them into idempotency conflict', async () => {
    const { service } = buildService({
      createDeployRequestProcessing: jest.fn().mockRejectedValue(new Error('fk constraint failed')),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
    })

    await expect(service.deployStrategy({
      userId: 'user-1',
      deployRequestId: 'same-3',
      name: 'OKX SOL 5m',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
    } as any)).rejects.toThrow('fk constraint failed')
  })
})
