import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const priceDetectIndicatorBoundaryUtterances = [
  { id: 'price-detect-indicator-boundary-channel-lower', atomKey: 'price.detect.indicator_boundary' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '价格碰通道下沿买，固定仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.detect.indicator_boundary' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-detect-indicator-boundary-generic-upper', atomKey: 'price.detect.indicator_boundary' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: '突破上边界开空，回到中线平仓，单笔 10%。', expected: { owner: 'trigger' as const, key: 'price.detect.indicator_boundary' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'price-detect-indicator-boundary-mixed', atomKey: 'price.detect.indicator_boundary' as const, locale: 'mixed' as const, coverage: 'locked' as const, utterance: 'BTCUSDT 15m，price touch channel lower 后 enter long，仓位 10%。', expected: { owner: 'trigger' as const, key: 'price.detect.indicator_boundary' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
