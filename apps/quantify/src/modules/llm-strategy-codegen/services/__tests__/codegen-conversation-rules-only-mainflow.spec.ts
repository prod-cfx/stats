import type { SemanticSlotState, SemanticState } from '../../types/semantic-state'
import { CodegenConversationService } from '../codegen-conversation.service'

function semanticState(rules: SemanticState['rules'] = []): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    contextSlots: {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    position: null,
    orchestrationContracts: [],
    normalizationNotes: [],
    updatedAt: '2026-05-23T00:00:00.000Z',
    rules,
  }
}

describe('CodegenConversationService rules-only mainflow helpers', () => {
  it('builds clarification items using rule paths', () => {
    const service = Object.create(CodegenConversationService.prototype) as {
      buildRulePathClarificationState: (slots: SemanticSlotState[], reasons: string[]) => { items: Array<{ key: string, field: string }> }
    }

    const state = service.buildRulePathClarificationState([{
      slotKey: 'risk.stop_loss_pct.pct',
      fieldPath: 'rules[0].effects.risks[0].params.pct',
      status: 'open',
      priority: 'risk',
      questionHint: '请确认止损百分比。',
      affectsExecution: true,
    }], ['missing_required_rule_params'])

    expect(state.items[0]).toMatchObject({
      key: 'rules[0].effects.risks[0].params.pct',
      field: 'rules[0].effects.risks[0].params.pct',
    })
  })

  it('checks rules mainflow before confirmation artifacts', async () => {
    type Harness = {
      continueConfirmedSession: (
        session: {
          id: string
          userId: string
          status: string
          semanticState: unknown
          clarificationState: unknown
          constraintPack: unknown
        },
        dto: { message: string },
        sessionUserId: string,
      ) => Promise<unknown>
      readClarificationState: jest.Mock
      reconcileSemanticMissingPlaceholders: jest.Mock
      readSemanticState: jest.Mock
      readConstraintPack: jest.Mock
      resolveResponseLocale: jest.Mock
      shouldRejectChecklistOnlySession: jest.Mock
      hasPendingBlockingClarification: jest.Mock
      resolveSemanticClarificationArtifacts: jest.Mock
      inferFreeformSemanticClarificationAnswers: jest.Mock
      applySemanticClarificationAnswers: jest.Mock
      handleSemanticSupportGateForExistingSession: jest.Mock
      normalizeSemanticContractReadiness: jest.Mock
      withRequiredSemanticOpenSlots: jest.Mock
      hasValidLockedPositionSizing: jest.Mock
      semanticContractReadiness: {
        evaluateMainflowRulesReadiness: jest.Mock
      }
      renderRulePathClarificationPrompt: jest.Mock
      appendConversationHistory: jest.Mock
      sessionsRepo: {
        updateSession: jest.Mock
      }
      stateMachine: {
        buildConversationUpdate: jest.Mock
      }
      finalizeSessionResponse: jest.Mock
      returnPersistedSessionResponse: jest.Mock
    }

    const baseState = semanticState()
    const pendingClarification = {
      status: 'NEEDS_CLARIFICATION',
      items: [{
        key: 'existing',
        field: 'entryRules',
        reason: 'missing_entry_rules',
        blocking: true,
        question: '已有问题',
        status: 'pending',
      }],
    }
    const service = Object.create(CodegenConversationService.prototype) as Harness
    service.readClarificationState = jest.fn(() => pendingClarification)
    service.reconcileSemanticMissingPlaceholders = jest.fn((state: SemanticState) => state)
    service.readSemanticState = jest.fn(() => baseState)
    service.readConstraintPack = jest.fn(() => ({ locale: 'zh', conversationHistory: [] }))
    service.resolveResponseLocale = jest.fn(() => 'zh')
    service.shouldRejectChecklistOnlySession = jest.fn(() => false)
    service.hasPendingBlockingClarification = jest.fn(() => true)
    service.resolveSemanticClarificationArtifacts = jest.fn(() => {
      throw new Error('flat-derived artifacts should not run before rules guard')
    })
    service.inferFreeformSemanticClarificationAnswers = jest.fn(() => ({}))
    service.applySemanticClarificationAnswers = jest.fn(() => baseState)
    service.handleSemanticSupportGateForExistingSession = jest.fn(async () => ({
      semanticState: baseState,
      strategyVersion: undefined,
    }))
    service.normalizeSemanticContractReadiness = jest.fn((state: SemanticState) => state)
    service.withRequiredSemanticOpenSlots = jest.fn((state: SemanticState) => state)
    service.hasValidLockedPositionSizing = jest.fn(() => false)
    service.semanticContractReadiness = {
      evaluateMainflowRulesReadiness: jest.fn(() => ({
        ready: false,
        blockingReasons: ['missing_required_rule_params'],
        openSlots: [{
          slotKey: 'risk.stop_loss_pct.pct',
          fieldPath: 'rules[0].effects.risks[0].params.pct',
          status: 'open',
          priority: 'risk',
          questionHint: '请确认止损百分比。',
          affectsExecution: true,
        }],
      })),
    }
    service.renderRulePathClarificationPrompt = jest.fn(() => '请确认止损百分比。')
    service.appendConversationHistory = jest.fn(() => [])
    service.sessionsRepo = { updateSession: jest.fn(async () => undefined) }
    service.stateMachine = { buildConversationUpdate: jest.fn(input => input) }
    service.finalizeSessionResponse = jest.fn(input => input)
    service.returnPersistedSessionResponse = jest.fn(async (_sessionId: string, _userId: string, response: unknown) => response)

    const response = await service.continueConfirmedSession({
      id: 'session-1',
      userId: 'user-1',
      status: 'CONFIRM_GATE',
      semanticState: baseState,
      clarificationState: pendingClarification,
      constraintPack: {},
    }, {
      message: 'generate',
    }, 'user-1')

    expect(service.semanticContractReadiness.evaluateMainflowRulesReadiness).toHaveBeenCalledWith(baseState.rules)
    expect(service.resolveSemanticClarificationArtifacts).not.toHaveBeenCalled()
    expect(service.sessionsRepo.updateSession).toHaveBeenCalledWith('session-1', expect.objectContaining({
      status: 'DRAFTING',
    }))
    expect(response).toMatchObject({
      status: 'DRAFTING',
      assistantPrompt: '请确认止损百分比。',
    })
  })
})
