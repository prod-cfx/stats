import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const volumeThresholdUtterances = [
  {
    id: 'volume-threshold-zh-locked-base-volume',
    atomKey: 'volume.threshold',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，成交量大于 1000 时开多，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'volume.threshold',
      status: 'locked',
      params: { operator: 'GT', metric: 'base_volume', value: 1000 },
      openSlotKeys: [],
    },
  },
  {
    id: 'volume-threshold-en-locked-gte',
    atomKey: 'volume.threshold',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, enter long when volume gte 2000, position 10%.',
    expected: {
      owner: 'trigger',
      key: 'volume.threshold',
      status: 'locked',
      params: { operator: 'GTE', metric: 'base_volume', value: 2000 },
      openSlotKeys: [],
    },
  },
  {
    id: 'volume-threshold-zh-open-slot-missing-value',
    atomKey: 'volume.threshold',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 15m，成交量超过阈值时允许入场，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'volume.threshold',
      status: 'open',
      params: { operator: 'GT', metric: 'base_volume' },
      openSlotKeys: ['volume.threshold.value'],
    },
  },
  {
    id: 'volume-threshold-en-open-slot-missing-value',
    atomKey: 'volume.threshold',
    locale: 'en',
    coverage: 'open-slot',
    utterance: 'OKX BTCUSDT 15m, enter long when volume exceeds threshold, position 10%.',
    expected: {
      owner: 'trigger',
      key: 'volume.threshold',
      status: 'open',
      params: { operator: 'GT', metric: 'base_volume' },
      openSlotKeys: ['volume.threshold.value'],
    },
  },
  {
    id: 'volume-threshold-zh-open-slot-unit',
    atomKey: 'volume.threshold',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX BTCUSDT 15m，成交量大于 1 亿 USDT 才开仓，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'volume.threshold',
      status: 'open',
      params: { operator: 'GT', metric: 'base_volume' },
      openSlotKeys: ['volume.threshold.value'],
    },
  },
] satisfies readonly UtteranceCorpusCase[]

