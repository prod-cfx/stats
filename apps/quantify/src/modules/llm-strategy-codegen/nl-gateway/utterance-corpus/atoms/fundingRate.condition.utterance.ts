import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const fundingRateConditionUtterances = [
  { id: 'funding-rate-gt-zh', atomKey: 'fundingRate.condition', locale: 'zh', coverage: 'locked', utterance: '资金费率大于 0.01% 时不开多。', expected: { owner: 'trigger', key: 'fundingRate.condition', status: 'locked', params: { operator: 'GT', valuePct: 0.01 }, openSlotKeys: [] } },
  { id: 'funding-rate-positive-short-en', atomKey: 'fundingRate.condition', locale: 'en', coverage: 'locked', utterance: 'Enter short when funding rate is positive and high.', expected: { owner: 'trigger', key: 'fundingRate.condition', status: 'locked', params: { operator: 'GT', valuePct: 0 }, openSlotKeys: [] } },
  { id: 'funding-rate-negative-long-en', atomKey: 'fundingRate.condition', locale: 'en', coverage: 'locked', utterance: 'Funding below negative 0.02 percent then open long.', expected: { owner: 'trigger', key: 'fundingRate.condition', status: 'locked', params: { operator: 'LT', valuePct: -0.02 }, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
