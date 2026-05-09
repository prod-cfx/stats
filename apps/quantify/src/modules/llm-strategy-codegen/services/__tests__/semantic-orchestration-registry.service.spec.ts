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

  describe('portfolioRisk.drawdown_block', () => {
    function buildPortfolioNode(
      overrides: Partial<SemanticOrchestrationNode> = {},
    ): SemanticOrchestrationNode {
      return {
        id: 'pdd-1',
        kind: 'portfolioRisk',
        key: 'portfolioRisk.drawdown_block',
        params: {},
        status: 'open',
        source: 'user_explicit',
        openSlots: [],
        contracts: [],
        mode: 'enforce',
        thresholdPct: 10,
        scope: 'portfolio',
        ...overrides,
      }
    }

    it('getContractByKey("portfolioRisk.drawdown_block") returns contract pinned to CURRENT_SEMANTIC_VERSION with guard/block/new_entries effect', () => {
      const contract = service.getContractByKey('portfolioRisk.drawdown_block')
      expect(contract).not.toBeNull()
      expect(contract?.id).toBe('portfolioRisk.drawdown_block')
      expect(contract?.kind).toBe('portfolioRisk')
      expect(contract?.executableSinceVersion).toBe(CURRENT_SEMANTIC_VERSION)
      expect(contract?.effects).toEqual(
        expect.arrayContaining([{ domain: 'guard', verb: 'block', object: 'new_entries' }]),
      )
    })

    it('validate returns ok for a fully-specified portfolioRisk.drawdown_block node', () => {
      const node = buildPortfolioNode()
      expect(service.validate(node)).toEqual({ ok: true, missingSlots: [] })
    })

    it('validate flags missing thresholdPct with the threshold_pct slot', () => {
      const node = buildPortfolioNode({ thresholdPct: undefined })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(result.missingSlots).toHaveLength(1)
      expect(result.missingSlots[0]!.slotKey).toBe('orchestration.portfolio_drawdown.threshold_pct')
      expect(result.missingSlots[0]!.fieldPath).toBe(
        `orchestration.portfolioRisk.drawdown_block[${node.id}]`,
      )
    })

    it('validate flags thresholdPct=0 as invalid', () => {
      const node = buildPortfolioNode({ thresholdPct: 0 })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(result.missingSlots[0]!.slotKey).toBe('orchestration.portfolio_drawdown.threshold_pct')
    })

    it('validate flags an invalid mode value', () => {
      const node = buildPortfolioNode({
        mode: 'unknown' as unknown as SemanticOrchestrationNode['mode'],
      })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(result.missingSlots).toHaveLength(1)
    })

    it('validate flags scope!="portfolio" as invalid', () => {
      const node = buildPortfolioNode({
        scope: 'strategy' as unknown as SemanticOrchestrationNode['scope'],
      })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(result.missingSlots).toHaveLength(1)
    })

    it('isExecutableForStrategy returns false for a strategy without semantic version (fail-closed)', () => {
      const contract = service.getContractByKey('portfolioRisk.drawdown_block')!
      expect(service.isExecutableForStrategy(contract, { deployedAtSemanticVersion: null })).toBe(false)
    })
  })
})
