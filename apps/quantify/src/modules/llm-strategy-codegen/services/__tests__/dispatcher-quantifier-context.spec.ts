/**
 * Issue #1403 通用化 — ExtractorSpec.quantifier 上下文过滤 spec
 *
 * 验证 number-int / number-decimal parser 在声明 quantifier.include / exclude 后：
 *   - 数字必须紧跟 include 中任一量词，否则不抽
 *   - 已抽数字后**剥掉 include 量词**再检查 exclude（避免「N 根 5 分钟」串读误判）
 *   - clause 中数字多次出现时按位置遍历，找到首个满足上下文的命中
 *
 * 通过 GenericSeedDispatcherService 公开的 dispatcher 接口走完整链路验证。
 */

import { collectAtomLeaves } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

describe('Issue #1403 — ExtractorSpec.quantifier 通用上下文过滤', () => {
  const service = new GenericSeedDispatcher()

  function findConditionLeaf(patch: ReturnType<GenericSeedDispatcher['dispatch']>, key: string) {
    return (patch.rules ?? [])
      .flatMap(rule => collectAtomLeaves(rule.condition))
      .find(leaf => leaf.key === key)
  }

  describe('candle_pattern.minBars 真用户场景', () => {
    it('「BTC 连续跌三根 15 分钟 K 线后，bearish consecutive_body 买入」→ minBars 不被错抽为 15', () => {
      const patch = service.dispatch('BTC 连续跌三根 15 分钟 K 线后，bearish consecutive_body 买入')
      const candle = findConditionLeaf(patch, 'price.candle_pattern')
      // 「三」非数字 + 「15」后紧跟「分钟」（exclude 量词）→ minBars 不抽
      expect(candle?.params.minBars).toBeUndefined()
      // 仍能识别 pattern + direction
      expect(candle?.params.pattern).toBe('consecutive_body')
    })

    it('「bullish consecutive body 连续 3 根后做多」→ minBars=3（include「根」命中）', () => {
      const patch = service.dispatch('OKX 合约 BTCUSDT 15m bullish consecutive body 连续 3 根后做多，5% 止损')
      const candle = findConditionLeaf(patch, 'price.candle_pattern')
      expect(candle?.params.minBars).toBe(3)
    })

    it('utterance「检测到 连续 出现 50 进场」→ minBars 不抽（无 include 量词）', () => {
      // 50 后没有「根/条/个」量词，新机制下不抽（旧机制下会错抽为 50）
      const patch = service.dispatch('检测到 连续 出现 50 进场')
      const candle = findConditionLeaf(patch, 'price.candle_pattern')
      expect(candle?.params.minBars).toBeUndefined()
    })

    it('utterance「连续 5 根 30 分钟」→ minBars=5（include「根」命中 + exclude「分钟」剥离）', () => {
      // 5 紧跟「根」（include），「根」后剥离再看「30 分钟」也不命中 exclude 直接位置
      const patch = service.dispatch('OKX 合约 BTCUSDT 30 分钟 K 线 bearish consecutive body 连续 5 根后做空')
      const candle = findConditionLeaf(patch, 'price.candle_pattern')
      expect(candle?.params.minBars).toBe(5)
    })
  })

  describe('反模式守门 — 不允许在新 atom 上回到裸 \\d+ 抽取', () => {
    it('「价格 N 分钟 K 线」timeframe 数字永不被当成 minBars/lookbackBars', () => {
      // 同时含「15 分钟」与「30 分钟」两条 timeframe 表达，无任何 N 根/N 条 量词
      const patch = service.dispatch('OKX BTCUSDT 15 分钟 K 线收盘 consecutive_body bearish')
      const candle = findConditionLeaf(patch, 'price.candle_pattern')
      expect(candle?.params.minBars).toBeUndefined()
    })
  })
})
