import type { SemanticRegisteredAtomDefinition, SemanticUnknownAtomDefinition } from '../../types/semantic-atom-support'
import type { SemanticState, SemanticTriggerState } from '../../types/semantic-state'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

interface ClassifierInternals {
  resolveTriggerSupport: (trigger: SemanticTriggerState) => SemanticRegisteredAtomDefinition | SemanticUnknownAtomDefinition
}

function baseState(overrides: Partial<SemanticState>): SemanticState {
  return {
    version: 1,
    families: ['legacy-family-must-not-matter'],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-05T00:00:00.000Z',
    ...overrides,
  }
}

describe('semanticSupportClassifierService', () => {
  const service = new SemanticSupportClassifierService(new SemanticAtomRegistryService())

  it('allows a supported atom combination to proceed to projection', () => {
    const result = service.classify(baseState({
      trigger: [{
        id: 'entry',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      action: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
      risk: [{
        id: 'sl',
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    }))

    expect(result.route).toBe('projection_gate')
    expect(result.unsupportedAtoms).toEqual([])
    expect(result.unknownAtoms).toEqual([])
  })

  it('routes generic volume and ATR atom combinations to projection', () => {
    const result = service.classify(baseState({
      trigger: [{
        id: 'volume',
        key: 'volume.relative_average',
        phase: 'entry',
        params: { lookbackBars: 20, multiplier: 1.5 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      action: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
      risk: [{
        id: 'atr-stop',
        key: 'risk.atr_multiple_stop',
        params: { multiple: 2 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    }))

    expect(result.route).not.toBe('unsupported_fallback')
    expect(result.route).toBe('projection_gate')
    expect(result.unsupportedAtoms).toEqual([])
    expect(result.unknownAtoms).toEqual([])
  })

  it('fails closed for versioned executable atoms when deployedAtSemanticVersion is null', () => {
    const result = service.classify(baseState({
      trigger: [{
        id: 'volume',
        key: 'volume.threshold',
        phase: 'entry',
        params: { value: 1000, operator: 'GT', metric: 'base_volume' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      action: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }), { deployedAtSemanticVersion: null })

    expect(result.route).toBe('unsupported_fallback')
    expect(result.unsupportedAtoms).toEqual([
      expect.objectContaining({
        key: 'volume.threshold',
        reasonCode: 'runtime_version_unsupported',
      }),
    ])
    expect(result.state.trigger[0].support).toEqual(expect.objectContaining({
      supportStatus: 'recognized_unsupported',
      unsupportedReasonCode: 'runtime_version_unsupported',
    }))
  })

  it('keeps versioned executable atoms executable when deployedAtSemanticVersion is at since version', () => {
    const result = service.classify(baseState({
      trigger: [{
        id: 'volume',
        key: 'volume.threshold',
        phase: 'entry',
        params: { value: 1000, operator: 'GT', metric: 'base_volume' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      action: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }), { deployedAtSemanticVersion: '2026.05.W02' })

    expect(result.route).toBe('projection_gate')
    expect(result.unsupportedAtoms).toEqual([])
    expect(result.state.trigger[0].support).toBeUndefined()
  })

  it('applies runtime version gate to versioned action atoms', () => {
    const legacy = service.classify(baseState({
      action: [{
        id: 'add-position',
        key: 'action.add_position',
        params: { addMode: 'fixed_ratio', addRatio: 0.2 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    }), { deployedAtSemanticVersion: null })

    const current = service.classify(baseState({
      action: [{
        id: 'add-position',
        key: 'action.add_position',
        params: { addMode: 'fixed_ratio', addRatio: 0.2 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    }), { deployedAtSemanticVersion: '2026.05.W02' })

    expect(legacy.route).toBe('unsupported_fallback')
    expect(legacy.unsupportedAtoms).toContainEqual(expect.objectContaining({
      key: 'action.add_position',
      reasonCode: 'runtime_version_unsupported',
    }))
    expect(current.route).toBe('open_slots')
    expect(current.unsupportedAtoms).toEqual([])
    expect(current.state.action[0].support).toBeUndefined()
  })

  it('applies runtime version gate to versioned risk atoms', () => {
    const state = baseState({
      risk: [{
        id: 'partial-take-profit',
        key: 'risk.partial_take_profit',
        params: {
          tiers: [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }],
          memoryKey: 'partial_tp_abc',
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    })

    const legacy = service.classify(state, { deployedAtSemanticVersion: null })
    const current = service.classify(state, { deployedAtSemanticVersion: '2026.05.W02' })

    expect(legacy.route).toBe('unsupported_fallback')
    expect(legacy.unsupportedAtoms).toContainEqual(expect.objectContaining({
      key: 'risk.partial_take_profit',
      reasonCode: 'runtime_version_unsupported',
    }))
    expect(current.route).toBe('projection_gate')
    expect(current.unsupportedAtoms).toEqual([])
    expect(current.state.risk[0].support).toBeUndefined()
  })

  it('applies runtime version gate to versioned position constraints', () => {
    const state = baseState({
      position: {
        mode: 'constraint_only',
        value: 0,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        // @ts-ignore Task6: position.constraints moved to top-level positionConstraint
        constraints: [{
          id: 'dca',
          key: 'position.dca_schedule',
          params: {
            maxCount: 4,
            capitalCap: 500,
            perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
            triggerMode: 'price_interval',
            exitRule: 'take_profit_or_stop_loss',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        }],
      },
    })

    const legacy = service.classify(state, { deployedAtSemanticVersion: null })
    const current = service.classify(state, { deployedAtSemanticVersion: '2026.05.W02' })

    expect(legacy.route).toBe('unsupported_fallback')
    expect(legacy.unsupportedAtoms).toContainEqual(expect.objectContaining({
      key: 'position.dca_schedule',
      reasonCode: 'runtime_version_unsupported',
    }))
    expect(current.route).toBe('projection_gate')
    expect(current.unsupportedAtoms).toEqual([])
    // @ts-ignore Task6: position.constraints moved to top-level positionConstraint
    expect(current.state.position?.constraints?.[0].support).toBeUndefined()
  })

  it('uses registry support status as authoritative over stale unsupported metadata', () => {
    const result = service.classify(baseState({
      trigger: [{
        id: 'entry',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: {
          supportStatus: 'recognized_unsupported',
          unsupportedReasonCode: 'old_metadata',
          unsupportedDisplayName: '旧 unsupported 元数据',
        },
      }],
      action: [{
        id: 'open',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'unsupported_unknown' },
      }],
    }))

    expect(result.route).toBe('projection_gate')
    expect(result.unsupportedAtoms).toEqual([])
    expect(result.unknownAtoms).toEqual([])
    expect(result.state.trigger[0].support).toBeUndefined()
    expect(result.state.action[0].support).toBeUndefined()
  })

  it('ignores non-execution open slots when classifying supported strategies', () => {
    const nonExecutionSlot = {
      slotKey: 'display.label',
      fieldPath: 'triggers.entry.display.label',
      status: 'open' as const,
      priority: 'context' as const,
      questionHint: '补充展示标签',
      affectsExecution: false,
    }

    const result = service.classify(baseState({
      trigger: [{
        id: 'entry',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [nonExecutionSlot],
      }],
      action: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
      risk: [{
        id: 'sl',
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    }))

    expect(result.route).toBe('projection_gate')
    expect(result.openSlots).toEqual([])
  })

  it('blocks the whole strategy when one atom is recognized unsupported', () => {
    const result = service.classify(baseState({
      trigger: [{
        id: 'volume',
        key: 'volume.spike',
        phase: 'entry',
        params: { multiplier: 2 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      action: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }))

    expect(result.route).toBe('unsupported_fallback')
    expect(result.unsupportedAtoms).toEqual([
      expect.objectContaining({
        key: 'volume.spike',
        displayName: '成交量放大',
      }),
    ])
  })

  it('keeps previous high low extrema atoms out of unsupported fallback after Phase 3 MVP', () => {
    // Phase 3 MVP — price.previous_extrema 已升级为 supported_requires_slot；
    // 即便 trigger 未填齐 kind/lookback/memoryKey，也不再落入 unsupported_fallback，
    // 而是由 projection_gate 通过 openSlots 继续追问，与 supported atom 行为对齐。
    const result = service.classify(baseState({
      trigger: [{
        id: 'previous-extrema',
        key: 'price.previous_extrema',
        phase: 'entry',
        params: { reference: 'previous_high', event: 'breakout_up' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      action: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }))

    expect(result.route).toBe('open_slots')
    expect(result.unsupportedAtoms).toEqual([])
    expect(result.unknownAtoms).toEqual([])
  })

  it('keeps executable price-vs-moving-average indicator aliases out of fallback', () => {
    const result = service.classify(baseState({
      trigger: [
        {
          id: 'entry-ma',
          key: 'indicator.above',
          phase: 'entry',
          params: {
            indicator: 'ma',
            referenceRole: 'long_term',
            'reference.period': 50,
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-ma',
          key: 'indicator.below',
          phase: 'exit',
          params: {
            indicator: 'ma',
            referenceRole: 'short_term',
            'reference.period': 20,
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      action: [
        { id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'close', key: 'close_long', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      risk: [{
        id: 'sl',
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    }))

    expect(result.route).toBe('projection_gate')
    expect(result.unsupportedAtoms).toEqual([])
    expect(result.state.trigger.map(trigger => trigger.support)).toEqual([undefined, undefined])
  })

  it('keeps multi moving-average static compares supported when each compare has executable reference params', () => {
    const result = service.classify(baseState({
      trigger: [
        {
          id: 'entry-ema20',
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ema', 'reference.period': 20 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'entry-ema60',
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ema', 'reference.period': 60 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'entry-ema144',
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ema', 'reference.period': 144 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-ema20',
          key: 'indicator.below',
          phase: 'exit',
          params: { indicator: 'ema', 'reference.period': 20 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      action: [
        { id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'close', key: 'close_long', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    }))

    expect(result.route).toBe('projection_gate')
    expect(result.unsupportedAtoms).toEqual([])
    expect(result.state.trigger.map(trigger => trigger.support)).toEqual([undefined, undefined, undefined, undefined])
  })

  it('does not treat raw price indicator aliases as executable MA references', () => {
    const result = service.classify(baseState({
      trigger: [
        {
          id: 'gate-price-vs-ma',
          key: 'indicator.above',
          phase: 'gate',
          params: {
            indicator: 'price',
            referenceRole: 'long_term',
            'reference.period': 100,
            reference: { indicator: 'ma', period: 100 },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      action: [],
    }))

    expect(result.route).toBe('unsupported_fallback')
    expect(result.unsupportedAtoms).toEqual([
      expect.objectContaining({ key: 'indicator.above' }),
    ])
  })

  it('routes executable moving-average indicator aliases through public classification', () => {
    const result = service.classify(baseState({
      trigger: [{
        id: 'entry-ma',
        key: 'indicator.above',
        phase: 'entry',
        params: {
          indicator: 'ma',
          referenceRole: 'long_term',
          'reference.period': 50,
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      action: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }))

    expect(result.route).toBe('projection_gate')
    expect(result.unsupportedAtoms).toEqual([])
    expect(result.state.trigger[0].support).toBeUndefined()
  })

  it('routes explicit leverage position effects through projection instead of unsupported fallback', () => {
    const result = service.classify(baseState({
      rules: [{
        id: 'entry-with-leverage',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'ma', fastPeriod: 6, slowPeriod: 48 } },
        effects: {
          actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          risks: [],
          positions: [{ kind: 'atom', key: 'position.leverage', params: { value: 2 } }],
          orchestration: [],
          programs: [],
        },
      }],
    }))

    expect(result.route).toBe('projection_gate')
    expect(result.unsupportedAtoms).toEqual([])
  })

  it('preserves substrate metadata when resolving executable moving-average indicator aliases', () => {
    const resolved = (service as unknown as ClassifierInternals).resolveTriggerSupport({
      id: 'entry-ma',
      key: 'indicator.above',
      phase: 'entry',
      params: {
        indicator: 'ma',
        referenceRole: 'long_term',
        'reference.period': 50,
      },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    })

    expect(resolved).toMatchObject({
      key: 'indicator.above',
      category: 'trigger',
      supportStatus: 'supported_executable',
      contractSubstrate: {
        runtimeRequirements: expect.any(Array),
        stateRequirements: expect.any(Array),
        orderRequirements: expect.any(Array),
        openSlots: expect.any(Array),
      },
    })
  })

  it('adds registry open slots for supported requires-slot risk atoms with unknown required params', () => {
    const result = service.classify(baseState({
      trigger: [{
        id: 'entry',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      action: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
      risk: [{
        id: 'falling-knife',
        key: 'risk.falling_knife_guard',
        params: { definition: 'unknown' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    }))

    expect(result.route).toBe('open_slots')
    expect(result.openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'risk.falling_knife_guard.definition',
      }),
    ])
    expect(result.state.risk[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'risk.falling_knife_guard.definition',
      }),
    ])
  })

  it('deduplicates registry open slots by slot identity instead of slot key only', () => {
    const ownerSlot = {
      slotKey: 'risk.falling_knife_guard.definition',
      fieldPath: 'risk[falling-knife].params.definition',
      status: 'open' as const,
      priority: 'risk' as const,
      questionHint: '请确认具体风控定义。',
      affectsExecution: true,
    }

    const result = service.classify(baseState({
      risk: [{
        id: 'falling-knife',
        key: 'risk.falling_knife_guard',
        params: { definition: 'unknown' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [ownerSlot],
      }],
    }))

    expect(result.route).toBe('open_slots')
    expect(result.state.risk[0].openSlots).toEqual([
      ownerSlot,
      expect.objectContaining({
        slotKey: 'risk.falling_knife_guard.definition',
        fieldPath: 'risk.params.definition',
      }),
    ])
  })

  it('routes executable EMA compare triggers with per-trigger timeframe to projection', () => {
    const result = service.classify(baseState({
      trigger: [{
        id: 'entry-ema',
        key: 'indicator.above',
        phase: 'entry',
        params: {
          indicator: 'ema',
          referenceRole: 'long_term',
          'reference.period': 20,
          timeframe: '15m',
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      action: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
      risk: [{
        id: 'sl',
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    }))

    expect(result.route).toBe('projection_gate')
    expect(result.unsupportedAtoms).toEqual([])
    expect(result.unknownAtoms).toEqual([])
    expect(result.state.trigger[0].support).toBeUndefined()
  })

  it('keeps unsupported fallback precedence over execution open slots', () => {
    const executionSlot = {
      slotKey: 'volume.multiplier',
      fieldPath: 'triggers.volume.params.multiplier',
      status: 'open' as const,
      priority: 'core' as const,
      questionHint: '请选择放大量倍数',
      affectsExecution: true,
    }

    const result = service.classify(baseState({
      trigger: [{
        id: 'volume',
        key: 'volume.spike',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [executionSlot],
      }],
      action: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }))

    expect(result.route).toBe('unsupported_fallback')
    expect(result.openSlots).toEqual([])
  })

  it('blocks unknown atom combinations without treating them as open slots', () => {
    const result = service.classify(baseState({
      trigger: [{
        id: 'unknown',
        key: 'custom.pattern',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    }))

    expect(result.route).toBe('unknown_unsupported')
    expect(result.unknownAtoms).toEqual(['custom.pattern'])
    expect(result.openSlots).toEqual([])
  })

  it('keeps unknown atom precedence when mixed with recognized unsupported atoms', () => {
    const result = service.classify(baseState({
      trigger: [
        {
          id: 'volume',
          key: 'volume.spike',
          phase: 'entry',
          params: { multiplier: 2 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'unknown',
          // P4-5 后 external.signal 已升级为 supported_requires_slot；测试 unknown 优先级
          // 改用未注册的 image.pattern 作为 unknown atom 占位。
          key: 'image.pattern',
          phase: 'entry',
          params: {},
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      action: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }))

    expect(result.route).toBe('unknown_unsupported')
    expect(result.unknownAtoms).toEqual(['image.pattern'])
    expect(result.unsupportedAtoms).toEqual([
      expect.objectContaining({ key: 'volume.spike' }),
    ])
    expect(result.openSlots).toEqual([])
  })

  it('routes supported atom combinations with existing open slots to clarification', () => {
    const slot = {
      slotKey: 'indicator.fastPeriod',
      fieldPath: 'triggers.entry.params.fastPeriod',
      status: 'open' as const,
      priority: 'core' as const,
      questionHint: '请选择快线周期',
      affectsExecution: true,
    }

    const result = service.classify(baseState({
      trigger: [{
        id: 'entry',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { indicator: 'ma', slowPeriod: 50 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [slot],
      }],
      action: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }))

    expect(result.route).toBe('open_slots')
    expect(result.openSlots).toEqual([slot])
  })
})
