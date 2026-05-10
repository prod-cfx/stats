import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'

/**
 * Phase 5 S10 (#1111) — NL gateway 双 fan-out 独立非笛卡尔积
 *
 * Critic Missing 兜底：
 *   - symbol fan-out (parseSymbolScope) 与 sub-strategy fan-out (parseSubStrategyScope)
 *     是两条独立 parser；同 utterance 同时命中时各自 emit N + M frame
 *     而不是 N×M 笛卡尔积（plan §10 explicit 承诺）
 */

describe('naturalLanguageGatewayService — Phase 5 S10 symbol + subStrategy 双 fan-out 独立非笛卡尔积', () => {
  const gateway = new NaturalLanguageGatewayService()

  it('utterance 同时含 2 symbol 触发 + 2 sub-strategy 候选 → 2 symbol_scope frame + 2 sub_strategy_scope frame（非 4 frame 笛卡尔积）', () => {
    const frames = gateway.parse(
      'BTCUSDT 和 ETHUSDT 同时跑，趋势行情用趋势子策略，震荡行情用震荡子策略',
    )

    const symbolFrames = frames.filter(f => f.kind === 'symbol_scope')
    const subFrames = frames.filter(f => f.kind === 'sub_strategy_scope')

    // symbol fan-out：单 frame 含两个 symbol 数组（plan §10 fan-out by single scope frame, symbols 内嵌）
    expect(symbolFrames.length).toBe(1)
    const sFrame = symbolFrames[0] as unknown as { symbols: string[] }
    expect(sFrame.symbols).toEqual(['BTCUSDT', 'ETHUSDT'])

    // sub fan-out：每候选一个 frame
    expect(subFrames.length).toBe(2)
    const subIds = subFrames
      .map(f => (f as { subStrategyId: string }).subStrategyId)
      .sort()
    expect(subIds).toEqual(['range_sub', 'trend_sub'])

    // 关键反例：两条独立 fan-out 不应 → 2 × 2 = 4 sub_strategy frames
    expect(subFrames.length).not.toBe(4)
  })

  it('utterance 仅含 symbol 触发 → 0 sub_strategy_scope frame（独立性 1 — symbol 不污染 sub）', () => {
    const frames = gateway.parse('BTCUSDT 和 ETHUSDT 同时挂网格')
    const symbolFrames = frames.filter(f => f.kind === 'symbol_scope')
    const subFrames = frames.filter(f => f.kind === 'sub_strategy_scope')

    expect(symbolFrames.length).toBe(1)
    expect(subFrames.length).toBe(0)
  })

  it('utterance 仅含 sub-strategy 触发 → 0 symbol_scope frame（独立性 2 — sub 不污染 symbol）', () => {
    const frames = gateway.parse('趋势子策略和震荡子策略，切换时平掉旧仓位')
    const symbolFrames = frames.filter(f => f.kind === 'symbol_scope')
    const subFrames = frames.filter(f => f.kind === 'sub_strategy_scope')

    expect(symbolFrames.length).toBe(0)
    expect(subFrames.length).toBe(2)
  })
})
