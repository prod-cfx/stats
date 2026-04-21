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

export interface MarkCooldownStateInput extends MarkFailedStateInput {
  cooldownUntil: Date
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
        failureReason: null,
        failureCode: null,
        lastAttemptAt: new Date(),
        consumedAt: new Date(),
        cooldownUntil: null,
      },
    })
  }

  markFailed(input: MarkFailedStateInput): Promise<StrategyRuntimeExecutionState> {
    return this.txHost.tx.strategyRuntimeExecutionState.update({
      where: {
        strategyInstanceId_publishedSnapshotId_executionSemanticKey: {
          strategyInstanceId: input.strategyInstanceId,
          publishedSnapshotId: input.publishedSnapshotId,
          executionSemanticKey: input.executionSemanticKey,
        },
      },
      data: {
        status: 'failed',
        failureReason: input.failureReason ?? null,
        failureCode: input.failureCode ?? null,
        lastAttemptAt: new Date(),
      },
    })
  }

  markCooldown(input: MarkCooldownStateInput): Promise<StrategyRuntimeExecutionState> {
    return this.txHost.tx.strategyRuntimeExecutionState.update({
      where: {
        strategyInstanceId_publishedSnapshotId_executionSemanticKey: {
          strategyInstanceId: input.strategyInstanceId,
          publishedSnapshotId: input.publishedSnapshotId,
          executionSemanticKey: input.executionSemanticKey,
        },
      },
      data: {
        status: 'cooldown',
        failureReason: input.failureReason ?? null,
        failureCode: input.failureCode ?? null,
        lastAttemptAt: new Date(),
        cooldownUntil: input.cooldownUntil,
      },
    })
  }

  private buildCreateData(input: UpsertReadyStateInput) {
    return {
      strategyInstance: { connect: { id: input.strategyInstanceId } },
      publishedSnapshotId: input.publishedSnapshotId,
      snapshotHash: input.snapshotHash,
      executionSemanticKey: input.executionSemanticKey,
      status: 'ready',
    }
  }

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error as { code?: unknown }).code === 'P2002'
  }
}
