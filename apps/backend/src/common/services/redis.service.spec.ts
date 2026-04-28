import type { LoggerService } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { RedisService } from './redis.service'

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn(),
  status: 'ready',
})))

function createConfigService(values: Record<string, string | boolean | undefined>) {
  return {
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  } as unknown as ConfigService
}

function createLogger(): LoggerService {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }
}

describe('RedisService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws in production when REDIS_URL is missing', () => {
    const configService = createConfigService({
      'app.appEnv': 'production',
      'redis.url': undefined,
      USE_MOCK_DATA: false,
    })
    const logger = createLogger()

    expect(() => new RedisService(configService, logger)).toThrow()
    expect(Redis).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      '[RedisService] constructor: failed to create redis client',
      expect.any(Error),
    )
  })

  it('uses the mock client in test when REDIS_URL is missing', () => {
    const configService = createConfigService({
      'app.appEnv': 'test',
      'redis.url': undefined,
      USE_MOCK_DATA: false,
    })
    const logger = createLogger()

    const service = new RedisService(configService, logger)

    expect(service.isReady()).toBe(true)
    expect(Redis).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('[RedisService] mock redis mode is enabled, using mock redis client')
  })

  it('creates a real client from REDIS_URL outside mock mode', () => {
    const configService = createConfigService({
      'app.appEnv': 'production',
      'redis.url': 'redis://localhost:6379/0',
      USE_MOCK_DATA: false,
    })
    const logger = createLogger()

    const service = new RedisService(configService, logger)

    expect(service.isReady()).toBe(true)
    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379/0')
  })
})
