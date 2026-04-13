import { buildChecklistRuleDrafts, resolveRequiredRuleTimeframes } from '../checklist-rule-drafts'

describe('checklistRuleDrafts', () => {
  it('keeps distinct rule-level timeframes for entry and exit drafts', () => {
    const drafts = buildChecklistRuleDrafts({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['3m 内下跌 1% 买入'],
      exitRules: ['15m 内上涨 2% 卖出'],
    })

    expect(drafts.entry[0]).toMatchObject({
      id: 'entry-1',
      text: '3m 内下跌 1% 买入',
      timeframe: '3m',
    })
    expect(drafts.exit[0]).toMatchObject({
      id: 'exit-1',
      text: '15m 内上涨 2% 卖出',
      timeframe: '15m',
    })
    expect(resolveRequiredRuleTimeframes(drafts, '3m')).toEqual(['3m', '15m'])
  })
})
