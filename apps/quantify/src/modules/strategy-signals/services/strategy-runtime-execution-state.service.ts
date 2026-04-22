import type { StrategyRuntimeExecutionState } from '@/prisma/prisma.types'
import type {
  MarkFailedStateInput,
  MarkRetryableFailureStateInput,
  RuntimeExecutionStateKeyInput,
  UpsertReadyStateInput,
} from '../repositories/strategy-runtime-execution-state.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class metadata
import { StrategyRuntimeExecutionStateRepository } from '../repositories/strategy-runtime-execution-state.repository'
import { Injectable } from '@nestjs/common'

export type RuntimeExecutionStateStatus = 'ready' | 'running' | 'retryable' | 'terminal' | 'consumed'
export type RuntimeExecutionFailureFamily = 'retryable' | 'terminal'

export interface RuntimeStateBinding {
  strategyInstanceId: string
  publishedSnapshotId: string
  snapshotHash: string
}

export interface RuntimeExecutionStateRecord extends RuntimeStateBinding {
  executionSemanticKey: string
  status: RuntimeExecutionStateStatus
  failureFamily?: RuntimeExecutionFailureFamily | null
  failureReason?: string | null
  failureCode?: string | null
  attemptCount: number
  lastAttemptAt?: Date | null
  runningAt?: Date | null
  terminalAt?: Date | null
  consumedAt?: Date | null
  cooldownUntil?: Date | null
}

export interface InitializeRuntimeExecutionStatesInput extends RuntimeStateBinding {
  snapshot: unknown
}

type RuntimeExecutionStateSource = RuntimeStateBinding & {
  executionSemanticKey: string
  status: string
  failureFamily?: string | null
  failureReason?: string | null
  failureCode?: string | null
  attemptCount?: number | null
  lastAttemptAt?: Date | null
  runningAt?: Date | null
  terminalAt?: Date | null
  consumedAt?: Date | null
  cooldownUntil?: Date | null
}

const RUNTIME_EXECUTION_STATE_STATUSES: RuntimeExecutionStateStatus[] = ['ready', 'running', 'retryable', 'terminal', 'consumed']
const RUNTIME_EXECUTION_FAILURE_FAMILIES: RuntimeExecutionFailureFamily[] = ['retryable', 'terminal']
const RUNTIME_RUNNING_STATE_LEASE_MS = 5 * 60 * 1000
const RUNTIME_RUNNING_LEASE_EXPIRED_CODE = 'RUNTIME_RUNNING_LEASE_EXPIRED'

@Injectable()
export class StrategyRuntimeExecutionStateService {
  constructor(private readonly repository: StrategyRuntimeExecutionStateRepository) {}

  buildExecutionSemanticKeysFromSnapshot(snapshot: unknown): string[] {
    const explicitKeys = this.readExplicitRuntimeExecutionSemantics(snapshot)
    if (!explicitKeys.length) return []
    return explicitKeys
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

  async markRunning(input: RuntimeExecutionStateKeyInput): Promise<RuntimeExecutionStateRecord> {
    return this.validateTransitionResult(input, await this.repository.markRunning(input))
  }

  async markRetryableFailure(input: MarkRetryableFailureStateInput): Promise<RuntimeExecutionStateRecord> {
    return this.validateTransitionResult(input, await this.repository.markRetryableFailure(input))
  }

  async markTerminalFailure(input: MarkFailedStateInput): Promise<RuntimeExecutionStateRecord> {
    return this.validateTransitionResult(input, await this.repository.markTerminalFailure(input))
  }

  async markConsumed(input: RuntimeExecutionStateKeyInput): Promise<RuntimeExecutionStateRecord> {
    return this.validateTransitionResult(input, await this.repository.markConsumed(input))
  }

  async loadExecutableStates(binding: RuntimeStateBinding): Promise<RuntimeExecutionStateRecord[]> {
    await this.repository.recoverStaleRunningStates({
      strategyInstanceId: binding.strategyInstanceId,
      publishedSnapshotId: binding.publishedSnapshotId,
      leaseExpiresBefore: new Date(Date.now() - RUNTIME_RUNNING_STATE_LEASE_MS),
      failureReason: RUNTIME_RUNNING_LEASE_EXPIRED_CODE,
      failureCode: RUNTIME_RUNNING_LEASE_EXPIRED_CODE,
    })

    const validatedStates = await this.loadStatesForBinding(binding)
    const now = Date.now()

    return validatedStates
      .filter((state) => {
        if (state.status === 'ready') return true
        if (state.status !== 'retryable') return false
        if (!state.cooldownUntil) return true
        return state.cooldownUntil.getTime() <= now
      })
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
      failureFamily: this.normalizeFailureFamily(state.failureFamily),
      failureReason: state.failureReason ?? null,
      failureCode: state.failureCode ?? null,
      attemptCount: this.normalizeAttemptCount(state.attemptCount),
      lastAttemptAt: state.lastAttemptAt ?? null,
      runningAt: state.runningAt ?? null,
      terminalAt: state.terminalAt ?? null,
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

  private validateTransitionResult(
    key: RuntimeExecutionStateKeyInput,
    state: RuntimeExecutionStateSource,
  ): Promise<RuntimeExecutionStateRecord> {
    return this.validateSnapshotBinding({
      strategyInstanceId: key.strategyInstanceId,
      publishedSnapshotId: key.publishedSnapshotId,
      snapshotHash: state.snapshotHash,
    }, state)
  }

  private readExplicitRuntimeExecutionSemantics(snapshot: unknown): string[] {
    const root = this.readRecord(snapshot)
    if (root && Object.prototype.hasOwnProperty.call(root, 'runtimeExecutionSemantics')) {
      throw new Error('misplaced_runtime_execution_semantics')
    }
    const astSnapshot = this.readRecord(root?.astSnapshot)
    return this.readCanonicalSemanticKeyArray(astSnapshot?.runtimeExecutionSemantics)
  }

  private readCanonicalSemanticKeyArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((item) => {
      if (typeof item === 'string') {
        throw new Error('legacy_runtime_execution_semantics_unsupported')
      }

      const record = this.readRecord(item)
      if (record && (typeof record.key === 'string' || typeof record.executionSemanticKey === 'string')) {
        throw new Error('legacy_runtime_execution_semantics_unsupported')
      }

      if (!record) {
        throw new Error('invalid_runtime_execution_semantics_shape')
      }

      const key = typeof record?.semanticKey === 'string'
        ? record.semanticKey.trim()
        : ''
      if (!key) {
        throw new Error('invalid_runtime_execution_semantics_shape')
      }
      if (!this.isSupportedSemanticKey(key)) {
        throw new Error('invalid_runtime_execution_semantic_key')
      }
      return [key]
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

  private normalizeFailureFamily(failureFamily: string | null | undefined): RuntimeExecutionFailureFamily | null {
    if (failureFamily == null) {
      return null
    }

    if (RUNTIME_EXECUTION_FAILURE_FAMILIES.includes(failureFamily as RuntimeExecutionFailureFamily)) {
      return failureFamily as RuntimeExecutionFailureFamily
    }

    throw new Error('invalid_runtime_execution_failure_family')
  }

  private normalizeAttemptCount(attemptCount: number | null | undefined): number {
    if (typeof attemptCount !== 'number' || !Number.isInteger(attemptCount) || attemptCount < 0) {
      throw new Error('invalid_runtime_execution_attempt_count')
    }

    return attemptCount
  }
}

export type StrategyRuntimeExecutionStateModel = StrategyRuntimeExecutionState
