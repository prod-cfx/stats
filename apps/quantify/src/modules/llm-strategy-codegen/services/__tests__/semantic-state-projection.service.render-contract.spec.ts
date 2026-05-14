// #1154 INVARIANT-E 补强：对 corpus 暂无 atomKey 专属 fixture 的 atom（如 position.pyramiding_limit），
//   在此用合成 SemanticState 直接覆盖渲染契约，避免 INVARIANT-E sanity 误判"假绿"。

import type { SemanticActionState, SemanticPositionState, SemanticState } from '../../types/semantic-state'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

function baseState(overrides: Partial<SemanticState>): SemanticState {
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
    updatedAt: '2026-05-11T00:00:00.000Z',
    ...overrides,
  }
}

describe('SemanticStateProjectionService — render contract (#1154)', () => {
  const service = new SemanticStateProjectionService()

  it('position.pyramiding_limit.maxLayers 必须出现在 positionSummary', () => {
    const position: SemanticPositionState = {
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }
    const positionConstraint = [{
      id: 'pyr-1',
      key: 'position.pyramiding_limit',
      params: { maxLayers: 3, layerSizing: { kind: 'ratio', value: 0.2 } },
      status: 'locked' as const,
      source: 'user_explicit' as const,
      openSlots: [],
    }] as any
    const view = service.buildConversationView(baseState({ position, positionConstraint }))
    expect(view.positionSummary).toContain('3')
    expect(view.positionSummary).toMatch(/最多.*3.*次/)
  })

  it('action.add_position addRatio=0.2 渲染为 "每次20%"', () => {
    const action: SemanticActionState = {
      id: 'add-1',
      key: 'action.add_position',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      params: { addMode: 'profit_pct', addRatio: 0.2, sizing: { kind: 'ratio', value: 0.2 } },
    }
    const view = service.buildConversationView(baseState({ action: [action] }))
    expect(view.summary).toContain('20')
    expect(view.summary).toMatch(/加仓.*盈利后加仓.*每次\s*20\s*%/)
  })

  // #1158
  it('action.add_position profitThreshold=2 渲染为 "盈利2%后加仓"', () => {
    const action: SemanticActionState = {
      id: 'add-1',
      key: 'action.add_position',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      params: { addMode: 'profit_pct', addRatio: 0.2, profitThreshold: 2, sizing: { kind: 'ratio', value: 0.2 } },
    }
    const view = service.buildConversationView(baseState({ action: [action] }))
    expect(view.summary).toMatch(/盈利\s*2\s*%\s*后加仓/)
    expect(view.summary).toMatch(/每次\s*20\s*%/)
  })

  it('action.add_position drawdownThreshold=5 渲染为 "回撤5%后加仓"', () => {
    const action: SemanticActionState = {
      id: 'add-1',
      key: 'action.add_position',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      params: { addMode: 'drawdown_pct', addRatio: 0.3, drawdownThreshold: 5, sizing: { kind: 'ratio', value: 0.3 } },
    }
    const view = service.buildConversationView(baseState({ action: [action] }))
    expect(view.summary).toMatch(/回撤\s*5\s*%\s*后加仓/)
    expect(view.summary).toMatch(/每次\s*30\s*%/)
  })

  it('risk.partial_take_profit 两档 tiers 必须出现在 riskSummary', () => {
    const risk = {
      id: 'ptp-1',
      key: 'risk.partial_take_profit' as const,
      params: {
        tiers: [
          { trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 },
          { trigger: { kind: 'pnl_pct', threshold: 10 }, reduceRatio: 0.5 },
        ],
      },
      status: 'locked' as const,
      source: 'user_explicit' as const,
      openSlots: [],
    }
    const view = service.buildConversationView(baseState({ risk: [risk] }))
    expect(view.riskSummary).toContain('5')
    expect(view.riskSummary).toContain('10')
    expect(view.riskSummary).toContain('50')
    expect(view.riskSummary).not.toContain('已识别风控，参数待补充')
  })
})
