import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const liquiditySweepUtterances = [
  {
    id: 'liquidity-sweep-zh-locked-prev-low',
    atomKey: 'liquidity.sweep',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，扫前低后 3 根内反弹做多，5% 止损，单笔 10%。',
    expected: {
      owner: 'trigger',
      key: 'liquidity.sweep',
      status: 'locked',
      params: { direction: 'bullish', reference: 'prev_low', reclaimBars: 3 },
      openSlotKeys: [],
    },
  },
  {
    id: 'liquidity-sweep-en-locked-prev-high',
    atomKey: 'liquidity.sweep',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, bearish liquidity sweep at prev high, reclaim within 3 bars, open short, 5% stop loss, position 10%.',
    expected: {
      owner: 'trigger',
      key: 'liquidity.sweep',
      status: 'locked',
      params: { direction: 'bearish', reference: 'prev_high' },
      openSlotKeys: [],
    },
  },
  {
    id: 'liquidity-sweep-mixed-locked-session-low',
    atomKey: 'liquidity.sweep',
    locale: 'mixed',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，session low 流动性扫荡 reclaim 5 根后做多，5% 止损。',
    expected: {
      owner: 'trigger',
      key: 'liquidity.sweep',
      status: 'locked',
      params: { direction: 'bullish', reference: 'session_low' },
      openSlotKeys: [],
    },
  },
  {
    id: 'liquidity-sweep-en-locked-session-high',
    atomKey: 'liquidity.sweep',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, bearish stop hunt at session high, reclaim within 3 bars, open short, 5% stop loss.',
    expected: {
      owner: 'trigger',
      key: 'liquidity.sweep',
      status: 'locked',
      params: { direction: 'bearish', reference: 'session_high' },
      openSlotKeys: [],
    },
  },
  {
    id: 'liquidity-sweep-zh-open-slot-missing-reference',
    atomKey: 'liquidity.sweep',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 15m，假突破后入场，5% 止损。',
    expected: {
      owner: 'trigger',
      key: 'liquidity.sweep',
      status: 'open',
      openSlotKeys: ['liquidity.sweep.direction', 'liquidity.sweep.reference'],
    },
  },
  {
    id: 'liquidity-sweep-en-open-slot-direction-conflict',
    atomKey: 'liquidity.sweep',
    locale: 'en',
    coverage: 'open-slot',
    utterance: 'OKX BTCUSDT 15m, bearish liquidity sweep at prev low, reclaim within 3 bars, open short, 5% stop loss.',
    expected: {
      owner: 'trigger',
      key: 'liquidity.sweep',
      status: 'open',
      params: { reference: 'prev_low' },
      openSlotKeys: ['liquidity.sweep.direction'],
    },
  },
] satisfies readonly UtteranceCorpusCase[]

