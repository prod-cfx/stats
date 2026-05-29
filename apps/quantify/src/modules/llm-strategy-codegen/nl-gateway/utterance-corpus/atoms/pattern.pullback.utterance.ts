import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const patternPullbackUtterances = [
  { id: 'pattern-pullback-breakout-hold-zh', atomKey: 'pattern.pullback', locale: 'zh', coverage: 'locked', utterance: '突破后回踩不破再买，单笔 10%。', expected: { owner: 'trigger', key: 'pattern.pullback', status: 'locked', params: { anchor: 'breakout_level', behavior: 'hold' }, openSlotKeys: [] } },
  { id: 'pattern-pullback-breakout-hold-en', atomKey: 'pattern.pullback', locale: 'en', coverage: 'locked', utterance: 'Pullback holds the breakout level then enter long with 10% position.', expected: { owner: 'trigger', key: 'pattern.pullback', status: 'locked', params: { anchor: 'breakout_level', behavior: 'hold' }, openSlotKeys: [] } },
  { id: 'pattern-pullback-ma20-hold-zh', atomKey: 'pattern.pullback', locale: 'zh', coverage: 'locked', utterance: '回踩 MA20 站稳后开多，仓位 10%。', expected: { owner: 'trigger', key: 'pattern.pullback', status: 'locked', params: { anchor: 'ma20', behavior: 'hold' }, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
