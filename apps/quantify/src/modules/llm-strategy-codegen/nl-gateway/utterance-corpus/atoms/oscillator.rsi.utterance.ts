import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const oscillatorRsiUtterances = [
  // ---- INVARIANT-A 守门：RSI 低于阈值作为入场条件（DCA 触发），phase 必须为 entry ----
  {
    id: 'oscillator-rsi-zh-locked-entry-dca-trigger',
    atomKey: 'oscillator.rsi_lte' as const,
    locale: 'zh' as const,
    coverage: 'locked' as const,
    // "低于 30 开始 DCA" → isDcaEntryClause=true → entry/long；rsi_lte value=30
    utterance: 'OKX 现货 BTCUSDT 1h，RSI14 低于 30 开始 DCA，价格每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT，RSI14 高于 70 卖出。',
    expected: {
      owner: 'trigger' as const,
      key: 'oscillator.rsi_lte' as const,
      status: 'locked' as const,
      params: { period: 14, value: 30, thresholdRole: 'lower_threshold' },
      openSlotKeys: [],
    },
  },
  {
    id: 'oscillator-rsi-zh-locked-entry-low-rsi-buy',
    atomKey: 'oscillator.rsi_lte' as const,
    locale: 'zh' as const,
    coverage: 'locked' as const,
    // "低于 25 买入" → resolveTradeIntent("买入")=entry/long → rsi_lte value=25
    utterance: 'OKX 现货 ETHUSDT 4h，RSI14 低于 25 买入，单笔 200 USDT，最多 3 次，总投入不超过 600 USDT，RSI14 高于 70 卖出。',
    expected: {
      owner: 'trigger' as const,
      key: 'oscillator.rsi_lte' as const,
      status: 'locked' as const,
      params: { period: 14, value: 25, thresholdRole: 'lower_threshold' },
      openSlotKeys: [],
    },
  },
  {
    id: 'oscillator-rsi-mixed-locked-entry-dca-add',
    atomKey: 'oscillator.rsi_lte' as const,
    locale: 'mixed' as const,
    coverage: 'locked' as const,
    // "低于 20 补仓" → isDcaEntryClause=true → entry/long；rsi_lte value=20
    utterance: 'Binance BTCUSDT 1h，RSI 低于 20 补仓，每次 100 USDT，最多 5 次，RSI 高于 65 卖出。',
    expected: {
      owner: 'trigger' as const,
      key: 'oscillator.rsi_lte' as const,
      status: 'locked' as const,
      params: { value: 20, thresholdRole: 'lower_threshold' },
      openSlotKeys: [],
    },
  },
  {
    id: 'oscillator-rsi-en-locked-entry-long',
    atomKey: 'oscillator.rsi_lte' as const,
    locale: 'en' as const,
    coverage: 'locked' as const,
    // "below 30" → "低于|小于|下方" in EN path → rsi_lte; "enter long" → entry/long
    utterance: 'OKX BTCUSDT 1h, enter long when RSI14 is below 30, position 10%, stop loss 3%.',
    expected: {
      owner: 'trigger' as const,
      key: 'oscillator.rsi_lte' as const,
      status: 'locked' as const,
      params: { period: 14, value: 30, thresholdRole: 'lower_threshold' },
      openSlotKeys: [],
    },
  },
] satisfies readonly UtteranceCorpusCase[]
