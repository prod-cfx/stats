import type { CodegenSessionsRepository } from '../repositories/codegen-sessions.repository'
import type { ChecklistPayload } from '../types/codegen-checklist'
import type { CanonicalSpecBuilderService } from './canonical-spec-builder.service'
import type { CanonicalSpecV2IrCompilerService } from './canonical-spec-v2-ir-compiler.service'
import type { CanonicalStrategyAstCompilerService } from './canonical-strategy-ast-compiler.service'
import type { CompiledPublicationGateService } from './compiled-publication-gate.service'
import type { CompiledScriptEmitterService } from './compiled-script-emitter.service'
import type { CompiledScriptExecutionEnvelopeService } from './compiled-script-execution-envelope.service'
import type { CompiledScriptParserService } from './compiled-script-parser.service'
import type { RecommendationIndexService } from './recommendation-index.service'
import type { SpecDescBuilderService } from './spec-desc-builder.service'
import type { StrategyConsistencyService } from './strategy-consistency.service'
import type { StrategySummaryBuilderService } from './strategy-summary-builder.service'

import { Injectable } from '@nestjs/common'
import { CodegenConversationStateMachine } from './codegen-conversation-state-machine'
import { CodegenPublicationGenerationStage } from './codegen-publication-generation.stage'
import { CodegenPublicationPersistenceStage } from './codegen-publication-persistence.stage'

const DEFAULT_MODEL = 'gpt-4'

@Injectable()
export class CodegenSessionPublicationPipelineService {
  private readonly stateMachine = new CodegenConversationStateMachine()
  private readonly generationStage: CodegenPublicationGenerationStage
  private readonly persistenceStage: CodegenPublicationPersistenceStage

  constructor(
    private readonly sessionsRepo: CodegenSessionsRepository,
    recommendationIndex: RecommendationIndexService,
    canonicalSpecBuilder: CanonicalSpecBuilderService,
    specDescBuilder: SpecDescBuilderService,
    strategyConsistencyService: StrategyConsistencyService,
    strategySummaryBuilder: StrategySummaryBuilderService,
    canonicalSpecV2IrCompiler: CanonicalSpecV2IrCompilerService,
    canonicalStrategyAstCompiler: CanonicalStrategyAstCompilerService,
    compiledScriptEmitter: CompiledScriptEmitterService,
    compiledScriptExecutionEnvelope: CompiledScriptExecutionEnvelopeService,
    compiledScriptParser: CompiledScriptParserService,
    compiledPublicationGate: CompiledPublicationGateService,
  ) {
    this.generationStage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      specDescBuilder,
      strategySummaryBuilder,
      strategyConsistencyService,
      canonicalSpecV2IrCompiler,
      canonicalStrategyAstCompiler,
      compiledScriptEmitter,
      compiledScriptExecutionEnvelope,
      compiledScriptParser,
    )
    this.persistenceStage = new CodegenPublicationPersistenceStage(
      sessionsRepo,
      recommendationIndex,
      compiledPublicationGate,
    )
  }

  async run(args: {
    sessionId: string
    userId: string
    checklist: ChecklistPayload
    message: string
    model?: string
    existingStrategyInstanceId?: string | null
  }): Promise<void> {
    try {
      const artifacts = await this.generationStage.generate({
        checklist: args.checklist,
        message: args.message,
      })
      let strategyInstanceId = args.existingStrategyInstanceId
        ?? await this.sessionsRepo.findSessionStrategyInstanceId(args.sessionId)

      if (!artifacts.validation.passed) {
        await this.sessionsRepo.updateSession(
          args.sessionId,
          this.stateMachine.buildRejectedUpdate({
            latestDraftCode: artifacts.validation.scriptCode,
            rejectReason: artifacts.validation.reason ?? '编译脚本结构校验失败',
            strategyInstanceId,
          }),
        )
        return
      }

      await this.sessionsRepo.updateSession(
        args.sessionId,
        this.stateMachine.buildValidatingConsistencyUpdate(artifacts.compiledScript),
      )

      await this.persistenceStage.persistValidatedVersion({
        sessionId: args.sessionId,
        semanticView: artifacts.semanticView,
        sessionSpecDesc: artifacts.sessionSpecDesc,
        compiledScript: artifacts.compiledScript,
        validation: artifacts.validation,
      })

      if (artifacts.semanticConsistency.status !== 'PASSED') {
        await this.sessionsRepo.updateSession(
          args.sessionId,
          this.stateMachine.buildConsistencyFailedUpdate({
            latestSpecDesc: artifacts.sessionSpecDesc,
            latestDraftCode: artifacts.compiledScript,
            rejectReason: this.stateMachine.buildConsistencyRejectReason(artifacts.semanticConsistency),
            strategyInstanceId,
          }),
        )
        return
      }

      const publishInput = this.buildPublishedStrategyInput({
        sessionId: args.sessionId,
        userId: args.userId,
        message: args.message,
        model: args.model,
        compiledScript: artifacts.compiledScript,
        sessionSpecDesc: artifacts.sessionSpecDesc,
        publishParams: artifacts.publishParams,
        lockedParams: artifacts.lockedParams,
      })

      let strategyTemplateId: string | null = null
      if (!strategyInstanceId) {
        try {
          const bound = await this.persistenceStage.ensureDraftStrategyInstanceBound(publishInput)
          strategyTemplateId = bound.strategyTemplateId || null
          strategyInstanceId = bound.strategyInstanceId
        } catch (publishError) {
          const publishReason = publishError instanceof Error ? publishError.message : String(publishError)
          await this.sessionsRepo.updateSession(
            args.sessionId,
            this.stateMachine.buildRejectedUpdate({
              latestSpecDesc: artifacts.sessionSpecDesc,
              latestDraftCode: artifacts.compiledScript,
              rejectReason: publishReason,
              strategyInstanceId: null,
            }),
          )
          return
        }
      }

      const snapshot = await this.persistenceStage.publish({
        sessionId: args.sessionId,
        strategyTemplateId,
        strategyInstanceId: strategyInstanceId ?? null,
        canonicalSnapshot: artifacts.canonicalSpec as unknown as Record<string, unknown>,
        semanticView: artifacts.semanticView,
        graphSnapshot: artifacts.compiled.graphSnapshot as unknown as Record<string, unknown>,
        ir: artifacts.compiled.ir as unknown as Record<string, unknown>,
        ast: artifacts.ast as unknown as Record<string, unknown>,
        executionEnvelope: artifacts.executionEnvelope as unknown as Record<string, unknown>,
        script: artifacts.compiledScript,
        semanticConsistencyReport: artifacts.semanticConsistency as unknown as Record<string, unknown>,
        userIntentSummary: artifacts.userIntentSummary as unknown as Record<string, unknown>,
        strategySummary: artifacts.strategySummary as unknown as Record<string, unknown>,
        scriptSummary: artifacts.scriptSummary as unknown as Record<string, unknown>,
        lockedParams: artifacts.lockedParams,
      })

      if (this.stateMachine.readPublishedConsistencyStatus(snapshot.consistencyReport) !== 'PASSED') {
        await this.sessionsRepo.updateSession(
          args.sessionId,
          this.stateMachine.buildConsistencyFailedUpdate({
            latestSpecDesc: {
              ...artifacts.sessionSpecDesc,
              consistencyReport: snapshot.consistencyReport,
            },
            latestDraftCode: artifacts.compiledScript,
            rejectReason: this.stateMachine.buildCompiledPublishRejectReason(snapshot.consistencyReport),
            strategyInstanceId: strategyInstanceId ?? null,
          }),
        )
        return
      }

      await this.sessionsRepo.updateSession(
        args.sessionId,
        this.stateMachine.buildPublishedUpdate({
          latestDraftCode: artifacts.compiledScript,
          latestSpecDesc: {
            ...artifacts.sessionSpecDesc,
            consistencyReport: snapshot.consistencyReport,
            publishedSnapshotId: snapshot.snapshotId,
          },
          strategyInstanceId: strategyInstanceId ?? null,
        }),
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      await this.sessionsRepo.updateSession(
        args.sessionId,
        this.stateMachine.buildRejectedUpdate({ rejectReason: reason }),
      )
    }
  }

  async runConfirmedPublicationPipeline(args: {
    sessionId: string
    userId: string
    checklist: ChecklistPayload
    message: string
    model?: string
    existingStrategyInstanceId?: string | null
  }): Promise<void> {
    await this.run(args)
  }

  private buildPublishedStrategyInput(args: {
    sessionId: string
    userId: string
    message: string
    model?: string
    compiledScript: string
    sessionSpecDesc: Record<string, unknown>
    publishParams: {
      symbol: string
      timeframe: string
      marketType: 'spot' | 'perp'
    }
    lockedParams: Record<string, unknown>
  }): {
    userId: string
    sessionId: string
    name: string
    description: string
    llmModel: string
    scriptCode: string
    specDesc: Record<string, unknown>
    params: Record<string, unknown>
    metadata: Record<string, unknown>
  } {
    const name = `${args.publishParams.symbol} ${args.publishParams.timeframe} AI策略`
    return {
      userId: args.userId,
      sessionId: args.sessionId,
      name,
      description: 'LLM 对话发布策略',
      llmModel: args.model ?? DEFAULT_MODEL,
      scriptCode: args.compiledScript,
      specDesc: args.sessionSpecDesc,
      params: {
        symbol: args.publishParams.symbol,
        timeframe: args.publishParams.timeframe,
        marketType: args.publishParams.marketType,
      },
      metadata: {
        source: 'llm-codegen-session',
        confirmMessage: args.message,
        lockedParams: args.lockedParams,
      },
    }
  }
}
