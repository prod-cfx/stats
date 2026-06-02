import { buildSyntheticWebhookEventStreamsFromScript } from './ai-quant-page-backtest'

describe('buildSyntheticWebhookEventStreamsFromScript', () => {
  it('builds replayable webhook event streams from compiled externalSignal predicates', () => {
    const script = `
      const EXPR_POOL = [{"id":"expr_1","nodeType":"predicate","payload":{"kind":"externalSignal","params":{"provider":"webhook","signalId":"tradingview_buy","sourceFeedId":"webhook.tradingview_buy","ttlMs":60000}}}] as const
    `

    expect(buildSyntheticWebhookEventStreamsFromScript(script, 1710000000000)).toEqual({
      'webhook.tradingview_buy': [{
        id: 'synthetic-webhook-tradingview-buy-1710000000000',
        ts: 1710000000000,
        payload: { signalId: 'tradingview_buy' },
      }],
    })
  })
})
