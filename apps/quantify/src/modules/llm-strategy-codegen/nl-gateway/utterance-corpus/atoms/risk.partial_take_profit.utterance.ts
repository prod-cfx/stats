import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const riskPartialTakeProfitUtterances = [
  {
    id: 'risk-partial-take-profit-zh-locked-three-tier',
    atomKey: 'risk.partial_take_profit',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，单笔 10%，第一档 +5% 减 30%，第二档 +10% 减 30%，第三档 +15% 减 40%。',
    expected: {
      owner: 'risk',
      key: 'risk.partial_take_profit',
      status: 'locked',
      openSlotKeys: [],
    },
  },
  {
    id: 'risk-partial-take-profit-en-locked-three-tier',
    atomKey: 'risk.partial_take_profit',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, scale out 30% at +5%, 30% at +10%, full exit at +15%, MA20 cross above MA50, position 10%.',
    expected: {
      owner: 'risk',
      key: 'risk.partial_take_profit',
      status: 'locked',
      openSlotKeys: [],
    },
  },
  {
    id: 'risk-partial-take-profit-zh-open-slot-missing-tiers',
    atomKey: 'risk.partial_take_profit',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 15m，设置分批止盈，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'risk',
      key: 'risk.partial_take_profit',
      status: 'open',
      openSlotKeys: ['risk.partial_take_profit.tiers'],
    },
  },
  {
    id: 'risk-partial-take-profit-zh-locked-single-tier',
    atomKey: 'risk.partial_take_profit',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，盈利 5% 平一半，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'risk',
      key: 'risk.partial_take_profit',
      status: 'locked',
      openSlotKeys: [],
    },
  },
  {
    id: 'risk-partial-take-profit-zh-locked-two-tier-user-real',
    atomKey: 'risk.partial_take_profit',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，单笔 10%，盈利 5% 平 50%，盈利 10% 平 50%。',
    expected: {
      owner: 'risk',
      key: 'risk.partial_take_profit',
      status: 'locked',
      openSlotKeys: [],
    },
  },
] satisfies readonly UtteranceCorpusCase[]

