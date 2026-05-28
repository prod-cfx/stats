import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SemanticState } from '../../types/semantic-state'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

const repoRoot = join(__dirname, '../../../../../../..')
const guardedFiles = [
  'apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts',
  'apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-normalization.ts',
  'apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts',
] as const

const poisonSlot = {
  slotKey: 'poison.slot',
  fieldPath: 'trigger[0].params.poison',
  status: 'open' as const,
  priority: 'behavior' as const,
  questionHint: 'POISON_FLAT_NEXT_QUESTION',
  affectsExecution: true,
}

function rulesOnlyStateWithPoisonFlat(): SemanticState {
  return {
    version: 1,
    families: ['single-leg'],
    rules: [{
      id: 'typed-entry',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'bollinger.touch_lower',
        params: { period: 20, stdDev: 2 },
      },
      effects: {
        actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        risks: [],
        positions: [],
        orchestration: [],
        programs: [],
      },
    }],
    trigger: [{
      id: 'poison-trigger',
      key: 'price.percent_change',
      phase: 'entry',
      params: { direction: 'down', valuePct: 99, window: '1m' },
      sideScope: 'short',
      status: 'open',
      source: 'user_explicit',
      openSlots: [poisonSlot],
    }],
    action: [{
      id: 'poison-action',
      key: 'open_short',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [{
        ...poisonSlot,
        fieldPath: 'action[0].params.poison',
      }],
    }],
    risk: [{
      id: 'poison-risk',
      key: 'risk.stop_loss_pct',
      params: { direction: 'loss', valuePct: 77, basis: 'entry_avg_price' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [{
        ...poisonSlot,
        fieldPath: 'risk[0].params.poison',
      }],
    }],
    position: {
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [{
        ...poisonSlot,
        fieldPath: 'position.value',
      }],
    },
    positionConstraint: [],
    orchestration: [{
      id: 'poison-orchestration',
      kind: 'portfolioRisk',
      key: 'portfolioRisk.drawdown_block',
      params: { thresholdPct: 66, mode: 'enforce' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      contracts: [],
      mode: 'enforce',
      thresholdPct: 66,
    }],
    orchestrationContracts: [],
    contextSlots: {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-25T00:00:00.000Z',
  }
}

describe('SemanticStateProjectionService rules-only mainflow', () => {
  const service = new SemanticStateProjectionService()

  it.each(guardedFiles)('%s reads rules mainflow through facts, not flat buckets', (file) => {
    const source = readFileSync(join(repoRoot, file), 'utf8')

    expect(source).not.toContain('semantic-state-flat-readers')
    expect(source).not.toMatch(/\bstate\.(?:trigger|action|risk|positionConstraint|orchestration)\b/u)
  })

  it('does not read poison flat buckets for summaries, display graph, or next question', () => {
    const state = rulesOnlyStateWithPoisonFlat()

    const conversation = service.buildConversationView(state)
    const clarification = service.buildClarificationView(state)
    const graph = service.buildDisplayLogicGraph(state)
    const serialized = JSON.stringify({ conversation, clarification, graph })

    expect(conversation.summary).toContain('BOLL')
    expect(conversation.triggerSummary).toBe('')
    expect(conversation.riskSummary).toBe('')
    expect(clarification.nextQuestion).toBeNull()
    expect(serialized).not.toContain('POISON_FLAT_NEXT_QUESTION')
    expect(serialized).not.toContain('99')
    expect(serialized).not.toContain('77')
    expect(serialized).not.toContain('66')
    expect(serialized).not.toContain('回撤')
    expect(serialized).not.toContain('open_short')
  })

  it('keeps locked execution context in rules-only conversation summary', () => {
    const state = rulesOnlyStateWithPoisonFlat()
    const conversation = service.buildConversationView({
      ...state,
      trigger: [],
      action: [],
      risk: [],
      position: null,
      orchestration: [],
      contextSlots: {
        exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', confidence: 1 },
        symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'ETHUSDT', status: 'locked', confidence: 1 },
        marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'spot', status: 'locked', confidence: 1 },
        timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '1h', status: 'locked', confidence: 1 },
      },
    })

    expect(conversation.summary).toContain('OKX')
    expect(conversation.summary).toContain('ETHUSDT')
    expect(conversation.summary).toContain('现货')
    expect(conversation.summary).toContain('1h')
    expect(conversation.summary).toContain('BOLL')
  })
})
