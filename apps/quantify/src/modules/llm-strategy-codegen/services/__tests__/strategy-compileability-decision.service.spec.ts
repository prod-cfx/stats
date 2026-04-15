import { StrategyCompileabilityDecisionService } from '../strategy-compileability-decision.service'

describe('StrategyCompileabilityDecisionService', () => {
  const service = new StrategyCompileabilityDecisionService()

  it('returns DIRECT_COMPILE when context is complete and no inference is used', () => {
    const decision = service.decide({
      normalizedSummary: 'OKX 合约 BTCUSDT；在 60000-80000 区间执行网格低买高卖；每格 0.5%；单笔 10% 仓位',
      blockingReasons: [],
      inferredAssumptions: [],
      compileability: { canCompile: true, entryRuleCount: 1, exitRuleCount: 1, reasons: [] },
    })

    expect(decision.kind).toBe('DIRECT_COMPILE')
  })

  it('returns CONFIRM_INFERRED when the only remaining uncertainty is an inferred default', () => {
    const decision = service.decide({
      normalizedSummary: 'OKX 合约 BTCUSDT；突破布林带上轨做空；回到中轨平仓',
      blockingReasons: [],
      inferredAssumptions: [
        { key: 'trigger.confirmation', value: 'close_confirm', source: 'system_default' },
      ],
      compileability: { canCompile: true, entryRuleCount: 1, exitRuleCount: 1, reasons: [] },
    })

    expect(decision.kind).toBe('CONFIRM_INFERRED')
    expect(decision.inferredAssumptions).toHaveLength(1)
  })

  it('returns ASK_CLARIFY when real semantic forks remain', () => {
    const decision = service.decide({
      normalizedSummary: 'OKX 合约 BTCUSDT；布林带上轨条件触发做空',
      blockingReasons: [
        { key: 'trigger.confirmation', reason: 'trigger_semantics_fork', priority: 10, question: '该布林带条件是触碰即触发，还是收盘确认后触发？' },
      ],
      inferredAssumptions: [],
      compileability: { canCompile: false, entryRuleCount: 1, exitRuleCount: 0, reasons: ['未识别可编译出场规则'] },
    })

    expect(decision.kind).toBe('ASK_CLARIFY')
    if (decision.kind !== 'ASK_CLARIFY') {
      throw new Error('expected ASK_CLARIFY')
    }
    expect(decision.nextActionPayload.question.key).toBe('trigger.confirmation')
  })

  it('returns ASK_CLARIFY when compileability fails even if no explicit blocker was precomputed', () => {
    const decision = service.decide({
      normalizedSummary: 'OKX 合约 BTCUSDT；价格突破阻力位入场',
      blockingReasons: [],
      inferredAssumptions: [],
      compileability: { canCompile: false, entryRuleCount: 1, exitRuleCount: 0, reasons: ['未识别可编译出场规则'] },
    })

    expect(decision.kind).toBe('ASK_CLARIFY')
    if (decision.kind !== 'ASK_CLARIFY') {
      throw new Error('expected ASK_CLARIFY')
    }
    expect(decision.nextActionPayload.question.key).toBe('compileability')
  })
})
