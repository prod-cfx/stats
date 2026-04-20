import type { StrategyRuntimeExecutionState } from '@/prisma/prisma.types'
import type {
  UpsertReadyStateInput,
} from '../repositories/strategy-runtime-execution-state.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class metadata
import { StrategyRuntimeExecutionStateRepository } from '../repositories/strategy-runtime-execution-state.repository'
import { Injectable } from '@nestjs/common'

export type RuntimeExecutionStateStatus = 'ready' | 'consumed' | 'failed' | 'cooldown'

export interface RuntimeStateBinding {
  strategyInstanceId: string
  publishedSnapshotId: string
  snapshotHash: string
}

export interface RuntimeExecutionStateRecord extends RuntimeStateBinding {
  executionSemanticKey: string
  status: RuntimeExecutionStateStatus
  failureReason?: string | null
  failureCode?: string | null
  lastAttemptAt?: Date | null
  consumedAt?: Date | null
  cooldownUntil?: Date | null
}

export interface InitializeRuntimeExecutionStatesInput extends RuntimeStateBinding {
  snapshot: unknown
}

type RuntimeExecutionStateSource = RuntimeStateBinding & {
  executionSemanticKey: string
  status: string
  failureReason?: string | null
  failureCode?: string | null
  lastAttemptAt?: Date | null
  consumedAt?: Date | null
  cooldownUntil?: Date | null
}

const RUNTIME_EXECUTION_STATE_STATUSES: RuntimeExecutionStateStatus[] = ['ready', 'consumed', 'failed', 'cooldown']

@Injectable()
export class StrategyRuntimeExecutionStateService {
  constructor(private readonly repository: StrategyRuntimeExecutionStateRepository) {}

  buildExecutionSemanticKeysFromSnapshot(snapshot: unknown): string[] {
    const explicitKeys = this.readExplicitRuntimeExecutionSemantics(snapshot)
    if (!explicitKeys.length) return []
    return [...new Set(explicitKeys)]
  }

  async initializeStatesForDeploy(input: InitializeRuntimeExecutionStatesInput): Promise<string[]> {
    const semanticKeys = this.buildExecutionSemanticKeysFromSnapshot(input.snapshot)

    for (const executionSemanticKey of semanticKeys) {
      const payload: UpsertReadyStateInput = {
        strategyInstanceId: input.strategyInstanceId,
        publishedSnapshotId: input.publishedSnapshotId,
        snapshotHash: input.snapshotHash,
        executionSemanticKey,
      }
      await this.repository.upsertReadyState(payload)
    }

    return semanticKeys
  }

  async loadExecutableStates(binding: RuntimeStateBinding): Promise<RuntimeExecutionStateRecord[]> {
    const validatedStates = await this.loadStatesForBinding(binding)

    return validatedStates
      .filter(state => state.status === 'ready')
      .sort((left, right) => left.executionSemanticKey.localeCompare(right.executionSemanticKey))
  }

  async loadStatesForBinding(binding: RuntimeStateBinding): Promise<RuntimeExecutionStateRecord[]> {
    const states = await this.repository.findByInstanceAndSnapshot(binding.strategyInstanceId, binding.publishedSnapshotId)

    const validatedStates = await Promise.all(states.map(async state => this.validateSnapshotBinding(binding, state)))

    return validatedStates
      .sort((left, right) => left.executionSemanticKey.localeCompare(right.executionSemanticKey))
  }

  async validateSnapshotBinding(
    binding: RuntimeStateBinding,
    state: RuntimeExecutionStateSource,
  ): Promise<RuntimeExecutionStateRecord> {
    if (state.strategyInstanceId !== binding.strategyInstanceId) {
      throw new Error('strategy_instance_mismatch')
    }
    if (state.publishedSnapshotId !== binding.publishedSnapshotId) {
      throw new Error('published_snapshot_mismatch')
    }
    if (state.snapshotHash !== binding.snapshotHash) {
      throw new Error('snapshot_hash_mismatch')
    }

    return {
      strategyInstanceId: state.strategyInstanceId,
      publishedSnapshotId: state.publishedSnapshotId,
      snapshotHash: state.snapshotHash,
      executionSemanticKey: state.executionSemanticKey,
      status: this.normalizeStatus(state.status),
      failureReason: state.failureReason ?? null,
      failureCode: state.failureCode ?? null,
      lastAttemptAt: state.lastAttemptAt ?? null,
      consumedAt: state.consumedAt ?? null,
      cooldownUntil: state.cooldownUntil ?? null,
    }
  }

  validateBoundState(
    binding: RuntimeStateBinding,
    state: RuntimeExecutionStateSource,
  ) {
    return this.validateSnapshotBinding(binding, state)
  }

  private readExplicitRuntimeExecutionSemantics(snapshot: unknown): string[] {
    const root = this.readRecord(snapshot)
    const astSnapshot = this.readRecord(root?.astSnapshot)
    return [
      ...this.readSemanticKeyArray(root?.runtimeExecutionSemantics),
      ...this.readSemanticKeyArray(astSnapshot?.runtimeExecutionSemantics),
    ]
  }

  private readSemanticKeyArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((item) => {
      if (typeof item === 'string') {
        const normalized = item.trim()
        return this.isSupportedSemanticKey(normalized) ? [normalized] : []
      }

      const record = this.readRecord(item)
      const key = typeof record?.key === 'string'
        ? record.key.trim()
        : typeof record?.executionSemanticKey === 'string'
          ? record.executionSemanticKey.trim()
          : ''
      return this.isSupportedSemanticKey(key) ? [key] : []
    })
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  }

  private isSupportedSemanticKey(key: string): boolean {
    return /^on_start\.(entry|exit|rebalance)\.[a-z0-9_-]+$/i.test(key)
  }

  private normalizeStatus(status: string): RuntimeExecutionStateStatus {
    if (RUNTIME_EXECUTION_STATE_STATUSES.includes(status as RuntimeExecutionStateStatus)) {
      return status as RuntimeExecutionStateStatus
    }

    throw new Error('invalid_runtime_execution_state_status')
  }
}

export type StrategyRuntimeExecutionStateModel = StrategyRuntimeExecutionState
