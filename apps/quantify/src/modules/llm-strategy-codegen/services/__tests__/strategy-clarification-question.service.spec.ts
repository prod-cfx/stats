import { buildConversationPlannerSystemPrompt } from '../../prompts/conversation-planner-system.prompt'
import { StrategyClarificationQuestionService } from '../strategy-clarification-question.service'

describe('strategyClarificationQuestionService', () => {
  const questionService = new StrategyClarificationQuestionService()

  it('asks only the highest-priority unresolved clarification question', () => {
    const prompt = questionService.build({
      status: 'NEEDS_CLARIFICATION',
      items: [
        { key: 'riskRules.earlyStop.action', reason: 'ambiguous_risk_effect', field: 'riskRules.earlyStop.action', blocking: true, question: '轨外3根时是全平还是减仓？', status: 'pending' },
        { key: 'entry.side.1', reason: 'missing_side_scope', field: 'positionMode', blocking: true, question: '突破上轨时是只做空还是也允许做多？', status: 'pending' },
      ],
    })

    expect(prompt).toContain('缺少方向约束')
    expect(prompt).toContain('突破上轨时是只做空还是也允许做多')
    expect(prompt).not.toContain('轨外3根时是全平还是减仓')
  })

  it('returns empty prompt when no clarification is needed', () => {
    expect(questionService.build({ status: 'CLEAR', items: [] })).toBe('')
  })

  it('prioritizes market/runtime scope before basis clarifications', () => {
    const prompt = questionService.build({
      status: 'NEEDS_CLARIFICATION',
      items: [
        { key: 'entry.basis.1', reason: 'ambiguous_condition_basis', field: 'entryRules.basis', blocking: true, question: '这里的 3 分钟内跌 1% 是相对上一根 K 线收盘价还是别的基准？', status: 'pending' },
        { key: 'market.marketType', reason: 'missing_market_type', field: 'marketType', blocking: true, question: '该策略运行在现货还是合约市场？', status: 'pending' },
      ],
    })

    expect(prompt).toContain('市场')
    expect(prompt).toContain('该策略运行在现货还是合约市场？')
    expect(prompt).not.toContain('这里的 3 分钟内跌 1% 是相对上一根 K 线收盘价还是别的基准？')
  })

  it('prioritizes core trading semantics before market/runtime scope', () => {
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

  it('prioritizes conflict resolution before core trading semantics', () => {
    const prompt = questionService.build({
      status: 'NEEDS_CLARIFICATION',
      items: [
        { key: 'market.scope.conflict', reason: 'conflicting_market_scope', field: 'marketType', blocking: true, question: '你前面说的是 OKX 合约，但后面又提到现货买入，请确认最终市场范围。', status: 'pending' },
        { key: 'entry.side.1', reason: 'missing_side_scope', field: 'positionMode', blocking: true, question: '突破上轨时是只做空还是也允许做多？', status: 'pending' },
      ],
    })

    expect(prompt).toContain('冲突')
    expect(prompt).toContain('请确认最终市场范围')
    expect(prompt).not.toContain('突破上轨时是只做空还是也允许做多？')
  })

  it('prioritizes conflict resolution even when market scope items appear before it', () => {
    const prompt = questionService.build({
      status: 'NEEDS_CLARIFICATION',
      items: [
        { key: 'market.marketType', reason: 'missing_market_type', field: 'marketType', blocking: true, question: '该策略运行在现货还是合约市场？', status: 'pending' },
        { key: 'market.scope.conflict', reason: 'conflicting_market_scope', field: 'marketType', blocking: true, question: '你前面说的是 OKX 合约，但后面又提到现货买入，请确认最终市场范围。', status: 'pending' },
      ],
    })

    expect(prompt).toContain('冲突')
    expect(prompt).toContain('请确认最终市场范围')
    expect(prompt).not.toContain('该策略运行在现货还是合约市场？')
  })

  it('summarizes current understanding before asking the highest-priority question', () => {
    const prompt = questionService.build({
      status: 'NEEDS_CLARIFICATION',
      summary: '当前策略：OKX 合约 BTCUSDT 15m，布林上轨做空，下轨做多，中轨平仓。',
      items: [
        {
          key: 'risk.stopLoss.basis',
          reason: 'ambiguous_condition_basis',
          field: 'riskRules.stopLossBasis',
          blocking: true,
          question: '这里的 5% 止损是按持仓亏损，还是按价格相对入场价计算？',
          status: 'pending',
        },
      ],
    } as Parameters<typeof questionService.build>[0] & { summary: string })

    expect(prompt).toContain('我当前理解的策略是')
    expect(prompt).toContain('现在还缺一个会影响脚本生成一致性的条件')
    expect(prompt).toContain('这里的 5% 止损是按持仓亏损')
  })

  it('requires the conversation planner prompt to summarize first and keep logicReady false while blockers remain', () => {
    const prompt = buildConversationPlannerSystemPrompt()

    expect(prompt).toContain('2) 如果策略逻辑还不完整：logicReady=false，assistantPrompt 必须先总结当前已理解策略，再只问一个最高优先级问题。')
    expect(prompt).toContain('3) 若任一必答项，或阈值/时间窗口/序列条件的比较基准仍不明确：logicReady=false，禁止请求确认逻辑图。')
    expect(prompt).not.toContain('标的/周期/风控可后续配置，不应强制先问这些。')
    expect(prompt).not.toContain('交易所、周期、仓位、risk metadata 可后续补充。')
  })
})
