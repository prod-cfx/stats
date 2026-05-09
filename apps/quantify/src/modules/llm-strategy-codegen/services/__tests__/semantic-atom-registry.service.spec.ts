import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'

describe('semanticAtomRegistryService', () => {
  const service = new SemanticAtomRegistryService()

  it('classifies executable indicator and price atoms without strategy family authority', () => {
    expect(service.get('indicator.cross_over')).toMatchObject({
      key: 'indicator.cross_over',
      category: 'trigger',
      supportStatus: 'supported_executable',
    })
    expect(service.get('price.range_position_lte')).toMatchObject({
      key: 'price.range_position_lte',
      category: 'trigger',
      supportStatus: 'supported_executable',
    })
  })

  it('recognizes mainstream unsupported atoms with user-facing fallback metadata', () => {
    expect(service.get('volume.spike')).toMatchObject({
      key: 'volume.spike',
      category: 'trigger',
      supportStatus: 'recognized_unsupported',
      unsupported: {
        displayName: '成交量放大',
        reasonCode: 'volume_condition_public_beta_unsupported',
      },
      replacement: {
        strategyKey: 'ma_cross_with_fixed_risk',
      },
    })
    expect(service.get('risk.atr_stop')).toMatchObject({
      key: 'risk.atr_stop',
      category: 'risk',
      supportStatus: 'recognized_unsupported',
      unsupported: {
        displayName: 'ATR 动态止损',
        reasonCode: 'atr_stop_public_beta_unsupported',
      },
    })
  })

  it('does not classify aliases or compiler-unsupported atoms as executable projection atoms', () => {
    for (const key of ['market.trend', 'market.range', 'indicator.above', 'indicator.below']) {
      expect(service.get(key)).toMatchObject({
        key,
        category: 'trigger',
        supportStatus: 'recognized_unsupported',
      })
      expect(service.get(key).executableProjection).toEqual([])
    }
  })

  it('classifies current executable trigger atoms as supported executable', () => {
    const executableKeys = [
      'price.percent_change',
      'price.detect.indicator_boundary',
      'bollinger.touch_upper',
      'bollinger.touch_lower',
      'bollinger.touch_middle',
      'oscillator.rsi_gte',
      'oscillator.rsi_lte',
      'trend.direction',
      'market.regime',
      'volatility.state',
    ]

    for (const key of executableKeys) {
      expect(service.get(key)).toMatchObject({
        key,
        category: 'trigger',
        supportStatus: 'supported_executable',
      })
    }
  })

  it('classifies generic atomic contract atoms as supported canonical v2 projections', () => {
    const expectedAtoms = [
      {
        key: 'price.rolling_extrema_breakout',
        category: 'trigger',
        supportStatus: 'supported_executable',
        requiredParams: ['extrema', 'event'],
      },
      {
        key: 'condition.sequence',
        category: 'trigger',
        supportStatus: 'supported_executable',
        requiredParams: ['sequenceKind'],
      },
      {
        key: 'confirmation.rebound',
        category: 'trigger',
        supportStatus: 'supported_executable',
        requiredParams: [],
      },
      {
        key: 'logical.any_of',
        category: 'trigger',
        supportStatus: 'supported_executable',
        requiredParams: ['items'],
      },
      {
        key: 'volume.relative_average',
        category: 'trigger',
        supportStatus: 'supported_executable',
        requiredParams: ['lookbackBars', 'multiplier'],
      },
      {
        key: 'volume.threshold',
        category: 'trigger',
        supportStatus: 'supported_executable',
        requiredParams: ['value', 'operator', 'metric'],
      },
      {
        key: 'volatility.atr_threshold',
        category: 'trigger',
        supportStatus: 'supported_executable',
        requiredParams: ['period', 'threshold', 'thresholdUnit', 'operator'],
      },
      {
        key: 'risk.atr_multiple_stop',
        category: 'risk',
        supportStatus: 'supported_executable',
        requiredParams: ['multiple'],
      },
      {
        key: 'risk.atr_multiple_take_profit',
        category: 'risk',
        supportStatus: 'supported_executable',
        requiredParams: ['multiple'],
      },
      {
        key: 'risk.remembered_level_stop',
        category: 'risk',
        supportStatus: 'supported_executable',
        requiredParams: ['levelKey'],
      },
      {
        key: 'risk.falling_knife_guard',
        category: 'risk',
        supportStatus: 'supported_requires_slot',
        requiredParams: ['definition'],
      },
    ]

    for (const expectedAtom of expectedAtoms) {
      expect(service.get(expectedAtom.key)).toMatchObject({
        ...expectedAtom,
        executableProjection: expect.arrayContaining(['canonical_spec_v2']),
      })
    }

    expect(service.get('risk.falling_knife_guard').openSlots).toEqual([
      {
        slotKey: 'risk.falling_knife_guard.definition',
        fieldPath: 'risk.params.definition',
        priority: 'risk',
        questionHint: '请确认“不接飞刀”的判定方式，例如反弹站上 MA20 / 下一根 K 线收阳 / 跌幅停止扩大。',
      },
    ])
  })

  it('requires supported atoms to declare phase 0 substrate metadata', () => {
    const supportedAtoms = service.list().filter(atom =>
      atom.supportStatus === 'supported_executable'
      || atom.supportStatus === 'supported_requires_slot',
    )

    expect(supportedAtoms.length).toBeGreaterThan(0)
    for (const atom of supportedAtoms) {
      expect(atom.contractSubstrate).toEqual({
        runtimeRequirements: expect.any(Array),
        stateRequirements: expect.any(Array),
        orderRequirements: expect.any(Array),
        openSlots: expect.any(Array),
      })
    }
  })

  it('isolates returned substrate metadata from runtime requirement mutation', () => {
    const atom = service.get('indicator.cross_over')
    const anotherAtom = service.get('price.percent_change')
    const originalAtomRuntimeRequirements = atom.contractSubstrate.runtimeRequirements.length
    const originalAnotherRuntimeRequirements = anotherAtom.contractSubstrate.runtimeRequirements.length

    ;(atom.contractSubstrate.runtimeRequirements as unknown[]).push({
      domain: 'runtime',
      verb: 'provide',
      object: 'mutated_runtime_requirement',
    })

    expect(anotherAtom.contractSubstrate.runtimeRequirements).toHaveLength(originalAnotherRuntimeRequirements)
    expect(service.get('indicator.cross_over').contractSubstrate.runtimeRequirements).toHaveLength(
      originalAtomRuntimeRequirements,
    )
  })

  it('provides a fallback patch that closes trigger contracts in the current semantic builder', () => {
    const replacement = service.get('risk.atr_stop').replacement
    expect(replacement?.description).toBe('MA20 上穿 MA50 开多，MA20 下穿 MA50 平仓，5% 止损，10% 止盈，单笔 10% 仓位。')

    const state = new SemanticSeedStateBuilderService().build(replacement?.patch)

    expect(state?.triggers).toHaveLength(2)
    expect(state?.triggers).toEqual([
      expect.objectContaining({
        key: 'indicator.cross_over',
        contracts: expect.any(Array),
        openSlots: [],
      }),
      expect.objectContaining({
        key: 'indicator.cross_under',
        contracts: expect.any(Array),
        openSlots: [],
      }),
    ])
  })

  it('returns unsupported_unknown for unregistered atoms', () => {
    expect(service.resolve('custom.moon_phase')).toEqual({
      key: 'custom.moon_phase',
      category: 'unknown',
      supportStatus: 'unsupported_unknown',
    })
  })

  describe('risk.partial_take_profit', () => {
    it('registers as supported_executable with substrate when tiers and memoryKey provided', () => {
      const atom = service.resolve('risk.partial_take_profit', {
        tiers: [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }],
        memoryKey: 'partial_tp_abc',
      })
      expect(atom.category).toBe('risk')
      expect(atom.supportStatus).toBe('supported_executable')
      // atom.contractSubstrate exists because supportStatus === 'supported_executable'
      const substrate = (atom as import('../../types/semantic-atom-support').SemanticSupportedAtomDefinition).contractSubstrate
      // position_pnl_pct helper present in runtimeRequirements
      expect(substrate.runtimeRequirements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ domain: 'runtime', object: 'position_pnl_pct' }),
        ]),
      )
      // memoryKey state key present in stateRequirements
      expect(substrate.stateRequirements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ domain: 'state', object: 'partial_tp_abc' }),
        ]),
      )
      // reduce_only order capability present in orderRequirements
      expect(substrate.orderRequirements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ domain: 'order', object: 'reduce_only' }),
        ]),
      )
    })

    it('routes to supported_requires_slot with openSlot when tiers absent', () => {
      const atom = service.resolve('risk.partial_take_profit', {})
      expect(atom.supportStatus).toBe('supported_requires_slot')
      if (atom.supportStatus === 'unsupported_unknown') throw new Error('unexpected unknown atom')
      expect(atom.openSlots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slotKey: 'risk.partial_take_profit.tiers' }),
        ]),
      )
    })

    it('routes to supported_requires_slot with openSlot when tiers is empty array', () => {
      const atom = service.resolve('risk.partial_take_profit', { tiers: [], memoryKey: 'partial_tp_abc' })
      expect(atom.supportStatus).toBe('supported_requires_slot')
      if (atom.supportStatus === 'unsupported_unknown') throw new Error('unexpected unknown atom')
      expect(atom.openSlots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slotKey: 'risk.partial_take_profit.tiers' }),
        ]),
      )
    })

    it('routes to supported_requires_slot when memoryKey missing', () => {
      const atom = service.resolve('risk.partial_take_profit', {
        tiers: [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }],
      })
      expect(atom.supportStatus).toBe('supported_requires_slot')
    })

    it('routes to supported_requires_slot when memoryKey does not start with partial_tp_', () => {
      const atom = service.resolve('risk.partial_take_profit', {
        tiers: [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }],
        memoryKey: 'wrong_key_abc',
      })
      expect(atom.supportStatus).toBe('supported_requires_slot')
    })

    it('static get() returns recognized_unsupported for backward compat (no params path)', () => {
      const atom = service.get('risk.partial_take_profit')
      expect(atom.supportStatus).toBe('recognized_unsupported')
    })
  })
})
