import { StrategyRuntimeExecutionStateRepository } from './strategy-runtime-execution-state.repository'

function createTxHost(tx: unknown): ConstructorParameters<typeof StrategyRuntimeExecutionStateRepository>[0] {
  return { tx } as ConstructorParameters<typeof StrategyRuntimeExecutionStateRepository>[0]
}

describe('strategyRuntimeExecutionStateRepository', () => {
  it('creates a ready state when the composite key does not exist', async () => {
    const tx = {
      strategyRuntimeExecutionState: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'runtime-state-1',
          createdAt: new Date('2026-04-20T10:00:00.000Z'),
          updatedAt: new Date('2026-04-20T10:00:00.000Z'),
          failureFamily: null,
          failureReason: null,
          failureCode: null,
          attemptCount: 0,
          lastAttemptAt: null,
          runningAt: null,
          terminalAt: null,
          consumedAt: null,
          cooldownUntil: null,
          strategyInstanceId: 'inst-1',
          ...data,
        })),
        update: jest.fn(),
      },
    }
    const repo = new StrategyRuntimeExecutionStateRepository(createTxHost(tx))

    const result = await repo.upsertReadyState({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      executionSemanticKey: 'on_start.entry.primary',
    })

    expect(tx.strategyRuntimeExecutionState.findUnique).toHaveBeenCalledTimes(1)
    expect(tx.strategyRuntimeExecutionState.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        strategyInstance: { connect: { id: 'inst-1' } },
        publishedSnapshotId: 'snap-1',
        snapshotHash: 'sha256:snap-1',
        executionSemanticKey: 'on_start.entry.primary',
        status: 'ready',
        failureFamily: null,
        attemptCount: 0,
        runningAt: null,
        terminalAt: null,
      }),
    })
    expect(tx.strategyRuntimeExecutionState.update).not.toHaveBeenCalled()
    expect(result.snapshotHash).toBe('sha256:snap-1')
  })

  it('fails closed when an existing row is bound to a different snapshot hash', async () => {
    const tx = {
      strategyRuntimeExecutionState: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'runtime-state-1',
          strategyInstanceId: 'inst-1',
          publishedSnapshotId: 'snap-1',
          snapshotHash: 'sha256:old',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'consumed',
          failureFamily: null,
          attemptCount: 1,
          runningAt: null,
          terminalAt: new Date('2026-04-20T10:00:00.000Z'),
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    const repo = new StrategyRuntimeExecutionStateRepository(createTxHost(tx))

    await expect(repo.upsertReadyState({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:new',
      executionSemanticKey: 'on_start.entry.primary',
    })).rejects.toThrow('snapshot_hash_mismatch')

    expect(tx.strategyRuntimeExecutionState.create).not.toHaveBeenCalled()
    expect(tx.strategyRuntimeExecutionState.update).not.toHaveBeenCalled()
  })

  it('keeps an existing same-snapshot runtime state instead of resetting it to ready', async () => {
    const tx = {
      strategyRuntimeExecutionState: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'runtime-state-1',
          strategyInstanceId: 'inst-1',
          publishedSnapshotId: 'snap-1',
          snapshotHash: 'sha256:snap-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'consumed',
          failureFamily: null,
          failureReason: null,
          failureCode: null,
          attemptCount: 1,
          lastAttemptAt: new Date('2026-04-20T10:00:00.000Z'),
          runningAt: null,
          terminalAt: new Date('2026-04-20T10:00:00.000Z'),
          consumedAt: new Date('2026-04-20T10:00:00.000Z'),
          cooldownUntil: null,
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    const repo = new StrategyRuntimeExecutionStateRepository(createTxHost(tx))

    const result = await repo.upsertReadyState({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      executionSemanticKey: 'on_start.entry.primary',
    })

    expect(tx.strategyRuntimeExecutionState.create).not.toHaveBeenCalled()
    expect(tx.strategyRuntimeExecutionState.update).not.toHaveBeenCalled()
    expect(result.status).toBe('consumed')
  })

  it('recovers from create-time unique conflicts only when the raced row keeps the same snapshot hash', async () => {
    const tx = {
      strategyRuntimeExecutionState: {
        findUnique: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'runtime-state-1',
            strategyInstanceId: 'inst-1',
            publishedSnapshotId: 'snap-1',
            snapshotHash: 'sha256:snap-1',
            executionSemanticKey: 'on_start.entry.primary',
            status: 'terminal',
            failureFamily: 'terminal',
            attemptCount: 1,
            runningAt: null,
            terminalAt: new Date('2026-04-20T10:00:00.000Z'),
          }),
        create: jest.fn().mockRejectedValue(Object.assign(new Error('duplicate key'), { code: 'P2002' })),
        update: jest.fn(),
      },
    }
    const repo = new StrategyRuntimeExecutionStateRepository(createTxHost(tx))

    const result = await repo.upsertReadyState({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
      executionSemanticKey: 'on_start.entry.primary',
    })

    expect(tx.strategyRuntimeExecutionState.findUnique).toHaveBeenCalledTimes(2)
    expect(tx.strategyRuntimeExecutionState.update).not.toHaveBeenCalled()
    expect(result.status).toBe('terminal')
  })

  it('marks a runtime state as running without consuming an attempt', async () => {
    const tx = {
      strategyRuntimeExecutionState: {
        update: jest.fn().mockResolvedValue({
          id: 'runtime-state-1',
          strategyInstanceId: 'inst-1',
          publishedSnapshotId: 'snap-1',
          snapshotHash: 'sha256:snap-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'running',
          failureFamily: null,
          failureReason: null,
          failureCode: null,
          attemptCount: 1,
          lastAttemptAt: new Date('2026-04-20T10:00:00.000Z'),
          runningAt: new Date('2026-04-20T10:05:00.000Z'),
          terminalAt: null,
          consumedAt: null,
          cooldownUntil: null,
        }),
      },
    }
    const repo = new StrategyRuntimeExecutionStateRepository(createTxHost(tx))

    await repo.markRunning({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      executionSemanticKey: 'on_start.entry.primary',
    })

    expect(tx.strategyRuntimeExecutionState.update).toHaveBeenCalledWith({
      where: {
        strategyInstanceId_publishedSnapshotId_executionSemanticKey: {
          strategyInstanceId: 'inst-1',
          publishedSnapshotId: 'snap-1',
          executionSemanticKey: 'on_start.entry.primary',
        },
      },
      data: expect.objectContaining({
        status: 'running',
        failureFamily: null,
        failureReason: null,
        failureCode: null,
        runningAt: expect.any(Date),
        terminalAt: null,
        consumedAt: null,
        cooldownUntil: null,
      }),
    })
  })

  it('marks a consumed state with terminal and consumed timestamps', async () => {
    const tx = {
      strategyRuntimeExecutionState: {
        update: jest.fn().mockResolvedValue({
          id: 'runtime-state-1',
          strategyInstanceId: 'inst-1',
          publishedSnapshotId: 'snap-1',
          snapshotHash: 'sha256:snap-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'consumed',
          failureFamily: null,
          failureReason: null,
          failureCode: null,
          attemptCount: 2,
          lastAttemptAt: new Date('2026-04-20T10:05:00.000Z'),
          runningAt: null,
          terminalAt: new Date('2026-04-20T10:05:00.000Z'),
          consumedAt: new Date('2026-04-20T10:05:00.000Z'),
          cooldownUntil: null,
        }),
      },
    }
    const repo = new StrategyRuntimeExecutionStateRepository(createTxHost(tx))

    await repo.markConsumed({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      executionSemanticKey: 'on_start.entry.primary',
    })

    expect(tx.strategyRuntimeExecutionState.update).toHaveBeenCalledWith({
      where: {
        strategyInstanceId_publishedSnapshotId_executionSemanticKey: {
          strategyInstanceId: 'inst-1',
          publishedSnapshotId: 'snap-1',
          executionSemanticKey: 'on_start.entry.primary',
        },
      },
      data: expect.objectContaining({
        status: 'consumed',
        failureFamily: null,
        failureReason: null,
        failureCode: null,
        attemptCount: { increment: 1 },
        lastAttemptAt: expect.any(Date),
        runningAt: null,
        terminalAt: expect.any(Date),
        consumedAt: expect.any(Date),
        cooldownUntil: null,
      }),
    })
  })

  it('marks a retryable failure with failure family cooldown and incremented attempt count', async () => {
    const tx = {
      strategyRuntimeExecutionState: {
        update: jest.fn().mockResolvedValue({
          id: 'runtime-state-1',
          strategyInstanceId: 'inst-1',
          publishedSnapshotId: 'snap-1',
          snapshotHash: 'sha256:snap-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'retryable',
          failureFamily: 'retryable',
          failureReason: 'AI_TIMEOUT',
          failureCode: 'AI_TIMEOUT',
          attemptCount: 2,
          lastAttemptAt: new Date('2026-04-20T10:05:00.000Z'),
          runningAt: null,
          terminalAt: null,
          consumedAt: null,
          cooldownUntil: new Date('2026-04-20T10:10:00.000Z'),
        }),
      },
    }
    const repo = new StrategyRuntimeExecutionStateRepository(createTxHost(tx))
    const cooldownUntil = new Date('2026-04-20T10:10:00.000Z')

    await repo.markRetryableFailure({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      executionSemanticKey: 'on_start.entry.primary',
      failureReason: 'AI_TIMEOUT',
      failureCode: 'AI_TIMEOUT',
      cooldownUntil,
    })

    expect(tx.strategyRuntimeExecutionState.update).toHaveBeenCalledWith({
      where: {
        strategyInstanceId_publishedSnapshotId_executionSemanticKey: {
          strategyInstanceId: 'inst-1',
          publishedSnapshotId: 'snap-1',
          executionSemanticKey: 'on_start.entry.primary',
        },
      },
      data: expect.objectContaining({
        status: 'retryable',
        failureFamily: 'retryable',
        failureReason: 'AI_TIMEOUT',
        failureCode: 'AI_TIMEOUT',
        attemptCount: { increment: 1 },
        lastAttemptAt: expect.any(Date),
        runningAt: null,
        terminalAt: null,
        consumedAt: null,
        cooldownUntil,
      }),
    })
  })

  it('marks a terminal failure with failure family and terminal timestamp', async () => {
    const tx = {
      strategyRuntimeExecutionState: {
        update: jest.fn().mockResolvedValue({
          id: 'runtime-state-1',
          strategyInstanceId: 'inst-1',
          publishedSnapshotId: 'snap-1',
          snapshotHash: 'sha256:snap-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'terminal',
          failureFamily: 'terminal',
          failureReason: 'SYMBOL_NOT_FOUND',
          failureCode: 'SYMBOL_NOT_FOUND',
          attemptCount: 2,
          lastAttemptAt: new Date('2026-04-20T10:05:00.000Z'),
          runningAt: null,
          terminalAt: new Date('2026-04-20T10:05:00.000Z'),
          consumedAt: null,
          cooldownUntil: null,
        }),
      },
    }
    const repo = new StrategyRuntimeExecutionStateRepository(createTxHost(tx))

    await repo.markFailed({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      executionSemanticKey: 'on_start.entry.primary',
      failureReason: 'SYMBOL_NOT_FOUND',
      failureCode: 'SYMBOL_NOT_FOUND',
    })

    expect(tx.strategyRuntimeExecutionState.update).toHaveBeenCalledWith({
      where: {
        strategyInstanceId_publishedSnapshotId_executionSemanticKey: {
          strategyInstanceId: 'inst-1',
          publishedSnapshotId: 'snap-1',
          executionSemanticKey: 'on_start.entry.primary',
        },
      },
      data: expect.objectContaining({
        status: 'terminal',
        failureFamily: 'terminal',
        failureReason: 'SYMBOL_NOT_FOUND',
        failureCode: 'SYMBOL_NOT_FOUND',
        attemptCount: { increment: 1 },
        lastAttemptAt: expect.any(Date),
        runningAt: null,
        terminalAt: expect.any(Date),
        cooldownUntil: null,
      }),
    })
  })
})
