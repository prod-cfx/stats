import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const volatilityAtrThresholdUtterances = [
  {
    id: 'volatility-atr-threshold-zh-locked-gt',
    atomKey: 'volatility.atr_threshold',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，ATR14 大于 50 才开仓，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'volatility.atr_threshold',
      status: 'locked',
      params: { operator: 'GT', period: 14, threshold: 50, thresholdUnit: 'quote_currency' },
      openSlotKeys: [],
    },
  },
  {
    id: 'volatility-atr-threshold-en-locked-lt',
    atomKey: 'volatility.atr_threshold',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, block entries when ATR14 less than 100, position 10%.',
    expected: {
      owner: 'trigger',
      key: 'volatility.atr_threshold',
      status: 'locked',
      params: { operator: 'LT', period: 14, threshold: 100, thresholdUnit: 'quote_currency' },
      openSlotKeys: [],
    },
  },
  {
    id: 'volatility-atr-threshold-zh-open-slot-missing-threshold',
    atomKey: 'volatility.atr_threshold',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 15m，ATR 过滤入场，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'volatility.atr_threshold',
      status: 'open',
      params: { operator: 'GT', thresholdUnit: 'quote_currency' },
      openSlotKeys: ['volatility.atr_threshold.period', 'volatility.atr_threshold.threshold'],
    },
  },
  {
    id: 'volatility-atr-threshold-en-open-slot-missing-threshold',
    atomKey: 'volatility.atr_threshold',
    locale: 'en',
    coverage: 'open-slot',
    utterance: 'OKX BTCUSDT 15m, filter by ATR threshold, position 10%.',
    expected: {
      owner: 'trigger',
      key: 'volatility.atr_threshold',
      status: 'open',
      params: { operator: 'LTE', thresholdUnit: 'quote_currency' },
      openSlotKeys: ['volatility.atr_threshold.period', 'volatility.atr_threshold.threshold'],
    },
  },
  {
    id: 'volatility-atr-threshold-zh-open-slot-unit',
    atomKey: 'volatility.atr_threshold',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX BTCUSDT 15m，ATR14 大于 1 万时允许入场，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'volatility.atr_threshold',
      status: 'open',
      params: { operator: 'GT', period: 14, thresholdUnit: 'quote_currency' },
      openSlotKeys: ['volatility.atr_threshold.threshold'],
    },
  },
] satisfies readonly UtteranceCorpusCase[]
