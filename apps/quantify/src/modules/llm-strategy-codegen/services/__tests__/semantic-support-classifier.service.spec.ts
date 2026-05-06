import type { SemanticState } from '../../types/semantic-state'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

function baseState(overrides: Partial<SemanticState>): SemanticState {
  return {
    version: 1,
    families: ['legacy-family-must-not-matter'],
    triggers: [],
    actions: [],
    risk: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-05T00:00:00.000Z',
    ...overrides,
  }
}

describe('SemanticSupportClassifierService', () => {
  const service = new SemanticSupportClassifierService(new SemanticAtomRegistryService())

  it('allows a supported atom combination to proceed to projection', () => {
    const result = service.classify(baseState({
      triggers: [{
        id: 'entry',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
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
      triggers: [{
        id: 'volume',
        key: 'volume.relative_average',
        phase: 'entry',
        params: { lookbackBars: 20, multiplier: 1.5 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
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

  it('uses registry support status as authoritative over stale unsupported metadata', () => {
    const result = service.classify(baseState({
      triggers: [{
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
      actions: [{
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
    expect(result.state.triggers[0].support).toBeUndefined()
    expect(result.state.actions[0].support).toBeUndefined()
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
      triggers: [{
        id: 'entry',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [nonExecutionSlot],
      }],
      actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
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
      triggers: [{
        id: 'volume',
        key: 'volume.spike',
        phase: 'entry',
        params: { multiplier: 2 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }))

    expect(result.route).toBe('unsupported_fallback')
    expect(result.unsupportedAtoms).toEqual([
      expect.objectContaining({
        key: 'volume.spike',
        displayName: '成交量放大',
      }),
    ])
  })

  it('routes previous high low extrema atoms to recognized unsupported fallback', () => {
    const result = service.classify(baseState({
      triggers: [{
        id: 'previous-extrema',
        key: 'price.previous_extrema',
        phase: 'entry',
        params: { reference: 'previous_high', event: 'breakout_up' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }))

    expect(result.route).toBe('unsupported_fallback')
    expect(result.unsupportedAtoms).toEqual([
      expect.objectContaining({
        key: 'price.previous_extrema',
        displayName: '前高/前低突破',
      }),
    ])
    expect(result.unknownAtoms).toEqual([])
  })

  it('keeps executable price-vs-moving-average indicator aliases out of fallback', () => {
    const result = service.classify(baseState({
      triggers: [
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
      actions: [
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
    expect(result.state.triggers.map(trigger => trigger.support)).toEqual([undefined, undefined])
  })

  it('does not treat raw price indicator aliases as executable MA references', () => {
    const result = service.classify(baseState({
      triggers: [
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
      actions: [],
    }))

    expect(result.route).toBe('unsupported_fallback')
    expect(result.unsupportedAtoms).toEqual([
      expect.objectContaining({ key: 'indicator.above' }),
    ])
  })

  it('routes executable moving-average indicator aliases through public classification', () => {
    const result = service.classify(baseState({
      triggers: [{
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
      actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }))

    expect(result.route).toBe('projection_gate')
    expect(result.unsupportedAtoms).toEqual([])
    expect(result.state.triggers[0].support).toBeUndefined()
  })

  it('adds registry open slots for supported requires-slot risk atoms with unknown required params', () => {
    const result = service.classify(baseState({
      triggers: [{
        id: 'entry',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
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
      triggers: [{
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
      actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
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
    expect(result.state.triggers[0].support).toBeUndefined()
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
      triggers: [{
        id: 'volume',
        key: 'volume.spike',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [executionSlot],
      }],
      actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }))

    expect(result.route).toBe('unsupported_fallback')
    expect(result.openSlots).toEqual([])
  })

  it('blocks unknown atom combinations without treating them as open slots', () => {
    const result = service.classify(baseState({
      triggers: [{
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
      triggers: [
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
          key: 'external.signal',
          phase: 'entry',
          params: {},
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }))

    expect(result.route).toBe('unknown_unsupported')
    expect(result.unknownAtoms).toEqual(['external.signal'])
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
      triggers: [{
        id: 'entry',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: { indicator: 'ma', slowPeriod: 50 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [slot],
      }],
      actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    }))

    expect(result.route).toBe('open_slots')
    expect(result.openSlots).toEqual([slot])
  })
})
