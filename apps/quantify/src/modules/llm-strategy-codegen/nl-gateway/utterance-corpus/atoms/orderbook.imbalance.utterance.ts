import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const orderbookImbalanceUtterances = [
  { id: 'orderbook-imbalance-bid-ratio-zh', atomKey: 'orderbook.imbalance', locale: 'zh', coverage: 'locked', utterance: '买盘深度是卖盘 1.5 倍时开多。', expected: { owner: 'trigger', key: 'orderbook.imbalance', status: 'locked', params: { side: 'bid', ratio: 1.5 }, openSlotKeys: [] } },
  { id: 'orderbook-imbalance-bid-percent-en', atomKey: 'orderbook.imbalance', locale: 'en', coverage: 'locked', utterance: 'Orderbook bid imbalance above 60 percent enters long.', expected: { owner: 'trigger', key: 'orderbook.imbalance', status: 'locked', params: { side: 'bid', ratio: 1.5 }, openSlotKeys: [] } },
  { id: 'orderbook-imbalance-bullish-zh', atomKey: 'orderbook.imbalance', locale: 'zh', coverage: 'locked', utterance: '盘口买卖失衡偏多时只做多。', expected: { owner: 'trigger', key: 'orderbook.imbalance', status: 'locked', params: { side: 'bid', ratio: 1.2 }, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
