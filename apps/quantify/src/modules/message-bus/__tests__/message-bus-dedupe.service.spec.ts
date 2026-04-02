import { MessageBusDedupeService } from '../runtime/message-bus-dedupe.service'

describe('messageBusDedupeService', () => {
  it('prefixes dedupe keys and delegates lock creation to cache', async () => {
    const cache = {
      setIfNotExists: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(undefined),
    } as any

    const service = new MessageBusDedupeService(cache)

    expect(service.buildKey('order-1')).toBe('bus:dedupe:order-1')
    await expect(service.setIfNotExists('bus:dedupe:order-1', 300)).resolves.toBe(true)
    expect(cache.setIfNotExists).toHaveBeenCalledWith('bus:dedupe:order-1', '1', 300)

    await service.del('bus:dedupe:order-1')
    expect(cache.del).toHaveBeenCalledWith('bus:dedupe:order-1')
  })
})
