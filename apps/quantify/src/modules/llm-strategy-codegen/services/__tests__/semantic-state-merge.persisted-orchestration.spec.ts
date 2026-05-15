// #1383 Lane B — orchestration / positionConstraint 桶 persisted-only 保留回归
// 模拟「网格策略已持久化 orchestration + positionConstraint，用户回答某个 contextSlot 触发
// derived（空 orchestration/positionConstraint）」时，merge 不再静默丢失 persisted atom。

import type {
  SemanticOrchestrationNode,
  SemanticPositionConstraintState,
  SemanticState,
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

describe('SemanticStateMergeService — persisted orchestration / positionConstraint 保留（#1383 Lane B）', () => {
  const merge = new SemanticStateMergeService()

  it('网格策略：persisted 含 grid.range_rebalance + runtime.schedule；derived 空桶 → 全部保留', () => {
    const gridRangeRebalance: SemanticPositionConstraintState = {
      id: 'pc-grid-rebalance',
      key: 'grid.range_rebalance',
      params: { triggerType: 'price_break', cooldownSec: 3600 },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }

    const runtimeSchedule: SemanticOrchestrationNode = {
      id: 'orch-runtime',
      kind: 'program',
      key: 'runtime.schedule',
      params: { cron: '*/5 * * * *' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      contracts: [],
    }

    const persisted: SemanticState = {
      ...emptyState(),
      families: ['grid'],
      positionConstraint: [gridRangeRebalance],
      orchestration: [runtimeSchedule],
    }

    const derived: SemanticState = emptyState() // derived 桶全空

    const merged = merge.merge({ persisted, derived })

    expect(merged.positionConstraint).toHaveLength(1)
    expect(merged.positionConstraint[0]?.key).toBe('grid.range_rebalance')
    expect(merged.positionConstraint[0]?.status).toBe('locked')

    expect(merged.orchestration).toHaveLength(1)
    expect(merged.orchestration[0]?.key).toBe('runtime.schedule')
    expect(merged.orchestration[0]?.status).toBe('locked')
  })
})
