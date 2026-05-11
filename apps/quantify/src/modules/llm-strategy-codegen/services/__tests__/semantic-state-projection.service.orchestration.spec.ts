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

  // #1162 Task 6：去除 "orchestration：" 内部技术词裸前缀，改走 presentationRegistry.displayRenderer 出人话
  it('A: 仅 locked portfolioRisk.drawdown_block → hasDeterministicSemantics=true 且 summary 含人话 orchestration 内容', () => {
    const view = service.buildConversationView(baseState([lockedDrawdownBlock()]))
    expect(view.hasDeterministicSemantics).toBe(true)
    // 走 presentationRegistry.displayRenderer，渲染如"账户回撤超过 10% 时阻止开新仓"
    expect(view.summary).toMatch(/回撤|drawdown/iu)
    expect(view.summary).toContain('10')
    // 守 INVARIANT-G：不得有 "orchestration：" 内部技术词裸前缀
    expect(view.summary).not.toMatch(/orchestration：/)
  })

  it('B: orchestration 节点 status=open → 不计入 deterministic、summary 不含人话渲染', () => {
    const openNode: SemanticOrchestrationNode = {
      ...lockedDrawdownBlock(),
      status: 'open',
    }
    const view = service.buildConversationView(baseState([openNode]))
    expect(view.hasDeterministicSemantics).toBe(false)
    // status=open 节点不进 summary
    expect(view.summary).not.toMatch(/回撤/)
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
