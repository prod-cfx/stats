import { StrategyRuntimeExecutionStateService } from '../strategy-runtime-execution-state.service'

type RuntimeStateRecord = {
  strategyInstanceId: string
  publishedSnapshotId: string
  snapshotHash: string
  executionSemanticKey: string
  status: 'ready' | 'consumed' | 'failed' | 'cooldown'
  failureReason?: string | null
  failureCode?: string | null
  lastAttemptAt?: Date | null
  consumedAt?: Date | null
  cooldownUntil?: Date | null
}

class InMemoryRuntimeExecutionStateRepository {
  private readonly records = new Map<string, RuntimeStateRecord>()

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

    const next: RuntimeStateRecord = {
      ...existing,
      strategyInstanceId: input.strategyInstanceId,
      publishedSnapshotId: input.publishedSnapshotId,
      snapshotHash: input.snapshotHash,
      executionSemanticKey: input.executionSemanticKey,
      status: 'ready',
      failureReason: null,
      failureCode: null,
      lastAttemptAt: null,
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
      consumedAt: new Date('2026-04-20T08:00:00.000Z'),
      lastAttemptAt: new Date('2026-04-20T08:00:00.000Z'),
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
      status: 'failed',
      failureReason: input.failureReason ?? null,
      failureCode: input.failureCode ?? null,
      lastAttemptAt: new Date('2026-04-20T08:05:00.000Z'),
    }
    this.records.set(key, next)
    return next
  }

  async markCooldown(
    input: Pick<RuntimeStateRecord, 'strategyInstanceId' | 'publishedSnapshotId' | 'executionSemanticKey'>
    & Pick<RuntimeStateRecord, 'cooldownUntil' | 'failureReason' | 'failureCode'>,
  ) {
    const key = this.keyOf(input)
    const existing = this.records.get(key)
    if (!existing) throw new Error(`missing_state:${key}`)

    const next: RuntimeStateRecord = {
      ...existing,
      status: 'cooldown',
      cooldownUntil: input.cooldownUntil ?? new Date('2026-04-20T09:00:00.000Z'),
      failureReason: input.failureReason ?? existing.failureReason ?? null,
      failureCode: input.failureCode ?? existing.failureCode ?? null,
      lastAttemptAt: new Date('2026-04-20T08:10:00.000Z'),
    }
    this.records.set(key, next)
    return next
  }
}

function createSnapshot(decisionPrograms: Array<{ id: string, phase: 'entry' | 'exit' | 'rebalance' }>) {
  return {
    id: 'snap-1',
    snapshotHash: 'sha256:snap-1',
    astSnapshot: {
      decisionPrograms,
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
      executionSemanticKey: 'on_start.entry.primary',
      status: 'ready',
    })
  })

  it('loads only ready executable states after consumed failed and cooldown transitions', async () => {
    const { service, repository } = createService()
    const snapshot = createSnapshot([
      { id: 'entry-primary', phase: 'entry' },
      { id: 'exit-primary', phase: 'exit' },
      { id: 'rebalance-primary', phase: 'rebalance' },
      { id: 'entry-secondary', phase: 'entry' },
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
      executionSemanticKey: 'on_start.entry.primary',
    })
    await repository.markFailed({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      executionSemanticKey: 'on_start.exit.primary',
      failureReason: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
      failureCode: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
    })
    await repository.markCooldown({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      executionSemanticKey: 'on_start.rebalance.primary',
      failureReason: 'COOLDOWN_AFTER_FAILURE',
      failureCode: 'COOLDOWN_AFTER_FAILURE',
      cooldownUntil: new Date('2026-04-20T09:00:00.000Z'),
    })

    const executableStates = await service.loadExecutableStates({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-1',
      snapshotHash: 'sha256:snap-1',
    })

    expect(executableStates).toHaveLength(1)
    expect(executableStates[0]).toMatchObject({
      executionSemanticKey: 'on_start.entry.secondary',
      status: 'ready',
    })
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
})
