import { StrategyClarificationQuestionService } from '../strategy-clarification-question.service'

describe('strategyClarificationQuestionService', () => {
  const questionService = new StrategyClarificationQuestionService()

  it('asks only the highest-priority unresolved clarification question', () => {
    const prompt = questionService.build({
      status: 'NEEDS_CLARIFICATION',
      items: [
        { key: 'risk.effect', reason: 'ambiguous_risk_effect', question: '轨外3根时是全平还是减仓？', status: 'pending' },
        { key: 'entry.side', reason: 'missing_side_scope', question: '突破上轨时是只做空还是也允许做多？', status: 'pending' },
      ],
    })

    expect(prompt).toContain('缺少方向约束')
    expect(prompt).toContain('突破上轨时是只做空还是也允许做多')
    expect(prompt).not.toContain('轨外3根时是全平还是减仓')
  })

  it('returns empty prompt when no clarification is needed', () => {
    expect(questionService.build({ status: 'CLEAR', items: [] })).toBe('')
  })
})
