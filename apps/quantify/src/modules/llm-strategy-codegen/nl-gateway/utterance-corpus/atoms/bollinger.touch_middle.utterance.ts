import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const bollingerTouchMiddleUtterances = [
  { id: 'bollinger-touch-middle-zh-exit', atomKey: 'bollinger.touch_middle' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '布林带20周期2倍标准差回到中轨平仓，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.detect.indicator_boundary' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'bollinger-touch-middle-zh-retest', atomKey: 'bollinger.touch_middle' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '布林带20周期2倍标准差触及中轨卖出，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.detect.indicator_boundary' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'bollinger-touch-middle-mixed', atomKey: 'bollinger.touch_middle' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 15m，布林带20周期2倍标准差触及中轨 close long，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.detect.indicator_boundary' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
