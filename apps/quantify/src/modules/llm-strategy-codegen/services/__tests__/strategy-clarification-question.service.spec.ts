import { StrategyClarificationQuestionService } from '../strategy-clarification-question.service'

describe('strategyClarificationQuestionService', () => {
  const questionService = new StrategyClarificationQuestionService()

  it('asks only the highest-priority unresolved clarification question', () => {
    const prompt = questionService.build({
      status: 'NEEDS_CLARIFICATION',
      items: [
        { key: 'riskRules.earlyStop.action', reason: 'ambiguous_risk_effect', field: 'riskRules.earlyStop.action', blocking: true, question: '轨外3根时是全平还是减仓？', status: 'pending' },
        { key: 'entry.side', reason: 'missing_side_scope', field: 'positionMode', blocking: true, question: '突破上轨时是只做空还是也允许做多？', status: 'pending' },
      ],
    })

    expect(prompt).toContain('缺少方向约束')
    expect(prompt).toContain('突破上轨时是只做空还是也允许做多')
    expect(prompt).not.toContain('轨外3根时是全平还是减仓')
  })

  it('returns empty prompt when no clarification is needed', () => {
    expect(questionService.build({ status: 'CLEAR', items: [] })).toBe('')
  })

  it('prioritizes market blockers before ambiguous wording clarifications', () => {
    const prompt = questionService.build({
      status: 'NEEDS_CLARIFICATION',
      items: [
        { key: 'riskRules.earlyStop.action', reason: 'ambiguous_risk_effect', field: 'riskRules.earlyStop.action', blocking: true, question: '轨外3根时是全平还是减仓？', status: 'pending' },
        { key: 'market.marketType', reason: 'missing_market_type', field: 'marketType', blocking: true, question: '该策略运行在现货还是合约市场？', status: 'pending' },
      ],
    })

    expect(prompt).toContain('市场')
    expect(prompt).toContain('该策略运行在现货还是合约市场？')
    expect(prompt).not.toContain('轨外3根时是全平还是减仓')
  })

  it('prioritizes action uniqueness before market blockers', () => {
    const prompt = questionService.build({
      status: 'NEEDS_CLARIFICATION',
      items: [
        { key: 'market.marketType', reason: 'missing_market_type', field: 'marketType', blocking: true, question: '该策略运行在现货还是合约市场？', status: 'pending' },
        { key: 'entry.action_uniqueness.1', reason: 'missing_action_uniqueness', field: 'positionMode', blocking: true, question: '这条入场规则同时包含做多和做空，请确认最终只保留哪个方向？', status: 'pending' },
      ],
    })

    expect(prompt).toContain('动作唯一性')
    expect(prompt).toContain('请确认最终只保留哪个方向')
    expect(prompt).not.toContain('该策略运行在现货还是合约市场？')
  })
})
