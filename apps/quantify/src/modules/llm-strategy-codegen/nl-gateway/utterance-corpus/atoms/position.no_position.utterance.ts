import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const positionNoPositionUtterances = [
  {
    id: 'position-no-position-zh-locked-long',
    atomKey: 'position.no_position',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，无多头仓位才开多，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'position.no_position',
      status: 'locked',
      params: { sideScope: 'long' },
      openSlotKeys: [],
    },
  },
  {
    id: 'position-no-position-zh-locked-short',
    atomKey: 'position.no_position',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，无空头仓位时开空，MA20 下穿 MA50 开空，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'position.no_position',
      status: 'locked',
      params: { sideScope: 'short' },
      openSlotKeys: [],
    },
  },
  {
    id: 'position-no-position-en-locked-both',
    atomKey: 'position.no_position',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, enter only when flat, MA20 cross above MA50, position 10%.',
    expected: {
      owner: 'trigger',
      key: 'position.no_position',
      status: 'locked',
      params: { sideScope: 'both' },
      openSlotKeys: [],
    },
  },
  {
    id: 'position-no-position-zh-missing-default-both',
    atomKey: 'position.no_position',
    locale: 'zh',
    coverage: 'missing-default',
    utterance: 'OKX 合约 BTCUSDT 15m，无仓位时才开仓，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'position.no_position',
      status: 'locked',
      params: { sideScope: 'both' },
      openSlotKeys: [],
    },
  },
] satisfies readonly UtteranceCorpusCase[]

