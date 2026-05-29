import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const indicatorSlopeUtterances = [
  { id: 'indicator-slope-ema-up-zh', atomKey: 'indicator.slope', locale: 'zh', coverage: 'locked', utterance: 'EMA20 斜率向上时开多，单笔 10%。', expected: { owner: 'trigger', key: 'indicator.slope', status: 'locked', params: { indicator: 'ema', period: 20, direction: 'up' }, openSlotKeys: [] } },
  { id: 'indicator-slope-ma-down-zh', atomKey: 'indicator.slope', locale: 'zh', coverage: 'locked', utterance: 'MA50 开始向下倾斜时平多。', expected: { owner: 'trigger', key: 'indicator.slope', status: 'locked', params: { indicator: 'ma', period: 50, direction: 'down' }, openSlotKeys: [] } },
  { id: 'indicator-slope-ema-up-en', atomKey: 'indicator.slope', locale: 'en', coverage: 'locked', utterance: 'Enter long when EMA20 slope turns up, position 10%.', expected: { owner: 'trigger', key: 'indicator.slope', status: 'locked', params: { indicator: 'ema', period: 20, direction: 'up' }, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
