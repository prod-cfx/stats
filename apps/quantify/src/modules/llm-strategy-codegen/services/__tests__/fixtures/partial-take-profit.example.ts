/**
 * Canonical example fixtures for risk.partial_take_profit atom.
 *
 * Used by the parity spec and any downstream test that needs a
 * fully-populated partial-take-profit semantic state.
 */

export const PARTIAL_TP_3_TIER_UTTERANCE =
  'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，单笔 10%，第一档 +5% 减 30%，第二档 +10% 减 30%，第三档 +15% 减 40%。'

export const PARTIAL_TP_SINGLE_TIER_UTTERANCE =
  'OKX 合约 BTCUSDT 15m，盈利 5% 平一半，MA20 上穿 MA50 开多，单笔 10%。'

export const PARTIAL_TP_EN_3_TIER_UTTERANCE =
  'OKX BTCUSDT 15m, scale out 30% at +5%, 30% at +10%, full exit at +15%, MA20 cross above MA50, position 10%.'

export const PARTIAL_TP_MISSING_UTTERANCE =
  'OKX 合约 BTCUSDT 15m，设置分批止盈，MA20 上穿 MA50 开多，单笔 10%。'

/** Canonical 3-tier tiers fixture (matches builder output) */
export const THREE_TIERS = [
  { trigger: { kind: 'pnl_pct' as const, threshold: 5 }, reduceRatio: 0.3 },
  { trigger: { kind: 'pnl_pct' as const, threshold: 10 }, reduceRatio: 0.3 },
  { trigger: { kind: 'pnl_pct' as const, threshold: 15 }, reduceRatio: 0.4 },
]

export const MEMORY_KEY = 'partial_tp_long_abc'
