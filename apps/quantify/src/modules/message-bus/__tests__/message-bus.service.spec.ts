import { MessageBusService } from '../message-bus.service'

describe('MessageBusService', () => {
  it('publishes a Bull job with the topic as the job name', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    } as any
    const cache = {
      get: jest.fn(),
      set: jest.fn(),
    } as any
    const config = {
      get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
        if (key === 'messageBus.backoffDelayMs') return 1000
        if (key === 'messageBus.defaultMode') return 'volatile'
        return fallback
      }),
    } as any

    const service = new MessageBusService(queue, cache, config)

    await expect(
      service.publish('test.topic', 'test.type', { ok: true }, { dedupeKey: 'a' }),
    ).resolves.toBe('job-1')

    expect(queue.add).toHaveBeenCalledWith(
      'test.topic',
      expect.objectContaining({
        topic: 'test.topic',
        type: 'test.type',
        data: { ok: true },
      }),
      expect.objectContaining({
        jobId: 'test.topic:a',
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }),
    )
  })

  it('waits for a handshake completion marker', async () => {
    jest.useFakeTimers()

    const queue = {
      add: jest.fn().mockResolvedValue({ id: 'job-2' }),
    } as any
    const cache = {
      get: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ status: 'ok' }),
      set: jest.fn(),
    } as any
    const config = {
      get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
        if (key === 'messageBus.backoffDelayMs') return 1000
        if (key === 'messageBus.defaultMode') return 'volatile'
        return fallback
      }),
    } as any

    const service = new MessageBusService(queue, cache, config)

    const promise = service.publishAndWait(
      'test.topic',
      'test.type',
      { ok: true },
      { pollIntervalMs: 50, timeoutMs: 1000 },
    )

    await jest.advanceTimersByTimeAsync(60)

    await expect(promise).resolves.toMatchObject({
      jobId: 'job-2',
      result: { status: 'ok' },
    })

    jest.useRealTimers()
  })
})
