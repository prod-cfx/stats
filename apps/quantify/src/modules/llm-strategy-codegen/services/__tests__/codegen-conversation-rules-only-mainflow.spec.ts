import { isRuleEffectsByRole, type AtomExpr, type SemanticRule } from '../../types/atom-expr'
import type { SemanticSlotState, SemanticState } from '../../types/semantic-state'
import { CodegenConversationService } from '../codegen-conversation.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function atom(key: string, params: Record<string, unknown> = {}): AtomExpr {
  return { kind: 'atom', key, params }
}

function andExpr(...children: AtomExpr[]): AtomExpr {
  return { kind: 'and', children }
}

function sequence(...steps: AtomExpr[]): AtomExpr {
  return { kind: 'sequence', steps }
}

function rule(partial: Partial<SemanticRule> & { id: string, condition: AtomExpr }): SemanticRule {
  return {
    id: partial.id,
    phase: partial.phase ?? 'entry',
    sideScope: partial.sideScope ?? 'both',
    condition: partial.condition,
    effects: partial.effects ?? {
      actions: [],
      risks: [],
      positions: [],
      orchestration: [],
      programs: [],
    },
  }
}

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
  it('keeps conversation service off legacy flat state readers', () => {
    const source = readFileSync(join(__dirname, '../codegen-conversation.service.ts'), 'utf8')

    expect(source).not.toMatch(/semantic-state-flat-readers/u)
    expect(source).not.toMatch(/\breadFlat(?:Triggers|Actions|Risks|PositionConstraints)\b/u)
    expect(source).not.toMatch(/\bprojectToFlat\b|\breprojectFromRules\b/u)
    expect(source).not.toMatch(/\b(?:state|semanticState)\.(?:trigger|action|risk|positionConstraint|orchestration)\b/u)
    expect(source).not.toMatch(/\bsemanticPatch\.(?:atoms|triggers|actions|risk|position|orchestration)\b/u)
  })

  it('builds clarification items using rule paths', () => {
    const service = Object.create(CodegenConversationService.prototype) as {
      buildRulePathClarificationState: (slots: SemanticSlotState[], reasons: string[]) => { items: Array<{ key: string, field: string }> }
    }

    const state = service.buildRulePathClarificationState([{
      slotKey: 'risk.stop_loss_pct.valuePct',
      fieldPath: 'rules[0].effects.risks[0].params.valuePct',
      status: 'open',
      priority: 'risk',
      questionHint: '请确认止损百分比。',
      affectsExecution: true,
    }], ['missing_required_rule_params'])

    expect(state.items[0]).toMatchObject({
      key: 'rules[0].effects.risks[0].params.valuePct',
      field: 'rules[0].effects.risks[0].params.valuePct',
    })
  })

  it('treats grid.range_rebalance program condition as closed-loop entry and exit', () => {
    const readiness = new SemanticContractReadinessService()
    const state = semanticState([
      rule({
        id: 'program-bidirectional-grid',
        phase: 'program',
        condition: atom('grid.range_rebalance', {
          rangeLower: 60000,
          rangeUpper: 80000,
          stepPct: 0.5,
          sideMode: 'both',
          perGridSizing: 10,
          breakoutAction: 'continue',
        }),
        effects: {
          actions: [],
          risks: [
            atom('risk.stop_loss_pct', { basis: 'entry_avg_price', valuePct: 5 }),
            atom('risk.take_profit_pct', { basis: 'entry_avg_price', valuePct: 10 }),
          ],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }),
    ])

    const result = readiness.evaluateMainflowRulesReadiness(state.rules)

    expect(result.ready).toBe(true)
    expect(result.blockingReasons).not.toContain('missing_entry_rules')
    expect(result.blockingReasons).not.toContain('missing_exit_rules')
  })

  it('persists rule path clarification state that can be read back', () => {
    const service = Object.create(CodegenConversationService.prototype) as {
      buildRulePathClarificationState: (slots: SemanticSlotState[], reasons: string[]) => unknown
      readClarificationState: (payload: unknown) => {
        items: Array<{
          key: string
          fieldPath?: string
          status: string
          reason: string
        }>
      } | null
    }

    const state = service.buildRulePathClarificationState([{
      slotKey: 'risk.stop_loss_pct.valuePct',
      fieldPath: 'rules[0].effects.risks[0].params.valuePct',
      status: 'open',
      priority: 'risk',
      questionHint: '请确认止损百分比。',
      affectsExecution: true,
    }], ['missing_required_rule_params'])

    const readBack = service.readClarificationState(state)

    expect(readBack?.items[0]).toMatchObject({
      key: 'rules[0].effects.risks[0].params.valuePct',
      fieldPath: 'rules[0].effects.risks[0].params.valuePct',
      status: 'pending',
      reason: 'missing_semantic_risk',
    })
  })

  it('applies rule path clarification answer to rules params', () => {
    const service = Object.create(CodegenConversationService.prototype) as {
      buildRulePathClarificationState: (slots: SemanticSlotState[], reasons: string[]) => {
        items: Array<{ key: string }>
      }
      applySemanticClarificationAnswers: (
        currentState: SemanticState,
        clarificationState: { items: Array<{ key: string }> },
        answers: Record<string, string>,
      ) => SemanticState
    }
    const readiness = new SemanticContractReadinessService()
    const state = semanticState([
      rule({
        id: 'r-entry',
        phase: 'entry',
        condition: atom('price.breakout_up', { lookback: 20 }),
        effects: {
          actions: [atom('action.open_long')],
          risks: [atom('risk.stop_loss_pct', {})],
          positions: [atom('position.sizing', { value: 10, unit: 'USDT' })],
          orchestration: [atom('scope.timeframe', { timeframe: '15m' })],
          programs: [],
        },
      }),
    ])
    const before = readiness.evaluateMainflowRulesReadiness(state.rules)
    const clarificationState = service.buildRulePathClarificationState(before.openSlots, before.blockingReasons)

    const nextState = service.applySemanticClarificationAnswers(state, clarificationState, {
      [clarificationState.items[0].key]: '5%',
    })

    expect(nextState.rules?.[0].effects).toMatchObject({
      risks: [expect.objectContaining({
        params: expect.objectContaining({ valuePct: 5 }),
      })],
    })
    expect(readiness.evaluateMainflowRulesReadiness(nextState.rules).openSlots).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: 'risk.stop_loss_pct.valuePct' }),
    ]))
  })

  it('rejects negative rule path stop loss answer', () => {
    const service = Object.create(CodegenConversationService.prototype) as {
      buildRulePathClarificationState: (slots: SemanticSlotState[], reasons: string[]) => {
        items: Array<{ key: string }>
      }
      applySemanticClarificationAnswers: (
        currentState: SemanticState,
        clarificationState: { items: Array<{ key: string }> },
        answers: Record<string, string>,
      ) => SemanticState
    }
    const readiness = new SemanticContractReadinessService()
    const state = semanticState([
      rule({
        id: 'r-entry',
        phase: 'entry',
        condition: atom('price.breakout_up', { lookback: 20 }),
        effects: {
          actions: [atom('action.open_long')],
          risks: [atom('risk.stop_loss_pct', {})],
          positions: [atom('position.sizing', { value: 10, unit: 'USDT' })],
          orchestration: [atom('scope.timeframe', { timeframe: '15m' })],
          programs: [],
        },
      }),
    ])
    const before = readiness.evaluateMainflowRulesReadiness(state.rules)
    const clarificationState = service.buildRulePathClarificationState(before.openSlots, before.blockingReasons)

    const nextState = service.applySemanticClarificationAnswers(state, clarificationState, {
      [clarificationState.items[0].key]: '-5%',
    })

    expect(nextState.rules?.[0].effects).toMatchObject({
      risks: [expect.objectContaining({
        params: expect.not.objectContaining({ valuePct: expect.any(Number) }),
      })],
    })
    expect(readiness.evaluateMainflowRulesReadiness(nextState.rules).openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: 'risk.stop_loss_pct.valuePct' }),
    ]))
  })

  it('applies nested rule path risk answer to nested atom params', () => {
    const service = Object.create(CodegenConversationService.prototype) as {
      buildRulePathClarificationState: (slots: SemanticSlotState[], reasons: string[]) => {
        items: Array<{ key: string }>
      }
      applySemanticClarificationAnswers: (
        currentState: SemanticState,
        clarificationState: { items: Array<{ key: string }> },
        answers: Record<string, string>,
      ) => SemanticState
    }
    const readiness = new SemanticContractReadinessService()
    const state = semanticState([
      rule({
        id: 'r-entry',
        phase: 'entry',
        condition: atom('price.breakout_up', { lookback: 20 }),
        effects: {
          actions: [atom('action.open_long')],
          risks: [andExpr(
            atom('risk.stop_loss_pct', {}),
            atom('risk.trailing_stop', { valuePct: 3 }),
          )],
          positions: [atom('position.sizing', { value: 10, unit: 'USDT' })],
          orchestration: [atom('scope.timeframe', { timeframe: '15m' })],
          programs: [],
        },
      }),
    ])
    const before = readiness.evaluateMainflowRulesReadiness(state.rules)
    const clarificationState = service.buildRulePathClarificationState(before.openSlots, before.blockingReasons)

    expect(clarificationState.items[0].key).toBe('rules[0].effects.risks[0].and.children[0].params.valuePct')

    const nextState = service.applySemanticClarificationAnswers(state, clarificationState, {
      [clarificationState.items[0].key]: '5%',
    })

    const nestedRisk = nextState.rules?.[0].effects
    expect(nestedRisk).toMatchObject({
      risks: [expect.objectContaining({ kind: 'and' })],
    })
    if (!isRuleEffectsByRole(nestedRisk) || nestedRisk.risks[0]?.kind !== 'and') {
      throw new Error('expected nested risk and expression')
    }
    expect(nestedRisk.risks[0].children[0]).toMatchObject({
      params: expect.objectContaining({ valuePct: 5 }),
    })
    expect(readiness.evaluateMainflowRulesReadiness(nextState.rules).openSlots).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: 'risk.stop_loss_pct.valuePct' }),
    ]))
  })

  it('applies position sizing rule path clarification answer to rules params', () => {
    const service = Object.create(CodegenConversationService.prototype) as {
      buildRulePathClarificationState: (slots: SemanticSlotState[], reasons: string[]) => {
        items: Array<{ key: string }>
      }
      applySemanticClarificationAnswers: (
        currentState: SemanticState,
        clarificationState: { items: Array<{ key: string }> },
        answers: Record<string, string>,
      ) => SemanticState
    }
    const readiness = new SemanticContractReadinessService()
    const state = semanticState([
      rule({
        id: 'r-entry',
        phase: 'entry',
        condition: atom('price.breakout_up', { lookback: 20 }),
        effects: {
          actions: [atom('action.open_long')],
          risks: [atom('risk.stop_loss_pct', { valuePct: 5 })],
          positions: [atom('position.sizing', { unit: 'USDT' })],
          orchestration: [atom('scope.timeframe', { timeframe: '15m' })],
          programs: [],
        },
      }),
    ])
    const before = readiness.evaluateMainflowRulesReadiness(state.rules)
    const clarificationState = service.buildRulePathClarificationState(before.openSlots, before.blockingReasons)

    const nextState = service.applySemanticClarificationAnswers(state, clarificationState, {
      [clarificationState.items[0].key]: '100 USDT',
    })

    expect(nextState.rules?.[0].effects).toMatchObject({
      positions: [expect.objectContaining({
        params: expect.objectContaining({ value: 100 }),
      })],
    })
    expect(readiness.evaluateMainflowRulesReadiness(nextState.rules).openSlots).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: 'position.sizing.value' }),
    ]))
  })

  it('rejects negative rule path position sizing answer', () => {
    const service = Object.create(CodegenConversationService.prototype) as {
      buildRulePathClarificationState: (slots: SemanticSlotState[], reasons: string[]) => {
        items: Array<{ key: string }>
      }
      applySemanticClarificationAnswers: (
        currentState: SemanticState,
        clarificationState: { items: Array<{ key: string }> },
        answers: Record<string, string>,
      ) => SemanticState
    }
    const readiness = new SemanticContractReadinessService()
    const state = semanticState([
      rule({
        id: 'r-entry',
        phase: 'entry',
        condition: atom('price.breakout_up', { lookback: 20 }),
        effects: {
          actions: [atom('action.open_long')],
          risks: [atom('risk.stop_loss_pct', { valuePct: 5 })],
          positions: [atom('position.sizing', { unit: 'USDT' })],
          orchestration: [atom('scope.timeframe', { timeframe: '15m' })],
          programs: [],
        },
      }),
    ])
    const before = readiness.evaluateMainflowRulesReadiness(state.rules)
    const clarificationState = service.buildRulePathClarificationState(before.openSlots, before.blockingReasons)

    const nextState = service.applySemanticClarificationAnswers(state, clarificationState, {
      [clarificationState.items[0].key]: '-100 USDT',
    })

    expect(nextState.rules?.[0].effects).toMatchObject({
      positions: [expect.objectContaining({
        params: expect.not.objectContaining({ value: expect.any(Number) }),
      })],
    })
    expect(readiness.evaluateMainflowRulesReadiness(nextState.rules).openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: 'position.sizing.value' }),
    ]))
  })

  it('applies nested rule path position answer to nested atom params', () => {
    const service = Object.create(CodegenConversationService.prototype) as {
      buildRulePathClarificationState: (slots: SemanticSlotState[], reasons: string[]) => {
        items: Array<{ key: string }>
      }
      applySemanticClarificationAnswers: (
        currentState: SemanticState,
        clarificationState: { items: Array<{ key: string }> },
        answers: Record<string, string>,
      ) => SemanticState
    }
    const readiness = new SemanticContractReadinessService()
    const state = semanticState([
      rule({
        id: 'r-entry',
        phase: 'entry',
        condition: atom('price.breakout_up', { lookback: 20 }),
        effects: {
          actions: [atom('action.open_long')],
          risks: [atom('risk.stop_loss_pct', { valuePct: 5 })],
          positions: [sequence(
            atom('position.max_notional', { value: 1000 }),
            atom('position.sizing', { unit: 'USDT' }),
          )],
          orchestration: [atom('scope.timeframe', { timeframe: '15m' })],
          programs: [],
        },
      }),
    ])
    const before = readiness.evaluateMainflowRulesReadiness(state.rules)
    const clarificationState = service.buildRulePathClarificationState(before.openSlots, before.blockingReasons)

    expect(clarificationState.items[0].key).toBe('rules[0].effects.positions[0].sequence.steps[1].params.value')

    const nextState = service.applySemanticClarificationAnswers(state, clarificationState, {
      [clarificationState.items[0].key]: '100 USDT',
    })

    expect(nextState.rules?.[0].effects).toMatchObject({
      positions: [expect.objectContaining({
        steps: [
          expect.any(Object),
          expect.objectContaining({
            params: expect.objectContaining({ value: 100 }),
          }),
        ],
      })],
    })
    expect(readiness.evaluateMainflowRulesReadiness(nextState.rules).openSlots).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: 'position.sizing.value' }),
    ]))
  })

  it('builds readback-safe synthetic blocker when rule readiness has no open slots', () => {
    const service = Object.create(CodegenConversationService.prototype) as {
      buildRulePathClarificationState: (slots: SemanticSlotState[], reasons: string[]) => unknown
      readClarificationState: (payload: unknown) => {
        items: Array<{
          key: string
          fieldPath?: string
          status: string
          reason: string
          blocking: true
          question: string
        }>
      } | null
      renderRulePathClarificationPrompt: (state: { items: Array<{ status: string, question?: string }> }, locale: 'zh' | 'en') => string
      localizedText: (locale: 'zh' | 'en', en: string, zh: string) => string
    }
    service.localizedText = (_locale, _en, zh) => zh

    const state = service.buildRulePathClarificationState([], ['rules_missing_or_empty'])
    const readBack = service.readClarificationState(state)

    expect(readBack?.items[0]).toMatchObject({
      key: 'rulesMainflow.rules_missing_or_empty',
      fieldPath: 'rulesMainflow.rules_missing_or_empty',
      status: 'pending',
      reason: 'missing_semantic_contract_requirement',
      blocking: true,
    })
    expect(readBack?.items[0].question).toContain('规则')
    expect(service.renderRulePathClarificationPrompt(readBack!, 'zh')).toBe(readBack?.items[0].question)
  })

  it('checks rules mainflow before confirmation artifacts without pending clarification', async () => {
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
    const persistedClarification = { status: 'CLEAR', items: [] }
    const service = Object.create(CodegenConversationService.prototype) as Harness
    service.readClarificationState = jest.fn(() => persistedClarification)
    service.reconcileSemanticMissingPlaceholders = jest.fn((state: SemanticState) => state)
    service.readSemanticState = jest.fn(() => baseState)
    service.readConstraintPack = jest.fn(() => ({ locale: 'zh', conversationHistory: [] }))
    service.resolveResponseLocale = jest.fn(() => 'zh')
    service.shouldRejectChecklistOnlySession = jest.fn(() => false)
    service.hasPendingBlockingClarification = jest.fn(() => false)
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
          slotKey: 'risk.stop_loss_pct.valuePct',
          fieldPath: 'rules[0].effects.risks[0].params.valuePct',
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
      clarificationState: persistedClarification,
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
