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

  describe('program.fixed_grid_gated', () => {
    function buildProgramNode(
      overrides: Partial<SemanticOrchestrationNode> = {},
    ): SemanticOrchestrationNode {
      return {
        id: 'pgm-1',
        kind: 'program',
        key: 'program.fixed_grid_gated',
        params: {},
        status: 'open',
        source: 'user_explicit',
        openSlots: [],
        contracts: [],
        programKind: 'fixed_grid_gated',
        onDeactivate: 'cancel',
        rebuildPolicy: 'static',
        gridParams: {
          anchorPrice: 100,
          levelCount: 5,
          stepPct: 1,
        },
        sizing: { mode: 'fixed_quote', value: 100 },
        activeWhenRef: 'gate-regime-1',
        ...overrides,
      }
    }

    it('getContractByKey returns contract pinned to CURRENT_SEMANTIC_VERSION with guard/manage/limit_ladder effect', () => {
      const contract = service.getContractByKey('program.fixed_grid_gated')
      expect(contract).not.toBeNull()
      expect(contract?.id).toBe('program.fixed_grid_gated')
      expect(contract?.kind).toBe('program')
      expect(contract?.executableSinceVersion).toBe(CURRENT_SEMANTIC_VERSION)
      expect(contract?.target).toBeUndefined()
      expect(contract?.effects).toEqual([
        { domain: 'guard', verb: 'manage', object: 'limit_ladder' },
      ])
      expect(contract?.capabilities).toEqual([
        { domain: 'orchestration', verb: 'manage', object: 'limit_ladder', shape: {} },
      ])
      expect(contract?.runtimeRequirements).toEqual(
        expect.arrayContaining([
          { domain: 'runtime', verb: 'provide', object: 'limit_order' },
          { domain: 'runtime', verb: 'read', object: 'account_equity' },
        ]),
      )
      expect(contract?.orderRequirements).toEqual(
        expect.arrayContaining([
          { domain: 'order', verb: 'support', object: 'limit_order' },
          { domain: 'order', verb: 'cancel', object: 'limit_order' },
        ]),
      )
      expect(contract?.stateRequirements).toEqual([
        { domain: 'state', verb: 'read_write', object: 'program_lifecycle' },
      ])
    })

    it('validate returns ok for a fully-specified program node', () => {
      expect(service.validate(buildProgramNode())).toEqual({ ok: true, missingSlots: [] })
    })

    it('validate flags unknown program key', () => {
      const node = buildProgramNode({ key: 'program.unknown' })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(result.missingSlots[0]!.slotKey).toBe('orchestration.program.fixed_grid_gated.program_kind')
    })

    it('validate flags missing programKind', () => {
      const node = buildProgramNode({ programKind: undefined })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(
        result.missingSlots.some(
          (s) => s.slotKey === 'orchestration.program.fixed_grid_gated.program_kind',
        ),
      ).toBe(true)
    })

    it('validate flags illegal onDeactivate', () => {
      const node = buildProgramNode({
        onDeactivate: 'pause' as unknown as SemanticOrchestrationNode['onDeactivate'],
      })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(
        result.missingSlots.some(
          (s) => s.slotKey === 'orchestration.program.fixed_grid_gated.on_deactivate',
        ),
      ).toBe(true)
    })

    it('validate flags non-static rebuildPolicy', () => {
      const node = buildProgramNode({
        rebuildPolicy: 'dynamic' as unknown as SemanticOrchestrationNode['rebuildPolicy'],
      })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(
        result.missingSlots.some(
          (s) => s.slotKey === 'orchestration.program.fixed_grid_gated.rebuild_policy',
        ),
      ).toBe(true)
    })

    it('validate flags anchorPrice<=0', () => {
      const node = buildProgramNode({
        gridParams: { anchorPrice: 0, levelCount: 5, stepPct: 1 },
      })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(
        result.missingSlots.some(
          (s) => s.slotKey === 'orchestration.program.fixed_grid_gated.grid_params.anchor_price',
        ),
      ).toBe(true)
    })

    it('validate flags non-numeric anchorPrice', () => {
      const node = buildProgramNode({
        gridParams: {
          anchorPrice: 'foo' as unknown as number,
          levelCount: 5,
          stepPct: 1,
        },
      })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(
        result.missingSlots.some(
          (s) => s.slotKey === 'orchestration.program.fixed_grid_gated.grid_params.anchor_price',
        ),
      ).toBe(true)
    })

    it('validate flags levelCount=1', () => {
      const node = buildProgramNode({
        gridParams: { anchorPrice: 100, levelCount: 1, stepPct: 1 },
      })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(
        result.missingSlots.some(
          (s) => s.slotKey === 'orchestration.program.fixed_grid_gated.grid_params.level_count',
        ),
      ).toBe(true)
    })

    it('validate flags levelCount=101', () => {
      const node = buildProgramNode({
        gridParams: { anchorPrice: 100, levelCount: 101, stepPct: 1 },
      })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(
        result.missingSlots.some(
          (s) => s.slotKey === 'orchestration.program.fixed_grid_gated.grid_params.level_count',
        ),
      ).toBe(true)
    })

    it('validate flags non-integer levelCount', () => {
      const node = buildProgramNode({
        gridParams: { anchorPrice: 100, levelCount: 5.5, stepPct: 1 },
      })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(
        result.missingSlots.some(
          (s) => s.slotKey === 'orchestration.program.fixed_grid_gated.grid_params.level_count',
        ),
      ).toBe(true)
    })

    it('validate flags stepPct=0', () => {
      const node = buildProgramNode({
        gridParams: { anchorPrice: 100, levelCount: 5, stepPct: 0 },
      })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(
        result.missingSlots.some(
          (s) => s.slotKey === 'orchestration.program.fixed_grid_gated.grid_params.step_pct',
        ),
      ).toBe(true)
    })

    it('validate flags stepPct=101', () => {
      const node = buildProgramNode({
        gridParams: { anchorPrice: 100, levelCount: 5, stepPct: 101 },
      })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(
        result.missingSlots.some(
          (s) => s.slotKey === 'orchestration.program.fixed_grid_gated.grid_params.step_pct',
        ),
      ).toBe(true)
    })

    it('validate flags lowerBound >= upperBound (inverted bounds)', () => {
      const node = buildProgramNode({
        gridParams: {
          anchorPrice: 100,
          levelCount: 5,
          stepPct: 1,
          lowerBound: 200,
          upperBound: 150,
        },
      })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(
        result.missingSlots.some(
          (s) => s.slotKey === 'orchestration.program.fixed_grid_gated.grid_params.lower_bound',
        ),
      ).toBe(true)
    })

    it('validate flags illegal sizing.mode', () => {
      const node = buildProgramNode({
        sizing: { mode: 'unknown', value: 100 } as unknown as SemanticOrchestrationNode['sizing'],
      })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(
        result.missingSlots.some(
          (s) => s.slotKey === 'orchestration.program.fixed_grid_gated.sizing.mode',
        ),
      ).toBe(true)
    })

    it('validate flags sizing.value<=0', () => {
      const node = buildProgramNode({ sizing: { mode: 'fixed_quote', value: 0 } })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(
        result.missingSlots.some(
          (s) => s.slotKey === 'orchestration.program.fixed_grid_gated.sizing.value',
        ),
      ).toBe(true)
    })

    it('validate treats missing activeWhenRef as always-active grid program', () => {
      const node = buildProgramNode({ activeWhenRef: undefined })
      const result = service.validate(node)
      expect(result.ok).toBe(true)
      expect(result.missingSlots).toEqual([])
    })

    it('validate treats empty-string activeWhenRef as always-active grid program', () => {
      const node = buildProgramNode({ activeWhenRef: '   ' })
      const result = service.validate(node)
      expect(result.ok).toBe(true)
      expect(result.missingSlots).toEqual([])
    })

    it('isExecutableForStrategy returns false without semantic version (fail-closed)', () => {
      const contract = service.getContractByKey('program.fixed_grid_gated')!
      expect(service.isExecutableForStrategy(contract, { deployedAtSemanticVersion: null })).toBe(false)
    })

    it('isExecutableForStrategy returns true at CURRENT_SEMANTIC_VERSION', () => {
      const contract = service.getContractByKey('program.fixed_grid_gated')!
      expect(
        service.isExecutableForStrategy(contract, { deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION }),
      ).toBe(true)
    })
  })

  describe('program.adaptive_volatility_grid', () => {
    function buildAdaptiveNode(
      overrides: Partial<SemanticOrchestrationNode> = {},
    ): SemanticOrchestrationNode {
      return {
        id: 'pgm-adaptive-1',
        kind: 'program',
        key: 'program.adaptive_volatility_grid',
        params: {},
        status: 'open',
        source: 'user_explicit',
        openSlots: [],
        contracts: [],
        programKind: 'adaptive_volatility_grid',
        onDeactivate: 'cancel',
        rebuildPolicy: 'atr_window',
        atrPeriod: 14,
        atrMultiplier: 1.5,
        rangeMultiplier: 3,
        atrDriftPct: 25,
        rebuildCooldownSec: 600,
        minStepPct: 0.2,
        maxStepPct: 2,
        levelCount: 6,
        sizing: { mode: 'fixed_quote', value: 100 },
        activeWhenRef: 'gate-regime-1',
        ...overrides,
      }
    }

    it('getContractByKey 返回 adaptive_volatility_grid contract（含 bar_ohlcv runtime + program_lifecycle state）', () => {
      const contract = service.getContractByKey('program.adaptive_volatility_grid')
      expect(contract).not.toBeNull()
      expect(contract?.id).toBe('program.adaptive_volatility_grid')
      expect(contract?.kind).toBe('program')
      expect(contract?.executableSinceVersion).toBe(CURRENT_SEMANTIC_VERSION)
      expect(contract?.capabilities).toEqual([
        { domain: 'orchestration', verb: 'manage', object: 'adaptive_volatility_grid_ladder', shape: {} },
      ])
      expect(contract?.runtimeRequirements).toEqual(
        expect.arrayContaining([
          { domain: 'runtime', verb: 'provide', object: 'limit_order' },
          { domain: 'runtime', verb: 'read', object: 'account_equity' },
          { domain: 'runtime', verb: 'provide', object: 'bar_ohlcv' },
        ]),
      )
      expect(contract?.stateRequirements).toEqual([
        { domain: 'state', verb: 'read_write', object: 'program_lifecycle' },
      ])
      expect(contract?.orderRequirements).toEqual(
        expect.arrayContaining([
          { domain: 'order', verb: 'support', object: 'limit_order' },
          { domain: 'order', verb: 'cancel', object: 'limit_order' },
        ]),
      )
      expect(contract?.effects).toEqual([
        { domain: 'guard', verb: 'manage', object: 'limit_ladder' },
      ])
    })

    it('validate 完整节点返回 ok', () => {
      expect(service.validate(buildAdaptiveNode())).toEqual({ ok: true, missingSlots: [] })
    })

    it('validate 拒绝 programKind 不匹配', () => {
      const node = buildAdaptiveNode({ programKind: 'fixed_grid_gated' })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(result.missingSlots.some(s => s.slotKey === 'orchestration.program.adaptive_volatility_grid.program_kind')).toBe(true)
    })

    it('validate 拒绝非法 onDeactivate', () => {
      const node = buildAdaptiveNode({ onDeactivate: 'pause' as never })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(result.missingSlots.some(s => s.slotKey === 'orchestration.program.adaptive_volatility_grid.on_deactivate')).toBe(true)
    })

    it('validate 拒绝 rebuildPolicy 非 atr_window', () => {
      const node = buildAdaptiveNode({ rebuildPolicy: 'static' })
      const result = service.validate(node)
      expect(result.ok).toBe(false)
      expect(result.missingSlots.some(s => s.slotKey === 'orchestration.program.adaptive_volatility_grid.rebuild_policy')).toBe(true)
    })

    it('validate 拒绝 atrPeriod=1 / 201', () => {
      for (const bad of [1, 201]) {
        const result = service.validate(buildAdaptiveNode({ atrPeriod: bad }))
        expect(result.ok).toBe(false)
        expect(result.missingSlots.some(s => s.slotKey === 'orchestration.program.adaptive_volatility_grid.atr_period')).toBe(true)
      }
    })

    it('validate 拒绝 atrMultiplier <= 0', () => {
      const result = service.validate(buildAdaptiveNode({ atrMultiplier: 0 }))
      expect(result.ok).toBe(false)
      expect(result.missingSlots.some(s => s.slotKey === 'orchestration.program.adaptive_volatility_grid.atr_multiplier')).toBe(true)
    })

    it('validate 拒绝 rangeMultiplier <= 0', () => {
      const result = service.validate(buildAdaptiveNode({ rangeMultiplier: -1 }))
      expect(result.ok).toBe(false)
      expect(result.missingSlots.some(s => s.slotKey === 'orchestration.program.adaptive_volatility_grid.range_multiplier')).toBe(true)
    })

    it('validate 拒绝 atrDriftPct=0 / 101', () => {
      for (const bad of [0, 101]) {
        const result = service.validate(buildAdaptiveNode({ atrDriftPct: bad }))
        expect(result.ok).toBe(false)
        expect(result.missingSlots.some(s => s.slotKey === 'orchestration.program.adaptive_volatility_grid.atr_drift_pct')).toBe(true)
      }
    })

    it('validate 拒绝 rebuildCooldownSec=299（硬下限 300）', () => {
      const result = service.validate(buildAdaptiveNode({ rebuildCooldownSec: 299 }))
      expect(result.ok).toBe(false)
      expect(result.missingSlots.some(s => s.slotKey === 'orchestration.program.adaptive_volatility_grid.rebuild_cooldown_sec')).toBe(true)
    })

    it('validate 接受 rebuildCooldownSec=300（边界）', () => {
      expect(service.validate(buildAdaptiveNode({ rebuildCooldownSec: 300 })).ok).toBe(true)
    })

    it('validate 拒绝 minStepPct<=0 / maxStepPct<=0', () => {
      expect(service.validate(buildAdaptiveNode({ minStepPct: 0 })).ok).toBe(false)
      expect(service.validate(buildAdaptiveNode({ maxStepPct: 0 })).ok).toBe(false)
    })

    it('validate 拒绝 maxStepPct < minStepPct（配置矛盾）', () => {
      const result = service.validate(buildAdaptiveNode({ minStepPct: 2, maxStepPct: 1 }))
      expect(result.ok).toBe(false)
      expect(result.missingSlots.some(s => s.slotKey === 'orchestration.program.adaptive_volatility_grid.max_step_pct')).toBe(true)
    })

    it('validate 拒绝 levelCount=1 / 101 / 非整数', () => {
      for (const bad of [1, 101, 5.5]) {
        const result = service.validate(buildAdaptiveNode({ levelCount: bad }))
        expect(result.ok).toBe(false)
        expect(result.missingSlots.some(s => s.slotKey === 'orchestration.program.adaptive_volatility_grid.level_count')).toBe(true)
      }
    })

    it('validate 拒绝非法 sizing.mode 与 sizing.value<=0', () => {
      expect(service.validate(buildAdaptiveNode({ sizing: { mode: 'unknown' as never, value: 100 } })).ok).toBe(false)
      expect(service.validate(buildAdaptiveNode({ sizing: { mode: 'fixed_quote', value: 0 } })).ok).toBe(false)
    })

    it('validate 接受 activeWhenRef 缺失或空字符串作为 always-active grid program', () => {
      expect(service.validate(buildAdaptiveNode({ activeWhenRef: undefined })).ok).toBe(true)
      expect(service.validate(buildAdaptiveNode({ activeWhenRef: '   ' })).ok).toBe(true)
    })

    it('isExecutableForStrategy 在 CURRENT_SEMANTIC_VERSION 返回 true', () => {
      const contract = service.getContractByKey('program.adaptive_volatility_grid')!
      expect(
        service.isExecutableForStrategy(contract, { deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION }),
      ).toBe(true)
    })

    it('isExecutableForStrategy 无 semantic version → false（fail-closed）', () => {
      const contract = service.getContractByKey('program.adaptive_volatility_grid')!
      expect(service.isExecutableForStrategy(contract, { deployedAtSemanticVersion: null })).toBe(false)
    })
  })
})
