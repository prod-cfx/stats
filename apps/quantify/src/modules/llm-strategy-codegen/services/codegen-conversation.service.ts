import type { CodegenGuidePromptConfigSnapshot, ConstraintPackSnapshot } from '../constants/constraint-pack'
import type { CodegenGuideConfigDto } from '../dto/codegen-guide-config.dto'
import type { CodegenSessionResponseDto } from '../dto/codegen-session.response.dto'
import type { ContinueCodegenSessionDto } from '../dto/continue-codegen-session.dto'
import type { LlmCodegenEngineTestResponseDto } from '../dto/llm-codegen-engine-test.response.dto'
import type { StartCodegenSessionDto } from '../dto/start-codegen-session.dto'
import type { TestLlmCodegenEngineDto } from '../dto/test-llm-codegen-engine.dto'
import type { StrategyClarificationItem, StrategyClarificationState } from '../types/strategy-clarification'
import type { StrategyConsistencyReport } from '../types/strategy-consistency-report'
import type { ChatMessage } from '@/modules/ai/providers/llm-provider-adapter.interface'
import type { Prisma } from '@/prisma/prisma.types'

import { ErrorCode } from '@ai/shared'
import { getHelperDocs } from '@ai/shared/script-engine/helpers'
import { HttpStatus, Injectable } from '@nestjs/common'
import { defaultEnvAccessor } from '@/common/env/env.accessor'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { AiService } from '@/modules/ai/ai.service'
import { createDefaultConstraintPack } from '../constants/constraint-pack'
import { buildConversationPlannerSystemPrompt } from '../prompts/conversation-planner-system.prompt'
import { buildStrategyCodegenSystemPrompt } from '../prompts/strategy-codegen-system.prompt'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CodegenSessionsRepository } from '../repositories/codegen-sessions.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { PublishedStrategySnapshotsRepository } from '../repositories/published-strategy-snapshots.repository'
import {
  STRATEGY_CLARIFICATION_FIELDS,
  STRATEGY_CLARIFICATION_ITEM_STATUSES,
  STRATEGY_CLARIFICATION_REASONS,
  STRATEGY_CLARIFICATION_STATUSES,
} from '../types/strategy-clarification'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CanonicalSpecBuilderService } from './canonical-spec-builder.service'
 
import { CanonicalSpecV2IrCompilerService } from './canonical-spec-v2-ir-compiler.service'
 
import { CanonicalStrategyAstCompilerService } from './canonical-strategy-ast-compiler.service'
 
import { CompiledPublicationGateService } from './compiled-publication-gate.service'
 
import { CompiledScriptEmitterService } from './compiled-script-emitter.service'
 
import { CompiledScriptExecutionEnvelopeService } from './compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from './compiled-script-parser.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { RecommendationIndexService } from './recommendation-index.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { RuntimeGuardrailService } from './runtime-guardrail.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { SpecDescBuilderService } from './spec-desc-builder.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { StaticGuardrailService } from './static-guardrail.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { StrategyClarificationQuestionService } from './strategy-clarification-question.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { StrategyClarificationRulesService } from './strategy-clarification-rules.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { StrategyConsistencyService } from './strategy-consistency.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { StrategySummaryBuilderService } from './strategy-summary-builder.service'

interface ChecklistPayload {
  symbols?: string[]
  timeframes?: string[]
  entryRules?: string[]
  exitRules?: string[]
  riskRules?: Record<string, unknown>
}

interface ConversationPlan {
  related: boolean
  logicReady: boolean
  assistantPrompt: string
  logic?: ChecklistPayload
}

interface GenerationOptions {
  providerCode?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

interface ScriptValidationResult {
  passed: boolean
  scriptCode: string
  reason?: string
  staticPassed: boolean
  runtimePassed: boolean
  outputPassed: boolean
}

type LlmCodegenSessionStatus
  = 'DRAFTING'
    | 'CHECKLIST_GATE'
    | 'GENERATING'
    | 'VALIDATING_STATIC'
    | 'VALIDATING_RUNTIME'
    | 'VALIDATING_OUTPUT'
    | 'VALIDATING_CONSISTENCY'
    | 'PUBLISHED'
    | 'CONSISTENCY_FAILED'
    | 'REJECTED'

type GuidePromptConfig = CodegenGuidePromptConfigSnapshot
type RecommendationStyle = 'ma' | 'drop-rise'

const ALLOWED_HELPER_CATEGORIES = ['finance', 'array', 'ta', 'signal'] as const
const MAX_HELPER_SIGNATURE_LINES = 24
const MAX_PLANNER_HISTORY_LINES = 12
const DEFAULT_PROVIDER_CODE = 'strategy-codegen'
const DEFAULT_MODEL = 'gpt-4'
const MAX_CODEGEN_AUTO_REPAIR_RETRIES = 2
const DEFAULT_CODEGEN_STRICT_ENABLED = true
const DEFAULT_CODEGEN_STRICT_FALLBACK = true
const DEFAULT_CODEGEN_STRICT_UNSUPPORTED_TTL_MS = 10 * 60 * 1000

const CODEGEN_STRICT_RESPONSE_SCHEMA_V1: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['code'],
  properties: {
    code: {
      type: 'string',
      minLength: 1,
    },
  },
}

const PROCESSING_SESSION_STATUSES: readonly LlmCodegenSessionStatus[] = [
  'GENERATING',
  'VALIDATING_STATIC',
  'VALIDATING_RUNTIME',
  'VALIDATING_OUTPUT',
  'VALIDATING_CONSISTENCY',
]

function normalizePublishedSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/:(SPOT|PERP)$/u, '')
}

function inferPublishedMarketType(args: {
  symbol: string
  checklist: ChecklistPayload
  message: string
}): 'spot' | 'perp' {
  if (args.symbol.endsWith(':PERP')) return 'perp'
  if (args.symbol.endsWith(':SPOT')) return 'spot'
  const riskRules = args.checklist.riskRules ?? {}
  const marketType = typeof riskRules.marketType === 'string' ? riskRules.marketType.trim().toLowerCase() : ''
  if (marketType === 'perp' || marketType === 'spot') return marketType
  return /永续|perp|swap|合约/i.test(args.message) ? 'perp' : 'spot'
}

@Injectable()
export class CodegenConversationService {
  private readonly strictUnsupportedTargets = new Map<string, number>()

  constructor(
    private readonly aiService: AiService,
    private readonly sessionsRepo: CodegenSessionsRepository,
    private readonly publishedSnapshotsRepo: PublishedStrategySnapshotsRepository,
    private readonly staticGuardrail: StaticGuardrailService,
    private readonly runtimeGuardrail: RuntimeGuardrailService,
    private readonly specDescBuilder: SpecDescBuilderService,
    private readonly canonicalSpecBuilder: CanonicalSpecBuilderService,
    private readonly strategyConsistencyService: StrategyConsistencyService,
    private readonly recommendationIndex: RecommendationIndexService,
    private readonly clarificationRules: StrategyClarificationRulesService,
    private readonly clarificationQuestion: StrategyClarificationQuestionService,
    private readonly strategySummaryBuilder: StrategySummaryBuilderService,
    private readonly canonicalSpecV2IrCompiler: CanonicalSpecV2IrCompilerService = new CanonicalSpecV2IrCompilerService(),
    private readonly canonicalStrategyAstCompiler: CanonicalStrategyAstCompilerService = new CanonicalStrategyAstCompilerService(),
    private readonly compiledScriptEmitter: CompiledScriptEmitterService = new CompiledScriptEmitterService(),
    private readonly compiledScriptExecutionEnvelope: CompiledScriptExecutionEnvelopeService = new CompiledScriptExecutionEnvelopeService(),
    private readonly compiledScriptParser: CompiledScriptParserService = new CompiledScriptParserService(),
    private readonly compiledPublicationGate: CompiledPublicationGateService = new CompiledPublicationGateService(
      publishedSnapshotsRepo,
    ),
  ) {}

  async startSession(
    dto: StartCodegenSessionDto,
    callerUserId?: string,
  ): Promise<CodegenSessionResponseDto> {
    const sessionUserId = this.resolveSessionUserId(callerUserId, dto.userId)
    if (!sessionUserId) {
      throw new DomainException('codegen.missing_caller_identity', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    const seedChecklist = this.normalizeChecklist({
      ...this.extractChecklist(dto),
      ...this.inferChecklistFromMessage(dto.initialMessage),
    })
    const plan = await this.planConversationByLlm(dto.initialMessage ?? '', seedChecklist, {
      providerCode: this.resolveProviderCode(undefined),
      model: undefined,
    })
    const checklist = this.mergeChecklistSnapshots(seedChecklist, plan.logic ?? {})
    const recommendationStyle = this.inferRecommendationStyleFromContext(
      dto.initialMessage,
      checklist,
      undefined,
    )
    const clarificationState = this.clarificationRules.detect(checklist)
    const clarificationPrompt = this.clarificationQuestion.build(clarificationState)
    const shouldGateChecklist = plan.logicReady && clarificationState.status === 'CLEAR'
    const status: LlmCodegenSessionStatus = shouldGateChecklist ? 'CHECKLIST_GATE' : 'DRAFTING'

    const guidePrompt = this.mergeGuidePromptConfig(undefined, dto.guideConfig)
    const initialSpecDesc = shouldGateChecklist ? this.specDescBuilder.build(checklist, '') : null
    const initialCanonicalDigest = this.readCanonicalDigest(initialSpecDesc)
    const assistantPrompt = clarificationState.status === 'NEEDS_CLARIFICATION' && clarificationPrompt
      ? clarificationPrompt
      : (shouldGateChecklist
          ? `${plan.assistantPrompt}\n逻辑图已更新。请确认逻辑图，确认后我再生成策略代码。`
          : plan.assistantPrompt)
    const initialHistory = this.appendConversationHistory([], dto.initialMessage, assistantPrompt)
    const session = await this.sessionsRepo.createSession({
      userId: sessionUserId,
      status,
      checklist: checklist as Prisma.InputJsonValue,
      clarificationState: clarificationState as unknown as Prisma.InputJsonValue,
      constraintPack: {
        ...createDefaultConstraintPack(guidePrompt),
        recommendationStyle,
        conversationHistory: initialHistory,
      } as unknown as Prisma.InputJsonValue,
      latestDraftCode: null,
      latestSpecDesc: initialSpecDesc as Prisma.InputJsonValue,
      rejectReason: null,
      strategyInstanceId: null,
    })

    return this.finalizeSessionResponse({
      id: session.id,
      status,
      missingFields: [],
      specDesc: initialSpecDesc,
      canonicalDigest: initialCanonicalDigest,
      assistantPrompt,
      clarificationState,
    })
  }

  async getSession(sessionId: string, userId: string): Promise<CodegenSessionResponseDto> {
    const session = await this.sessionsRepo.findById(sessionId)
    if (!session || session.userId !== userId) {
      throw new DomainException('codegen.session_not_found', {
        code: ErrorCode.LLM_CODEGEN_SESSION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { sessionId },
      })
    }

    return this.toSessionSnapshotResponse(session)
  }

  async continueSession(
    sessionId: string,
    dto: ContinueCodegenSessionDto,
    callerUserId?: string,
  ): Promise<CodegenSessionResponseDto> {
    const sessionUserId = this.resolveSessionUserId(callerUserId, dto.userId)
    if (!sessionUserId) {
      throw new DomainException('codegen.missing_caller_identity', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    const session = await this.sessionsRepo.findById(sessionId)
    if (!session || session.userId !== sessionUserId) {
      throw new DomainException('codegen.session_not_found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { sessionId },
      })
    }
    if (CodegenConversationService.isTerminalStatus(session.status)) {
      throw new DomainException('codegen.session_terminal_status', {
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { sessionId, status: session.status },
      })
    }
    if (dto.confirmGenerate === true) {
      return this.continueConfirmedSession(session, dto, sessionUserId)
    }
    if (PROCESSING_SESSION_STATUSES.includes(session.status)) {
      return this.toSessionSnapshotResponse(session)
    }

    const baseClarificationState = this.readClarificationState(session.clarificationState)
    const baseChecklist = this.applyClarificationAnswers(
      this.readChecklist(session.checklist),
      baseClarificationState,
      dto.clarificationAnswers,
    )
    const messageChecklist = this.normalizeChecklist({
      ...this.inferChecklistFromMessage(dto.message),
      ...this.extractChecklist(dto),
    })
    const preMergedChecklist = this.mergeChecklistSnapshots(baseChecklist, messageChecklist)
    const constraintPack = this.readConstraintPack(session.constraintPack)
    const guidePrompt = this.mergeGuidePromptConfig(constraintPack.guidePrompt, dto.guideConfig)
    const plan = await this.planConversationByLlm(dto.message, preMergedChecklist, {
      providerCode: this.resolveProviderCode(dto.providerCode),
      model: dto.model,
    }, constraintPack.conversationHistory ?? [])
    if (!plan.related) {
      return this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: plan.assistantPrompt || '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      })
    }
    const mergedChecklist = this.mergeChecklistSnapshots(preMergedChecklist, plan.logic ?? {})
    const clarificationState = this.clarificationRules.detect(mergedChecklist)
    const clarificationPrompt = this.clarificationQuestion.build(clarificationState)
    const recommendationStyle = this.inferRecommendationStyleFromContext(
      dto.message,
      mergedChecklist,
      constraintPack.recommendationStyle,
    )
    const nextConstraintPack = this.withGuidePrompt(constraintPack, guidePrompt, recommendationStyle)
    if (clarificationState.status === 'NEEDS_CLARIFICATION') {
      const assistantPrompt = clarificationPrompt || plan.assistantPrompt || '请先澄清这条规则，我再继续完善逻辑图。'
      const historyAfterClarification = this.appendConversationHistory(
        constraintPack.conversationHistory ?? [],
        dto.message,
        assistantPrompt,
      )
      await this.sessionsRepo.updateSession(session.id, {
        status: 'DRAFTING',
        checklist: mergedChecklist as Prisma.InputJsonValue,
        clarificationState: clarificationState as unknown as Prisma.InputJsonValue,
        constraintPack: {
          ...nextConstraintPack,
          conversationHistory: historyAfterClarification,
        } as unknown as Prisma.InputJsonValue,
      })

      return this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt,
        clarificationState,
      })
    }
    const historyAfterPlanner = this.appendConversationHistory(
      constraintPack.conversationHistory ?? [],
      dto.message,
      plan.assistantPrompt,
    )
    const canonicalSpec = this.canonicalSpecBuilder.build(mergedChecklist)
    const specDesc = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '')
    const canonicalDigest = this.readCanonicalDigest(specDesc)

    if (!plan.logicReady) {
      await this.sessionsRepo.updateSession(session.id, {
        status: 'DRAFTING',
        checklist: mergedChecklist as Prisma.InputJsonValue,
        clarificationState: clarificationState as unknown as Prisma.InputJsonValue,
        constraintPack: {
          ...nextConstraintPack,
          conversationHistory: historyAfterPlanner,
        } as unknown as Prisma.InputJsonValue,
      })

      return this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: plan.assistantPrompt,
        clarificationState,
      })
    }

    await this.sessionsRepo.updateSession(session.id, {
      status: 'CHECKLIST_GATE',
      checklist: mergedChecklist as Prisma.InputJsonValue,
      clarificationState: clarificationState as unknown as Prisma.InputJsonValue,
      constraintPack: {
        ...nextConstraintPack,
        conversationHistory: historyAfterPlanner,
      } as unknown as Prisma.InputJsonValue,
      latestSpecDesc: specDesc as Prisma.InputJsonValue,
    })

    return this.finalizeSessionResponse({
      id: session.id,
      status: 'CHECKLIST_GATE',
      missingFields: [],
      specDesc,
      canonicalDigest,
      assistantPrompt: `${plan.assistantPrompt}\n逻辑图已更新。请确认逻辑图，确认后我再生成策略代码。`,
      clarificationState,
    })
  }

  private async continueConfirmedSession(
    session: {
      id: string
      userId: string
      status: LlmCodegenSessionStatus
      checklist: Prisma.JsonValue | null
      clarificationState?: Prisma.JsonValue | null
      constraintPack: Prisma.JsonValue | null
      strategyInstanceId?: string | null
    },
    dto: ContinueCodegenSessionDto,
    sessionUserId: string,
  ): Promise<CodegenSessionResponseDto> {
    const baseClarificationState = this.readClarificationState(session.clarificationState)
    const baseChecklist = this.applyClarificationAnswers(
      this.readChecklist(session.checklist),
      baseClarificationState,
      dto.clarificationAnswers,
    )
    const messageChecklist = this.normalizeChecklist(this.extractChecklist(dto))
    const mergedChecklist = this.mergeChecklistSnapshots(baseChecklist, messageChecklist)
    const clarificationState = this.clarificationRules.detect(mergedChecklist)
    const clarificationPrompt = this.clarificationQuestion.build(clarificationState)
    const constraintPack = this.readConstraintPack(session.constraintPack)
    const historyAfterConfirm = this.appendConversationHistory(
      constraintPack.conversationHistory ?? [],
      dto.message,
    )

    if (clarificationState.status === 'NEEDS_CLARIFICATION') {
      const assistantPrompt = clarificationPrompt || '请先澄清这条规则，我再继续完善逻辑图。'
      await this.sessionsRepo.updateSession(session.id, {
        status: 'DRAFTING',
        checklist: mergedChecklist as Prisma.InputJsonValue,
        clarificationState: clarificationState as unknown as Prisma.InputJsonValue,
        constraintPack: {
          ...constraintPack,
          conversationHistory: historyAfterConfirm,
        } as unknown as Prisma.InputJsonValue,
      })

      return this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt,
        clarificationState,
      })
    }

    const canonicalSpec = this.canonicalSpecBuilder.build(mergedChecklist)
    const specDesc = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '')
    const canonicalDigest = this.readCanonicalDigest(specDesc)
    const confirmedCanonicalDigest = dto.confirmedCanonicalDigest?.trim() ?? ''
    if (!canonicalDigest || confirmedCanonicalDigest !== canonicalDigest) {
      throw new DomainException('codegen.confirmation_digest_mismatch', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: {
          expectedCanonicalDigest: canonicalDigest,
          confirmedCanonicalDigest: confirmedCanonicalDigest || null,
        },
      })
    }

    const missingFields = this.resolveChecklistMissingFields(mergedChecklist)
    if (missingFields.length > 0) {
      await this.sessionsRepo.updateSession(session.id, {
        status: 'DRAFTING',
        checklist: mergedChecklist as Prisma.InputJsonValue,
        clarificationState: clarificationState as unknown as Prisma.InputJsonValue,
        constraintPack: {
          ...constraintPack,
          conversationHistory: historyAfterConfirm,
        } as unknown as Prisma.InputJsonValue,
        latestSpecDesc: specDesc as Prisma.InputJsonValue,
      })

      return this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields,
        assistantPrompt: '请先补全入场和出场规则，再确认生成代码。',
        clarificationState,
      })
    }

    const markGeneratingInput = {
      status: 'GENERATING' as const,
      checklist: mergedChecklist as Prisma.InputJsonValue,
      clarificationState: clarificationState as unknown as Prisma.InputJsonValue,
      constraintPack: {
        ...constraintPack,
        conversationHistory: historyAfterConfirm,
      } as unknown as Prisma.InputJsonValue,
      latestSpecDesc: specDesc as Prisma.InputJsonValue,
      rejectReason: null,
    }

    const markedGenerating = PROCESSING_SESSION_STATUSES.includes(session.status)
      ? await this.sessionsRepo.tryRequeueFromProcessing(session.id, markGeneratingInput)
      : await this.sessionsRepo.tryMarkGenerating(session.id, markGeneratingInput)

    if (!markedGenerating) {
      const latest = await this.sessionsRepo.findById(session.id)
      if (!latest || latest.userId !== sessionUserId) {
        throw new DomainException('codegen.session_not_found', {
          code: ErrorCode.NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
          args: { sessionId: session.id },
        })
      }
      return this.toSessionSnapshotResponse(latest)
    }

    void this.runConfirmedPublicationPipeline({
      sessionId: session.id,
      userId: sessionUserId,
      checklist: mergedChecklist,
      message: dto.message,
      model: dto.model,
      existingStrategyInstanceId: session.strategyInstanceId ?? null,
    })

    return this.finalizeSessionResponse({
      id: session.id,
      status: 'GENERATING',
      missingFields: [],
      clarificationState,
    })
  }

  private async runConfirmedPublicationPipeline(args: {
    sessionId: string
    userId: string
    checklist: ChecklistPayload
    message: string
    model?: string
    existingStrategyInstanceId?: string | null
  }): Promise<void> {
    const {
      sessionId,
      userId,
      checklist,
      message,
      model,
      existingStrategyInstanceId,
    } = args
    try {
      const canonicalSpec = this.canonicalSpecBuilder.build(checklist)
      const semanticView = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '')
      const userIntentSummary = this.strategySummaryBuilder.buildUserIntentSummary({
        checklist,
        message,
      })
      const strategySummary = this.strategySummaryBuilder.buildStrategySummary(canonicalSpec)
      const lockedParams = this.buildLockedParams(checklist)
      let strategyInstanceId = existingStrategyInstanceId
        ?? await this.sessionsRepo.findSessionStrategyInstanceId(sessionId)
      const publishInput = this.buildPublishedStrategyInput({
        sessionId,
        userId,
        checklist,
        message,
        model,
        scriptCode: '',
        specDesc: semanticView,
        lockedParams,
      })

      const compiled = this.canonicalSpecV2IrCompiler.compile({
        canonicalSpec,
        fallback: this.buildCompiledIrFallback({
          checklist,
          lockedParams,
          publishParams: publishInput.params,
        }),
      })
      const executionEnvelope = this.compiledScriptExecutionEnvelope.build(canonicalSpec)
      const ast = this.canonicalStrategyAstCompiler.compile(compiled.ir)
      let compiledScript = this.compiledScriptEmitter.emit({
        ast,
        executionEnvelope,
      })
      const compiledValidation = await this.validateCompiledScript(compiledScript)
      if (!compiledValidation.passed) {
        await this.sessionsRepo.updateSession(sessionId, {
          status: 'REJECTED',
          latestDraftCode: compiledValidation.scriptCode,
          rejectReason: compiledValidation.reason,
          strategyInstanceId: strategyInstanceId ?? null,
        })
        return
      }
      compiledScript = compiledValidation.scriptCode
      const semanticConsistency = this.strategyConsistencyService.evaluate({
        canonicalSpec,
        scriptCode: compiledScript,
        userIntentSummary,
        strategySummary,
      })
      const scriptSummary = this.strategySummaryBuilder.buildScriptSummary({
        scriptProfile: semanticConsistency.scriptProfile,
      })
      const sessionSpecDesc = {
        ...semanticView,
        canonicalSpec,
        userIntentSummary,
        strategySummary,
        scriptSummary,
        lockedParams,
        consistencyReport: semanticConsistency,
      } satisfies Record<string, unknown>

      await this.sessionsRepo.updateSession(sessionId, {
        status: 'VALIDATING_CONSISTENCY',
        latestDraftCode: compiledScript,
      })

      const version = await this.sessionsRepo.createVersion({
        session: { connect: { id: sessionId } },
        scriptCode: compiledScript,
        specDesc: sessionSpecDesc as unknown as Prisma.InputJsonValue,
        staticPassed: compiledValidation.staticPassed,
        runtimePassed: compiledValidation.runtimePassed,
        outputPassed: compiledValidation.outputPassed,
      })

      await this.recommendationIndex.onSpecDescPersisted({
        versionId: version.id,
        specDesc: semanticView,
      })

      if (semanticConsistency.status !== 'PASSED') {
        await this.sessionsRepo.updateSession(sessionId, {
          status: 'CONSISTENCY_FAILED',
          latestSpecDesc: sessionSpecDesc as unknown as Prisma.InputJsonValue,
          latestDraftCode: compiledScript,
          rejectReason: this.buildConsistencyRejectReason(semanticConsistency),
          strategyInstanceId: existingStrategyInstanceId ?? null,
        })
        return
      }

      let strategyTemplateId: string | null = null
      publishInput.scriptCode = compiledScript
      publishInput.specDesc = sessionSpecDesc
      if (!strategyInstanceId) {
        try {
          const bound = await this.sessionsRepo.ensureDraftStrategyInstanceBoundForPublishedSession(publishInput)
          strategyTemplateId = bound.strategyTemplateId || null
          strategyInstanceId = bound.strategyInstanceId
        } catch (publishError) {
          const publishReason = publishError instanceof Error ? publishError.message : String(publishError)
          await this.sessionsRepo.updateSession(sessionId, {
            status: 'REJECTED',
            latestSpecDesc: sessionSpecDesc as unknown as Prisma.InputJsonValue,
            latestDraftCode: compiledScript,
            rejectReason: publishReason,
            strategyInstanceId: null,
          })
          return
        }
      }

      const snapshot = await this.compiledPublicationGate.publish({
        sessionId,
        strategyTemplateId,
        strategyInstanceId: strategyInstanceId ?? null,
        canonicalSnapshot: canonicalSpec as unknown as Record<string, unknown>,
        semanticView,
        graphSnapshot: compiled.graphSnapshot,
        ir: compiled.ir,
        ast,
        executionEnvelope,
        script: compiledScript,
        semanticConsistencyReport: semanticConsistency as unknown as Record<string, unknown>,
        userIntentSummary: userIntentSummary as unknown as Record<string, unknown>,
        strategySummary: strategySummary as unknown as Record<string, unknown>,
        scriptSummary: scriptSummary as unknown as Record<string, unknown>,
        lockedParams,
      })
      if (this.readPublishedConsistencyStatus(snapshot.consistencyReport) !== 'PASSED') {
        await this.sessionsRepo.updateSession(sessionId, {
          status: 'CONSISTENCY_FAILED',
          latestSpecDesc: {
            ...sessionSpecDesc,
            consistencyReport: snapshot.consistencyReport,
          } as unknown as Prisma.InputJsonValue,
          latestDraftCode: compiledScript,
          rejectReason: this.buildCompiledPublishRejectReason(snapshot.consistencyReport),
          strategyInstanceId: strategyInstanceId ?? null,
        })
        return
      }

      await this.sessionsRepo.updateSession(sessionId, {
        status: 'PUBLISHED',
        latestSpecDesc: {
          ...sessionSpecDesc,
          consistencyReport: snapshot.consistencyReport,
          publishedSnapshotId: snapshot.snapshotId,
        } as unknown as Prisma.InputJsonValue,
        latestDraftCode: compiledScript,
        rejectReason: null,
        strategyInstanceId: strategyInstanceId ?? null,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      await this.sessionsRepo.updateSession(sessionId, {
        status: 'REJECTED',
        rejectReason: reason,
      })
    }
  }

  private readChecklist(payload: Prisma.JsonValue | null): ChecklistPayload {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {}
    }

    return this.normalizeChecklist(payload as Record<string, unknown>)
  }

  private readCanonicalDigest(specDesc: Record<string, unknown> | null): string | null {
    if (!specDesc || typeof specDesc !== 'object' || Array.isArray(specDesc)) {
      return null
    }

    const directCanonicalDigest = specDesc.canonicalDigest
    if (typeof directCanonicalDigest === 'string' && directCanonicalDigest.trim().length > 0) {
      return directCanonicalDigest.trim()
    }

    const confirmation = specDesc.confirmation
    if (!confirmation || typeof confirmation !== 'object' || Array.isArray(confirmation)) {
      return null
    }
    const digest = (confirmation as { digest?: unknown }).digest
    if (typeof digest !== 'string' || digest.trim().length === 0) {
      return null
    }
    return digest.trim()
  }

  private async toSessionSnapshotResponse(session: {
    id: string
    status: LlmCodegenSessionStatus
    latestDraftCode: Prisma.JsonValue | null
    latestSpecDesc: Prisma.JsonValue | null
    rejectReason: string | null
    strategyInstanceId?: string | null
    clarificationState?: Prisma.JsonValue | null
  }): Promise<CodegenSessionResponseDto> {
    const latestSnapshot = session.status === 'PUBLISHED'
      ? await this.publishedSnapshotsRepo.findLatestBySessionId(session.id)
      : null
    const sessionSpecDesc = session.latestSpecDesc && typeof session.latestSpecDesc === 'object' && !Array.isArray(session.latestSpecDesc)
      ? (session.latestSpecDesc as Record<string, unknown>)
      : null
    const sessionConsistencyReport = sessionSpecDesc?.consistencyReport
    const sessionPublishedSnapshotId = typeof sessionSpecDesc?.publishedSnapshotId === 'string'
      ? sessionSpecDesc.publishedSnapshotId
      : null

    return this.finalizeSessionResponse({
      id: session.id,
      status: session.status,
      missingFields: [],
      scriptCode: typeof session.latestDraftCode === 'string' ? session.latestDraftCode : null,
      publishedSnapshotId: latestSnapshot?.id ?? sessionPublishedSnapshotId ?? null,
      consistencyReport: latestSnapshot?.consistencyReport && typeof latestSnapshot.consistencyReport === 'object' && !Array.isArray(latestSnapshot.consistencyReport)
        ? latestSnapshot.consistencyReport as Record<string, unknown>
        : (sessionConsistencyReport && typeof sessionConsistencyReport === 'object' && !Array.isArray(sessionConsistencyReport)
            ? sessionConsistencyReport as Record<string, unknown>
            : null),
      specDesc: sessionSpecDesc,
      canonicalDigest: this.readCanonicalDigest(sessionSpecDesc),
      strategyInstanceId: session.strategyInstanceId ?? null,
      clarificationState: this.readClarificationState(session.clarificationState),
      rejectReason: session.rejectReason,
    })
  }

  private finalizeSessionResponse(
    response: Omit<CodegenSessionResponseDto, 'clarificationGate'> & {
      clarificationGate?: CodegenSessionResponseDto['clarificationGate']
    },
  ): CodegenSessionResponseDto {
    const clarificationGate = response.clarificationGate ?? this.buildClarificationGate(response.clarificationState)

    if (!clarificationGate.blocked) {
      return {
        ...response,
        clarificationGate,
      }
    }

    return {
      ...response,
      clarificationGate,
      specDesc: null,
      canonicalDigest: null,
      semanticGraph: null,
    }
  }

  private buildClarificationGate(
    clarificationState?: StrategyClarificationState | null,
  ): CodegenSessionResponseDto['clarificationGate'] {
    const pendingItems = clarificationState?.status === 'NEEDS_CLARIFICATION'
      ? clarificationState.items.filter(item => item.blocking && item.status === 'pending')
      : []

    return {
      blocked: pendingItems.length > 0,
      pendingItems,
    }
  }

  private applyClarificationAnswers(
    checklist: ChecklistPayload,
    clarificationState: StrategyClarificationState | null,
    answers?: Record<string, string>,
  ): ChecklistPayload {
    if (!answers || Object.keys(answers).length === 0) {
      return checklist
    }

    let nextChecklist = this.normalizeChecklist({
      ...checklist,
      riskRules: checklist.riskRules ? { ...checklist.riskRules } : undefined,
    })

    for (const item of clarificationState?.items ?? []) {
      const rawAnswer = answers[item.key]
      if (typeof rawAnswer !== 'string' || !rawAnswer.trim()) {
        continue
      }

      nextChecklist = this.applyClarificationAnswer(nextChecklist, item, rawAnswer.trim())
    }

    return this.normalizeChecklist(nextChecklist)
  }

  private applyClarificationAnswer(
    checklist: ChecklistPayload,
    item: StrategyClarificationItem,
    answer: string,
  ): ChecklistPayload {
    if (item.key === 'entry.side') {
      return this.applyEntrySideClarification(checklist, answer)
    }

    if (item.key === 'market.symbol' || item.field === 'symbol') {
      const symbol = normalizePublishedSymbol(answer)
      return this.normalizeChecklist({
        ...checklist,
        symbols: symbol ? [symbol] : checklist.symbols,
      })
    }

    if (item.key === 'market.timeframe' || item.field === 'timeframe') {
      const timeframe = answer.trim()
      return this.normalizeChecklist({
        ...checklist,
        timeframes: timeframe ? [timeframe] : checklist.timeframes,
      })
    }

    if (item.key === 'market.exchange' || item.field === 'exchange') {
      const exchange = this.normalizeExchangeClarificationAnswer(answer)
      if (!exchange) return checklist
      return this.normalizeChecklist({
        ...checklist,
        riskRules: {
          ...(checklist.riskRules ?? {}),
          exchange,
        },
      })
    }

    if (item.key === 'market.marketType' || item.field === 'marketType') {
      const marketType = this.normalizeMarketTypeClarificationAnswer(answer)
      if (!marketType) return checklist
      return this.normalizeChecklist({
        ...checklist,
        riskRules: {
          ...(checklist.riskRules ?? {}),
          marketType,
        },
      })
    }

    if (item.key === 'riskRules.earlyStop.action' || item.field === 'riskRules.earlyStop.action') {
      const action = this.normalizeEarlyStopClarificationAnswer(answer)
      if (!action) return checklist
      return this.normalizeChecklist({
        ...checklist,
        riskRules: {
          ...(checklist.riskRules ?? {}),
          earlyStop: action === 'reduce'
            ? '价格连续3根K线在轨外时提前减仓'
            : '价格连续3根K线在轨外时提前全平',
        },
      })
    }

    return checklist
  }

  private applyEntrySideClarification(checklist: ChecklistPayload, answer: string): ChecklistPayload {
    const direction = this.normalizeDirectionClarificationAnswer(answer)
    if (!direction || !checklist.entryRules || checklist.entryRules.length === 0) {
      return checklist
    }

    const actionText = direction === 'short' ? '做空' : '做多'
    const entryRules = checklist.entryRules.map((rule) => {
      const normalized = rule.trim()
      if (!normalized) return rule
      if (/做多|多单|开多|long|买入/i.test(normalized) || /做空|空单|开空|short|卖出/i.test(normalized)) {
        return normalized
      }
      if (/上轨|upper/i.test(normalized)) {
        return `K线收盘后确认突破布林带上轨时${actionText}`
      }
      if (/下轨|lower/i.test(normalized)) {
        return `K线收盘后确认突破布林带下轨时${actionText}`
      }
      return normalized
    })

    return this.normalizeChecklist({
      ...checklist,
      entryRules,
    })
  }

  private normalizeDirectionClarificationAnswer(answer: string): 'long' | 'short' | null {
    const hasLong = /做多|多单|开多|long/i.test(answer)
    const hasShort = /做空|空单|开空|short/i.test(answer)
    if (hasLong === hasShort) {
      return null
    }
    return hasLong ? 'long' : 'short'
  }

  private normalizeExchangeClarificationAnswer(
    answer: string,
  ): 'binance' | 'okx' | 'hyperliquid' | null {
    const normalized = answer.trim().toLowerCase()
    if (normalized === 'binance' || normalized === 'okx' || normalized === 'hyperliquid') {
      return normalized
    }
    return null
  }

  private normalizeMarketTypeClarificationAnswer(answer: string): 'spot' | 'perp' | null {
    if (/现货|spot/i.test(answer)) return 'spot'
    if (/永续|合约|perp|swap/i.test(answer)) return 'perp'
    return null
  }

  private normalizeEarlyStopClarificationAnswer(answer: string): 'reduce' | 'close' | null {
    const hasReduce = /减仓|reduce/i.test(answer)
    const hasClose = /全平|平仓|止损|close|exit/i.test(answer)
    if (hasReduce === hasClose) {
      return null
    }
    return hasReduce ? 'reduce' : 'close'
  }

  private readClarificationState(payload: Prisma.JsonValue | null | undefined): StrategyClarificationState | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
    const rawStatus = (payload as { status?: unknown }).status
    const rawItems = (payload as { items?: unknown }).items
    if (!STRATEGY_CLARIFICATION_STATUSES.includes(rawStatus as never) || !Array.isArray(rawItems)) return null

    const normalizedItems: StrategyClarificationItem[] = []
    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) return null
      const key = (rawItem as { key?: unknown }).key
      const reason = (rawItem as { reason?: unknown }).reason
      const field = (rawItem as { field?: unknown }).field
      const blocking = (rawItem as { blocking?: unknown }).blocking
      const question = (rawItem as { question?: unknown }).question
      const status = (rawItem as { status?: unknown }).status
      const allowedAnswers = (rawItem as { allowedAnswers?: unknown }).allowedAnswers
      const ruleId = (rawItem as { ruleId?: unknown }).ruleId
      const answer = (rawItem as { answer?: unknown }).answer

      if (typeof key !== 'string' || !key.trim()) return null
      if (!STRATEGY_CLARIFICATION_REASONS.includes(reason as never)) return null
      if (typeof question !== 'string' || !question.trim()) return null
      if (!STRATEGY_CLARIFICATION_ITEM_STATUSES.includes(status as never)) return null
      if (
        allowedAnswers !== undefined
        && (!Array.isArray(allowedAnswers) || allowedAnswers.some(item => typeof item !== 'string' || !item.trim()))
      ) {
        return null
      }
      if (ruleId !== undefined && typeof ruleId !== 'string') return null
      if (answer !== undefined && typeof answer !== 'string') return null
      const typedReason = reason as StrategyClarificationItem['reason']
      const typedField = STRATEGY_CLARIFICATION_FIELDS.includes(field as never)
        ? field as StrategyClarificationItem['field']
        : this.inferClarificationField({
          key,
          reason: typedReason,
          question,
        })
      if (!typedField) return null
      const normalizedBlocking = blocking === undefined ? true : blocking
      if (normalizedBlocking !== true) return null
      const typedStatus = status as StrategyClarificationItem['status']
      const typedAllowedAnswers = (Array.isArray(allowedAnswers)
        ? allowedAnswers.map(item => item.trim()).filter(Boolean)
        : this.inferClarificationAllowedAnswers({
          key,
          reason: typedReason,
        })) as string[] | undefined

      normalizedItems.push({
        key,
        reason: typedReason,
        field: typedField,
        blocking: true,
        question,
        status: typedStatus,
        ...(typedAllowedAnswers && typedAllowedAnswers.length > 0 ? { allowedAnswers: typedAllowedAnswers } : {}),
        ...(typeof ruleId === 'string' ? { ruleId } : {}),
        ...(typeof answer === 'string' ? { answer } : {}),
      })
    }

    return {
      status: rawStatus as StrategyClarificationState['status'],
      items: normalizedItems,
    }
  }

  private inferClarificationField(input: {
    key: string
    reason: StrategyClarificationItem['reason']
    question: string
  }): StrategyClarificationItem['field'] | null {
    if (input.reason === 'missing_exchange') return 'exchange'
    if (input.reason === 'missing_symbol') return 'symbol'
    if (input.reason === 'missing_timeframe') return 'timeframe'
    if (
      input.reason === 'missing_market_type'
      || input.reason === 'invalid_spot_short_combo'
      || input.reason === 'conflicting_market_scope'
    ) {
      return 'marketType'
    }
    if (
      input.reason === 'missing_position_mode'
      || input.reason === 'missing_action_uniqueness'
      || input.reason === 'missing_side_scope'
      || input.reason === 'direction_ambiguous'
    ) {
      return 'positionMode'
    }
    if (input.reason === 'ambiguous_risk_effect') {
      return 'riskRules.earlyStop.action'
    }

    const key = input.key.toLowerCase()
    const question = input.question.toLowerCase()

    if (key.includes('exchange') || /交易所/u.test(question)) return 'exchange'
    if (key.includes('symbol') || /标的|交易对/u.test(question)) return 'symbol'
    if (key.includes('timeframe') || /周期/u.test(question)) return 'timeframe'
    if (key.includes('markettype') || /现货|合约|市场/u.test(question)) return 'marketType'
    if (key.includes('earlystop') || key.includes('risk.effect') || /减仓|平仓|止损/u.test(question)) {
      return 'riskRules.earlyStop.action'
    }
    if (key.includes('entry.side') || key.includes('action_uniqueness') || /方向|做多|做空/u.test(question)) {
      return 'positionMode'
    }

    return null
  }

  private inferClarificationAllowedAnswers(input: {
    key: string
    reason: StrategyClarificationItem['reason']
  }): string[] | undefined {
    if (input.reason === 'ambiguous_risk_effect') {
      return ['reduce', 'close']
    }
    if (input.key.toLowerCase() === 'risk.effect') {
      return ['reduce', 'close']
    }
    return undefined
  }

  private buildPublishedStrategyInput(args: {
    sessionId: string
    userId: string
    checklist: ChecklistPayload
    message: string
    model?: string
    scriptCode: string
    specDesc: Record<string, unknown>
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
    const rawSymbol = args.checklist.symbols?.[0] ?? 'BTCUSDT'
    const marketType = inferPublishedMarketType({
      symbol: rawSymbol,
      checklist: args.checklist,
      message: args.message,
    })
    const symbol = normalizePublishedSymbol(rawSymbol)
    const timeframe = args.checklist.timeframes?.[0] ?? '5m'
    const name = `${symbol} ${timeframe} AI策略`
    return {
      userId: args.userId,
      sessionId: args.sessionId,
      name,
      description: 'LLM 对话发布策略',
      llmModel: args.model ?? DEFAULT_MODEL,
      scriptCode: args.scriptCode,
      specDesc: args.specDesc,
      params: {
        symbol,
        timeframe,
        marketType,
      },
      metadata: {
        source: 'llm-codegen-session',
        confirmMessage: args.message,
        lockedParams: args.lockedParams,
      },
    }
  }

  private buildCompiledIrFallback(args: {
    checklist: ChecklistPayload
    lockedParams: Record<string, unknown>
    publishParams: Record<string, unknown>
  }): {
    exchange: 'binance' | 'okx' | 'hyperliquid'
    symbol: string
    baseTimeframe: string
    positionPct: number
    executionTags?: string[]
  } {
    const exchange = args.lockedParams.exchange
    const symbol = args.publishParams.symbol
    const timeframe = args.publishParams.timeframe
    const positionPct = args.lockedParams.positionPct

    return {
      exchange: exchange === 'binance' || exchange === 'okx' || exchange === 'hyperliquid'
        ? exchange
        : 'binance',
      symbol: typeof symbol === 'string' && symbol.trim().length > 0
        ? symbol.trim()
        : normalizePublishedSymbol(args.checklist.symbols?.[0] ?? 'BTCUSDT'),
      baseTimeframe: typeof timeframe === 'string' && timeframe.trim().length > 0
        ? timeframe.trim()
        : (args.checklist.timeframes?.[0] ?? '5m'),
      positionPct: typeof positionPct === 'number' && Number.isFinite(positionPct)
        ? positionPct
        : 10,
    }
  }

  private buildLockedParams(checklist: ChecklistPayload): Record<string, unknown> {
    const riskRules = checklist.riskRules ?? {}
    const locked: Record<string, unknown> = {}

    const rawSymbol = checklist.symbols?.[0]
    if (typeof rawSymbol === 'string' && rawSymbol.trim()) {
      locked.symbol = normalizePublishedSymbol(rawSymbol)
    }

    const rawTimeframe = checklist.timeframes?.[0]
    if (typeof rawTimeframe === 'string' && rawTimeframe.trim()) {
      locked.timeframe = rawTimeframe.trim()
    }

    const marketType = typeof riskRules.marketType === 'string'
      ? riskRules.marketType.trim().toLowerCase()
      : ''
    if (marketType === 'spot' || marketType === 'perp') {
      locked.marketType = marketType
    }

    const exchange = typeof riskRules.exchange === 'string'
      ? riskRules.exchange.trim().toLowerCase()
      : ''
    if (exchange === 'binance' || exchange === 'okx' || exchange === 'hyperliquid') {
      locked.exchange = exchange
    }

    if (typeof riskRules.positionPct === 'number' && Number.isFinite(riskRules.positionPct)) {
      locked.positionPct = riskRules.positionPct
    }

    const stopLossPct = typeof riskRules.stopLossPct === 'number'
      ? riskRules.stopLossPct
      : (typeof riskRules.stopLoss === 'number' ? riskRules.stopLoss : null)
    if (typeof stopLossPct === 'number' && Number.isFinite(stopLossPct)) {
      locked.stopLossPct = stopLossPct
    }

    if (typeof riskRules.maxDrawdownPct === 'number' && Number.isFinite(riskRules.maxDrawdownPct)) {
      locked.maxDrawdownPct = riskRules.maxDrawdownPct
    }

    return locked
  }

  private buildConsistencyRejectReason(report: StrategyConsistencyReport): string {
    const failedChecks = report.checks
      .filter(item => item.level === 'critical' && item.status === 'failed')
      .slice(0, 4)
      .map(item => item.message)
    if (failedChecks.length === 0) {
      return '策略脚本与策略描述一致性校验失败'
    }
    return `策略脚本与策略描述不一致：${failedChecks.join('；')}`
  }

  private buildCompiledPublishRejectReason(report: Record<string, unknown>): string {
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

  private readPublishedConsistencyStatus(report: Record<string, unknown>): string | null {
    return typeof report.status === 'string' ? report.status : null
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }

    return value as Record<string, unknown>
  }

  async testEngine(dto: TestLlmCodegenEngineDto): Promise<LlmCodegenEngineTestResponseDto> {
    const checklist = this.extractChecklist(dto)
    const missing: string[] = []
    if (!Array.isArray(checklist.entryRules) || checklist.entryRules.length === 0) {
      missing.push('entryRules')
    }
    if (!Array.isArray(checklist.exitRules) || checklist.exitRules.length === 0) {
      missing.push('exitRules')
    }
    if (missing.length > 0) {
      throw new DomainException('codegen.missing_required_fields', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { missingFields: missing },
      })
    }

    const providerCode = this.resolveProviderCode(dto.providerCode)
    const scriptCode = await this.generateScript(checklist, dto.message, {
      providerCode,
      model: dto.model,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
    })

    const staticResult = this.staticGuardrail.validate(scriptCode)
    if (!staticResult.passed) {
      return {
        providerCode,
        model: dto.model ?? DEFAULT_MODEL,
        scriptCode,
        staticPassed: false,
        runtimePassed: false,
        outputPassed: false,
        rejectReason: staticResult.reason,
      }
    }

    const runtimeResult = await this.runtimeGuardrail.validate(scriptCode)
    return {
      providerCode,
      model: dto.model ?? DEFAULT_MODEL,
      scriptCode,
      staticPassed: true,
      runtimePassed: runtimeResult.runtimePassed,
      outputPassed: runtimeResult.outputPassed,
      rejectReason: runtimeResult.reason,
    }
  }

  private extractChecklist(
    input: StartCodegenSessionDto | ContinueCodegenSessionDto | TestLlmCodegenEngineDto,
  ): ChecklistPayload {
    return {
      symbols: input.symbols,
      timeframes: input.timeframes,
      entryRules: input.entryRules,
      exitRules: input.exitRules,
      riskRules: input.riskRules,
    }
  }

  private resolveChecklistMissingFields(checklist: ChecklistPayload): string[] {
    const missing: string[] = []
    if (!Array.isArray(checklist.entryRules) || checklist.entryRules.length === 0) {
      missing.push('entryRules')
    }
    if (!Array.isArray(checklist.exitRules) || checklist.exitRules.length === 0) {
      missing.push('exitRules')
    }
    return missing
  }

  private inferChecklistFromMessage(message?: string): ChecklistPayload {
    if (!message || !message.trim()) {
      return {}
    }
    const text = message.trim()
    const upper = text.toUpperCase()

    const symbolMatches = upper.match(/\b[A-Z]{2,12}(?:USDT|USDC|USD)\b/g) ?? []
    const symbols = Array.from(new Set(symbolMatches))
    if (symbols.length === 0) {
      if (/比特币|大饼|BTC/i.test(text)) {
        symbols.push('BTCUSDT')
      } else if (/以太|ETH/i.test(text)) {
        symbols.push('ETHUSDT')
      }
    }

    const timeframeMatches = Array.from(text.matchAll(/(\d{1,4})\s*(min|分钟|小时|[mhd天])/gi))
    const timeframes = Array.from(new Set(timeframeMatches.map(([, value, unit]) => {
      const normalizedUnit = unit.toLowerCase()
      if (normalizedUnit === 'm' || normalizedUnit === 'min' || normalizedUnit === '分钟') return `${value}m`
      if (normalizedUnit === 'h' || normalizedUnit === '小时') return `${value}h`
      return `${value}d`
    })))

    const entryRules: string[] = []
    const exitRules: string[] = []

    const normalizeTimeframe = (value: string, unit: string) => {
      const normalizedUnit = unit.toLowerCase()
      if (normalizedUnit === 'm' || normalizedUnit === 'min' || normalizedUnit === '分钟') return `${value}m`
      if (normalizedUnit === 'h' || normalizedUnit === '小时') return `${value}h`
      return `${value}d`
    }

    const buyDropPattern = /(\d{1,4})\s*([mhd天]|min|分钟|小时)[^，。；;\n]{0,30}?(?:跌|下跌|回撤)\s*(\d+(?:\.\d+)?)\s*%[^，。；;\n]{0,20}?(?:买入|开仓|入场)/i
    const sellRisePattern = /(\d{1,4})\s*([mhd天]|min|分钟|小时)[^，。；;\n]{0,30}?(?:涨|上涨|反弹)\s*(\d+(?:\.\d+)?)\s*%[^，。；;\n]{0,20}?(?:卖出|平仓|离场|出场)/i

    const buyDropMatch = text.match(buyDropPattern)
    if (buyDropMatch?.[1] && buyDropMatch[2] && buyDropMatch[3]) {
      const frame = normalizeTimeframe(buyDropMatch[1], buyDropMatch[2])
      entryRules.push(`${frame} 内下跌 ${buyDropMatch[3]}% 买入`)
    }

    const sellRiseMatch = text.match(sellRisePattern)
    if (sellRiseMatch?.[1] && sellRiseMatch[2] && sellRiseMatch[3]) {
      const frame = normalizeTimeframe(sellRiseMatch[1], sellRiseMatch[2])
      exitRules.push(`${frame} 内上涨 ${sellRiseMatch[3]}% 卖出`)
    }

    if (entryRules.length === 0) {
      const hasBollinger = /布林|bollinger/i.test(text)
      const hasUpperBand = /上轨|upper/i.test(text)
      const hasLowerBand = /下轨|lower/i.test(text)
      const upperBandDirection = this.detectDirectionInTriggerFragment(
        text,
        /(?:布林|bollinger).{0,12}(?:上轨|upper)|(?:上轨|upper).{0,12}(?:布林|bollinger)|(?:突破|站上|收盘).{0,8}(?:上轨|upper)/i,
      )
      const lowerBandDirection = this.detectDirectionInTriggerFragment(
        text,
        /(?:布林|bollinger).{0,12}(?:下轨|lower)|(?:下轨|lower).{0,12}(?:布林|bollinger)|(?:突破|跌破|收盘).{0,8}(?:下轨|lower)/i,
      )
      if (hasBollinger && hasUpperBand && upperBandDirection === 'short' && /突破|交易|开仓|入场|站上|收盘/.test(text)) {
        entryRules.push('K线收盘后确认突破布林带上轨时做空')
      } else if (hasBollinger && hasUpperBand && upperBandDirection === 'long' && /突破|交易|开仓|入场|站上|收盘/.test(text)) {
        entryRules.push('K线收盘后确认突破布林带上轨时做多')
      } else if (hasBollinger && hasUpperBand && /突破|交易|开仓|入场|站上|收盘/.test(text)) {
        entryRules.push('突破布林带上轨交易')
      } else if (hasBollinger && hasLowerBand && lowerBandDirection === 'long' && /突破|跌破|交易|开仓|入场|收盘/.test(text)) {
        entryRules.push('K线收盘后确认突破布林带下轨时做多')
      } else if (hasBollinger && hasLowerBand && lowerBandDirection === 'short' && /突破|跌破|交易|开仓|入场|收盘/.test(text)) {
        entryRules.push('K线收盘后确认突破布林带下轨时做空')
      } else if (hasBollinger && hasLowerBand && /突破|跌破|交易|开仓|入场|收盘/.test(text)) {
        entryRules.push('跌破布林带下轨交易')
      } else if (/金叉|上穿.{0,8}均线|均线.{0,8}上穿|\bma\b|moving average/i.test(text)) {
        entryRules.push('短均线上穿长均线（金叉）入场')
      } else if (/(?:突破|站上|收盘价?.{0,8}高于).{0,16}(?:阻力|前高|关键位)|阻力位/.test(text)) {
        entryRules.push('价格收盘确认突破关键阻力位入场')
      } else if (/买入|开仓|入场/.test(text)) {
        entryRules.push('满足入场条件后开仓')
      }
    }
    if (exitRules.length === 0) {
      if (/死叉|下穿.{0,8}均线|均线.{0,8}下穿|\bma\b|moving average/i.test(text)) {
        exitRules.push('短均线下穿长均线（死叉）出场')
      } else if (/跌破.{0,16}(?:支撑|前低|关键位)|支撑位/.test(text)) {
        exitRules.push('价格跌破关键支撑位出场')
      } else if (/止盈|止损|回撤/.test(text)) {
        exitRules.push('触发止盈/止损阈值出场')
      } else if (/平仓|离场|出场|卖出/.test(text)) {
        exitRules.push('满足出场条件后平仓')
      }
    }

    const riskRules: Record<string, unknown> = {}
    if (/\bokx\b/i.test(text)) {
      riskRules.exchange = 'okx'
    } else if (/hyperliquid/i.test(text)) {
      riskRules.exchange = 'hyperliquid'
    } else if (/binance/i.test(text)) {
      riskRules.exchange = 'binance'
    }

    if (/永续|perp|swap|合约/i.test(text)) {
      riskRules.marketType = 'perp'
    } else if (/现货|spot/i.test(text)) {
      riskRules.marketType = 'spot'
    }

    const positionMatch = text.match(/仓位\s*(\d+(?:\.\d+)?)\s*%/)
    if (positionMatch?.[1]) {
      riskRules.positionPct = Number(positionMatch[1])
    }
    const stopLossMatch = text.match(/止损[^%\n]{0,12}?(\d+(?:\.\d+)?)\s*%/)
      ?? text.match(/亏损[≥>=]?\s*(\d+(?:\.\d+)?)\s*%/)
    if (stopLossMatch?.[1]) {
      riskRules.stopLossPct = Number(stopLossMatch[1])
    }
    const drawdownMatch = text.match(/最大回撤\s*(\d+(?:\.\d+)?)\s*%/)
    if (drawdownMatch?.[1]) {
      riskRules.maxDrawdownPct = Number(drawdownMatch[1])
    }
    const earlyStopMatch = text.match(/((?:价格)?连续\s*3\s*根K线[^。；;\n]{0,40}?轨外[^。；;\n]{0,40}?(?:提前止损|减仓|全平|平仓))/i)
    if (earlyStopMatch?.[1]) {
      riskRules.earlyStop = earlyStopMatch[1].trim()
    }

    return {
      symbols: symbols.length > 0 ? symbols : undefined,
      timeframes: timeframes.length > 0 ? timeframes : undefined,
      entryRules: entryRules.length > 0 ? entryRules : undefined,
      exitRules: exitRules.length > 0 ? exitRules : undefined,
      riskRules: Object.keys(riskRules).length > 0 ? riskRules : undefined,
    }
  }

  private detectDirectionInTriggerFragment(
    text: string,
    triggerPattern: RegExp,
  ): 'long' | 'short' | null {
    const match = triggerPattern.exec(text)
    if (!match) return null

    const PRE_WINDOW = 6
    const POST_WINDOW = 10
    const CLAUSE_SPLITTER = /然后|并且|回到|中轨|止盈|止损|平仓|离场|出场|[后再并且]/u
    const start = match.index
    const end = start + match[0].length

    const left = Math.max(0, start - PRE_WINDOW)
    const right = Math.min(text.length, end + POST_WINDOW)
    const triggerEndInWindow = end - left

    const windowFragment = text.slice(left, right)
    const afterTrigger = windowFragment.slice(triggerEndInWindow)
    const splitMatch = CLAUSE_SPLITTER.exec(afterTrigger)
    const fragment = splitMatch
      ? windowFragment.slice(0, triggerEndInWindow + splitMatch.index)
      : windowFragment
    const hasLongDirection = /做多|多单|开多|long|买入/i.test(fragment)
    const hasShortDirection = /做空|空单|开空|short|卖出/i.test(fragment)

    if (hasLongDirection === hasShortDirection) return null
    return hasLongDirection ? 'long' : 'short'
  }

  private resolveProviderCode(rawProviderCode?: string): string {
    if (!rawProviderCode) {
      return DEFAULT_PROVIDER_CODE
    }
    const normalized = rawProviderCode.trim()
    if (!normalized || normalized === 'uniapi') {
      return DEFAULT_PROVIDER_CODE
    }
    return normalized
  }

  private normalizeChecklist(payload: ChecklistPayload | Record<string, unknown>): ChecklistPayload {
    const normalizeStringArray = (value: unknown): string[] | undefined => {
      if (!Array.isArray(value)) return undefined
      const normalized = value
        .filter(item => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean) as string[]
      return normalized.length > 0 ? normalized : undefined
    }

    const normalizeObject = (value: unknown): Record<string, unknown> | undefined => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
      }
      const normalized = Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, v]) => v !== undefined && v !== null && v !== ''),
      )
      return Object.keys(normalized).length > 0 ? normalized : undefined
    }

    return {
      symbols: normalizeStringArray(payload.symbols),
      timeframes: normalizeStringArray(payload.timeframes),
      entryRules: normalizeStringArray(payload.entryRules),
      exitRules: normalizeStringArray(payload.exitRules),
      riskRules: normalizeObject(payload.riskRules),
    }
  }

  private readConstraintPack(payload: Prisma.JsonValue | null): ConstraintPackSnapshot {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return createDefaultConstraintPack()
    }

    const raw = payload as Record<string, unknown>
    const guidePrompt = this.mergeGuidePromptConfig(undefined, raw.guidePrompt as CodegenGuideConfigDto | undefined)
    const conversationHistory = Array.isArray(raw.conversationHistory)
      ? raw.conversationHistory.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean)
      : []
    return {
      ...createDefaultConstraintPack(),
      ...raw,
      guidePrompt,
      conversationHistory,
    } as ConstraintPackSnapshot
  }

  private withGuidePrompt(
    pack: ConstraintPackSnapshot,
    guidePrompt?: GuidePromptConfig,
    recommendationStyle?: RecommendationStyle,
  ): ConstraintPackSnapshot {
    return {
      ...pack,
      guidePrompt,
      recommendationStyle,
    }
  }

  private mergeGuidePromptConfig(
    base?: GuidePromptConfig,
    patch?: CodegenGuideConfigDto,
  ): GuidePromptConfig | undefined {
    const merge = {
      symbolExample: patch?.symbolExample ?? base?.symbolExample,
      timeframeExample: patch?.timeframeExample ?? base?.timeframeExample,
      entryRuleExample: patch?.entryRuleExample ?? base?.entryRuleExample,
      exitRuleExample: patch?.exitRuleExample ?? base?.exitRuleExample,
      riskRuleExample: patch?.riskRuleExample ?? base?.riskRuleExample,
    }

    const normalized = Object.fromEntries(
      Object.entries(merge)
        .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
        .filter(([, value]) => typeof value === 'string' && value.length > 0),
    ) as GuidePromptConfig

    return Object.keys(normalized).length > 0 ? normalized : undefined
  }

  private async generateScript(
    checklist: ChecklistPayload,
    userMessage: string,
    options?: GenerationOptions,
  ): Promise<string> {
    const helperSignatures = this.buildHelperSignaturesPrompt()
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: buildStrategyCodegenSystemPrompt(helperSignatures),
      },
      {
        role: 'user',
        content: `需求: ${userMessage}\n约束: ${JSON.stringify(checklist)}`,
      },
    ]

    const strictEnabled = this.readBooleanEnv('LLM_CODEGEN_STRICT_ENABLED', DEFAULT_CODEGEN_STRICT_ENABLED)
    const strictFallback = this.readBooleanEnv('LLM_CODEGEN_STRICT_FALLBACK', DEFAULT_CODEGEN_STRICT_FALLBACK)
    const strictForced = this.readBooleanEnv('LLM_CODEGEN_STRICT_FORCE', false)

    let code = ''
    if (this.shouldAttemptStrictMode({
      strictEnabled,
      strictForced,
      options,
    })) {
      try {
        const strictResult = await this.aiService.chat({
          providerCode: options?.providerCode,
          model: options?.model,
          messages,
          temperature: options?.temperature ?? 0.2,
          maxTokens: options?.maxTokens ?? 1000,
          responseFormat: {
            type: 'json_schema',
            jsonSchema: {
              name: 'strategy_codegen_response_v1',
              strict: true,
              schema: CODEGEN_STRICT_RESPONSE_SCHEMA_V1,
            },
          },
        })
        code = this.normalizeStrictGeneratedCode(strictResult.content)
      } catch (error) {
        if (this.isStrictUnsupportedError(error)) {
          this.markStrictUnsupported(options)
        }
        if (!strictFallback) {
          const detail = error instanceof Error ? error.message : String(error)
          throw new DomainException('codegen.generation_failed_strict_mode', {
            code: ErrorCode.LLM_CODEGEN_GENERATION_FAILED,
            status: HttpStatus.BAD_GATEWAY,
            args: {
              detail,
              reasonMessage: `strict 模式调用失败: ${detail}`,
            },
          })
        }
      }

      if (!code && !strictFallback) {
        throw new DomainException('codegen.generation_failed_no_code_returned', {
          code: ErrorCode.LLM_CODEGEN_GENERATION_FAILED,
          status: HttpStatus.BAD_GATEWAY,
          args: { reasonMessage: 'strict 模式未返回 code 字段' },
        })
      }
    }

    if (!code) {
      const result = await this.aiService.chat({
        providerCode: options?.providerCode,
        model: options?.model,
        messages,
        temperature: options?.temperature ?? 0.2,
        maxTokens: options?.maxTokens ?? 1000,
      })
      code = this.normalizeGeneratedScript(result.content)
    }

    if (!code) {
      throw new DomainException('codegen.script_generation_empty_result', {
        code: ErrorCode.AI_PROVIDER_ERROR,
        status: HttpStatus.BAD_GATEWAY,
        args: { reasonMessage: '模型未返回可执行策略脚本' },
      })
    }

    return code
  }

  private shouldAttemptStrictMode(input: {
    strictEnabled: boolean
    strictForced: boolean
    options?: GenerationOptions
  }): boolean {
    if (!input.strictEnabled) return false
    if (input.strictForced) return true
    if (this.isStrategyCodegenProviderWithoutExplicitModel(input.options)) return false
    if (this.isKnownStrictIncompatibleModel(input.options?.model)) return false
    if (this.isStrictUnsupportedCached(input.options)) return false
    return true
  }

  private isStrategyCodegenProviderWithoutExplicitModel(options?: GenerationOptions): boolean {
    const providerCode = (options?.providerCode ?? DEFAULT_PROVIDER_CODE).trim().toLowerCase()
    const hasModel = typeof options?.model === 'string' && options.model.trim().length > 0
    return providerCode === DEFAULT_PROVIDER_CODE && !hasModel
  }

  private isKnownStrictIncompatibleModel(model?: string): boolean {
    if (!model) return false
    return /deepseek/i.test(model)
  }

  private markStrictUnsupported(options?: GenerationOptions): void {
    const key = this.buildStrictTargetKey(options)
    if (!key) return
    const ttlMs = this.readPositiveIntEnv(
      'LLM_CODEGEN_STRICT_UNSUPPORTED_TTL_MS',
      DEFAULT_CODEGEN_STRICT_UNSUPPORTED_TTL_MS,
    )
    this.strictUnsupportedTargets.set(key, Date.now() + ttlMs)
  }

  private isStrictUnsupportedCached(options?: GenerationOptions): boolean {
    const key = this.buildStrictTargetKey(options)
    if (!key) return false
    const expiresAt = this.strictUnsupportedTargets.get(key)
    if (!expiresAt) return false
    if (expiresAt <= Date.now()) {
      this.strictUnsupportedTargets.delete(key)
      return false
    }
    return true
  }

  private buildStrictTargetKey(options?: GenerationOptions): string | null {
    const providerCode = (options?.providerCode ?? DEFAULT_PROVIDER_CODE).trim().toLowerCase()
    const model = options?.model?.trim().toLowerCase()
    if (!model) return `${providerCode}::__provider__`
    return `${providerCode}::${model}`
  }

  private readPositiveIntEnv(key: string, defaultValue: number): number {
    const raw = defaultEnvAccessor.raw(key)
    if (!raw) return defaultValue
    const value = Number.parseInt(raw, 10)
    if (!Number.isFinite(value) || value <= 0) return defaultValue
    return value
  }

  private isStrictUnsupportedError(error: unknown): boolean {
    const detail = error instanceof Error ? error.message : String(error)
    const normalized = detail.toLowerCase()
    return normalized.includes('response_format')
      && (normalized.includes('unavailable') || normalized.includes('not support'))
  }

  private readBooleanEnv(key: string, defaultValue: boolean): boolean {
    const raw = defaultEnvAccessor.raw(key)
    if (!raw) return defaultValue
    const normalized = raw.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
    return defaultValue
  }

  private normalizeStrictGeneratedCode(content?: string): string {
    const raw = content?.trim() ?? ''
    if (!raw) return ''

    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return ''
      }
      const code = (parsed as Record<string, unknown>).code
      return typeof code === 'string' ? code.trim() : ''
    } catch {
      return ''
    }
  }

  private normalizeGeneratedScript(content?: string): string {
    const raw = content?.trim() ?? ''
    if (!raw) {
      return ''
    }

    const fencedMatch = raw.match(/```[\w-]*[^\S\n]*\n([\s\S]*?)\n?```/)
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim()
    }

    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'string') {
        return parsed.trim()
      }
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const candidate = (parsed as Record<string, unknown>).code
        if (typeof candidate === 'string' && candidate.trim()) {
          return candidate.trim()
        }
      }
    } catch {
      // keep raw when content is not JSON
    }

    return raw
  }

  private async validateGeneratedScript(scriptCode: string): Promise<ScriptValidationResult> {
    const staticResult = this.staticGuardrail.validate(scriptCode)
    if (!staticResult.passed) {
      return {
        passed: false,
        scriptCode,
        reason: staticResult.reason ?? '静态校验失败',
        staticPassed: false,
        runtimePassed: false,
        outputPassed: false,
      }
    }

    const runtimeResult = await this.runtimeGuardrail.validate(scriptCode)
    if (runtimeResult.runtimePassed && runtimeResult.outputPassed) {
      return {
        passed: true,
        scriptCode,
        staticPassed: true,
        runtimePassed: true,
        outputPassed: true,
      }
    }

    const autoFixedScript = this.tryAutoFixStringOutputScript(scriptCode, runtimeResult.reason)
    if (autoFixedScript) {
      const autoFixedStatic = this.staticGuardrail.validate(autoFixedScript)
      if (autoFixedStatic.passed) {
        const autoFixedRuntime = await this.runtimeGuardrail.validate(autoFixedScript)
        if (autoFixedRuntime.runtimePassed && autoFixedRuntime.outputPassed) {
          return {
            passed: true,
            scriptCode: autoFixedScript,
            staticPassed: true,
            runtimePassed: true,
            outputPassed: true,
          }
        }
      }
    }

    return {
      passed: false,
      scriptCode,
      reason: runtimeResult.reason ?? '运行时校验失败',
      staticPassed: true,
      runtimePassed: runtimeResult.runtimePassed,
      outputPassed: runtimeResult.outputPassed,
    }
  }

  private async validateCompiledScript(scriptCode: string): Promise<ScriptValidationResult> {
    try {
      this.compiledScriptParser.parse(scriptCode)
      return {
        passed: true,
        scriptCode,
        staticPassed: true,
        runtimePassed: true,
        outputPassed: true,
      }
    } catch (error) {
      return {
        passed: false,
        scriptCode,
        reason: `编译脚本结构校验失败: ${error instanceof Error ? error.message : 'unknown'}`,
        staticPassed: true,
        runtimePassed: false,
        outputPassed: false,
      }
    }
  }

  private buildRepairGenerationMessage(input: {
    originalMessage: string
    checklist: ChecklistPayload
    scriptCode: string
    rejectReason: string
    attempt: number
  }): string {
    const normalizedRejectReason = this.normalizeRepairRejectReason(input.rejectReason)
    return [
      `这是第 ${input.attempt} 次自动修复，请严格修复并返回完整 TypeScript 策略源码。`,
      `原始需求：${input.originalMessage}`,
      `约束：${JSON.stringify(input.checklist)}`,
      `上一轮主要错误：${normalizedRejectReason}`,
      '必须满足：',
      '- 输出必须是 const strategy: StrategyAdapterV1 = { ... }，最后一行只能是 strategy',
      '- 不要输出 markdown/code fence/解释文字，只输出 TypeScript 代码',
      '- 对上一版脚本做最小改动修复，不要重写架构',
      '- 所有显式声明返回类型的函数必须保证每条分支都有 return',
      '- strategy.decide 必须返回 StrategyDecisionV1 或 null，禁止返回字符串',
      '- strategy 对象内部只能是属性声明，禁止在对象字面量中写 const/let/function 语句',
      '- 只允许 StrategyDecisionV1 协议（action/size/adjustMode/confidence/reason/risk/meta）',
      '- 禁止返回旧协议字段（direction/signalType/entryPrice/stopLoss/takeProfit/reasoning）',
      '- 参数优先用 ctx.paramsNormalized，字段不存在要给默认值并确保类型正确',
      '- 若使用 helpers，必须来自 ctx.helpers 并先判空',
      '上一版脚本如下：',
      input.scriptCode,
    ].join('\n')
  }

  private normalizeRepairRejectReason(reason: string): string {
    const trimmed = reason.trim()
    if (!trimmed) return '脚本校验失败'

    const normalized = trimmed.replace(/^TypeScript 类型检查失败:\s*/u, '')
    const items = normalized
      .split(';')
      .map(item => item.trim())
      .filter(Boolean)

    if (items.length === 0) return trimmed

    const unique = Array.from(new Set(items))
    return unique.slice(0, 12).join('; ')
  }

  private buildTypeSafeFallbackScript(checklist: ChecklistPayload): string {
    const riskRules = checklist.riskRules ?? {}
    const rawPositionPct = riskRules.positionPct
    const parsedPositionPct = typeof rawPositionPct === 'number' && Number.isFinite(rawPositionPct)
      ? rawPositionPct
      : null
    const ratio = (() => {
      if (parsedPositionPct === null) return 0.1
      const pctBased = parsedPositionPct > 1 ? parsedPositionPct / 100 : parsedPositionPct
      return Math.max(0.01, Math.min(1, pctBased))
    })()
    const ratioText = Number(ratio.toFixed(4))

    return [
      'const strategy: StrategyAdapterV1 = {',
      "  protocolVersion: 'v1',",
      '  onBar(ctx): StrategyDecisionV1 {',
      "    const bars = Array.isArray(ctx.bars) ? ctx.bars : []",
      "    if (bars.length < 20) return { action: 'NOOP', reason: 'fallback: insufficient bars' }",
      "    const closes = bars.map(item => item?.close).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))",
      "    if (closes.length < 20) return { action: 'NOOP', reason: 'fallback: insufficient close series' }",
      '    const fast = ctx.helpers?.ta?.sma(closes, 5)',
      '    const slow = ctx.helpers?.ta?.sma(closes, 20)',
      "    if (typeof fast !== 'number' || typeof slow !== 'number') return { action: 'NOOP', reason: 'fallback: SMA unavailable' }",
      `    const size: StrategyDecisionV1['size'] = { mode: 'RATIO', value: ${ratioText} }`,
      "    if (fast > slow) return { action: 'OPEN_LONG', size, confidence: 55, reason: 'fallback: fast SMA above slow SMA' }",
      "    if (fast < slow) return { action: 'OPEN_SHORT', size, confidence: 55, reason: 'fallback: fast SMA below slow SMA' }",
      "    return { action: 'NOOP', reason: 'fallback: neutral trend' }",
      '  },',
      '}',
      'strategy',
    ].join('\n')
  }

  private tryAutoFixStringOutputScript(scriptCode: string, reason?: string): string | null {
    const normalizedReason = (reason ?? '').toLowerCase()
    const isStringReturnError = normalizedReason.includes('invalid return type')
      && normalizedReason.includes('got string')
    if (!isStringReturnError) {
      return null
    }

    return [
      'const __result = (() => {',
      scriptCode,
      '})();',
      'if (__result && typeof __result === "object" && !Array.isArray(__result)) return __result;',
      'if (typeof __result === "string") {',
      '  try {',
      '    const __parsed = JSON.parse(__result);',
      '    if (__parsed && typeof __parsed === "object" && !Array.isArray(__parsed)) return __parsed;',
      '  } catch {}',
      '  return { signal: __result };',
      '}',
      'return { value: __result ?? "EMPTY_RESULT" };',
    ].join('\n')
  }

  private async planConversationByLlm(
    message: string,
    currentLogic: ChecklistPayload,
    options?: { providerCode?: string, model?: string },
    history: string[] = [],
  ): Promise<ConversationPlan> {
    const text = message.trim()
    if (!text) {
      return {
        related: false,
        logicReady: false,
        assistantPrompt: '请先描述你的交易逻辑，我会继续帮你完善。',
      }
    }

    const classifyOnce = async () => {
      const result = await this.aiService.chat({
        providerCode: options?.providerCode ?? DEFAULT_PROVIDER_CODE,
        model: options?.model,
        temperature: 0,
        maxTokens: 400,
        messages: [
          {
            role: 'system',
            content: buildConversationPlannerSystemPrompt(),
          },
          {
            role: 'user',
            content: JSON.stringify({
              message: text,
              currentLogic,
              history: history.slice(-MAX_PLANNER_HISTORY_LINES),
            }),
          },
        ],
      })

      const content = result.content?.trim() ?? ''
      if (!content) {
        return {
          related: true,
          logicReady: false,
          assistantPrompt: '我先理解到你的交易想法了。请补充入场和出场触发条件，我再整理成逻辑图。',
        } satisfies ConversationPlan
      }

      try {
        const parsed = JSON.parse(content) as {
          related?: unknown
          logicReady?: unknown
          assistantPrompt?: unknown
          logic?: unknown
        }
        const related = typeof parsed.related === 'boolean' ? parsed.related : true
        const logicReady = typeof parsed.logicReady === 'boolean' ? parsed.logicReady : false
        const assistantPrompt = typeof parsed.assistantPrompt === 'string' && parsed.assistantPrompt.trim()
          ? parsed.assistantPrompt.trim()
          : (logicReady
              ? '我已整理出策略逻辑，请确认逻辑图。'
              : '我先继续完善策略逻辑，请补充一个关键条件。')
        const logic = this.normalizeChecklist((parsed.logic ?? {}) as Record<string, unknown>)
        return {
          related,
          logicReady,
          assistantPrompt,
          logic,
        } satisfies ConversationPlan
      } catch {
        return {
          related: true,
          logicReady: false,
          assistantPrompt: '我先继续完善策略逻辑，请补充入场和出场条件。',
          logic: this.inferChecklistFromMessage(text),
        } satisfies ConversationPlan
      }
    }

    try {
      return await classifyOnce()
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error)
      const nonRetryableModelError = /model\s+not\s+exist|model.*not.*found/i.test(messageText)
      if (nonRetryableModelError) {
        return {
          related: true,
          logicReady: false,
          assistantPrompt: '我先继续完善策略逻辑，请补充入场和出场条件。',
          logic: this.inferChecklistFromMessage(text),
        }
      }
      try {
        return await classifyOnce()
      } catch {
        return {
          related: true,
          logicReady: false,
          assistantPrompt: '我先继续完善策略逻辑，请补充入场和出场条件。',
          logic: this.inferChecklistFromMessage(text),
        }
      }
    }
  }

  private mergeChecklistSnapshots(base: ChecklistPayload, patch: ChecklistPayload): ChecklistPayload {
    const mergedRiskRules = (() => {
      const baseRiskRules = base.riskRules ?? {}
      const patchRiskRules = patch.riskRules ?? {}
      const merged = {
        ...baseRiskRules,
        ...patchRiskRules,
      }
      return Object.keys(merged).length > 0 ? merged : undefined
    })()

    const merged = {
      symbols: patch.symbols && patch.symbols.length > 0 ? patch.symbols : base.symbols,
      timeframes: patch.timeframes && patch.timeframes.length > 0 ? patch.timeframes : base.timeframes,
      entryRules: patch.entryRules && patch.entryRules.length > 0 ? patch.entryRules : base.entryRules,
      exitRules: patch.exitRules && patch.exitRules.length > 0 ? patch.exitRules : base.exitRules,
      riskRules: mergedRiskRules,
    }
    return this.normalizeChecklist(merged)
  }

  private appendConversationHistory(
    current: string[],
    userMessage?: string,
    assistantMessage?: string,
  ): string[] {
    const next = [...current]
    const push = (prefix: 'U' | 'A', value?: string) => {
      const normalized = value?.trim()
      if (!normalized) return
      next.push(`${prefix}: ${normalized}`)
    }
    push('U', userMessage)
    push('A', assistantMessage)
    return next.slice(-MAX_PLANNER_HISTORY_LINES)
  }

  private inferRecommendationStyleFromContext(
    message: string | undefined,
    checklist: ChecklistPayload,
    currentStyle?: RecommendationStyle,
  ): RecommendationStyle | undefined {
    const fromChecklist = this.detectRecommendationStyleFromChecklist(checklist)
    if (fromChecklist) {
      return fromChecklist
    }
    const text = (message ?? '').trim()
    if (text) {
      if (/均线|金叉|死叉|\bma\b|moving average/i.test(text)) {
        return 'ma'
      }
      if (/下跌|上涨|回撤|[跌涨天%]|分钟|小时|\d+\s*[mhd]/i.test(text)) {
        return 'drop-rise'
      }
    }
    return currentStyle
  }

  private detectRecommendationStyleFromChecklist(checklist: ChecklistPayload): RecommendationStyle | undefined {
    const rules = [...(checklist.entryRules ?? []), ...(checklist.exitRules ?? [])].join(' ')
    if (!rules.trim()) return undefined
    if (/金叉|死叉|均线|ma|moving average/i.test(rules)) return 'ma'
    if (/下跌|上涨|回撤|[跌涨%]|\d+\s*[mhd]/i.test(rules)) return 'drop-rise'
    return undefined
  }

  private buildHelperSignaturesPrompt(): string {
    const docs = getHelperDocs().filter(doc =>
      ALLOWED_HELPER_CATEGORIES.includes(doc.category),
    )

    return docs
      .slice(0, MAX_HELPER_SIGNATURE_LINES)
      .map(doc => `- ${doc.signature}`)
      .join('\n')
  }

  private resolveSessionUserId(callerUserId: string | undefined, requestUserId?: string): string {
    const normalizedCallerUserId = callerUserId?.trim()
    if (normalizedCallerUserId) {
      return normalizedCallerUserId
    }
    return requestUserId?.trim() ?? ''
  }

  static isTerminalStatus(status: LlmCodegenSessionStatus): boolean {
    return status === 'PUBLISHED' || status === 'CONSISTENCY_FAILED' || status === 'REJECTED'
  }
}
