import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const liquidationConditionUtterances = [
  { id: 'liquidation-long-notional-zh', atomKey: 'liquidation.condition', locale: 'zh', coverage: 'locked', utterance: '多头清算超过 100 万 USDT 后开空。', expected: { owner: 'trigger', key: 'liquidation.condition', status: 'locked', params: { side: 'long', notionalUsd: 1000000 }, openSlotKeys: [] } },
  { id: 'liquidation-short-spike-en', atomKey: 'liquidation.condition', locale: 'en', coverage: 'locked', utterance: 'Short liquidation spike above 1m confirms long entry.', expected: { owner: 'trigger', key: 'liquidation.condition', status: 'locked', params: { side: 'short', notionalUsd: 1000000 }, openSlotKeys: [] } },
  { id: 'liquidation-cascade-zh', atomKey: 'liquidation.condition', locale: 'zh', coverage: 'locked', utterance: '出现大额清算瀑布时暂停入场。', expected: { owner: 'trigger', key: 'liquidation.condition', status: 'locked', params: { side: 'both', notionalUsd: 1000000 }, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
