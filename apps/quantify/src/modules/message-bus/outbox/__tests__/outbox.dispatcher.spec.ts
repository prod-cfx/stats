import { OutboxDispatcher } from '../outbox.dispatcher'

describe('OutboxDispatcher', () => {
  const message = {
    id: BigInt(1),
    topic: 'test.topic',
    type: 'test.type',
    payload: { ok: true },
    correlationId: 'cid-1',
    dedupeKey: 'dedupe-1',
    priority: 1,
  }

  function createDispatcher() {
    const config = {
      get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          'messageBus.outbox': {
            pollIntervalMs: 0,
            batchSize: 20,
            maxAttempts: 6,
            lockTimeoutSec: 30,
            baseBackoffMs: 1000,
            publishAttempts: 3,
          },
          'messageBus.outbox.candidateFactor': 3,
          'messageBus.outbox.retainDays': 7,
        }
        return values[key] ?? fallback
      }),
    } as any
    const repo = {
      claimBatch: jest.fn().mockResolvedValue([]),
      markSent: jest.fn().mockResolvedValue(undefined),
      incrementAttemptsAndGet: jest.fn().mockResolvedValue(1),
      markRetry: jest.fn().mockResolvedValue(undefined),
      markDead: jest.fn().mockResolvedValue(undefined),
      purgeSentOlderThan: jest.fn().mockResolvedValue(0),
    } as any
    const bus = {
      publish: jest.fn().mockResolvedValue('job-1'),
    } as any
    const env = {
      getString: jest.fn().mockReturnValue('test-host'),
    } as any
    const metrics = {
      incOutboxClaimed: jest.fn(),
      incOutboxSent: jest.fn(),
      incOutboxRetry: jest.fn(),
      incOutboxDead: jest.fn(),
      recordOutboxDispatchLatency: jest.fn(),
    } as any

    return {
      dispatcher: new OutboxDispatcher(config, repo, bus, env, metrics),
      repo,
      bus,
      metrics,
    }
  }

  it('marks a message dead after max attempts', async () => {
    const { dispatcher, repo, bus, metrics } = createDispatcher()
    repo.claimBatch.mockResolvedValue([message])
    bus.publish.mockRejectedValue(new Error('boom'))
    repo.incrementAttemptsAndGet.mockResolvedValue(6)

    await dispatcher.tick()

    expect(repo.markDead).toHaveBeenCalledWith(message.id, 'boom')
    expect(repo.markRetry).not.toHaveBeenCalled()
    expect(metrics.incOutboxDead).toHaveBeenCalledWith(1)
  })

  it('records dispatch latency for successful sends', async () => {
    const { dispatcher, repo, bus, metrics } = createDispatcher()
    repo.claimBatch.mockResolvedValue([message])
    bus.publish.mockResolvedValue('job-1')

    await dispatcher.tick()

    expect(bus.publish).toHaveBeenCalledWith(
      'test.topic',
      'test.type',
      { ok: true },
      expect.objectContaining({
        correlationId: 'cid-1',
        dedupeKey: 'dedupe-1',
        priority: 1,
        attempts: 3,
      }),
    )
    expect(repo.markSent).toHaveBeenCalledWith(message.id)
    expect(metrics.incOutboxSent).toHaveBeenCalledWith(1)
    expect(metrics.recordOutboxDispatchLatency).toHaveBeenCalled()
  })
})
