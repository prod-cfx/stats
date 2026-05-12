import { RateLimiterRegistry } from './rate-limiter-registry.service'

describe('rateLimiterRegistry', () => {
  let now = 0

  beforeEach(() => {
    now = 0
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('queues requests that exceed the configured bucket capacity', async () => {
    const sleeps: number[] = []
    const registry = new RateLimiterRegistry(async (ms) => {
      sleeps.push(ms)
      now += ms
    })

    await registry.acquire('okx:test-api-key:private', {
      capacity: 2,
      refillIntervalMs: 2_000,
    })
    await registry.acquire('okx:test-api-key:private', {
      capacity: 2,
      refillIntervalMs: 2_000,
    })
    await registry.acquire('okx:test-api-key:private', {
      capacity: 2,
      refillIntervalMs: 2_000,
    })

    expect(sleeps).toEqual([2_000])
    expect(registry.getQueueDepth('okx:test-api-key:private')).toBe(0)
  })

  it('tracks queued waiters per bucket while acquisitions are pending', async () => {
    let releaseSleep: (() => void) | undefined
    const registry = new RateLimiterRegistry(() => {
      return new Promise<void>((resolve) => {
        releaseSleep = () => {
          now += 2_000
          resolve()
        }
      })
    })

    await registry.acquire('okx:public', {
      capacity: 1,
      refillIntervalMs: 2_000,
    })

    const waiting = registry.acquire('okx:public', {
      capacity: 1,
      refillIntervalMs: 2_000,
    })

    await Promise.resolve()

    expect(registry.getQueueDepth('okx:public')).toBe(1)

    releaseSleep?.()
    await waiting

    expect(registry.getQueueDepth('okx:public')).toBe(0)
  })

  it('publishes OKX token bucket queue depth metrics', async () => {
    const metrics = { setOkxTokenBucketQueueDepth: jest.fn() }
    const registry = new RateLimiterRegistry(async () => undefined, metrics)

    await registry.acquire('okx:public', {
      capacity: 1,
      refillIntervalMs: 2_000,
    })

    expect(metrics.setOkxTokenBucketQueueDepth).toHaveBeenCalledWith('okx:public', 1)
    expect(metrics.setOkxTokenBucketQueueDepth).toHaveBeenLastCalledWith('okx:public', 0)
  })

  it('rejects weights that exceed bucket capacity', () => {
    const registry = new RateLimiterRegistry(async () => undefined)

    expect(() => registry.acquire('okx:public', {
      capacity: 1,
      refillIntervalMs: 2_000,
      weight: 2,
    })).toThrow('Token bucket weight (2) exceeds capacity (1) for okx:public')
  })
})
