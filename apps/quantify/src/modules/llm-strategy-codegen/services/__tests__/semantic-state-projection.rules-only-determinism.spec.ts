import type { SemanticState } from '../../types/semantic-state'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

/**
 * Fix #1691 ROOT CAUSE 2：
 * rules-only mainflow 下 flat triggers/actions/risks/orchestration 桶被短路为空,
 * 但只要 rules 中至少存在一条带 atom 叶子的 program/exit/entry rule，就应视为
 * 已具备确定性语义，hasDeterministicSemantics === true，从而让确定性分支接管，
 * 避免 status 永远卡在 DRAFTING。
 */

function buildRulesOnlyState(): SemanticState {
  return {
    version: 1,
    families: [],
    rules: [
      {
        id: 'program-grid',
        phase: 'entry',
        sideScope: 'both',
        condition: { kind: 'atom', key: 'always_true', params: {} },
        effects: {
          actions: [],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [
            { kind: 'atom', key: 'grid.range_rebalance', params: { lower: 79200, upper: 80200, stepPct: 0.001, mode: 'bidirectional' } },
          ],
        },
      },
      {
        id: 'exit-stop',
        phase: 'exit',
        sideScope: 'both',
        condition: { kind: 'atom', key: 'price.percent_change', params: { direction: 'down', valuePct: 5 } },
        effects: {
          actions: [{ kind: 'atom', key: 'action.close_all', params: {} }],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      },
    ],
    position: null,
    orchestrationContracts: [],
    contextSlots: {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-28T00:00:00.000Z',
  }
}

describe('SemanticStateProjectionService rules-only determinism', () => {
  const service = new SemanticStateProjectionService()

  it('reports hasDeterministicSemantics=true for rules-only state with atom-bearing program rule', () => {
    const state = buildRulesOnlyState()
    const conversation = service.buildConversationView(state)
    expect(conversation.hasDeterministicSemantics).toBe(true)
  })

  it('derives hasGridIntent from grid atom in rule effects when flat buckets are empty', () => {
    const state = buildRulesOnlyState()
    const conversation = service.buildConversationView(state)
    expect(conversation.recommendationSignals.hasGridIntent).toBe(true)
  })

  it('returns hasDeterministicSemantics=false when rules list is empty (no atoms)', () => {
    const state = buildRulesOnlyState()
    const empty: SemanticState = { ...state, rules: [] }
    const conversation = service.buildConversationView(empty)
    expect(conversation.hasDeterministicSemantics).toBe(false)
  })
})
