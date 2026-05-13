/**
 * Issue #1296 — MARKET_TYPE_PERP_RE / MARKET_TYPE_SPOT_RE 前缀误命中回归
 *
 * 来源：PR #1295 review critic B 历史遗留 H3。
 * 原 regex `/合约|永续|perp/i` 没有单词边界，'perpetual swap' / 'perplexity'
 * 等英文长词的 'perp' 前缀被错误命中，导致 marketType 假阳性。
 *
 * Refs: #1296, #1279
 */
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

describe('issue #1296 — market type regex 边界守门', () => {
  const dispatcher = new GenericSeedDispatcher()

  it('"perpetual swap kline" 不应被识别为 marketType=perp', () => {
    const patch = dispatcher.dispatch('perpetual swap kline')
    expect(patch.contextSlots?.marketType).not.toBe('perp')
  })

  it('"perplexity test query" 不应被识别为 marketType=perp', () => {
    const patch = dispatcher.dispatch('perplexity test query')
    expect(patch.contextSlots?.marketType).not.toBe('perp')
  })

  it('"perp BTCUSDT 1h" 应正确识别为 marketType=perp', () => {
    const patch = dispatcher.dispatch('perp BTCUSDT 1h')
    expect(patch.contextSlots?.marketType).toBe('perp')
  })

  it('"BTCUSDT 永续 1h" 应正确识别为 marketType=perp（中文）', () => {
    const patch = dispatcher.dispatch('BTCUSDT 永续 1h')
    expect(patch.contextSlots?.marketType).toBe('perp')
  })

  it('"spotlight on BTC" 不应被识别为 marketType=spot', () => {
    const patch = dispatcher.dispatch('spotlight on BTC')
    expect(patch.contextSlots?.marketType).not.toBe('spot')
  })

  it('"BTCUSDT spot 4h" 应正确识别为 marketType=spot', () => {
    const patch = dispatcher.dispatch('BTCUSDT spot 4h')
    expect(patch.contextSlots?.marketType).toBe('spot')
  })
})
