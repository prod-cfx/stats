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

  it('enforces multi-timeframe entry dimension preservation', () => {
    const prompt = buildStrategyNormalizationSystemPrompt()

    // 必须保留逐一保留语义
    expect(prompt).toContain('逐一')
    // 不得以执行 timeframe 为由剔除任何 TF 维度
    expect(prompt).toContain('不得以')
    expect(prompt).toContain('执行 timeframe')
  })
})
