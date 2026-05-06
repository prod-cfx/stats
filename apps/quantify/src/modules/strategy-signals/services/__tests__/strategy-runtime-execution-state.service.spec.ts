import { TransactionHost } from '@nestjs-cls/transactional'
import { Test } from '@nestjs/testing'
import { StrategyRuntimeExecutionStateRepository } from '../../repositories/strategy-runtime-execution-state.repository'
import { StrategyRuntimeExecutionStateService } from '../strategy-runtime-execution-state.service'

type RuntimeStateRecord = {
  strategyInstanceId: string
  publishedSnapshotId: string
  snapshotHash: string
  executionSemanticKey: string
  status: 'ready' | 'running' | 'retryable' | 'terminal' | 'consumed'
  failureFamily?: 'retryable' | 'terminal' | null
  failureReason?: string | null
  failureCode?: string | null
  attemptCount?: number
  lastAttemptAt?: Date | null
  runningAt?: Date | null
  terminalAt?: Date | null
  consumedAt?: Date | null
  cooldownUntil?: Date | null
}

class InMemoryRuntimeExecutionStateRepository {
  private readonly records = new Map<string, RuntimeStateRecord>()
  readonly recoverCalls: Array<{
    strategyInstanceId: string
    publishedSnapshotId: string
    leaseExpiresBefore: Date
    failureReason?: string | null
    failureCode?: string | null
  }> = []

  private keyOf(input: Pick<RuntimeStateRecord, 'strategyInstanceId' | 'publishedSnapshotId' | 'executionSemanticKey'>) {
    return `${input.strategyInstanceId}::${input.publishedSnapshotId}::${input.executionSemanticKey}`
  }

  async findByInstanceAndSnapshot(strategyInstanceId: string, publishedSnapshotId: string) {
    return Array.from(this.records.values()).filter(record => (
      record.strategyInstanceId === strategyInstanceId
      && record.publishedSnapshotId === publishedSnapshotId
    ))
  }

  async upsertReadyState(input: Omit<RuntimeStateRecord, 'status'> & { status?: 'ready' }) {
    const key = this.keyOf(input)
    const existing = this.records.get(key)
    if (existing && existing.snapshotHash !== input.snapshotHash) {
      throw new Error('snapshot_hash_mismatch')
    }
    if (existing) {
      return existing
    }

    const next: RuntimeStateRecord = {
      strategyInstanceId: input.strategyInstanceId,
      publishedSnapshotId: input.publishedSnapshotId,
      snapshotHash: input.snapshotHash,
      executionSemanticKey: input.executionSemanticKey,
      status: 'ready',
      failureFamily: null,
      failureReason: null,
      failureCode: null,
      attemptCount: 0,
      lastAttemptAt: null,
      runningAt: null,
      terminalAt: null,
      consumedAt: null,
      cooldownUntil: null,
    }
    this.records.set(key, next)
    return next
  }

  async markRunning(input: Pick<RuntimeStateRecord, 'strategyInstanceId' | 'publishedSnapshotId' | 'executionSemanticKey'>) {
    const key = this.keyOf(input)
    const existing = this.records.get(key)
    if (!existing) throw new Error(`missing_state:${key}`)

    const next: RuntimeStateRecord = {
      ...existing,
      status: 'running',
      failureFamily: null,
      failureReason: null,
      failureCode: null,
      runningAt: new Date('2026-04-20T07:55:00.000Z'),
      terminalAt: null,
      consumedAt: null,
      cooldownUntil: null,
    }
    this.records.set(key, next)
    return next
  }

  async markConsumed(input: Pick<RuntimeStateRecord, 'strategyInstanceId' | 'publishedSnapshotId' | 'executionSemanticKey'>) {
    const key = this.keyOf(input)
    const existing = this.records.get(key)
    if (!existing) throw new Error(`missing_state:${key}`)

    const next: RuntimeStateRecord = {
      ...existing,
      status: 'consumed',
      failureFamily: null,
      failureReason: null,
      failureCode: null,
      attemptCount: (existing.attemptCount ?? 0) + 1,
      consumedAt: new Date('2026-04-20T08:00:00.000Z'),
      lastAttemptAt: new Date('2026-04-20T08:00:00.000Z'),
      runningAt: null,
      terminalAt: new Date('2026-04-20T08:00:00.000Z'),
      cooldownUntil: null,
    }
    this.records.set(key, next)
    return next
  }

  async markFailed(
    input: Pick<RuntimeStateRecord, 'strategyInstanceId' | 'publishedSnapshotId' | 'executionSemanticKey'>
    & Pick<RuntimeStateRecord, 'failureReason' | 'failureCode'>,
  ) {
    const key = this.keyOf(input)
    const existing = this.records.get(key)
    if (!existing) throw new Error(`missing_state:${key}`)

    const next: RuntimeStateRecord = {
      ...existing,
      status: 'terminal',
      failureFamily: 'terminal',
      failureReason: input.failureReason ?? null,
      failureCode: input.failureCode ?? null,
      attemptCount: (existing.attemptCount ?? 0) + 1,
      lastAttemptAt: new Date('2026-04-20T08:05:00.000Z'),
      runningAt: null,
      terminalAt: new Date('2026-04-20T08:05:00.000Z'),
      consumedAt: null,
      cooldownUntil: null,
    }
    this.records.set(key, next)
    return next
  }

  async markTerminalFailure(
    input: Pick<RuntimeStateRecord, 'strategyInstanceId' | 'publishedSnapshotId' | 'executionSemanticKey'>
    & Pick<RuntimeStateRecord, 'failureReason' | 'failureCode'>,
  ) {
    return this.markFailed(input)
  }

  async markRetryableFailure(
    input: Pick<RuntimeStateRecord, 'strategyInstanceId' | 'publishedSnapshotId' | 'executionSemanticKey'>
    & Pick<RuntimeStateRecord, 'cooldownUntil' | 'failureReason' | 'failureCode'>,
  ) {
    const key = this.keyOf(input)
    const existing = this.records.get(key)
    if (!existing) throw new Error(`missing_state:${key}`)

    const next: RuntimeStateRecord = {
      ...existing,
      status: 'retryable',
      failureFamily: 'retryable',
      cooldownUntil: input.cooldownUntil ?? new Date('2026-04-20T09:00:00.000Z'),
      failureReason: input.failureReason ?? existing.failureReason ?? null,
      failureCode: input.failureCode ?? existing.failureCode ?? null,
      attemptCount: (existing.attemptCount ?? 0) + 1,
      lastAttemptAt: new Date('2026-04-20T08:10:00.000Z'),
      runningAt: null,
      terminalAt: null,
      consumedAt: null,
    }
    this.records.set(key, next)
    return next
  }

  async markCooldown(
    input: Pick<RuntimeStateRecord, 'strategyInstanceId' | 'publishedSnapshotId' | 'executionSemanticKey'>
    & Pick<RuntimeStateRecord, 'cooldownUntil' | 'failureReason' | 'failureCode'>,
  ) {
    return this.markRetryableFailure(input)
  }

  async recoverStaleRunningStates(input: {
    strategyInstanceId: string
    publishedSnapshotId: string
    leaseExpiresBefore: Date
    failureReason?: string | null
    failureCode?: string | null
  }) {
    this.recoverCalls.push(input)

    let recoveredCount = 0
    for (const [key, existing] of this.records.entries()) {
      if (
        existing.strategyInstanceId !== input.strategyInstanceId
        || existing.publishedSnapshotId !== input.publishedSnapshotId
        || existing.status !== 'running'
        || !existing.runningAt
        || existing.runningAt.getTime() > input.leaseExpiresBefore.getTime()
      ) {
        continue
      }

      const next: RuntimeStateRecord = {
        ...existing,
        status: 'retryable',
        failureFamily: 'retryable',
        failureReason: input.failureReason ?? null,
        failureCode: input.failureCode ?? null,
        attemptCount: (existing.attemptCount ?? 0) + 1,
        lastAttemptAt: new Date('2026-04-20T08:20:00.000Z'),
        runningAt: null,
        terminalAt: null,
        consumedAt: null,
        cooldownUntil: null,
      }
      this.records.set(key, next)
      recoveredCount += 1
    }

    return recoveredCount
  }

  async seed(record: RuntimeStateRecord) {
    this.records.set(this.keyOf(record), record)
  }
}

function createSnapshot(decisionPrograms: Array<{ id: string, phase: 'entry' | 'exit' | 'rebalance' }>) {
  return {
    id: 'snap-1',
    snapshotHash: 'sha256:snap-1',
    astSnapshot: {
      decisionPrograms,
      runtimeExecutionSemantics: decisionPrograms.map(program => ({
        semanticKey: `on_start.${program.phase}.${program.id}`,
        trigger: 'on_start' as const,
        phase: program.phase,
        consumePolicy: 'once' as const,
        requiredRuntimeContext: {
          barIndex: 1,
          requiresReferenceBar: true,
          requiresSymbol: true,
          requiresTimeframe: true,
        },
        sourceRefs: [program.id],
      })),
    },
  }
}

function createService(repository = new InMemoryRuntimeExecutionStateRepository()) {
  return {
    repository,
    service: new StrategyRuntimeExecutionStateService(repository as any),
  }
}

describe('strategyRuntimeExecutionStateService', () => {
  it('is injectable through Nest using the concrete repository provider metadata', async () => {
    const txHost = {
      tx: {
        strategyRuntimeExecutionState: {
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
          update: jest.fn(),
        },
      },
    }
    const moduleRef = await Test.createTestingModule({
      providers: [
        StrategyRuntimeExecutionStateRepository,
        StrategyRuntimeExecutionStateService,
        { provide: TransactionHost, useValue: txHost },
      ],
    }).compile()

    expect(moduleRef.get(StrategyRuntimeExecutionStateService)).toBeInstanceOf(StrategyRuntimeExecutionStateService)
  })

  it('keeps only one state row per instance snapshot semantic key and initializes it as ready', async () => {
    const { service, repository } = createService()
    const snapshot = createSnapshot([
      { id: 'entry-primary', phase: 'entry' },
    ])

    await service.initializeStatesForDeploy({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      snapshot,
    })
    await service.initializeStatesForDeploy({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      snapshot,
    })

    const states = await repository.findByInstanceAndSnapshot('inst-1', 'snap-1')

    expect(states).toHaveLength(1)
    expect(states[0]).toMatchObject({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      executionSemanticKey: 'on_start.entry.entry-primary',
      status: 'ready',
      failureFamily: null,
      attemptCount: 0,
    })
  })

  it('binds every published snapshot runtime semantic from canonical semanticKey objects', async () => {
    const { service, repository } = createService()
    const snapshot = createSnapshot([
      { id: 'entry-primary', phase: 'entry' },
      { id: 'exit-primary', phase: 'exit' },
      { id: 'rebalance-primary', phase: 'rebalance' },
    ])

    await service.initializeStatesForDeploy({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      snapshot,
    })

    const states = await repository.findByInstanceAndSnapshot('inst-1', 'snap-1')
    expect(states).toEqual([
      expect.objectContaining({
        executionSemanticKey: 'on_start.entry.entry-primary',
        status: 'ready',
      }),
      expect.objectContaining({
        executionSemanticKey: 'on_start.exit.exit-primary',
        status: 'ready',
      }),
      expect.objectContaining({
        executionSemanticKey: 'on_start.rebalance.rebalance-primary',
        status: 'ready',
      }),
    ])
  })

  it('loads ready and eligible retryable states but excludes running terminal and consumed states', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-20T08:10:00.000Z').getTime())
    const { service, repository } = createService()
    await repository.seed({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      executionSemanticKey: 'on_start.entry.primary',
      status: 'ready',
      failureFamily: null,
      attemptCount: 0,
      lastAttemptAt: null,
      runningAt: null,
      terminalAt: null,
      consumedAt: null,
      cooldownUntil: null,
    })
    await repository.seed({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      executionSemanticKey: 'on_start.exit.retryable-ready',
      status: 'retryable',
      failureFamily: 'retryable',
      failureReason: 'AI_TIMEOUT',
      failureCode: 'AI_TIMEOUT',
      attemptCount: 1,
      lastAttemptAt: new Date('2026-04-20T08:00:00.000Z'),
      runningAt: null,
      terminalAt: null,
      consumedAt: null,
      cooldownUntil: new Date('2026-04-20T07:59:00.000Z'),
    })
    await repository.seed({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      executionSemanticKey: 'on_start.rebalance.retryable-cooling',
      status: 'retryable',
      failureFamily: 'retryable',
      failureReason: 'AI_TIMEOUT',
      failureCode: 'AI_TIMEOUT',
      attemptCount: 1,
      lastAttemptAt: new Date('2026-04-20T08:00:00.000Z'),
      runningAt: null,
      terminalAt: null,
      consumedAt: null,
      cooldownUntil: new Date('2099-04-20T08:30:00.000Z'),
    })
    await repository.seed({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      executionSemanticKey: 'on_start.entry.running',
      status: 'running',
      failureFamily: null,
      attemptCount: 1,
      lastAttemptAt: null,
      runningAt: new Date('2026-04-20T08:08:00.000Z'),
      terminalAt: null,
      consumedAt: null,
      cooldownUntil: null,
    })
    await repository.seed({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      executionSemanticKey: 'on_start.entry.terminal',
      status: 'terminal',
      failureFamily: 'terminal',
      failureReason: 'SYMBOL_NOT_FOUND',
      failureCode: 'SYMBOL_NOT_FOUND',
      attemptCount: 1,
      lastAttemptAt: new Date('2026-04-20T08:10:00.000Z'),
      runningAt: null,
      terminalAt: new Date('2026-04-20T08:10:00.000Z'),
      consumedAt: null,
      cooldownUntil: null,
    })
    await repository.seed({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      executionSemanticKey: 'on_start.entry.consumed',
      status: 'consumed',
      failureFamily: null,
      attemptCount: 1,
      lastAttemptAt: new Date('2026-04-20T08:15:00.000Z'),
      runningAt: null,
      terminalAt: new Date('2026-04-20T08:15:00.000Z'),
      consumedAt: new Date('2026-04-20T08:15:00.000Z'),
      cooldownUntil: null,
    })

    const executableStates = await service.loadExecutableStates({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
    })

    expect(executableStates).toEqual([
      expect.objectContaining({
        executionSemanticKey: 'on_start.entry.primary',
        status: 'ready',
      }),
      expect.objectContaining({
        executionSemanticKey: 'on_start.exit.retryable-ready',
        status: 'retryable',
        failureFamily: 'retryable',
        attemptCount: 1,
      }),
    ])

    nowSpy.mockRestore()
  })

  it('recovers stale running states before returning executable states', async () => {
    const now = new Date('2026-04-20T08:30:00.000Z')
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now.getTime())
    const { service, repository } = createService()

    await repository.seed({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      executionSemanticKey: 'on_start.entry.stale-running',
      status: 'running',
      failureFamily: null,
      failureReason: null,
      failureCode: null,
      attemptCount: 1,
      lastAttemptAt: new Date('2026-04-20T08:00:00.000Z'),
      runningAt: new Date('2026-04-20T07:00:00.000Z'),
      terminalAt: null,
      consumedAt: null,
      cooldownUntil: null,
    })

    const executableStates = await service.loadExecutableStates({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
    })

    expect(repository.recoverCalls).toEqual([
      expect.objectContaining({
        strategyInstanceId: 'inst-1',
        publishedSnapshotId: 'snap-1',
        leaseExpiresBefore: expect.any(Date),
        failureReason: 'RUNTIME_RUNNING_LEASE_EXPIRED',
        failureCode: 'RUNTIME_RUNNING_LEASE_EXPIRED',
      }),
    ])
    expect(executableStates).toEqual([
      expect.objectContaining({
        executionSemanticKey: 'on_start.entry.stale-running',
        status: 'retryable',
        failureFamily: 'retryable',
        failureReason: 'RUNTIME_RUNNING_LEASE_EXPIRED',
        failureCode: 'RUNTIME_RUNNING_LEASE_EXPIRED',
        attemptCount: 2,
        runningAt: null,
        cooldownUntil: null,
      }),
    ])

    nowSpy.mockRestore()
  })

  it('treats snapshot hash mismatch as invalid runtime state', async () => {
    const { service } = createService()

    await expect(service.validateBoundState({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:new',
    }, {
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:old',
      executionSemanticKey: 'on_start.entry.primary',
      status: 'ready',
      failureFamily: null,
      attemptCount: 0,
    })).rejects.toThrow('snapshot_hash_mismatch')
  })

  it('fails closed when deploy initialization sees an existing semantic key with a different snapshot hash', async () => {
    const { service } = createService()
    const snapshot = createSnapshot([
      { id: 'entry-primary', phase: 'entry' },
    ])

    await service.initializeStatesForDeploy({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:old',
      snapshot,
    })

    await expect(service.initializeStatesForDeploy({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:new',
      snapshot,
    })).rejects.toThrow('snapshot_hash_mismatch')
  })

  it('does not re-arm an existing semantic key when the same snapshot is deployed again', async () => {
    const { service, repository } = createService()
    const snapshot = createSnapshot([
      { id: 'entry-primary', phase: 'entry' },
    ])

    await service.initializeStatesForDeploy({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      snapshot,
    })
    await repository.markConsumed({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      executionSemanticKey: 'on_start.entry.entry-primary',
    })

    await service.initializeStatesForDeploy({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      snapshot,
    })

    const states = await repository.findByInstanceAndSnapshot('inst-1', 'snap-1')
    expect(states).toHaveLength(1)
    expect(states[0]).toMatchObject({
      executionSemanticKey: 'on_start.entry.entry-primary',
      status: 'consumed',
      failureFamily: null,
      attemptCount: 1,
    })
  })

  it('applies running, retryable, terminal, and consumed transitions through the service using the new projection model', async () => {
    const { service } = createService()
    const snapshot = createSnapshot([
      { id: 'entry-primary', phase: 'entry' },
    ])

    await service.initializeStatesForDeploy({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      snapshot,
    })

    await expect(service.markRunning({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      executionSemanticKey: 'on_start.entry.entry-primary',
    })).resolves.toMatchObject({
      status: 'running',
      failureFamily: null,
      attemptCount: 0,
    })

    await expect(service.markRetryableFailure({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      executionSemanticKey: 'on_start.entry.entry-primary',
      failureReason: 'AI_TIMEOUT',
      failureCode: 'AI_TIMEOUT',
      cooldownUntil: new Date('2026-04-20T08:20:00.000Z'),
    })).resolves.toMatchObject({
      status: 'retryable',
      failureFamily: 'retryable',
      failureReason: 'AI_TIMEOUT',
      failureCode: 'AI_TIMEOUT',
      attemptCount: 1,
    })

    await expect(service.markTerminalFailure({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      executionSemanticKey: 'on_start.entry.entry-primary',
      failureReason: 'SYMBOL_NOT_FOUND',
      failureCode: 'SYMBOL_NOT_FOUND',
    })).resolves.toMatchObject({
      status: 'terminal',
      failureFamily: 'terminal',
      failureReason: 'SYMBOL_NOT_FOUND',
      failureCode: 'SYMBOL_NOT_FOUND',
      attemptCount: 2,
    })

    await expect(service.markConsumed({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      executionSemanticKey: 'on_start.entry.entry-primary',
    })).resolves.toMatchObject({
      status: 'consumed',
      failureFamily: null,
      attemptCount: 3,
    })
  })

  it('projects running retryable and terminal lifecycle metadata from the repository row', async () => {
    const { service } = createService()

    await expect(service.validateBoundState({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
    }, {
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      executionSemanticKey: 'on_start.entry.primary',
      status: 'retryable',
      failureFamily: 'retryable',
      failureReason: 'AI_TIMEOUT',
      failureCode: 'AI_TIMEOUT',
      attemptCount: 2,
      lastAttemptAt: new Date('2026-04-20T08:10:00.000Z'),
      runningAt: null,
      terminalAt: null,
      consumedAt: null,
      cooldownUntil: new Date('2026-04-20T08:20:00.000Z'),
    })).resolves.toMatchObject({
      executionSemanticKey: 'on_start.entry.primary',
      status: 'retryable',
      failureFamily: 'retryable',
      failureReason: 'AI_TIMEOUT',
      failureCode: 'AI_TIMEOUT',
      attemptCount: 2,
      cooldownUntil: new Date('2026-04-20T08:20:00.000Z'),
    })
  })

  it('does not invent runtime semantics when the snapshot has no explicit lifecycle declaration', () => {
    const { service } = createService()

    expect(service.buildExecutionSemanticKeysFromSnapshot({
      astSnapshot: {
        decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
      },
    })).toEqual([])
  })

  it('resolves atomic semantic runtime state keys from snapshot compatibility metadata', () => {
    const { service } = createService()
    const snapshot = {
      scriptSummary: {
        compatibilityMetadata: {
          isLegacySnapshot: false,
          atomicContractExecution: {
            schemaVersion: 1,
            runtimeRequirements: {
              helpers: ['rollingHigh'],
              stateKeys: ['breakout'],
            },
          },
        },
      },
      astSnapshot: {
        runtimeRequirements: {
          helpers: ['ignoredFallback'],
          stateKeys: ['ignored'],
        },
      },
    }

    expect(service.buildRuntimeRequirementsFromSnapshot(snapshot)).toEqual({
      helpers: ['rollingHigh'],
      stateKeys: ['breakout'],
    })
    expect(service.buildSemanticRuntimeStateFromSnapshot(snapshot)).toEqual({
      breakout: {},
    })
  })

  it('fails closed for legacy runtime semantic snapshot shapes and accepts only canonical semanticKey objects', () => {
    const { service } = createService()

    expect(() => service.buildExecutionSemanticKeysFromSnapshot({
      astSnapshot: {
        runtimeExecutionSemantics: [
          'on_start.entry.legacy-string',
        ],
      },
    })).toThrow('legacy_runtime_execution_semantics_unsupported')

    expect(() => service.buildExecutionSemanticKeysFromSnapshot({
      astSnapshot: {
        runtimeExecutionSemantics: [
          { key: 'on_start.entry.legacy-key' },
        ],
      },
    })).toThrow('legacy_runtime_execution_semantics_unsupported')

    expect(() => service.buildExecutionSemanticKeysFromSnapshot({
      astSnapshot: {
        runtimeExecutionSemantics: [
          { executionSemanticKey: 'on_start.entry.legacy-alias' },
        ],
      },
    })).toThrow('legacy_runtime_execution_semantics_unsupported')

    expect(service.buildExecutionSemanticKeysFromSnapshot({
      astSnapshot: {
        runtimeExecutionSemantics: [{
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
        }],
      },
    })).toEqual(['on_start.entry.primary'])

    expect(service.buildExecutionSemanticKeysFromSnapshot({
      astSnapshot: {
        runtimeExecutionSemantics: [
          {
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
          },
          {
            semanticKey: 'on_start.exit.primary',
            trigger: 'on_start',
            phase: 'exit',
            consumePolicy: 'once',
            requiredRuntimeContext: {
              barIndex: 1,
              requiresReferenceBar: true,
              requiresSymbol: true,
              requiresTimeframe: true,
            },
            sourceRefs: ['exit-primary'],
          },
        ],
      },
    })).toEqual(['on_start.entry.primary', 'on_start.exit.primary'])
  })

  it('fails closed when runtime semantics are placed at the root instead of astSnapshot', () => {
    const { service } = createService()

    expect(() => service.buildExecutionSemanticKeysFromSnapshot({
      runtimeExecutionSemantics: [{
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
      }],
      astSnapshot: {
        decisionPrograms: [{ id: 'entry-primary', phase: 'entry' }],
      },
    })).toThrow('misplaced_runtime_execution_semantics')
  })

  it('fails closed when semanticKey is present but unsupported', () => {
    const { service } = createService()

    expect(() => service.buildExecutionSemanticKeysFromSnapshot({
      astSnapshot: {
        runtimeExecutionSemantics: [{
          semanticKey: 'intrabar.entry.primary',
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
        }],
      },
    })).toThrow('invalid_runtime_execution_semantic_key')
  })
})
