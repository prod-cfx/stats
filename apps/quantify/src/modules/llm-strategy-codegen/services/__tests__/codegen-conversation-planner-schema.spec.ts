import { Logger } from '@nestjs/common'
import type { CodegenSessionResponseDto } from '../../dto/codegen-session.response.dto'
import type { SemanticState } from '../../types/semantic-state'
import { CodegenConversationService } from '../codegen-conversation.service'
import { CodegenConversationStateMachine } from '../codegen-conversation-state-machine'
import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

type CreatedSessionData = Record<string, unknown> & {
  validationReport?: CodegenSessionResponseDto['validationReport'] | null
}

const EMPTY_RULES_PLAN_JSON = JSON.stringify({
  related: true,
  logicReady: true,
  assistantPrompt: 'ok',
  semanticPatch: {
    rules: [],
  },
})

const NEEDS_ENTRY_RULES = {
  status: 'NEEDS_CLARIFICATION',
  items: [
    {
      key: 'entry.rules',
      reason: 'missing_entry_rules',
      field: 'entryRules',
      blocking: true,
      question: '请补充入场规则',
      status: 'pending',
    },
  ],
  summary: null,
}

function emptySemanticState(): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    position: null,
    contextSlots: {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '1970-01-01T00:00:00.000Z',
    rules: [],
  }
}

function readEntryRejectReasons(
  validationReport: CodegenSessionResponseDto['validationReport'] | null | undefined,
): string[] {
  const entry = validationReport?.diagnostics?.entry
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return []
  }
  const rejectReasons = (entry as { rejectReasons?: unknown }).rejectReasons
  return Array.isArray(rejectReasons)
    ? rejectReasons.filter((reason): reason is string => typeof reason === 'string')
    : []
}

describe('CodegenConversation planner schema diagnostics', () => {
  it('does not surface recovered schema reject diagnostics as blocking validation report', () => {
    const svc = Object.create(CodegenConversationService.prototype) as CodegenConversationService
    const report = (svc as unknown as {
      buildPlannerValidationReport: (plan: { diagnostics?: Record<string, unknown> }) => CodegenSessionResponseDto['validationReport'] | undefined
    }).buildPlannerValidationReport({
      diagnostics: {
        gate: 'RulesTreeEntryGate',
        entry: {
          rejectReasons: ['rule_shape_invalid'],
          result: 'recovered',
        },
      },
    })

    expect(report).toBeUndefined()
  })

  it('persists diagnostics and does not return CLEAR clarification for empty planner rules', async () => {
    const createdSessions: CreatedSessionData[] = []
    const plannerDispatcherMerge = new PlannerDispatcherMergeService()
    const svc = Object.create(CodegenConversationService.prototype) as CodegenConversationService
    Object.assign(svc as unknown as Record<string, unknown>, {
      aiService: {
        chat: jest.fn()
          .mockResolvedValueOnce({ content: EMPTY_RULES_PLAN_JSON })
          .mockResolvedValueOnce({ content: EMPTY_RULES_PLAN_JSON }),
      },
      sessionsRepo: {
        createSession: jest.fn((data: CreatedSessionData) => {
          createdSessions.push(data)
          return {
            id: 'session-1',
            userId: data.userId,
            status: data.status,
            semanticState: data.semanticState ?? null,
            clarificationState: data.clarificationState ?? null,
            constraintPack: data.constraintPack ?? null,
            latestDraftCode: null,
            latestSpecDesc: data.latestSpecDesc ?? null,
            graphSnapshot: null,
            semanticGraph: null,
            validationReport: data.validationReport ?? null,
            compiledIr: null,
            rejectReason: null,
            createdAt: new Date('2026-05-19T00:00:00.000Z'),
            updatedAt: new Date('2026-05-19T00:00:00.000Z'),
            strategyInstanceId: null,
          }
        }),
      },
      plannerDispatcherMerge,
      semanticStateProjection: new SemanticStateProjectionService(),
      logger: new Logger('CodegenConversationPlannerSchemaSpec'),
      stateMachine: new CodegenConversationStateMachine(),
      genericSeedDispatcher: { dispatch: jest.fn() },
      normalizeSemanticPatch: jest.fn(v => v ?? null),
      validatePlannerRules: jest.fn().mockReturnValue({ rules: [], quarantine: [] }),
      applyValidatedPlannerRules: jest.fn(),
      extractRawPlannerRules: jest.fn((value: unknown) => {
        const payload = value && typeof value === 'object' && !Array.isArray(value)
          ? value as { semanticPatch?: { rules?: unknown } }
          : {}
        return payload.semanticPatch?.rules
      }),
      readPlannerPayload: jest.fn(v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}),
      collectPlannerSchemaMismatchReasons: jest.fn().mockReturnValue([]),
      logPlannerFallback: jest.fn(),
      localizedText: jest.fn((_locale: string, _en: string, zh: string) => zh),
      summarizePlannerError: jest.fn((e: unknown) => String(e)),
      resolveSessionUserId: jest.fn(() => 'user-1'),
      createEmptySemanticState: jest.fn(() => emptySemanticState()),
      applyConversationPlanToSemanticState: jest.fn(() => emptySemanticState()),
      reconcileSemanticMissingPlaceholders: jest.fn((state: unknown) => state),
      currentStrategyVersion: jest.fn(() => ({ version: 'test' })),
      semanticSupportClassifier: {
        classify: jest.fn((state: unknown) => ({ route: 'supported', state })),
      },
      mergeGuidePromptConfig: jest.fn(() => undefined),
      inferRecommendationStyleFromSemanticContext: jest.fn(() => undefined),
      normalizeSemanticContractReadiness: jest.fn((state: unknown) => state),
      // Object.create bypasses constructor-injected collaborators; keep this narrow so
      // the test exercises validationReport shape instead of semantic question rendering.
      resolveSemanticClarificationArtifacts: jest.fn(() => ({
        clarificationState: NEEDS_ENTRY_RULES,
        normalization: { normalizedIntent: null, blocked: true, blockerReason: '请补充入场规则' },
        executionContext: { context: {} },
        blockingReasons: [],
        clarificationPrompt: '请补充入场规则',
      })),
      buildCanonicalSpecForConversation: jest.fn(() => null),
      buildStrategyDecision: jest.fn(() => ({ kind: 'ASK_CLARIFY' })),
      resolveInitialStartSessionStatus: jest.fn(({ clarificationState, normalizationBlocked, decisionKind }) => {
        expect(clarificationState.status).toBe('NEEDS_CLARIFICATION')
        expect(normalizationBlocked).toBe(true)
        expect(decisionKind).toBe('ASK_CLARIFY')
        return 'DRAFTING'
      }),
      readCanonicalDigest: jest.fn(() => null),
      returnPersistedSessionResponse: jest.fn((_sessionId: string, _userId: string, response: unknown) => response),
    })

    const response = await svc.startSession({ initialMessage: 'BOLL 下轨开多' }, 'user-1')

    expect(response.clarificationState?.status).not.toBe('CLEAR')
    expect(response.status).toBe('DRAFTING')
    expect(response.validationReport?.ok).toBe(false)
    expect(response.validationReport?.errors.map(e => e.code)).toContain('rules_missing_or_empty')
    expect(readEntryRejectReasons(response.validationReport)).toContain('rules_missing_or_empty')
    expect(readEntryRejectReasons(createdSessions[0]?.validationReport)).toContain('rules_missing_or_empty')
    expect(createdSessions[0]?.validationReport).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'rules_missing_or_empty' }),
      ]),
    })
  })
})
