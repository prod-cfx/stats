import type { SemanticRiskState } from '../../types/semantic-state'
import { normalizeRiskSemantics } from '../semantic-state-normalization'

describe('normalizeRiskSemantics', () => {
  it('defaults plain stop loss basis and removes basis open slots', () => {
    const risks: SemanticRiskState[] = [{
      id: 'risk-1',
      key: 'risk.stop_loss_pct',
      params: { valuePct: 5 },
      status: 'open',
      source: 'derived',
      openSlots: [{
        slotKey: 'risk.stopLoss.basis',
        fieldPath: 'risk[0].params.ambiguousRiskField',
        questionHint: '请确认止损 5% 的计算基准',
        status: 'open',
        priority: 'risk',
        affectsExecution: true,
      }],
    }]

    expect(normalizeRiskSemantics(risks)).toEqual([expect.objectContaining({
      status: 'locked',
      params: expect.objectContaining({
        valuePct: 5,
        direction: 'loss',
        basis: 'entry_avg_price',
        basisSource: 'system_default',
        effect: 'close_position',
        scope: 'current_position',
      }),
      openSlots: [],
    })])
  })

  it('preserves user-explicit position pnl basis', () => {
    const risks: SemanticRiskState[] = [{
      id: 'risk-1',
      key: 'risk.take_profit_pct',
      params: { valuePct: 10, basis: 'position_pnl', basisSource: 'user_explicit' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }]

    expect(normalizeRiskSemantics(risks)[0]).toEqual(expect.objectContaining({
      params: expect.objectContaining({
        direction: 'profit',
        basis: 'position_pnl',
        basisSource: 'user_explicit',
      }),
      openSlots: [],
    }))
  })

  it('keeps threshold open when valuePct is missing', () => {
    const risks: SemanticRiskState[] = [{
      id: 'risk-1',
      key: 'risk.stop_loss_pct',
      params: {},
      status: 'open',
      source: 'derived',
      openSlots: [],
    }]

    expect(normalizeRiskSemantics(risks)[0]).toEqual(expect.objectContaining({
      status: 'open',
      params: expect.objectContaining({
        direction: 'loss',
        basis: 'entry_avg_price',
        basisSource: 'system_default',
      }),
    }))
  })

  it('does not relock superseded percent risks while defaulting params', () => {
    const risks: SemanticRiskState[] = [{
      id: 'risk-superseded',
      key: 'risk.stop_loss_pct',
      params: { valuePct: 5 },
      status: 'superseded',
      source: 'derived',
      openSlots: [{
        slotKey: 'risk.stopLoss.basis',
        fieldPath: 'risk[0].params.basis',
        questionHint: '请确认止损 5% 的计算基准',
        status: 'open',
        priority: 'risk',
        affectsExecution: true,
      }],
    }]

    expect(normalizeRiskSemantics(risks)[0]).toEqual(expect.objectContaining({
      status: 'superseded',
      params: expect.objectContaining({
        basis: 'entry_avg_price',
        basisSource: 'system_default',
      }),
      openSlots: [],
    }))
  })

  it('preserves valid risk condition expressions as recognized unsupported', () => {
    const condition = {
      kind: 'predicate',
      left: { kind: 'position', field: 'pnl_pct' },
      op: 'LTE',
      right: { kind: 'constant', value: -5 },
    }
    const effect = { type: 'close_position' }
    const risks: SemanticRiskState[] = [{
      id: 'risk-expression',
      key: 'risk.condition_expression',
      params: {
        condition,
        effect,
        scope: 'current_position',
        capabilityStatus: 'recognized_unsupported',
        unsupportedReason: 'risk_expression_compiler_not_available',
      },
      status: 'locked',
      source: 'derived',
      openSlots: [],
    }]

    expect(normalizeRiskSemantics(risks)[0]).toEqual(expect.objectContaining({
      key: 'risk.condition_expression',
      params: expect.objectContaining({
        condition,
        effect,
        scope: 'current_position',
        capabilityStatus: 'recognized_unsupported',
        unsupportedReason: 'risk_expression_compiler_not_available',
      }),
      openSlots: [],
    }))
  })

  it('does not mutate input risk params or open slots', () => {
    const basisSlot = {
      slotKey: 'risk.takeProfit.basis',
      fieldPath: 'risk[0].params.unrelatedField',
      questionHint: '请确认止盈 8% 的计算基准',
      status: 'open' as const,
      priority: 'risk' as const,
      affectsExecution: true,
    }
    const risks: SemanticRiskState[] = [{
      id: 'risk-1',
      key: 'risk.take_profit_pct',
      params: { valuePct: 8 },
      status: 'open',
      source: 'derived',
      openSlots: [basisSlot],
    }]
    const originalParams = { ...risks[0].params }
    const originalOpenSlots = [...risks[0].openSlots]

    const normalized = normalizeRiskSemantics(risks)

    expect(risks[0].params).toEqual(originalParams)
    expect(risks[0].openSlots).toEqual(originalOpenSlots)
    expect(normalized[0].params).not.toBe(risks[0].params)
    expect(normalized[0].openSlots).not.toBe(risks[0].openSlots)
    expect(normalized[0].openSlots).toEqual([])
  })
})
