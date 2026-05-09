import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const positionHasPositionUtterances = [
  {
    id: 'position-has-position-zh-locked-long',
    atomKey: 'position.has_position',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，已有多头仓位时不再开多，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'position.has_position',
      status: 'locked',
      params: { sideScope: 'long' },
      openSlotKeys: [],
    },
  },
  {
    id: 'position-has-position-zh-locked-short',
    atomKey: 'position.has_position',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，已有空头仓位时不再开空，MA20 下穿 MA50 开空，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'position.has_position',
      status: 'locked',
      params: { sideScope: 'short' },
      openSlotKeys: [],
    },
  },
  {
    id: 'position-has-position-en-locked-both',
    atomKey: 'position.has_position',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, block entries when in position, MA20 cross above MA50, position 10%.',
    expected: {
      owner: 'trigger',
      key: 'position.has_position',
      status: 'locked',
      params: { sideScope: 'both' },
      openSlotKeys: [],
    },
  },
  {
    id: 'position-has-position-zh-missing-default-both',
    atomKey: 'position.has_position',
    locale: 'zh',
    coverage: 'missing-default',
    utterance: 'OKX 合约 BTCUSDT 15m，已有仓位时不再开仓，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'position.has_position',
      status: 'locked',
      params: { sideScope: 'both' },
      openSlotKeys: [],
    },
  },
] satisfies readonly UtteranceCorpusCase[]

