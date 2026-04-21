import { createHash } from 'node:crypto'

import { DomainException } from '@/common/exceptions/domain.exception'
import { DeployIdempotencyConflictException, DeploySnapshotRequiresRepublishException } from '../exceptions'
import { AccountStrategyViewService } from './account-strategy-view.service'

function buildDeployPayloadHash(input: {
  name: string
  publishedSnapshotId?: string
  exchangeAccountId?: string
  mode?: string
  leverage?: number | null
}): string {
  return createHash('sha256')
    .update(JSON.stringify({
      name: input.name,
      publishedSnapshotId: input.publishedSnapshotId,
      exchangeAccountId: input.exchangeAccountId ?? null,
      mode: input.mode ?? null,
      leverage: input.leverage ?? null,
    }))
    .digest('hex')
}

describe('accountStrategyViewService.deployStrategy safety', () => {
  const structuredRuntimeExecutionSemantics = [{
    semanticKey: 'on_start.entry.primary',
    trigger: 'on_start',
    phase: 'entry',
    consumePolicy: 'once',
    requiredRuntimeContext: {
      barIndex: 1,
      requiresReferenceBar: true,
      requiresSymbol: true,
      requiresTimeframe: true,
    },
    sourceRefs: ['entry-primary'],
  }]

  const buildService = (options?: {
    repoOverrides?: Record<string, unknown>
    runtimeExecutionStateService?: {
      buildExecutionSemanticKeysFromSnapshot?: jest.Mock
      initializeStatesForDeploy: jest.Mock
    }
    snapshotsRepository?: Record<string, unknown>
  }) => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      ...(options?.repoOverrides ?? {}),
    }
    const statsService = { calculateStats: jest.fn(), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = {
      ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = options?.snapshotsRepository ?? {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          baseTimeframe: '5m',
          marketType: 'spot',
          positionPct: 10,
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 5,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['GTC'],
        },
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        astSnapshot: {
          decisionPrograms: [{ phase: 'entry' }],
          runtimeExecutionSemantics: structuredRuntimeExecutionSemantics,
        },
      }),
    }

    const runtimeExecutionStateService = options && Object.prototype.hasOwnProperty.call(options, 'runtimeExecutionStateService')
      ? options.runtimeExecutionStateService
      : {
          buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
          initializeStatesForDeploy: jest.fn().mockResolvedValue([]),
        }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
      undefined as any,
      undefined,
      undefined,
      snapshotsRepository as any,
      runtimeExecutionStateService as any,
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

  it('fails closed when runtime execution state initialization service is unavailable', async () => {
    const { service, repo } = buildService({
      runtimeExecutionStateService: undefined as any,
    })

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'OKX SOL 5m',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      publishedSnapshotId: 'snapshot-1',
      deployRequestId: 'deploy-req-no-runtime-service',
      exchangeAccountId: 'acc-1',
    } as any)).rejects.toMatchObject({
      message: 'account_strategy.deploy_runtime_execution_state_service_unavailable',
    })

    expect(repo.createDeployRequestProcessing).not.toHaveBeenCalled()
    expect(repo.markDeployRequestSucceeded).not.toHaveBeenCalled()
    expect(repo.markDeployRequestFailed).not.toHaveBeenCalled()
  })

  it('requires canonical structured runtime execution truth before deploy can proceed', async () => {
    const { service, repo } = buildService({
      snapshotsRepository: {
        findByIdForUser: jest.fn().mockResolvedValue({
          id: 'snapshot-legacy-runtime-truth',
          snapshotHash: 'snapshot-hash-legacy-runtime-truth',
          strategyConfig: {
            exchange: 'okx',
            symbol: 'SOLUSDT',
            baseTimeframe: '5m',
            marketType: 'spot',
            positionPct: 10,
          },
          deploymentExecutionDefaults: {
            leverage: 1,
            priceSource: 'close',
            orderType: 'market',
            timeInForce: 'GTC',
          },
          deploymentExecutionConstraints: {
            platformRiskMaxLeverage: 5,
            defaultLeverage: 1,
            supportedPriceSources: ['close'],
            supportedOrderTypes: ['market'],
            supportedTimeInForce: ['GTC'],
          },
          strategyInstanceId: 'inst-draft-1',
          strategyTemplateId: 'template-1',
          astSnapshot: {
            runtimeExecutionSemantics: ['on_start.entry.primary'],
          },
        }),
      },
      runtimeExecutionStateService: {
        buildExecutionSemanticKeysFromSnapshot: jest.fn(() => {
          throw new Error('legacy_runtime_execution_semantics_unsupported')
        }),
        initializeStatesForDeploy: jest.fn().mockResolvedValue([]),
      },
    })

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'legacy runtime truth deploy',
      publishedSnapshotId: 'snapshot-legacy-runtime-truth',
      deployRequestId: 'deploy-req-legacy-runtime-truth',
      exchangeAccountId: 'acc-1',
    } as any)).rejects.toBeInstanceOf(DeploySnapshotRequiresRepublishException)

    expect(repo.createDeployRequestProcessing).not.toHaveBeenCalled()
    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
  })

  it('requires republish when the published snapshot has no structured runtime execution truth', async () => {
    const runtimeExecutionStateService = {
      buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue([]),
      initializeStatesForDeploy: jest.fn().mockResolvedValue([]),
    }
    const { service, repo } = buildService({
      snapshotsRepository: {
        findByIdForUser: jest.fn().mockResolvedValue({
          id: 'snapshot-missing-runtime-truth',
          snapshotHash: 'snapshot-hash-missing-runtime-truth',
          strategyConfig: {
            exchange: 'okx',
            symbol: 'SOLUSDT',
            baseTimeframe: '5m',
            marketType: 'spot',
            positionPct: 10,
          },
          deploymentExecutionDefaults: {
            leverage: 1,
            priceSource: 'close',
            orderType: 'market',
            timeInForce: 'GTC',
          },
          deploymentExecutionConstraints: {
            platformRiskMaxLeverage: 5,
            defaultLeverage: 1,
            supportedPriceSources: ['close'],
            supportedOrderTypes: ['market'],
            supportedTimeInForce: ['GTC'],
          },
          strategyInstanceId: 'inst-draft-1',
          strategyTemplateId: 'template-1',
          astSnapshot: {
            decisionPrograms: [{ phase: 'entry' }],
          },
        }),
      },
      runtimeExecutionStateService,
    })

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'missing runtime truth deploy',
      publishedSnapshotId: 'snapshot-missing-runtime-truth',
      deployRequestId: 'deploy-req-missing-runtime-truth',
      exchangeAccountId: 'acc-1',
    } as any)).rejects.toBeInstanceOf(DeploySnapshotRequiresRepublishException)

    expect(runtimeExecutionStateService.buildExecutionSemanticKeysFromSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'snapshot-missing-runtime-truth' }),
    )
    expect(repo.createDeployRequestProcessing).not.toHaveBeenCalled()
    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
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
      repoOverrides: {
        findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue({
          id: 'req-1',
          deployRequestId: 'same-1',
          payloadHash: buildDeployPayloadHash({
            name: dto.name,
          }),
          status: 'SUCCEEDED',
          strategyInstanceId: 'inst-existing',
        }),
      },
    })

    await service.deployStrategy(dto as any)

    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
    expect(service.getStrategyDetail).toHaveBeenCalledWith('user-1', 'inst-existing')
  })

  it('returns deploy result detail when deploy request is already succeeded', async () => {
    const { service } = buildService({
      repoOverrides: {
        findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue({
          id: 'req-1',
          deployRequestId: 'deploy-req-1',
          payloadHash: 'hash-1',
          status: 'SUCCEEDED',
          strategyInstanceId: 'inst-existing',
        }),
      },
    })

    await expect(service.getDeployResult('user-1', 'deploy-req-1')).resolves.toEqual({ id: 'inst-1' })
    expect(service.getStrategyDetail).toHaveBeenCalledWith('user-1', 'inst-existing')
  })

  it('returns null when deploy request is not yet succeeded', async () => {
    const { service } = buildService({
      repoOverrides: {
        findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue({
          id: 'req-1',
          deployRequestId: 'deploy-req-1',
          payloadHash: 'hash-1',
          status: 'PROCESSING',
          strategyInstanceId: null,
        }),
      },
    })

    await expect(service.getDeployResult('user-1', 'deploy-req-1')).resolves.toBeNull()
    expect(service.getStrategyDetail).not.toHaveBeenCalled()
  })

  it('rejects idempotent conflict when same request id has different payload', async () => {
    const { service } = buildService({
      repoOverrides: {
        findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue({
          id: 'req-1',
          deployRequestId: 'same-1',
          payloadHash: 'different-hash',
          status: 'SUCCEEDED',
          strategyInstanceId: 'inst-existing',
        }),
      },
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
      repoOverrides: {
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
      },
    })
    ;(service as any).resolveDeployPayload = jest.fn().mockResolvedValue({
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      marketType: 'spot',
      deploymentExecutionConfig: {
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'GTC',
      },
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash-1',
      sourceStrategyInstanceId: 'inst-1',
      sourceStrategyTemplateId: 'template-1',
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
      repoOverrides: {
        createDeployRequestProcessing: jest.fn().mockRejectedValue(new Error('fk constraint failed')),
        findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      },
    })
    ;(service as any).resolveDeployPayload = jest.fn().mockResolvedValue({
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      marketType: 'spot',
      deploymentExecutionConfig: {
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'GTC',
      },
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash-1',
      sourceStrategyInstanceId: 'inst-1',
      sourceStrategyTemplateId: 'template-1',
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

  it('preserves the original deploy error when marking the deploy request as failed also errors', async () => {
    const originalError = new DomainException('deploy write failed', {
      code: 'INTERNAL_SERVER_ERROR' as any,
      status: 500,
    })
    const { service } = buildService({
      repoOverrides: {
        findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
        createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
        deployStrategyForUser: jest.fn().mockRejectedValue(originalError),
        markDeployRequestFailed: jest.fn().mockRejectedValue(new Error('failed marker write failed')),
      },
    })
    ;(service as any).resolveDeployPayload = jest.fn().mockResolvedValue({
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      marketType: 'spot',
      deploymentExecutionConfig: {
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'GTC',
      },
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash-1',
      sourceStrategyInstanceId: 'inst-1',
      sourceStrategyTemplateId: 'template-1',
    })

    await expect(service.deployStrategy({
      userId: 'user-1',
      deployRequestId: 'same-4',
      name: 'OKX SOL 5m',
      exchangeAccountId: 'acct-1',
    } as any)).rejects.toBe(originalError)
  })

  it('fails closed when runtime execution state initialization fails after deploy succeeds', async () => {
    const initializationError = new Error('runtime state init failed')
    const runtimeExecutionStateService = {
      buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
      initializeStatesForDeploy: jest.fn().mockRejectedValue(initializationError),
    }
    const { service, repo } = buildService({
      runtimeExecutionStateService,
    })
    ;(service as any).resolveDeployPayload = jest.fn().mockResolvedValue({
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      marketType: 'spot',
      deploymentExecutionConfig: {
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'GTC',
      },
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash-1',
      sourceStrategyInstanceId: 'inst-draft-1',
      sourceStrategyTemplateId: 'template-1',
      snapshot: {
        id: 'snapshot-1',
        astSnapshot: {
          decisionPrograms: [{ phase: 'entry' }],
          runtimeExecutionSemantics: structuredRuntimeExecutionSemantics,
        },
      },
    })

    await expect(service.deployStrategy({
      userId: 'user-1',
      deployRequestId: 'same-5',
      name: 'OKX SOL 5m',
      exchangeAccountId: 'acct-1',
    } as any)).rejects.toBe(initializationError)

    expect(runtimeExecutionStateService.initializeStatesForDeploy).toHaveBeenCalledWith({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash-1',
      snapshot: {
        id: 'snapshot-1',
        astSnapshot: {
          decisionPrograms: [{ phase: 'entry' }],
          runtimeExecutionSemantics: structuredRuntimeExecutionSemantics,
        },
      },
    })
    expect(repo.markDeployRequestSucceeded).not.toHaveBeenCalled()
    expect(repo.markDeployRequestFailed).toHaveBeenCalledWith('req-1', 'BAD_REQUEST', 'runtime state init failed')
    expect(service.getStrategyDetail).not.toHaveBeenCalled()
  })
})
