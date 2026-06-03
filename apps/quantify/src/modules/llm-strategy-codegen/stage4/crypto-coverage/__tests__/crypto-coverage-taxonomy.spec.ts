import { classifyCryptoIntentScope, getCryptoAtomWeight, isBCoverageSupportedStatus } from '../crypto-coverage-taxonomy'

describe('crypto coverage taxonomy', () => {
  it('classifies latency and cross-exchange infrastructure as C-scope', () => {
    expect(classifyCryptoIntentScope('跨所搬砖，自动从 Binance 划转资金到 OKX')).toEqual({
      scope: 'C',
      matchedPhrase: '跨所搬砖',
      publicReason: 'cross_exchange_fund_transfer_arbitrage_out_of_scope',
    })
    expect(classifyCryptoIntentScope('做延迟敏感 order queue alpha')).toEqual({
      scope: 'C',
      matchedPhrase: 'order queue alpha',
      publicReason: 'latency_sensitive_order_queue_alpha_out_of_scope',
    })
    expect(classifyCryptoIntentScope('三角套利自动撮合三条腿')).toEqual({
      scope: 'C',
      matchedPhrase: '三角套利',
      publicReason: 'triangular_arbitrage_matching_out_of_scope',
    })
    expect(classifyCryptoIntentScope('高频做市，毫秒级撤单挂单')).toEqual({
      scope: 'C',
      matchedPhrase: 'HFT',
      publicReason: 'hft_market_making_out_of_scope',
    })
  })

  it('keeps normal semi-professional crypto strategies in B-scope', () => {
    expect(classifyCryptoIntentScope('BTC 15m EMA20 上穿 EMA50 开多，3% 止损').scope).toBe('B')
    expect(classifyCryptoIntentScope('盘口买卖量不平衡超过 2 倍，只挂 post-only 限价单').scope).toBe('B')
  })

  it('weights known B atoms and defaults unknown B atoms conservatively', () => {
    expect(getCryptoAtomWeight('action.open_long')).toBe(3)
    expect(getCryptoAtomWeight('orderbook.imbalance')).toBe(3)
    expect(getCryptoAtomWeight('orderbook.spread_condition')).toBe(2)
  })

  it('does not allow blocked or unsupported statuses to count as supported', () => {
    expect(isBCoverageSupportedStatus('supported_executable')).toBe(true)
    expect(isBCoverageSupportedStatus('blocked_by_missing_ir_emit')).toBe(false)
    expect(isBCoverageSupportedStatus('unsupported_out_of_scope')).toBe(false)
  })
})
