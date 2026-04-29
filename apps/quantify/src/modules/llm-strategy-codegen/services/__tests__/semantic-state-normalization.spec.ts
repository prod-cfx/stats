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
        slotKey: 'risk.stopLossBasis',
        fieldPath: 'risk[0].params.stopLossBasis',
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

  it('preserves valid risk condition expressions as recognized unsupported', () => {
    const risks: SemanticRiskState[] = [{
      id: 'risk-expression',
      key: 'risk.condition_expression',
      params: {
        condition: {
          kind: 'predicate',
          left: { kind: 'position', field: 'pnl_pct' },
          op: 'LTE',
          right: { kind: 'constant', value: -5 },
        },
        effect: { type: 'close_position' },
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
        capabilityStatus: 'recognized_unsupported',
      }),
      openSlots: [],
    }))
  })
})
