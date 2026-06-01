import type { SemanticRule } from '../../types/atom-expr'
import type { SemanticState } from '../../types/semantic-state'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

function baseState(rules: SemanticRule[]): SemanticState {
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
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-27T00:00:00.000Z',
    rules,
  }
}

describe('semanticStateProjectionService rules position sizing rendering', () => {
  it('renders rules-only position.sizing as user-facing per-order quote sizing', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-position-sizing',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'execution.on_start', params: {} },
      effects: {
        actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        risks: [],
        positions: [{ kind: 'atom', key: 'position.sizing', params: { sizing: { kind: 'quote', value: 10, asset: 'USDT' } } }],
        orchestration: [],
        programs: [],
      },
    }]
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const view = new SemanticStateProjectionService().buildConversationView(baseState(rules))

      expect(view.summary).toContain('单笔仓位 10 USDT')
      expect(view.summary).not.toContain('position.sizing')
      expect(view.summary).not.toContain('已识别条件，参数待补充')
      expect(warnSpy).not.toHaveBeenCalled()
    }
    finally {
      warnSpy.mockRestore()
    }
  })

  it('renders legacy fixed_pct position.sizing as percent instead of quote amount', () => {
    const rules: SemanticRule[] = [{
      id: 'rule-position-sizing-fixed-pct',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'macd' } },
      effects: {
        actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        risks: [],
        positions: [{ kind: 'atom', key: 'position.sizing', params: { mode: 'fixed_pct', value: 10 } }],
        orchestration: [],
        programs: [],
      },
    }]

    const view = new SemanticStateProjectionService().buildConversationView(baseState(rules))

    expect(view.summary).toContain('单笔仓位 10%')
    expect(view.summary).not.toContain('单笔仓位 10 USDT')
  })
})
