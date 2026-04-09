import type { CodegenSessionsRepository } from '../repositories/codegen-sessions.repository'
import type { CompiledScriptValidationResult } from './codegen-publication-generation.stage'
import type { CompiledPublicationGateService } from './compiled-publication-gate.service'
import type { RecommendationIndexService } from './recommendation-index.service'
import type { Prisma } from '@/prisma/prisma.types'

export interface PublishSessionBindingInput {
  userId: string
  sessionId: string
  name: string
  description: string
  llmModel: string
  scriptCode: string
  specDesc: Record<string, unknown>
  params: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export class CodegenPublicationPersistenceStage {
  constructor(
    private readonly sessionsRepo: CodegenSessionsRepository,
    private readonly recommendationIndex: RecommendationIndexService,
    private readonly compiledPublicationGate: CompiledPublicationGateService,
  ) {}

  async persistValidatedVersion(input: {
    sessionId: string
    semanticView: Record<string, unknown>
    sessionSpecDesc: Record<string, unknown>
    compiledScript: string
    validation: CompiledScriptValidationResult
  }): Promise<{ versionId: string }> {
    const version = await this.sessionsRepo.createVersion({
      session: { connect: { id: input.sessionId } },
      scriptCode: input.compiledScript,
      specDesc: input.sessionSpecDesc as Prisma.InputJsonValue,
      staticPassed: input.validation.staticPassed,
      runtimePassed: input.validation.runtimePassed,
      outputPassed: input.validation.outputPassed,
    })

    await this.recommendationIndex.onSpecDescPersisted({
      versionId: version.id,
      specDesc: input.semanticView,
    })

    return { versionId: version.id }
  }

  async ensureDraftStrategyInstanceBound(input: PublishSessionBindingInput): Promise<{
    strategyTemplateId: string
    strategyInstanceId: string
  }> {
    return this.sessionsRepo.ensureDraftStrategyInstanceBoundForPublishedSession(input)
  }

  async publish(input: {
    sessionId: string
    strategyTemplateId?: string | null
    strategyInstanceId?: string | null
    canonicalSnapshot: Record<string, unknown>
    semanticView: Record<string, unknown>
    graphSnapshot: Record<string, unknown>
    ir: Record<string, unknown>
    ast: Record<string, unknown>
    executionEnvelope: Record<string, unknown>
    script: string
    semanticConsistencyReport: Record<string, unknown>
    userIntentSummary: Record<string, unknown>
    strategySummary: Record<string, unknown>
    scriptSummary: Record<string, unknown>
    lockedParams: Record<string, unknown>
  }): Promise<{ snapshotId: string, consistencyReport: Record<string, unknown> }> {
    return this.compiledPublicationGate.publish(input as any)
  }
}
