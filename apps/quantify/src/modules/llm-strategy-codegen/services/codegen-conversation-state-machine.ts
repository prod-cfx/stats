import type { ConstraintPackSnapshot } from '../constants/constraint-pack'
import type {
  LlmCodegenConversationStatus,
  LlmCodegenSessionStatus,
} from '../types/codegen-session-status'
import type { SemanticState } from '../types/semantic-state'
import type { StrategyClarificationState } from '../types/strategy-clarification'
import type { StrategyConsistencyReport } from '../types/strategy-consistency-report'
import type { Prisma } from '@/prisma/prisma.types'

import {
  isProcessingCodegenSessionStatus,
  isRequeueableCodegenSessionStatus,
  isTerminalCodegenSessionStatus,
} from '../types/codegen-session-status'

export class CodegenConversationStateMachine {
  resolvePlannerStatus(input: {
    logicReady: boolean
    clarificationState: Pick<StrategyClarificationState, 'status'>
  }): LlmCodegenConversationStatus {
    return input.logicReady && input.clarificationState.status === 'CLEAR'
      ? 'CONFIRM_GATE'
      : 'DRAFTING'
  }

  isTerminalStatus(status: LlmCodegenSessionStatus) {
    return isTerminalCodegenSessionStatus(status)
  }

  isProcessingStatus(status: LlmCodegenSessionStatus) {
    return isProcessingCodegenSessionStatus(status)
  }

  shouldTryRequeue(status: LlmCodegenSessionStatus): boolean {
    return isRequeueableCodegenSessionStatus(status)
  }

  buildConversationUpdate(input: {
    status: LlmCodegenConversationStatus
    semanticState?: SemanticState | null
    clarificationState: StrategyClarificationState
    constraintPack: ConstraintPackSnapshot
    latestSpecDesc?: Record<string, unknown> | null
  }): Prisma.LlmStrategyCodegenSessionUpdateInput {
    return {
      status: input.status,
      ...(input.semanticState ? { semanticState: input.semanticState as unknown as Prisma.InputJsonValue } : {}),
      clarificationState: input.clarificationState as unknown as Prisma.InputJsonValue,
      constraintPack: input.constraintPack as unknown as Prisma.InputJsonValue,
      ...(input.latestSpecDesc ? { latestSpecDesc: input.latestSpecDesc as Prisma.InputJsonValue } : {}),
    } as Prisma.LlmStrategyCodegenSessionUpdateInput
  }

  buildGeneratingUpdate(input: {
    semanticState?: SemanticState | null
    clarificationState: StrategyClarificationState
    constraintPack: ConstraintPackSnapshot
    latestSpecDesc: Record<string, unknown>
  }): Prisma.LlmStrategyCodegenSessionUpdateInput {
    return {
      status: 'GENERATING',
      ...(input.semanticState ? { semanticState: input.semanticState as unknown as Prisma.InputJsonValue } : {}),
      clarificationState: input.clarificationState as unknown as Prisma.InputJsonValue,
      constraintPack: input.constraintPack as unknown as Prisma.InputJsonValue,
      latestSpecDesc: input.latestSpecDesc as Prisma.InputJsonValue,
      rejectReason: null,
    } as Prisma.LlmStrategyCodegenSessionUpdateInput
  }

  buildValidatingConsistencyUpdate(latestDraftCode: string): Prisma.LlmStrategyCodegenSessionUpdateInput {
    return {
      status: 'VALIDATING_CONSISTENCY',
      latestDraftCode,
    }
  }

  buildRejectedUpdate(input: {
    rejectReason: string
    latestDraftCode?: string | null
    latestSpecDesc?: Record<string, unknown> | Prisma.InputJsonValue | null
    strategyInstanceId?: string | null
  }): Prisma.LlmStrategyCodegenSessionUpdateInput {
    return {
      status: 'REJECTED',
      rejectReason: input.rejectReason,
      ...(input.latestDraftCode !== undefined ? { latestDraftCode: input.latestDraftCode } : {}),
      ...(input.latestSpecDesc !== undefined
        ? { latestSpecDesc: input.latestSpecDesc as Prisma.InputJsonValue | null }
        : {}),
      ...(input.strategyInstanceId !== undefined ? { strategyInstanceId: input.strategyInstanceId } : {}),
    } as Prisma.LlmStrategyCodegenSessionUpdateInput
  }

  buildConsistencyFailedUpdate(input: {
    latestDraftCode: string
    latestSpecDesc: Record<string, unknown> | Prisma.InputJsonValue
    rejectReason: string
    strategyInstanceId?: string | null
  }): Prisma.LlmStrategyCodegenSessionUpdateInput {
    return {
      status: 'CONSISTENCY_FAILED',
      latestDraftCode: input.latestDraftCode,
      latestSpecDesc: input.latestSpecDesc as Prisma.InputJsonValue,
      rejectReason: input.rejectReason,
      ...(input.strategyInstanceId !== undefined ? { strategyInstanceId: input.strategyInstanceId } : {}),
    } as Prisma.LlmStrategyCodegenSessionUpdateInput
  }

  buildPublishedUpdate(input: {
    latestDraftCode: string
    latestSpecDesc: Record<string, unknown> | Prisma.InputJsonValue
    strategyInstanceId?: string | null
  }): Prisma.LlmStrategyCodegenSessionUpdateInput {
    return {
      status: 'PUBLISHED',
      latestDraftCode: input.latestDraftCode,
      latestSpecDesc: input.latestSpecDesc as Prisma.InputJsonValue,
      rejectReason: null,
      ...(input.strategyInstanceId !== undefined ? { strategyInstanceId: input.strategyInstanceId } : {}),
    } as Prisma.LlmStrategyCodegenSessionUpdateInput
  }

  buildConsistencyRejectReason(report: StrategyConsistencyReport): string {
    const failedChecks = report.checks
      .filter(item => item.level === 'critical' && item.status === 'failed')
      .slice(0, 4)
      .map(item => item.message)
    if (failedChecks.length === 0) {
      return '正式策略语义与脚本语义一致性校验失败'
    }
    return `正式策略语义与脚本语义不一致：${failedChecks.join('；')}`
  }

  buildCompiledPublishRejectReason(report: Record<string, unknown>): string {
    const compilerConsistency = this.readRecord(report.compilerConsistency)
    const reasons: string[] = []

    const graphVsIr = this.readRecord(compilerConsistency?.graphVsIr)
    if (graphVsIr?.passed === false) {
      reasons.push('semantic view 与 IR 摘要不一致')
    }

    const irVsScript = this.readRecord(compilerConsistency?.irVsScript)
    if (irVsScript?.passed === false) {
      reasons.push('IR 与 compiled script 摘要不一致')
    }

    const manifestSelfCheck = this.readRecord(compilerConsistency?.manifestSelfCheck)
    if (manifestSelfCheck?.passed === false) {
      reasons.push('compiled manifest 自校验失败')
    }

    return reasons.length > 0
      ? `编译发布一致性校验失败：${reasons.join('；')}`
      : '编译发布一致性校验失败'
  }

  readPublishedConsistencyStatus(report: Record<string, unknown>): string | null {
    return typeof report.status === 'string' ? report.status : null
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }

    return value as Record<string, unknown>
  }
}
