import type { SemanticState } from '../../types/semantic-state'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticOrchestrationRegistryService } from '../semantic-orchestration-registry.service'
import { SemanticOpenSlotAnswerResolverService } from '../semantic-open-slot-answer-resolver.service'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'
import { SemanticStateReducerService } from '../semantic-state-reducer.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

function baseState(): SemanticState {
  return {
    version: 1,
    families: [],
    rules: [{
      id: 'r-action',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'bollinger.touch_lower', params: { period: 20, stdDev: 2 } },
      effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
    }],
    trigger: [],
    action: [],
    risk: [],
    position: null,
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-19T00:00:00.000Z',
  }
}

describe('rules tree staging hard gates', () => {
  it('fails closed when rules tree and projected flat buckets are empty', () => {
    const state: SemanticState = {
      ...baseState(),
      rules: [],
      trigger: [],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
    }

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerKind: 'position', ownerId: 'rules_tree', contractId: 'rules_tree.empty' }),
    ]))
  })

  it('surfaces missing rules-tree exit as a visible missing requirement', () => {
    const result = new SemanticContractReadinessService().normalize(baseState())

    expect(result.ready).toBe(false)
    expect(result.missingRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ownerKind: 'position',
        ownerId: 'rules_tree',
        contractId: 'rules_tree.missing_exit',
        errorCode: 'READINESS_RULES_TREE_MISSING_EXIT',
      }),
    ]))
  })

  it('projected action.open_long is supported by support classifier', () => {
    const projected = new SemanticRuleProjectionService().reprojectFromRules(baseState())
    expect(projected.action.map(a => a.key)).toEqual(['action.open_long'])

    const classified = new SemanticSupportClassifierService(
      new SemanticAtomRegistryService(),
      new SemanticOrchestrationRegistryService(),
    ).classify(projected)

    expect(classified.unknownAtoms).toEqual([])
    expect(classified.unsupportedAtoms).toEqual([])
    expect(classified.state.action[0]!.support).toBeUndefined()
  })

  it('locks explicit context and default risk basis from rules-tree state', () => {
    const state = baseState()
    const next: SemanticState = {
      ...state,
      contextSlots: {
        exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请选择交易所', affectsExecution: true },
        symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '请选择交易标的', affectsExecution: true },
        marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'perp', status: 'locked', priority: 'context', questionHint: '请选择市场类型', affectsExecution: true },
        timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '15m', status: 'locked', priority: 'context', questionHint: '请选择周期', affectsExecution: true },
      },
      rules: [{
        id: 'r-risk',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', reference: { period: 20 } } },
        effects: [
          { kind: 'atom', key: 'action.open_long', params: {} },
          { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
        ],
      }],
    }
    const projected = new SemanticRuleProjectionService().reprojectFromRules(next)
    expect(projected.contextSlots.exchange?.value).toBe('okx')
    expect(projected.contextSlots.timeframe?.value).toBe('15m')
    expect(projected.risk[0]!.params.basis).toBe('entry_avg_price')
  })

  it('keeps rules-tree state in clarification when executable context is missing', () => {
    const state: SemanticState = {
      ...baseState(),
      rules: [
        {
          id: 'r-entry',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: { period: 20, stdDev: 2 } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'r-exit',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', reference: { period: 20 } } },
          effects: [
            { kind: 'atom', key: 'action.close_long', params: {} },
            { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
          ],
        },
      ],
    }

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.state.contextSlots.exchange).toEqual(expect.objectContaining({
      slotKey: 'exchange',
      fieldPath: 'contextSlots.exchange',
      status: 'open',
      priority: 'context',
      affectsExecution: true,
    }))
    expect(result.state.unsupportedFallback).toBeUndefined()
  })

  it('closes executable context slot after user answers market type without dropping rules', () => {
    const state: SemanticState = {
      ...baseState(),
      rules: [
        {
          id: 'r-entry',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'bollinger.touch_lower', params: { period: 20, stdDev: 2 } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'r-exit',
          phase: 'exit',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', reference: { period: 20 } } },
          effects: [
            { kind: 'atom', key: 'action.close_long', params: {} },
            { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
          ],
        },
      ],
    }
    const readiness = new SemanticContractReadinessService().normalize(state)

    const reduced = new SemanticStateReducerService().applyClarificationAnswer({
      currentState: readiness.state,
      targetSlotKey: 'marketType',
      answer: '合约',
      messageIndex: 1,
    })

    expect(reduced.contextSlots.marketType).toEqual(expect.objectContaining({
      slotKey: 'marketType',
      fieldPath: 'contextSlots.marketType',
      value: 'perp',
      status: 'locked',
    }))
    expect(reduced.rules).toEqual(state.rules)
    expect(reduced.risk.map(risk => risk.key)).toEqual(['risk.stop_loss_pct'])
  })

  it('consumes short exchange answer against pending context slot before fragment fallback', () => {
    const state: SemanticState = {
      ...baseState(),
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'open',
          priority: 'context',
          questionHint: '请选择交易所',
          affectsExecution: true,
        },
        symbol: null,
        marketType: null,
        timeframe: null,
      },
    }

    const result = new SemanticOpenSlotAnswerResolverService().resolve({
      currentState: state,
      message: 'okx',
      clarificationState: {
        items: [{
          status: 'pending',
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
        }],
      },
    })

    expect(result.consumed).toBe(true)
    if (result.consumed) {
      expect(result.nextState.contextSlots.exchange).toEqual(expect.objectContaining({
        value: 'okx',
        status: 'locked',
      }))
      expect(result.nextState.rules).toEqual(state.rules)
      expect(result.closedSlotKeys).toEqual(['exchange'])
    }
  })
})
