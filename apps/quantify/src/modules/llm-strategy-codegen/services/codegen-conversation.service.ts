import type { ConstraintPackSnapshot } from '../constants/constraint-pack'
import type { AiQuantConversationResponseDto } from '../dto/ai-quant-conversation.response.dto'
import type { CodegenGuideConfigDto } from '../dto/codegen-guide-config.dto'
import type { CodegenSessionResponseDto } from '../dto/codegen-session.response.dto'
import type { ContinueCodegenSessionDto } from '../dto/continue-codegen-session.dto'
import type { LlmCodegenEngineTestResponseDto } from '../dto/llm-codegen-engine-test.response.dto'
import type { StartCodegenSessionDto } from '../dto/start-codegen-session.dto'
import type { TestLlmCodegenEngineDto } from '../dto/test-llm-codegen-engine.dto'
import type { AiQuantConversationSnapshotRecord } from '../repositories/ai-quant-conversations.repository'
import type { ChecklistPayload, ChecklistRuleBasis, ChecklistRuleDraft } from '../types/codegen-checklist'
import type { LlmCodegenSessionStatus } from '../types/codegen-session-status'
import type { StrategyAmbiguity } from '../types/strategy-ambiguity'
import type { StrategyClarificationItem, StrategyClarificationState } from '../types/strategy-clarification'
import type { StrategyBlockingReason, StrategyInferredAssumption } from '../types/strategy-decision'
import type { StrategyNormalizedIntent } from '../types/strategy-normalized-intent'
import { buildSemanticSlotId, type SemanticSlotState, type SemanticState, type SemanticTriggerState } from '../types/semantic-state'
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
import { AiQuantConversationsRepository } from '../repositories/ai-quant-conversations.repository'
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
import { buildChecklistRuleDrafts, resolveChecklistDefaultTimeframe } from './checklist-rule-drafts'
import {
  CodegenConversationContextHelper,
  MAX_PLANNER_HISTORY_LINES,
  type ConversationMessage,
  type GuidePromptConfig,
  type RecommendationStyle,
} from './codegen-conversation-context.helper'
import { CodegenConversationResponseMapperHelper, type PublishedSnapshotProjection } from './codegen-conversation-response-mapper.helper'
import {
  buildStartSessionBootstrap,
  type CanonicalCompileabilityReport,
  type ConversationPlan,
} from './codegen-conversation-start-session.helper'
import { CodegenConversationStateMachine } from './codegen-conversation-state-machine'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CodegenSessionPublicationPipelineService } from './codegen-session-publication-pipeline.service'
import { isEquivalentMarketScopeValue } from './market-scope-equivalence'
import { resolveDefaultRiskBasis } from './rule-family-default-semantics'
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
import { StrategyCompileabilityDecisionService } from './strategy-compileability-decision.service'
import { StrategyExecutionContextService } from './strategy-execution-context.service'
import { StrategyIntentNormalizerService } from './strategy-intent-normalizer.service'
import { StrategyIntentResolutionService } from './strategy-intent-resolution.service'
import { SemanticStateCompileBridgeService } from './semantic-state-compile-bridge.service'
import { SemanticStateMergeService } from './semantic-state-merge.service'
import { SemanticStateProjectionService } from './semantic-state-projection.service'
import { SemanticStateReducerService } from './semantic-state-reducer.service'

interface GenerationOptions {
  providerCode?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

interface NormalizationResult {
  normalizedIntent: StrategyNormalizedIntent
  blocked: boolean
  blockerReason?: string
}
type StrategyClarificationStateWithSummary = StrategyClarificationState & { summary?: string | null }

const ALLOWED_HELPER_CATEGORIES = ['finance', 'array', 'ta', 'signal'] as const
const MAX_HELPER_SIGNATURE_LINES = 24
const DEFAULT_PROVIDER_CODE = 'strategy-codegen'
const DEFAULT_MODEL = 'gpt-4'
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

const conversationContextHelper = new CodegenConversationContextHelper()
const responseMapperHelper = new CodegenConversationResponseMapperHelper()

function normalizePublishedSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/:(SPOT|PERP)$/u, '')
}

function normalizeDirectionalPercentRule(
  fragment: string,
  phase: 'entry' | 'exit',
): string {
  const timeframeMatch = fragment.match(/(\d{1,4})\s*(min|分钟|小时|[mhd天])/iu)
  const value = timeframeMatch?.[1]
  const unit = timeframeMatch?.[2]?.toLowerCase() ?? ''
  const timeframe = value
    ? (unit === 'm' || unit === 'min' || unit === '分钟'
        ? `${value}m`
        : (unit === 'h' || unit === '小时' ? `${value}h` : `${value}d`))
    : null
  const percentMatch = fragment.match(/(\d+(?:\.\d+)?)\s*%|百分之?\s*(\d+(?:\.\d+)?)/u)
  const percent = percentMatch?.[1] ?? percentMatch?.[2] ?? '0'
  const direction = phase === 'entry' ? '下跌' : '上涨'
  const action = phase === 'entry' ? '买入' : '卖出'
  const prefix = timeframe ? `${timeframe} 内` : ''

  return `${prefix}${direction} ${percent}% ${action}`.trim()
}

@Injectable()
export class CodegenConversationService {
  private readonly strictUnsupportedTargets = new Map<string, number>()
  private readonly stateMachine = new CodegenConversationStateMachine()

  constructor(
    private readonly aiService: AiService,
    private readonly sessionsRepo: CodegenSessionsRepository,
    private readonly publishedSnapshotsRepo: PublishedStrategySnapshotsRepository,
    private readonly conversationsRepo: AiQuantConversationsRepository,
    private readonly staticGuardrail: StaticGuardrailService,
    private readonly runtimeGuardrail: RuntimeGuardrailService,
    private readonly specDescBuilder: SpecDescBuilderService,
    private readonly canonicalSpecBuilder: CanonicalSpecBuilderService,
    private readonly uniquenessDecision: StrategyCompileabilityDecisionService,
    private readonly clarificationRules: StrategyClarificationRulesService,
    private readonly clarificationQuestion: StrategyClarificationQuestionService,
    private readonly publicationPipeline: CodegenSessionPublicationPipelineService,
    private readonly executionContext: StrategyExecutionContextService = new StrategyExecutionContextService(),
    private readonly intentNormalizer: StrategyIntentNormalizerService = new StrategyIntentNormalizerService(),
    private readonly intentResolution: StrategyIntentResolutionService = new StrategyIntentResolutionService(),
    private readonly semanticStateReducer: SemanticStateReducerService = new SemanticStateReducerService(),
    private readonly semanticStateProjection: SemanticStateProjectionService = new SemanticStateProjectionService(),
    private readonly semanticStateCompileBridge: SemanticStateCompileBridgeService = new SemanticStateCompileBridgeService(),
    private readonly semanticStateMerge: SemanticStateMergeService = new SemanticStateMergeService(),
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
    const guidePrompt = this.mergeGuidePromptConfig(undefined, dto.guideConfig)
    const initialConstraintPack = {
      ...createDefaultConstraintPack(guidePrompt),
      recommendationStyle,
    }
    const clarification = this.resolveClarificationArtifacts(checklist)
    const initialSemanticState = this.buildFallbackSemanticState(checklist)
    const clarificationState = this.mergeSemanticClarificationState(
      initialSemanticState,
      clarification.clarificationState,
    )
    const plannerStatus: LlmCodegenSessionStatus = this.stateMachine.resolvePlannerStatus({
      logicReady: plan.logicReady,
      clarificationState,
    })
    const normalization = clarification.normalization
    const initialCanonicalSpec = plannerStatus === 'CHECKLIST_GATE'
      ? this.buildCanonicalSpecForConversation(checklist, normalization)
      : null
    const compileability = initialCanonicalSpec
      ? this.evaluateCanonicalCompileability(initialCanonicalSpec)
      : null
    const decision = this.buildStrategyDecision({
      checklist,
      clarification,
      compileability,
      constraintPack: initialConstraintPack,
    })
    const nextInitialSemanticSlot = this.findNextOpenSemanticSlot(initialSemanticState)
    const semanticClarificationPrompt = nextInitialSemanticSlot
      && (
        nextInitialSemanticSlot.priority === 'core'
        || nextInitialSemanticSlot.priority === 'risk'
        || nextInitialSemanticSlot.priority === 'behavior'
      )
      ? this.buildSemanticClarificationPrompt(initialSemanticState)
      : null
    const clarificationPrompt = decision.kind === 'CONFIRM_INFERRED'
      ? this.clarificationQuestion.buildFromDecision(decision)
      : (semanticClarificationPrompt
          || clarification.clarificationPrompt
          || this.clarificationQuestion.build(clarificationState))
    const bootstrap = buildStartSessionBootstrap({
      initialMessage: dto.initialMessage,
      plannerStatus,
      clarificationState,
      clarificationPrompt,
      decisionKind: decision.kind,
      plan,
      compileability,
      normalizationBlocked: normalization?.blocked === true,
      normalizationAssistantPrompt: normalization?.blocked
        ? this.buildNormalizationAssistantPrompt(checklist, normalization)
        : undefined,
    }, report => this.buildCompileabilityAssistantPrompt(report))
    const initialSpecDesc = bootstrap.shouldGateChecklist && initialCanonicalSpec
      ? this.specDescBuilder.buildFromCanonicalSpec(initialCanonicalSpec, '', {
          normalizedIntent: normalization?.normalizedIntent ?? null,
          executionContext: clarification.executionContext.context,
        })
      : null
    const initialCanonicalDigest = this.readCanonicalDigest(initialSpecDesc)
    const session = await this.sessionsRepo.createSession({
      userId: sessionUserId,
      status: bootstrap.status,
      checklist: checklist as Prisma.InputJsonValue,
      semanticState: initialSemanticState as unknown as Prisma.InputJsonValue,
      clarificationState: clarificationState as unknown as Prisma.InputJsonValue,
      constraintPack: {
        ...initialConstraintPack,
        conversationHistory: bootstrap.initialHistory,
      } as unknown as Prisma.InputJsonValue,
      latestDraftCode: null,
      latestSpecDesc: initialSpecDesc as Prisma.InputJsonValue,
      rejectReason: null,
      strategyInstanceId: null,
    } as unknown as Prisma.LlmStrategyCodegenSessionCreateInput)

    const response = this.finalizeSessionResponse({
      id: session.id,
      status: bootstrap.status,
      missingFields: [],
      specDesc: initialSpecDesc,
      canonicalDigest: initialCanonicalDigest,
      assistantPrompt: bootstrap.assistantPrompt,
      clarificationState,
    })
    return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
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

    return this.returnPersistedSnapshotResponse(session, userId)
  }

  async listConversations(userId: string): Promise<AiQuantConversationResponseDto[]> {
    let conversations = await this.conversationsRepo.listByUser(userId)
    const knownSessionIds = new Set(await this.conversationsRepo.listKnownSessionIdsByUser(userId))
    const sessions = await this.sessionsRepo.listByUser(userId)
    const sessionsNeedingProjection = sessions.filter(session => !knownSessionIds.has(session.id))

    if (sessionsNeedingProjection.length > 0) {
      await Promise.all(sessionsNeedingProjection.map(session => this.persistConversationProjectionForSessionId(session.id, userId)))
      conversations = await this.conversationsRepo.listByUser(userId)
    }

    return Promise.all(conversations.map(conversation => this.toConversationResponse(conversation)))
  }

  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    await this.conversationsRepo.archiveByIdAndUser(conversationId, userId)
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
    if (this.stateMachine.isTerminalStatus(session.status)) {
      throw new DomainException('codegen.session_terminal_status', {
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { sessionId, status: session.status },
      })
    }
    if (dto.confirmGenerate === true) {
      return this.continueConfirmedSession(session, dto, sessionUserId)
    }
    if (this.stateMachine.isProcessingStatus(session.status)) {
      return this.returnPersistedSnapshotResponse(session, sessionUserId)
    }

    const baseClarificationState = this.readClarificationState(session.clarificationState)
    const inferredSemanticClarificationAnswers = this.inferFreeformSemanticClarificationAnswers(
      baseClarificationState,
      dto.message,
      dto.clarificationAnswers,
    )
    const effectiveClarificationAnswers = Object.keys(inferredSemanticClarificationAnswers).length > 0
      ? inferredSemanticClarificationAnswers
      : dto.clarificationAnswers
    const hasStructuredClarificationAnswers = Boolean(
      effectiveClarificationAnswers && Object.keys(effectiveClarificationAnswers).length > 0,
    )
    const persistedChecklist = this.readChecklist(session.checklist)
    const hasPersistedSemanticState = this.hasPersistedSemanticState(
      (session as { semanticState?: Prisma.JsonValue | null }).semanticState,
    )
    const currentSemanticState = this.readSemanticState(
      (session as { semanticState?: Prisma.JsonValue | null }).semanticState,
      persistedChecklist,
    )
    const semanticStateAfterAnswers = this.applySemanticClarificationAnswers(
      currentSemanticState,
      baseClarificationState,
      effectiveClarificationAnswers,
    )
    const baseChecklistAfterAnswers = this.applyClarificationAnswers(
      hasPersistedSemanticState
        ? this.projectLegacyChecklistFromSemanticState(semanticStateAfterAnswers, persistedChecklist)
        : persistedChecklist,
      baseClarificationState,
      effectiveClarificationAnswers,
    )
    const inferredConfirmation = this.withConfirmedInferredDecisionKeys(
      this.readConstraintPack(session.constraintPack),
      baseChecklistAfterAnswers,
      dto.message,
    )
    const baseChecklist = inferredConfirmation.checklist
    const derivedBaseSemanticState = this.buildFallbackSemanticState(baseChecklist)
    const baseSemanticState = hasPersistedSemanticState
      ? this.semanticStateMerge.merge({
          persisted: semanticStateAfterAnswers,
          derived: derivedBaseSemanticState,
        })
      : derivedBaseSemanticState
    const clarificationStateAfterAnswers = hasStructuredClarificationAnswers
      ? this.resolveClarificationArtifacts(baseChecklist).clarificationState
      : this.withClarificationSummary(baseClarificationState, baseChecklist)
    const messageChecklist = this.normalizeChecklist({
      ...this.inferChecklistFromMessage(dto.message),
      ...this.extractChecklist(dto),
    })
    const preMergedChecklist = this.mergeChecklistSnapshots(baseChecklist, messageChecklist)
    const constraintPack = inferredConfirmation.constraintPack
    const guidePrompt = this.mergeGuidePromptConfig(constraintPack.guidePrompt, dto.guideConfig)
    const plan = await this.planConversationByLlm(dto.message, preMergedChecklist, {
      providerCode: this.resolveProviderCode(dto.providerCode),
      model: dto.model,
    }, constraintPack.conversationHistory ?? [])
    if (!plan.related) {
      if (hasStructuredClarificationAnswers) {
        return this.continueWithStructuredClarificationAnswers({
          session,
          checklist: baseChecklist,
          semanticState: baseSemanticState,
          useSemanticProjection: hasPersistedSemanticState,
          clarificationState: clarificationStateAfterAnswers,
          constraintPack,
          message: dto.message,
          userId: sessionUserId,
        })
      }
      if (inferredConfirmation.consumed) {
        const assistantPrompt = plan.assistantPrompt || '这条消息看起来和策略无关。请描述交易逻辑或修改条件。'
        const historyAfterConsumedUnrelated = this.appendConversationHistory(
          constraintPack.conversationHistory ?? [],
          dto.message,
          assistantPrompt,
        )
        await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
          status: session.status,
          checklist: baseChecklist,
          semanticState: baseSemanticState,
          clarificationState: clarificationStateAfterAnswers,
          constraintPack: {
            ...constraintPack,
            conversationHistory: historyAfterConsumedUnrelated,
          },
        }))
      }
      const response = this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: plan.assistantPrompt || '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
        clarificationState: clarificationStateAfterAnswers,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }
    const mergedChecklist = this.mergeChecklistSnapshots(preMergedChecklist, plan.logic ?? {})
    const derivedSemanticState = this.buildFallbackSemanticState(mergedChecklist)
    const reducedSemanticState = hasPersistedSemanticState
      ? this.semanticStateMerge.merge({
          persisted: semanticStateAfterAnswers,
          derived: derivedSemanticState,
        })
      : derivedSemanticState
    const canonicalChecklist = hasPersistedSemanticState
      ? this.projectLegacyChecklistFromSemanticState(reducedSemanticState, mergedChecklist)
      : mergedChecklist
    const clarification = this.resolveClarificationArtifacts(canonicalChecklist)
    const clarificationState = this.mergeSemanticClarificationState(
      reducedSemanticState,
      clarification.clarificationState,
    )
    const semanticReadyForGenerate = hasPersistedSemanticState
      && this.findNextOpenSemanticSlot(reducedSemanticState) === null
    const clarificationPrompt = this.buildSemanticClarificationPrompt(reducedSemanticState)
      || this.clarificationQuestion.build(clarificationState)
      || clarification.clarificationPrompt
    const recommendationStyle = this.inferRecommendationStyleFromContext(
      dto.message,
      canonicalChecklist,
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
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: canonicalChecklist,
        semanticState: reducedSemanticState,
        clarificationState,
        constraintPack: {
          ...nextConstraintPack,
          conversationHistory: historyAfterClarification,
        },
      }))

      const response = this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt,
        clarificationState,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }
    const historyAfterPlanner = this.appendConversationHistory(
      constraintPack.conversationHistory ?? [],
      dto.message,
      plan.assistantPrompt,
    )
    const normalization = hasPersistedSemanticState
      ? this.buildNormalizationFromSemanticState(reducedSemanticState)
      : clarification.normalization
    const canonicalSpec = this.buildCanonicalSpecForConversation(canonicalChecklist, normalization)
    const specDesc = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: normalization.normalizedIntent,
      executionContext: clarification.executionContext.context,
    })
    const canonicalDigest = this.readCanonicalDigest(specDesc)
    const compileability = this.evaluateCanonicalCompileability(canonicalSpec)
    const decision = this.buildStrategyDecision({
      checklist: mergedChecklist,
      clarification,
      compileability,
      constraintPack: nextConstraintPack,
    })
    const decisionPrompt = decision.kind === 'CONFIRM_INFERRED'
      ? this.clarificationQuestion.buildFromDecision(decision)
      : clarification.clarificationPrompt

    if (!plan.logicReady) {
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: canonicalChecklist,
        semanticState: reducedSemanticState,
        clarificationState,
        constraintPack: {
          ...nextConstraintPack,
          conversationHistory: historyAfterPlanner,
        },
      }))

      const response = this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: plan.assistantPrompt,
        clarificationState,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    if (decision.kind === 'CONFIRM_INFERRED') {
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: canonicalChecklist,
        semanticState: reducedSemanticState,
        clarificationState,
        constraintPack: {
          ...nextConstraintPack,
          conversationHistory: historyAfterPlanner,
        },
      }))

      const response = this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: decisionPrompt,
        clarificationState,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    if (normalization.blocked && !semanticReadyForGenerate) {
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: canonicalChecklist,
        semanticState: reducedSemanticState,
        clarificationState,
        constraintPack: {
          ...nextConstraintPack,
          conversationHistory: historyAfterPlanner,
        },
        latestSpecDesc: specDesc,
      }))

      const response = this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: this.buildNormalizationAssistantPrompt(canonicalChecklist, normalization),
        clarificationState,
        specDesc,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    if (!compileability.canCompile && !semanticReadyForGenerate) {
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: canonicalChecklist,
        semanticState: reducedSemanticState,
        clarificationState,
        constraintPack: {
          ...nextConstraintPack,
          conversationHistory: historyAfterPlanner,
        },
      }))

      const response = this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: this.buildCompileabilityAssistantPrompt(compileability),
        clarificationState,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
      status: 'CHECKLIST_GATE',
      checklist: canonicalChecklist,
      semanticState: reducedSemanticState,
      clarificationState,
      constraintPack: {
        ...nextConstraintPack,
        conversationHistory: historyAfterPlanner,
      },
      latestSpecDesc: specDesc,
    }))

    const response = this.finalizeSessionResponse({
      id: session.id,
      status: 'CHECKLIST_GATE',
      missingFields: [],
      specDesc,
      canonicalDigest,
      assistantPrompt: `${plan.assistantPrompt}\n逻辑图已更新。请确认逻辑图，确认后我再生成策略代码。`,
      clarificationState,
    })
    return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
  }

  private async continueConfirmedSession(
    session: {
      id: string
      userId: string
      status: LlmCodegenSessionStatus
      checklist: Prisma.JsonValue | null
      semanticState?: Prisma.JsonValue | null
      clarificationState?: Prisma.JsonValue | null
      constraintPack: Prisma.JsonValue | null
      strategyInstanceId?: string | null
    },
    dto: ContinueCodegenSessionDto,
    sessionUserId: string,
  ): Promise<CodegenSessionResponseDto> {
    const baseClarificationState = this.readClarificationState(session.clarificationState)
    const inferredSemanticClarificationAnswers = this.inferFreeformSemanticClarificationAnswers(
      baseClarificationState,
      dto.message,
      dto.clarificationAnswers,
    )
    const effectiveClarificationAnswers = Object.keys(inferredSemanticClarificationAnswers).length > 0
      ? inferredSemanticClarificationAnswers
      : dto.clarificationAnswers
    const persistedChecklist = this.readChecklist(session.checklist)
    const hasPersistedSemanticState = this.hasPersistedSemanticState(session.semanticState)
    const currentSemanticState = this.readSemanticState(
      session.semanticState,
      persistedChecklist,
    )
    const semanticStateAfterAnswers = this.applySemanticClarificationAnswers(
      currentSemanticState,
      baseClarificationState,
      effectiveClarificationAnswers,
    )
    const baseChecklist = this.applyClarificationAnswers(
      hasPersistedSemanticState
        ? this.projectLegacyChecklistFromSemanticState(semanticStateAfterAnswers, persistedChecklist)
        : persistedChecklist,
      baseClarificationState,
      effectiveClarificationAnswers,
    )
    const messageChecklist = this.normalizeChecklist(this.extractChecklist(dto))
    const mergedChecklist = this.mergeChecklistSnapshots(baseChecklist, messageChecklist)
    const derivedSemanticState = this.buildFallbackSemanticState(mergedChecklist)
    const reducedSemanticState = hasPersistedSemanticState
      ? this.semanticStateMerge.merge({
          persisted: semanticStateAfterAnswers,
          derived: derivedSemanticState,
        })
      : derivedSemanticState
    const canonicalChecklist = hasPersistedSemanticState
      ? this.projectLegacyChecklistFromSemanticState(reducedSemanticState, mergedChecklist)
      : mergedChecklist
    const clarification = this.resolveClarificationArtifacts(canonicalChecklist)
    const clarificationState = this.mergeSemanticClarificationState(
      reducedSemanticState,
      clarification.clarificationState,
    )
    const semanticReadyForGenerate = hasPersistedSemanticState
      && this.findNextOpenSemanticSlot(reducedSemanticState) === null
    const clarificationPrompt = this.buildSemanticClarificationPrompt(reducedSemanticState)
      || this.clarificationQuestion.build(clarificationState)
      || clarification.clarificationPrompt
    const constraintPack = this.readConstraintPack(session.constraintPack)
    const historyAfterConfirm = this.appendConversationHistory(
      constraintPack.conversationHistory ?? [],
      dto.message,
    )

    if (clarificationState.status === 'NEEDS_CLARIFICATION' && !semanticReadyForGenerate) {
      const assistantPrompt = clarificationPrompt || '请先澄清这条规则，我再继续完善逻辑图。'
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: canonicalChecklist,
        semanticState: reducedSemanticState,
        clarificationState,
        constraintPack: {
          ...constraintPack,
          conversationHistory: historyAfterConfirm,
        },
      }))

      const response = this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt,
        clarificationState,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    const normalization = hasPersistedSemanticState
      ? this.buildNormalizationFromSemanticState(reducedSemanticState)
      : clarification.normalization
    const canonicalSpec = this.buildCanonicalSpecForConversation(canonicalChecklist, normalization)
    const specDesc = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: normalization.normalizedIntent,
      executionContext: clarification.executionContext.context,
    })
    const canonicalDigest = this.readCanonicalDigest(specDesc)
    const compileability = this.evaluateCanonicalCompileability(canonicalSpec)
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

    const missingFields = this.resolveChecklistMissingFields(canonicalChecklist)
    if (missingFields.length > 0) {
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: canonicalChecklist,
        semanticState: reducedSemanticState,
        clarificationState,
        constraintPack: {
          ...constraintPack,
          conversationHistory: historyAfterConfirm,
        },
        latestSpecDesc: specDesc,
      }))

      const response = this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields,
        assistantPrompt: '请先补全入场和出场规则，再确认生成代码。',
        clarificationState,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    if (normalization.blocked && !semanticReadyForGenerate) {
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: canonicalChecklist,
        semanticState: reducedSemanticState,
        clarificationState,
        constraintPack: {
          ...constraintPack,
          conversationHistory: historyAfterConfirm,
        },
        latestSpecDesc: specDesc,
      }))

      const response = this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: this.buildNormalizationAssistantPrompt(canonicalChecklist, normalization),
        clarificationState,
        specDesc,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    if (!compileability.canCompile && !semanticReadyForGenerate) {
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: canonicalChecklist,
        semanticState: reducedSemanticState,
        clarificationState,
        constraintPack: {
          ...constraintPack,
          conversationHistory: historyAfterConfirm,
        },
      }))

      const response = this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: this.buildCompileabilityAssistantPrompt(compileability),
        clarificationState,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    const markGeneratingInput = this.stateMachine.buildGeneratingUpdate({
      checklist: canonicalChecklist,
      semanticState: reducedSemanticState,
      clarificationState,
      constraintPack: {
        ...constraintPack,
        conversationHistory: historyAfterConfirm,
      },
      latestSpecDesc: specDesc,
    })

    const markedGenerating = this.stateMachine.shouldTryRequeue(session.status)
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
      return this.returnPersistedSnapshotResponse(latest, sessionUserId)
    }

    void this.publicationPipeline.run({
      sessionId: session.id,
      userId: sessionUserId,
      checklist: canonicalChecklist,
      semanticState: reducedSemanticState,
      message: dto.message,
      model: dto.model,
      existingStrategyInstanceId: session.strategyInstanceId ?? null,
    })

    const response = this.finalizeSessionResponse({
      id: session.id,
      status: 'GENERATING',
      missingFields: [],
      clarificationState,
    })
    return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
  }

  private readChecklist(payload: Prisma.JsonValue | null): ChecklistPayload {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {}
    }

    return this.normalizeChecklist(payload as Record<string, unknown>)
  }

  private readSemanticState(
    payload: Prisma.JsonValue | null | undefined,
    fallbackChecklist: ChecklistPayload,
  ): SemanticState {
    if (this.hasPersistedSemanticState(payload)) {
      return payload as unknown as SemanticState
    }

    return this.buildFallbackSemanticState(fallbackChecklist)
  }

  private hasPersistedSemanticState(
    payload: Prisma.JsonValue | null | undefined,
  ): payload is Prisma.JsonValue & SemanticState {
    return Boolean(
      payload
      && typeof payload === 'object'
      && !Array.isArray(payload)
      && (payload as { version?: unknown }).version === 1
      && Array.isArray((payload as { triggers?: unknown }).triggers)
      && Array.isArray((payload as { actions?: unknown }).actions)
      && Array.isArray((payload as { risk?: unknown }).risk),
    )
  }

  private applySemanticClarificationAnswers(
    currentState: SemanticState,
    clarificationState: StrategyClarificationState | null,
    answers?: Record<string, string>,
  ): SemanticState {
    if (!answers || Object.keys(answers).length === 0) {
      return currentState
    }

    let nextState = currentState
    for (const item of clarificationState?.items ?? []) {
      const rawAnswer = answers[item.key]
      if (
        typeof rawAnswer !== 'string'
        || !rawAnswer.trim()
        || (!item.key.startsWith('semantic.') && !item.key.startsWith('grid.'))
      ) {
        continue
      }

      nextState = this.semanticStateReducer.applyClarificationAnswer({
        currentState: nextState,
        targetSlotKey: item.slotKey ?? item.key.replace(/^semantic\./u, ''),
        targetFieldPath: item.fieldPath,
        targetSlotId: item.slotId,
        answer: rawAnswer.trim(),
      })
    }

    return nextState
  }

  private buildFallbackSemanticState(checklist: ChecklistPayload): SemanticState {
    const normalization = this.intentNormalizer.normalize(checklist)
    const executionContext = this.executionContext.resolve(checklist)

    return {
      version: 1,
      families: [...normalization.normalizedIntent.families],
      triggers: [
        ...normalization.normalizedIntent.triggers.map((trigger, index) => this.toSemanticTriggerState(trigger, index)),
        ...(normalization.normalizedIntent.stateHints ?? []).map<SemanticTriggerState>((hint, index) => ({
          id: `gate-${index + 1}`,
          key: hint.type === 'regime' ? 'market.regime' : hint.type === 'trend' ? 'trend.direction' : 'volatility.state',
          phase: 'gate' as const,
          params: {
            value: hint.value,
            mode: hint.mode,
          },
          status: hint.closureStatus === 'closed' ? 'locked' : 'open',
          source: 'user_explicit' as const,
          ...(hint.evidenceText ? { evidence: { text: hint.evidenceText, source: 'user_explicit' as const } } : {}),
          openSlots: hint.unresolvedSlots.map(slot => this.toSemanticSlotState(slot)),
        })),
      ],
      actions: normalization.normalizedIntent.actions.map((action, index) => ({
        id: `action-${index + 1}`,
        key: action.key,
        ...(action.params ? { params: action.params as Record<string, unknown> } : {}),
        status: 'locked',
        source: 'user_explicit',
      })),
      risk: normalization.normalizedIntent.risk.map((risk, index) => ({
        id: `risk-${index + 1}`,
        key: risk.key,
        params: risk.params,
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      })),
      position: normalization.normalizedIntent.position
        ? {
            mode: normalization.normalizedIntent.position.mode,
            value: normalization.normalizedIntent.position.value,
            positionMode: normalization.normalizedIntent.position.positionMode,
            status: 'locked',
            source: 'user_explicit',
          }
        : null,
      contextSlots: {
        exchange: this.buildContextSlotState('exchange', executionContext.context.exchange, '请确认交易所（binance / okx / hyperliquid）。'),
        symbol: this.buildContextSlotState('symbol', executionContext.context.symbol, '请确认策略交易标的（例如 BTCUSDT）。'),
        marketType: this.buildContextSlotState('marketType', executionContext.context.marketType, '请确认市场类型（现货或合约/perp）。'),
        timeframe: this.buildContextSlotState('timeframe', executionContext.context.timeframe, '请确认策略主周期（例如 15m 或 1h）。'),
      },
      normalizationNotes: [...normalization.normalizedIntent.normalizationNotes],
      updatedAt: new Date().toISOString(),
    }
  }

  private toSemanticTriggerState(
    trigger: StrategyNormalizedIntent['triggers'][number],
    index: number,
  ): SemanticTriggerState {
    return {
      id: `${trigger.phase}-${index + 1}`,
      key: trigger.key,
      phase: trigger.phase,
      params: {
        ...trigger.params,
        ...(trigger.resolutionHints?.confirmation
          ? { confirmationMode: trigger.resolutionHints.confirmation }
          : {}),
      },
      ...(trigger.sideScope ? { sideScope: trigger.sideScope } : {}),
      status: trigger.closureStatus === 'closed' ? 'locked' : 'open',
      source: 'user_explicit',
      ...(trigger.evidenceText ? { evidence: { text: trigger.evidenceText, source: 'user_explicit' as const } } : {}),
      openSlots: trigger.unresolvedSlots.map(slot => this.toSemanticSlotState(slot)),
    }
  }

  private toSemanticSlotState(
    slot: StrategyNormalizedIntent['triggers'][number]['unresolvedSlots'][number],
  ): SemanticSlotState {
    return {
      slotKey: slot.slotKey,
      fieldPath: slot.fieldPath,
      status: 'open',
      priority: slot.priority,
      questionHint: slot.questionHint,
      affectsExecution: slot.affectsExecution,
      ...(slot.evidenceText ? { evidence: { text: slot.evidenceText, source: 'user_explicit' as const } } : {}),
    }
  }

  private buildContextSlotState(
    field: 'exchange' | 'symbol' | 'marketType' | 'timeframe',
    value: string | null,
    questionHint: string,
  ): SemanticSlotState | null {
    if (!value) {
      return {
        slotKey: field,
        fieldPath: `contextSlots.${field}`,
        status: 'open',
        priority: 'context',
        questionHint,
        affectsExecution: true,
      }
    }

    return {
      slotKey: field,
      fieldPath: `contextSlots.${field}`,
      value,
      status: 'locked',
      priority: 'context',
      questionHint,
      affectsExecution: true,
    }
  }

  private mergeSemanticClarificationState(
    semanticState: SemanticState,
    fallbackState: StrategyClarificationStateWithSummary,
  ): StrategyClarificationStateWithSummary {
    const clarificationView = this.semanticStateProjection.buildClarificationView(semanticState)
    const nextOpenSlot = this.findNextOpenSemanticSlot(semanticState)
    if (!clarificationView.nextQuestion || !nextOpenSlot) {
      const pendingFallbackItems = fallbackState.status === 'NEEDS_CLARIFICATION'
        ? fallbackState.items.filter(item => item.blocking && item.status === 'pending')
        : []
      const preservedFallbackItems = pendingFallbackItems.filter(item =>
        !this.isSemanticClarificationItem(item)
        && !this.isResolvedBySemanticState(item, semanticState),
      )
      if (preservedFallbackItems.length > 0) {
        return {
          status: 'NEEDS_CLARIFICATION',
          items: preservedFallbackItems,
          summary: fallbackState.summary || clarificationView.summary || null,
        }
      }

      return {
        status: 'CLEAR',
        items: [],
        summary: clarificationView.summary || fallbackState.summary || null,
      }
    }

    if (nextOpenSlot.priority !== 'context') {
      const semanticItems = this.listOpenSemanticSlots(semanticState)
        .filter(slot => slot.priority !== 'context')
        .map(slot => this.buildSemanticClarificationItem(slot))
      const semanticItemKeys = new Set(semanticItems.map(item => item.key))
      const semanticSlotIds = new Set(semanticItems.map(item => item.slotId).filter((slotId): slotId is string => typeof slotId === 'string'))
      const semanticFieldPaths = new Set(semanticItems.map(item => item.fieldPath).filter((fieldPath): fieldPath is string => typeof fieldPath === 'string'))
      const remainingPendingItems = fallbackState.status === 'NEEDS_CLARIFICATION'
        ? fallbackState.items.filter(item =>
            item.blocking
            && item.status === 'pending'
            && !semanticItemKeys.has(item.key)
            && (!item.slotId || !semanticSlotIds.has(item.slotId))
            && (!item.fieldPath || !semanticFieldPaths.has(item.fieldPath)),
          )
        : []
      const filteredPendingItems = remainingPendingItems.filter(item =>
        !this.hasEquivalentActiveSemanticGridItem(item, semanticItems),
      )

      return {
        status: 'NEEDS_CLARIFICATION',
        items: [...semanticItems, ...filteredPendingItems],
        summary: clarificationView.summary,
      }
    }

    const items = fallbackState.status === 'NEEDS_CLARIFICATION'
      ? [...fallbackState.items]
      : []
    const targetIndex = items.findIndex(item =>
      item.blocking
      && item.status === 'pending'
      && this.isSameClarificationQuestion(item.question, clarificationView.nextQuestion as string),
    )

    if (targetIndex > 0) {
      const [targetItem] = items.splice(targetIndex, 1)
      if (targetItem) {
        items.unshift(targetItem)
      }
    } else if (targetIndex < 0) {
      items.unshift(this.buildSemanticClarificationItem(nextOpenSlot))
    }

    return {
      status: 'NEEDS_CLARIFICATION',
      items,
      summary: clarificationView.summary,
    }
  }

  private isResolvedBySemanticState(
    item: StrategyClarificationItem,
    semanticState: SemanticState,
  ): boolean {
    if (item.reason === 'missing_entry_rules' || item.field === 'entryRules') {
      return semanticState.triggers.some(trigger =>
        trigger.phase === 'entry'
        && trigger.status === 'locked'
        && trigger.openSlots.every(slot => slot.status !== 'open'),
      )
    }

    if (item.reason === 'missing_exit_rules' || item.field === 'exitRules') {
      return semanticState.triggers.some(trigger =>
        trigger.phase === 'exit'
        && trigger.status === 'locked'
        && trigger.openSlots.every(slot => slot.status !== 'open'),
      )
    }

    if (item.reason !== 'ambiguous_state_gate') {
      return false
    }

    return semanticState.triggers.some(trigger =>
      trigger.phase === 'gate'
      && trigger.status === 'locked'
      && trigger.openSlots.every(slot => slot.status !== 'open'),
    )
  }

  private findNextOpenSemanticSlot(state: SemanticState): SemanticSlotState | null {
    const triggerPhaseOrder: Array<'entry' | 'exit' | 'risk' | 'gate'> = ['entry', 'exit', 'risk', 'gate']
    const openTriggerSlots = triggerPhaseOrder.flatMap(phase =>
      state.triggers
        .filter(trigger => trigger.phase === phase)
        .flatMap(trigger => trigger.openSlots)
        .filter(slot => slot.status === 'open'),
    )
    const behaviorTriggerSlot = openTriggerSlots.find(slot =>
      slot.priority === 'behavior' || slot.slotKey === 'regimeDefinition',
    )
    if (behaviorTriggerSlot) {
      return behaviorTriggerSlot
    }

    const triggerSlot = openTriggerSlots[0] ?? null
    if (triggerSlot) {
      return triggerSlot
    }

    const riskSlot = state.risk.flatMap(risk => risk.openSlots).find(slot => slot.status === 'open')
    if (riskSlot) {
      return riskSlot
    }

    return Object.values(state.contextSlots).find(slot => slot?.status === 'open') ?? null
  }

  private buildSemanticClarificationItem(slot: SemanticSlotState): StrategyClarificationItem {
    const isStateGateSlot = slot.priority === 'behavior' || slot.slotKey === 'regimeDefinition'
    const isContextSlot = slot.priority === 'context'
    const isGridSlot = slot.slotKey.startsWith('grid.')
    const contextReasonMap: Partial<Record<SemanticSlotState['slotKey'], string>> = {
      exchange: 'missing_exchange',
      symbol: 'missing_symbol',
      marketType: 'missing_market_type',
      timeframe: 'missing_timeframe',
    }
    const field = isStateGateSlot
      ? 'stateGates.marketRegime'
      : isContextSlot
        ? slot.slotKey
      : isGridSlot
        ? slot.slotKey
      : (slot.slotKey.includes('.exit') ? 'exitRules' : 'entryRules')
    const reason = isStateGateSlot
      ? 'ambiguous_state_gate'
      : isContextSlot
        ? (contextReasonMap[slot.slotKey] ?? 'missing_execution_context')
      : isGridSlot
        ? 'grid_params_missing'
        : (slot.slotKey.includes('.exit') ? 'missing_exit_rules' : 'missing_entry_rules')

    return {
      key: isGridSlot ? slot.slotKey : `semantic.${slot.slotKey}`,
      reason,
      field,
      blocking: true,
      question: slot.questionHint,
      status: 'pending',
      slotId: buildSemanticSlotId(slot),
      slotKey: slot.slotKey,
      fieldPath: slot.fieldPath,
    }
  }

  private buildSemanticClarificationPrompt(state: SemanticState): string | null {
    const clarificationView = this.semanticStateProjection.buildClarificationView(state)
    const nextOpenSlot = this.findNextOpenSemanticSlot(state)
    if (!clarificationView.nextQuestion || !nextOpenSlot) {
      return null
    }

    return this.clarificationQuestion.build({
      status: 'NEEDS_CLARIFICATION',
      items: [this.buildSemanticClarificationItem(nextOpenSlot)],
      summary: clarificationView.summary,
    })
  }

  private listOpenSemanticSlots(state: SemanticState): SemanticSlotState[] {
    const triggerPhaseOrder: Array<'entry' | 'exit' | 'risk' | 'gate'> = ['entry', 'exit', 'risk', 'gate']
    const openTriggerSlots = triggerPhaseOrder.flatMap(phase =>
      state.triggers
        .filter(trigger => trigger.phase === phase)
        .flatMap(trigger => trigger.openSlots)
        .filter(slot => slot.status === 'open'),
    )
    const openRiskSlots = state.risk
      .flatMap(risk => risk.openSlots)
      .filter(slot => slot.status === 'open')
    const openContextSlots = Object.values(state.contextSlots)
      .filter((slot): slot is SemanticSlotState => Boolean(slot) && slot.status === 'open')

    return [...openTriggerSlots, ...openRiskSlots, ...openContextSlots]
  }

  private projectLegacyChecklistFromSemanticState(
    state: SemanticState,
    fallbackChecklist: ChecklistPayload,
  ): ChecklistPayload {
    const semanticChecklist = this.semanticStateCompileBridge.buildLegacyChecklist(state, {
      ...fallbackChecklist,
      riskRules: fallbackChecklist.riskRules ? { ...fallbackChecklist.riskRules } : undefined,
      stateGates: fallbackChecklist.stateGates ? { ...fallbackChecklist.stateGates } : undefined,
    })

    return this.normalizeChecklist({
      ...fallbackChecklist,
      ...semanticChecklist,
      entryRules: this.mergeProjectedRuleArrays(fallbackChecklist.entryRules, semanticChecklist.entryRules, 'entry'),
      exitRules: this.mergeProjectedRuleArrays(fallbackChecklist.exitRules, semanticChecklist.exitRules, 'exit'),
      riskRules: semanticChecklist.riskRules ?? fallbackChecklist.riskRules,
      stateGates: semanticChecklist.stateGates ?? fallbackChecklist.stateGates,
      entryRuleDrafts: semanticChecklist.entryRuleDrafts ?? fallbackChecklist.entryRuleDrafts,
      exitRuleDrafts: semanticChecklist.exitRuleDrafts ?? fallbackChecklist.exitRuleDrafts,
    })
  }

  private mergeProjectedRuleArrays(
    fallbackRules: string[] | undefined,
    projectedRules: string[] | undefined,
    phase: 'entry' | 'exit',
  ): string[] | undefined {
    if (!projectedRules || projectedRules.length === 0) {
      return fallbackRules
    }
    if (!fallbackRules || fallbackRules.length === 0) {
      return projectedRules
    }

    const hasProjectedSpecificRule = projectedRules.some(rule => !this.isGenericChecklistPlaceholderRule(rule, phase))
    const preservedFallbackRules = fallbackRules.filter(rule => (
      !this.isSemanticProjectableRule(rule)
      && !(hasProjectedSpecificRule && this.isGenericChecklistPlaceholderRule(rule, phase))
    ))
    const merged = [...preservedFallbackRules]
    for (const projectedRule of projectedRules) {
      if (!merged.includes(projectedRule)) {
        merged.push(projectedRule)
      }
    }

    return merged
  }

  private isSemanticProjectableRule(rule: string): boolean {
    const text = rule.trim()
    if (!text) {
      return false
    }

    return (
      (/均线|\bma\b|\bsma\b|\bema\b/iu.test(text) && (/突破|跌破|金叉|死叉/u.test(text)))
      || /布林带|上轨|下轨|中轨/u.test(text)
    )
  }

  private isSemanticClarificationItem(
    item: StrategyClarificationItem,
  ): boolean {
    return Boolean(item.slotId || item.slotKey || item.fieldPath || item.key.startsWith('semantic.'))
  }

  private hasEquivalentActiveSemanticGridItem(
    fallbackItem: StrategyClarificationItem,
    semanticItems: StrategyClarificationItem[],
  ): boolean {
    const fallbackGridSlotKey = this.toCanonicalGridClarificationSlotKey(fallbackItem)
    if (!fallbackGridSlotKey) {
      return false
    }

    return semanticItems.some(item =>
      this.toCanonicalGridClarificationSlotKey(item) === fallbackGridSlotKey,
    )
  }

  private toCanonicalGridClarificationSlotKey(
    item: StrategyClarificationItem,
  ): 'grid.range.lower' | 'grid.range.upper' | 'grid.stepPct' | 'grid.sideMode' | null {
    if (item.key === 'grid.range.lower' || item.key === 'grid.lower') {
      return 'grid.range.lower'
    }
    if (item.key === 'grid.range.upper' || item.key === 'grid.upper') {
      return 'grid.range.upper'
    }
    if (item.key === 'grid.stepPct') {
      return 'grid.stepPct'
    }
    if (item.key === 'grid.sideMode') {
      return 'grid.sideMode'
    }

    if (item.slotKey === 'grid.range.lower') return 'grid.range.lower'
    if (item.slotKey === 'grid.range.upper') return 'grid.range.upper'
    if (item.slotKey === 'grid.stepPct') return 'grid.stepPct'
    if (item.slotKey === 'grid.sideMode') return 'grid.sideMode'

    if (item.field === 'grid.lower') return 'grid.range.lower'
    if (item.field === 'grid.upper') return 'grid.range.upper'
    if (item.field === 'grid.stepPct') return 'grid.stepPct'
    if (item.field === 'grid.sideMode') return 'grid.sideMode'

    return null
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
    constraintPack?: Prisma.JsonValue | null
    rejectReason: string | null
    createdAt: Date
    updatedAt: Date
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
    const constraintPack = this.readConstraintPack(session.constraintPack ?? null)
    const conversationMessages = this.toConversationMessages(constraintPack.conversationHistory)
    const conversationTitle = this.deriveConversationTitle(conversationMessages)
    const effectivePublishedSnapshotId = latestSnapshot?.id ?? sessionPublishedSnapshotId ?? null
    const publishedSnapshotProjection = this.buildPublishedSnapshotProjection({
      publishedSnapshotId: effectivePublishedSnapshotId,
      snapshot: latestSnapshot,
    })

    return this.finalizeSessionResponse({
      id: session.id,
      conversationTitle,
      conversationMessages,
      status: session.status,
      missingFields: [],
      createdAt: session.createdAt instanceof Date ? session.createdAt.toISOString() : undefined,
      updatedAt: session.updatedAt instanceof Date ? session.updatedAt.toISOString() : undefined,
      scriptCode: typeof session.latestDraftCode === 'string' ? session.latestDraftCode : null,
      publishedSnapshotId: effectivePublishedSnapshotId,
      publishedSnapshotParamValues: this.buildPublishedSnapshotParamValues(latestSnapshot),
      ...publishedSnapshotProjection,
      consistencyReport: latestSnapshot?.consistencyReport && typeof latestSnapshot.consistencyReport === 'object' && !Array.isArray(latestSnapshot.consistencyReport)
        ? latestSnapshot.consistencyReport as Record<string, unknown>
        : (sessionConsistencyReport && typeof sessionConsistencyReport === 'object' && !Array.isArray(sessionConsistencyReport)
            ? sessionConsistencyReport as Record<string, unknown>
            : null),
      specDesc: sessionSpecDesc,
      canonicalDigest: this.readCanonicalDigest(sessionSpecDesc),
      strategyInstanceId: session.strategyInstanceId ?? null,
      clarificationState: this.readClarificationState(session.clarificationState),
      publicationGate:
        this.readPublicationGate(sessionSpecDesc?.publicationGate)
        ?? this.readPublicationGate(latestSnapshot?.consistencyReport)
        ?? this.readPublicationGate(sessionConsistencyReport),
      rejectReason: session.rejectReason,
    })
  }

  private async toConversationResponse(
    conversation: AiQuantConversationSnapshotRecord,
  ): Promise<AiQuantConversationResponseDto> {
    const session = await this.sessionsRepo.findById(conversation.codegenSessionId)
    const snapshot = session ? await this.toSessionSnapshotResponse(session) : null
    return {
      id: conversation.id,
      activeCodegenSessionId: session && !this.stateMachine.isTerminalStatus(session.status) ? session.id : null,
      conversationTitle: conversation.title,
      conversationMessages: conversation.messages,
      status: snapshot?.status as LlmCodegenSessionStatus | undefined,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      canonicalDigest: snapshot?.canonicalDigest ?? null,
      specDesc: snapshot?.specDesc ?? null,
      semanticGraph: snapshot?.semanticGraph ?? null,
      validationReport: snapshot?.validationReport ?? null,
      clarificationGate: snapshot?.clarificationGate ?? null,
      publicationGate: snapshot?.publicationGate ?? null,
      scriptCode: snapshot?.scriptCode ?? null,
      publishedSnapshotId: snapshot?.publishedSnapshotId ?? null,
      publishedSnapshotParamValues: snapshot?.publishedSnapshotParamValues ?? null,
      publishedSnapshotStrategyConfig: snapshot?.publishedSnapshotStrategyConfig ?? null,
      publishedSnapshotBacktestConfigDefaults: snapshot?.publishedSnapshotBacktestConfigDefaults ?? null,
      publishedSnapshotDeploymentExecutionDefaults: snapshot?.publishedSnapshotDeploymentExecutionDefaults ?? null,
      publishedSnapshotDeploymentExecutionConstraints: snapshot?.publishedSnapshotDeploymentExecutionConstraints ?? null,
      publishedSnapshotCompatibilityMetadata: snapshot?.publishedSnapshotCompatibilityMetadata ?? null,
      strategyInstanceId: snapshot?.strategyInstanceId ?? null,
      rejectReason: snapshot?.rejectReason ?? null,
    }
  }

  private finalizeSessionResponse(
    response: Omit<CodegenSessionResponseDto, 'clarificationGate'> & {
      clarificationGate?: CodegenSessionResponseDto['clarificationGate']
    },
  ): CodegenSessionResponseDto {
    const clarificationGate = response.clarificationGate ?? this.buildClarificationGate(
      response.clarificationState as StrategyClarificationStateWithSummary | null | undefined,
      response.assistantPrompt,
    )

    return responseMapperHelper.finalizeSessionResponse(
      {
        ...response,
        clarificationGate,
      },
      clarificationState => this.buildClarificationGate(
        clarificationState as StrategyClarificationStateWithSummary | null | undefined,
      ),
    )
  }

  private toConversationMessages(
    history: string[] | undefined,
  ): ConversationMessage[] {
    return conversationContextHelper.toConversationMessages(history)
  }

  private deriveConversationTitle(
    messages: ConversationMessage[],
  ): string {
    return conversationContextHelper.deriveConversationTitle(messages)
  }

  private buildClarificationGate(
    clarificationState?: StrategyClarificationStateWithSummary | null,
    assistantPrompt?: string | null,
  ): CodegenSessionResponseDto['clarificationGate'] {
    const alignedClarificationState = this.alignClarificationStateWithAskedQuestion(
      clarificationState,
      assistantPrompt,
    )
    const pendingItems = alignedClarificationState?.status === 'NEEDS_CLARIFICATION'
      ? alignedClarificationState.items.filter(item => item.blocking && item.status === 'pending')
      : []

    return {
      blocked: pendingItems.length > 0,
      summary: pendingItems.length > 0
        ? this.normalizeClarificationSummary(alignedClarificationState?.summary)
        : null,
      items: pendingItems,
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
    const normalizedAnswer = answer.trim()
    if (!normalizedAnswer) return checklist

    if (item.key.startsWith('semantic.') || item.key.startsWith('grid.')) {
      return this.applySemanticSlotClarification(checklist, item, normalizedAnswer)
    }

    if (item.key.startsWith('entry.side.') || item.key.startsWith('entry.action_uniqueness.')) {
      return this.applyEntryRuleDirectionClarification(checklist, item, normalizedAnswer)
    }

    if (item.key === 'entry.rules' || item.field === 'entryRules') {
      return this.normalizeChecklist({
        ...checklist,
        entryRules: [...(checklist.entryRules ?? []), normalizedAnswer],
      })
    }

    if (item.key === 'exit.rules' || item.field === 'exitRules') {
      return this.normalizeChecklist({
        ...checklist,
        exitRules: [...(checklist.exitRules ?? []), normalizedAnswer],
      })
    }

    if (item.key === 'risk.stopLoss.rule' || item.field === 'riskRules.stopLossPct') {
      const parsedPct = this.normalizePositionPctClarificationAnswer(normalizedAnswer)
      return this.normalizeChecklist({
        ...checklist,
        riskRules: {
          ...(checklist.riskRules ?? {}),
          stopLoss: normalizedAnswer,
          ...(parsedPct !== null ? { stopLossPct: parsedPct } : {}),
        },
      })
    }

    if (item.key === 'risk.takeProfit.rule' || item.field === 'riskRules.takeProfitPct') {
      const parsedPct = this.normalizePositionPctClarificationAnswer(normalizedAnswer)
      return this.normalizeChecklist({
        ...checklist,
        riskRules: {
          ...(checklist.riskRules ?? {}),
          takeProfit: normalizedAnswer,
          ...(parsedPct !== null ? { takeProfitPct: parsedPct } : {}),
        },
      })
    }

    if (item.key === 'market.symbol' || item.field === 'symbol') {
      const symbol = normalizePublishedSymbol(normalizedAnswer)
      return this.normalizeChecklist({
        ...checklist,
        symbols: symbol ? [symbol] : checklist.symbols,
        riskRules: this.clearMarketScopeConflicts(checklist.riskRules, 'symbol'),
      })
    }

    if (item.key === 'market.timeframe' || item.field === 'timeframe') {
      const timeframe = normalizedAnswer
      return this.normalizeChecklist({
        ...checklist,
        timeframes: timeframe ? [timeframe] : checklist.timeframes,
        riskRules: this.clearMarketScopeConflicts(checklist.riskRules, 'timeframe'),
      })
    }

    if (item.key === 'market.exchange' || item.field === 'exchange') {
      const exchange = this.normalizeExchangeClarificationAnswer(normalizedAnswer)
      if (!exchange) return checklist
      return this.normalizeChecklist({
        ...checklist,
        riskRules: {
          ...this.clearMarketScopeConflicts(checklist.riskRules, 'exchange'),
          exchange,
        },
      })
    }

    if (item.key === 'market.marketType' || item.field === 'marketType') {
      const marketType = this.normalizeMarketTypeClarificationAnswer(normalizedAnswer)
      if (!marketType) return checklist
      return this.normalizeChecklist({
        ...checklist,
        riskRules: {
          ...this.clearMarketScopeConflicts(checklist.riskRules, 'marketType'),
          marketType,
        },
      })
    }

    if (item.key === 'sizing.positionPct' || item.field === 'riskRules.positionPct') {
      const positionPct = this.normalizePositionPctClarificationAnswer(normalizedAnswer)
      if (positionPct === null) return checklist
      return this.normalizeChecklist({
        ...checklist,
        riskRules: {
          ...(checklist.riskRules ?? {}),
          positionPct,
        },
      })
    }

    if (item.reason === 'atomic_semantic_fork' || item.field === 'trigger.confirmation') {
      return this.applyTriggerConfirmationClarification(checklist, item, normalizedAnswer)
    }

    if (item.reason === 'ambiguous_condition_basis') {
      const basis = this.normalizeBasisClarificationAnswer(normalizedAnswer)
      if (!basis) return checklist

      if (item.field === 'entryRules.basis') {
        const ruleIndex = this.readClarificationRuleIndex(item)
        if (ruleIndex === null) return checklist
        return this.normalizeChecklist({
          ...checklist,
          entryRuleBases: {
            ...(checklist.entryRuleBases ?? {}),
            [`entry-${ruleIndex + 1}`]: basis,
          },
        })
      }

      if (item.field === 'exitRules.basis') {
        const ruleIndex = this.readClarificationRuleIndex(item)
        if (ruleIndex === null) return checklist
        const ruleText = checklist.exitRules?.[ruleIndex] ?? ''
        return this.normalizeChecklist({
          ...checklist,
          exitRuleBases: {
            ...(checklist.exitRuleBases ?? {}),
            [`exit-${ruleIndex + 1}`]: basis,
          },
          riskRules: {
            ...(checklist.riskRules ?? {}),
            ...(/止损|亏损/u.test(ruleText) ? { stopLossBasis: basis } : {}),
            ...(/止盈|盈利|收益率/u.test(ruleText) ? { takeProfitBasis: basis } : {}),
          },
        })
      }

      if (item.field === 'riskRules.stopLossBasis') {
        return this.normalizeChecklist({
          ...checklist,
          riskRules: {
            ...(checklist.riskRules ?? {}),
            stopLossBasis: basis,
          },
        })
      }

      if (item.field === 'riskRules.takeProfitBasis') {
        return this.normalizeChecklist({
          ...checklist,
          riskRules: {
            ...(checklist.riskRules ?? {}),
            takeProfitBasis: basis,
          },
        })
      }

      if (item.field === 'riskRules.maxDrawdownBasis') {
        return this.normalizeChecklist({
          ...checklist,
          riskRules: {
            ...(checklist.riskRules ?? {}),
            maxDrawdownBasis: basis,
          },
        })
      }
    }

    if (item.key === 'riskRules.earlyStop.action' || item.field === 'riskRules.earlyStop.action') {
      const action = this.normalizeEarlyStopClarificationAnswer(normalizedAnswer)
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

  private applySemanticSlotClarification(
    checklist: ChecklistPayload,
    item: StrategyClarificationItem,
    answer: string,
  ): ChecklistPayload {
    const key = item.key.toLowerCase()
    const targetPhase = this.readSemanticClarificationPhase(item)

    if (key.startsWith('grid.')) {
      const nextGrid = this.applyGridChecklistClarification(checklist.grid, item, answer)
      if (!nextGrid) {
        return checklist
      }

      return this.normalizeChecklist({
        ...checklist,
        grid: nextGrid,
      })
    }

    if (/均线是多少/u.test(item.question) || key.includes('reference.period')) {
      const period = this.normalizeMovingAveragePeriodClarificationAnswer(answer)
      if (period === null) return checklist

      if (!targetPhase) return checklist

      const isLongTerm = /长期均线/u.test(item.question)
      const targetRules = targetPhase === 'entry' ? checklist.entryRules : checklist.exitRules
      if (!targetRules || targetRules.length === 0) return checklist

      const nextRules = targetRules.map((rule) => {
        const normalized = rule.trim()
        if (!normalized) return rule
        if (isLongTerm && !/长期均线/u.test(normalized)) return normalized
        if (!isLongTerm && !/短期均线/u.test(normalized)) return normalized
        return normalized.replace(
          isLongTerm ? /长期均线/u : /短期均线/u,
          `${isLongTerm ? '长期均线' : '短期均线'}（${period}）`,
        )
      })

      return this.normalizeChecklist(targetPhase === 'entry'
        ? { ...checklist, entryRules: nextRules }
        : { ...checklist, exitRules: nextRules })
    }

    if (/按收盘确认还是盘中触发/u.test(item.question) || key.includes('confirmationmode')) {
      const confirmation = this.normalizeSemanticTriggerConfirmationAnswer(answer)
      if (!confirmation) return checklist

      if (!targetPhase) return checklist

      const targetRules = targetPhase === 'entry' ? checklist.entryRules : checklist.exitRules
      if (!targetRules || targetRules.length === 0) return checklist

      const nextRules = targetRules.map((rule) => {
        const normalized = rule.trim()
        if (!normalized) return rule
        const stripped = normalized
          .replace(/收盘确认/gu, '')
          .replace(/盘中/gu, '')
          .trim()
        return confirmation === 'close_confirm'
          ? `收盘确认${stripped}`
          : `盘中${stripped}`
      })

      return this.normalizeChecklist(targetPhase === 'entry'
        ? { ...checklist, entryRules: nextRules }
        : { ...checklist, exitRules: nextRules })
    }

    return checklist
  }

  private applyGridChecklistClarification(
    currentGrid: ChecklistPayload['grid'] | undefined,
    item: StrategyClarificationItem,
    answer: string,
  ): ChecklistPayload['grid'] | null {
    const nextGrid: NonNullable<ChecklistPayload['grid']> = {
      ...(currentGrid ?? {}),
    }
    const key = item.key.toLowerCase()

    if (key === 'grid.range.lower' || key === 'grid.lower') {
      const value = this.parseGridChecklistNumericAnswer('grid.range.lower', answer)
      if (value === null) return null
      nextGrid.lower = value
      return nextGrid
    }

    if (key === 'grid.range.upper' || key === 'grid.upper') {
      const value = this.parseGridChecklistNumericAnswer('grid.range.upper', answer)
      if (value === null) return null
      nextGrid.upper = value
      return nextGrid
    }

    if (key === 'grid.steppct') {
      const value = this.parseGridChecklistNumericAnswer('grid.stepPct', answer)
      if (value === null) return null
      nextGrid.stepPct = value
      return nextGrid
    }

    if (key === 'grid.sidemode') {
      const sideMode = this.normalizeGridChecklistSideMode(answer)
      if (!sideMode) return null
      nextGrid.sideMode = sideMode
      return nextGrid
    }

    return null
  }

  private parseGridChecklistNumericAnswer(
    slotKey: 'grid.range.lower' | 'grid.range.upper' | 'grid.stepPct',
    answer: string,
  ): number | null {
    if (slotKey === 'grid.stepPct') {
      const percentMatch = answer.match(/(\d+(?:\.\d+)?)\s*%/u)
      if (percentMatch?.[1]) {
        return Number(percentMatch[1])
      }

      const perMilleMatch = answer.match(/千分之\s*(\d+(?:\.\d+)?)/u)
      if (perMilleMatch?.[1]) {
        return Number(perMilleMatch[1]) / 10
      }
    }

    const numericMatch = answer.match(/-?\d+(?:\.\d+)?/u)
    if (!numericMatch) {
      return null
    }

    const value = Number(numericMatch[0])
    return Number.isFinite(value) ? value : null
  }

  private normalizeGridChecklistSideMode(
    answer: string,
  ): NonNullable<ChecklistPayload['grid']>['sideMode'] | null {
    if (/双向|低买高卖|来回|往返|自动买卖|自动交易/u.test(answer)) {
      return 'bidirectional'
    }
    if (/只做多|仅做多/u.test(answer)) {
      return 'long_only'
    }
    if (/只做空|仅做空/u.test(answer)) {
      return 'short_only'
    }

    return null
  }

  private applyEntryRuleDirectionClarification(
    checklist: ChecklistPayload,
    item: StrategyClarificationItem,
    answer: string,
  ): ChecklistPayload {
    const direction = this.normalizeDirectionClarificationAnswer(answer)
    const ruleIndex = this.readClarificationRuleIndex(item)
    if (!direction || ruleIndex === null || !checklist.entryRules || checklist.entryRules.length === 0) {
      return checklist
    }

    const actionText = direction === 'short' ? '做空' : '做多'
    const entryRules = checklist.entryRules.map((rule, index) => {
      const normalized = rule.trim()
      if (index !== ruleIndex) {
        return normalized || rule
      }
      if (!normalized) return rule
      if (/做多|多单|开多|long|买入/i.test(normalized) || /做空|空单|开空|short|卖出/i.test(normalized)) {
        return this.replaceRuleDirection(normalized, actionText)
      }
      return `${normalized}，${actionText}`
    })

    return this.normalizeChecklist({
      ...checklist,
      entryRules,
    })
  }

  private applyTriggerConfirmationClarification(
    checklist: ChecklistPayload,
    item: StrategyClarificationItem,
    answer: string,
  ): ChecklistPayload {
    const confirmation = this.normalizeTriggerConfirmationClarificationAnswer(answer)
    const ruleIndex = this.readClarificationRuleIndex(item)
    if (!confirmation || ruleIndex === null) {
      return checklist
    }

    const targetRules = item.ruleId?.startsWith('exit-')
      ? checklist.exitRules
      : checklist.entryRules
    if (!targetRules || targetRules.length === 0) {
      return checklist
    }

    const nextRules = targetRules.map((rule, index) => {
      const normalized = rule.trim()
      if (index !== ruleIndex || !normalized) {
        return normalized || rule
      }

      const stripped = normalized
        .replace(/触及/gu, '')
        .replace(/触碰/gu, '')
        .replace(/碰到/gu, '')
        .replace(/收盘后?确认?/gu, '')
        .replace(/k线收盘后?确认?/giu, '')
        .replace(/close\s*confirm/giu, '')
        .trim()

      return confirmation === 'touch'
        ? `触及${stripped}`
        : `收盘确认${stripped}`
    })

    return this.normalizeChecklist(item.ruleId?.startsWith('exit-')
      ? {
          ...checklist,
          exitRules: nextRules,
        }
      : {
          ...checklist,
          entryRules: nextRules,
        })
  }

  private replaceRuleDirection(rule: string, actionText: '做多' | '做空'): string {
    const replaced = rule
      .replace(/做多|多单|开多|long|买入/iu, actionText)
      .replace(/做空|空单|开空|short|卖出/iu, actionText)
      .replace(/做多和做多|做空和做空/u, actionText)
      .replace(/同时做多|同时做空/u, actionText)

    return replaced.trim()
  }

  private readClarificationRuleIndex(item: StrategyClarificationItem): number | null {
    const fromRuleId = item.ruleId?.match(/^entry-(\d+)$/u)?.[1]
    const fromKey = item.key.match(/\.(\d+)$/u)?.[1]
    const rawIndex = fromRuleId ?? fromKey
    if (!rawIndex) return null

    const parsed = Number.parseInt(rawIndex, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null
    }

    return parsed - 1
  }

  private clearMarketScopeConflicts(
    riskRules: ChecklistPayload['riskRules'],
    field: 'exchange' | 'marketType' | 'symbol' | 'timeframe',
  ): Record<string, unknown> {
    const next = { ...(riskRules ?? {}) }
    const rawConflicts = next._marketScopeConflicts
    if (!Array.isArray(rawConflicts)) {
      return next
    }

    const filtered = rawConflicts.filter((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false
      return (item as { field?: unknown }).field !== field
    })

    if (filtered.length > 0) {
      next._marketScopeConflicts = filtered
    } else {
      delete next._marketScopeConflicts
    }

    return next
  }

  private async continueWithStructuredClarificationAnswers(args: {
    session: {
      id: string
      status: LlmCodegenSessionStatus
    }
    checklist: ChecklistPayload
    semanticState: SemanticState
    useSemanticProjection: boolean
    clarificationState: StrategyClarificationState
    constraintPack: ReturnType<CodegenConversationService['readConstraintPack']>
    message: string
    userId: string
  }): Promise<CodegenSessionResponseDto> {
    const historyAfterAnswer = this.appendConversationHistory(
      args.constraintPack.conversationHistory ?? [],
      args.message,
    )
    const projectedChecklist = args.useSemanticProjection
      ? this.projectLegacyChecklistFromSemanticState(args.semanticState, args.checklist)
      : args.checklist
    const clarification = this.resolveClarificationArtifacts(projectedChecklist)
    const semanticClarificationState = this.mergeSemanticClarificationState(
      args.semanticState,
      clarification.clarificationState,
    )

    if (semanticClarificationState.status === 'NEEDS_CLARIFICATION') {
      const assistantPrompt = this.buildSemanticClarificationPrompt(args.semanticState)
        || this.clarificationQuestion.build(semanticClarificationState)
        || clarification.clarificationPrompt
        || '请先澄清这条规则，我再继续完善逻辑图。'
      await this.sessionsRepo.updateSession(args.session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: projectedChecklist,
        semanticState: args.semanticState,
        clarificationState: semanticClarificationState,
        constraintPack: {
          ...args.constraintPack,
          conversationHistory: historyAfterAnswer,
        },
      }))

      const response = this.finalizeSessionResponse({
        id: args.session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt,
        clarificationState: semanticClarificationState,
      })
      return this.returnPersistedSessionResponse(args.session.id, args.userId, response)
    }

    const normalization = this.buildNormalizationFromSemanticState(args.semanticState)
    const canonicalSpec = this.buildCanonicalSpecForConversation(projectedChecklist, normalization)
    const specDesc = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: normalization.normalizedIntent,
      executionContext: clarification.executionContext.context,
    })
    const canonicalDigest = this.readCanonicalDigest(specDesc)
    const compileability = this.evaluateCanonicalCompileability(canonicalSpec)
    const missingFields = this.resolveChecklistMissingFields(projectedChecklist)
    const decision = this.buildStrategyDecision({
      checklist: projectedChecklist,
      clarification,
      compileability,
      constraintPack: args.constraintPack,
    })

    if (missingFields.length > 0) {
      await this.sessionsRepo.updateSession(args.session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: projectedChecklist,
        semanticState: args.semanticState,
        clarificationState: clarification.clarificationState,
        constraintPack: {
          ...args.constraintPack,
          conversationHistory: historyAfterAnswer,
        },
        latestSpecDesc: specDesc,
      }))

      const response = this.finalizeSessionResponse({
        id: args.session.id,
        status: 'DRAFTING',
        missingFields,
        assistantPrompt: '请先补全入场和出场规则，再确认生成代码。',
        clarificationState: clarification.clarificationState,
      })
      return this.returnPersistedSessionResponse(args.session.id, args.userId, response)
    }

    if (decision.kind === 'CONFIRM_INFERRED') {
      const assistantPrompt = this.clarificationQuestion.buildFromDecision(decision)
      await this.sessionsRepo.updateSession(args.session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: projectedChecklist,
        semanticState: args.semanticState,
        clarificationState: clarification.clarificationState,
        constraintPack: {
          ...args.constraintPack,
          conversationHistory: historyAfterAnswer,
        },
        latestSpecDesc: specDesc,
      }))

      const response = this.finalizeSessionResponse({
        id: args.session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt,
        clarificationState: clarification.clarificationState,
        specDesc,
      })
      return this.returnPersistedSessionResponse(args.session.id, args.userId, response)
    }

    if (normalization.blocked) {
      await this.sessionsRepo.updateSession(args.session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: projectedChecklist,
        semanticState: args.semanticState,
        clarificationState: clarification.clarificationState,
        constraintPack: {
          ...args.constraintPack,
          conversationHistory: historyAfterAnswer,
        },
        latestSpecDesc: specDesc,
      }))

      const response = this.finalizeSessionResponse({
        id: args.session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: this.buildNormalizationAssistantPrompt(projectedChecklist, normalization),
        clarificationState: clarification.clarificationState,
        specDesc,
      })
      return this.returnPersistedSessionResponse(args.session.id, args.userId, response)
    }

    if (!compileability.canCompile) {
      await this.sessionsRepo.updateSession(args.session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        checklist: projectedChecklist,
        semanticState: args.semanticState,
        clarificationState: clarification.clarificationState,
        constraintPack: {
          ...args.constraintPack,
          conversationHistory: historyAfterAnswer,
        },
      }))

      const response = this.finalizeSessionResponse({
        id: args.session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: this.buildCompileabilityAssistantPrompt(compileability),
        clarificationState: clarification.clarificationState,
      })
      return this.returnPersistedSessionResponse(args.session.id, args.userId, response)
    }

    await this.sessionsRepo.updateSession(args.session.id, this.stateMachine.buildConversationUpdate({
      status: 'CHECKLIST_GATE',
      checklist: projectedChecklist,
      semanticState: args.semanticState,
      clarificationState: clarification.clarificationState,
      constraintPack: {
        ...args.constraintPack,
        conversationHistory: historyAfterAnswer,
      },
      latestSpecDesc: specDesc,
    }))

    const response = this.finalizeSessionResponse({
      id: args.session.id,
      status: 'CHECKLIST_GATE',
      missingFields: [],
      assistantPrompt: '逻辑图已更新。请确认逻辑图，确认后我再生成策略代码。',
      clarificationState: clarification.clarificationState,
      specDesc,
      canonicalDigest,
    })
    return this.returnPersistedSessionResponse(args.session.id, args.userId, response)
  }

  private async returnPersistedSnapshotResponse(
    session: {
      id: string
      userId: string
      status: LlmCodegenSessionStatus
      latestDraftCode: Prisma.JsonValue | null
      latestSpecDesc: Prisma.JsonValue | null
      constraintPack?: Prisma.JsonValue | null
      rejectReason: string | null
      createdAt: Date
      updatedAt: Date
      strategyInstanceId?: string | null
      clarificationState?: Prisma.JsonValue | null
    },
    userId: string,
  ): Promise<CodegenSessionResponseDto> {
    const response = await this.toSessionSnapshotResponse(session)
    return this.returnPersistedSessionResponse(session.id, userId, response)
  }

  private async returnPersistedSessionResponse(
    sessionId: string,
    userId: string,
    response: CodegenSessionResponseDto,
  ): Promise<CodegenSessionResponseDto> {
    await this.persistConversationProjectionForSessionId(sessionId, userId)
    const conversation = await this.conversationsRepo.findByCodegenSessionId(sessionId)
    return {
      ...response,
      conversationId: conversation?.id ?? response.conversationId ?? null,
    }
  }

  private async persistConversationProjectionForSessionId(
    sessionId: string,
    fallbackUserId?: string,
  ): Promise<void> {
    const session = await this.sessionsRepo.findById(sessionId)
    if (!session) {
      return
    }
    if (!(session.createdAt instanceof Date) || !(session.updatedAt instanceof Date)) {
      return
    }

    const snapshot = await this.toSessionSnapshotResponse(session)
    const messages = snapshot.conversationMessages ?? []
    const title = snapshot.conversationTitle?.trim() || this.deriveConversationTitle(messages)
    await this.conversationsRepo.upsertConversationSnapshot({
      userId: fallbackUserId ?? session.userId,
      codegenSessionId: session.id,
      title,
      messages,
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

  private normalizeTriggerConfirmationClarificationAnswer(
    answer: string,
  ): 'touch' | 'close_confirm' | null {
    const normalized = answer.trim().toLowerCase()
    if (!normalized) return null

    if (/触及|触碰|碰到|touch/u.test(normalized)) {
      return 'touch'
    }
    if (/收盘|确认|close/u.test(normalized)) {
      return 'close_confirm'
    }

    return null
  }

  private normalizePositionPctClarificationAnswer(answer: string): number | null {
    const normalized = answer.replace(/％/gu, '%')
    const match = normalized.match(/(\d+(?:\.\d+)?)\s*%?/u)
    if (!match?.[1]) return null

    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      return null
    }
    return value
  }

  private normalizeMovingAveragePeriodClarificationAnswer(answer: string): number | null {
    const normalized = answer.trim().toLowerCase()
    if (!normalized) return null

    const match = normalized.match(/(?:ma|ema|sma)?\s*(\d{1,4})/u)
    if (!match?.[1]) return null

    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0) {
      return null
    }

    return value
  }

  private normalizeSemanticTriggerConfirmationAnswer(
    answer: string,
  ): 'touch' | 'close_confirm' | null {
    const normalized = answer.trim().toLowerCase()
    if (!normalized) return null

    if (/盘中|即时|触发|touch/u.test(normalized)) {
      return 'touch'
    }
    if (/收盘|确认|close/u.test(normalized)) {
      return 'close_confirm'
    }

    return null
  }

  private normalizeBasisClarificationAnswer(answer: string): ChecklistRuleBasis['kind'] | null {
    const normalized = answer.trim().toLowerCase()
    if (!normalized) return null

    if (/上一根|上根|昨收|前收|prev/i.test(normalized)) return 'prev_close'
    if (/开仓均价|入场价|入场均价|开仓价|买入价|成本价|entry/i.test(normalized)) return 'entry_avg_price'
    if (/持仓.*(?:收益|盈亏|亏损|利润|浮盈|pnl)|position.*pnl/i.test(normalized)) return 'position_pnl'
    if (/账户净值峰值|净值峰值|资金曲线峰值|peak equity/i.test(normalized)) return 'peak_equity'
    if (/持仓浮盈峰值|浮盈峰值|peak position pnl/i.test(normalized)) return 'peak_position_pnl'
    if (/上轨|upper band/i.test(normalized)) return 'upper_band'
    if (/下轨|lower band/i.test(normalized)) return 'lower_band'
    if (/中轨|middle band/i.test(normalized)) return 'middle_band'
    if (/前高|last high/i.test(normalized)) return 'last_high'
    if (/前低|last low/i.test(normalized)) return 'last_low'

    return null
  }

  private inferFreeformSemanticClarificationAnswers(
    clarificationState: StrategyClarificationStateWithSummary | null,
    message: string | undefined,
    explicitAnswers?: Record<string, string>,
  ): Record<string, string> {
    if (explicitAnswers && Object.keys(explicitAnswers).length > 0) {
      return explicitAnswers
    }

    const normalizedMessage = message?.trim()
    if (!normalizedMessage) return {}
    if (!clarificationState || clarificationState.status !== 'NEEDS_CLARIFICATION') return {}

    const activeItem = clarificationState.items.find(item => item.blocking && item.status === 'pending')
    if (!activeItem || (!activeItem.key.startsWith('semantic.') && !activeItem.key.startsWith('grid.'))) return {}

    return {
      [activeItem.key]: normalizedMessage,
    }
  }

  private readSemanticClarificationPhase(
    item: StrategyClarificationItem,
  ): 'entry' | 'exit' | null {
    const key = item.key.toLowerCase()
    if (key.includes('.entry')) return 'entry'
    if (key.includes('.exit')) return 'exit'

    if (/长期均线/u.test(item.question) || /突破按收盘确认还是盘中触发/u.test(item.question)) {
      return 'entry'
    }
    if (/短期均线/u.test(item.question) || /跌破按收盘确认还是盘中触发/u.test(item.question)) {
      return 'exit'
    }

    return null
  }

  private alignClarificationStateWithAskedQuestion(
    clarificationState: StrategyClarificationStateWithSummary | null | undefined,
    assistantPrompt?: string | null,
  ): StrategyClarificationStateWithSummary | null | undefined {
    if (!clarificationState || clarificationState.status !== 'NEEDS_CLARIFICATION') {
      return clarificationState
    }

    const askedQuestion = this.extractAskedClarificationQuestion(assistantPrompt)
    if (!askedQuestion) {
      return clarificationState
    }

    const targetIndex = clarificationState.items.findIndex(item =>
      item.blocking
      && item.status === 'pending'
      && this.isSameClarificationQuestion(item.question, askedQuestion),
    )
    if (targetIndex <= 0) {
      return clarificationState
    }

    const items = [...clarificationState.items]
    const [targetItem] = items.splice(targetIndex, 1)
    if (!targetItem) {
      return clarificationState
    }
    items.unshift(targetItem)

    return {
      ...clarificationState,
      items,
    }
  }

  private extractAskedClarificationQuestion(
    assistantPrompt?: string | null,
  ): string | null {
    const lines = assistantPrompt
      ?.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
    if (!lines || lines.length === 0) {
      return null
    }

    const askedLine = [...lines].reverse().find(line => line.startsWith('请确认：'))
    if (!askedLine) {
      return null
    }

    return askedLine.slice('请确认：'.length).trim() || null
  }

  private isSameClarificationQuestion(
    left: string,
    right: string,
  ): boolean {
    return this.normalizeClarificationQuestion(left) === this.normalizeClarificationQuestion(right)
  }

  private normalizeClarificationQuestion(
    question: string,
  ): string {
    return question.trim().replace(/^[：:\s]+|[？?。！!\s]+$/gu, '')
  }

  private readClarificationState(payload: Prisma.JsonValue | null | undefined): StrategyClarificationStateWithSummary | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
    const rawStatus = (payload as { status?: unknown }).status
    const rawItems = (payload as { items?: unknown }).items
    const rawSummary = (payload as { summary?: unknown }).summary
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
      const priority = (rawItem as { priority?: unknown }).priority
      const evidenceKey = (rawItem as { evidenceKey?: unknown }).evidenceKey
      const slotId = (rawItem as { slotId?: unknown }).slotId
      const slotKey = (rawItem as { slotKey?: unknown }).slotKey
      const fieldPath = (rawItem as { fieldPath?: unknown }).fieldPath

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
      if (priority !== undefined && (!Number.isFinite(priority) || typeof priority !== 'number')) return null
      if (evidenceKey !== undefined && typeof evidenceKey !== 'string') return null
      if (slotId !== undefined && typeof slotId !== 'string') return null
      if (slotKey !== undefined && typeof slotKey !== 'string') return null
      if (fieldPath !== undefined && typeof fieldPath !== 'string') return null
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
        ...(typeof priority === 'number' ? { priority } : {}),
        ...(typeof evidenceKey === 'string' ? { evidenceKey } : {}),
        ...(typeof slotId === 'string' ? { slotId } : {}),
        ...(typeof slotKey === 'string' ? { slotKey } : {}),
        ...(typeof fieldPath === 'string' ? { fieldPath } : {}),
      })
    }

    return {
      status: rawStatus as StrategyClarificationState['status'],
      items: normalizedItems,
      ...(typeof rawSummary === 'string' && rawSummary.trim() ? { summary: rawSummary.trim() } : {}),
    }
  }

  private withClarificationSummary(
    clarificationState: StrategyClarificationState | null | undefined,
    checklist: ChecklistPayload,
  ): StrategyClarificationStateWithSummary | null {
    if (!clarificationState) return null
    if (clarificationState.status !== 'NEEDS_CLARIFICATION') {
      return {
        ...clarificationState,
        summary: null,
      }
    }

    return {
      ...clarificationState,
      summary: this.buildClarificationSummary(checklist),
    }
  }

  private detectClarificationState(checklist: ChecklistPayload): StrategyClarificationStateWithSummary {
    return this.withClarificationSummary(
      this.clarificationRules.detect(checklist),
      checklist,
    ) as StrategyClarificationStateWithSummary
  }

  private resolveClarificationArtifacts(checklist: ChecklistPayload): {
    normalization: NormalizationResult
    executionContext: ReturnType<StrategyExecutionContextService['resolve']>
    atomicResolution: ReturnType<StrategyIntentResolutionService['resolve']>
    clarificationState: StrategyClarificationStateWithSummary
    clarificationPrompt: string
    blockingReasons: StrategyBlockingReason[]
    inferredAssumptions: StrategyInferredAssumption[]
  } {
    const normalization = this.intentNormalizer.normalize(checklist)
    const executionContext = this.executionContext.resolve(checklist)
    const atomicResolution = this.intentResolution.resolve({
      normalizedIntent: normalization.normalizedIntent,
    })
    const rawClarificationState = this.withClarificationSummary(
      this.clarificationRules.detectFromAmbiguities({
        executionContext,
        atomicResolution,
        checklist,
      }),
      checklist,
    ) as StrategyClarificationStateWithSummary
    const clarificationState = this.filterLegacyClarificationState(rawClarificationState, normalization)
    const shouldUseExecutionContextAmbiguities = clarificationState.items.some(item => item.key.startsWith('executionContext.'))
    const shouldUseAtomicAmbiguities = clarificationState.items.some(item =>
      item.reason === 'atomic_semantic_fork'
      || item.key.startsWith('semantic.'),
    )
    const effectiveAmbiguities: StrategyAmbiguity[] = [
      ...(shouldUseExecutionContextAmbiguities
        ? executionContext.ambiguities.map(ambiguity => ({
            kind: ambiguity.kind,
            field: ambiguity.field,
            message: ambiguity.reason,
          }))
        : []),
      ...(shouldUseAtomicAmbiguities ? atomicResolution.ambiguities : []),
    ]
    const clarificationPrompt = this.clarificationQuestion.buildFromAmbiguities({
      summary: clarificationState.summary,
      ambiguities: effectiveAmbiguities,
    }) || this.clarificationQuestion.build(clarificationState)
    const alignedClarificationState = this.alignClarificationStateWithAskedQuestion(
      clarificationState,
      clarificationPrompt,
    ) as StrategyClarificationStateWithSummary
    const clarificationEvidence = this.clarificationRules.collectEvidence(checklist)
    const blockingReasons: StrategyBlockingReason[] = [
      ...executionContext.evidence
        .filter((item): item is { key: string, reason: string, priority: number, question: string } => typeof item.question === 'string')
        .map(item => ({
          key: item.key,
          reason: item.reason,
          priority: item.priority,
          question: item.question,
        })),
      ...clarificationEvidence.blockingReasons.map(item => ({
        key: item.key,
        reason: this.mapClarificationReasonToBlockingReason(item.reason),
        priority: item.priority,
        question: item.question,
      })),
      ...atomicResolution.ambiguities
        .filter((item) => item.kind === 'atomic_semantic_fork' && item.field === 'trigger.confirmation')
        .map(() => ({
          key: 'trigger.confirmation',
          reason: 'trigger_semantics_fork',
          priority: 95,
          question: '该布林带条件是触碰即触发，还是收盘确认后触发？',
        })),
    ]
    const inferredAssumptions = this.collectInferredAssumptions(checklist)

    return {
      normalization,
      executionContext,
      atomicResolution,
      clarificationState: alignedClarificationState,
      clarificationPrompt,
      blockingReasons,
      inferredAssumptions,
    }
  }

  private filterLegacyClarificationState(
    clarificationState: StrategyClarificationStateWithSummary,
    normalization: NormalizationResult,
  ): StrategyClarificationStateWithSummary {
    const hasActiveGrid = normalization.normalizedIntent.triggers.some(trigger => trigger.key === 'grid.range_rebalance')
    const items = clarificationState.items.filter(item => {
      if (
        hasActiveGrid
        && item.reason === 'missing_entry_rules'
        && item.field === 'entryRules'
      ) {
        return false
      }

      return !this.shouldSuppressLegacyClarificationItem(item, normalization)
    })

    return {
      ...clarificationState,
      status: items.length > 0 ? 'NEEDS_CLARIFICATION' : 'CLEAR',
      items,
    }
  }

  private shouldSuppressLegacyClarificationItem(
    item: StrategyClarificationItem,
    normalization: NormalizationResult,
  ): boolean {
    if (normalization.blocked) return false

    const triggers = normalization.normalizedIntent.triggers
    if (triggers.length === 0 || triggers.some(trigger => trigger.closureStatus !== 'closed')) {
      return false
    }

    const isGoldenSupportedTriggerSet = triggers.every(trigger =>
      trigger.key === 'price.percent_change'
      || trigger.key === 'bollinger.touch_upper'
      || trigger.key === 'bollinger.touch_lower'
      || trigger.key === 'bollinger.touch_middle',
    )
    if (!isGoldenSupportedTriggerSet) return false

    return item.reason === 'missing_stop_loss_rule'
      || item.reason === 'missing_take_profit_rule'
  }

  private buildClarificationSummary(checklist: ChecklistPayload): string | null {
    const drafts = buildChecklistRuleDrafts(checklist)
    const executionContext = this.resolveExecutionContextForSummary(checklist)
    const entryRule = drafts.entry[0]
    const exitRule = drafts.exit[0]
    const positionPct = typeof checklist.riskRules?.positionPct === 'number'
      ? `${checklist.riskRules.positionPct}% 仓位`
      : ''
    const formatDraft = (draft: ChecklistRuleDraft | undefined): string => {
      if (!draft) return ''
      const normalizedText = draft.text.replace(/^\d+[mhd]\s+/u, '').trim()
      return `${draft.timeframe ? `${draft.timeframe} ` : ''}${normalizedText}`.trim()
    }

    const segments = [
      [
        executionContext.exchange,
        executionContext.marketType === 'perp' ? '合约' : executionContext.marketType === 'spot' ? '现货' : '',
        executionContext.symbol,
        executionContext.timeframe,
      ].filter(Boolean).join(' '),
      entryRule ? `入场：${formatDraft(entryRule)}` : '',
      exitRule ? `出场：${formatDraft(exitRule)}` : '',
      this.buildRiskSummarySegment('止损', checklist.riskRules, 'stopLoss'),
      this.buildRiskSummarySegment('止盈', checklist.riskRules, 'takeProfit'),
      positionPct,
    ].filter(Boolean)

    return segments.length > 0 ? segments.join('；') : null
  }

  private resolveExecutionContextForSummary(checklist: ChecklistPayload): {
    exchange: string
    marketType: string
    symbol: string
    timeframe: string
  } {
    const rawExchange = typeof checklist.market?.exchange === 'string'
      ? checklist.market.exchange.trim().toUpperCase()
      : (typeof checklist.riskRules?.exchange === 'string' ? checklist.riskRules.exchange.trim().toUpperCase() : '')
    const rawMarketType = typeof checklist.market?.marketType === 'string'
      ? checklist.market.marketType.trim().toLowerCase()
      : (typeof checklist.riskRules?.marketType === 'string'
          ? checklist.riskRules.marketType.trim().toLowerCase()
          : '')
    const rawSymbol = checklist.symbols?.[0]?.trim() ?? ''
    const rawTimeframe = resolveChecklistDefaultTimeframe(checklist) ?? ''

    const resolvedContext = typeof this.executionContext?.resolve === 'function'
      ? this.executionContext.resolve(checklist).context
      : null

    return {
      exchange: resolvedContext?.exchange?.toUpperCase() ?? rawExchange,
      marketType: resolvedContext?.marketType ?? rawMarketType,
      symbol: resolvedContext?.symbol ?? rawSymbol,
      timeframe: resolvedContext?.timeframe ?? rawTimeframe,
    }
  }

  private buildNormalizationAssistantPrompt(
    checklist: ChecklistPayload,
    normalization: NormalizationResult,
  ): string {
    const summary = this.buildClarificationSummary(checklist)
    const normalizedFamilies = normalization.normalizedIntent.families.join('、')
    const normalizedLine = normalizedFamilies
      ? `当前已归一到的语义族：${normalizedFamilies}。`
      : '当前还没有稳定归一到首批语义族。'
    const blockerReason = normalization.blockerReason ?? '当前策略语义仍不稳定。'
    return [
      summary ? `我当前理解的策略是：${summary}` : '我当前已经整理了你的策略输入。',
      normalizedLine,
      `现在还缺一个会影响脚本生成一致性的条件：${blockerReason}`,
      '请继续明确策略语义。',
    ].join('\n')
  }

  private normalizeClarificationSummary(summary: unknown): string | null {
    return typeof summary === 'string' && summary.trim().length > 0 ? summary.trim() : null
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
    if (input.reason === 'atomic_semantic_fork') {
      return 'trigger.confirmation'
    }

    const key = input.key.toLowerCase()
    const question = input.question.toLowerCase()

    if (key.includes('exchange') || /交易所/u.test(question)) return 'exchange'
    if (key.includes('symbol') || /标的|交易对/u.test(question)) return 'symbol'
    if (key.includes('timeframe') || /周期/u.test(question)) return 'timeframe'
    if (key.includes('markettype') || /现货|合约|市场/u.test(question)) return 'marketType'
    if (key.includes('trigger.confirmation') || /触碰|触发|收盘确认/u.test(question)) return 'trigger.confirmation'
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
    if (input.reason === 'atomic_semantic_fork' || input.key.toLowerCase().includes('trigger.confirmation')) {
      return ['touch', 'close_confirm']
    }
    if (input.key.toLowerCase() === 'risk.effect') {
      return ['reduce', 'close']
    }
    return undefined
  }

  private readPublicationGate(value: unknown): CodegenSessionResponseDto['publicationGate'] | null {
    return responseMapperHelper.readPublicationGate(value)
  }

  private buildPublishedSnapshotParamValues(
    snapshot: {
      paramsSnapshot?: unknown
      lockedParams?: unknown
      executionPolicy?: unknown
    } | null | undefined,
  ): Record<string, unknown> | null {
    return responseMapperHelper.buildPublishedSnapshotParamValues(snapshot)
  }

  private buildPublishedSnapshotProjection(args: {
    publishedSnapshotId: string | null
    snapshot: unknown
  }): PublishedSnapshotProjection {
    return responseMapperHelper.buildPublishedSnapshotProjection(args)
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

  private evaluateCanonicalCompileability(spec: {
    rules: Array<{
      phase: string
      actions: Array<{ type: string }>
    }>
  }): CanonicalCompileabilityReport {
    const entryRuleCount = spec.rules.filter(rule =>
      rule.phase === 'entry'
      && rule.actions.some(action => action.type === 'OPEN_LONG' || action.type === 'OPEN_SHORT'),
    ).length

    const exitRuleCount = spec.rules.filter(rule =>
      (rule.phase === 'exit' || rule.phase === 'risk')
      && rule.actions.some(action => (
        action.type === 'CLOSE_LONG'
        || action.type === 'CLOSE_SHORT'
        || action.type === 'FORCE_EXIT'
        || action.type === 'REDUCE_LONG'
        || action.type === 'REDUCE_SHORT'
      )),
    ).length

    const reasons: string[] = []
    if (entryRuleCount === 0) {
      reasons.push('未识别可编译入场规则')
    }
    if (exitRuleCount === 0) {
      reasons.push('未识别可编译出场规则')
    }

    return {
      canCompile: reasons.length === 0,
      entryRuleCount,
      exitRuleCount,
      reasons,
    }
  }

  private buildCanonicalSpecForConversation(
    checklist: ChecklistPayload,
    normalization: NormalizationResult,
  ) {
    const checklistSpec = this.canonicalSpecBuilder.build(checklist)
    if (normalization.blocked) {
      return checklistSpec
    }

    const hasSemanticOnlyTriggers = normalization.normalizedIntent.triggers.some(trigger =>
      trigger.phase === 'gate',
    )
    if (hasSemanticOnlyTriggers) {
      const normalizedSpec = this.canonicalSpecBuilder.buildFromNormalizedIntent(
        checklist,
        normalization.normalizedIntent,
      )
      const normalizedCompileability = this.evaluateCanonicalCompileability(normalizedSpec)
      return normalizedCompileability.canCompile ? normalizedSpec : checklistSpec
    }

    const needsNormalizedFallback = normalization.normalizedIntent.triggers.some(trigger =>
      trigger.key === 'indicator.above' || trigger.key === 'indicator.below',
    )
    if (!needsNormalizedFallback) {
      return checklistSpec
    }

    const checklistCompileability = this.evaluateCanonicalCompileability(checklistSpec)
    if (checklistCompileability.canCompile) {
      return checklistSpec
    }

    const normalizedSpec = this.canonicalSpecBuilder.buildFromNormalizedIntent(
      checklist,
      normalization.normalizedIntent,
    )
    const normalizedCompileability = this.evaluateCanonicalCompileability(normalizedSpec)
    return normalizedCompileability.canCompile ? normalizedSpec : checklistSpec
  }

  private buildCompileabilityAssistantPrompt(report: CanonicalCompileabilityReport): string {
    return `当前规则还不能稳定生成脚本：${report.reasons.join('，')}。请补充能明确落成主链规则的入场/出场条件后再确认逻辑图。`
  }

  private buildStrategyDecision(input: {
    checklist: ChecklistPayload
    clarification: ReturnType<CodegenConversationService['resolveClarificationArtifacts']>
    compileability: CanonicalCompileabilityReport | null
    constraintPack: ConstraintPackSnapshot
  }) {
    const normalizedSummary = input.clarification.clarificationState.summary?.trim()
      || this.buildClarificationSummary(input.checklist)
      || '已识别部分条件，但仍未完整。'

    return this.uniquenessDecision.decide({
      normalizedSummary,
      blockingReasons: input.clarification.blockingReasons,
      inferredAssumptions: this.collectInferredAssumptions(
        input.checklist,
        input.constraintPack,
      ),
      compileability: input.compileability,
    })
  }

  private mapClarificationReasonToBlockingReason(reason: StrategyClarificationItem['reason']): string {
    if (
      reason === 'missing_exchange'
      || reason === 'missing_symbol'
      || reason === 'missing_market_type'
      || reason === 'missing_timeframe'
      || reason === 'missing_position_pct'
      || reason === 'missing_position_mode'
    ) {
      return 'runtime_context_missing'
    }
    if (
      reason === 'missing_side_scope'
      || reason === 'direction_ambiguous'
      || reason === 'missing_action_uniqueness'
    ) {
      return 'direction_ambiguity'
    }
    if (reason === 'missing_exit_rules') {
      return 'exit_semantics_missing'
    }
    if (reason === 'ambiguous_condition_basis') {
      return 'basis_ambiguity'
    }
    if (reason === 'atomic_semantic_fork') {
      return 'trigger_semantics_fork'
    }

    return reason
  }

  private collectInferredAssumptions(
    checklist: ChecklistPayload,
    constraintPack: ConstraintPackSnapshot = createDefaultConstraintPack(),
  ): StrategyInferredAssumption[] {
    const combinedText = [...(checklist.entryRules ?? []), ...(checklist.exitRules ?? [])].join(' ')
    const assumptions: StrategyInferredAssumption[] = []
    const consumedKeys = new Set([
      ...(Array.isArray(constraintPack.inferredConfirmation?.confirmedKeys)
        ? constraintPack.inferredConfirmation.confirmedKeys.filter((item): item is string => typeof item === 'string')
        : []),
      ...(Array.isArray(constraintPack.inferredConfirmation?.overriddenKeys)
        ? constraintPack.inferredConfirmation.overriddenKeys.filter((item): item is string => typeof item === 'string')
        : []),
    ])
    const inferredKeys = Array.isArray(checklist.riskRules?._inferredAssumptions)
      ? checklist.riskRules._inferredAssumptions.filter(
          (item): item is string => typeof item === 'string' && !consumedKeys.has(item),
        )
      : []

    if (inferredKeys.includes('risk.stopLossBasis') && checklist.riskRules?.stopLossBasis === 'entry_avg_price') {
      assumptions.push({
        key: 'risk.stopLossBasis',
        value: 'entry_avg_price',
        source: 'system_default',
      })
    }

    if (inferredKeys.includes('risk.takeProfitBasis') && checklist.riskRules?.takeProfitBasis === 'entry_avg_price') {
      assumptions.push({
        key: 'risk.takeProfitBasis',
        value: 'entry_avg_price',
        source: 'system_default',
      })
    }

    if (/默认|你来定/u.test(combinedText)) {
      assumptions.push({
        key: 'strategy.defaults',
        value: '沿用系统默认解释',
        source: 'system_default',
      })
    }

    return assumptions
  }

  private buildNormalizationFromSemanticState(
    semanticState: SemanticState,
  ): NormalizationResult {
    const normalizedIntent = this.semanticStateCompileBridge.buildNormalizedIntent(semanticState)
    const nextOpenSlot = this.findNextOpenSemanticSlot(semanticState)

    return {
      normalizedIntent,
      blocked: nextOpenSlot !== null,
      ...(nextOpenSlot ? { blockerReason: nextOpenSlot.questionHint } : {}),
    }
  }

  private withConfirmedInferredDecisionKeys(
    constraintPack: ConstraintPackSnapshot,
    checklist: ChecklistPayload,
    message: string | undefined,
  ): {
      checklist: ChecklistPayload
      constraintPack: ConstraintPackSnapshot
      consumed: boolean
    } {
    const clarification = this.resolveClarificationArtifacts(checklist)
    const compileability = this.evaluateCanonicalCompileability(
      this.buildCanonicalSpecForConversation(checklist, clarification.normalization),
    )
    const decision = this.buildStrategyDecision({
      checklist,
      clarification,
      compileability,
      constraintPack,
    })

    if (decision.kind !== 'CONFIRM_INFERRED') {
      return {
        checklist,
        constraintPack,
        consumed: false,
      }
    }

    const explicitResponse = this.consumeExplicitInferredDecisionResponse(
      checklist,
      decision.inferredAssumptions.map(item => item.key),
      message,
    )
    const remainingKeys = decision.inferredAssumptions
      .map(item => item.key)
      .filter(key => !explicitResponse.overriddenKeys.includes(key))
    const confirmedKeys = this.isExplicitInferredConfirmationMessage(message)
      ? remainingKeys
      : remainingKeys.filter(key => explicitResponse.confirmedKeys.includes(key))

    if (explicitResponse.overriddenKeys.length === 0 && confirmedKeys.length === 0) {
      return {
        checklist,
        constraintPack,
        consumed: false,
      }
    }

    const existingConfirmedKeys = Array.isArray(constraintPack.inferredConfirmation?.confirmedKeys)
      ? constraintPack.inferredConfirmation.confirmedKeys.filter((item): item is string => typeof item === 'string')
      : []
    const existingOverriddenKeys = Array.isArray(constraintPack.inferredConfirmation?.overriddenKeys)
      ? constraintPack.inferredConfirmation.overriddenKeys.filter((item): item is string => typeof item === 'string')
      : []

    return {
      checklist: explicitResponse.checklist,
      constraintPack: {
        ...constraintPack,
        inferredConfirmation: {
          confirmedKeys: Array.from(new Set([
            ...existingConfirmedKeys.filter(key => !explicitResponse.overriddenKeys.includes(key)),
            ...confirmedKeys,
          ])),
          overriddenKeys: Array.from(new Set([
            ...existingOverriddenKeys,
            ...explicitResponse.overriddenKeys,
          ])),
        },
      },
      consumed: true,
    }
  }

  private consumeExplicitInferredDecisionResponse(
    checklist: ChecklistPayload,
    decisionKeys: string[],
    message: string | undefined,
  ): {
      checklist: ChecklistPayload
      confirmedKeys: string[]
      overriddenKeys: string[]
    } {
    if (!message?.trim()) {
      return {
        checklist,
        confirmedKeys: [],
        overriddenKeys: [],
      }
    }

    const activeKeys = new Set(decisionKeys)
    const clauses = message
      .split(/[，。；;\n]/u)
      .map(clause => clause.trim())
      .filter(Boolean)
    const confirmedKeys = new Set<string>()
    const overriddenKeys = new Set<string>()
    let nextChecklist = checklist

    for (const clause of clauses) {
      const clauseTargets = this.resolveInferredDecisionClauseTargets(clause, activeKeys)
      const basis = this.normalizeBasisClarificationAnswer(clause)
      if (clauseTargets.length > 0 && basis) {
        for (const key of clauseTargets) {
          const currentBasis = key === 'risk.stopLossBasis'
            ? nextChecklist.riskRules?.stopLossBasis
            : nextChecklist.riskRules?.takeProfitBasis
          if (currentBasis === basis) {
            confirmedKeys.add(key)
            continue
          }
          nextChecklist = this.normalizeChecklist({
            ...nextChecklist,
            riskRules: {
              ...(nextChecklist.riskRules ?? {}),
              ...(key === 'risk.stopLossBasis'
                ? { stopLossBasis: basis }
                : { takeProfitBasis: basis }),
            },
          })
          overriddenKeys.add(key)
        }
        continue
      }

      if (this.isExplicitInferredConfirmationClause(clause)) {
        const confirmationTargets = clauseTargets.length > 0
          ? clauseTargets
          : activeKeys.size === 1
            ? [Array.from(activeKeys)[0] as string]
            : []

        if (confirmationTargets.length === 0) {
          continue
        }

        for (const key of confirmationTargets) {
          confirmedKeys.add(key)
        }
      }
    }

    return {
      checklist: nextChecklist,
      confirmedKeys: Array.from(confirmedKeys).filter(key => !overriddenKeys.has(key)),
      overriddenKeys: Array.from(overriddenKeys),
    }
  }

  private resolveInferredDecisionClauseTargets(clause: string, activeKeys: ReadonlySet<string>): string[] {
    const targets: string[] = []
    if (activeKeys.has('risk.stopLossBasis') && /止损|亏损/u.test(clause)) {
      targets.push('risk.stopLossBasis')
    }
    if (activeKeys.has('risk.takeProfitBasis') && /止盈|盈利|收益率|收益|利润/u.test(clause)) {
      targets.push('risk.takeProfitBasis')
    }
    return targets
  }

  private isExplicitInferredConfirmationClause(clause: string): boolean {
    const raw = clause.trim()
    if (!raw) {
      return false
    }

    if (/[？?]/u.test(raw)) {
      return false
    }

    const normalized = raw.replace(/[\s，。,．！!？?、；;：:]/gu, '')
    if (/[吗么嘛吧呢呗]$/u.test(normalized)) {
      return false
    }

    if (
      /(?:不成立|默认不对|默认不行|默认不好|默认不合适|默认不能|默认不要|默认别)/u.test(normalized)
      || /(?:不是默认|别按默认|不要默认)/u.test(normalized)
    ) {
      return false
    }

    return [
      /默认值?没问题/u,
      /按默认(?:值)?(?:来|走)?$/u,
      /默认即可$/u,
      /就按这个默认/u,
      /就按默认/u,
    ].some(pattern => pattern.test(normalized))
  }

  private isExplicitInferredConfirmationMessage(message: string | undefined): boolean {
    const normalized = message?.trim().replace(/[\s，。,．！!？?、；;：:]/gu, '')
    if (!normalized) {
      return false
    }

    return new Set([
      '这个是对的',
      '这是对的',
      '对的继续',
      '这个推断是对的',
      '这些推断是对的',
      '这些推断成立',
      '这些成立继续',
      '推断成立',
      '就按这个来',
      '这个默认是对的',
      '这些默认是对的',
    ]).has(normalized)
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
    const entryRuleBases: Record<string, ChecklistRuleBasis['kind']> = {}
    const exitRuleBases: Record<string, ChecklistRuleBasis['kind']> = {}

    const percentToken = '\\d+(?:\\.\\d+)?\\s*%|百分之?\\s*\\d+(?:\\.\\d+)?'
    const directionalFragments = text
      .split(/[，。；;\n]/u)
      .flatMap(fragment => fragment.split(/(?<=买入|卖出|开仓|平仓|入场|出场|离场)/u))
      .map(fragment => fragment.trim())
      .filter(Boolean)

    const buyDropFragment = directionalFragments.find(fragment =>
      /(?:跌|下跌|回撤).{0,20}?(?:买入|开仓|入场)/u.test(fragment),
    )
    const sellRiseFragment = directionalFragments.find(fragment =>
      /(?:涨|上涨|反弹).{0,20}?(?:卖出|平仓|离场|出场)/u.test(fragment),
    )
    if (buyDropFragment && new RegExp(percentToken, 'u').test(buyDropFragment)) {
      entryRules.push(normalizeDirectionalPercentRule(buyDropFragment, 'entry'))
      entryRuleBases['entry-1'] = 'prev_close'
    }

    if (sellRiseFragment && new RegExp(percentToken, 'u').test(sellRiseFragment)) {
      exitRules.push(normalizeDirectionalPercentRule(sellRiseFragment, 'exit'))
      exitRuleBases['exit-1'] = 'prev_close'
    }

    if (entryRules.length === 0) {
      const entryMovingAverageBreakout = this.inferMovingAverageBreakoutRuleFromFragments(
        directionalFragments,
        'entry',
      )
      if (entryMovingAverageBreakout) {
        entryRules.push(entryMovingAverageBreakout)
      }
    }

    if (exitRules.length === 0) {
      const exitMovingAverageBreakout = this.inferMovingAverageBreakoutRuleFromFragments(
        directionalFragments,
        'exit',
      )
      if (exitMovingAverageBreakout) {
        exitRules.push(exitMovingAverageBreakout)
      }
    }

    if (entryRules.length === 0) {
      const hasBollinger = /布林|bollinger/i.test(text)
      const hasUpperBand = /上轨|upper/i.test(text)
      const hasLowerBand = /下轨|lower/i.test(text)
      const hasTouchCue = /触及|触碰|碰到|touch/iu.test(text)
      const hasCloseConfirmCue = /收盘确认|收盘后确认|收盘|收于|收在|close/iu.test(text)
      const upperBandDirection = this.detectDirectionInTriggerFragment(
        text,
        /(?:布林|bollinger).{0,12}(?:上轨|upper)|(?:上轨|upper).{0,12}(?:布林|bollinger)|(?:突破|站上|收盘).{0,8}(?:上轨|upper)/i,
      )
      const lowerBandDirection = this.detectDirectionInTriggerFragment(
        text,
        /(?:布林|bollinger).{0,12}(?:下轨|lower)|(?:下轨|lower).{0,12}(?:布林|bollinger)|(?:突破|跌破|收盘).{0,8}(?:下轨|lower)/i,
      )
      if (hasBollinger && hasUpperBand && upperBandDirection === 'short' && hasTouchCue && hasCloseConfirmCue) {
        entryRules.push('触及布林带上轨后收盘确认做空')
      } else if (hasBollinger && hasUpperBand && upperBandDirection === 'long' && hasTouchCue && hasCloseConfirmCue) {
        entryRules.push('触及布林带上轨后收盘确认做多')
      } else if (hasBollinger && hasLowerBand && lowerBandDirection === 'long' && hasTouchCue && hasCloseConfirmCue) {
        entryRules.push('触及布林带下轨后收盘确认做多')
      } else if (hasBollinger && hasLowerBand && lowerBandDirection === 'short' && hasTouchCue && hasCloseConfirmCue) {
        entryRules.push('触及布林带下轨后收盘确认做空')
      } else if (hasBollinger && hasUpperBand && upperBandDirection === 'short' && hasTouchCue) {
        entryRules.push('触及布林带上轨时做空')
      } else if (hasBollinger && hasUpperBand && upperBandDirection === 'long' && hasTouchCue) {
        entryRules.push('触及布林带上轨时做多')
      } else if (hasBollinger && hasLowerBand && lowerBandDirection === 'long' && hasTouchCue) {
        entryRules.push('触及布林带下轨时做多')
      } else if (hasBollinger && hasLowerBand && lowerBandDirection === 'short' && hasTouchCue) {
        entryRules.push('触及布林带下轨时做空')
      } else if (hasBollinger && hasUpperBand && upperBandDirection === 'short' && /突破|交易|开仓|入场|站上|收盘/.test(text)) {
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
    const grid: NonNullable<ChecklistPayload['grid']> = {}
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

    const positionMatch = text.match(/仓位\s*(\d+(?:\.\d+)?)\s*%/u)
      ?? text.match(/单笔(?:使用|投入)?\s*(\d+(?:\.\d+)?)\s*%\s*资金/u)
      ?? text.match(/(?:仓位|单笔(?:用|使用)?|使用)\s*(?:百分之?\s*)?(\d+(?:\.\d+)?)(?:\s*%|资金|仓位|$)/u)
      ?? text.match(/(?:仓位|单笔(?:用|使用)?).{0,8}?(\d+(?:\.\d+)?)\s*%/u)
    if (positionMatch?.[1]) {
      riskRules.positionPct = Number(positionMatch[1])
    }
    const stopLossMatch = text.match(/止损[^%\n]{0,12}?(?:百分之?\s*)?(\d+(?:\.\d+)?)(?:\s*%|$)/)
      ?? text.match(/亏损[≥>=]?\s*(?:百分之?\s*)?(\d+(?:\.\d+)?)(?:\s*%|$)/)
    if (stopLossMatch?.[1]) {
      riskRules.stopLossPct = Number(stopLossMatch[1])
    }
    const takeProfitMatch = text.match(/止盈[^%\n]{0,12}?(?:百分之?\s*)?(\d+(?:\.\d+)?)(?:\s*%|$)/)
      ?? text.match(/(?:盈利|收益率)[≥>=]?\s*(?:百分之?\s*)?(\d+(?:\.\d+)?)(?:\s*%|$)/)
    if (takeProfitMatch?.[1]) {
      riskRules.takeProfitPct = Number(takeProfitMatch[1])
    }
    const stopLossClause = this.extractRiskRuleClause(text, 'stopLoss')
    const takeProfitClause = this.extractRiskRuleClause(text, 'takeProfit')
    const stopLossBasis = this.resolveRiskBasis(stopLossClause, typeof riskRules.stopLossBasis === 'string'
      ? riskRules.stopLossBasis as ChecklistRuleBasis['kind']
      : null)
    if (stopLossBasis && typeof riskRules.stopLossPct === 'number') {
      riskRules.stopLossBasis = stopLossBasis
    }
    const takeProfitBasis = this.resolveRiskBasis(takeProfitClause, typeof riskRules.takeProfitBasis === 'string'
      ? riskRules.takeProfitBasis as ChecklistRuleBasis['kind']
      : null)
    if (takeProfitBasis && typeof riskRules.takeProfitPct === 'number') {
      riskRules.takeProfitBasis = takeProfitBasis
    }
    const drawdownMatch = text.match(/最大回撤\s*(?:百分之?\s*)?(\d+(?:\.\d+)?)(?:\s*%|$)/)
    if (drawdownMatch?.[1]) {
      riskRules.maxDrawdownPct = Number(drawdownMatch[1])
    }
    const earlyStopMatch = text.match(/((?:价格)?连续\s*3\s*根K线[^。；;\n]{0,40}?轨外[^。；;\n]{0,40}?(?:提前止损|减仓|全平|平仓))/i)
    if (earlyStopMatch?.[1]) {
      riskRules.earlyStop = earlyStopMatch[1].trim()
    }
    if (/网格|grid/iu.test(text)) {
      const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*[-~到至]\s*(\d+(?:\.\d+)?)/u)
      if (rangeMatch?.[1] && rangeMatch[2]) {
        grid.lower = Number(rangeMatch[1])
        grid.upper = Number(rangeMatch[2])
      }

      const percentMatch = text.match(/(?:步长|每格)\s*(\d+(?:\.\d+)?)\s*%/u)
      const perMilleMatch = text.match(/千分之\s*(\d+(?:\.\d+)?)/u)
      if (percentMatch?.[1]) {
        grid.stepPct = Number(percentMatch[1])
      } else if (perMilleMatch?.[1]) {
        grid.stepPct = Number(perMilleMatch[1]) / 10
      }

      if (/双向|低买高卖|来回|往返|自动买卖|自动交易/u.test(text)) {
        grid.sideMode = 'bidirectional'
      } else if (/只做多|仅做多/u.test(text)) {
        grid.sideMode = 'long_only'
      } else if (/只做空|仅做空/u.test(text)) {
        grid.sideMode = 'short_only'
      }

      if (!grid.sideMode) {
        grid.sideMode = 'bidirectional'
      }
    }

    const inferredMarket = {
      ...(riskRules.exchange === 'okx' || riskRules.exchange === 'binance' || riskRules.exchange === 'hyperliquid'
        ? { exchange: riskRules.exchange as ChecklistPayload['market']['exchange'] }
        : {}),
      ...(riskRules.marketType === 'spot' || riskRules.marketType === 'perp'
        ? { marketType: riskRules.marketType as ChecklistPayload['market']['marketType'] }
        : {}),
      ...(timeframes[0] ? { defaultTimeframe: timeframes[0] } : {}),
    }

    const drafts = buildChecklistRuleDrafts({
      symbols: symbols.length > 0 ? symbols : undefined,
      timeframes: timeframes.length > 0 ? timeframes : undefined,
      entryRules: entryRules.length > 0 ? entryRules : undefined,
      exitRules: exitRules.length > 0 ? exitRules : undefined,
      entryRuleBases: Object.keys(entryRuleBases).length > 0 ? entryRuleBases : undefined,
      exitRuleBases: Object.keys(exitRuleBases).length > 0 ? exitRuleBases : undefined,
      riskRules: Object.keys(riskRules).length > 0 ? riskRules : undefined,
      grid: Object.keys(grid).length > 0 ? grid : undefined,
      market: Object.keys(inferredMarket).length > 0 ? inferredMarket : undefined,
    })

    return {
      symbols: symbols.length > 0 ? symbols : undefined,
      timeframes: timeframes.length > 0 ? timeframes : undefined,
      entryRules: entryRules.length > 0 ? entryRules : undefined,
      exitRules: exitRules.length > 0 ? exitRules : undefined,
      entryRuleBases: Object.keys(entryRuleBases).length > 0 ? entryRuleBases : undefined,
      exitRuleBases: Object.keys(exitRuleBases).length > 0 ? exitRuleBases : undefined,
      entryRuleDrafts: drafts.entry,
      exitRuleDrafts: drafts.exit,
      riskRules: Object.keys(riskRules).length > 0 ? riskRules : undefined,
      grid: Object.keys(grid).length > 0 ? grid : undefined,
      market: Object.keys(inferredMarket).length > 0 ? inferredMarket : { defaultTimeframe: timeframes[0] ?? null },
    }
  }

  private inferMovingAverageBreakoutRuleFromFragments(
    fragments: string[],
    phase: 'entry' | 'exit',
  ): string | null {
    const actionPattern = phase === 'entry'
      ? /买入|开仓|入场/u
      : /卖出|平仓|离场|出场/u

    for (const fragment of fragments) {
      if (!actionPattern.test(fragment)) {
        continue
      }
      if (!/均线|ema|sma|ma/iu.test(fragment)) {
        continue
      }

      const referenceRole = /长期|长线|长周期|long[\s-]?term/iu.test(fragment)
        ? '长期均线'
        : (/短期|短线|短周期|short[\s-]?term/iu.test(fragment) ? '短期均线' : null)
      if (!referenceRole) {
        continue
      }

      if (/突破|上穿|站上|上方|高于/u.test(fragment)) {
        return `价格突破${referenceRole}时${phase === 'entry' ? '买入' : '卖出'}`
      }
      if (/跌破|下穿|失守|下方|低于/u.test(fragment)) {
        return `价格跌破${referenceRole}时${phase === 'entry' ? '买入' : '卖出'}`
      }
    }

    return null
  }

  private detectDirectionInTriggerFragment(
    text: string,
    triggerPattern: RegExp,
  ): 'long' | 'short' | null {
    const match = triggerPattern.exec(text)
    if (!match) return null

    const PRE_WINDOW = 6
    const POST_WINDOW = 10
    const CLAUSE_SPLITTER = /然后|并且|回到|中轨|止盈|止损|平仓|离场|出场/u
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

    const normalizeBasisMap = (
      value: unknown,
    ): Record<string, ChecklistRuleBasis['kind']> | undefined => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
      }

      const normalized = Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, item]) => typeof item === 'string' && item.trim().length > 0)
          .map(([key, item]) => [key, (item as string).trim() as ChecklistRuleBasis['kind']]),
      ) as Record<string, ChecklistRuleBasis['kind']>

      return Object.keys(normalized).length > 0 ? normalized : undefined
    }

    const normalizeDrafts = (value: unknown, phase: ChecklistRuleDraft['phase']): ChecklistRuleDraft[] | undefined => {
      if (!Array.isArray(value)) return undefined
      const drafts = value
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .map((item, index) => {
          const text = typeof item.text === 'string' ? item.text.trim() : ''
          if (!text) return null
          const timeframe = typeof item.timeframe === 'string' && item.timeframe.trim().length > 0
            ? item.timeframe.trim()
            : null
          const basis = typeof item.basis === 'string' && item.basis.trim().length > 0
            ? item.basis.trim() as ChecklistRuleBasis['kind']
            : null
          return {
            id: typeof item.id === 'string' && item.id.trim().length > 0 ? item.id.trim() : `${phase}-${index + 1}`,
            phase,
            text,
            timeframe,
            ...(basis ? { basis } : {}),
          } satisfies ChecklistRuleDraft
        })
        .filter((item): item is ChecklistRuleDraft => item !== null)

      return drafts.length > 0 ? drafts : undefined
    }

    const normalizeMarket = (value: unknown): ChecklistPayload['market'] | undefined => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
      }
      const raw = value as Record<string, unknown>
      const exchange = typeof raw.exchange === 'string' && ['binance', 'okx', 'hyperliquid'].includes(raw.exchange.trim().toLowerCase())
        ? raw.exchange.trim().toLowerCase() as NonNullable<ChecklistPayload['market']>['exchange']
        : undefined
      const marketType = typeof raw.marketType === 'string' && ['spot', 'perp'].includes(raw.marketType.trim().toLowerCase())
        ? raw.marketType.trim().toLowerCase() as NonNullable<ChecklistPayload['market']>['marketType']
        : undefined
      const defaultTimeframe = typeof raw.defaultTimeframe === 'string' && raw.defaultTimeframe.trim().length > 0
        ? raw.defaultTimeframe.trim()
        : null

      if (!exchange && !marketType && !defaultTimeframe) {
        return undefined
      }

      return {
        ...(exchange ? { exchange } : {}),
        ...(marketType ? { marketType } : {}),
        ...(defaultTimeframe ? { defaultTimeframe } : {}),
      }
    }

    const normalizeStateGates = (value: unknown): ChecklistPayload['stateGates'] | undefined => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
      }
      const raw = value as Record<string, unknown>
      const marketRegime = typeof raw.marketRegime === 'string' && raw.marketRegime.trim().length > 0
        ? raw.marketRegime.trim() as NonNullable<ChecklistPayload['stateGates']>['marketRegime']
        : undefined
      const trendDirection = typeof raw.trendDirection === 'string' && raw.trendDirection.trim().length > 0
        ? raw.trendDirection.trim() as NonNullable<ChecklistPayload['stateGates']>['trendDirection']
        : undefined
      const volatilityState = typeof raw.volatilityState === 'string' && raw.volatilityState.trim().length > 0
        ? raw.volatilityState.trim() as NonNullable<ChecklistPayload['stateGates']>['volatilityState']
        : undefined

      if (!marketRegime && !trendDirection && !volatilityState) {
        return undefined
      }

      return {
        ...(marketRegime ? { marketRegime } : {}),
        ...(trendDirection ? { trendDirection } : {}),
        ...(volatilityState ? { volatilityState } : {}),
      }
    }

    const normalizeGrid = (value: unknown): ChecklistPayload['grid'] | undefined => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
      }
      const raw = value as Record<string, unknown>
      const lower = typeof raw.lower === 'number' && Number.isFinite(raw.lower)
        ? raw.lower
        : undefined
      const upper = typeof raw.upper === 'number' && Number.isFinite(raw.upper)
        ? raw.upper
        : undefined
      const stepPct = typeof raw.stepPct === 'number' && Number.isFinite(raw.stepPct)
        ? raw.stepPct
        : undefined
      const sideMode = typeof raw.sideMode === 'string'
        && (raw.sideMode === 'long_only' || raw.sideMode === 'short_only' || raw.sideMode === 'bidirectional')
        ? raw.sideMode
        : undefined

      if (lower === undefined && upper === undefined && stepPct === undefined && !sideMode) {
        return undefined
      }

      return {
        ...(lower !== undefined ? { lower } : {}),
        ...(upper !== undefined ? { upper } : {}),
        ...(stepPct !== undefined ? { stepPct } : {}),
        ...(sideMode ? { sideMode } : {}),
      }
    }

    const normalized: ChecklistPayload = {
      symbols: normalizeStringArray(payload.symbols),
      timeframes: normalizeStringArray(payload.timeframes),
      entryRules: normalizeStringArray(payload.entryRules),
      exitRules: normalizeStringArray(payload.exitRules),
      riskRules: this.backfillDefaultRiskBasis(normalizeObject(payload.riskRules)),
      stateGates: normalizeStateGates(payload.stateGates),
      entryRuleBases: normalizeBasisMap(payload.entryRuleBases),
      exitRuleBases: normalizeBasisMap(payload.exitRuleBases),
      entryRuleDrafts: normalizeDrafts(payload.entryRuleDrafts, 'entry'),
      exitRuleDrafts: normalizeDrafts(payload.exitRuleDrafts, 'exit'),
      riskRuleDrafts: normalizeDrafts(payload.riskRuleDrafts, 'risk'),
      market: normalizeMarket(payload.market),
      grid: normalizeGrid(payload.grid),
    }
    const drafts = buildChecklistRuleDrafts(normalized)

    return {
      ...normalized,
      entryRuleDrafts: drafts.entry.length > 0 ? drafts.entry : undefined,
      exitRuleDrafts: drafts.exit.length > 0 ? drafts.exit : undefined,
      riskRuleDrafts: drafts.risk.length > 0 ? drafts.risk : undefined,
      market: normalized.market ?? (resolveChecklistDefaultTimeframe(normalized)
        ? { defaultTimeframe: resolveChecklistDefaultTimeframe(normalized) }
        : undefined),
    }
  }

  private backfillDefaultRiskBasis(
    riskRules: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    if (!riskRules) return undefined

    const nextRiskRules = { ...riskRules }
    const inferredAssumptions = Array.isArray(nextRiskRules._inferredAssumptions)
      ? [...nextRiskRules._inferredAssumptions]
      : []
    const stopLossPct = typeof nextRiskRules.stopLossPct === 'number' ? nextRiskRules.stopLossPct : null
    const takeProfitPct = typeof nextRiskRules.takeProfitPct === 'number' ? nextRiskRules.takeProfitPct : null

    if (this.isValidRiskPct(stopLossPct) && !this.isNamedBasis(nextRiskRules.stopLossBasis)) {
      const basis = this.resolveRiskBasis(
        typeof nextRiskRules.stopLoss === 'string' ? nextRiskRules.stopLoss : `止损 ${stopLossPct}%`,
        null,
      )
      if (basis) {
        nextRiskRules.stopLossBasis = basis
        inferredAssumptions.push('risk.stopLossBasis')
      }
    }

    if (this.isValidRiskPct(takeProfitPct) && !this.isNamedBasis(nextRiskRules.takeProfitBasis)) {
      const basis = this.resolveRiskBasis(
        typeof nextRiskRules.takeProfit === 'string' ? nextRiskRules.takeProfit : `止盈 ${takeProfitPct}%`,
        null,
      )
      if (basis) {
        nextRiskRules.takeProfitBasis = basis
        inferredAssumptions.push('risk.takeProfitBasis')
      }
    }

    if (inferredAssumptions.length > 0) {
      nextRiskRules._inferredAssumptions = Array.from(new Set(inferredAssumptions))
    }

    return nextRiskRules
  }

  private isValidRiskPct(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100
  }

  private pruneResolvedRiskInferredAssumptions(
    riskRules: Record<string, unknown>,
    patchRiskRules: Record<string, unknown>,
  ): Record<string, unknown> {
    const inferredAssumptions = Array.isArray(riskRules._inferredAssumptions)
      ? riskRules._inferredAssumptions.filter((item): item is string => typeof item === 'string')
      : []
    const patchInferredAssumptions = Array.isArray(patchRiskRules._inferredAssumptions)
      ? patchRiskRules._inferredAssumptions.filter((item): item is string => typeof item === 'string')
      : []
    if (inferredAssumptions.length === 0) {
      return riskRules
    }

    const remainingAssumptions = inferredAssumptions.filter((item) => {
      if (
        item === 'risk.stopLossBasis'
        && this.isNamedBasis(patchRiskRules.stopLossBasis)
        && !patchInferredAssumptions.includes('risk.stopLossBasis')
      ) {
        return false
      }
      if (
        item === 'risk.takeProfitBasis'
        && this.isNamedBasis(patchRiskRules.takeProfitBasis)
        && !patchInferredAssumptions.includes('risk.takeProfitBasis')
      ) {
        return false
      }
      return true
    })

    if (remainingAssumptions.length === inferredAssumptions.length) {
      return riskRules
    }

    if (remainingAssumptions.length === 0) {
      const { _inferredAssumptions: _ignored, ...rest } = riskRules
      return rest
    }

    return {
      ...riskRules,
      _inferredAssumptions: remainingAssumptions,
    }
  }

  private isNamedBasis(value: unknown): value is ChecklistRuleBasis['kind'] {
    return typeof value === 'string' && value.trim().length > 0
  }

  private resolveRiskBasis(
    ruleText: string | null | undefined,
    explicitBasis: ChecklistRuleBasis['kind'] | null,
  ): ChecklistRuleBasis['kind'] | null {
    if (explicitBasis) return explicitBasis
    if (!ruleText?.trim()) return null
    return resolveDefaultRiskBasis(ruleText, null)
  }

  private extractRiskRuleClause(
    text: string,
    kind: 'stopLoss' | 'takeProfit',
  ): string | null {
    const pattern = kind === 'stopLoss'
      ? /((?:止损|亏损)[^。；;\n]{0,24})/u
      : /((?:止盈|盈利|收益率)[^。；;\n]{0,24})/u
    const match = text.match(pattern)
    return match?.[1]?.trim() ?? null
  }

  private buildRiskSummarySegment(
    label: '止损' | '止盈',
    riskRules: Record<string, unknown> | undefined,
    kind: 'stopLoss' | 'takeProfit',
  ): string {
    const pct = kind === 'stopLoss'
      ? riskRules?.stopLossPct
      : riskRules?.takeProfitPct
    if (!this.isValidRiskPct(pct)) return ''

    const basis = this.resolveRiskBasis(
      kind === 'stopLoss'
        ? typeof riskRules?.stopLoss === 'string' ? riskRules.stopLoss : `止损 ${pct}%`
        : typeof riskRules?.takeProfit === 'string' ? riskRules.takeProfit : `止盈 ${pct}%`,
      kind === 'stopLoss'
        ? this.isNamedBasis(riskRules?.stopLossBasis) ? riskRules.stopLossBasis : null
        : this.isNamedBasis(riskRules?.takeProfitBasis) ? riskRules.takeProfitBasis : null,
    )
    return this.describeRiskSummary(basis, label, pct)
  }

  private describeRiskSummary(
    basis: ChecklistRuleBasis['kind'] | null,
    label: '止损' | '止盈',
    pct: number,
  ): string {
    const action = label === '止损' ? '强制平仓' : '平仓'

    if (basis === 'position_pnl') {
      return `${label}：${label === '止损' ? '持仓亏损达到 ' : '持仓收益率达到 '}${pct}% ${action}`
    }

    if (basis === 'peak_equity') {
      return `${label}：账户净值相对峰值回撤达到 ${pct}% ${action}`
    }

    if (basis === 'peak_position_pnl') {
      return `${label}：持仓浮盈相对峰值回撤达到 ${pct}% ${action}`
    }

    const basisLabel = this.describeRiskBasisLabel(basis)
    const direction = label === '止损' ? '下跌' : '上涨'
    return `${label}：价格相对${basisLabel}${direction} ${pct}% ${action}`
  }

  private describeRiskBasisLabel(basis: ChecklistRuleBasis['kind'] | null): string {
    switch (basis) {
      case 'prev_close':
        return '上一根K线收盘价'
      case 'upper_band':
        return '布林带上轨'
      case 'lower_band':
        return '布林带下轨'
      case 'middle_band':
        return '布林带中轨'
      case 'last_high':
        return '前高'
      case 'last_low':
        return '前低'
      case 'entry_avg_price':
      case null:
      default:
        return '入场价'
    }
  }

  private readConstraintPack(payload: Prisma.JsonValue | null): ConstraintPackSnapshot {
    return conversationContextHelper.readConstraintPack(payload)
  }

  private withGuidePrompt(
    pack: ConstraintPackSnapshot,
    guidePrompt?: GuidePromptConfig,
    recommendationStyle?: RecommendationStyle,
  ): ConstraintPackSnapshot {
    return conversationContextHelper.withGuidePrompt(pack, guidePrompt, recommendationStyle)
  }

  private mergeGuidePromptConfig(
    base?: GuidePromptConfig,
    patch?: CodegenGuideConfigDto,
  ): GuidePromptConfig | undefined {
    return conversationContextHelper.mergeGuidePromptConfig(base, patch)
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
          semanticUpdates?: unknown
        }
        const related = typeof parsed.related === 'boolean' ? parsed.related : true
        const logicReady = typeof parsed.logicReady === 'boolean' ? parsed.logicReady : false
        const assistantPrompt = typeof parsed.assistantPrompt === 'string' && parsed.assistantPrompt.trim()
          ? parsed.assistantPrompt.trim()
          : (logicReady
              ? '我已整理出策略逻辑，请确认逻辑图。'
              : '我先继续完善策略逻辑，请补充一个关键条件。')
        const logic = this.mergeChecklistSnapshots(
          this.buildPlannerLogicFromSemanticUpdates(currentLogic, parsed.semanticUpdates),
          this.normalizeChecklist((parsed.logic ?? {}) as Record<string, unknown>),
        )
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

  private buildPlannerLogicFromSemanticUpdates(
    currentLogic: ChecklistPayload,
    semanticUpdates: unknown,
  ): ChecklistPayload {
    if (!semanticUpdates || typeof semanticUpdates !== 'object' || Array.isArray(semanticUpdates)) {
      return {}
    }

    const record = semanticUpdates as Record<string, unknown>
    const triggerUpdates = Array.isArray(record.triggerUpdates)
      ? record.triggerUpdates
        .map((item, index) => this.toPlannerTriggerState(item, index))
        .filter((item): item is SemanticTriggerState => item !== null)
      : []
    const actionUpdates = Array.isArray(record.actionUpdates)
      ? record.actionUpdates
        .map((item, index) => this.toPlannerActionState(item, index))
        .filter((item): item is SemanticState['actions'][number] => item !== null)
      : []
    const riskUpdates = Array.isArray(record.riskUpdates)
      ? record.riskUpdates
        .map((item, index) => this.toPlannerRiskState(item, index))
        .filter((item): item is SemanticState['risk'][number] => item !== null)
      : []
    const positionUpdate = this.toPlannerPositionState(record.positionUpdate)
    const contextSlots = this.toPlannerContextSlots(record.contextUpdates)

    if (
      triggerUpdates.length === 0
      && actionUpdates.length === 0
      && riskUpdates.length === 0
      && !positionUpdate
      && !Object.values(contextSlots).some(Boolean)
    ) {
      return {}
    }

    return this.semanticStateCompileBridge.buildLegacyChecklist({
      version: 1,
      families: [],
      triggers: triggerUpdates,
      actions: actionUpdates,
      risk: riskUpdates,
      position: positionUpdate,
      contextSlots,
      normalizationNotes: [],
      updatedAt: new Date().toISOString(),
    }, currentLogic)
  }

  private toPlannerTriggerState(update: unknown, index: number): SemanticTriggerState | null {
    if (!update || typeof update !== 'object' || Array.isArray(update)) {
      return null
    }

    const record = update as Record<string, unknown>
    const key = typeof record.key === 'string' ? record.key.trim() : ''
    const phase = record.phase
    if (!key || (phase !== 'entry' && phase !== 'exit' && phase !== 'risk' && phase !== 'gate')) {
      return null
    }

    return {
      id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `planner-trigger-${index + 1}`,
      key,
      phase,
      params: this.readPlannerParams(record.params),
      ...(record.sideScope === 'long' || record.sideScope === 'short' || record.sideScope === 'both'
        ? { sideScope: record.sideScope }
        : {}),
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }
  }

  private toPlannerActionState(update: unknown, index: number): SemanticState['actions'][number] | null {
    if (!update || typeof update !== 'object' || Array.isArray(update)) {
      return null
    }

    const record = update as Record<string, unknown>
    const key = typeof record.key === 'string' ? record.key.trim() : ''
    if (!key) {
      return null
    }

    return {
      id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `planner-action-${index + 1}`,
      key,
      ...(record.params && typeof record.params === 'object' && !Array.isArray(record.params)
        ? { params: { ...(record.params as Record<string, unknown>) } }
        : {}),
      status: 'locked',
      source: 'user_explicit',
    }
  }

  private toPlannerRiskState(update: unknown, index: number): SemanticState['risk'][number] | null {
    if (!update || typeof update !== 'object' || Array.isArray(update)) {
      return null
    }

    const record = update as Record<string, unknown>
    const key = typeof record.key === 'string' ? record.key.trim() : ''
    if (!key) {
      return null
    }

    return {
      id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `planner-risk-${index + 1}`,
      key,
      params: this.readPlannerParams(record.params),
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }
  }

  private toPlannerPositionState(update: unknown): SemanticState['position'] {
    if (!update || typeof update !== 'object' || Array.isArray(update)) {
      return null
    }

    const record = update as Record<string, unknown>
    if (
      typeof record.mode !== 'string'
      || typeof record.positionMode !== 'string'
      || typeof record.value !== 'number'
      || !Number.isFinite(record.value)
    ) {
      return null
    }

    return {
      mode: record.mode,
      value: record.value,
      positionMode: record.positionMode,
      status: 'locked',
      source: 'user_explicit',
    }
  }

  private toPlannerContextSlots(update: unknown): SemanticState['contextSlots'] {
    if (!update || typeof update !== 'object' || Array.isArray(update)) {
      return {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      }
    }

    const record = update as Record<string, unknown>
    return {
      exchange: this.toPlannerContextSlot('exchange', record.exchange),
      symbol: this.toPlannerContextSlot('symbol', record.symbol),
      marketType: this.toPlannerContextSlot('marketType', record.marketType),
      timeframe: this.toPlannerContextSlot('timeframe', record.timeframe),
    }
  }

  private toPlannerContextSlot(
    field: 'exchange' | 'symbol' | 'marketType' | 'timeframe',
    value: unknown,
  ): SemanticState['contextSlots'][typeof field] {
    if (typeof value !== 'string' || !value.trim()) {
      return null
    }

    const questionHints: Record<typeof field, string> = {
      exchange: '请确认交易所（binance / okx / hyperliquid）。',
      symbol: '请确认策略交易标的（例如 BTCUSDT）。',
      marketType: '请确认市场类型（现货或合约/perp）。',
      timeframe: '请确认策略主周期（例如 15m 或 1h）。',
    }

    return {
      slotKey: field,
      fieldPath: `contextSlots.${field}`,
      value: value.trim(),
      status: 'locked',
      priority: 'context',
      questionHint: questionHints[field],
      affectsExecution: true,
    }
  }

  private readPlannerParams(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }

    return { ...(value as Record<string, unknown>) }
  }

  private mergeChecklistSnapshots(base: ChecklistPayload, patch: ChecklistPayload): ChecklistPayload {
    const mergedEntryRuleBases = {
      ...(base.entryRuleBases ?? {}),
      ...(patch.entryRuleBases ?? {}),
    }
    const mergedExitRuleBases = {
      ...(base.exitRuleBases ?? {}),
      ...(patch.exitRuleBases ?? {}),
    }
    const mergedRiskRules = (() => {
      const baseRiskRules = base.riskRules ?? {}
      const patchRiskRules = patch.riskRules ?? {}
      const marketScopeConflicts = this.collectMarketScopeConflicts(base, patch)
      const merged = this.pruneResolvedRiskInferredAssumptions({
        ...baseRiskRules,
        ...patchRiskRules,
        ...(marketScopeConflicts.length > 0 ? { _marketScopeConflicts: marketScopeConflicts } : {}),
      }, patchRiskRules)
      return Object.keys(merged).length > 0 ? merged : undefined
    })()

    const merged = {
      symbols: patch.symbols && patch.symbols.length > 0 ? patch.symbols : base.symbols,
      timeframes: patch.timeframes && patch.timeframes.length > 0 ? patch.timeframes : base.timeframes,
      entryRules: this.mergeRuleArrays(base.entryRules, patch.entryRules, 'entry'),
      exitRules: this.mergeRuleArrays(base.exitRules, patch.exitRules, 'exit'),
      stateGates: (() => {
        const mergedStateGates = {
          ...(base.stateGates ?? {}),
          ...(patch.stateGates ?? {}),
        }
        return Object.keys(mergedStateGates).length > 0 ? mergedStateGates : undefined
      })(),
      riskRules: mergedRiskRules,
      entryRuleBases: Object.keys(mergedEntryRuleBases).length > 0 ? mergedEntryRuleBases : undefined,
      exitRuleBases: Object.keys(mergedExitRuleBases).length > 0 ? mergedExitRuleBases : undefined,
      entryRuleDrafts: patch.entryRuleDrafts && patch.entryRuleDrafts.length > 0 ? patch.entryRuleDrafts : base.entryRuleDrafts,
      exitRuleDrafts: patch.exitRuleDrafts && patch.exitRuleDrafts.length > 0 ? patch.exitRuleDrafts : base.exitRuleDrafts,
      riskRuleDrafts: patch.riskRuleDrafts && patch.riskRuleDrafts.length > 0 ? patch.riskRuleDrafts : base.riskRuleDrafts,
      market: patch.market ?? base.market,
      grid: (() => {
        const mergedGrid = {
          ...(base.grid ?? {}),
          ...(patch.grid ?? {}),
        }
        return Object.keys(mergedGrid).length > 0 ? mergedGrid : undefined
      })(),
    }
    return this.normalizeChecklist(merged)
  }

  private mergeRuleArrays(
    baseRules: string[] | undefined,
    patchRules: string[] | undefined,
    phase: 'entry' | 'exit',
  ): string[] | undefined {
    if (!patchRules || patchRules.length === 0) {
      return baseRules
    }

    const patchHasSpecificRule = patchRules.some(rule => !this.isGenericChecklistPlaceholderRule(rule, phase))
    const merged = patchHasSpecificRule
      ? [...(baseRules ?? []).filter(rule => !this.isGenericChecklistPlaceholderRule(rule, phase))]
      : [...(baseRules ?? [])]

    const signatureGroups = new Map<string, string[]>()
    const ungroupedRules: string[] = []

    for (const patchRule of patchRules) {
      if (
        this.isGenericChecklistPlaceholderRule(patchRule, phase)
        && merged.some(rule => !this.isGenericChecklistPlaceholderRule(rule, phase))
      ) {
        continue
      }

      const signature = this.inferRuleMergeSignature(patchRule)
      if (signature) {
        const group = signatureGroups.get(signature) ?? []
        if (!group.includes(patchRule)) {
          group.push(patchRule)
        }
        signatureGroups.set(signature, group)
        continue
      }

      ungroupedRules.push(patchRule)
    }

    for (const [signature, groupedPatchRules] of signatureGroups.entries()) {
      const existingIndices = merged
        .map((rule, index) => this.inferRuleMergeSignature(rule) === signature ? index : -1)
        .filter(index => index >= 0)
      if (existingIndices.length === 0) {
        for (const patchRule of groupedPatchRules) {
          if (!merged.includes(patchRule)) {
            merged.push(patchRule)
          }
        }
        continue
      }

      const firstIndex = existingIndices[0] ?? merged.length
      const remainingRules = merged.filter(rule => this.inferRuleMergeSignature(rule) !== signature)
      const insertionIndex = Math.min(firstIndex, remainingRules.length)
      merged.splice(0, merged.length, ...[
        ...remainingRules.slice(0, insertionIndex),
        ...groupedPatchRules,
        ...remainingRules.slice(insertionIndex),
      ])
    }

    for (const patchRule of ungroupedRules) {
      const existingIndex = merged.findIndex(baseRule => this.isLikelySameRule(baseRule, patchRule))
      if (existingIndex >= 0) {
        merged[existingIndex] = patchRule
        continue
      }
      if (!merged.includes(patchRule)) {
        merged.push(patchRule)
      }
    }

    return merged.length > 0 ? merged : undefined
  }

  private isGenericChecklistPlaceholderRule(
    rule: string,
    phase: 'entry' | 'exit',
  ): boolean {
    const text = rule.trim()
    if (!text) {
      return false
    }

    return phase === 'entry'
      ? text === '满足入场条件后开仓' || text === '短均线上穿长均线（金叉）入场'
      : text === '满足出场条件后平仓'
        || text === '短均线下穿长均线（死叉）出场'
        || text === '触发止盈/止损阈值出场'
  }

  private isLikelySameRule(baseRule: string, patchRule: string): boolean {
    if (baseRule === patchRule) {
      return true
    }

    const baseSignature = this.inferRuleMergeSignature(baseRule)
    const patchSignature = this.inferRuleMergeSignature(patchRule)

    return Boolean(baseSignature && patchSignature && baseSignature === patchSignature)
  }

  private inferRuleMergeSignature(rule: string): string | null {
    const text = rule.trim()
    if (!text) {
      return null
    }
    const normalizedText = text.toLowerCase()
    const action = /做空|平空/u.test(text)
      ? 'short'
      : /做多|买入|平多|卖出/u.test(text)
        ? 'long'
        : /平仓/u.test(text)
          ? 'both'
          : 'unknown'
    const confirmation = /收盘|k线收盘/u.test(text)
      ? 'close'
      : /盘中|触及/u.test(text)
        ? 'touch'
        : 'unspecified'

    if ((/连续\s*3|3\s*根/u.test(text)) && /轨外|outside/iu.test(text)) {
      return 'outside-band-3-bars'
    }
    if (/布林带/u.test(text) && /中轨|middle/iu.test(text)) {
      return `bollinger-middle:${action}`
    }
    if (/布林带/u.test(text) && /上轨/u.test(text)) {
      return `bollinger-upper:${confirmation}:${action}`
    }
    if (/布林带/u.test(text) && /下轨/u.test(text)) {
      return `bollinger-lower:${confirmation}:${action}`
    }
    if (/短均线.*上穿长均线|金叉/u.test(text)) {
      return `ma-cross-up:${action}`
    }
    if (/短均线.*下穿长均线|死叉/u.test(text)) {
      return `ma-cross-down:${action}`
    }
    if ((/突破|上穿/u.test(text)) && /长期均线|短期均线|\bma\b|\bsma\b|\bema\b/iu.test(text)) {
      const referenceRole = /短期均线/u.test(text) ? 'short' : 'long'
      return `ma-break-up:${referenceRole}:${confirmation}:${action}`
    }
    if ((/跌破|下穿/u.test(text)) && /长期均线|短期均线|\bma\b|\bsma\b|\bema\b/iu.test(text)) {
      const referenceRole = /短期均线/u.test(text) ? 'short' : 'long'
      return `ma-break-down:${referenceRole}:${confirmation}:${action}`
    }
    if (/布林带/.test(normalizedText) && /中轨|middle/.test(normalizedText)) {
      return `bollinger-middle:${action}`
    }
    return null
  }

  private collectMarketScopeConflicts(base: ChecklistPayload, patch: ChecklistPayload): Array<{
    field: 'exchange' | 'marketType' | 'symbol' | 'timeframe'
    previous: string
    next: string
  }> {
    const conflicts: Array<{
      field: 'exchange' | 'marketType' | 'symbol' | 'timeframe'
      previous: string
      next: string
    }> = []
    const pushConflict = (
      field: 'exchange' | 'marketType' | 'symbol' | 'timeframe',
      previous: string | undefined,
      next: string | undefined,
    ) => {
      if (!previous || !next) return
      if (isEquivalentMarketScopeValue(field, previous, next)) return
      conflicts.push({
        field,
        previous: previous.trim(),
        next: next.trim(),
      })
    }

    pushConflict('symbol', base.symbols?.[0], patch.symbols?.[0])
    pushConflict('timeframe', base.timeframes?.[0], patch.timeframes?.[0])
    pushConflict(
      'exchange',
      typeof base.riskRules?.exchange === 'string' ? base.riskRules.exchange : undefined,
      typeof patch.riskRules?.exchange === 'string' ? patch.riskRules.exchange : undefined,
    )
    pushConflict(
      'marketType',
      typeof base.riskRules?.marketType === 'string' ? base.riskRules.marketType : undefined,
      typeof patch.riskRules?.marketType === 'string' ? patch.riskRules.marketType : undefined,
    )

    return conflicts
  }

  private appendConversationHistory(
    current: string[],
    userMessage?: string,
    assistantMessage?: string,
  ): string[] {
    return conversationContextHelper.appendConversationHistory(current, userMessage, assistantMessage)
  }

  private inferRecommendationStyleFromContext(
    message: string | undefined,
    checklist: ChecklistPayload,
    currentStyle?: RecommendationStyle,
  ): RecommendationStyle | undefined {
    return conversationContextHelper.inferRecommendationStyleFromContext(message, checklist, currentStyle)
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

}
