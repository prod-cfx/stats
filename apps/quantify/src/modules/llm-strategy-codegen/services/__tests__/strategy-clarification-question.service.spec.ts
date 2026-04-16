import { buildConversationPlannerSystemPrompt } from '../../prompts/conversation-planner-system.prompt'
import { StrategyClarificationQuestionService } from '../strategy-clarification-question.service'

describe('strategyClarificationQuestionService', () => {
  const questionService = new StrategyClarificationQuestionService()

  it('renders inferred defaults as a confirmation prompt before compile', () => {
    const prompt = questionService.buildFromDecision({
      kind: 'CONFIRM_INFERRED',
      normalizedSummary: 'OKX 合约 BTCUSDT；突破布林带上轨做空；回到中轨平仓',
      blockingReasons: [],
      inferredAssumptions: [
        { key: 'trigger.confirmation', value: 'close_confirm', source: 'system_default' },
      ],
      nextActionPayload: { mode: 'confirm_inferred' },
    })

    expect(prompt).toContain('我当前理解的策略是')
    expect(prompt).toContain('以下内容是系统推断')
    expect(prompt).toContain('trigger.confirmation')
    expect(prompt).toContain('请确认这些推断是否成立')
  })

  it('renders only the top-ranked blocker when decision mode is ask clarify', () => {
    const prompt = questionService.buildFromDecision({
      kind: 'ASK_CLARIFY',
      normalizedSummary: 'OKX 合约 BTCUSDT；布林带上轨触发做空',
      blockingReasons: [
        { key: 'trigger.confirmation', reason: 'trigger_semantics_fork', priority: 10, question: '该布林带条件是触碰即触发，还是收盘确认后触发？' },
      ],
      inferredAssumptions: [],
      nextActionPayload: {
        mode: 'ask_clarify',
        question: { key: 'trigger.confirmation', reason: 'trigger_semantics_fork', priority: 10, question: '该布林带条件是触碰即触发，还是收盘确认后触发？' },
      },
    })

    expect(prompt).toContain('执行语义分叉')
    expect(prompt).toContain('该布林带条件是触碰即触发，还是收盘确认后触发')
  })

  it('asks for exchange when execution context is incomplete', () => {
    const prompt = questionService.buildFromAmbiguities({
      summary: 'BTCUSDT 15m，网格区间 60000-80000，每格 0.5%，单笔 10% 仓位',
      ambiguities: [
        {
          kind: 'execution_context_missing',
          field: 'exchange',
          message: '缺少唯一交易所',
        },
      ],
    })

    expect(prompt).toContain('我当前理解的策略是')
    expect(prompt).toContain('缺少唯一交易所')
    expect(prompt).toContain('请确认交易所')
  })

  it('asks for Bollinger confirmation mode when two legal trigger interpretations remain', () => {
    const prompt = questionService.buildFromAmbiguities({
      summary: 'OKX 合约 BTCUSDT 15m；入场：突破布林带上轨做空',
      ambiguities: [
        {
          kind: 'atomic_semantic_fork',
          field: 'trigger.confirmation',
          message: '存在触碰即触发与收盘确认触发两种合法解释',
          choices: ['touch', 'close_confirm'],
        },
      ],
    })

    expect(prompt).toContain('存在触碰即触发与收盘确认触发两种合法解释')
    expect(prompt).toContain('触碰即触发')
    expect(prompt).toContain('收盘确认后触发')
  })

  it('prioritizes open semantic slots before execution context gaps', () => {
    const prompt = questionService.buildFromAmbiguities({
      summary: '入场：当价格突破一条长期均线时买入；出场：当价格跌破一条短期均线时卖出',
      ambiguities: [
        {
          kind: 'execution_context_missing',
          field: 'exchange',
          message: '缺少唯一交易所',
        },
        {
          kind: 'open_semantic_slot',
          field: 'reference.period',
          message: '核心信号未闭合',
          question: '长期均线是多少？',
          priority: 10,
        },
      ],
    })

    expect(prompt).toContain('长期均线是多少')
    expect(prompt).not.toContain('请确认交易所')
  })

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

    expect(prompt).toContain('你的职责是生成 semantic update candidates 与自然语言交互')
    expect(prompt).toContain('"semanticUpdates"?: {')
    expect(prompt).not.toContain('标的/周期/风控可后续配置，不应强制先问这些。')
    expect(prompt).not.toContain('交易所、周期、仓位、risk metadata 可后续补充。')
  })

  it('describes grid clarification gaps as grid parameters instead of a generic blocker', () => {
    const prompt = questionService.build({
      status: 'NEEDS_CLARIFICATION',
      items: [
        {
          key: 'grid.stepPct',
          reason: 'grid_params_missing',
          field: 'grid.stepPct',
          blocking: true,
          question: '请确认网格步长（例如每格 0.5%）。',
          status: 'pending',
        },
      ],
    })

    expect(prompt).toContain('网格参数')
    expect(prompt).toContain('请确认网格步长')
  })

  it('describes atomic semantic forks as executable semantic ambiguity', () => {
    const prompt = questionService.build({
      status: 'NEEDS_CLARIFICATION',
      items: [
        {
          key: 'entry.trigger.confirmation.1',
          reason: 'atomic_semantic_fork',
          field: 'trigger.confirmation',
          allowedAnswers: ['touch', 'close_confirm'],
          blocking: true,
          question: '入场规则“突破布林带上轨做空”是触碰即触发，还是收盘确认后触发？',
          status: 'pending',
        },
      ],
    })

    expect(prompt).toContain('执行语义分叉')
    expect(prompt).toContain('触碰即触发')
    expect(prompt).toContain('收盘确认后触发')
  })
})
