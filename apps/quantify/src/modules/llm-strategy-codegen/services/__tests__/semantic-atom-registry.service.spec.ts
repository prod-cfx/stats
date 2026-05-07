import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'

describe('SemanticAtomRegistryService', () => {
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
    for (const key of ['market.trend', 'market.range', 'indicator.above', 'indicator.below', 'price.previous_extrema']) {
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

  describe('phase-1 gate atoms', () => {
    it('registers volume.threshold as supported_executable trigger with volume substrate', () => {
      const atom = service.get('volume.threshold')
      expect(atom).toMatchObject({
        key: 'volume.threshold',
        category: 'trigger',
        supportStatus: 'supported_executable',
        requiredParams: ['metric', 'operator', 'value', 'unit'],
      })
      if (atom.supportStatus === 'supported_executable' || atom.supportStatus === 'supported_requires_slot') {
        expect(atom.contractSubstrate.runtimeRequirements).toContainEqual({
          domain: 'runtime',
          verb: 'provide',
          object: 'volume_series',
        })
        expect(atom.contractSubstrate.orderRequirements).toEqual([])
      }
    })

    it('registers volatility.atr_threshold as supported_executable trigger with atr substrate', () => {
      const atom = service.get('volatility.atr_threshold')
      expect(atom).toMatchObject({
        key: 'volatility.atr_threshold',
        category: 'trigger',
        supportStatus: 'supported_executable',
        requiredParams: ['period', 'operator', 'threshold', 'thresholdUnit'],
      })
      if (atom.supportStatus === 'supported_executable' || atom.supportStatus === 'supported_requires_slot') {
        expect(atom.contractSubstrate.runtimeRequirements).toContainEqual({
          domain: 'runtime',
          verb: 'provide',
          object: 'atr_helper',
        })
        expect(atom.contractSubstrate.orderRequirements).toEqual([])
      }
    })

    it('registers strategy.time_window as supported_requires_slot trigger with timezone open slot', () => {
      const atom = service.get('strategy.time_window')
      expect(atom).toMatchObject({
        key: 'strategy.time_window',
        category: 'trigger',
        supportStatus: 'supported_requires_slot',
        requiredParams: ['timezone', 'windows'],
      })
      if (atom.supportStatus === 'supported_requires_slot') {
        expect(atom.openSlots).toEqual([
          expect.objectContaining({ slotKey: 'strategy.time_window.timezone', priority: 'context' }),
        ])
        expect(atom.contractSubstrate.runtimeRequirements).toContainEqual({
          domain: 'runtime',
          verb: 'provide',
          object: 'timezone_clock',
        })
      }
    })

    it('registers position.has_position and position.no_position as trigger gates with position-state substrate', () => {
      for (const key of ['position.has_position', 'position.no_position']) {
        const atom = service.get(key)
        expect(atom).toMatchObject({
          key,
          category: 'trigger',
          supportStatus: 'supported_executable',
          requiredParams: [],
        })
        if (atom.supportStatus === 'supported_executable' || atom.supportStatus === 'supported_requires_slot') {
          expect(atom.contractSubstrate.stateRequirements).toContainEqual({
            domain: 'state',
            verb: 'read',
            object: 'position_state',
          })
          expect(atom.contractSubstrate.orderRequirements).toEqual([])
        }
      }
    })
  })
})
