import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const actionOpenLongUtterances = [
  {
    id: 'action-open-long-zh-locked-ema-above',
    atomKey: 'action.open_long',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，EMA20 上方开多。',
    expected: {
      owner: 'action',
      key: 'action.open_long',
      status: 'locked',
      params: {},
      openSlotKeys: [],
    },
  },
  {
    id: 'action-open-long-zh-locked-do-long',
    atomKey: 'action.open_long',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 ETHUSDT 1h，RSI 低于 30 时做多。',
    expected: {
      owner: 'action',
      key: 'action.open_long',
      status: 'locked',
      params: {},
      openSlotKeys: [],
    },
  },
  {
    id: 'action-open-long-en-locked-open-long',
    atomKey: 'action.open_long',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, EMA20 cross above EMA50, open long.',
    expected: {
      owner: 'action',
      key: 'action.open_long',
      status: 'locked',
      params: {},
      openSlotKeys: [],
    },
  },
] satisfies readonly UtteranceCorpusCase[]
