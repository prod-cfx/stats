import { CURRENT_SEMANTIC_VERSION } from '../../nl-gateway/version-gate/version-gate'
import type { SemanticOrchestrationNode } from '../../types/semantic-state'
import { SemanticOrchestrationRegistryService } from '../semantic-orchestration-registry.service'

describe('SemanticOrchestrationRegistryService', () => {
  const service = new SemanticOrchestrationRegistryService()

  function buildNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
    return {
      id: 'gate-regime-1',
      kind: 'gate',
      key: 'gate.regime',
      params: {},
      status: 'open',
      source: 'user_explicit',
      openSlots: [],
      contracts: [],
      ...overrides,
    }
  }

  it('getContractByKey("gate.regime") returns contract pinned to CURRENT_SEMANTIC_VERSION', () => {
    const contract = service.getContractByKey('gate.regime')
    expect(contract).not.toBeNull()
    expect(contract?.id).toBe('gate.regime')
    expect(contract?.kind).toBe('gate')
    expect(contract?.executableSinceVersion).toBe(CURRENT_SEMANTIC_VERSION)
    expect(contract?.target).toEqual({ phase: 'entry' })
  })

  it('getContractByKey for an unknown key returns null', () => {
    expect(service.getContractByKey('unknown.key')).toBeNull()
  })

  it('validate returns ok when activeWhen is provided', () => {
    const node = buildNode({
      activeWhen: {
        kind: 'predicate',
        op: 'GT',
        left: { kind: 'indicator', name: 'sma', params: { period: 20 } },
        right: { kind: 'constant', value: 0 },
      },
    })
    expect(service.validate(node)).toEqual({ ok: true, missingSlots: [] })
  })

  it('validate flags missing activeWhen with the active_when slot', () => {
    const node = buildNode()
    const result = service.validate(node)
    expect(result.ok).toBe(false)
    expect(result.missingSlots).toHaveLength(1)
    const slot = result.missingSlots[0]!
    expect(slot.slotKey).toBe('orchestration.gate.regime.active_when')
    expect(slot.fieldPath).toBe(`orchestration.gate.regime[${node.id}]`)
    expect(slot.status).toBe('open')
    expect(slot.priority).toBe('core')
    expect(slot.affectsExecution).toBe(true)
  })

  it('isExecutableForStrategy returns false when strategy was deployed without a semantic version (fail-closed)', () => {
    const contract = service.getContractByKey('gate.regime')!
    expect(service.isExecutableForStrategy(contract, { deployedAtSemanticVersion: null })).toBe(false)
  })

  it('isExecutableForStrategy returns true when strategy was deployed at CURRENT_SEMANTIC_VERSION', () => {
    const contract = service.getContractByKey('gate.regime')!
    expect(
      service.isExecutableForStrategy(contract, { deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION }),
    ).toBe(true)
  })
})
