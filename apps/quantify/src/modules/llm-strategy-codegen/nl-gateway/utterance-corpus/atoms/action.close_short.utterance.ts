import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const actionCloseShortUtterances = [
  {
    id: 'action-close-short-zh-locked-close-short',
    atomKey: 'action.close_short',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，EMA20 上方平空。',
    expected: {
      owner: 'action',
      key: 'action.close_short',
      status: 'locked',
      params: {},
      openSlotKeys: [],
    },
  },
  {
    id: 'action-close-short-zh-locked-exit-short',
    atomKey: 'action.close_short',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 ETHUSDT 1h，RSI 低于 30 时平空。',
    expected: {
      owner: 'action',
      key: 'action.close_short',
      status: 'locked',
      params: {},
      openSlotKeys: [],
    },
  },
  {
    id: 'action-close-short-en-locked-close-short',
    atomKey: 'action.close_short',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, EMA20 cross above EMA50, close short.',
    expected: {
      owner: 'action',
      key: 'action.close_short',
      status: 'locked',
      params: {},
      openSlotKeys: [],
    },
  },
] satisfies readonly UtteranceCorpusCase[]
