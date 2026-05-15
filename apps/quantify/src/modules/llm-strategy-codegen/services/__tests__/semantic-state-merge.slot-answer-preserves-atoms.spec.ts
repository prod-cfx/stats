// #1383 Lane B — 用户回答 contextSlot 时 derived 仅含 slot 答案、5 个 atom 桶皆空，
// merge 必须保留持久态所有 atom（这是 Lane B 修复的最终用户可见场景）。

import type {
  SemanticActionState,
  SemanticPositionState,
  SemanticRiskState,
  SemanticState,
  SemanticTriggerState,
} from '../../types/semantic-state'
import { SemanticStateMergeService } from '../semantic-state-merge.service'

function emptyState(): SemanticState {
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
    updatedAt: '2026-05-15T00:00:00.000Z',
  }
}

describe('SemanticStateMergeService — slot answer 不破坏 atom 持久态（#1383 Lane B）', () => {
  const merge = new SemanticStateMergeService()

  it('EMA 策略持久化 trigger+action+risk+position；derived 仅含 contextSlots.exchange=okx → 全部保留', () => {
    const trigger: SemanticTriggerState = {
      id: 't-ema-above',
      key: 'indicator.above',
      phase: 'entry',
      params: { indicator: 'ema20', period: 20 },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }
    const action: SemanticActionState = {
      id: 'a-open-long',
      key: 'open_long',
      params: { orderType: 'market' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }
    const risk: SemanticRiskState = {
      id: 'r-sl',
      key: 'risk.stop_loss_pct',
      params: { valuePct: 5 },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }
    const position: SemanticPositionState = {
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_pct',
      value: 10,
      positionMode: 'isolated',
      status: 'locked',
      source: 'user_explicit',
    }

    const persisted: SemanticState = {
      ...emptyState(),
      families: ['single-leg'],
      trigger: [trigger],
      action: [action],
      risk: [risk],
      position,
    }

    const derived: SemanticState = {
      ...emptyState(),
      contextSlots: {
        exchange: {
          slotKey: 'context.exchange',
          fieldPath: 'contextSlots.exchange',
          value: 'okx',
          status: 'locked',
          priority: 'context',
          questionHint: '请选择交易所',
          affectsExecution: true,
        },
        symbol: null,
        marketType: null,
        timeframe: null,
      },
    }

    const merged = merge.merge({ persisted, derived })

    // 4 个 atom 维度全部保留
    expect(merged.trigger).toHaveLength(1)
    expect(merged.trigger[0]?.key).toBe('indicator.above')
    expect(merged.trigger[0]?.status).toBe('locked')

    expect(merged.action).toHaveLength(1)
    expect(merged.action[0]?.key).toBe('open_long')

    expect(merged.risk).toHaveLength(1)
    expect(merged.risk[0]?.key).toBe('risk.stop_loss_pct')

    expect(merged.position).not.toBeNull()
    expect(merged.position?.value).toBe(10)
    expect(merged.position?.status).toBe('locked')

    // 同时 contextSlots.exchange 被填充
    expect(merged.contextSlots.exchange?.value).toBe('okx')
  })
})
