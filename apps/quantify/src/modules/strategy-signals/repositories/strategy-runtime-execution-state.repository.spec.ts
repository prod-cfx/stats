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
          failureReason: null,
          failureCode: null,
          lastAttemptAt: null,
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
            status: 'failed',
          }),
        create: jest.fn().mockRejectedValue(Object.assign(new Error('duplicate key'), { code: 'P2002' })),
        update: jest.fn().mockResolvedValue({
          id: 'runtime-state-1',
          strategyInstanceId: 'inst-1',
          publishedSnapshotId: 'snap-1',
          snapshotHash: 'sha256:snap-1',
          executionSemanticKey: 'on_start.entry.primary',
          status: 'ready',
        }),
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
    expect(tx.strategyRuntimeExecutionState.update).toHaveBeenCalledWith({
      where: {
        strategyInstanceId_publishedSnapshotId_executionSemanticKey: {
          strategyInstanceId: 'inst-1',
          publishedSnapshotId: 'snap-1',
          executionSemanticKey: 'on_start.entry.primary',
        },
      },
      data: {
        status: 'ready',
        failureReason: null,
        failureCode: null,
        lastAttemptAt: null,
        consumedAt: null,
        cooldownUntil: null,
      },
    })
    expect(result.status).toBe('ready')
  })
})
