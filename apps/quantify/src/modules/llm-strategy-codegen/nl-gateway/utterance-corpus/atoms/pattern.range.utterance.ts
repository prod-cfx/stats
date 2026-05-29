import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const patternRangeUtterances = [
  { id: 'pattern-range-inside-grid-zh', atomKey: 'pattern.range', locale: 'zh', coverage: 'locked', utterance: '价格在震荡区间内只做网格。', expected: { owner: 'trigger', key: 'pattern.range', status: 'locked', params: { mode: 'inside_range', lowerRole: 'range_low', upperRole: 'range_high' }, openSlotKeys: [] } },
  { id: 'pattern-range-bound-en', atomKey: 'pattern.range', locale: 'en', coverage: 'locked', utterance: 'Range-bound between support and resistance, trade only inside the range.', expected: { owner: 'trigger', key: 'pattern.range', status: 'locked', params: { mode: 'inside_range', lowerRole: 'range_low', upperRole: 'range_high' }, openSlotKeys: [] } },
  { id: 'pattern-range-lower-edge-zh', atomKey: 'pattern.range', locale: 'zh', coverage: 'locked', utterance: '价格回到区间下沿附近开多，仓位 10%。', expected: { owner: 'trigger', key: 'pattern.range', status: 'locked', params: { mode: 'near_lower', lowerRole: 'range_low', upperRole: 'range_high' }, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
