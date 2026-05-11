import type { SemanticOrchestrationNode, SemanticState } from '../../types/semantic-state'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

function baseState(orchestrationNodes: readonly SemanticOrchestrationNode[]): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [],
    actions: [],
    risk: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-11T00:00:00.000Z',
    orchestration: {
      nodes: orchestrationNodes,
      contracts: [],
    },
  }
}

function lockedDrawdownBlock(): SemanticOrchestrationNode {
  return {
    id: 'orch-drawdown',
    kind: 'portfolioRisk',
    key: 'portfolioRisk.drawdown_block',
    params: { thresholdPct: 10, mode: 'enforce' },
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    contracts: [],
    mode: 'enforce',
    thresholdPct: 10,
  }
}

describe('SemanticStateProjectionService — orchestration parity (#1152)', () => {
  const service = new SemanticStateProjectionService()

  it('A: 仅 locked portfolioRisk.drawdown_block → hasDeterministicSemantics=true 且 summary 含 orchestration 段', () => {
    const view = service.buildConversationView(baseState([lockedDrawdownBlock()]))
    expect(view.hasDeterministicSemantics).toBe(true)
    expect(view.summary).toContain('orchestration')
  })

  it('B: orchestration 节点 status=open → 不计入 deterministic、summary 不含 orchestration 段', () => {
    const openNode: SemanticOrchestrationNode = {
      ...lockedDrawdownBlock(),
      status: 'open',
    }
    const view = service.buildConversationView(baseState([openNode]))
    expect(view.hasDeterministicSemantics).toBe(false)
    expect(view.summary).not.toContain('orchestration')
  })

  it('C: presentationRegistry 未注册的 key → fallback 用 node.key 出现在 summary', () => {
    const synthetic: SemanticOrchestrationNode = {
      ...lockedDrawdownBlock(),
      id: 'orch-synthetic',
      key: 'portfolioRisk.synthetic_for_test_only',
    }
    const view = service.buildConversationView(baseState([synthetic]))
    expect(view.hasDeterministicSemantics).toBe(true)
    expect(view.summary).toContain('portfolioRisk.synthetic_for_test_only')
  })
})
