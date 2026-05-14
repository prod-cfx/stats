import type { SemanticOrchestrationNode, SemanticState } from '../../types/semantic-state'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticOrchestrationRegistryService } from '../semantic-orchestration-registry.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

function baseState(orchestrationNodes: readonly SemanticOrchestrationNode[]): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-11T00:00:00.000Z',
    orchestration: [...orchestrationNodes],
    orchestrationContracts: [],
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

describe('semanticSupportClassifierService — orchestration parity (#1152)', () => {
  const atomRegistry = new SemanticAtomRegistryService()
  const orchestrationRegistry = new SemanticOrchestrationRegistryService()
  const classifier = new SemanticSupportClassifierService(atomRegistry, orchestrationRegistry)

  it('A: locked portfolioRisk.drawdown_block 节点单独成立 → projection_gate, unknownAtoms 空', () => {
    const result = classifier.classify(baseState([lockedDrawdownBlock()]))
    expect(result.route).toBe('projection_gate')
    expect(result.unknownAtoms).toEqual([])
    expect(result.unsupportedAtoms).toEqual([])
    expect(result.state.orchestration).toHaveLength(1)
    expect(result.state.orchestration[0]?.key).toBe('portfolioRisk.drawdown_block')
  })

  it('B: locked 但 key 未在 orchestration registry 注册 → unknownAtoms 命中、route=unknown_unsupported', () => {
    const fake: SemanticOrchestrationNode = {
      ...lockedDrawdownBlock(),
      id: 'orch-fake',
      key: 'portfolioRisk.fake_drawdown',
    }
    const result = classifier.classify(baseState([fake]))
    expect(result.unknownAtoms).toEqual(['portfolioRisk.fake_drawdown'])
    expect(result.route).toBe('unknown_unsupported')
  })

  it('C: 节点携带 affectsExecution open slot → collectOpenSlots 出现该 slot 且 route=open_slots', () => {
    const nodeWithSlot: SemanticOrchestrationNode = {
      ...lockedDrawdownBlock(),
      id: 'orch-with-slot',
      openSlots: [{
        slotKey: 'portfolioRisk.drawdown_block.threshold',
        fieldPath: 'orchestration.nodes[orch-with-slot].thresholdPct',
        status: 'open',
        priority: 'risk',
        questionHint: '请确认回撤阈值',
        affectsExecution: true,
      }],
    }
    const result = classifier.classify(baseState([nodeWithSlot]))
    expect(result.route).toBe('open_slots')
    expect(result.openSlots.map(s => s.slotKey)).toContain('portfolioRisk.drawdown_block.threshold')
  })

  it('D: status=open 且 key 未注册 → 不进 unknownAtoms（仅 locked 参与 unknown 判定）', () => {
    const openUnregistered: SemanticOrchestrationNode = {
      ...lockedDrawdownBlock(),
      id: 'orch-open-unregistered',
      key: 'portfolioRisk.pending_in_progress',
      status: 'open',
      openSlots: [],
    }
    const result = classifier.classify(baseState([openUnregistered]))
    expect(result.unknownAtoms).toEqual([])
    expect(result.route).toBe('projection_gate')
  })

  it('E: 缺省构造（无 orchestrationRegistry）→ orchestration 节点全透传，不影响 route', () => {
    const fallback = new SemanticSupportClassifierService(atomRegistry)
    const fake: SemanticOrchestrationNode = {
      ...lockedDrawdownBlock(),
      id: 'orch-fake',
      key: 'portfolioRisk.fake_drawdown',
    }
    const result = fallback.classify(baseState([fake]))
    expect(result.unknownAtoms).toEqual([])
    expect(result.route).toBe('projection_gate')
    expect(result.state.orchestration).toHaveLength(1)
  })
})
