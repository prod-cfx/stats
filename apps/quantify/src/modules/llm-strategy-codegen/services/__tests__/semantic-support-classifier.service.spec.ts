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
