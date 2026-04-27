import type { ConstraintPackSnapshot } from '../constants/constraint-pack'
import type {
  AiQuantConversationBacktestConfigDto,
  AiQuantConversationResponseDto,
} from '../dto/ai-quant-conversation.response.dto'
import type { CodegenGuideConfigDto } from '../dto/codegen-guide-config.dto'
import type { CodegenSessionResponseDto } from '../dto/codegen-session.response.dto'
import type { ContinueCodegenSessionDto } from '../dto/continue-codegen-session.dto'
import type { LlmCodegenEngineTestResponseDto } from '../dto/llm-codegen-engine-test.response.dto'
import type { RecoverAiQuantEditConversationRequestDto } from '../dto/recover-ai-quant-edit-conversation.request.dto'
import type { StartCodegenSessionDto } from '../dto/start-codegen-session.dto'
import type { TestLlmCodegenEngineDto } from '../dto/test-llm-codegen-engine.dto'
import type { AiQuantConversationSnapshotRecord } from '../repositories/ai-quant-conversations.repository'
import type { EditablePublishedStrategySnapshotRecord } from '../repositories/published-strategy-snapshots.repository'
import type { StrategyLogicSnapshot, StrategyRuleBasis, StrategyRuleDraft } from '../types/strategy-logic-snapshot'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type { LlmCodegenSessionStatus } from '../types/codegen-session-status'
import type { CanonicalStrategySpec } from '../types/canonical-strategy-spec'
import type { StrategyAmbiguity } from '../types/strategy-ambiguity'
import type { StrategyClarificationItem, StrategyClarificationState } from '../types/strategy-clarification'
import type { StrategyBlockingReason, StrategyInferredAssumption } from '../types/strategy-decision'
import type { SemanticEditDecision } from '../types/semantic-edit'
import type { StrategyExecutionContextResolution } from '../types/strategy-execution-context'
import type { StrategyNormalizedIntent } from '../types/strategy-normalized-intent'
import { buildSemanticSlotId, type SemanticActionState, type SemanticRiskState, type SemanticSlotState, type SemanticState, type SemanticTriggerState } from '../types/semantic-state'
import type { ChatMessage } from '@/modules/ai/providers/llm-provider-adapter.interface'

import type { Prisma } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { getHelperDocs } from '@ai/shared/script-engine/helpers'
import { HttpStatus, Injectable, Logger, Optional } from '@nestjs/common'
import { defaultEnvAccessor } from '@/common/env/env.accessor'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { AiService } from '@/modules/ai/ai.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { AccountStrategyViewService } from '@/modules/account-strategy-view/services/account-strategy-view.service'
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
import { buildReplacementSemanticState, readPendingSemanticEdit, withPendingSemanticEdit } from '../types/semantic-edit'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CanonicalSpecBuilderService } from './canonical-spec-builder.service'
import { buildStrategyRuleDrafts, resolveStrategyDefaultTimeframe } from './rule-draft-projection'
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
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { ConversationSemanticEditService } from './conversation-semantic-edit.service'
import { isEquivalentMarketScopeValue } from './market-scope-equivalence'
import { resolveDefaultRiskBasis } from './rule-family-default-semantics'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { RuntimeGuardrailService } from './runtime-guardrail.service'
import { SemanticSeedExtractorService } from './semantic-seed-extractor.service'
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
import { SemanticStateMergeService } from './semantic-state-merge.service'
import { buildNormalizedIntentFromSemanticState } from './semantic-state-normalization'
import { SemanticStateProjectionService } from './semantic-state-projection.service'
import { SemanticStateReducerService } from './semantic-state-reducer.service'
import {
  InferredConfirmationClassifierService,
  type InferredConfirmationDecisionKey,
  type InferredConfirmationSemanticDefaults,
} from './inferred-confirmation-classifier.service'
import { resolveSemanticClarificationMetadata } from './semantic-clarification-metadata'

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

interface PersistedConversationSessionForContinue {
  id: string
  userId: string
  status: LlmCodegenSessionStatus
  checklist?: Prisma.JsonValue | null
  semanticState?: Prisma.JsonValue | null
  clarificationState?: Prisma.JsonValue | null
  constraintPack: Prisma.JsonValue | null
  latestSpecDesc?: Prisma.JsonValue | null
  strategyInstanceId?: string | null
}

interface StructuredClarificationContinuationArgs {
  session: {
    id: string
    status: LlmCodegenSessionStatus
    latestSpecDesc?: Prisma.JsonValue | null
  }
  checklist: StrategyLogicSnapshot
  semanticState: SemanticState
  clarificationState: StrategyClarificationState
  constraintPack: ReturnType<CodegenConversationService['readConstraintPack']>
  message: string
  userId: string
}

const ALLOWED_HELPER_CATEGORIES = ['finance', 'array', 'ta', 'signal'] as const
const MAX_HELPER_SIGNATURE_LINES = 24
const DEFAULT_PROVIDER_CODE = 'strategy-codegen'
const DEFAULT_MODEL = 'gpt-4'
const DEFAULT_CODEGEN_STRICT_ENABLED = true
const DEFAULT_CODEGEN_STRICT_FALLBACK = true
const STRATEGY_PLAZA_RUN_SESSION_ID_PREFIX = 'strategy-plaza:official:'
const DEFAULT_CODEGEN_STRICT_UNSUPPORTED_TTL_MS = 10 * 60 * 1000
const EDIT_RECOVERY_ASSISTANT_MESSAGE = '已基于上一版策略恢复修改上下文。'

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


@Injectable()
export class CodegenConversationService {
  private readonly logger = new Logger(CodegenConversationService.name)
  private readonly strictUnsupportedTargets = new Map<string, number>()
  private readonly stateMachine = new CodegenConversationStateMachine()
  private readonly inferredConfirmationClassifier: InferredConfirmationClassifierService

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
    private readonly conversationSemanticEdit: ConversationSemanticEditService = new ConversationSemanticEditService(),
    private readonly executionContext: StrategyExecutionContextService = new StrategyExecutionContextService(),
    private readonly intentNormalizer: StrategyIntentNormalizerService = new StrategyIntentNormalizerService(),
    private readonly intentResolution: StrategyIntentResolutionService = new StrategyIntentResolutionService(),
    private readonly semanticStateReducer: SemanticStateReducerService = new SemanticStateReducerService(),
    private readonly semanticStateProjection: SemanticStateProjectionService = new SemanticStateProjectionService(),
    private readonly semanticStateMerge: SemanticStateMergeService = new SemanticStateMergeService(),
    private readonly semanticSeedExtractor: SemanticSeedExtractorService = new SemanticSeedExtractorService(),
    @Optional() private readonly accountStrategyViewService?: AccountStrategyViewService,
  ) {
    this.inferredConfirmationClassifier = new InferredConfirmationClassifierService(this.aiService)
  }

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
    const seedSemanticState = this.mergeSemanticPatchIntoState(
      this.createEmptySemanticState(),
      this.extractSemanticPatchFromMessage(dto.initialMessage),
    )
    const plan = await this.planConversationByLlm(dto.initialMessage ?? '', seedSemanticState, {
      providerCode: this.resolveProviderCode(undefined),
      model: undefined,
    }, [])
    let initialSemanticState = this.applyConversationPlanToSemanticState({
      currentState: seedSemanticState,
      plan,
    })
    const checklist = this.buildLegacyLogicSnapshotProjectionForCompatibility(initialSemanticState, {})
    const recommendationStyle = this.inferRecommendationStyleFromSemanticContext(
      dto.initialMessage,
      initialSemanticState,
      undefined,
    )
    const guidePrompt = this.mergeGuidePromptConfig(undefined, dto.guideConfig)
    const initialConstraintPack = {
      ...createDefaultConstraintPack(guidePrompt),
      recommendationStyle,
    }
    const semanticArtifacts = this.resolveSemanticClarificationArtifacts(initialSemanticState)
    const clarificationState = semanticArtifacts.clarificationState
    const normalization = semanticArtifacts.normalization
    const initialCanonicalSpec = this.buildCanonicalSpecForConversation(initialSemanticState, normalization)
    const compileability = this.evaluateCanonicalCompileability(initialCanonicalSpec)
    const decision = this.buildStrategyDecision({
      checklist,
      clarification: semanticArtifacts,
      effectiveBlockingReasons: semanticArtifacts.blockingReasons,
      compileability,
      constraintPack: initialConstraintPack,
    })
    const initialStatus = this.resolveInitialStartSessionStatus({
      clarificationState,
      normalizationBlocked: normalization.blocked,
      compileability,
      decisionKind: decision.kind,
    })
    const clarificationPrompt = decision.kind === 'CONFIRM_INFERRED'
      ? this.clarificationQuestion.buildFromDecision(decision)
      : semanticArtifacts.clarificationPrompt
    const confirmationAssistantPrompt = initialStatus === 'CONFIRM_GATE'
      ? this.buildSemanticLogicGateAssistantPrompt(initialSemanticState)
      : null
    const bootstrap = buildStartSessionBootstrap({
      initialMessage: dto.initialMessage,
      initialStatus,
      clarificationState,
      clarificationPrompt,
      confirmationAssistantPrompt,
      decisionKind: decision.kind,
      plan,
      compileability,
      normalizationBlocked: normalization?.blocked === true,
      normalizationAssistantPrompt: normalization?.blocked
        ? this.buildSemanticNormalizationAssistantPrompt(initialSemanticState, normalization)
        : undefined,
    }, report => this.buildCompileabilityAssistantPrompt(report))
    const initialSpecDesc = bootstrap.shouldEnterConfirmationGate && initialCanonicalSpec
      ? this.specDescBuilder.buildFromCanonicalSpec(initialCanonicalSpec, '', {
          normalizedIntent: normalization?.normalizedIntent ?? null,
          executionContext: semanticArtifacts.executionContext.context,
        })
      : null
    const initialCanonicalDigest = this.readCanonicalDigest(initialSpecDesc)
    const session = await this.sessionsRepo.createSession({
      userId: sessionUserId,
      status: bootstrap.status,
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
    let conversations = this.excludeStrategyPlazaRunConversations(await this.conversationsRepo.listByUser(userId))
    const knownSessionIds = new Set((await this.conversationsRepo.listKnownSessionIdsByUser(userId))
      .filter(sessionId => !this.isStrategyPlazaRunSessionId(sessionId)))
    const sessions = (await this.sessionsRepo.listByUser(userId))
      .filter(session => !this.isStrategyPlazaRunSessionId(session.id))
    const sessionsNeedingProjection = sessions.filter(session => !knownSessionIds.has(session.id))

    if (sessionsNeedingProjection.length > 0) {
      await Promise.all(sessionsNeedingProjection.map(session => this.persistConversationProjectionForSessionId(session.id, userId)))
      conversations = this.excludeStrategyPlazaRunConversations(await this.conversationsRepo.listByUser(userId))
    }

    return Promise.all(conversations.map(conversation => this.toConversationResponse(conversation)))
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
    options: { deleteStoppedStrategy?: boolean } = {},
  ): Promise<void> {
    const conversation = await this.conversationsRepo.findActiveDeleteContextByIdAndUser(conversationId, userId)
    if (!conversation) {
      await this.conversationsRepo.archiveByIdAndUser(conversationId, userId)
      return
    }

    const strategyInstanceId = await this.resolveConversationStrategyInstanceId(conversation.codegenSessionId)
    if (!strategyInstanceId) {
      await this.conversationsRepo.archiveByIdAndUser(conversationId, userId)
      return
    }

    if (!this.accountStrategyViewService) {
      throw new DomainException('ai_quant.conversation_delete_strategy_status_unavailable', {
        code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
        status: HttpStatus.SERVICE_UNAVAILABLE,
        args: { conversationId, strategyInstanceId },
      })
    }

    const strategy = await this.accountStrategyViewService.getStrategyDetail(userId, strategyInstanceId)
      .catch(error => {
        if (this.isStrategyNotFoundError(error)) return null
        throw error
      })
    if (!strategy) {
      await this.conversationsRepo.archiveByIdAndUser(conversationId, userId)
      return
    }

    if (strategy.status === 'running') {
      throw new DomainException('ai_quant.conversation_delete_running_strategy', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { conversationId, strategyInstanceId },
      })
    }

    if (strategy.status !== 'stopped' && strategy.status !== 'draft') {
      throw new DomainException('ai_quant.conversation_delete_strategy_status_unknown', {
        code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
        status: HttpStatus.SERVICE_UNAVAILABLE,
        args: { conversationId, strategyInstanceId, status: strategy.status },
      })
    }

    if (options.deleteStoppedStrategy) {
      await this.accountStrategyViewService.deleteStrategy(userId, strategyInstanceId)
    }

    await this.conversationsRepo.archiveByIdAndUser(conversationId, userId)
  }

  private isStrategyNotFoundError(error: unknown): boolean {
    if (error instanceof DomainException) {
      return error.code === ErrorCode.ACCOUNT_STRATEGY_NOT_FOUND
        || error.message === 'account_strategy.not_found'
        || error.getStatus() === HttpStatus.NOT_FOUND
    }

    if (!error || typeof error !== 'object') return false
    const candidate = error as {
      code?: unknown
      status?: unknown
      statusCode?: unknown
      response?: { code?: unknown; error?: { code?: unknown } }
      error?: { code?: unknown }
      message?: unknown
    }
    return candidate.code === ErrorCode.ACCOUNT_STRATEGY_NOT_FOUND
      || candidate.response?.code === ErrorCode.ACCOUNT_STRATEGY_NOT_FOUND
      || candidate.response?.error?.code === ErrorCode.ACCOUNT_STRATEGY_NOT_FOUND
      || candidate.error?.code === ErrorCode.ACCOUNT_STRATEGY_NOT_FOUND
      || candidate.message === 'account_strategy.not_found'
      || candidate.status === HttpStatus.NOT_FOUND
      || candidate.statusCode === HttpStatus.NOT_FOUND
  }

  private async resolveConversationStrategyInstanceId(codegenSessionId: string): Promise<string | null> {
    const session = await this.sessionsRepo.findById(codegenSessionId)
    if (session?.strategyInstanceId) {
      return session.strategyInstanceId
    }
    const latestSnapshot = await this.publishedSnapshotsRepo.findLatestBySessionId(codegenSessionId)
    return latestSnapshot?.strategyInstanceId ?? null
  }

  async updateConversationBacktestDraft(
    conversationId: string,
    userId: string,
    backtestDraftConfig: AiQuantConversationBacktestConfigDto,
  ): Promise<void> {
    await this.conversationsRepo.updateBacktestDraftConfig({
      conversationId,
      userId,
      backtestDraftConfig,
    })
  }

  async recoverEditConversation(
    userId: string,
    input: RecoverAiQuantEditConversationRequestDto,
  ): Promise<AiQuantConversationResponseDto> {
    const conversationId = this.readNullableString(input.conversationId)
    if (conversationId) {
      const conversation = await this.conversationsRepo.findActiveByIdAndUser(conversationId, userId)
      if (conversation) {
        const response = await this.toConversationResponse(conversation)
        if (
          this.isUsableRecoveredConversationResponse(response)
          && this.recoveredConversationMatchesEditContext(response, input)
        ) {
          return response
        }
      }
    }

    const sessionId = this.readNullableString(input.sessionId)
    if (sessionId) {
      const conversation = await this.conversationsRepo.findActiveByAnyCodegenSessionIdAndUser([sessionId], userId)
      if (conversation) {
        const response = await this.toConversationResponse(conversation)
        if (
          this.isUsableRecoveredConversationResponse(response)
          && this.recoveredConversationMatchesEditContext(response, input)
        ) {
          return response
        }
      }
    }

    const associatedConversation = await this.findActiveConversationResponseForEditContext(userId, input)
    if (associatedConversation) {
      return associatedConversation
    }

    return this.recoverEditConversationFromPublishedSnapshot(userId, input)
  }

  private async findActiveConversationResponseForEditContext(
    userId: string,
    input: RecoverAiQuantEditConversationRequestDto,
  ): Promise<AiQuantConversationResponseDto | null> {
    const strategyInstanceId = this.readNullableString(input.strategyInstanceId)
    const publishedSnapshotId = this.readNullableString(input.publishedSnapshotId)
    if (!strategyInstanceId && !publishedSnapshotId) {
      return null
    }

    const conversations = this.excludeStrategyPlazaRunConversations(await this.conversationsRepo.listByUser(userId))
    for (const conversation of conversations) {
      const response = await this.toConversationResponse(conversation)
      if (!this.isUsableRecoveredConversationResponse(response)) {
        continue
      }
      if (publishedSnapshotId) {
        if (response.publishedSnapshotId === publishedSnapshotId) {
          return response
        }
        continue
      }
      if (strategyInstanceId && response.strategyInstanceId === strategyInstanceId) {
        return response
      }
    }

    return null
  }

  private isUsableRecoveredConversationResponse(
    response: AiQuantConversationResponseDto,
  ): boolean {
    return Boolean(response.activeCodegenSessionId?.trim())
  }

  private recoveredConversationMatchesEditContext(
    response: AiQuantConversationResponseDto,
    input: RecoverAiQuantEditConversationRequestDto,
  ): boolean {
    const publishedSnapshotId = this.readNullableString(input.publishedSnapshotId)
    if (publishedSnapshotId) {
      return this.readRecoveredResponsePublishedSnapshotId(response) === publishedSnapshotId
    }

    const strategyInstanceId = this.readNullableString(input.strategyInstanceId)
    if (strategyInstanceId) {
      return response.strategyInstanceId === strategyInstanceId
    }

    return true
  }

  private readRecoveredResponsePublishedSnapshotId(
    response: AiQuantConversationResponseDto,
  ): string | null {
    if (typeof response.publishedSnapshotId === 'string' && response.publishedSnapshotId.trim().length > 0) {
      return response.publishedSnapshotId.trim()
    }

    const specDesc = response.specDesc
    if (!specDesc || typeof specDesc !== 'object' || Array.isArray(specDesc)) {
      return null
    }
    const candidate = (specDesc as Record<string, unknown>).publishedSnapshotId
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null
  }

  private async recoverEditConversationFromPublishedSnapshot(
    userId: string,
    input: RecoverAiQuantEditConversationRequestDto,
  ): Promise<AiQuantConversationResponseDto> {
    const strategyInstanceId = this.readNullableString(input.strategyInstanceId)
    if (!strategyInstanceId) {
      throw new DomainException('ai_quant.edit_context_not_found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: {
          strategyInstanceId: input.strategyInstanceId,
          publishedSnapshotId: input.publishedSnapshotId,
          source: input.source,
        },
      })
    }

    const publishedSnapshotId = this.readNullableString(input.publishedSnapshotId)
    const snapshot = await this.publishedSnapshotsRepo.findEditableSnapshotForUser({
      userId,
      strategyInstanceId,
      publishedSnapshotId,
    })
    if (!snapshot) {
      throw new DomainException('ai_quant.edit_context_not_found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: {
          strategyInstanceId,
          publishedSnapshotId,
          source: input.source,
        },
      })
    }

    const semanticState = this.recoverSemanticStateFromEditableSnapshot(snapshot)
    const normalization = this.buildNormalizationFromSemanticState(semanticState)
    const canonicalSpec = this.buildCanonicalSpecForConversation(semanticState, normalization)
    const specDesc = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: normalization.normalizedIntent,
      executionContext: this.resolveSemanticClarificationArtifacts(semanticState).executionContext.context,
    })
    const recoveredSpecDesc = {
      ...specDesc,
      publishedSnapshotId: snapshot.id,
    }
    const semanticGraph = this.resolveRecoveredSemanticGraph(snapshot, semanticState)
    const recoveryAssistantMessage = this.buildEditRecoveryAssistantMessage(semanticState)
    const constraintPack = {
      ...createDefaultConstraintPack(),
      conversationHistory: [`A: ${recoveryAssistantMessage}`],
    }

    const session = await this.sessionsRepo.createSession({
      userId,
      status: 'DRAFTING',
      semanticState: semanticState as unknown as Prisma.InputJsonValue,
      clarificationState: this.resolveSemanticClarificationArtifacts(semanticState).clarificationState as unknown as Prisma.InputJsonValue,
      constraintPack: constraintPack as unknown as Prisma.InputJsonValue,
      latestDraftCode: null,
      latestSpecDesc: recoveredSpecDesc as Prisma.InputJsonValue,
      semanticGraph: semanticGraph as Prisma.InputJsonValue,
      rejectReason: null,
      strategyInstanceId: snapshot.strategyInstanceId ?? strategyInstanceId,
    } as unknown as Prisma.LlmStrategyCodegenSessionCreateInput)

    const titleSymbol = this.readRecoveredSnapshotSymbol(snapshot) ?? '上一版'
    const conversation = await this.conversationsRepo.upsertConversationSnapshot({
      userId,
      codegenSessionId: session.id,
      title: `修改 ${titleSymbol} 策略`,
      messages: [{ role: 'assistant', content: recoveryAssistantMessage }],
    })

    return this.toConversationResponse(conversation)
  }

  private buildEditRecoveryAssistantMessage(semanticState: SemanticState): string {
    const view = this.semanticStateProjection.buildConversationView(semanticState)
    const contextParts = [
      view.executionContext.exchange?.toUpperCase(),
      view.executionContext.marketType === 'perp'
        ? '合约'
        : view.executionContext.marketType === 'spot'
          ? '现货'
          : null,
      view.executionContext.symbol,
      view.executionContext.timeframe,
    ].filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    const contextSummary = contextParts.length > 0 ? contextParts.join(' ') : ''
    const semanticSummary = view.summary?.trim() || '已识别部分条件，但仍未完整。'
    const currentStrategy = contextSummary
      ? `${contextSummary}；${semanticSummary}`
      : semanticSummary

    return `${EDIT_RECOVERY_ASSISTANT_MESSAGE}\n当前策略：${currentStrategy}\n请直接说明你要修改的原子语义，例如交易标的、交易所、周期、触发条件、行动、风控或仓位。`
  }

  private recoverSemanticStateFromEditableSnapshot(
    snapshot: EditablePublishedStrategySnapshotRecord,
  ): SemanticState {
    if (this.hasPersistedSemanticState(snapshot.originalSessionSemanticState)) {
      return snapshot.originalSessionSemanticState as unknown as SemanticState
    }

    const state = this.createEmptySemanticState()
    const strategyConfig = this.readJsonRecord(snapshot.strategyConfig)
    const paramsSnapshot = this.readJsonRecord(snapshot.paramsSnapshot)
    const lockedParams = this.readJsonRecord(snapshot.lockedParams)
    const canonicalSpec = this.readJsonRecord(snapshot.specSnapshot)
      ?? this.readJsonRecord(snapshot.originalSessionLatestSpecDesc)
    const canonicalMarket = this.readJsonRecord(canonicalSpec?.market)
    const exchange = this.normalizeRecoveredExchange(
      this.readFirstString(
        strategyConfig?.exchange,
        strategyConfig?.provider,
        strategyConfig?.exchangeId,
        canonicalMarket?.exchange,
        canonicalMarket?.provider,
        canonicalSpec?.exchange,
        canonicalSpec?.provider,
        paramsSnapshot?.exchange,
        paramsSnapshot?.provider,
        paramsSnapshot?.exchangeId,
      ),
    )
    const symbol = this.normalizeRecoveredSymbol(
      this.readFirstString(strategyConfig?.symbol, canonicalMarket?.symbol, canonicalSpec?.symbol, paramsSnapshot?.symbol, lockedParams?.symbol),
    )
    const marketType = this.normalizeRecoveredMarketType(
      this.readFirstString(strategyConfig?.marketType, canonicalMarket?.marketType, canonicalSpec?.marketType, paramsSnapshot?.marketType, lockedParams?.marketType),
    )
    const timeframe = this.readFirstString(
      strategyConfig?.baseTimeframe,
      strategyConfig?.timeframe,
      canonicalMarket?.primaryTimeframe,
      canonicalSpec?.primaryTimeframe,
      this.readFirstArrayString(canonicalSpec?.timeframes),
      paramsSnapshot?.baseTimeframe,
      paramsSnapshot?.timeframe,
      lockedParams?.baseTimeframe,
      lockedParams?.timeframe,
    )

    const recoveredState: SemanticState = {
      ...state,
      position: this.buildRecoveredSnapshotPosition(strategyConfig, paramsSnapshot, lockedParams),
      contextSlots: {
        exchange: exchange ? this.buildRecoveredContextSlot('exchange', exchange) : null,
        symbol: symbol ? this.buildRecoveredContextSlot('symbol', symbol) : null,
        marketType: marketType ? this.buildRecoveredContextSlot('marketType', marketType) : null,
        timeframe: timeframe ? this.buildRecoveredContextSlot('timeframe', timeframe) : null,
      },
    }

    return this.hydrateRecoveredSemanticStateFromCanonicalSpec(recoveredState, snapshot)
  }

  private hydrateRecoveredSemanticStateFromCanonicalSpec(
    state: SemanticState,
    snapshot: EditablePublishedStrategySnapshotRecord,
  ): SemanticState {
    if (state.triggers.length > 0 || state.actions.length > 0 || state.risk.length > 0) {
      return state
    }

    const spec = this.readJsonRecord(snapshot.specSnapshot)
      ?? this.readJsonRecord(snapshot.originalSessionLatestSpecDesc)
    const rules = Array.isArray(spec?.rules) ? spec.rules : []
    const triggers: SemanticTriggerState[] = []
    const actions: SemanticActionState[] = []

    for (const rule of rules) {
      const ruleRecord = this.readJsonRecord(rule)
      const trigger = this.buildRecoveredTriggerFromCanonicalRule(ruleRecord, triggers.length)
      if (trigger) {
        triggers.push(trigger)
      }

      actions.push(...this.buildRecoveredActionsFromCanonicalRule(ruleRecord, actions.length))
    }

    const risk = this.buildRecoveredRiskFromCanonicalSpec(spec)
    if (triggers.length === 0 && actions.length === 0 && risk.length === 0) {
      return state
    }

    return {
      ...state,
      triggers,
      actions,
      risk,
      updatedAt: new Date().toISOString(),
    }
  }

  private buildRecoveredTriggerFromCanonicalRule(
    rule: Record<string, unknown> | null,
    index: number,
  ): SemanticTriggerState | null {
    const condition = this.readJsonRecord(rule?.condition)
    const key = this.readStringValue(condition?.key)
    if (!key) return null

    const phase = rule?.phase === 'exit' || rule?.phase === 'risk' ? rule.phase : 'entry'
    const params = this.readJsonRecord(condition?.params) ?? {}
    const triggerKey = this.mapCanonicalConditionKeyToSemanticTriggerKey(key)
    if (!triggerKey) return null

    const triggerParams = this.buildRecoveredTriggerParamsFromCanonicalCondition(key, condition, params)
    return {
      id: this.readStringValue(rule?.id) ?? `recovered-trigger-${index + 1}`,
      key: triggerKey,
      phase,
      params: triggerParams,
      sideScope: this.readSemanticSideScope(rule?.sideScope),
      status: 'locked',
      source: 'derived',
      evidence: {
        text: 'published snapshot canonical spec',
        source: 'derived',
      },
      openSlots: [],
    }
  }

  private mapCanonicalConditionKeyToSemanticTriggerKey(key: string): string | null {
    const map: Record<string, string> = {
      'ma.golden_cross': 'indicator.cross_over',
      'ma.death_cross': 'indicator.cross_under',
      'macd.golden_cross': 'indicator.cross_over',
      'macd.death_cross': 'indicator.cross_under',
      'rsi.cross_over': 'indicator.cross_over',
      'rsi.cross_under': 'indicator.cross_under',
      'rsi.threshold_lte': 'oscillator.rsi_lte',
      'rsi.threshold_gte': 'oscillator.rsi_gte',
      'price.percent_change': 'price.percent_change',
      'price.range_position_lte': 'price.range_position_lte',
      'price.range_position_gte': 'price.range_position_gte',
      'price.breakout_up': 'price.breakout_up',
      'price.breakout_down': 'price.breakout_down',
      'bollinger.upper_break': 'bollinger.touch_upper',
      'bollinger.lower_break': 'bollinger.touch_lower',
      'bollinger.middle_revert': 'bollinger.touch_middle',
      'trend.direction': 'trend.direction',
      'market.regime': 'market.regime',
      'volatility.state': 'volatility.state',
    }
    return map[key] ?? null
  }

  private buildRecoveredTriggerParamsFromCanonicalCondition(
    key: string,
    condition: Record<string, unknown>,
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    if (key.startsWith('ma.')) {
      return {
        indicator: this.readStringValue(params.indicator) ?? 'sma',
        ...this.copyNumberParam(params, 'fastPeriod'),
        ...this.copyNumberParam(params, 'slowPeriod'),
      }
    }
    if (key.startsWith('macd.')) {
      return {
        indicator: 'macd',
        ...this.copyNumberParam(params, 'fastPeriod'),
        ...this.copyNumberParam(params, 'slowPeriod'),
        ...this.copyNumberParam(params, 'signalPeriod'),
      }
    }
    if (key.startsWith('rsi.cross')) {
      return {
        indicator: 'rsi',
        ...this.copyNumberParam(params, 'period'),
        ...this.copyNumberValue(condition, 'value'),
      }
    }
    if (key === 'rsi.threshold_lte' || key === 'rsi.threshold_gte') {
      return {
        ...this.copyNumberParam(params, 'period'),
        ...this.copyNumberValue(condition, 'value'),
      }
    }

    return { ...params }
  }

  private buildRecoveredActionsFromCanonicalRule(
    rule: Record<string, unknown> | null,
    offset: number,
  ): SemanticActionState[] {
    const rawActions = Array.isArray(rule?.actions) ? rule.actions : []
    return rawActions
      .map((action, index): SemanticActionState | null => {
        const actionRecord = this.readJsonRecord(action)
        const key = this.mapCanonicalActionTypeToSemanticActionKey(this.readStringValue(actionRecord?.type))
        if (!key) return null
        return {
          id: this.readStringValue(actionRecord?.id) ?? `recovered-action-${offset + index + 1}`,
          key,
          params: {},
          status: 'locked',
          source: 'derived',
          evidence: {
            text: 'published snapshot canonical spec',
            source: 'derived',
          },
        }
      })
      .filter((action): action is SemanticActionState => action !== null)
  }

  private mapCanonicalActionTypeToSemanticActionKey(type: string | null): string | null {
    const map: Record<string, string> = {
      OPEN_LONG: 'open_long',
      CLOSE_LONG: 'close_long',
      OPEN_SHORT: 'open_short',
      CLOSE_SHORT: 'close_short',
      REDUCE_POSITION: 'reduce_position',
    }
    return type ? (map[type] ?? null) : null
  }

  private buildRecoveredRiskFromCanonicalSpec(spec: Record<string, unknown> | null): SemanticRiskState[] {
    const riskRules = this.readJsonRecord(spec?.riskRules)
    const risk: SemanticRiskState[] = []
    const stopLossPct = this.readPositiveNumber(riskRules?.stopLossPct)
    if (stopLossPct !== null) {
      risk.push(this.buildRecoveredRiskAtom('recovered-risk-stop-loss', 'risk.stop_loss_pct', stopLossPct))
    }
    const takeProfitPct = this.readPositiveNumber(riskRules?.takeProfitPct)
    if (takeProfitPct !== null) {
      risk.push(this.buildRecoveredRiskAtom('recovered-risk-take-profit', 'risk.take_profit_pct', takeProfitPct))
    }
    return risk
  }

  private buildRecoveredRiskAtom(id: string, key: string, valuePct: number): SemanticRiskState {
    return {
      id,
      key,
      params: { valuePct },
      status: 'locked',
      source: 'derived',
      evidence: {
        text: 'published snapshot canonical spec',
        source: 'derived',
      },
      openSlots: [],
    }
  }

  private readSemanticSideScope(value: unknown): 'long' | 'short' | 'both' | undefined {
    if (value === 'long' || value === 'short' || value === 'both') return value
    return undefined
  }

  private copyNumberParam(source: Record<string, unknown>, key: string): Record<string, number> {
    const value = this.readPositiveNumber(source[key])
    return value === null ? {} : { [key]: value }
  }

  private copyNumberValue(source: Record<string, unknown>, key: string): Record<string, number> {
    const value = this.readPositiveNumber(source[key])
    return value === null ? {} : { [key]: value }
  }

  private resolveRecoveredSemanticGraph(
    snapshot: EditablePublishedStrategySnapshotRecord,
    semanticState: SemanticState,
  ): Record<string, unknown> {
    return this.readJsonRecord(snapshot.semanticGraph) ?? this.buildMinimalSemanticGraphFromState(semanticState)
  }

  private buildMinimalSemanticGraphFromState(
    semanticState: SemanticState,
  ): Record<string, unknown> {
    return {
      version: 1,
      market: {
        symbol: this.readSemanticContextValue(semanticState.contextSlots.symbol) ?? 'UNKNOWN',
        primaryTimeframe: this.readSemanticContextValue(semanticState.contextSlots.timeframe) ?? '1h',
      },
      nodes: [],
      actions: [],
      risk: [],
    }
  }

  private buildSemanticEditArtifactReset(
    semanticState: SemanticState,
  ): Pick<Prisma.LlmStrategyCodegenSessionUpdateInput, 'latestDraftCode' | 'rejectReason' | 'validationReport' | 'semanticGraph'> {
    return {
      latestDraftCode: null,
      rejectReason: null,
      validationReport: null,
      semanticGraph: this.buildMinimalSemanticGraphFromState(semanticState) as Prisma.InputJsonValue,
    }
  }

  private buildRecoveredSnapshotPosition(
    strategyConfig: Record<string, unknown> | null,
    paramsSnapshot: Record<string, unknown> | null,
    lockedParams: Record<string, unknown> | null,
  ): SemanticState['position'] {
    const directRatio = this.readFirstPositiveNumber(
      strategyConfig?.positionSizeRatio,
      paramsSnapshot?.positionSizeRatio,
      lockedParams?.positionSizeRatio,
    )
    const percent = this.readFirstPositiveNumber(
      strategyConfig?.positionSizeRatioPercent,
      strategyConfig?.positionPct,
      paramsSnapshot?.positionSizeRatioPercent,
      paramsSnapshot?.positionPct,
      lockedParams?.positionSizeRatioPercent,
      lockedParams?.positionPct,
    )
    const value = directRatio ?? (percent !== null ? this.normalizePercentToRatio(percent) : null)
    if (value === null) {
      return null
    }

    return {
      mode: 'fixed_ratio',
      value,
      positionMode: this.readFirstString(
        strategyConfig?.positionMode,
        paramsSnapshot?.positionMode,
        lockedParams?.positionMode,
      ) ?? 'long_only',
      status: 'locked',
      source: 'derived',
      evidence: {
        text: 'published snapshot structured strategy config',
        source: 'derived',
      },
    }
  }

  private buildRecoveredContextSlot(
    slotKey: 'exchange' | 'symbol' | 'marketType' | 'timeframe',
    value: string,
  ): SemanticSlotState {
    const hints: Record<typeof slotKey, string> = {
      exchange: '请确认交易所。',
      symbol: '请确认交易标的。',
      marketType: '请确认市场类型（现货或合约/perp）。',
      timeframe: '请确认主周期。',
    }

    return {
      slotKey,
      fieldPath: `contextSlots.${slotKey}`,
      value,
      status: 'locked',
      priority: 'context',
      questionHint: hints[slotKey],
      affectsExecution: true,
      evidence: {
        text: 'published snapshot structured strategy config',
        source: 'derived',
      },
    }
  }

  private readRecoveredSnapshotSymbol(snapshot: EditablePublishedStrategySnapshotRecord): string | null {
    const strategyConfig = this.readJsonRecord(snapshot.strategyConfig)
    const paramsSnapshot = this.readJsonRecord(snapshot.paramsSnapshot)
    const canonicalSpec = this.readJsonRecord(snapshot.specSnapshot)
      ?? this.readJsonRecord(snapshot.originalSessionLatestSpecDesc)
    const canonicalMarket = this.readJsonRecord(canonicalSpec?.market)
    return this.normalizeRecoveredSymbol(
      this.readFirstString(strategyConfig?.symbol, canonicalMarket?.symbol, canonicalSpec?.symbol, paramsSnapshot?.symbol),
    )
  }

  private readFirstString(...values: unknown[]): string | null {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
    return null
  }

  private readFirstArrayString(value: unknown): string | null {
    if (!Array.isArray(value)) return null
    return this.readFirstString(...value)
  }

  private readFirstPositiveNumber(...values: unknown[]): number | null {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value
      }
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value.trim())
        if (Number.isFinite(parsed) && parsed > 0) {
          return parsed
        }
      }
    }
    return null
  }

  private normalizePercentToRatio(value: number): number {
    return value > 1 ? value / 100 : value
  }

  private normalizeRecoveredExchange(value: string | null): string | null {
    return value?.trim().toLowerCase() || null
  }

  private normalizeRecoveredSymbol(value: string | null): string | null {
    return value ? normalizePublishedSymbol(value) : null
  }

  private normalizeRecoveredMarketType(value: string | null): 'spot' | 'perp' | null {
    const normalized = value?.trim().toLowerCase()
    if (!normalized) {
      return null
    }
    if (normalized === 'spot') {
      return 'spot'
    }
    if (normalized === 'perp' || normalized === 'swap' || normalized === 'perpetual' || normalized === 'futures') {
      return 'perp'
    }
    return null
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
    const currentSemanticState = this.readSemanticState((session as { semanticState?: Prisma.JsonValue | null }).semanticState)
    if (dto.confirmGenerate !== true && this.isLikelyUserSubmittedScriptCode(dto.message)) {
      return this.handleUserSubmittedScriptCode(session, dto.message, sessionUserId)
    }
    let semanticEditDecision: SemanticEditDecision = { kind: 'NO_EDIT' }
    if (dto.confirmGenerate !== true) {
      semanticEditDecision = this.conversationSemanticEdit.decide({
        status: session.status,
        message: dto.message,
        semanticState: currentSemanticState,
      })
    }
    const hasPublishedUnsupportedEditIntent = session.status === 'PUBLISHED'
      && semanticEditDecision.kind === 'NO_EDIT'
      && this.conversationSemanticEdit.hasEditIntent({
        status: session.status,
        message: dto.message,
        semanticState: currentSemanticState,
      })
    const hasTerminalPlannerEditIntent = this.stateMachine.isTerminalStatus(session.status)
      && semanticEditDecision.kind === 'NO_EDIT'
      && this.conversationSemanticEdit.hasEditIntent({
        status: session.status,
        message: dto.message,
        semanticState: currentSemanticState,
      })
    const canEditPublishedSession = session.status === 'PUBLISHED'
      && (semanticEditDecision.kind !== 'NO_EDIT' || hasTerminalPlannerEditIntent)
    const canEditFailedSession = (session.status === 'REJECTED' || session.status === 'CONSISTENCY_FAILED')
      && (semanticEditDecision.kind !== 'NO_EDIT' || hasTerminalPlannerEditIntent)
    if (this.stateMachine.isTerminalStatus(session.status) && !canEditPublishedSession && !canEditFailedSession) {
      throw new DomainException('codegen.session_terminal_status', {
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { sessionId, status: session.status },
      })
    }
    if (dto.confirmGenerate === true) {
      return this.continueConfirmedSession(session, dto, sessionUserId)
    }

    if (semanticEditDecision.kind !== 'NO_EDIT') {
      const semanticEditResponse = await this.handleSemanticEditDecision({
        session,
        decision: semanticEditDecision,
        currentSemanticState,
        message: dto.message,
        userId: sessionUserId,
        guideConfig: dto.guideConfig,
        providerCode: dto.providerCode,
        model: dto.model,
      })
      if (semanticEditResponse) return semanticEditResponse
    }

    if (hasPublishedUnsupportedEditIntent && !hasTerminalPlannerEditIntent) {
      const response = this.finalizeSessionResponse({
        id: session.id,
        status: session.status,
        missingFields: [],
        assistantPrompt: '我识别到你想修改策略语义。当前可直接修改交易标的、主周期、交易所、市场类型，或说“之前策略不对，重新做一个...”来重建策略。止损、行动、仓位等语义修改请补充成完整规则后再继续。',
        clarificationState: this.readClarificationState(session.clarificationState),
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    if (this.stateMachine.isTerminalStatus(session.status) && !hasTerminalPlannerEditIntent) {
      throw new DomainException('codegen.session_terminal_status', {
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { sessionId, status: session.status },
      })
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
    const semanticStateAfterAnswers = this.applySemanticClarificationAnswers(
      currentSemanticState,
      baseClarificationState,
      effectiveClarificationAnswers,
    )
    const inferredConfirmation = await this.withConfirmedInferredDecisionKeys(
      this.readConstraintPack(session.constraintPack),
      semanticStateAfterAnswers,
      dto.message,
      {
        providerCode: this.resolveProviderCode(dto.providerCode),
        model: dto.model,
      },
    )
    const baseSemanticState = inferredConfirmation.semanticState
    const baseLogicSnapshot = this.buildLegacyLogicSnapshotProjectionForCompatibility(baseSemanticState, {})
    const clarificationStateAfterAnswers = hasStructuredClarificationAnswers
      ? this.resolveSemanticClarificationArtifacts(baseSemanticState).clarificationState
      : this.withClarificationSummary(baseClarificationState, baseLogicSnapshot)
    const preMergedSemanticState = this.mergeSemanticPatchIntoState(
      baseSemanticState,
      this.extractSemanticPatchFromMessage(dto.message),
    )
    const preMergedLogicSnapshot = this.buildLegacyLogicSnapshotProjectionForCompatibility(preMergedSemanticState, {})
    const constraintPack = inferredConfirmation.constraintPack
    const guidePrompt = this.mergeGuidePromptConfig(constraintPack.guidePrompt, dto.guideConfig)
    const plan = await this.planConversationByLlm(dto.message, preMergedSemanticState, {
      providerCode: this.resolveProviderCode(dto.providerCode),
      model: dto.model,
    }, constraintPack.conversationHistory ?? [])
    const plannedSemanticState = this.applyConversationPlanToSemanticState({
      currentState: preMergedSemanticState,
      plan,
    })
    const reducedSemanticState = plannedSemanticState
    const canonicalLogicSnapshot = this.buildLegacyLogicSnapshotProjectionForCompatibility(reducedSemanticState, {})
    const semanticArtifacts = this.resolveSemanticClarificationArtifacts(reducedSemanticState)
    const clarificationState = semanticArtifacts.clarificationState
    const semanticReadyForGenerate = this.findNextOpenSemanticSlot(reducedSemanticState) === null
    const clarificationPrompt = semanticArtifacts.clarificationPrompt
    const recommendationStyle = this.inferRecommendationStyleFromSemanticContext(
      dto.message,
      reducedSemanticState,
      constraintPack.recommendationStyle,
    )
    const nextConstraintPack = this.withGuidePrompt(constraintPack, guidePrompt, recommendationStyle)
    const normalization = semanticArtifacts.normalization
    const canonicalSpec = this.buildCanonicalSpecForConversation(reducedSemanticState, normalization)
    const specDesc = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: normalization.normalizedIntent,
      executionContext: semanticArtifacts.executionContext.context,
    })
    const canonicalDigest = this.readCanonicalDigest(specDesc)
    const compileability = this.evaluateCanonicalCompileability(canonicalSpec)
    const decision = this.buildStrategyDecision({
      checklist: canonicalLogicSnapshot,
      clarification: semanticArtifacts,
      effectiveBlockingReasons: semanticArtifacts.blockingReasons,
      compileability,
      constraintPack: nextConstraintPack,
    })
    const decisionPrompt = decision.kind === 'CONFIRM_INFERRED'
      ? this.clarificationQuestion.buildFromDecision(decision)
      : semanticArtifacts.clarificationPrompt
    const deterministicAuthority = this.resolveContinueSessionDeterministicAuthority({
      semanticState: reducedSemanticState,
      clarificationState,
      normalization,
      compileability,
      decisionKind: decision.kind,
      semanticReadyForGenerate,
    })
    const semanticStateChanged = JSON.stringify(reducedSemanticState) !== JSON.stringify(preMergedSemanticState)
    const terminalPlannerEditArtifactReset = this.stateMachine.isTerminalStatus(session.status)
      ? this.buildSemanticEditArtifactReset(reducedSemanticState)
      : {}

    if (deterministicAuthority) {
      const assistantPrompt = deterministicAuthority === 'clarification'
        ? (clarificationPrompt || '请先澄清这条规则，我再继续完善逻辑图。')
        : deterministicAuthority === 'decision'
          ? (decisionPrompt || '请先确认当前推断，我再继续整理逻辑图。')
          : deterministicAuthority === 'normalization'
            ? this.buildSemanticNormalizationAssistantPrompt(reducedSemanticState, normalization)
            : deterministicAuthority === 'compileability'
              ? this.buildCompileabilityAssistantPrompt(compileability)
              : this.buildSemanticLogicGateAssistantPrompt(reducedSemanticState)
      const targetStatus = deterministicAuthority === 'confirm_gate' ? 'CONFIRM_GATE' : 'DRAFTING'
      const shouldPersistDecisionSpecDesc = deterministicAuthority === 'decision' && hasStructuredClarificationAnswers
      const shouldPersistDeterministicOutcome = plan.related
        || hasStructuredClarificationAnswers
        || inferredConfirmation.consumed
        || semanticStateChanged
        || session.status !== targetStatus

      if (!shouldPersistDeterministicOutcome && !plan.related) {
        const response = this.finalizeSessionResponse({
          id: session.id,
          status: targetStatus,
          missingFields: [],
          ...(deterministicAuthority === 'confirm_gate'
            ? {
                specDesc,
                canonicalDigest,
              }
            : {}),
          ...(shouldPersistDecisionSpecDesc
            ? {
                specDesc,
                canonicalDigest,
              }
            : {}),
          ...(deterministicAuthority === 'normalization'
            ? { specDesc }
            : {}),
          assistantPrompt,
          clarificationState,
        })
        return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
      }

      const historyAfterDeterministicOutcome = this.appendConversationHistory(
        constraintPack.conversationHistory ?? [],
        dto.message,
        assistantPrompt,
      )
      await this.sessionsRepo.updateSession(session.id, {
        ...this.stateMachine.buildConversationUpdate({
          status: targetStatus,
          semanticState: reducedSemanticState,
          clarificationState,
          constraintPack: {
            ...nextConstraintPack,
            conversationHistory: historyAfterDeterministicOutcome,
          },
          ...(deterministicAuthority === 'confirm_gate' || deterministicAuthority === 'normalization' || shouldPersistDecisionSpecDesc
            ? { latestSpecDesc: specDesc }
            : {}),
        }),
        ...terminalPlannerEditArtifactReset,
      } as Prisma.LlmStrategyCodegenSessionUpdateInput)

      const response = this.finalizeSessionResponse({
        id: session.id,
        status: targetStatus,
        missingFields: [],
        ...(deterministicAuthority === 'confirm_gate'
          ? {
              specDesc,
              canonicalDigest,
            }
          : {}),
        ...(shouldPersistDecisionSpecDesc
          ? {
              specDesc,
              canonicalDigest,
            }
          : {}),
        ...(deterministicAuthority === 'normalization'
          ? { specDesc }
          : {}),
        assistantPrompt,
        clarificationState,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    if (!plan.related) {
      if (hasStructuredClarificationAnswers) {
        return this.continueWithStructuredClarificationAnswers({
          session,
          checklist: baseLogicSnapshot,
          semanticState: baseSemanticState,
          clarificationState: clarificationStateAfterAnswers,
          constraintPack,
          message: dto.message,
          userId: sessionUserId,
        })
      }
      if (inferredConfirmation.consumed) {
        const assistantPrompt = plan.assistantPrompt || '这条消息看起来和策略无关。请描述交易逻辑或修改条件。'
        const consumedUnrelatedStatus = session.status === 'CONFIRM_GATE' ? 'CONFIRM_GATE' : 'DRAFTING'
        const historyAfterConsumedUnrelated = this.appendConversationHistory(
          constraintPack.conversationHistory ?? [],
          dto.message,
          assistantPrompt,
        )
        await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
          status: consumedUnrelatedStatus,
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
    const historyAfterPlanner = this.appendConversationHistory(
      constraintPack.conversationHistory ?? [],
      dto.message,
      plan.assistantPrompt,
    )

    if (!plan.logicReady) {
      await this.sessionsRepo.updateSession(session.id, {
        ...this.stateMachine.buildConversationUpdate({
          status: 'DRAFTING',
          semanticState: reducedSemanticState,
          clarificationState,
          constraintPack: {
            ...nextConstraintPack,
            conversationHistory: historyAfterPlanner,
          },
        }),
        ...terminalPlannerEditArtifactReset,
      } as Prisma.LlmStrategyCodegenSessionUpdateInput)

      const response = this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: plan.assistantPrompt,
        clarificationState,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    const response = this.finalizeSessionResponse({
      id: session.id,
      status: 'DRAFTING',
      missingFields: [],
      assistantPrompt: plan.assistantPrompt,
      clarificationState,
    })
    return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
  }

  private async handleUserSubmittedScriptCode(
    session: PersistedConversationSessionForContinue,
    message: string,
    userId: string,
  ): Promise<CodegenSessionResponseDto> {
    const scriptCode = message.trim()
    if (session.status !== 'PUBLISHED') {
      const assistantPrompt = '现在还不能直接发送脚本代码。请用策略想法、触发条件、行动、风控、仓位和运行 context 来描述策略；确认逻辑图并生成脚本后，才可以粘贴修改后的脚本代码进行替换。'
      const constraintPack = this.readConstraintPack(session.constraintPack)
      const semanticState = this.readSemanticState((session as { semanticState?: Prisma.JsonValue | null }).semanticState)
      const clarificationState = this.readClarificationState(session.clarificationState)
      const targetStatus = session.status === 'CONFIRM_GATE' ? 'CONFIRM_GATE' : 'DRAFTING'
      await this.sessionsRepo.updateSession(session.id, {
        ...this.stateMachine.buildConversationUpdate({
          status: targetStatus,
          semanticState,
          clarificationState,
          constraintPack: {
            ...constraintPack,
            conversationHistory: this.appendConversationHistory(
              constraintPack.conversationHistory ?? [],
              message,
              assistantPrompt,
            ),
          },
        }),
      } as Prisma.LlmStrategyCodegenSessionUpdateInput)

      const response = this.finalizeSessionResponse({
        id: session.id,
        status: targetStatus,
        missingFields: [],
        assistantPrompt,
        clarificationState,
      })
      return this.returnPersistedSessionResponse(session.id, userId, response)
    }

    return this.replacePublishedScriptWithUserSubmittedCode(session, scriptCode, userId)
  }

  private async replacePublishedScriptWithUserSubmittedCode(
    session: PersistedConversationSessionForContinue,
    scriptCode: string,
    userId: string,
  ): Promise<CodegenSessionResponseDto> {
    const latestSnapshot = await this.publishedSnapshotsRepo.findLatestBySessionId(session.id)
    const sessionSpecDesc = this.readJsonRecord(session.latestSpecDesc)
    const snapshotSpecDesc = this.readJsonRecord(latestSnapshot?.specSnapshot)
    const specDesc = {
      ...(snapshotSpecDesc ?? {}),
      ...(sessionSpecDesc ?? {}),
    }
    const consistencyReport = {
      status: 'MANUAL_REPLACEMENT',
      source: 'user_submitted_script',
      message: '用户在脚本生成后手动替换了脚本代码，后续回测和部署使用该脚本快照。',
    }
    const strategyInstanceId = this.readNullableString(session.strategyInstanceId ?? latestSnapshot?.strategyInstanceId)
    const strategyTemplateId = this.readNullableString(latestSnapshot?.strategyTemplateId)

    await this.sessionsRepo.createVersion({
      session: { connect: { id: session.id } },
      scriptCode,
      specDesc: specDesc as Prisma.InputJsonValue,
      staticPassed: true,
      runtimePassed: true,
      outputPassed: true,
    })

    const snapshot = await this.publishedSnapshotsRepo.create({
      sessionId: session.id,
      strategyTemplateId,
      strategyInstanceId,
      scriptSnapshot: scriptCode,
      specSnapshot: specDesc,
      semanticGraph: this.readJsonRecord(latestSnapshot?.semanticGraph),
      compiledIr: null,
      irSnapshot: null,
      astSnapshot: null,
      compiledManifest: null,
      consistencyReport,
      userIntentSummary: this.readJsonRecord(latestSnapshot?.userIntentSummary) ?? {},
      strategySummary: this.readJsonRecord(latestSnapshot?.strategySummary) ?? {},
      scriptSummary: {
        source: 'user_submitted_script',
        preview: scriptCode.slice(0, 120),
      },
      lockedParams: this.readJsonRecord(latestSnapshot?.lockedParams) ?? {},
      paramsSnapshot: this.readJsonRecord(latestSnapshot?.paramsSnapshot),
      strategyConfig: this.readJsonRecord(latestSnapshot?.strategyConfig),
      backtestConfigDefaults: this.readJsonRecord(latestSnapshot?.backtestConfigDefaults),
      deploymentExecutionDefaults: this.readJsonRecord(latestSnapshot?.deploymentExecutionDefaults),
      deploymentExecutionConstraints: this.readJsonRecord(latestSnapshot?.deploymentExecutionConstraints),
      executionEnvelope: null,
      executionPolicy: this.readJsonRecord(latestSnapshot?.executionPolicy),
      dataRequirements: this.readJsonRecord(latestSnapshot?.dataRequirements),
    })
    const nextSpecDesc = {
      ...specDesc,
      consistencyReport,
      publishedSnapshotId: snapshot.id,
    }
    const constraintPack = this.readConstraintPack(session.constraintPack)
    const assistantPrompt = '已替换为你提供的脚本代码。后续回测和部署会使用这份新的脚本快照。'

    await this.sessionsRepo.updateSession(session.id, {
      ...this.stateMachine.buildPublishedUpdate({
        latestDraftCode: scriptCode,
        latestSpecDesc: nextSpecDesc,
        strategyInstanceId,
      }),
      constraintPack: {
        ...constraintPack,
        conversationHistory: this.appendConversationHistory(
          constraintPack.conversationHistory ?? [],
          scriptCode,
          assistantPrompt,
        ),
      } as unknown as Prisma.InputJsonValue,
    } as Prisma.LlmStrategyCodegenSessionUpdateInput)

    if (strategyInstanceId) {
      await this.sessionsRepo.bindPublishedSnapshotToStrategyInstance?.({
        strategyInstanceId,
        userId,
        publishedSnapshotId: snapshot.id,
        snapshotHash: snapshot.snapshotHash,
        strategyTemplateId,
      })
    }

    const publishedSnapshotProjection = this.buildPublishedSnapshotProjection({
      publishedSnapshotId: snapshot.id,
      snapshot: latestSnapshot ? { ...latestSnapshot, id: snapshot.id, scriptSnapshot: scriptCode } : null,
      strategyInstanceId,
    })
    const response = this.finalizeSessionResponse({
      id: session.id,
      status: 'PUBLISHED',
      missingFields: [],
      assistantPrompt,
      scriptCode,
      publishedSnapshotId: snapshot.id,
      specDesc: nextSpecDesc,
      canonicalDigest: this.readCanonicalDigest(nextSpecDesc),
      strategyInstanceId,
      consistencyReport,
      ...publishedSnapshotProjection,
    })
    return this.returnPersistedSessionResponse(session.id, userId, response)
  }

  private async handleSemanticEditDecision(args: {
    session: PersistedConversationSessionForContinue
    decision: Exclude<SemanticEditDecision, { kind: 'NO_EDIT' }>
    currentSemanticState: SemanticState
    message: string
    userId: string
    guideConfig?: CodegenGuideConfigDto
    providerCode?: string
    model?: string
  }): Promise<CodegenSessionResponseDto | null> {
    if (args.decision.kind === 'REGENERATE_SCRIPT_VERSION') {
      return null
    }

    const constraintPack = this.readConstraintPack(args.session.constraintPack)

    if (args.decision.kind === 'REPLACE_STRATEGY_DRAFT') {
      const seedSemanticState = this.createEmptySemanticState()
      const plan = await this.planConversationByLlm(args.decision.seedText, seedSemanticState, {
        providerCode: this.resolveProviderCode(args.providerCode),
        model: args.model,
      }, [])
      const plannedSemanticState = this.applyConversationPlanToSemanticState({
        currentState: seedSemanticState,
        plan,
      })
      const replacementState = buildReplacementSemanticState({
        previous: args.currentSemanticState,
        next: plannedSemanticState,
      })
      const semanticArtifacts = this.resolveSemanticClarificationArtifacts(replacementState)
      const clarificationState = semanticArtifacts.clarificationState
      const semanticReadyForGenerate = this.findNextOpenSemanticSlot(replacementState) === null
      const normalization = semanticArtifacts.normalization
      const canonicalSpec = this.buildCanonicalSpecForConversation(replacementState, normalization)
      const specDesc = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
        normalizedIntent: normalization.normalizedIntent,
        executionContext: semanticArtifacts.executionContext.context,
      })
      const canonicalDigest = this.readCanonicalDigest(specDesc)
      const compileability = this.evaluateCanonicalCompileability(canonicalSpec)
      const canonicalLogicSnapshot = this.buildLegacyLogicSnapshotProjectionForCompatibility(replacementState, {})
      const guidePrompt = this.mergeGuidePromptConfig(constraintPack.guidePrompt, args.guideConfig)
      const recommendationStyle = this.inferRecommendationStyleFromSemanticContext(
        args.decision.seedText,
        replacementState,
        constraintPack.recommendationStyle,
      )
      const nextConstraintPack = this.withGuidePrompt(constraintPack, guidePrompt, recommendationStyle)
      const strategyDecision = this.buildStrategyDecision({
        checklist: canonicalLogicSnapshot,
        clarification: semanticArtifacts,
        effectiveBlockingReasons: semanticArtifacts.blockingReasons,
        compileability,
        constraintPack: nextConstraintPack,
      })
      const decisionPrompt = strategyDecision.kind === 'CONFIRM_INFERRED'
        ? this.clarificationQuestion.buildFromDecision(strategyDecision)
        : semanticArtifacts.clarificationPrompt
      const deterministicAuthority = this.resolveContinueSessionDeterministicAuthority({
        semanticState: replacementState,
        clarificationState,
        normalization,
        compileability,
        decisionKind: strategyDecision.kind,
        semanticReadyForGenerate,
      })
      const assistantPrompt = deterministicAuthority === 'clarification'
        ? (semanticArtifacts.clarificationPrompt || '请先澄清这条规则，我再继续完善逻辑图。')
        : deterministicAuthority === 'decision'
          ? (decisionPrompt || '请先确认当前推断，我再继续整理逻辑图。')
          : deterministicAuthority === 'normalization'
            ? this.buildSemanticNormalizationAssistantPrompt(replacementState, normalization)
            : deterministicAuthority === 'compileability'
              ? this.buildCompileabilityAssistantPrompt(compileability)
              : deterministicAuthority === 'confirm_gate'
                ? this.buildSemanticLogicGateAssistantPrompt(replacementState)
                : (plan.assistantPrompt || '我已按你的新描述重新创建策略草稿，请继续补充缺失语义。')
      const targetStatus = deterministicAuthority === 'confirm_gate' ? 'CONFIRM_GATE' : 'DRAFTING'
      const historyAfterReplacement = this.appendConversationHistory(
        [],
        args.message,
        assistantPrompt,
      )
      await this.sessionsRepo.updateSession(args.session.id, {
        ...this.stateMachine.buildConversationUpdate({
          status: targetStatus,
          semanticState: replacementState,
          clarificationState,
          constraintPack: {
            ...nextConstraintPack,
            conversationHistory: historyAfterReplacement,
          },
          latestSpecDesc: specDesc,
        }),
        latestDraftCode: null,
        rejectReason: null,
        validationReport: null,
        semanticGraph: this.buildMinimalSemanticGraphFromState(replacementState) as Prisma.InputJsonValue,
      } as Prisma.LlmStrategyCodegenSessionUpdateInput)

      const response = this.finalizeSessionResponse({
        id: args.session.id,
        status: targetStatus,
        missingFields: [],
        ...(deterministicAuthority === 'confirm_gate' || deterministicAuthority === 'decision'
          ? {
              specDesc,
              canonicalDigest,
            }
          : {}),
        ...(deterministicAuthority === 'normalization' ? { specDesc } : {}),
        assistantPrompt,
        clarificationState,
      })
      return this.returnPersistedSessionResponse(args.session.id, args.userId, response)
    }

    if (args.decision.kind === 'REJECT_WHILE_PROCESSING') {
      const response = this.finalizeSessionResponse({
        id: args.session.id,
        status: args.session.status,
        missingFields: [],
        assistantPrompt: args.decision.message,
        clarificationState: this.readClarificationState(args.session.clarificationState),
      })
      return this.returnPersistedSessionResponse(args.session.id, args.userId, response)
    }

    if (args.decision.kind === 'ASK_EDIT_CLARIFICATION') {
      const nextState = withPendingSemanticEdit(args.currentSemanticState, args.decision.pendingEdit)
      const semanticArtifacts = this.resolveSemanticClarificationArtifacts(nextState)
      const shouldClearFailedArtifacts = args.session.status === 'REJECTED'
        || args.session.status === 'CONSISTENCY_FAILED'
      const historyAfterQuestion = this.appendConversationHistory(
        constraintPack.conversationHistory ?? [],
        args.message,
        args.decision.question,
      )
      await this.sessionsRepo.updateSession(args.session.id, {
        ...this.stateMachine.buildConversationUpdate({
          status: 'DRAFTING',
          semanticState: nextState,
          clarificationState: semanticArtifacts.clarificationState,
          constraintPack: {
            ...constraintPack,
            conversationHistory: historyAfterQuestion,
          },
          latestSpecDesc: args.session.status === 'PUBLISHED' ? null : undefined,
        }),
        ...(shouldClearFailedArtifacts
          ? {
              latestDraftCode: null,
              rejectReason: null,
              validationReport: null,
              semanticGraph: this.buildMinimalSemanticGraphFromState(nextState) as Prisma.InputJsonValue,
            }
          : {}),
      } as Prisma.LlmStrategyCodegenSessionUpdateInput)

      const response = this.finalizeSessionResponse({
        id: args.session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: args.decision.question,
        clarificationState: semanticArtifacts.clarificationState,
      })
      return this.returnPersistedSessionResponse(args.session.id, args.userId, response)
    }

    const pendingEditBeforePatch = readPendingSemanticEdit(args.currentSemanticState)
    const shouldRestorePublishedOnCancel = pendingEditBeforePatch?.resumeStatusOnCancel === 'PUBLISHED'
      && args.decision.patch.operations.some((operation) => operation.op === 'cancel_pending_edit')
    const reducedSemanticState = this.conversationSemanticEdit.applyPatch(
      args.currentSemanticState,
      args.decision.patch,
    )
    const semanticArtifacts = this.resolveSemanticClarificationArtifacts(reducedSemanticState)
    const clarificationState = semanticArtifacts.clarificationState
    const semanticReadyForGenerate = this.findNextOpenSemanticSlot(reducedSemanticState) === null
    const normalization = semanticArtifacts.normalization
    const canonicalSpec = this.buildCanonicalSpecForConversation(reducedSemanticState, normalization)
    const specDesc = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: normalization.normalizedIntent,
      executionContext: semanticArtifacts.executionContext.context,
    })
    const canonicalDigest = this.readCanonicalDigest(specDesc)
    const compileability = this.evaluateCanonicalCompileability(canonicalSpec)
    const canonicalLogicSnapshot = this.buildLegacyLogicSnapshotProjectionForCompatibility(reducedSemanticState, {})
    const guidePrompt = this.mergeGuidePromptConfig(constraintPack.guidePrompt, args.guideConfig)
    const recommendationStyle = this.inferRecommendationStyleFromSemanticContext(
      args.message,
      reducedSemanticState,
      constraintPack.recommendationStyle,
    )
    const nextConstraintPack = this.withGuidePrompt(constraintPack, guidePrompt, recommendationStyle)
    const strategyDecision = this.buildStrategyDecision({
      checklist: canonicalLogicSnapshot,
      clarification: semanticArtifacts,
      effectiveBlockingReasons: semanticArtifacts.blockingReasons,
      compileability,
      constraintPack: nextConstraintPack,
    })
    const decisionPrompt = strategyDecision.kind === 'CONFIRM_INFERRED'
      ? this.clarificationQuestion.buildFromDecision(strategyDecision)
      : semanticArtifacts.clarificationPrompt
    const deterministicAuthority = this.resolveContinueSessionDeterministicAuthority({
      semanticState: reducedSemanticState,
      clarificationState,
      normalization,
      compileability,
      decisionKind: strategyDecision.kind,
      semanticReadyForGenerate,
    })
    const baseAssistantPrompt = deterministicAuthority === 'clarification'
      ? (semanticArtifacts.clarificationPrompt || '请先澄清这条规则，我再继续完善逻辑图。')
      : deterministicAuthority === 'decision'
        ? (decisionPrompt || '请先确认当前推断，我再继续整理逻辑图。')
        : deterministicAuthority === 'normalization'
          ? this.buildSemanticNormalizationAssistantPrompt(reducedSemanticState, normalization)
          : deterministicAuthority === 'compileability'
            ? this.buildCompileabilityAssistantPrompt(compileability)
            : deterministicAuthority === 'confirm_gate'
              ? this.buildSemanticLogicGateAssistantPrompt(reducedSemanticState)
              : `已更新策略语义：${this.buildSemanticClarificationSummary(reducedSemanticState)}`
    const assistantPrompt = this.withAppliedSemanticEditSummary(args.decision, baseAssistantPrompt)
    const targetStatus = shouldRestorePublishedOnCancel
      ? 'PUBLISHED'
      : deterministicAuthority === 'confirm_gate' ? 'CONFIRM_GATE' : 'DRAFTING'
    const historyAfterSemanticEdit = this.appendConversationHistory(
      constraintPack.conversationHistory ?? [],
      args.message,
      assistantPrompt,
    )
    const semanticEditUpdate = targetStatus === 'PUBLISHED'
      ? {
          status: targetStatus,
          semanticState: reducedSemanticState as unknown as Prisma.InputJsonValue,
          clarificationState: clarificationState as unknown as Prisma.InputJsonValue,
          constraintPack: {
            ...nextConstraintPack,
            conversationHistory: historyAfterSemanticEdit,
          } as unknown as Prisma.InputJsonValue,
          latestSpecDesc: null,
        }
      : {
          ...this.stateMachine.buildConversationUpdate({
            status: targetStatus,
            semanticState: reducedSemanticState,
            clarificationState,
            constraintPack: {
              ...nextConstraintPack,
              conversationHistory: historyAfterSemanticEdit,
            },
            latestSpecDesc: specDesc,
          }),
          semanticGraph: this.buildMinimalSemanticGraphFromState(reducedSemanticState) as Prisma.InputJsonValue,
          validationReport: null,
          ...(
            args.session.status === 'PUBLISHED'
              || args.session.status === 'REJECTED'
              || args.session.status === 'CONSISTENCY_FAILED'
              ? { latestDraftCode: null, rejectReason: null }
              : {}
          ),
        }
    await this.sessionsRepo.updateSession(args.session.id, semanticEditUpdate as Prisma.LlmStrategyCodegenSessionUpdateInput)

    const response = this.finalizeSessionResponse({
      id: args.session.id,
      status: targetStatus,
      missingFields: [],
      ...(deterministicAuthority === 'confirm_gate' || deterministicAuthority === 'decision'
        ? {
            specDesc,
            canonicalDigest,
          }
        : {}),
      ...(deterministicAuthority === 'normalization' ? { specDesc } : {}),
      assistantPrompt,
      clarificationState,
    })
    return this.returnPersistedSessionResponse(args.session.id, args.userId, response)
  }

  private withAppliedSemanticEditSummary(
    decision: Extract<SemanticEditDecision, { kind: 'APPLY_TO_SEMANTIC_STATE' }>,
    assistantPrompt: string,
  ): string {
    const contextFieldLabels: Record<string, string> = {
      exchange: '交易所',
      symbol: '交易标的',
      marketType: '市场类型',
      timeframe: '主周期',
    }
    const summaries = decision.patch.operations
      .map((operation) => {
        if (operation.op === 'cancel_pending_edit') return '已取消待确认的语义修改'
        if (operation.op !== 'replace_context') return null

        return `已更新${contextFieldLabels[operation.field] ?? operation.field}为 ${operation.value}`
      })
      .filter((summary): summary is string => summary !== null)

    if (summaries.length === 0) return assistantPrompt
    return `${summaries.join('；')}。${assistantPrompt}`
  }

  private async continueConfirmedSession(
    session: PersistedConversationSessionForContinue,
    dto: ContinueCodegenSessionDto,
    sessionUserId: string,
  ): Promise<CodegenSessionResponseDto> {
    const baseClarificationState = this.readClarificationState(session.clarificationState)
    const persistedSemanticState = this.readSemanticState(session.semanticState)
    const persistedLogicSnapshot = this.restoreInferredAssumptionsFromLatestSpecDesc(
      session.latestSpecDesc,
      this.buildLegacyLogicSnapshotProjectionForCompatibility(persistedSemanticState, {}),
    )
    const inferredSemanticClarificationAnswers = this.inferFreeformSemanticClarificationAnswers(
      baseClarificationState,
      dto.message,
      dto.clarificationAnswers,
    )
    const effectiveClarificationAnswers = Object.keys(inferredSemanticClarificationAnswers).length > 0
      ? inferredSemanticClarificationAnswers
      : dto.clarificationAnswers
    const semanticStateAfterAnswers = this.applySemanticClarificationAnswers(
      persistedSemanticState,
      baseClarificationState,
      effectiveClarificationAnswers,
    )
    const confirmationBaseLogicSnapshot = this.buildLegacyLogicSnapshotProjectionForCompatibility(
      semanticStateAfterAnswers,
      persistedLogicSnapshot,
    )
    const baseLogicSnapshot = this.applyClarificationAnswers(
      confirmationBaseLogicSnapshot,
      baseClarificationState,
      effectiveClarificationAnswers,
    )
    const confirmationViewArtifacts = this.resolveSemanticClarificationArtifacts(semanticStateAfterAnswers)
    const confirmationViewNormalization = confirmationViewArtifacts.normalization
    const confirmationViewSpecDesc = this.specDescBuilder.buildFromCanonicalSpec(
      this.buildCanonicalSpecForConversation(semanticStateAfterAnswers, confirmationViewNormalization),
      '',
      {
        normalizedIntent: confirmationViewNormalization.normalizedIntent,
        executionContext: confirmationViewArtifacts.executionContext.context,
      },
    )
    const confirmationViewDigest = this.readCanonicalDigest(confirmationViewSpecDesc)
    const reducedSemanticState = this.withRequiredSemanticOpenSlots(
      semanticStateAfterAnswers,
      baseLogicSnapshot,
      {
        preserveLockedPositionSizing: this.hasValidLockedPositionSizing(semanticStateAfterAnswers.position),
      },
    )
    const canonicalLogicSnapshot = this.buildLegacyLogicSnapshotProjectionForCompatibility(reducedSemanticState, baseLogicSnapshot)
    const semanticArtifacts = this.resolveSemanticClarificationArtifacts(reducedSemanticState)
    const clarificationState = this.mergePersistedBlockingClarificationItems(
      semanticArtifacts.clarificationState,
      baseClarificationState,
      reducedSemanticState,
    )
    const semanticReadyForGenerate = this.findNextOpenSemanticSlot(reducedSemanticState) === null
    const confirmedCanonicalDigest = dto.confirmedCanonicalDigest?.trim() ?? ''
    if (confirmedCanonicalDigest) {
      const confirmationViewDigest = this.readCanonicalDigest(confirmationViewSpecDesc)
      if (!confirmationViewDigest || confirmedCanonicalDigest !== confirmationViewDigest) {
        throw new DomainException('codegen.confirmation_digest_mismatch', {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
          args: {
            expectedCanonicalDigest: confirmationViewDigest,
            confirmationViewDigest,
            confirmedCanonicalDigest,
          },
        })
      }
    }

    const hasBlockingClarificationItems =
      clarificationState.status === 'NEEDS_CLARIFICATION'
      && clarificationState.items.some(item => item.blocking && item.status === 'pending')
    const clarificationPrompt = semanticArtifacts.clarificationPrompt
    const constraintPack = this.readConstraintPack(session.constraintPack)
    const historyAfterConfirm = this.appendConversationHistory(
      constraintPack.conversationHistory ?? [],
      dto.message,
    )
    const normalization = semanticArtifacts.normalization
    const canonicalSpec = this.buildCanonicalSpecForConversation(reducedSemanticState, normalization)
    const specDesc = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: normalization.normalizedIntent,
      executionContext: semanticArtifacts.executionContext.context,
    })
    const canonicalDigest = this.readCanonicalDigest(specDesc)
    const compileability = this.evaluateCanonicalCompileability(canonicalSpec)
    if (
      !canonicalDigest
      || (confirmedCanonicalDigest !== canonicalDigest && confirmedCanonicalDigest !== confirmationViewDigest)
    ) {
      throw new DomainException('codegen.confirmation_digest_mismatch', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: {
          expectedCanonicalDigest: canonicalDigest,
          confirmationViewDigest,
          confirmedCanonicalDigest: confirmedCanonicalDigest || null,
        },
      })
    }

    if (hasBlockingClarificationItems) {
      const assistantPrompt = clarificationPrompt || '请先澄清这条规则，我再继续完善逻辑图。'
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
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

    if (normalization.blocked && !semanticReadyForGenerate) {
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
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
        assistantPrompt: this.buildSemanticNormalizationAssistantPrompt(reducedSemanticState, normalization),
        clarificationState,
        specDesc,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    const hasUnresolvedGenericCompileabilityGap = this.hasUnresolvedGenericCompileabilityGap(canonicalLogicSnapshot)
    if (!compileability.canCompile && (!semanticReadyForGenerate || hasUnresolvedGenericCompileabilityGap)) {
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
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
      semanticState: reducedSemanticState,
      canonicalSpecOverride: canonicalSpec,
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

  private readSemanticState(
    payload: Prisma.JsonValue | null | undefined,
  ): SemanticState {
    if (this.hasPersistedSemanticState(payload)) {
      return payload as unknown as SemanticState
    }

    return this.createEmptySemanticState()
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
      const isLegacyPositionSizingAnswer = item.key === 'sizing.positionPct' || item.field === 'riskRules.positionPct'
      if (
        typeof rawAnswer !== 'string'
        || !rawAnswer.trim()
        || (!item.key.startsWith('semantic.')
          && !item.key.startsWith('grid.')
          && !item.key.startsWith('executionContext.')
          && !isLegacyPositionSizingAnswer)
      ) {
        continue
      }

      const legacyPositionSizingSlot = isLegacyPositionSizingAnswer
        ? nextState.position?.openSlots?.find(slot => slot.slotKey === 'position.sizing' && slot.status === 'open')
        : undefined
      const targetSlotKey = isLegacyPositionSizingAnswer
        ? 'position.sizing'
        : item.slotKey
          ?? (item.key.startsWith('executionContext.')
            ? item.key.replace(/^executionContext\./u, '')
            : item.key.replace(/^semantic\./u, ''))
      nextState = this.semanticStateReducer.applyClarificationAnswer({
        currentState: nextState,
        targetSlotKey,
        targetFieldPath: isLegacyPositionSizingAnswer ? legacyPositionSizingSlot?.fieldPath : item.fieldPath,
        targetSlotId: isLegacyPositionSizingAnswer && legacyPositionSizingSlot
          ? buildSemanticSlotId(legacyPositionSizingSlot)
          : item.slotId,
        answer: rawAnswer.trim(),
      })
    }

    return nextState
  }

  /**
   * Explicit legacy boundary: converts old StrategyLogicSnapshot-shaped test or
   * compatibility data into SemanticState. Do not use this for canonical
   * generation, publication authority, or new conversation mainline logic.
   */
  private buildFallbackSemanticStateForLegacyCompatibility(checklist: StrategyLogicSnapshot): SemanticState {
    const normalization = this.intentNormalizer.normalize(checklist)
    const executionContext = this.executionContext.resolve(checklist)

    const state: SemanticState = {
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
            openSlots: [],
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

    return this.withRequiredSemanticOpenSlots(state, checklist)
  }

  private withRequiredSemanticOpenSlots(
    state: SemanticState,
    checklist: StrategyLogicSnapshot,
    options?: { preserveLockedPositionSizing?: boolean },
  ): SemanticState {
    const stateWithDeterministicContext = this.withDeterministicContextSlots(state, checklist)
    const stateWithExplicitDeterministicPosition = this.withExplicitDeterministicPositionSizing(
      stateWithDeterministicContext,
      checklist,
    )
    const stateWithExplicitDeterministicRisk = this.withExplicitDeterministicStopLossRisk(
      stateWithExplicitDeterministicPosition,
      checklist,
    )
    const hasExecutableSemantics = stateWithExplicitDeterministicRisk.families.length > 0
      || stateWithExplicitDeterministicRisk.triggers.length > 0
      || stateWithExplicitDeterministicRisk.actions.length > 0

    if (!hasExecutableSemantics) {
      return {
        ...stateWithExplicitDeterministicRisk,
        position: this.hasExplicitPositionSizing(checklist) ? stateWithExplicitDeterministicRisk.position : null,
      }
    }

    const stateWithPositionSizing = this.ensurePositionSizingSlot(stateWithExplicitDeterministicRisk, checklist, options)

    if (!this.hasLockedExecutionContext(stateWithPositionSizing)) {
      return {
        ...this.removeSatisfiedProtectiveRiskSlot(stateWithPositionSizing),
      }
    }

    return this.ensureProtectiveRiskSlot(stateWithPositionSizing)
  }

  private withDeterministicContextSlots(state: SemanticState, checklist: StrategyLogicSnapshot): SemanticState {
    const executionContext = this.executionContext.resolve(checklist)
    const questionHints = {
      exchange: '请确认交易所（binance / okx / hyperliquid）。',
      symbol: '请确认策略交易标的（例如 BTCUSDT）。',
      marketType: '请确认市场类型（现货或合约/perp）。',
      timeframe: '请确认策略主周期（例如 15m 或 1h）。',
    } as const
    const fields = ['exchange', 'symbol', 'marketType', 'timeframe'] as const
    let changed = false
    const contextSlots: SemanticState['contextSlots'] = { ...state.contextSlots }

    for (const field of fields) {
      const value = executionContext.context[field]
      if (!value || contextSlots[field]?.status === 'locked') {
        continue
      }
      contextSlots[field] = this.buildContextSlotState(field, value, questionHints[field])
      changed = true
    }

    return changed
      ? { ...state, contextSlots }
      : state
  }

  private withExplicitDeterministicPositionSizing(
    state: SemanticState,
    checklist: StrategyLogicSnapshot,
  ): SemanticState {
    const positionPct = checklist.riskRules?.positionPct
    if (typeof positionPct !== 'number' || !Number.isFinite(positionPct) || positionPct <= 0) {
      return state
    }

    if (this.hasValidLockedPositionSizing(state.position)) {
      return {
        ...state,
        position: {
          ...state.position,
          openSlots: state.position.openSlots ?? [],
        },
      }
    }

    return {
      ...state,
      position: {
        mode: 'fixed_ratio',
        value: positionPct / 100,
        positionMode: state.position?.positionMode ?? this.inferPositionModeFromActions(state.actions, checklist),
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    }
  }

  private withExplicitDeterministicStopLossRisk(
    state: SemanticState,
    checklist: StrategyLogicSnapshot,
  ): SemanticState {
    const stopLossPct = checklist.riskRules?.stopLossPct
    if (typeof stopLossPct !== 'number' || !Number.isFinite(stopLossPct) || stopLossPct <= 0) {
      return state
    }

    if (this.hasStopLossRisk(state.risk)) {
      return state
    }
    const stopLossBasis = checklist.riskRules?.stopLossBasis ?? 'entry_avg_price'

    return {
      ...state,
      risk: [
        ...state.risk.filter(risk => !(risk.key === 'risk.protective_exit' && risk.status === 'open')),
        {
          id: `risk-stop-loss-${state.risk.length + 1}`,
          key: 'risk.stop_loss_pct',
          params: {
            valuePct: stopLossPct,
            basis: stopLossBasis,
            ...(checklist.riskRules?.stopLossBasis == null ? { basisSource: 'system_default' } : {}),
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    }
  }

  private ensurePositionSizingSlot(
    state: SemanticState,
    checklist: StrategyLogicSnapshot,
    options?: { preserveLockedPositionSizing?: boolean },
  ): SemanticState {
    if (this.hasExplicitPositionSizing(checklist) || options?.preserveLockedPositionSizing === true) {
      return state.position
        ? {
            ...state,
            position: {
              ...state.position,
              openSlots: this.hasValidLockedPositionSizing(state.position)
                ? []
                : (state.position.openSlots ?? []),
            },
          }
        : state
    }

    return {
      ...state,
      position: {
        mode: 'fixed_ratio',
        value: 0,
        positionMode: this.inferPositionModeFromActions(state.actions, checklist),
        status: 'open',
        source: 'derived',
        openSlots: [{
          slotKey: 'position.sizing',
          fieldPath: 'position.value',
          status: 'open',
          priority: 'risk',
          questionHint: '请确认单笔仓位百分比（例如 10%）。',
          affectsExecution: true,
        }],
      },
    }
  }

  private ensureProtectiveRiskSlot(state: SemanticState): SemanticState {
    if (this.hasProtectiveRisk(state.risk)) {
      return this.removeSatisfiedProtectiveRiskSlot(state)
    }

    if (!this.hasLockedExitSemantics(state)) {
      return state
    }

    if (
      state.risk.some(risk =>
        risk.key === 'risk.protective_exit'
        && risk.status === 'open'
        && risk.openSlots.some(slot => slot.slotKey === 'risk.protective_exit' && slot.status === 'open'),
      )
    ) {
      return state
    }

    return {
      ...state,
      risk: [
        ...state.risk,
        {
          id: 'risk-protective-exit',
          key: 'risk.protective_exit',
          params: {},
          status: 'open',
          source: 'derived',
          openSlots: [{
            slotKey: 'risk.protective_exit',
            fieldPath: 'risk[protective].params',
            status: 'open',
            priority: 'risk',
            questionHint: '请确认止损类保护规则（例如亏损 5% 止损）。',
            affectsExecution: true,
          }],
        },
      ],
    }
  }

  private hasProtectiveRisk(riskItems: SemanticState['risk']): boolean {
    return riskItems.some((risk) => {
      if (risk.status !== 'locked') {
        return false
      }

      if (risk.key === 'risk.take_profit_pct') {
        return false
      }

      const threshold = risk.params.valuePct
      if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold <= 0) {
        return false
      }

      return risk.key === 'risk.stop_loss_pct'
        || risk.key === 'risk.max_drawdown_pct'
        || risk.key === 'risk.max_single_loss_pct'
    })
  }

  private hasStopLossRisk(riskItems: SemanticState['risk']): boolean {
    return riskItems.some((risk) => {
      if (risk.status !== 'locked' || risk.key !== 'risk.stop_loss_pct') {
        return false
      }

      const threshold = risk.params.valuePct
      return typeof threshold === 'number' && Number.isFinite(threshold) && threshold > 0
    })
  }

  private inferPositionModeFromActions(
    actions: SemanticState['actions'],
    checklist: StrategyLogicSnapshot,
  ): string {
    if (checklist.riskRules?.marketType === 'spot' || checklist.market?.marketType === 'spot') {
      return 'long_only'
    }
    if (checklist.grid?.sideMode === 'bidirectional') {
      return 'long_short'
    }
    if (checklist.grid?.sideMode === 'long_only' || checklist.grid?.sideMode === 'short_only') {
      return checklist.grid.sideMode
    }

    const actionKeys = new Set(actions.map(action => action.key))
    const hasLong = actionKeys.has('open_long') || actionKeys.has('close_long') || actionKeys.has('reduce_long')
    const hasShort = actionKeys.has('open_short') || actionKeys.has('close_short') || actionKeys.has('reduce_short')
    if (hasLong && hasShort) return 'long_short'
    if (hasShort) return 'short_only'
    return 'long_only'
  }

  private hasExplicitPositionSizing(checklist: StrategyLogicSnapshot): boolean {
    return typeof checklist.riskRules?.positionPct === 'number'
      && Number.isFinite(checklist.riskRules.positionPct)
      && checklist.riskRules.positionPct > 0
  }

  private hasLockedExecutionContext(state: SemanticState): boolean {
    return Object.values(state.contextSlots).every(slot => slot?.status === 'locked')
  }

  private removeSatisfiedProtectiveRiskSlot(state: SemanticState): SemanticState {
    if (!this.hasProtectiveRisk(state.risk)) {
      return state
    }

    return {
      ...state,
      risk: state.risk.filter(risk =>
        !(risk.key === 'risk.protective_exit' && risk.status === 'open'),
      ),
    }
  }

  private hasLockedExitSemantics(state: SemanticState): boolean {
    return state.triggers.some(trigger =>
      trigger.phase === 'exit'
      && trigger.status === 'locked'
      && trigger.openSlots.every(slot => slot.status !== 'open'),
    )
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

    if (this.isPositionSizingClarificationItem(item)) {
      return this.hasValidLockedPositionSizing(semanticState.position)
    }

    if (this.isProtectiveRiskClarificationItem(item)) {
      return this.hasProtectiveRisk(semanticState.risk)
    }

    if (this.isTakeProfitClarificationItem(item)) {
      return this.hasLockedExitSemantics(semanticState)
        || semanticState.risk.some(risk =>
          risk.key === 'risk.take_profit_pct'
          && risk.status === 'locked'
          && typeof risk.params.valuePct === 'number'
          && Number.isFinite(risk.params.valuePct)
          && risk.params.valuePct > 0,
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

  private isPositionSizingClarificationItem(item: StrategyClarificationItem): boolean {
    return item.reason === 'missing_position_pct'
      || item.field === 'riskRules.positionPct'
      || item.key === 'riskRules.positionPct'
      || item.key === 'position.sizing'
      || item.key === 'sizing.positionPct'
      || item.slotKey === 'position.sizing'
  }

  private isProtectiveRiskClarificationItem(item: StrategyClarificationItem): boolean {
    return item.reason === 'missing_stop_loss_rule'
      || item.field === 'riskRules.stopLossPct'
      || item.key === 'riskRules.stopLossPct'
      || item.key === 'risk.stopLoss.rule'
      || item.key === 'risk.protective_exit'
      || item.slotKey === 'risk.protective_exit'
  }

  private isTakeProfitClarificationItem(item: StrategyClarificationItem): boolean {
    return item.reason === 'missing_take_profit_rule'
      || item.field === 'riskRules.takeProfitPct'
      || item.key === 'riskRules.takeProfitPct'
      || item.key === 'risk.takeProfit.rule'
  }

  private findNextOpenSemanticSlot(state: SemanticState): SemanticSlotState | null {
    const triggerPhaseOrder: Array<'entry' | 'exit' | 'risk' | 'gate'> = ['entry', 'exit', 'risk', 'gate']
    const openTriggerSlots = triggerPhaseOrder.flatMap(phase =>
      state.triggers
        .filter(trigger => trigger.phase === phase && trigger.status !== 'superseded')
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

    const positionSlot = state.position?.openSlots?.find(slot => slot.status === 'open')
    if (positionSlot) {
      return positionSlot
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
    const semanticMetadata = resolveSemanticClarificationMetadata(slot.slotKey)
    const field = isStateGateSlot
      ? 'stateGates.marketRegime'
      : isContextSlot
        ? slot.slotKey
      : isGridSlot
        ? semanticMetadata.field
      : semanticMetadata.field
    const reason = isStateGateSlot
      ? 'ambiguous_state_gate'
      : isContextSlot
        ? (contextReasonMap[slot.slotKey] ?? 'missing_execution_context')
      : isGridSlot
        ? semanticMetadata.reason
        : semanticMetadata.reason

    return {
      key: isContextSlot
        ? `executionContext.${slot.slotKey}`
        : (isGridSlot ? slot.slotKey : `semantic.${slot.slotKey}`),
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
    const openPositionSlots = state.position?.openSlots?.filter(slot => slot.status === 'open') ?? []
    const openContextSlots = Object.values(state.contextSlots)
      .filter((slot): slot is SemanticSlotState => Boolean(slot) && slot.status === 'open')

    return [...openTriggerSlots, ...openPositionSlots, ...openRiskSlots, ...openContextSlots]
  }

  private buildClarificationFromSemanticState(
    semanticState: SemanticState,
    fallbackLogicSnapshot: StrategyLogicSnapshot,
    options?: { preserveLegacyFallback?: boolean },
  ): StrategyClarificationStateWithSummary {
    const rawFallbackState = this.resolveClarificationArtifacts(fallbackLogicSnapshot).clarificationState
    const fallbackState = options?.preserveLegacyFallback === true
      ? rawFallbackState
      : {
          ...rawFallbackState,
          items: rawFallbackState.items.filter(item => !this.isLegacyLogicCompletenessItem(item)),
          status: rawFallbackState.items.some(item => !this.isLegacyLogicCompletenessItem(item))
            ? rawFallbackState.status
            : 'CLEAR',
        }

    return this.mergeSemanticClarificationState(semanticState, fallbackState)
  }

  private mergePersistedBlockingClarificationItems(
    clarificationState: StrategyClarificationStateWithSummary,
    persistedClarificationState: StrategyClarificationState | null,
    semanticState: SemanticState,
  ): StrategyClarificationStateWithSummary {
    const persistedBlockingItems = persistedClarificationState?.status === 'NEEDS_CLARIFICATION'
      ? persistedClarificationState.items.filter(item =>
          item.blocking
          && item.status === 'pending'
          && !this.isLegacyLogicCompletenessItem(item)
          && !this.isResolvedBySemanticState(item, semanticState),
        )
      : []

    if (persistedBlockingItems.length === 0) {
      return clarificationState
    }

    const seenKeys = new Set(
      clarificationState.items.map(item => `${item.key}::${item.reason}::${item.fieldPath ?? ''}`),
    )
    const mergedItems = [...clarificationState.items]
    for (const item of persistedBlockingItems) {
      const itemKey = `${item.key}::${item.reason}::${item.fieldPath ?? ''}`
      if (!seenKeys.has(itemKey)) {
        mergedItems.push(item)
        seenKeys.add(itemKey)
      }
    }

    return {
      ...clarificationState,
      status: mergedItems.length > 0 ? 'NEEDS_CLARIFICATION' : 'CLEAR',
      items: mergedItems,
    }
  }

  private isLegacyLogicCompletenessItem(item: StrategyClarificationItem): boolean {
    return item.reason === 'missing_entry_rules'
      || item.reason === 'missing_exit_rules'
      || item.reason === 'missing_stop_loss_rule'
      || item.reason === 'missing_take_profit_rule'
      || item.key === 'entry.rules'
      || item.key === 'exit.rules'
      || item.key === 'risk.stopLoss.rule'
      || item.key === 'risk.takeProfit.rule'
  }

  private applyConversationPlanToSemanticState(input: {
    currentState: SemanticState
    plan: ConversationPlan
  }): SemanticState {
    let nextState = input.currentState
    const semanticPatchState = this.buildSemanticStateFromPlannerPatch(input.plan.semanticPatch)

    if (semanticPatchState) {
      nextState = this.semanticStateMerge.merge({
        persisted: nextState,
        derived: semanticPatchState,
      })
    }

    return this.withRequiredSemanticOpenSlots(nextState, {}, {
      preserveLockedPositionSizing: Boolean(
        this.hasValidLockedPositionSizing(semanticPatchState?.position)
        || this.hasValidLockedPositionSizing(input.currentState.position),
      ),
    })
  }

  private mergeSemanticPatchIntoState(
    currentState: SemanticState,
    semanticPatch?: CodegenSemanticPatch,
  ): SemanticState {
    const semanticPatchState = this.buildSemanticStateFromPlannerPatch(semanticPatch)
    if (!semanticPatchState) {
      return currentState
    }

    return this.semanticStateMerge.merge({
      persisted: currentState,
      derived: semanticPatchState,
    })
  }

  private hasValidLockedPositionSizing(
    position: SemanticState['position'],
  ): boolean {
    return position?.status === 'locked'
      && position.mode === 'fixed_ratio'
      && Number.isFinite(position.value)
      && position.value > 0
  }



  private createEmptySemanticState(): SemanticState {
    return {
      version: 1,
      families: [],
      triggers: [],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: new Date().toISOString(),
    }
  }

  /**
   * Explicit legacy boundary: projects SemanticState into the old
   * StrategyLogicSnapshot shape for compatibility-only summary/clarification
   * paths that have not been migrated yet. Do not use this for canonical
   * generation or publication authority.
   */
  private buildLegacyLogicSnapshotProjectionForCompatibility(
    state: SemanticState,
    fallbackLogicSnapshot: StrategyLogicSnapshot,
  ): StrategyLogicSnapshot {
    const semanticLogicSnapshot = this.buildLegacyLogicSnapshotFromSemanticState(state, {
      ...fallbackLogicSnapshot,
      riskRules: fallbackLogicSnapshot.riskRules ? { ...fallbackLogicSnapshot.riskRules } : undefined,
      stateGates: fallbackLogicSnapshot.stateGates ? { ...fallbackLogicSnapshot.stateGates } : undefined,
    })

    return this.normalizeLogicSnapshot({
      ...fallbackLogicSnapshot,
      ...semanticLogicSnapshot,
      entryRules: this.mergeProjectedRuleArrays(fallbackLogicSnapshot.entryRules, semanticLogicSnapshot.entryRules, 'entry'),
      exitRules: this.mergeProjectedRuleArrays(fallbackLogicSnapshot.exitRules, semanticLogicSnapshot.exitRules, 'exit'),
      riskRules: semanticLogicSnapshot.riskRules ?? fallbackLogicSnapshot.riskRules,
      stateGates: semanticLogicSnapshot.stateGates ?? fallbackLogicSnapshot.stateGates,
      entryRuleDrafts: semanticLogicSnapshot.entryRuleDrafts ?? fallbackLogicSnapshot.entryRuleDrafts,
      exitRuleDrafts: semanticLogicSnapshot.exitRuleDrafts ?? fallbackLogicSnapshot.exitRuleDrafts,
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

    const hasProjectedSpecificRule = projectedRules.some(rule => !this.isGenericLogicPlaceholderRule(rule, phase))
    const preservedFallbackRules = fallbackRules.filter(rule => (
      !this.isSemanticProjectableRule(rule)
      && !(hasProjectedSpecificRule && this.isGenericLogicPlaceholderRule(rule, phase))
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
      /当前K线收盘价相对于.+(?:上涨|下跌).+?(?:买入|卖出|平仓|开仓|平多|平空)/u.test(text)
      || /立即开始时市价(?:买入|卖出|做多|做空|平仓|平多|平空)一次/u.test(text)
      || (/均线|\bma\b|\bsma\b|\bema\b/iu.test(text) && (/突破|跌破|金叉|死叉/u.test(text)))
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

    if (item.field === 'grid.range.lower' || item.field === 'grid.lower') return 'grid.range.lower'
    if (item.field === 'grid.range.upper' || item.field === 'grid.upper') return 'grid.range.upper'
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

  private isLikelyUserSubmittedScriptCode(message: string): boolean {
    const text = message.trim()
    if (text.length < 20) return false
    return /(?:export\s+default\s+function|function\s+strategy|const\s+strategy|let\s+strategy|var\s+strategy|protocolVersion\s*:|onBar\s*:|action\s*:|module\.exports|return\s*\{)/u.test(text)
      && /[{}();=]/u.test(text)
  }

  private readJsonRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    return value as Record<string, unknown>
  }

  private readNullableString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private readStringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private restoreInferredAssumptionsFromLatestSpecDesc(
    specDescPayload: Prisma.JsonValue | null | undefined,
    checklist: StrategyLogicSnapshot,
  ): StrategyLogicSnapshot {
    if (!specDescPayload || typeof specDescPayload !== 'object' || Array.isArray(specDescPayload)) {
      return checklist
    }

    const specDesc = specDescPayload as Record<string, unknown>
    const normalizedIntent = specDesc.normalizedIntent
    if (!normalizedIntent || typeof normalizedIntent !== 'object' || Array.isArray(normalizedIntent)) {
      return checklist
    }

    const riskEntries = (normalizedIntent as { risk?: unknown }).risk
    if (!Array.isArray(riskEntries) || riskEntries.length === 0) {
      return checklist
    }

    const inferredAssumptions = new Set<string>(
      Array.isArray(checklist.riskRules?._inferredAssumptions)
        ? checklist.riskRules._inferredAssumptions.filter((item): item is string => typeof item === 'string')
        : [],
    )

    for (const entry of riskEntries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue
      }
      const riskEntry = entry as {
        key?: unknown
        source?: unknown
        params?: { basis?: unknown, basisSource?: unknown } | null
      }
      const basis = riskEntry.params?.basis
      const source = riskEntry.source
      const basisSource = riskEntry.params?.basisSource
      const isSystemDefault = source === 'system_default' || basisSource === 'system_default'
      if (!isSystemDefault || basis !== 'entry_avg_price') {
        continue
      }
      if (riskEntry.key === 'risk.stop_loss_pct') {
        inferredAssumptions.add('risk.stopLossBasis')
      }
      if (riskEntry.key === 'risk.take_profit_pct') {
        inferredAssumptions.add('risk.takeProfitBasis')
      }
    }

    if (inferredAssumptions.size === 0) {
      return checklist
    }

    return this.normalizeLogicSnapshot({
      ...checklist,
      riskRules: {
        ...(checklist.riskRules ?? {}),
        _inferredAssumptions: Array.from(inferredAssumptions),
      },
    })
  }


  private async toSessionSnapshotResponse(session: {
    id: string
    status: LlmCodegenSessionStatus
    latestDraftCode: Prisma.JsonValue | null
    latestSpecDesc: Prisma.JsonValue | null
    semanticGraph?: Prisma.JsonValue | null
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
    const snapshotSpecDesc = latestSnapshot?.specSnapshot && typeof latestSnapshot.specSnapshot === 'object' && !Array.isArray(latestSnapshot.specSnapshot)
      ? (latestSnapshot.specSnapshot as Record<string, unknown>)
      : null
    const snapshotLockedParams = latestSnapshot?.lockedParams && typeof latestSnapshot.lockedParams === 'object' && !Array.isArray(latestSnapshot.lockedParams)
      ? (latestSnapshot.lockedParams as Record<string, unknown>)
      : null
    const sessionSpecMetadata = sessionSpecDesc
      ? {
          ...(sessionSpecDesc.canonicalDigest !== undefined ? { canonicalDigest: sessionSpecDesc.canonicalDigest } : {}),
          ...(sessionSpecDesc.confirmation !== undefined ? { confirmation: sessionSpecDesc.confirmation } : {}),
          ...(sessionSpecDesc.publicationGate !== undefined ? { publicationGate: sessionSpecDesc.publicationGate } : {}),
          ...(sessionSpecDesc.consistencyReport !== undefined ? { consistencyReport: sessionSpecDesc.consistencyReport } : {}),
          ...(sessionSpecDesc.publishedSnapshotId !== undefined ? { publishedSnapshotId: sessionSpecDesc.publishedSnapshotId } : {}),
        }
      : {}
    const effectiveSpecDesc = snapshotSpecDesc
      ? {
          ...snapshotSpecDesc,
          ...sessionSpecMetadata,
          ...(snapshotLockedParams ? { lockedParams: snapshotLockedParams } : {}),
        }
      : sessionSpecDesc
    const sessionConsistencyReport = sessionSpecDesc?.consistencyReport
    const sessionPublishedSnapshotId = typeof sessionSpecDesc?.publishedSnapshotId === 'string'
      ? sessionSpecDesc.publishedSnapshotId
      : null
    const constraintPack = this.readConstraintPack(session.constraintPack ?? null)
    const conversationMessages = this.toConversationMessages(constraintPack.conversationHistory)
    const conversationTitle = this.deriveConversationTitle(conversationMessages)
    const effectivePublishedSnapshotId = session.status === 'PUBLISHED'
      ? latestSnapshot?.id ?? sessionPublishedSnapshotId ?? null
      : null
    const effectiveScriptCode = this.resolvePublishedResponseScriptCode({
      status: session.status,
      latestDraftCode: session.latestDraftCode,
      latestSnapshot,
      effectivePublishedSnapshotId,
    })
    const publishedSnapshotProjection = this.buildPublishedSnapshotProjection({
      publishedSnapshotId: effectivePublishedSnapshotId,
      snapshot: latestSnapshot,
      strategyInstanceId: session.strategyInstanceId ?? null,
    })

    return this.finalizeSessionResponse({
      id: session.id,
      conversationTitle,
      conversationMessages,
      status: session.status,
      missingFields: [],
      createdAt: session.createdAt instanceof Date ? session.createdAt.toISOString() : undefined,
      updatedAt: session.updatedAt instanceof Date ? session.updatedAt.toISOString() : undefined,
      scriptCode: effectiveScriptCode,
      publishedSnapshotId: effectivePublishedSnapshotId,
      publishedSnapshotParamValues: this.buildPublishedSnapshotParamValues(latestSnapshot),
      ...publishedSnapshotProjection,
      consistencyReport: latestSnapshot?.consistencyReport && typeof latestSnapshot.consistencyReport === 'object' && !Array.isArray(latestSnapshot.consistencyReport)
        ? latestSnapshot.consistencyReport as Record<string, unknown>
        : (sessionConsistencyReport && typeof sessionConsistencyReport === 'object' && !Array.isArray(sessionConsistencyReport)
            ? sessionConsistencyReport as Record<string, unknown>
            : null),
      specDesc: effectiveSpecDesc,
      canonicalDigest: this.readCanonicalDigest(effectiveSpecDesc),
      semanticGraph: this.readJsonRecord(session.semanticGraph) ?? this.readJsonRecord(latestSnapshot?.semanticGraph),
      strategyInstanceId: session.strategyInstanceId ?? null,
      clarificationState: this.readClarificationState(session.clarificationState),
      publicationGate:
        this.readPublicationGate(effectiveSpecDesc?.publicationGate)
        ?? this.readPublicationGate(latestSnapshot?.consistencyReport)
        ?? this.readPublicationGate(sessionConsistencyReport),
      rejectReason: session.rejectReason,
    })
  }

  private resolvePublishedResponseScriptCode(args: {
    status: LlmCodegenSessionStatus
    latestDraftCode: Prisma.JsonValue | null
    latestSnapshot: { id?: string | null, scriptSnapshot?: unknown } | null
    effectivePublishedSnapshotId: string | null
  }): string | null {
    if (typeof args.latestDraftCode === 'string' && args.latestDraftCode.trim().length > 0) {
      return args.latestDraftCode
    }
    if (
      args.status !== 'PUBLISHED'
      || !args.effectivePublishedSnapshotId
      || args.latestSnapshot?.id !== args.effectivePublishedSnapshotId
    ) {
      return null
    }
    return typeof args.latestSnapshot.scriptSnapshot === 'string' && args.latestSnapshot.scriptSnapshot.trim().length > 0
      ? args.latestSnapshot.scriptSnapshot
      : null
  }

  private async toConversationResponse(
    conversation: AiQuantConversationSnapshotRecord,
  ): Promise<AiQuantConversationResponseDto> {
    const session = await this.sessionsRepo.findById(conversation.codegenSessionId)
    const snapshot = session ? await this.toSessionSnapshotResponse(session) : null
    const lastBacktestRef = conversation.lastBacktestRef
      && snapshot?.publishedSnapshotId === conversation.lastBacktestRef.publishedSnapshotId
      ? {
          jobId: conversation.lastBacktestRef.jobId,
          publishedSnapshotId: conversation.lastBacktestRef.publishedSnapshotId,
          config: conversation.lastBacktestRef.config,
          summary: conversation.lastBacktestRef.summary,
          completedAt: conversation.lastBacktestRef.completedAt.toISOString(),
        }
      : null

    return {
      id: conversation.id,
      activeCodegenSessionId: session && this.isEditableConversationSessionStatus(session.status) ? session.id : null,
      conversationTitle: conversation.title,
      conversationMessages: conversation.messages,
      status: snapshot?.status as LlmCodegenSessionStatus | undefined,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      backtestDraftConfig: conversation.backtestDraftConfig,
      lastBacktestRef,
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

  private isEditableConversationSessionStatus(status: LlmCodegenSessionStatus): boolean {
    return !this.stateMachine.isTerminalStatus(status)
      || status === 'PUBLISHED'
      || status === 'REJECTED'
      || status === 'CONSISTENCY_FAILED'
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
    checklist: StrategyLogicSnapshot,
    clarificationState: StrategyClarificationState | null,
    answers?: Record<string, string>,
  ): StrategyLogicSnapshot {
    if (!answers || Object.keys(answers).length === 0) {
      return checklist
    }

    const expandedAnswers = this.expandClarificationAnswers(checklist, clarificationState, answers)
    let nextLogicSnapshot = this.normalizeLogicSnapshot({
      ...checklist,
      riskRules: checklist.riskRules ? { ...checklist.riskRules } : undefined,
    })

    for (const item of clarificationState?.items ?? []) {
      const rawAnswer = expandedAnswers[item.key]
      if (typeof rawAnswer !== 'string' || !rawAnswer.trim()) {
        continue
      }

      nextLogicSnapshot = this.applyClarificationAnswer(nextLogicSnapshot, item, rawAnswer.trim())
    }

    nextLogicSnapshot = this.clearInferredAssumptionsResolvedByClarificationAnswers(
      nextLogicSnapshot,
      clarificationState,
      expandedAnswers,
    )

    return this.normalizeLogicSnapshot(nextLogicSnapshot)
  }

  private expandClarificationAnswers(
    checklist: StrategyLogicSnapshot,
    clarificationState: StrategyClarificationState | null,
    answers: Record<string, string>,
  ): Record<string, string> {
    const expanded = { ...answers }
    const exitBasisItems = (clarificationState?.items ?? []).filter(item =>
      item.reason === 'ambiguous_condition_basis'
      && item.field === 'exitRules.basis'
      && item.status === 'pending',
    )
    if (exitBasisItems.length <= 1) {
      return expanded
    }

    const answeredExitBasis = exitBasisItems.find(item => typeof expanded[item.key] === 'string' && expanded[item.key].trim().length > 0)
    if (!answeredExitBasis) {
      return expanded
    }

    const answeredBasis = this.normalizeBasisClarificationAnswer(expanded[answeredExitBasis.key])
    if (!answeredBasis || !this.shouldBroadcastExitBasisAnswer(checklist, exitBasisItems)) {
      return expanded
    }

    for (const item of exitBasisItems) {
      if (!expanded[item.key]?.trim()) {
        expanded[item.key] = expanded[answeredExitBasis.key]
      }
    }

    return expanded
  }

  private shouldBroadcastExitBasisAnswer(
    checklist: StrategyLogicSnapshot,
    exitBasisItems: StrategyClarificationItem[],
  ): boolean {
    const ruleIndexes = exitBasisItems
      .map(item => this.readClarificationRuleIndex(item))
      .filter((index): index is number => index !== null)
    if (ruleIndexes.length <= 1) {
      return false
    }

    return ruleIndexes.every((index) => {
      const ruleText = checklist.exitRules?.[index] ?? ''
      return /止损|止盈|盈利|亏损|收益/u.test(ruleText)
    })
  }

  private clearInferredAssumptionsResolvedByClarificationAnswers(
    checklist: StrategyLogicSnapshot,
    clarificationState: StrategyClarificationState | null,
    answers: Record<string, string>,
  ): StrategyLogicSnapshot {
    const currentAssumptions = Array.isArray(checklist.riskRules?._inferredAssumptions)
      ? checklist.riskRules._inferredAssumptions.filter((item): item is string => typeof item === 'string')
      : []
    if (currentAssumptions.length === 0) {
      return checklist
    }

    const resolvedKeys = new Set<string>()
    for (const item of clarificationState?.items ?? []) {
      const rawAnswer = answers[item.key]
      if (typeof rawAnswer !== 'string' || !rawAnswer.trim() || item.reason !== 'ambiguous_condition_basis') {
        continue
      }

      if (item.field === 'riskRules.stopLossBasis') {
        resolvedKeys.add('risk.stopLossBasis')
        continue
      }
      if (item.field === 'riskRules.takeProfitBasis') {
        resolvedKeys.add('risk.takeProfitBasis')
        continue
      }
      if (item.field !== 'exitRules.basis') {
        continue
      }

      const ruleIndex = this.readClarificationRuleIndex(item)
      const ruleText = ruleIndex === null ? '' : (checklist.exitRules?.[ruleIndex] ?? '')
      if (/止损|亏损/u.test(ruleText)) {
        resolvedKeys.add('risk.stopLossBasis')
      }
      if (/止盈|盈利|收益/u.test(ruleText)) {
        resolvedKeys.add('risk.takeProfitBasis')
      }
    }

    if (resolvedKeys.size === 0) {
      return checklist
    }

    const nextAssumptions = currentAssumptions.filter(item => !resolvedKeys.has(item))
    const nextRiskRules = { ...(checklist.riskRules ?? {}) }
    if (nextAssumptions.length > 0) {
      nextRiskRules._inferredAssumptions = nextAssumptions
    } else {
      delete nextRiskRules._inferredAssumptions
    }

    return {
      ...checklist,
      riskRules: nextRiskRules,
    }
  }

  private applyClarificationAnswer(
    checklist: StrategyLogicSnapshot,
    item: StrategyClarificationItem,
    answer: string,
  ): StrategyLogicSnapshot {
    const normalizedAnswer = answer.trim()
    if (!normalizedAnswer) return checklist

    if (item.key.startsWith('semantic.') || item.key.startsWith('grid.')) {
      return this.applySemanticSlotClarification(checklist, item, normalizedAnswer)
    }

    if (item.key.startsWith('entry.side.') || item.key.startsWith('entry.action_uniqueness.')) {
      return this.applyEntryRuleDirectionClarification(checklist, item, normalizedAnswer)
    }

    if (item.key === 'entry.rules' || item.field === 'entryRules') {
      return this.normalizeLogicSnapshot({
        ...checklist,
        entryRules: [...(checklist.entryRules ?? []), normalizedAnswer],
      })
    }

    if (item.key === 'exit.rules' || item.field === 'exitRules') {
      return this.normalizeLogicSnapshot({
        ...checklist,
        exitRules: [...(checklist.exitRules ?? []), normalizedAnswer],
      })
    }

    if (item.key === 'risk.stopLoss.rule' || item.field === 'riskRules.stopLossPct') {
      const parsedPct = this.normalizePositionPctClarificationAnswer(normalizedAnswer)
      return this.normalizeLogicSnapshot({
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
      return this.normalizeLogicSnapshot({
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
      return this.normalizeLogicSnapshot({
        ...checklist,
        symbols: symbol ? [symbol] : checklist.symbols,
        riskRules: this.clearMarketScopeConflicts(checklist.riskRules, 'symbol'),
      })
    }

    if (item.key === 'market.timeframe' || item.field === 'timeframe') {
      const timeframe = normalizedAnswer
      return this.normalizeLogicSnapshot({
        ...checklist,
        timeframes: timeframe ? [timeframe] : checklist.timeframes,
        riskRules: this.clearMarketScopeConflicts(checklist.riskRules, 'timeframe'),
      })
    }

    if (item.key === 'market.exchange' || item.field === 'exchange') {
      const exchange = this.normalizeExchangeClarificationAnswer(normalizedAnswer)
      if (!exchange) return checklist
      return this.normalizeLogicSnapshot({
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
      return this.normalizeLogicSnapshot({
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
      return this.normalizeLogicSnapshot({
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
        return this.normalizeLogicSnapshot({
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
        const nextRiskRules = {
          ...(checklist.riskRules ?? {}),
          ...(/止损|亏损/u.test(ruleText) ? { stopLossBasis: basis } : {}),
          ...(/止盈|盈利|收益率/u.test(ruleText) ? { takeProfitBasis: basis } : {}),
        }
        return this.normalizeLogicSnapshot({
          ...checklist,
          exitRuleBases: {
            ...(checklist.exitRuleBases ?? {}),
            [`exit-${ruleIndex + 1}`]: basis,
          },
          riskRules: this.pruneResolvedRiskInferredAssumptions(nextRiskRules, nextRiskRules),
        })
      }

      if (item.field === 'riskRules.stopLossBasis') {
        const nextRiskRules = {
          ...(checklist.riskRules ?? {}),
          stopLossBasis: basis,
        }
        return this.normalizeLogicSnapshot({
          ...checklist,
          riskRules: this.pruneResolvedRiskInferredAssumptions(nextRiskRules, nextRiskRules),
        })
      }

      if (item.field === 'riskRules.takeProfitBasis') {
        const nextRiskRules = {
          ...(checklist.riskRules ?? {}),
          takeProfitBasis: basis,
        }
        return this.normalizeLogicSnapshot({
          ...checklist,
          riskRules: this.pruneResolvedRiskInferredAssumptions(nextRiskRules, nextRiskRules),
        })
      }

      if (item.field === 'riskRules.maxDrawdownBasis') {
        return this.normalizeLogicSnapshot({
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
      return this.normalizeLogicSnapshot({
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
    checklist: StrategyLogicSnapshot,
    item: StrategyClarificationItem,
    answer: string,
  ): StrategyLogicSnapshot {
    const key = item.key.toLowerCase()
    const targetPhase = this.readSemanticClarificationPhase(item)

    if (key.startsWith('grid.')) {
      const nextGrid = this.applyGridLogicClarification(checklist.grid, item, answer)
      if (!nextGrid) {
        return checklist
      }

      return this.normalizeLogicSnapshot({
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

      return this.normalizeLogicSnapshot(targetPhase === 'entry'
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

      return this.normalizeLogicSnapshot(targetPhase === 'entry'
        ? { ...checklist, entryRules: nextRules }
        : { ...checklist, exitRules: nextRules })
    }

    return checklist
  }

  private applyGridLogicClarification(
    currentGrid: StrategyLogicSnapshot['grid'] | undefined,
    item: StrategyClarificationItem,
    answer: string,
  ): StrategyLogicSnapshot['grid'] | null {
    const nextGrid: NonNullable<StrategyLogicSnapshot['grid']> = {
      ...(currentGrid ?? {}),
    }
    const key = item.key.toLowerCase()

    if (key === 'grid.range.lower' || key === 'grid.lower') {
      const value = this.parseGridLogicNumericAnswer('grid.range.lower', answer)
      if (value === null) return null
      nextGrid.lower = value
      return nextGrid
    }

    if (key === 'grid.range.upper' || key === 'grid.upper') {
      const value = this.parseGridLogicNumericAnswer('grid.range.upper', answer)
      if (value === null) return null
      nextGrid.upper = value
      return nextGrid
    }

    if (key === 'grid.steppct') {
      const value = this.parseGridLogicNumericAnswer('grid.stepPct', answer)
      if (value === null) return null
      nextGrid.stepPct = value
      return nextGrid
    }

    if (key === 'grid.sidemode') {
      const sideMode = this.normalizeGridLogicSideMode(answer)
      if (!sideMode) return null
      nextGrid.sideMode = sideMode
      return nextGrid
    }

    return null
  }

  private parseGridLogicNumericAnswer(
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

  private normalizeGridLogicSideMode(
    answer: string,
  ): NonNullable<StrategyLogicSnapshot['grid']>['sideMode'] | null {
    const normalized = answer.trim().toLowerCase()
    if (!normalized) {
      return null
    }

    if (normalized === 'bidirectional' || /双向|低买高卖|来回|往返|自动买卖|自动交易/u.test(answer)) {
      return 'bidirectional'
    }
    if (normalized === 'long_only' || /只做多|仅做多|做多网格|多头网格|做多|多头/u.test(answer)) {
      return 'long_only'
    }
    if (normalized === 'short_only' || /只做空|仅做空|做空网格|空头网格|做空|空头/u.test(answer)) {
      return 'short_only'
    }

    return null
  }

  private applyEntryRuleDirectionClarification(
    checklist: StrategyLogicSnapshot,
    item: StrategyClarificationItem,
    answer: string,
  ): StrategyLogicSnapshot {
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

    return this.normalizeLogicSnapshot({
      ...checklist,
      entryRules,
    })
  }

  private applyTriggerConfirmationClarification(
    checklist: StrategyLogicSnapshot,
    item: StrategyClarificationItem,
    answer: string,
  ): StrategyLogicSnapshot {
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

    return this.normalizeLogicSnapshot(item.ruleId?.startsWith('exit-')
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
    riskRules: StrategyLogicSnapshot['riskRules'],
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

  private async continueWithStructuredClarificationAnswers(
    args: StructuredClarificationContinuationArgs,
  ): Promise<CodegenSessionResponseDto> {
    const historyAfterAnswer = this.appendConversationHistory(
      args.constraintPack.conversationHistory ?? [],
      args.message,
    )
    const projectedLogicSnapshot = this.restoreInferredAssumptionsFromLatestSpecDesc(
      args.session.latestSpecDesc,
      this.buildLegacyLogicSnapshotProjectionForCompatibility(args.semanticState, args.checklist),
    )
    const reducedSemanticState = this.withRequiredSemanticOpenSlots(
      args.semanticState,
      projectedLogicSnapshot,
      {
        preserveLockedPositionSizing: this.hasValidLockedPositionSizing(args.semanticState.position),
      },
    )
    const semanticArtifacts = this.resolveSemanticClarificationArtifacts(reducedSemanticState)
    const semanticClarificationState = this.buildClarificationFromSemanticState(
      reducedSemanticState,
      projectedLogicSnapshot,
      { preserveLegacyFallback: false },
    )

    if (semanticClarificationState.status === 'NEEDS_CLARIFICATION') {
      const assistantPrompt = this.buildSemanticClarificationPrompt(reducedSemanticState)
        || this.clarificationQuestion.build(semanticClarificationState)
        || semanticArtifacts.clarificationPrompt
        || '请先澄清这条规则，我再继续完善逻辑图。'
      await this.sessionsRepo.updateSession(args.session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        semanticState: reducedSemanticState,
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

    const normalization = semanticArtifacts.normalization
    const canonicalSpec = this.buildCanonicalSpecForConversation(reducedSemanticState, normalization)
    const specDesc = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: normalization.normalizedIntent,
      executionContext: semanticArtifacts.executionContext.context,
    })
    const canonicalDigest = this.readCanonicalDigest(specDesc)
    const compileability = this.evaluateCanonicalCompileability(canonicalSpec)
    const decision = this.buildStrategyDecision({
      checklist: projectedLogicSnapshot,
      clarification: semanticArtifacts,
      effectiveBlockingReasons: this.buildEffectiveBlockingReasonsFromClarificationState(semanticClarificationState),
      compileability,
      constraintPack: args.constraintPack,
    })

    if (decision.kind === 'CONFIRM_INFERRED') {
      const assistantPrompt = this.clarificationQuestion.buildFromDecision(decision)
      await this.sessionsRepo.updateSession(args.session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        semanticState: reducedSemanticState,
        clarificationState: semanticClarificationState,
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
        clarificationState: semanticClarificationState,
        specDesc,
        canonicalDigest,
      })
      return this.returnPersistedSessionResponse(args.session.id, args.userId, response)
    }

    if (normalization.blocked) {
      await this.sessionsRepo.updateSession(args.session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        semanticState: reducedSemanticState,
        clarificationState: semanticClarificationState,
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
        assistantPrompt: this.buildSemanticNormalizationAssistantPrompt(reducedSemanticState, normalization),
        clarificationState: semanticClarificationState,
        specDesc,
      })
      return this.returnPersistedSessionResponse(args.session.id, args.userId, response)
    }

    if (!compileability.canCompile) {
      await this.sessionsRepo.updateSession(args.session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        semanticState: reducedSemanticState,
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
        assistantPrompt: this.buildCompileabilityAssistantPrompt(compileability),
        clarificationState: semanticClarificationState,
      })
      return this.returnPersistedSessionResponse(args.session.id, args.userId, response)
    }

    const logicGateAssistantPrompt = this.buildSemanticLogicGateAssistantPrompt(reducedSemanticState)
    const historyAfterLogicGate = this.appendConversationHistory(
      args.constraintPack.conversationHistory ?? [],
      args.message,
      logicGateAssistantPrompt,
    )

    await this.sessionsRepo.updateSession(args.session.id, this.stateMachine.buildConversationUpdate({
      status: 'CONFIRM_GATE',
      semanticState: reducedSemanticState,
      clarificationState: semanticClarificationState,
      constraintPack: {
        ...args.constraintPack,
        conversationHistory: historyAfterLogicGate,
      },
      latestSpecDesc: specDesc,
    }))

    const response = this.finalizeSessionResponse({
      id: args.session.id,
      status: 'CONFIRM_GATE',
      missingFields: [],
      assistantPrompt: logicGateAssistantPrompt,
      clarificationState: semanticClarificationState,
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
    if (this.isStrategyPlazaRunSessionId(sessionId)) {
      return
    }
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

  private excludeStrategyPlazaRunConversations(
    conversations: AiQuantConversationSnapshotRecord[],
  ): AiQuantConversationSnapshotRecord[] {
    return conversations.filter(conversation => !this.isStrategyPlazaRunSessionId(conversation.codegenSessionId))
  }

  private isStrategyPlazaRunSessionId(sessionId: string): boolean {
    return sessionId.startsWith(STRATEGY_PLAZA_RUN_SESSION_ID_PREFIX)
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

  private normalizeBasisClarificationAnswer(answer: string): StrategyRuleBasis['kind'] | null {
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
    checklist: StrategyLogicSnapshot,
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

  private resolveClarificationArtifacts(checklist: StrategyLogicSnapshot): {
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
        && (
          (item.reason === 'missing_entry_rules' && item.field === 'entryRules')
          || (item.reason === 'missing_exit_rules' && item.field === 'exitRules')
        )
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

  private buildClarificationSummary(
    checklist: StrategyLogicSnapshot,
    normalizedIntent?: StrategyNormalizedIntent | null,
  ): string | null {
    const drafts = buildStrategyRuleDrafts(checklist)
    const executionContext = this.resolveExecutionContextForSummary(checklist)
    const positionPct = typeof checklist.riskRules?.positionPct === 'number'
      ? `${checklist.riskRules.positionPct}% 仓位`
      : ''
    const formatRuleSummaryText = (text: string, timeframe?: string | null): string => {
      const trimmed = text.trim()
      if (!trimmed) return ''
      if (/^\d+[mhd]\s+/u.test(trimmed) || !timeframe) {
        return trimmed
      }
      return `${timeframe} ${trimmed}`.trim()
    }
    const formatDraft = (draft: StrategyRuleDraft | undefined): string => {
      if (!draft) return ''
      const normalizedText = draft.text.replace(/^\d+[mhd]\s+/u, '').trim()
      return formatRuleSummaryText(normalizedText, draft.timeframe)
    }
    const formatDrafts = (items: StrategyRuleDraft[]): string => {
      const summaries = items
        .map(item => formatDraft(item))
        .filter(Boolean)
      return Array.from(new Set(summaries)).join('；')
    }
    const entrySummary = this.buildNormalizedTriggerSummary(normalizedIntent, 'entry', executionContext.timeframe)
      || formatDrafts(drafts.entry)
    const exitSummary = this.buildNormalizedTriggerSummary(normalizedIntent, 'exit', executionContext.timeframe)
      || formatDrafts(drafts.exit)

    const segments = [
      [
        executionContext.exchange,
        executionContext.marketType === 'perp' ? '合约' : executionContext.marketType === 'spot' ? '现货' : '',
        executionContext.symbol,
        executionContext.timeframe,
      ].filter(Boolean).join(' '),
      this.buildGridSummarySegment(checklist.grid),
      entrySummary ? `入场：${entrySummary}` : '',
      exitSummary ? `出场：${exitSummary}` : '',
      this.buildRiskSummarySegment('止损', checklist.riskRules, 'stopLoss'),
      this.buildRiskSummarySegment('止盈', checklist.riskRules, 'takeProfit'),
      positionPct,
    ].filter(Boolean)

    return segments.length > 0 ? segments.join('；') : null
  }

  private buildSemanticClarificationSummary(semanticState: SemanticState): string {
    return this.semanticStateProjection.buildConversationView(semanticState).summary
  }

  private buildSemanticLogicGateAssistantPrompt(
    semanticState: SemanticState,
  ): string {
    const summary = this.buildSemanticClarificationSummary(semanticState)
    return `我整理出的策略逻辑如下：${summary}。请确认是否按这个逻辑生成脚本。`
  }

  private buildSemanticNormalizationAssistantPrompt(
    semanticState: SemanticState,
    normalization: NormalizationResult,
  ): string {
    const summary = this.buildSemanticClarificationSummary(semanticState)
    const blocker = normalization.blockerReason ? `当前还缺少：${normalization.blockerReason}` : '当前语义仍未完整。'
    return `我当前理解的策略是：${summary}\n${blocker}`
  }

  private buildLogicGateAssistantPrompt(
    checklist: StrategyLogicSnapshot,
    normalizedIntent?: StrategyNormalizedIntent | null,
  ): string {
    const summary = this.buildClarificationSummary(checklist, normalizedIntent)
    if (summary) {
      return `我当前理解的策略是：${summary}。请确认逻辑图；请确认是否按此逻辑生成。`
    }

    return '逻辑图已更新。请确认逻辑图，确认后我再生成策略代码。'
  }

  private buildGridSummarySegment(grid: StrategyLogicSnapshot['grid']): string {
    if (!grid) return ''

    const range = typeof grid.lower === 'number' && typeof grid.upper === 'number'
      ? `${grid.lower}-${grid.upper}`
      : ''
    const step = typeof grid.stepPct === 'number' ? `步长 ${grid.stepPct}%` : ''
    const sideMode = grid.sideMode === 'bidirectional'
      ? '双向网格'
      : grid.sideMode === 'long_only'
        ? '仅做多网格'
        : grid.sideMode === 'short_only'
          ? '仅做空网格'
          : '网格'
    const parts = [sideMode, range, step].filter(Boolean)
    return parts.length > 0 ? `网格：${parts.join('，')}` : ''
  }

  private resolveExecutionContextForSummary(checklist: StrategyLogicSnapshot): {
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
    const rawTimeframe = resolveStrategyDefaultTimeframe(checklist) ?? ''

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

  private buildNormalizedTriggerSummary(
    normalizedIntent: StrategyNormalizedIntent | null | undefined,
    phase: 'entry' | 'exit',
    fallbackTimeframe: string,
  ): string {
    const triggers = normalizedIntent?.triggers.filter(item =>
      item.phase === phase
      && item.closureStatus === 'closed',
    ) ?? []
    if (triggers.length === 0) {
      return ''
    }

    const projectedSummaries = triggers
      .map((trigger, index) => {
        const projected = this.buildProjectedRuleText({
          id: `summary-${phase}-${index + 1}`,
          key: trigger.key,
          phase: trigger.phase,
          params: {
            ...trigger.params,
            ...(trigger.resolutionHints?.confirmation
              ? { confirmationMode: trigger.resolutionHints.confirmation }
              : {}),
          },
          ...(trigger.sideScope ? { sideScope: trigger.sideScope } : {}),
          status: 'locked',
          source: 'user_explicit',
          ...(trigger.evidenceText ? { evidence: { text: trigger.evidenceText, source: 'user_explicit' as const } } : {}),
          openSlots: [],
        })
        if (!projected) {
          return null
        }

        return /^\d+[mhd]\s+/u.test(projected) || !fallbackTimeframe
          ? projected
          : `${fallbackTimeframe} ${projected}`.trim()
      })
    if (projectedSummaries.some(item => item === null)) {
      return ''
    }

    return Array.from(new Set(projectedSummaries)).join('；')
  }

  private buildNormalizationAssistantPrompt(
    checklist: StrategyLogicSnapshot,
    normalization: NormalizationResult,
  ): string {
    const summary = this.buildClarificationSummary(checklist, normalization.normalizedIntent)
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
    strategyInstanceId?: string | null
  }): PublishedSnapshotProjection {
    return responseMapperHelper.buildPublishedSnapshotProjection(args)
  }

  async testEngine(dto: TestLlmCodegenEngineDto): Promise<LlmCodegenEngineTestResponseDto> {
    const constraintPayload = this.resolveTestEngineConstraintPayload(dto)

    const providerCode = this.resolveProviderCode(dto.providerCode)
    const scriptCode = await this.generateScript(constraintPayload, dto.message, {
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

  private resolveTestEngineConstraintPayload(
    dto: TestLlmCodegenEngineDto,
  ): CanonicalStrategySpec | Record<string, unknown> {
    if (dto.semanticState) {
      if (!this.isValidSemanticStateInput(dto.semanticState)) {
        throw new DomainException('codegen.invalid_semantic_input', {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
          args: { field: 'semanticState' },
        })
      }
      const semanticState = dto.semanticState as unknown as SemanticState
      const normalization = this.buildNormalizationFromSemanticState(semanticState)
      return this.buildCanonicalSpecForConversation(semanticState, normalization)
    }

    if (dto.canonicalSpec) {
      if (!this.isCanonicalSpecV2Input(dto.canonicalSpec)) {
        throw new DomainException('codegen.invalid_semantic_input', {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
          args: { field: 'canonicalSpec' },
        })
      }
      return dto.canonicalSpec
    }

    throw new DomainException('codegen.missing_required_fields', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: { missingFields: ['semanticState'] },
    })
  }

  private isValidSemanticStateInput(payload: Record<string, unknown>): boolean {
    const contextSlots = payload.contextSlots as Record<string, unknown> | undefined
    return this.hasPersistedSemanticState(payload as unknown as Prisma.JsonValue)
      && Array.isArray(payload.families)
      && Array.isArray(payload.normalizationNotes)
      && typeof payload.updatedAt === 'string'
      && Boolean(contextSlots)
      && typeof contextSlots === 'object'
      && !Array.isArray(contextSlots)
      && typeof contextSlots.exchange !== 'undefined'
      && typeof contextSlots.symbol !== 'undefined'
      && typeof contextSlots.marketType !== 'undefined'
      && typeof contextSlots.timeframe !== 'undefined'
      && (payload.triggers as unknown[]).every(item => this.isSemanticTriggerInput(item))
      && (payload.actions as unknown[]).every(item => this.isSemanticActionInput(item))
      && (payload.risk as unknown[]).every(item => this.isSemanticRiskInput(item))
      && (
        payload.position === null
        || (
          Boolean(payload.position)
          && typeof payload.position === 'object'
          && !Array.isArray(payload.position)
          && (
            typeof (payload.position as Record<string, unknown>).openSlots === 'undefined'
            || (
              Array.isArray((payload.position as Record<string, unknown>).openSlots)
              && ((payload.position as Record<string, unknown>).openSlots as unknown[]).every(slot => this.isSemanticSlotInput(slot))
            )
          )
        )
      )
  }

  private hasSemanticOpenSlots(item: unknown): boolean {
    return Boolean(item)
      && typeof item === 'object'
      && !Array.isArray(item)
      && Array.isArray((item as Record<string, unknown>).openSlots)
      && ((item as Record<string, unknown>).openSlots as unknown[]).every(slot => this.isSemanticSlotInput(slot))
  }

  private isSemanticSlotInput(slot: unknown): boolean {
    return Boolean(slot)
      && typeof slot === 'object'
      && !Array.isArray(slot)
      && typeof (slot as Record<string, unknown>).slotKey === 'string'
      && typeof (slot as Record<string, unknown>).fieldPath === 'string'
      && typeof (slot as Record<string, unknown>).status === 'string'
      && typeof (slot as Record<string, unknown>).priority === 'string'
      && typeof (slot as Record<string, unknown>).questionHint === 'string'
      && typeof (slot as Record<string, unknown>).affectsExecution === 'boolean'
  }

  private isSemanticTriggerInput(item: unknown): boolean {
    return this.hasSemanticOpenSlots(item)
      && typeof (item as Record<string, unknown>).key === 'string'
      && typeof (item as Record<string, unknown>).phase === 'string'
      && Boolean((item as Record<string, unknown>).params)
      && typeof (item as Record<string, unknown>).params === 'object'
      && !Array.isArray((item as Record<string, unknown>).params)
  }

  private isSemanticActionInput(item: unknown): boolean {
    return Boolean(item)
      && typeof item === 'object'
      && !Array.isArray(item)
      && typeof (item as Record<string, unknown>).key === 'string'
      && (
        typeof (item as Record<string, unknown>).params === 'undefined'
        || (
          Boolean((item as Record<string, unknown>).params)
          && typeof (item as Record<string, unknown>).params === 'object'
          && !Array.isArray((item as Record<string, unknown>).params)
        )
      )
  }

  private isSemanticRiskInput(item: unknown): boolean {
    return this.hasSemanticOpenSlots(item)
      && typeof (item as Record<string, unknown>).key === 'string'
      && Boolean((item as Record<string, unknown>).params)
      && typeof (item as Record<string, unknown>).params === 'object'
      && !Array.isArray((item as Record<string, unknown>).params)
  }

  private isCanonicalSpecV2Input(payload: Record<string, unknown>): boolean {
    const market = payload.market as Record<string, unknown> | undefined
    const dataRequirements = payload.dataRequirements as Record<string, unknown> | undefined
    return payload.version === 2
      && Boolean(market)
      && typeof market === 'object'
      && !Array.isArray(market)
      && typeof market.symbol === 'string'
      && typeof market.marketType === 'string'
      && Array.isArray(payload.indicators)
      && (payload.sizing === null || (Boolean(payload.sizing) && typeof payload.sizing === 'object' && !Array.isArray(payload.sizing)))
      && Boolean(payload.executionPolicy)
      && typeof payload.executionPolicy === 'object'
      && !Array.isArray(payload.executionPolicy)
      && Boolean(dataRequirements)
      && typeof dataRequirements === 'object'
      && !Array.isArray(dataRequirements)
      && Array.isArray(dataRequirements.requiredTimeframes)
      && Array.isArray(payload.rules)
      && payload.rules.length > 0
      && payload.rules.every(rule => this.isCanonicalSpecV2RuleInput(rule))
  }

  private isCanonicalSpecV2RuleInput(rule: unknown): boolean {
    return Boolean(rule)
      && typeof rule === 'object'
      && !Array.isArray(rule)
      && typeof (rule as Record<string, unknown>).phase === 'string'
      && ['entry', 'exit', 'risk', 'rebalance'].includes((rule as Record<string, unknown>).phase as string)
      && Boolean((rule as Record<string, unknown>).condition)
      && typeof (rule as Record<string, unknown>).condition === 'object'
      && !Array.isArray((rule as Record<string, unknown>).condition)
      && typeof ((rule as Record<string, unknown>).condition as Record<string, unknown>).kind === 'string'
      && this.isCanonicalConditionInput((rule as Record<string, unknown>).condition)
      && Array.isArray((rule as Record<string, unknown>).actions)
      && ((rule as Record<string, unknown>).actions as unknown[]).length > 0
      && ((rule as Record<string, unknown>).actions as unknown[]).every(action => this.isCanonicalActionInput(action))
  }

  private isCanonicalConditionInput(condition: unknown): boolean {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return false
    const kind = (condition as Record<string, unknown>).kind
    if (kind === 'atom') {
      return typeof (condition as Record<string, unknown>).key === 'string'
        && ((condition as Record<string, unknown>).key as string).trim().length > 0
    }
    if (kind === 'AND' || kind === 'OR') {
      const children = (condition as Record<string, unknown>).children
      return Array.isArray(children)
        && children.length > 0
        && children.every(child => this.isCanonicalConditionInput(child))
    }
    if (kind === 'NOT') {
      const children = (condition as Record<string, unknown>).children
      return Array.isArray(children)
        && children.length === 1
        && this.isCanonicalConditionInput(children[0])
    }
    return false
  }

  private isCanonicalActionInput(action: unknown): boolean {
    if (!action || typeof action !== 'object' || Array.isArray(action)) return false
    const type = (action as Record<string, unknown>).type
    return typeof type === 'string'
      && [
        'OPEN_LONG',
        'OPEN_SHORT',
        'CLOSE_LONG',
        'CLOSE_SHORT',
        'REDUCE_LONG',
        'REDUCE_SHORT',
        'FORCE_EXIT',
        'BLOCK_NEW_ENTRY',
      ].includes(type)
  }

  private resolveLogicSnapshotMissingFields(checklist: StrategyLogicSnapshot): string[] {
    const missing: string[] = []
    if (!Array.isArray(checklist.entryRules) || checklist.entryRules.length === 0) {
      missing.push('entryRules')
    }
    if (!Array.isArray(checklist.exitRules) || checklist.exitRules.length === 0) {
      missing.push('exitRules')
    }
    return missing
  }

  private resolveActiveGateMissingFields(
    checklist: StrategyLogicSnapshot,
    semanticReady: boolean,
    compileability: CanonicalCompileabilityReport,
  ): string[] {
    const missingFields = this.resolveLogicSnapshotMissingFields(checklist)
    if (semanticReady && compileability.canCompile) {
      return []
    }
    return missingFields
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
    semanticState: SemanticState,
    normalization: NormalizationResult = this.buildNormalizationFromSemanticState(semanticState),
  ) {
    return this.canonicalSpecBuilder.buildFromNormalizedIntent(
      this.buildSemanticCanonicalContext(semanticState),
      normalization.normalizedIntent,
    )
  }

  /**
   * Legacy compatibility path for call sites that have not yet been converted to
   * SemanticState. The semantic conversation path must pass `semanticState` to
   * `buildCanonicalSpecForConversation()` and must not rely on this method as an
   * authority source.
   */
  private buildSemanticCanonicalContext(semanticState: SemanticState): {
    market: {
      exchange?: 'binance' | 'okx' | 'hyperliquid'
      marketType?: 'spot' | 'perp'
      defaultTimeframe?: string | null
    }
    symbols?: string[]
    timeframes?: string[]
  } {
    const exchange = this.readSemanticContextValue(semanticState.contextSlots.exchange)
    const symbol = this.readSemanticContextValue(semanticState.contextSlots.symbol)
    const marketType = this.readSemanticContextValue(semanticState.contextSlots.marketType)
    const timeframe = this.readSemanticContextValue(semanticState.contextSlots.timeframe)

    return {
      market: {
        ...(exchange === 'binance' || exchange === 'okx' || exchange === 'hyperliquid'
          ? { exchange }
          : {}),
        ...(marketType === 'spot' || marketType === 'perp'
          ? { marketType }
          : {}),
        ...(timeframe ? { defaultTimeframe: timeframe } : {}),
      },
      ...(symbol ? { symbols: [symbol] } : {}),
      ...(timeframe ? { timeframes: [timeframe] } : {}),
    }
  }

  private readSemanticContextValue(slot: SemanticSlotState | null): string | null {
    if (slot?.status !== 'locked' || typeof slot.value !== 'string' || slot.value.trim().length === 0) {
      return null
    }

    return slot.value.trim()
  }

  private buildLegacyLogicSnapshotFromSemanticState(
    state: SemanticState,
    fallbackLogicSnapshot: StrategyLogicSnapshot = {},
  ): StrategyLogicSnapshot {
    const projectedGrid = this.buildLegacyGrid(state.triggers)
    const nextLogicSnapshot: StrategyLogicSnapshot = {
      ...fallbackLogicSnapshot,
      riskRules: fallbackLogicSnapshot.riskRules ? { ...fallbackLogicSnapshot.riskRules } : undefined,
      stateGates: fallbackLogicSnapshot.stateGates ? { ...fallbackLogicSnapshot.stateGates } : undefined,
      market: fallbackLogicSnapshot.market ? { ...fallbackLogicSnapshot.market } : undefined,
      grid: fallbackLogicSnapshot.grid ? { ...fallbackLogicSnapshot.grid } : undefined,
    }

    const entryRules = this.buildProjectedRulesForPhase(state, 'entry')
    const exitRules = this.buildProjectedRulesForPhase(state, 'exit')

    if (entryRules.length > 0) {
      nextLogicSnapshot.entryRules = entryRules
      nextLogicSnapshot.entryRuleDrafts = undefined
    }
    if (exitRules.length > 0) {
      nextLogicSnapshot.exitRules = exitRules
      nextLogicSnapshot.exitRuleDrafts = undefined
    }

    const projectedStateGates = this.buildProjectedStateGates(state)
    if (Object.keys(projectedStateGates).length > 0) {
      nextLogicSnapshot.stateGates = {
        ...(nextLogicSnapshot.stateGates ?? {}),
        ...projectedStateGates,
      }
    }

    const riskRules = {
      ...(nextLogicSnapshot.riskRules ?? {}),
    } as Record<string, unknown>

    for (const risk of state.risk) {
      if (risk.key === 'risk.stop_loss_pct' && typeof risk.params.valuePct === 'number') {
        riskRules.stopLossPct = risk.params.valuePct
      }
      if (risk.key === 'risk.take_profit_pct' && typeof risk.params.valuePct === 'number') {
        riskRules.takeProfitPct = risk.params.valuePct
      }
      if (risk.key === 'risk.max_drawdown_pct' && typeof risk.params.valuePct === 'number') {
        riskRules.maxDrawdownPct = risk.params.valuePct
      }
      if (risk.key === 'risk.max_single_loss_pct' && typeof risk.params.valuePct === 'number') {
        riskRules.maxSingleLossPct = risk.params.valuePct
      }
      if (
        (risk.key === 'risk.stop_loss_pct' || risk.key === 'risk.take_profit_pct')
        && typeof risk.params.basis === 'string'
      ) {
        if (risk.key === 'risk.stop_loss_pct') {
          riskRules.stopLossBasis = risk.params.basis
        }
        if (risk.key === 'risk.take_profit_pct') {
          riskRules.takeProfitBasis = risk.params.basis
        }
      }
    }

    if (
      state.position?.status === 'locked'
      && state.position.mode === 'fixed_ratio'
      && Number.isFinite(state.position.value)
      && state.position.value > 0
    ) {
      riskRules.positionPct = state.position.value <= 1
        ? state.position.value * 100
        : state.position.value
    }

    const exchange = this.readSemanticContextValue(state.contextSlots.exchange)
    const symbol = this.readSemanticContextValue(state.contextSlots.symbol)
    const marketType = this.readSemanticContextValue(state.contextSlots.marketType)
    const timeframe = this.readSemanticContextValue(state.contextSlots.timeframe)

    if (exchange) riskRules.exchange = exchange
    if (marketType) riskRules.marketType = marketType
    if (Object.keys(riskRules).length > 0) {
      nextLogicSnapshot.riskRules = riskRules
    }
    if (symbol) {
      nextLogicSnapshot.symbols = [symbol]
    }
    if (timeframe) {
      nextLogicSnapshot.timeframes = [timeframe]
    }
    if (projectedGrid) {
      nextLogicSnapshot.grid = {
        ...(nextLogicSnapshot.grid ?? {}),
        ...projectedGrid,
      }
    }

    return nextLogicSnapshot
  }

  private buildLegacyGrid(
    triggers: SemanticTriggerState[],
  ): StrategyLogicSnapshot['grid'] | undefined {
    const activeGrid = triggers.find(trigger =>
      trigger.key === 'grid.range_rebalance'
      && trigger.status !== 'superseded'
    )
    if (!activeGrid) {
      return undefined
    }

    const lower = typeof activeGrid.params.rangeLower === 'number'
      ? activeGrid.params.rangeLower as number
      : undefined
    const upper = typeof activeGrid.params.rangeUpper === 'number'
      ? activeGrid.params.rangeUpper as number
      : undefined
    const stepPct = typeof activeGrid.params.stepPct === 'number'
      ? activeGrid.params.stepPct as number
      : undefined
    const sideMode = activeGrid.params.sideMode === 'long_only'
      || activeGrid.params.sideMode === 'short_only'
      || activeGrid.params.sideMode === 'bidirectional'
      ? activeGrid.params.sideMode
      : undefined
    const breakoutAction = activeGrid.params.breakoutAction === 'pause'
      || activeGrid.params.breakoutAction === 'continue'
      ? activeGrid.params.breakoutAction
      : undefined

    if (lower === undefined && upper === undefined && stepPct === undefined && sideMode === undefined && breakoutAction === undefined) {
      return undefined
    }

    return {
      ...(lower !== undefined ? { lower } : {}),
      ...(upper !== undefined ? { upper } : {}),
      ...(stepPct !== undefined ? { stepPct } : {}),
      ...(sideMode !== undefined ? { sideMode } : {}),
      ...(breakoutAction !== undefined ? { breakoutAction } : {}),
    }
  }

  private buildProjectedStateGates(state: SemanticState): NonNullable<StrategyLogicSnapshot['stateGates']> {
    const nextStateGates: NonNullable<StrategyLogicSnapshot['stateGates']> = {}

    for (const trigger of state.triggers) {
      if (trigger.phase !== 'gate') continue

      if (trigger.key === 'market.regime' && typeof trigger.params.value === 'string') {
        nextStateGates.marketRegime = trigger.params.value as NonNullable<StrategyLogicSnapshot['stateGates']>['marketRegime']
      }
      if (trigger.key === 'trend.direction' && typeof trigger.params.value === 'string') {
        nextStateGates.trendDirection = trigger.params.value as NonNullable<StrategyLogicSnapshot['stateGates']>['trendDirection']
      }
      if (trigger.key === 'volatility.state' && typeof trigger.params.value === 'string') {
        nextStateGates.volatilityState = trigger.params.value as NonNullable<StrategyLogicSnapshot['stateGates']>['volatilityState']
      }
    }

    return nextStateGates
  }

  private buildProjectedRulesForPhase(
    state: SemanticState,
    phase: 'entry' | 'exit',
  ): string[] {
    return state.triggers
      .filter(trigger => trigger.phase === phase && trigger.status !== 'superseded')
      .map(trigger => this.buildProjectedRuleText(trigger))
      .filter((rule): rule is string => Boolean(rule))
  }

  private buildProjectedRuleText(trigger: SemanticTriggerState): string | null {
    if (trigger.key === 'execution.on_start') {
      return this.buildProjectedExecutionRule(trigger)
    }

    if (trigger.key === 'price.percent_change') {
      return this.buildProjectedPercentChangeRule(trigger)
    }

    if (
      (trigger.key === 'indicator.above' || trigger.key === 'indicator.below')
      && trigger.params.indicator === 'ma'
    ) {
      return this.buildProjectedMovingAverageRule(trigger)
    }

    if (
      trigger.key === 'bollinger.touch_upper'
      || trigger.key === 'bollinger.touch_lower'
      || trigger.key === 'bollinger.touch_middle'
    ) {
      return this.buildProjectedBollingerRule(trigger)
    }

    return null
  }

  private buildProjectedExecutionRule(trigger: SemanticTriggerState): string | null {
    if (trigger.phase === 'entry') {
      if (trigger.sideScope === 'short') {
        return '立即开始时市价做空一次'
      }
      return '立即开始时市价买入一次'
    }

    if (trigger.phase === 'exit') {
      if (trigger.sideScope === 'short') {
        return '立即开始时市价平空一次'
      }
      return '立即开始时市价卖出一次'
    }

    return null
  }

  private buildProjectedPercentChangeRule(trigger: SemanticTriggerState): string | null {
    const valuePct = typeof trigger.params.valuePct === 'number'
      ? trigger.params.valuePct
      : null
    if (valuePct === null || !Number.isFinite(valuePct) || valuePct === 0) {
      return null
    }

    const timeframe = typeof trigger.params.window === 'string' && trigger.params.window.trim().length > 0
      ? `${trigger.params.window.trim()} `
      : ''
    const basis = typeof trigger.params.basis === 'string' ? trigger.params.basis : 'prev_close'
    const basisLabel = basis === 'entry_avg_price' || basis === 'position_pnl'
      ? '开仓均价'
      : '上一根K线收盘价'
    const direction = valuePct > 0 ? '上涨' : '下跌'
    const pctText = `${Math.abs(valuePct)}%`
    const action = trigger.phase === 'entry'
      ? (trigger.sideScope === 'short' ? '做空开仓' : '买入开仓')
      : (trigger.sideScope === 'short' ? '卖出平空' : '卖出平仓')

    return `${timeframe}当前K线收盘价相对于${basisLabel}${direction}≥${pctText}时${action}`.trim()
  }

  private buildProjectedMovingAverageRule(trigger: SemanticTriggerState): string | null {
    const referenceRole = trigger.params.referenceRole === 'short_term' ? '短期均线' : '长期均线'
    const referencePeriod = typeof trigger.params['reference.period'] === 'number'
      ? `（${trigger.params['reference.period']}）`
      : ''
    const confirmationPrefix = trigger.params.confirmationMode === 'close_confirm'
      ? '收盘确认'
      : (trigger.params.confirmationMode === 'touch' ? '盘中' : '')
    const verb = trigger.key === 'indicator.above' ? '突破' : '跌破'
    const action = trigger.phase === 'entry'
      ? (trigger.sideScope === 'short' ? '做空' : '买入')
      : (trigger.sideScope === 'short' ? '平空' : '卖出')

    return `${confirmationPrefix}价格${verb}${referenceRole}${referencePeriod}时${action}`
  }

  private buildProjectedBollingerRule(trigger: SemanticTriggerState): string | null {
    const period = this.readPositiveNumber(trigger.params.period) ?? 20
    const stdDev = this.readPositiveNumber(trigger.params.stdDev) ?? 2
    const confirmationPrefix = trigger.params.confirmationMode === 'close_confirm'
      ? 'K线收盘后确认'
      : '触及'

    if (trigger.phase === 'entry') {
      const band = trigger.key === 'bollinger.touch_upper'
        ? '上轨'
        : trigger.key === 'bollinger.touch_lower'
          ? '下轨'
          : '中轨'
      const action = trigger.sideScope === 'short' ? '做空' : '做多'
      return `${confirmationPrefix}突破布林带(${period},${this.formatPositiveNumber(stdDev)})${band}时${action}`
    }

    if (trigger.phase === 'exit' && trigger.key === 'bollinger.touch_middle') {
      const action = this.resolveProjectedExitAction(trigger, {
        long: '平多',
        short: '平空',
        generic: '平仓',
      })
      return `价格回到布林带中轨(MA${period})时${action}`
    }

    return null
  }

  private resolveProjectedExitAction(
    trigger: SemanticTriggerState,
    labels: {
      long: string
      short: string
      generic: string
    },
  ): string {
    const evidenceText = trigger.evidence?.text?.trim() ?? ''
    if (/平多/u.test(evidenceText)) {
      return labels.long
    }
    if (/平空/u.test(evidenceText)) {
      return labels.short
    }
    if (/平仓|离场|出场/u.test(evidenceText)) {
      return labels.generic
    }

    if (trigger.sideScope === 'short') {
      return labels.short
    }
    if (trigger.sideScope === 'long') {
      return labels.long
    }
    return labels.generic
  }

  private readPositiveNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
  }

  private formatPositiveNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : String(value)
  }

  private mergeLogicSnapshotIntoSemanticStateForLegacyCompatibility(
    currentState: SemanticState,
    checklist: StrategyLogicSnapshot,
  ): SemanticState {
    return this.semanticStateMerge.merge({
      persisted: currentState,
      derived: this.buildFallbackSemanticStateForLegacyCompatibility(checklist),
    })
  }

  private buildCompileabilityAssistantPrompt(report: CanonicalCompileabilityReport): string {
    return `当前规则还不能稳定生成脚本：${report.reasons.join('，')}。请按这些阻塞点补充可程序化规则后，我再继续整理逻辑图。`
  }

  private buildStrategyDecision(input: {
    checklist: StrategyLogicSnapshot
    clarification: {
      clarificationState: StrategyClarificationStateWithSummary
      blockingReasons: StrategyBlockingReason[]
    }
    effectiveBlockingReasons?: StrategyBlockingReason[]
    compileability: CanonicalCompileabilityReport | null
    constraintPack: ConstraintPackSnapshot
  }) {
    const normalizedSummary = input.clarification.clarificationState.summary?.trim()
      || this.buildClarificationSummary(input.checklist)
      || '已识别部分条件，但仍未完整。'

    return this.uniquenessDecision.decide({
      normalizedSummary,
      blockingReasons: input.effectiveBlockingReasons ?? input.clarification.blockingReasons,
      inferredAssumptions: this.collectInferredAssumptions(
        input.checklist,
        input.constraintPack,
      ),
      compileability: input.compileability,
    })
  }

  private resolveInitialStartSessionStatus(input: {
    clarificationState: Pick<StrategyClarificationState, 'status'>
    normalizationBlocked: boolean
    compileability: CanonicalCompileabilityReport
    decisionKind: 'DIRECT_COMPILE' | 'CONFIRM_INFERRED' | 'ASK_CLARIFY'
  }): LlmCodegenSessionStatus {
    return input.clarificationState.status === 'CLEAR'
      && input.decisionKind === 'DIRECT_COMPILE'
      && !input.normalizationBlocked
      && input.compileability.canCompile
      ? 'CONFIRM_GATE'
      : 'DRAFTING'
  }

  private buildEffectiveBlockingReasonsFromClarificationState(
    clarificationState: Pick<StrategyClarificationState, 'status' | 'items'>,
  ): StrategyBlockingReason[] {
    if (clarificationState.status !== 'NEEDS_CLARIFICATION') {
      return []
    }

    return clarificationState.items
      .filter(item => item.blocking && item.status === 'pending')
      .map(item => ({
        key: item.key,
        reason: this.mapClarificationReasonToBlockingReason(item.reason),
        priority: typeof item.priority === 'number' ? item.priority : this.estimateBlockingReasonPriority(item.reason),
        question: item.question,
      }))
  }

  private estimateBlockingReasonPriority(
    reason: StrategyClarificationItem['reason'],
  ): number {
    if (reason === 'conflicting_market_scope' || reason === 'invalid_spot_short_combo') return 100
    if (reason === 'missing_entry_rules' || reason === 'missing_exit_rules' || reason === 'missing_action_uniqueness' || reason === 'missing_side_scope' || reason === 'direction_ambiguous' || reason === 'atomic_semantic_fork') return 90
    if (reason === 'missing_stop_loss_rule' || reason === 'missing_take_profit_rule' || reason === 'grid_params_missing' || reason === 'ambiguous_risk_effect' || reason === 'ambiguous_state_gate') return 70
    if (reason === 'missing_exchange' || reason === 'missing_symbol' || reason === 'missing_market_type' || reason === 'missing_timeframe' || reason === 'missing_position_pct' || reason === 'missing_position_mode') return 60
    if (reason === 'ambiguous_condition_basis') return 50
    return 10
  }

  private resolveContinueSessionDeterministicAuthority(input: {
    semanticState: SemanticState
    clarificationState: Pick<StrategyClarificationState, 'status'>
    normalization: NormalizationResult
    compileability: CanonicalCompileabilityReport
    decisionKind: 'DIRECT_COMPILE' | 'CONFIRM_INFERRED' | 'ASK_CLARIFY'
    semanticReadyForGenerate: boolean
  }): 'clarification' | 'decision' | 'normalization' | 'compileability' | 'confirm_gate' | null {
    if (input.clarificationState.status === 'NEEDS_CLARIFICATION') {
      return 'clarification'
    }

    if (input.decisionKind === 'CONFIRM_INFERRED') {
      return 'decision'
    }

    if (input.normalization.blocked && !input.semanticReadyForGenerate) {
      return 'normalization'
    }

    const hasDeterministicStrategySemantics = this.hasDeterministicStrategySemantics(input.semanticState)

    if (!input.compileability.canCompile) {
      return 'compileability'
    }

    if (!hasDeterministicStrategySemantics) {
      return null
    }

    return !input.normalization.blocked
      ? 'confirm_gate'
      : null
  }

  private hasDeterministicStrategySemantics(
    semanticState: SemanticState,
  ): boolean {
    return this.semanticStateProjection.buildConversationView(semanticState).hasDeterministicSemantics
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
    checklist: StrategyLogicSnapshot,
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
    const normalizedIntent = buildNormalizedIntentFromSemanticState(semanticState)
    const nextOpenSlot = this.findNextOpenSemanticSlot(semanticState)

    return {
      normalizedIntent,
      blocked: nextOpenSlot !== null,
      ...(nextOpenSlot ? { blockerReason: nextOpenSlot.questionHint } : {}),
    }
  }

  private resolveSemanticClarificationArtifacts(semanticState: SemanticState): {
    clarificationState: StrategyClarificationStateWithSummary
    normalization: NormalizationResult
    executionContext: StrategyExecutionContextResolution
    blockingReasons: StrategyBlockingReason[]
    clarificationPrompt: string | null
  } {
    const projectedLogicSnapshot = this.buildLegacyLogicSnapshotProjectionForCompatibility(semanticState, {})
    const clarificationState = this.buildClarificationFromSemanticState(
      semanticState,
      projectedLogicSnapshot,
      { preserveLegacyFallback: false },
    )
    const normalization = this.buildNormalizationFromSemanticState(semanticState)
    const executionContext = this.executionContext.resolveFromSemanticState(semanticState)
    const blockingReasons = this.buildEffectiveBlockingReasonsFromClarificationState(clarificationState)
    const clarificationPrompt = this.buildSemanticClarificationPrompt(semanticState)
      || this.clarificationQuestion.build(clarificationState)

    return {
      clarificationState,
      normalization,
      executionContext,
      blockingReasons,
      clarificationPrompt,
    }
  }

  private async withConfirmedInferredDecisionKeys(
    constraintPack: ConstraintPackSnapshot,
    semanticState: SemanticState,
    message: string | undefined,
    options?: { providerCode?: string, model?: string },
  ): Promise<{
      semanticState: SemanticState
      constraintPack: ConstraintPackSnapshot
      consumed: boolean
    }> {
    const clarification = this.resolveSemanticClarificationArtifacts(semanticState)
    const checklist = this.buildLegacyLogicSnapshotProjectionForCompatibility(semanticState, {})
    const compileability = this.evaluateCanonicalCompileability(
      this.buildCanonicalSpecForConversation(semanticState, clarification.normalization),
    )
    const decision = this.buildStrategyDecision({
      checklist,
      clarification,
      compileability,
      constraintPack,
    })

    if (decision.kind !== 'CONFIRM_INFERRED') {
      return {
        semanticState,
        constraintPack,
        consumed: false,
      }
    }
    const assistantPrompt = this.clarificationQuestion.buildFromDecision(decision)

    const explicitResponse = await this.consumeExplicitInferredDecisionResponse(
      semanticState,
      decision.inferredAssumptions.map(item => item.key),
      message,
      assistantPrompt,
      'CONFIRM_INFERRED',
      options,
    )
    const remainingKeys = decision.inferredAssumptions
      .map(item => item.key)
      .filter(key => !explicitResponse.overriddenKeys.includes(key))
    const confirmedKeys = remainingKeys.filter(key => explicitResponse.confirmedKeys.includes(key))

    if (explicitResponse.overriddenKeys.length === 0 && confirmedKeys.length === 0) {
      return {
        semanticState,
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
      semanticState: explicitResponse.semanticState,
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

  private async consumeExplicitInferredDecisionResponse(
    semanticState: SemanticState,
    decisionKeys: string[],
    message: string | undefined,
    assistantPrompt: string | undefined,
    conversationPhase: string | undefined,
    options?: { providerCode?: string, model?: string },
  ): Promise<{
      semanticState: SemanticState
      confirmedKeys: string[]
      overriddenKeys: string[]
    }> {
    const classification = await this.inferredConfirmationClassifier.classifyInferredDecisionReply({
      message,
      assistantPrompt,
      conversationPhase,
      providerCode: options?.providerCode,
      model: options?.model,
      decisionKeys,
      semanticDefaults: this.buildInferredConfirmationSemanticDefaults(semanticState),
    })
    const nextSemanticState = this.applyInferredRiskBasisOverridesToSemanticState(
      semanticState,
      classification.overriddenBasisByKey,
    )

    return {
      semanticState: nextSemanticState,
      confirmedKeys: classification.confirmedKeys,
      overriddenKeys: classification.overriddenKeys,
    }
  }

  private buildInferredConfirmationSemanticDefaults(
    semanticState: SemanticState,
  ): InferredConfirmationSemanticDefaults {
    return this.semanticStateProjection.buildConversationView(semanticState).inferredDefaults
  }

  private applyInferredRiskBasisOverridesToSemanticState(
    semanticState: SemanticState,
    overrides: Partial<Record<InferredConfirmationDecisionKey, StrategyRuleBasis['kind']>>,
  ): SemanticState {
    const nextStopLossBasis = overrides['risk.stopLossBasis']
    const nextTakeProfitBasis = overrides['risk.takeProfitBasis']
    if (!nextStopLossBasis && !nextTakeProfitBasis) {
      return semanticState
    }

    let changed = false
    const nextRisk = semanticState.risk.map(item => {
      if (item.key === 'risk.stop_loss_pct' && nextStopLossBasis) {
        const currentBasis = this.readStrategyRuleBasisKind(item.params?.basis)
        if (currentBasis !== nextStopLossBasis) {
          changed = true
          return {
            ...item,
            params: {
              ...(item.params ?? {}),
              basis: nextStopLossBasis,
            },
          }
        }
      }
      if (item.key === 'risk.take_profit_pct' && nextTakeProfitBasis) {
        const currentBasis = this.readStrategyRuleBasisKind(item.params?.basis)
        if (currentBasis !== nextTakeProfitBasis) {
          changed = true
          return {
            ...item,
            params: {
              ...(item.params ?? {}),
              basis: nextTakeProfitBasis,
            },
          }
        }
      }

      return item
    })

    return changed
      ? {
          ...semanticState,
          risk: nextRisk,
          updatedAt: new Date().toISOString(),
        }
      : semanticState
  }

  private readStrategyRuleBasisKind(value: unknown): StrategyRuleBasis['kind'] | null {
    return typeof value === 'string' && this.isStrategyRuleBasisKind(value) ? value : null
  }

  private isStrategyRuleBasisKind(value: string): value is StrategyRuleBasis['kind'] {
    return (
      value === 'prev_close'
      || value === 'entry_avg_price'
      || value === 'position_pnl'
      || value === 'peak_equity'
      || value === 'peak_position_pnl'
      || value === 'upper_band'
      || value === 'lower_band'
      || value === 'middle_band'
      || value === 'last_high'
      || value === 'last_low'
    )
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

  private normalizeLogicSnapshot(payload: StrategyLogicSnapshot | Record<string, unknown>): StrategyLogicSnapshot {
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
    ): Record<string, StrategyRuleBasis['kind']> | undefined => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
      }

      const normalized = Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, item]) => typeof item === 'string' && item.trim().length > 0)
          .map(([key, item]) => [key, (item as string).trim() as StrategyRuleBasis['kind']]),
      ) as Record<string, StrategyRuleBasis['kind']>

      return Object.keys(normalized).length > 0 ? normalized : undefined
    }

    const normalizeDrafts = (value: unknown, phase: StrategyRuleDraft['phase']): StrategyRuleDraft[] | undefined => {
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
            ? item.basis.trim() as StrategyRuleBasis['kind']
            : null
          return {
            id: typeof item.id === 'string' && item.id.trim().length > 0 ? item.id.trim() : `${phase}-${index + 1}`,
            phase,
            text,
            timeframe,
            ...(basis ? { basis } : {}),
          } satisfies StrategyRuleDraft
        })
        .filter((item): item is StrategyRuleDraft => item !== null)

      return drafts.length > 0 ? drafts : undefined
    }

    const normalizeMarket = (value: unknown): StrategyLogicSnapshot['market'] | undefined => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
      }
      const raw = value as Record<string, unknown>
      const exchange = typeof raw.exchange === 'string' && ['binance', 'okx', 'hyperliquid'].includes(raw.exchange.trim().toLowerCase())
        ? raw.exchange.trim().toLowerCase() as NonNullable<StrategyLogicSnapshot['market']>['exchange']
        : undefined
      const marketType = typeof raw.marketType === 'string' && ['spot', 'perp'].includes(raw.marketType.trim().toLowerCase())
        ? raw.marketType.trim().toLowerCase() as NonNullable<StrategyLogicSnapshot['market']>['marketType']
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

    const normalizeStateGates = (value: unknown): StrategyLogicSnapshot['stateGates'] | undefined => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
      }
      const raw = value as Record<string, unknown>
      const marketRegime = typeof raw.marketRegime === 'string' && raw.marketRegime.trim().length > 0
        ? raw.marketRegime.trim() as NonNullable<StrategyLogicSnapshot['stateGates']>['marketRegime']
        : undefined
      const trendDirection = typeof raw.trendDirection === 'string' && raw.trendDirection.trim().length > 0
        ? raw.trendDirection.trim() as NonNullable<StrategyLogicSnapshot['stateGates']>['trendDirection']
        : undefined
      const volatilityState = typeof raw.volatilityState === 'string' && raw.volatilityState.trim().length > 0
        ? raw.volatilityState.trim() as NonNullable<StrategyLogicSnapshot['stateGates']>['volatilityState']
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

    const normalizeGrid = (value: unknown): StrategyLogicSnapshot['grid'] | undefined => {
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
      const breakoutAction = raw.breakoutAction === 'pause' || raw.breakoutAction === 'continue'
        ? raw.breakoutAction
        : undefined
      const sideMode = typeof raw.sideMode === 'string'
        && (raw.sideMode === 'long_only' || raw.sideMode === 'short_only' || raw.sideMode === 'bidirectional')
        ? raw.sideMode
        : undefined

      if (lower === undefined && upper === undefined && stepPct === undefined && !sideMode && !breakoutAction) {
        return undefined
      }

      return {
        ...(lower !== undefined ? { lower } : {}),
        ...(upper !== undefined ? { upper } : {}),
        ...(stepPct !== undefined ? { stepPct } : {}),
        ...(sideMode ? { sideMode } : {}),
        ...(breakoutAction ? { breakoutAction } : {}),
      }
    }

    const normalized: StrategyLogicSnapshot = {
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
    const drafts = buildStrategyRuleDrafts(normalized)

    return {
      ...normalized,
      entryRuleDrafts: drafts.entry.length > 0 ? drafts.entry : undefined,
      exitRuleDrafts: drafts.exit.length > 0 ? drafts.exit : undefined,
      riskRuleDrafts: drafts.risk.length > 0 ? drafts.risk : undefined,
      market: normalized.market ?? (resolveStrategyDefaultTimeframe(normalized)
        ? { defaultTimeframe: resolveStrategyDefaultTimeframe(normalized) }
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

  private isNamedBasis(value: unknown): value is StrategyRuleBasis['kind'] {
    return typeof value === 'string' && value.trim().length > 0
  }

  private resolveRiskBasis(
    ruleText: string | null | undefined,
    explicitBasis: StrategyRuleBasis['kind'] | null,
  ): StrategyRuleBasis['kind'] | null {
    if (explicitBasis) return explicitBasis
    if (!ruleText?.trim()) return null
    return resolveDefaultRiskBasis(ruleText, null)
  }

  private extractRiskRuleInfo(
    text: string,
    kind: 'stopLoss' | 'takeProfit',
  ): {
      clause: string | null
      pct: number | null
    } {
    const keywords = kind === 'stopLoss'
      ? [/止损/u, /亏损/u]
      : [/止盈/u, /盈利/u, /收益率/u, /收益/u, /利润/u]
    const clauses = this.splitRiskClauses(text)

    for (const clause of clauses) {
      if (!keywords.some(pattern => pattern.test(clause))) {
        continue
      }
      const pct = this.extractPercentFromClause(clause, kind)
      return {
        clause,
        pct,
      }
    }

    return {
      clause: null,
      pct: null,
    }
  }

  private splitRiskClauses(text: string): string[] {
    return text
      .split(/[。；;\n，、]/u)
      .map(clause => clause.trim())
      .filter(Boolean)
  }

  private extractPercentFromClause(
    clause: string,
    kind?: 'stopLoss' | 'takeProfit',
  ): number | null {
    const keywordSpecificMatch = kind === 'stopLoss'
      ? (
          clause.match(/(?:止损|亏损)\s*(?:百分之?\s*)?(\d+(?:\.\d+)?)(?:\s*%|$)/u)
          ?? clause.match(/(?:百分之?\s*)?(\d+(?:\.\d+)?)\s*%(?=[^。；;\n，、]{0,16}(?:止损|亏损))/u)
        )
      : kind === 'takeProfit'
        ? (
            clause.match(/(?:止盈|盈利|收益率|收益|利润)\s*(?:百分之?\s*)?(\d+(?:\.\d+)?)(?:\s*%|$)/u)
            ?? clause.match(/(?:百分之?\s*)?(\d+(?:\.\d+)?)\s*%(?=[^。；;\n，、]{0,16}(?:止盈|盈利|收益率|收益|利润))/u)
          )
        : null
    const specificRaw = keywordSpecificMatch?.[1]
    if (specificRaw) {
      const specificValue = Number(specificRaw)
      if (Number.isFinite(specificValue)) {
        return specificValue
      }
    }

    const percentMatch = clause.match(/(?:百分之?\s*)?(\d+(?:\.\d+)?)\s*%/u)
      ?? clause.match(/(?:百分之?\s*)?(\d+(?:\.\d+)?)(?=\s*(?:止损|止盈|亏损|盈利|收益率|收益|利润|强制平仓|平仓|$))/u)
    const raw = percentMatch?.[1]
    if (!raw) return null

    const value = Number(raw)
    return Number.isFinite(value) ? value : null
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
    basis: StrategyRuleBasis['kind'] | null,
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

  private describeRiskBasisLabel(basis: StrategyRuleBasis['kind'] | null): string {
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
    constraintPayload: CanonicalStrategySpec | Record<string, unknown>,
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
        content: `需求: ${userMessage}\n约束: ${JSON.stringify(constraintPayload)}`,
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
    currentSemanticState: SemanticState,
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
              currentSemanticState,
              history: history.slice(-MAX_PLANNER_HISTORY_LINES),
            }),
          },
        ],
      })

      const content = result.content?.trim() ?? ''
      if (!content) {
        const semanticPatch = this.extractSemanticPatchFromMessage(text)
        this.logPlannerFallback('empty_content')
        return {
          related: true,
          logicReady: false,
          assistantPrompt: '我先理解到你的交易想法了。请补充入场和出场触发条件，我再整理成逻辑图。',
          ...(semanticPatch ? { semanticPatch } : {}),
        } satisfies ConversationPlan
      }

      try {
        const parsedValue = JSON.parse(content) as unknown
        const parsed = this.readPlannerPayload(parsedValue)
        const schemaMismatchReasons = this.collectPlannerSchemaMismatchReasons(parsedValue, parsed)
        if (schemaMismatchReasons.length > 0) {
          this.logPlannerFallback('schema_mismatch', {
            fields: schemaMismatchReasons.join(','),
          })
        }
        const related = typeof parsed.related === 'boolean' ? parsed.related : true
        const logicReady = typeof parsed.logicReady === 'boolean' ? parsed.logicReady : false
        const assistantPrompt = typeof parsed.assistantPrompt === 'string' && parsed.assistantPrompt.trim()
          ? parsed.assistantPrompt.trim()
          : (logicReady
              ? '我已整理出策略逻辑，请确认逻辑图。'
              : '我先继续完善策略逻辑，请补充一个关键条件。')
        const semanticPatch = this.normalizeSemanticPatch(parsed.semanticPatch ?? parsed.semanticUpdates)
        return {
          related,
          logicReady,
          assistantPrompt,
          ...(semanticPatch ? { semanticPatch } : {}),
        } satisfies ConversationPlan
      } catch {
        const semanticPatch = this.extractSemanticPatchFromMessage(text)
        this.logPlannerFallback('invalid_json', { contentLength: content.length })
        return {
          related: true,
          logicReady: false,
          assistantPrompt: '我先继续完善策略逻辑，请补充入场和出场条件。',
          ...(semanticPatch ? { semanticPatch } : {}),
        } satisfies ConversationPlan
      }
    }

    try {
      return await classifyOnce()
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error)
      const nonRetryableModelError = /model\s+not\s+exist|model.*not.*found/i.test(messageText)
      if (nonRetryableModelError) {
        const semanticPatch = this.extractSemanticPatchFromMessage(text)
        this.logPlannerFallback('model_not_found', { error: this.summarizePlannerError(error) })
        return {
          related: true,
          logicReady: false,
          assistantPrompt: '我先继续完善策略逻辑，请补充入场和出场条件。',
          ...(semanticPatch ? { semanticPatch } : {}),
        }
      }
      this.logPlannerFallback('transport_failure_retrying', {
        error: this.summarizePlannerError(error),
      })
      try {
        return await classifyOnce()
      } catch (retryError) {
        const semanticPatch = this.extractSemanticPatchFromMessage(text)
        this.logPlannerFallback('transport_failure_retry_exhausted', {
          error: this.summarizePlannerError(retryError),
        })
        return {
          related: true,
          logicReady: false,
          assistantPrompt: '我先继续完善策略逻辑，请补充入场和出场条件。',
          ...(semanticPatch ? { semanticPatch } : {}),
        }
      }
    }
  }

  private extractSemanticPatchFromMessage(message?: string): CodegenSemanticPatch | undefined {
    const patch = this.semanticSeedExtractor.extract(message)
    return patch.contextSlots || patch.triggers || patch.actions || patch.risk || patch.position
      ? patch
      : undefined
  }

  private readPlannerPayload(value: unknown): {
    related?: unknown
    logicReady?: unknown
    assistantPrompt?: unknown
    semanticPatch?: unknown
    semanticUpdates?: unknown
  } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }

    return value as {
      related?: unknown
      logicReady?: unknown
      assistantPrompt?: unknown
      semanticPatch?: unknown
      semanticUpdates?: unknown
    }
  }

  private collectPlannerSchemaMismatchReasons(
    rawValue: unknown,
    parsed: {
      related?: unknown
      logicReady?: unknown
      assistantPrompt?: unknown
      semanticPatch?: unknown
      semanticUpdates?: unknown
    },
  ): string[] {
    const reasons: string[] = []
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      reasons.push('root')
      return reasons
    }

    if (parsed.related === undefined || typeof parsed.related !== 'boolean') {
      reasons.push('related')
    }
    if (parsed.logicReady === undefined || typeof parsed.logicReady !== 'boolean') {
      reasons.push('logicReady')
    }
    if (parsed.assistantPrompt === undefined || typeof parsed.assistantPrompt !== 'string') {
      reasons.push('assistantPrompt')
    }
    if (
      parsed.semanticPatch !== undefined
      && (!parsed.semanticPatch || typeof parsed.semanticPatch !== 'object' || Array.isArray(parsed.semanticPatch))
    ) {
      reasons.push('semanticPatch')
    }
    if (
      parsed.semanticUpdates !== undefined
      && (!parsed.semanticUpdates || typeof parsed.semanticUpdates !== 'object' || Array.isArray(parsed.semanticUpdates))
    ) {
      reasons.push('semanticUpdates')
    }

    return reasons
  }

  private summarizePlannerError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error)
    return message.trim().slice(0, 160)
  }

  private logPlannerFallback(
    reason: 'empty_content' | 'schema_mismatch' | 'invalid_json' | 'model_not_found' | 'transport_failure_retrying' | 'transport_failure_retry_exhausted',
    context: Record<string, string | number | boolean | undefined> = {},
  ): void {
    const contextSuffix = Object.entries(context)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ')
    this.logger.warn(
      `event=codegen_conversation_planner_fallback reason=${reason}${contextSuffix ? ` ${contextSuffix}` : ''}`,
    )
  }

  private buildSemanticStateFromPlannerPatch(
    semanticPatch: unknown,
  ): SemanticState | null {
    if (!semanticPatch || typeof semanticPatch !== 'object' || Array.isArray(semanticPatch)) {
      return null
    }

    const record = semanticPatch as Record<string, unknown>
    const triggerItems = Array.isArray(record.triggers)
      ? record.triggers
      : (Array.isArray(record.triggerUpdates) ? record.triggerUpdates : [])
    const actionItems = Array.isArray(record.actions)
      ? record.actions
      : (Array.isArray(record.actionUpdates) ? record.actionUpdates : [])
    const riskItems = Array.isArray(record.risk)
      ? record.risk
      : (Array.isArray(record.riskUpdates) ? record.riskUpdates : [])
    const positionUpdate = this.toPlannerPositionState(record.position ?? record.positionUpdate)
    const contextSlots = this.toPlannerContextSlots(record.contextSlots ?? record.contextUpdates ?? record.context)

    const triggerUpdates = triggerItems
      .map((item, index) => this.toPlannerTriggerState(item, index))
      .filter((item): item is SemanticTriggerState => item !== null)
    const actionUpdates = actionItems
      .map((item, index) => this.toPlannerActionState(item, index))
      .filter((item): item is SemanticState['actions'][number] => item !== null)
    const riskUpdates = riskItems
      .map((item, index) => this.toPlannerRiskState(item, index))
      .filter((item): item is SemanticState['risk'][number] => item !== null)

    if (
      triggerUpdates.length === 0
      && actionUpdates.length === 0
      && riskUpdates.length === 0
      && !positionUpdate
      && !Object.values(contextSlots).some(Boolean)
    ) {
      return null
    }

    return {
      version: 1,
      families: [],
      triggers: triggerUpdates,
      actions: actionUpdates,
      risk: riskUpdates,
      position: positionUpdate,
      contextSlots,
      normalizationNotes: [],
      updatedAt: new Date().toISOString(),
    }
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
      params: this.normalizePlannerTriggerParams(key, this.readPlannerParams(record.params)),
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
      openSlots: [],
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

  private normalizePlannerTriggerParams(
    key: string,
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    if (key !== 'price.percent_change' || typeof params.valuePct !== 'number' || !Number.isFinite(params.valuePct)) {
      return params
    }

    if (params.direction === 'down' || params.direction === '跌' || params.direction === '下跌') {
      return {
        ...params,
        valuePct: -Math.abs(params.valuePct),
      }
    }

    if (params.direction === 'up' || params.direction === '涨' || params.direction === '上涨') {
      return {
        ...params,
        valuePct: Math.abs(params.valuePct),
      }
    }

    return params
  }

  private mergeRuleArrays(
    baseRules: string[] | undefined,
    patchRules: string[] | undefined,
    phase: 'entry' | 'exit',
  ): string[] | undefined {
    if (!patchRules || patchRules.length === 0) {
      return baseRules
    }

    const patchHasSpecificRule = patchRules.some(rule => !this.isGenericLogicPlaceholderRule(rule, phase))
    const merged = patchHasSpecificRule
      ? [...(baseRules ?? []).filter(rule => !this.isGenericLogicPlaceholderRule(rule, phase))]
      : [...(baseRules ?? [])]

    const signatureGroups = new Map<string, string[]>()
    const ungroupedRules: string[] = []

    for (const patchRule of patchRules) {
      if (
        this.isGenericLogicPlaceholderRule(patchRule, phase)
        && merged.some(rule => !this.isGenericLogicPlaceholderRule(rule, phase))
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

  private isGenericLogicPlaceholderRule(
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

  private hasUnresolvedGenericCompileabilityGap(checklist: StrategyLogicSnapshot): boolean {
    const entryRules = checklist.entryRules ?? []
    const exitRules = checklist.exitRules ?? []
    const entryHasGenericOnly = entryRules.some(rule => this.isGenericLogicPlaceholderRule(rule, 'entry'))
      && !entryRules.some(rule => !this.isGenericLogicPlaceholderRule(rule, 'entry'))
    const exitHasGenericOnly = exitRules.some(rule => this.isGenericLogicPlaceholderRule(rule, 'exit'))
      && !exitRules.some(rule => !this.isGenericLogicPlaceholderRule(rule, 'exit'))

    return entryHasGenericOnly || exitHasGenericOnly
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

  private collectMarketScopeConflicts(base: StrategyLogicSnapshot, patch: StrategyLogicSnapshot): Array<{
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

  private normalizeSemanticPatch(semanticPatch: unknown): CodegenSemanticPatch | null {
    if (!semanticPatch || typeof semanticPatch !== 'object' || Array.isArray(semanticPatch)) {
      return null
    }

    return semanticPatch as CodegenSemanticPatch
  }

  private appendConversationHistory(
    current: string[],
    userMessage?: string,
    assistantMessage?: string,
  ): string[] {
    return conversationContextHelper.appendConversationHistory(current, userMessage, assistantMessage)
  }

  private inferRecommendationStyleFromSemanticContext(
    message: string | undefined,
    semanticState: SemanticState,
    currentStyle?: RecommendationStyle,
  ): RecommendationStyle | undefined {
    const view = this.semanticStateProjection.buildConversationView(semanticState)
    const text = `${message ?? ''} ${view.summary}`.trim()
    if (/均线|金叉|死叉|\bma\b|moving average/i.test(text)) {
      return 'ma'
    }
    if (
      view.recommendationSignals.hasGridIntent
      || view.summary.includes('价格相对')
      || /下跌|上涨|回撤|[跌涨天%]|分钟|小时|\d+\s*[mhd]/i.test(text)
    ) {
      return 'drop-rise'
    }
    return currentStyle
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
