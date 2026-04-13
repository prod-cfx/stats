import {
  classifyPercentageRuleFamily,
  extractExplicitRiskBasis,
  resolveDefaultRiskBasis,
} from '../rule-family-default-semantics'

describe('ruleFamilyDefaultSemantics', () => {
  it('treats stop-loss and take-profit percentages as safe-default risk families', () => {
    expect(classifyPercentageRuleFamily({
      phase: 'risk',
      rule: '止损 5%',
    })).toEqual(expect.objectContaining({
      family: 'risk.stop_loss_pct',
      defaultBasis: 'entry_avg_price',
      requiresUserBasis: false,
    }))

    expect(classifyPercentageRuleFamily({
      phase: 'risk',
      rule: '止盈 10%',
    })).toEqual(expect.objectContaining({
      family: 'risk.take_profit_pct',
      defaultBasis: 'entry_avg_price',
      requiresUserBasis: false,
    }))
  })

  it('keeps trigger percent-change rules clarification-gated', () => {
    expect(classifyPercentageRuleFamily({
      phase: 'entry',
      rule: '15 分钟上涨 1% 买入',
    })).toEqual(expect.objectContaining({
      family: 'trigger.percent_change',
      defaultBasis: null,
      requiresUserBasis: true,
    }))
  })

  it('fails safe for unknown percent rules without an approved default basis', () => {
    expect(classifyPercentageRuleFamily({
      phase: 'exit',
      rule: '波动率达到 5% 时触发保护',
    })).toEqual(expect.objectContaining({
      family: 'unknown',
      defaultBasis: null,
      requiresUserBasis: true,
    }))
  })

  it('extracts explicit non-default risk basis before applying defaults', () => {
    expect(extractExplicitRiskBasis('按持仓亏损 5% 止损')).toBe('position_pnl')
    expect(resolveDefaultRiskBasis('止损 5%', null)).toBe('entry_avg_price')
    expect(resolveDefaultRiskBasis('按持仓亏损 5% 止损', null)).toBe('position_pnl')
  })
})
