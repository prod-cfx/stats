import { ServiceUnavailableException } from '@nestjs/common'
import { RedisService } from '@/common/services/redis.service'
import { HealthRepository } from './health.repository'
import { HealthService } from './health.service'
import { ShutdownStateService } from './shutdown-state.service'

interface HealthRepositoryProbe {
  checkDatabaseReady: jest.Mock<Promise<void>, []>
}

interface RedisProbe {
  ping: jest.Mock<Promise<string>, []>
}

function createSubject() {
  const healthRepository: HealthRepositoryProbe = {
    checkDatabaseReady: jest.fn(async () => undefined),
  }
  const redisClient: RedisProbe = {
    ping: jest.fn(async () => 'PONG'),
  }
  const redis = {
    getClient: jest.fn(() => redisClient),
  }
  const shutdownState = new ShutdownStateService()
  const service = new HealthService(
    healthRepository as unknown as HealthRepository,
    redis as unknown as RedisService,
    shutdownState,
  )

  return { healthRepository, redis, redisClient, service, shutdownState }
}

describe('HealthService', () => {
  it('keeps the compatibility health payload unchanged', () => {
    const { service } = createSubject()

    const payload = service.getHealth()

    expect(payload).toMatchObject({ service: 'backend', status: 'ok' })
    expect(typeof payload.timestamp).toBe('string')
  })

  it('returns live health without touching Prisma or Redis', () => {
    const { healthRepository, redis, service } = createSubject()

    const payload = service.getLiveHealth()

    expect(payload).toMatchObject({ service: 'backend', status: 'ok' })
    expect(healthRepository.checkDatabaseReady).not.toHaveBeenCalled()
    expect(redis.getClient).not.toHaveBeenCalled()
  })

  it('returns ready health after repository and Redis probes succeed', async () => {
    const { healthRepository, redisClient, service } = createSubject()

    await expect(service.getReadyHealth()).resolves.toMatchObject({ service: 'backend', status: 'ok' })
    expect(healthRepository.checkDatabaseReady).toHaveBeenCalledTimes(1)
    expect(redisClient.ping).toHaveBeenCalledTimes(1)
  })

  it('rejects readiness when repository probe fails', async () => {
    const { healthRepository, service } = createSubject()
    healthRepository.checkDatabaseReady.mockRejectedValueOnce(new Error('db down'))

    await expect(service.getReadyHealth()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('rejects readiness when Redis probe fails', async () => {
    const { redisClient, service } = createSubject()
    redisClient.ping.mockRejectedValueOnce(new Error('redis down'))

    await expect(service.getReadyHealth()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('rejects readiness during shutdown while live health still avoids dependencies', async () => {
    const { healthRepository, redis, service, shutdownState } = createSubject()
    shutdownState.beforeApplicationShutdown()

    await expect(service.getReadyHealth()).rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(service.getLiveHealth()).toMatchObject({ service: 'backend', status: 'ok' })
    expect(healthRepository.checkDatabaseReady).not.toHaveBeenCalled()
    expect(redis.getClient).not.toHaveBeenCalled()
  })
})
