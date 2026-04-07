import { StrategyClarificationQuestionService } from '../strategy-clarification-question.service'

describe('StrategyClarificationQuestionService', () => {
  const service = new StrategyClarificationQuestionService()

  it('builds one-sentence reason plus one question prompt', () => {
    const prompt = service.buildPrompt({
      id: 'price-change-exit-basis',
      kind: 'semantic_ambiguity',
      strategyType: 'price_change_pct',
      field: 'exitBasis',
      reason: '当前出场条件存在两种可编译解释',
      question: '这里的上涨1%，是相对上一根3分钟K线，还是相对开仓均价？',
      priority: 80,
      status: 'pending',
    })

    expect(prompt).toBe('当前出场条件存在两种可编译解释，所以我先确认一个点：这里的上涨1%，是相对上一根3分钟K线，还是相对开仓均价？')
  })
})
