import type { ChecklistPayload } from '../types/codegen-checklist'
import type { SemanticState } from '../types/semantic-state'
import type { CodegenPublicationGenerationInput } from './codegen-publication-generation.stage'

import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CodegenSessionsRepository } from '../repositories/codegen-sessions.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CanonicalSpecBuilderService } from './canonical-spec-builder.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CanonicalSpecV2IrCompilerService } from './canonical-spec-v2-ir-compiler.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CanonicalStrategyAstCompilerService } from './canonical-strategy-ast-compiler.service'
import { CodegenConversationStateMachine } from './codegen-conversation-state-machine'
import { CodegenPublicationGenerationStage } from './codegen-publication-generation.stage'
import { CodegenPublicationPersistenceStage } from './codegen-publication-persistence.stage'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CompiledPublicationGateService } from './compiled-publication-gate.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CompiledScriptEmitterService } from './compiled-script-emitter.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CompiledScriptExecutionEnvelopeService } from './compiled-script-execution-envelope.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CompiledScriptParserService } from './compiled-script-parser.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { RecommendationIndexService } from './recommendation-index.service'
import { SemanticStateCompileBridgeService } from './semantic-state-compile-bridge.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { SpecDescBuilderService } from './spec-desc-builder.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { StrategyConsistencyService } from './strategy-consistency.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { StrategySummaryBuilderService } from './strategy-summary-builder.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { StrategySummaryObservationService } from './strategy-summary-observation.service'

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
    strategySummaryObservation: StrategySummaryObservationService,
    compiledPublicationGate: CompiledPublicationGateService,
    semanticStateCompileBridge: SemanticStateCompileBridgeService = new SemanticStateCompileBridgeService(),
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
      strategySummaryObservation,
      undefined,
      semanticStateCompileBridge,
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
    semanticState?: SemanticState
    message: string
    model?: string
    existingStrategyInstanceId?: string | null
  }): Promise<void> {
    try {
      const generationInput: CodegenPublicationGenerationInput = {
        checklist: args.checklist,
        semanticState: args.semanticState,
        message: args.message,
      }
      const artifacts = await this.generationStage.generate(generationInput)
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

      let snapshot: { snapshotId: string, snapshotHash: string, consistencyReport: Record<string, unknown> }
      try {
        snapshot = await this.persistenceStage.publish({
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
        if (strategyInstanceId) {
          await this.sessionsRepo.bindPublishedSnapshotToStrategyInstance?.({
            strategyInstanceId,
            userId: args.userId,
            publishedSnapshotId: snapshot.snapshotId,
            snapshotHash: snapshot.snapshotHash,
            strategyTemplateId,
          })
        }
      } catch (error) {
        const publicationGate = this.normalizePublicationGate(
          (error as { publicationGate?: unknown } | null)?.publicationGate,
        )
        if (publicationGate) {
          const reason = error instanceof Error ? error.message : String(error)
          await this.sessionsRepo.updateSession(
            args.sessionId,
            this.stateMachine.buildRejectedUpdate({
              latestSpecDesc: {
                ...artifacts.sessionSpecDesc,
                publicationGate,
              },
              latestDraftCode: artifacts.compiledScript,
              rejectReason: reason,
              strategyInstanceId: strategyInstanceId ?? null,
            }),
          )
          return
        }
        throw error
      }

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
    semanticState?: SemanticState
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

  private readRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }

    return value as Record<string, unknown>
  }

  private normalizePublicationGate(value: unknown): Record<string, unknown> | null {
    const record = this.readRecord(value)
    if (!record) {
      return null
    }

    if (typeof record.passed === 'boolean' && Array.isArray(record.blockingMismatches)) {
      return {
        passed: record.passed,
        blockingMismatches: record.blockingMismatches,
      }
    }

    if (typeof record.status !== 'string' || !Array.isArray(record.checks)) {
      return null
    }

    const blockingMismatches = record.checks
      .map(item => this.readRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null)
      .filter(item => item.blocking === true && item.status === 'failed')
      .map(item => ({
        field: this.normalizePublicationGateField(item.key),
        expected: this.stringifyPublicationGateValue(item.expected),
        actual: this.stringifyPublicationGateValue(item.actual),
        reason:
          typeof item.message === 'string' && item.message.trim()
            ? item.message.trim()
            : 'publication gate blocked',
      }))

    return {
      passed: blockingMismatches.length === 0,
      blockingMismatches,
    }
  }

  private normalizePublicationGateField(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      return 'unknown'
    }

    const normalized = value.trim()
    return normalized.startsWith('market.')
      ? normalized.slice('market.'.length)
      : normalized
  }

  private stringifyPublicationGateValue(value: unknown): string {
    if (typeof value === 'string') {
      return value
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }

    const record = this.readRecord(value)
    if (record) {
      if (typeof record.script === 'string' && record.script.trim()) {
        return record.script.trim()
      }
      if (typeof record.ir === 'string' && record.ir.trim()) {
        return record.ir.trim()
      }
    }

    if (value === null || value === undefined) {
      return ''
    }

    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
}
