import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const openInterestConditionUtterances = [
  { id: 'open-interest-up-breakout-zh', atomKey: 'openInterest.condition', locale: 'zh', coverage: 'locked', utterance: '持仓量 1 小时增加 5% 且价格突破时开多。', expected: { owner: 'trigger', key: 'openInterest.condition', status: 'locked', params: { direction: 'up', changePct: 5, window: '1h' }, openSlotKeys: [] } },
  { id: 'open-interest-rising-en', atomKey: 'openInterest.condition', locale: 'en', coverage: 'locked', utterance: 'Open interest rising more than 5 percent confirms entry.', expected: { owner: 'trigger', key: 'openInterest.condition', status: 'locked', params: { direction: 'up', changePct: 5 }, openSlotKeys: [] } },
  { id: 'open-interest-down-zh', atomKey: 'openInterest.condition', locale: 'zh', coverage: 'locked', utterance: 'OI 快速下降时不要开仓。', expected: { owner: 'trigger', key: 'openInterest.condition', status: 'locked', params: { direction: 'down' }, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
