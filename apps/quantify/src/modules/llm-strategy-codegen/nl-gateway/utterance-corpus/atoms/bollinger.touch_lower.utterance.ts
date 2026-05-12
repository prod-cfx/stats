import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const bollingerTouchLowerUtterances = [
  { id: 'bollinger-touch-lower-zh-entry', atomKey: 'bollinger.touch_lower' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '布林带20周期2倍标准差触及下轨买入，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.detect.indicator_boundary' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'bollinger-touch-lower-zh-long', atomKey: 'bollinger.touch_lower' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '布林带20周期2倍标准差跌破下轨做多，单笔 10%。', expected: { owner: 'trigger' as const, key: 'price.detect.indicator_boundary' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'bollinger-touch-lower-mixed', atomKey: 'bollinger.touch_lower' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'ETHUSDT 30m，布林带20周期2倍标准差触及下轨 enter long，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.detect.indicator_boundary' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
