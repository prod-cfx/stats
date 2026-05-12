/**
 * Issue #1231 — 兜底分支隔离测试
 *
 * 修复点：seed-extractor 的 price.pattern 兜底分支移除了裸 "形态|pattern" 字面量，
 * 并通过 candlePatternMatched / chartPatternMatched / liquiditySweepMatched 三道闸门
 * 阻止 supported pattern 在同一 clause 内被重复降级为 unsupported `price.pattern`。
 */

import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'

const extractor = new SemanticSeedExtractorService()

function triggerKeys(patch: ReturnType<SemanticSeedExtractorService['extract']>): string[] {
  return (patch.triggers ?? []).map(trigger => trigger.key)
}

describe('SemanticSeedExtractorService — unsupported price.pattern fallback isolation', () => {
  it('看涨吞没 K 线形态 → 只产 price.candle_pattern，不再误降为 price.pattern', () => {
    const patch = extractor.extract('OKX 合约 BTCUSDT 15m，出现看涨吞没 K 线形态后开多，5% 止损，单笔 10%。')
    const keys = triggerKeys(patch)
    expect(keys).toContain('price.candle_pattern')
    expect(keys).not.toContain('price.pattern')

    const candle = (patch.triggers ?? []).find(trigger => trigger.key === 'price.candle_pattern')
    expect(candle?.params).toMatchObject({ pattern: 'engulfing', direction: 'bullish' })
  })

  // 原始 bug report 用户表达："出现看涨吞没形态后开多"（无"K 线"二字），
  // 与上一条仅差"K 线"字面量但走同一识别分支。两条都锁住，防止任一表达回归。
  it('看涨吞没形态（无 K 线二字）→ 只产 price.candle_pattern，不再误降为 price.pattern', () => {
    const patch = extractor.extract('OKX 合约 BTCUSDT 15m，出现看涨吞没形态后开多，5% 止损，单笔 10%。')
    const keys = triggerKeys(patch)
    expect(keys).toContain('price.candle_pattern')
    expect(keys).not.toContain('price.pattern')

    const candle = (patch.triggers ?? []).find(trigger => trigger.key === 'price.candle_pattern')
    expect(candle?.params).toMatchObject({ pattern: 'engulfing', direction: 'bullish' })
  })

  it('锤子线形态 → 只产 price.candle_pattern，不再误降为 price.pattern', () => {
    const patch = extractor.extract('OKX 合约 BTCUSDT 15m，出现看涨锤子线形态后开多，5% 止损，单笔 10%。')
    const keys = triggerKeys(patch)
    expect(keys).toContain('price.candle_pattern')
    expect(keys).not.toContain('price.pattern')
  })

  it('扫前低 sweep 反弹形态 → 只产 liquidity.sweep，不再误降为 price.pattern', () => {
    const patch = extractor.extract('OKX 合约 BTCUSDT 15m，扫前低 sweep 后反弹形态后开多，5% 止损，单笔 10%。')
    const keys = triggerKeys(patch)
    expect(keys).toContain('liquidity.sweep')
    expect(keys).not.toContain('price.pattern')
  })

  it('回归：楔形形态 (无白名单具体识别) → 仍走 price.pattern 兜底', () => {
    const patch = extractor.extract('OKX 合约 BTCUSDT 15m，出现楔形形态后开多，5% 止损，单笔 10%。')
    const keys = triggerKeys(patch)
    expect(keys).toContain('price.pattern')
  })

  it('回归：三只乌鸦形态 (无白名单具体识别) → 仍走 price.pattern 兜底', () => {
    const patch = extractor.extract('OKX 合约 BTCUSDT 15m，出现三只乌鸦形态后开空，5% 止损，单笔 10%。')
    const keys = triggerKeys(patch)
    expect(keys).toContain('price.pattern')
  })

  // Issue #1231 #m1：连字符/下划线/粘连写法的英文复合形态名也必须落入 unsupported 兜底，
  // 不能因为 regex 只识别 `\s+` 分隔的标准写法而被静默吞掉
  it.each([
    ['head-and-shoulders', 'OKX 合约 BTCUSDT 15m，head-and-shoulders 形态出现后开空。'],
    ['head_and_shoulders', 'OKX 合约 BTCUSDT 15m，head_and_shoulders 出现后开空。'],
    ['double-top', 'OKX 合约 BTCUSDT 15m，double-top 形态后开空。'],
    ['three-black-crows', 'OKX 合约 BTCUSDT 15m，three-black-crows 出现后开空。'],
  ])('回归：连字符复合写法 %s → 落入 price.pattern unsupported 兜底（不被静默吞掉）', (_label, utterance) => {
    const patch = extractor.extract(utterance)
    const keys = triggerKeys(patch)
    expect(keys).toContain('price.pattern')
  })
})
