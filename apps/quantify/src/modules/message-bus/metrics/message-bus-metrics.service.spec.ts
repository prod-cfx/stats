import { MessageBusMetricsService } from './message-bus-metrics.service'

describe('messageBusMetricsService', () => {
  it('includes empty OKX metrics in snapshots by default', () => {
    const service = new MessageBusMetricsService()

    expect(service.getSnapshot().okx).toEqual({
      rateLimitTotal: {},
      tokenBucketQueueDepth: {},
    })
  })

  it('tracks OKX rate-limit totals by code', () => {
    const service = new MessageBusMetricsService()

    service.incOkxRateLimit('50011')
    service.incOkxRateLimit('50011')
    service.incOkxRateLimit('429')

    expect(service.getSnapshot().okx.rateLimitTotal).toEqual({
      429: 1,
      50011: 2,
    })
  })

  it('tracks OKX token bucket queue depth by account', () => {
    const service = new MessageBusMetricsService()

    service.setOkxTokenBucketQueueDepth('account-a', 3)
    service.setOkxTokenBucketQueueDepth('account-b', 0)

    expect(service.getSnapshot().okx.tokenBucketQueueDepth).toEqual({
      'account-a': 3,
      'account-b': 0,
    })
  })

  it('resets OKX metrics with outbox metrics', () => {
    const service = new MessageBusMetricsService()

    service.incOkxRateLimit('50011')
    service.setOkxTokenBucketQueueDepth('account-a', 3)

    service.reset()

    expect(service.getSnapshot().okx).toEqual({
      rateLimitTotal: {},
      tokenBucketQueueDepth: {},
    })
  })
})
