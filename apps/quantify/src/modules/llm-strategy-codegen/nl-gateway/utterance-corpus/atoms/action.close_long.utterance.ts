import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const actionCloseLongUtterances = [
  {
    id: 'action-close-long-zh-locked-close-long',
    atomKey: 'action.close_long',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，EMA20 下方平多。',
    expected: {
      owner: 'action',
      key: 'action.close_long',
      status: 'locked',
      params: {},
      openSlotKeys: [],
    },
  },
  {
    id: 'action-close-long-zh-locked-exit-multi',
    atomKey: 'action.close_long',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 ETHUSDT 1h，RSI 高于 70 时平多。',
    expected: {
      owner: 'action',
      key: 'action.close_long',
      status: 'locked',
      params: {},
      openSlotKeys: [],
    },
  },
  {
    id: 'action-close-long-en-locked-close-long',
    atomKey: 'action.close_long',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, EMA20 cross below EMA50, close long.',
    expected: {
      owner: 'action',
      key: 'action.close_long',
      status: 'locked',
      params: {},
      openSlotKeys: [],
    },
  },
] satisfies readonly UtteranceCorpusCase[]
