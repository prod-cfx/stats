import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const actionReversePositionUtterances = [
  {
    id: 'action-reverse-position-zh-locked-long-to-short',
    atomKey: 'action.reverse_position',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，MA20 下穿 MA50，信号反转时由多翻空，反手，沿用当前仓位。',
    expected: {
      owner: 'action',
      key: 'action.reverse_position',
      status: 'locked',
      params: { fromSide: 'long', toSide: 'short', sizingSource: 'current_position' },
      openSlotKeys: [],
    },
  },
  {
    id: 'action-reverse-position-zh-locked-short-to-long',
    atomKey: 'action.reverse_position',
    locale: 'zh',
    coverage: 'locked',
    utterance: '平空做多反手',
    expected: {
      owner: 'action',
      key: 'action.reverse_position',
      status: 'locked',
      params: { fromSide: 'short', toSide: 'long', sameBarPolicy: 'next_bar_only' },
      openSlotKeys: [],
    },
  },
  {
    id: 'action-reverse-position-en-locked-same-bar',
    atomKey: 'action.reverse_position',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, MA20 cross below MA50, reverse position, 允许同一根 K 线反手。',
    expected: {
      owner: 'action',
      key: 'action.reverse_position',
      status: 'locked',
      params: { sameBarPolicy: 'allow' },
      openSlotKeys: [],
    },
  },
  {
    id: 'action-reverse-position-zh-missing-defaults',
    atomKey: 'action.reverse_position',
    locale: 'zh',
    coverage: 'missing-default',
    utterance: 'OKX 合约 BTCUSDT 15m，MA20 下穿 MA50 止损，反手。',
    expected: {
      owner: 'action',
      key: 'action.reverse_position',
      status: 'locked',
      params: { fromSide: 'long', toSide: 'short', sameBarPolicy: 'next_bar_only', sizingSource: 'fixed' },
      openSlotKeys: [],
    },
  },
  {
    id: 'action-reverse-position-zh-locked-alias-flip',
    atomKey: 'action.reverse_position',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，MA20 下穿 MA50，翻仓。',
    expected: {
      owner: 'action',
      key: 'action.reverse_position',
      status: 'locked',
      params: { fromSide: 'long', toSide: 'short' },
      openSlotKeys: [],
    },
  },
  {
    id: 'action-reverse-position-zh-locked-alias-reverse-open',
    atomKey: 'action.reverse_position',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，MA20 下穿 MA50，反向开仓。',
    expected: {
      owner: 'action',
      key: 'action.reverse_position',
      status: 'locked',
      params: { fromSide: 'long', toSide: 'short' },
      openSlotKeys: [],
    },
  },
] satisfies readonly UtteranceCorpusCase[]

