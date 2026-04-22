import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, StrategyRuntimeExecutionState } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

export interface RuntimeExecutionStateKeyInput {
  strategyInstanceId: string
  publishedSnapshotId: string
  executionSemanticKey: string
}

export interface UpsertReadyStateInput extends RuntimeExecutionStateKeyInput {
  snapshotHash: string
}

export interface MarkFailedStateInput extends RuntimeExecutionStateKeyInput {
  failureReason?: string | null
  failureCode?: string | null
}

export interface MarkRetryableFailureStateInput extends MarkFailedStateInput {
  cooldownUntil: Date
}

export type MarkCooldownStateInput = MarkRetryableFailureStateInput

export interface RecoverStaleRunningStatesInput {
  strategyInstanceId: string
  publishedSnapshotId: string
  leaseExpiresBefore: Date
  failureReason?: string | null
  failureCode?: string | null
}

@Injectable()
export class StrategyRuntimeExecutionStateRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  findByInstanceAndSnapshot(strategyInstanceId: string, publishedSnapshotId: string): Promise<StrategyRuntimeExecutionState[]> {
    return this.txHost.tx.strategyRuntimeExecutionState.findMany({
      where: {
        strategyInstanceId,
        publishedSnapshotId,
      },
      orderBy: [
        { executionSemanticKey: 'asc' },
      ],
    })
  }

  async recoverStaleRunningStates(input: RecoverStaleRunningStatesInput): Promise<number> {
    const recoveryTimestamp = new Date()
    const result = await this.txHost.tx.strategyRuntimeExecutionState.updateMany({
      where: {
        strategyInstanceId: input.strategyInstanceId,
        publishedSnapshotId: input.publishedSnapshotId,
        status: 'running',
        runningAt: {
          not: null,
          lte: input.leaseExpiresBefore,
        },
      },
      data: {
        status: 'retryable',
        failureFamily: 'retryable',
        failureReason: input.failureReason ?? null,
        failureCode: input.failureCode ?? null,
        attemptCount: { increment: 1 },
        lastAttemptAt: recoveryTimestamp,
        runningAt: null,
        terminalAt: null,
        consumedAt: null,
        cooldownUntil: null,
      },
    })

    return result.count
  }

  async upsertReadyState(input: UpsertReadyStateInput): Promise<StrategyRuntimeExecutionState> {
    const where = {
      strategyInstanceId_publishedSnapshotId_executionSemanticKey: {
        strategyInstanceId: input.strategyInstanceId,
        publishedSnapshotId: input.publishedSnapshotId,
        executionSemanticKey: input.executionSemanticKey,
      },
    }

    const existing = await this.txHost.tx.strategyRuntimeExecutionState.findUnique({ where })
    if (!existing) {
      try {
        return await this.txHost.tx.strategyRuntimeExecutionState.create({
          data: this.buildCreateData(input),
        })
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) throw error

        const conflicted = await this.txHost.tx.strategyRuntimeExecutionState.findUnique({ where })
        if (!conflicted) throw error
        if (conflicted.snapshotHash !== input.snapshotHash) {
          throw new Error('snapshot_hash_mismatch')
        }

        return conflicted
      }
    }

    if (existing.snapshotHash !== input.snapshotHash) {
      throw new Error('snapshot_hash_mismatch')
    }

    return existing
  }

  markConsumed(input: RuntimeExecutionStateKeyInput): Promise<StrategyRuntimeExecutionState> {
    return this.txHost.tx.strategyRuntimeExecutionState.update({
      where: {
        strategyInstanceId_publishedSnapshotId_executionSemanticKey: {
          strategyInstanceId: input.strategyInstanceId,
          publishedSnapshotId: input.publishedSnapshotId,
          executionSemanticKey: input.executionSemanticKey,
        },
      },
      data: {
        status: 'consumed',
        failureFamily: null,
        failureReason: null,
        failureCode: null,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        runningAt: null,
        terminalAt: new Date(),
        consumedAt: new Date(),
        cooldownUntil: null,
      },
    })
  }

  markRunning(input: RuntimeExecutionStateKeyInput): Promise<StrategyRuntimeExecutionState> {
    return this.txHost.tx.strategyRuntimeExecutionState.update({
      where: {
        strategyInstanceId_publishedSnapshotId_executionSemanticKey: {
          strategyInstanceId: input.strategyInstanceId,
          publishedSnapshotId: input.publishedSnapshotId,
          executionSemanticKey: input.executionSemanticKey,
        },
      },
      data: {
        status: 'running',
        failureFamily: null,
        failureReason: null,
        failureCode: null,
        runningAt: new Date(),
        terminalAt: null,
        consumedAt: null,
        cooldownUntil: null,
      },
    })
  }

  markFailed(input: MarkFailedStateInput): Promise<StrategyRuntimeExecutionState> {
    return this.markTerminalFailure(input)
  }

  markTerminalFailure(input: MarkFailedStateInput): Promise<StrategyRuntimeExecutionState> {
    return this.txHost.tx.strategyRuntimeExecutionState.update({
      where: {
        strategyInstanceId_publishedSnapshotId_executionSemanticKey: {
          strategyInstanceId: input.strategyInstanceId,
          publishedSnapshotId: input.publishedSnapshotId,
          executionSemanticKey: input.executionSemanticKey,
        },
      },
      data: {
        status: 'terminal',
        failureFamily: 'terminal',
        failureReason: input.failureReason ?? null,
        failureCode: input.failureCode ?? null,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        runningAt: null,
        terminalAt: new Date(),
        consumedAt: null,
        cooldownUntil: null,
      },
    })
  }

  markRetryableFailure(input: MarkRetryableFailureStateInput): Promise<StrategyRuntimeExecutionState> {
    return this.txHost.tx.strategyRuntimeExecutionState.update({
      where: {
        strategyInstanceId_publishedSnapshotId_executionSemanticKey: {
          strategyInstanceId: input.strategyInstanceId,
          publishedSnapshotId: input.publishedSnapshotId,
          executionSemanticKey: input.executionSemanticKey,
        },
      },
      data: {
        status: 'retryable',
        failureFamily: 'retryable',
        failureReason: input.failureReason ?? null,
        failureCode: input.failureCode ?? null,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        runningAt: null,
        terminalAt: null,
        consumedAt: null,
        cooldownUntil: input.cooldownUntil,
      },
    })
  }

  markCooldown(input: MarkCooldownStateInput): Promise<StrategyRuntimeExecutionState> {
    return this.markRetryableFailure(input)
  }

  private buildCreateData(input: UpsertReadyStateInput) {
    return {
      strategyInstance: { connect: { id: input.strategyInstanceId } },
      publishedSnapshotId: input.publishedSnapshotId,
      snapshotHash: input.snapshotHash,
      executionSemanticKey: input.executionSemanticKey,
      status: 'ready',
      failureFamily: null,
      attemptCount: 0,
      runningAt: null,
      terminalAt: null,
    }
  }

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error as { code?: unknown }).code === 'P2002'
  }
}
