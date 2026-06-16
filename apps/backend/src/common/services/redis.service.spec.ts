import type { LoggerService } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { EnvService } from './env.service'
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

function createEnvService(values: {
  isTest?: boolean
  isE2E?: boolean
  shouldSkipRedisConnect?: boolean
  useMockData?: boolean
} = {}) {
  return {
    isTest: jest.fn(() => values.isTest ?? false),
    isE2E: jest.fn(() => values.isE2E ?? false),
    shouldSkipRedisConnect: jest.fn(() => values.shouldSkipRedisConnect ?? false),
    getBoolean: jest.fn((key: string, defaultValue?: boolean) => {
      if (key === 'USE_MOCK_DATA') return values.useMockData ?? defaultValue
      return defaultValue
    }),
  } as unknown as EnvService
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
    const envService = createEnvService()

    expect(() => new RedisService(configService, logger, envService)).toThrow()
    expect(Redis).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      '[RedisService] constructor: failed to create redis client',
      expect.any(Error),
    )
  })

  it('does not enable mock mode when USE_MOCK_DATA is the string false', () => {
    const configService = createConfigService({
      'app.appEnv': 'production',
      'redis.url': undefined,
      USE_MOCK_DATA: 'false',
    })
    const logger = createLogger()
    const envService = createEnvService({ useMockData: false })

    expect(() => new RedisService(configService, logger, envService)).toThrow()
    expect(Redis).not.toHaveBeenCalled()
    expect(jest.mocked(envService.getBoolean)).toHaveBeenCalledWith('USE_MOCK_DATA', false)
  })

  it('uses the mock client in test when REDIS_URL is missing', () => {
    const configService = createConfigService({
      'app.appEnv': 'test',
      'redis.url': undefined,
      USE_MOCK_DATA: false,
    })
    const logger = createLogger()
    const envService = createEnvService({ isTest: true })

    const service = new RedisService(configService, logger, envService)

    expect(service.isReady()).toBe(true)
    expect(Redis).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('[RedisService] mock redis mode is enabled, using mock redis client')
    expect(jest.mocked(envService.isTest)).toHaveBeenCalled()
  })

  it('supports ping on the mock client for readiness probes', async () => {
    const configService = createConfigService({
      'app.appEnv': 'test',
      'redis.url': undefined,
      USE_MOCK_DATA: false,
    })
    const logger = createLogger()
    const envService = createEnvService({ isTest: true })

    const service = new RedisService(configService, logger, envService)

    await expect(service.getClient().ping()).resolves.toBe('PONG')
  })

  it('uses the mock client when EnvService says redis connect should be skipped', () => {
    const configService = createConfigService({
      'app.appEnv': 'production',
      'redis.url': 'redis://localhost:6379/0',
      USE_MOCK_DATA: false,
    })
    const logger = createLogger()
    const envService = createEnvService({ shouldSkipRedisConnect: true })

    const service = new RedisService(configService, logger, envService)

    expect(service.isReady()).toBe(true)
    expect(Redis).not.toHaveBeenCalled()
    expect(jest.mocked(envService.shouldSkipRedisConnect)).toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('[RedisService] mock redis mode is enabled, using mock redis client')
  })

  it('creates a real client from REDIS_URL outside mock mode', () => {
    const configService = createConfigService({
      'app.appEnv': 'production',
      'redis.url': 'redis://localhost:6379/0',
      USE_MOCK_DATA: false,
    })
    const logger = createLogger()
    const envService = createEnvService()

    const service = new RedisService(configService, logger, envService)

    expect(service.isReady()).toBe(true)
    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379/0')
  })

  it('quits the mock client on application shutdown and allows repeated shutdown', async () => {
    const configService = createConfigService({
      'app.appEnv': 'test',
      'redis.url': undefined,
      USE_MOCK_DATA: false,
    })
    const logger = createLogger()
    const envService = createEnvService({ isTest: true })
    const service = new RedisService(configService, logger, envService)
    const client = service.getClient()
    const quit = jest.spyOn(client, 'quit')

    await expect(service.onApplicationShutdown()).resolves.toBeUndefined()
    await expect(service.onApplicationShutdown()).resolves.toBeUndefined()

    expect(quit).toHaveBeenCalledTimes(2)
  })
})
