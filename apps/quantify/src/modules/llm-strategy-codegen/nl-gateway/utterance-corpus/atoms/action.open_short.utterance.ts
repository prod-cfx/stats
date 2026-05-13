import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const actionOpenShortUtterances = [
  {
    id: 'action-open-short-zh-locked-ema-below',
    atomKey: 'action.open_short',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，EMA20 下方开空。',
    expected: {
      owner: 'action',
      key: 'action.open_short',
      status: 'locked',
      params: {},
      openSlotKeys: [],
    },
  },
  {
    id: 'action-open-short-zh-locked-do-short',
    atomKey: 'action.open_short',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 ETHUSDT 1h，RSI 高于 70 时做空。',
    expected: {
      owner: 'action',
      key: 'action.open_short',
      status: 'locked',
      params: {},
      openSlotKeys: [],
    },
  },
  {
    id: 'action-open-short-en-locked-open-short',
    atomKey: 'action.open_short',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, EMA20 cross below EMA50, open short.',
    expected: {
      owner: 'action',
      key: 'action.open_short',
      status: 'locked',
      params: {},
      openSlotKeys: [],
    },
  },
] satisfies readonly UtteranceCorpusCase[]
