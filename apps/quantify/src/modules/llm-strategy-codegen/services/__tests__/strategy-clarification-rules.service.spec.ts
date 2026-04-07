import { StrategyClarificationRulesService } from '../strategy-clarification-rules.service'

describe('strategyClarificationRulesService', () => {
  const service = new StrategyClarificationRulesService()

  it('detects missing side scope for upper-band breakout entry rule', () => {
    const state = service.detect({
      entryRules: ['突破布林带上轨交易'],
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'entry.side',
        reason: 'missing_side_scope',
        status: 'pending',
      }),
    ]))
  })

  it('detects entry action uniqueness conflict when one rule includes long and short actions', () => {
    const state = service.detect({
      entryRules: ['突破后同时做多和做空'],
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'missing_action_uniqueness',
        status: 'pending',
      }),
    ]))
  })

  it('detects ambiguous risk effect when risk text contains force-exit and reduce-position alternatives', () => {
    const state = service.detect({
      riskRules: {
        earlyStop: '价格连续3根K线在轨外时全平或减仓',
      },
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.effect',
        reason: 'ambiguous_risk_effect',
        question: '轨外3根时是全平还是减仓？',
      }),
    ]))
  })

  it('returns CLEAR for unambiguous rules', () => {
    const state = service.detect({
      entryRules: ['突破布林带上轨时做空'],
      riskRules: {
        stopLossPct: 5,
      },
    })

    expect(state).toEqual({
      status: 'CLEAR',
      items: [],
    })
  })
})
