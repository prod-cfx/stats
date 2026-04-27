import { buildStrategyNormalizationSystemPrompt } from '../strategy-normalization-system.prompt'

describe('strategyNormalizationSystemPrompt', () => {
  it('locks the whitelist-only normalization contract', () => {
    const prompt = buildStrategyNormalizationSystemPrompt()

    expect(prompt).toContain('你是 AI Quant 语义归一器。')
    expect(prompt).toContain('只能从白名单 atom/family 中选择，不允许发明新类型。')
    expect(prompt).toContain('白名单 family：single-leg, grid.range_rebalance, state-gated。')
    expect(prompt).toContain('白名单 state atoms：trend.direction, market.regime, volatility.state。')
    expect(prompt).toContain('白名单 execution atoms：execution.on_start。')
    expect(prompt).toContain('若信息不足，请输出 unresolved，不要擅自补默认执行语义。')
    expect(prompt).toContain('只输出 JSON。')
  })

  it('normalizes edits as incremental atomic semantic changes against active semantic state', () => {
    const prompt = buildStrategyNormalizationSystemPrompt()

    expect(prompt).toContain('已有 active semantic state 时，默认按增量修改处理')
    expect(prompt).toContain('输出原子语义 patch')
    expect(prompt).toContain('context、trigger、action、risk、position')
    expect(prompt).toContain('不要输出 checklist')
    expect(prompt).toContain('不要从脚本文本反推策略语义')
    expect(prompt).toContain('用户明确要求替换整个策略')
    expect(prompt).toContain('否则不得重置已有语义')
    expect(prompt).toContain('若编辑信息不完整，只标记缺失的 semantic slot')
  })
})
