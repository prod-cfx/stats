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

const SEMANTIC_KEY_LABELS = ['primary', 'secondary', 'tertiary', 'quaternary'] as const
const RUNTIME_EXECUTION_STATE_STATUSES: RuntimeExecutionStateStatus[] = ['ready', 'consumed', 'failed', 'cooldown']

@Injectable()
export class StrategyRuntimeExecutionStateService {
  constructor(private readonly repository: StrategyRuntimeExecutionStateRepository) {}

  buildExecutionSemanticKeysFromSnapshot(snapshot: unknown): string[] {
    const decisionPrograms = this.readDecisionPrograms(snapshot)
    if (!decisionPrograms.length) return []

    const counts = new Map<'entry' | 'exit' | 'rebalance', number>()

    return decisionPrograms.map(({ phase }) => {
      const nextCount = (counts.get(phase) ?? 0) + 1
      counts.set(phase, nextCount)
      return `on_start.${phase}.${this.resolveSemanticLabel(nextCount)}`
    })
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

  private readDecisionPrograms(snapshot: unknown): Array<{ phase: 'entry' | 'exit' | 'rebalance' }> {
    const root = this.readRecord(snapshot)
    const astSnapshot = this.readRecord(root?.astSnapshot)
    const astDecisionPrograms = this.readDecisionProgramsFromArray(astSnapshot?.decisionPrograms)
    if (astDecisionPrograms.length > 0) return astDecisionPrograms

    const compiledIr = this.readRecord(root?.compiledIr)
    return this.readDecisionProgramsFromArray(compiledIr?.ruleBlocks)
  }

  private readDecisionProgramsFromArray(value: unknown): Array<{ phase: 'entry' | 'exit' | 'rebalance' }> {
    if (!Array.isArray(value)) return []

    return value.flatMap((item) => {
      const phase = this.readDecisionPhase(this.readRecord(item)?.phase)
      return phase ? [{ phase }] : []
    })
  }

  private readDecisionPhase(value: unknown): 'entry' | 'exit' | 'rebalance' | null {
    return value === 'entry' || value === 'exit' || value === 'rebalance'
      ? value
      : null
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  }

  private resolveSemanticLabel(index: number): string {
    return SEMANTIC_KEY_LABELS[index - 1] ?? `slot_${index}`
  }

  private normalizeStatus(status: string): RuntimeExecutionStateStatus {
    if (RUNTIME_EXECUTION_STATE_STATUSES.includes(status as RuntimeExecutionStateStatus)) {
      return status as RuntimeExecutionStateStatus
    }

    throw new Error('invalid_runtime_execution_state_status')
  }
}

export type StrategyRuntimeExecutionStateModel = StrategyRuntimeExecutionState
