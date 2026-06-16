import { ServiceUnavailableException } from '@nestjs/common'
import { RedisService } from '@/common/services/redis.service'
import { PrismaService } from '@/prisma/prisma.service'
import { HealthService } from './health.service'
import { ShutdownStateService } from './shutdown-state.service'

interface PrismaProbe {
  $queryRaw: jest.Mock<Promise<unknown>, [TemplateStringsArray, ...unknown[]]>
}

interface RedisProbe {
  ping: jest.Mock<Promise<string>, []>
}

function createSubject() {
  const prisma: PrismaProbe = {
    $queryRaw: jest.fn<Promise<unknown>, [TemplateStringsArray, ...unknown[]]>(async () => [{ ok: 1 }]),
  }
  const redisClient: RedisProbe = {
    ping: jest.fn(async () => 'PONG'),
  }
  const redis = {
    getClient: jest.fn(() => redisClient),
  }
  const shutdownState = new ShutdownStateService()
  const service = new HealthService(
    prisma as unknown as PrismaService,
    redis as unknown as RedisService,
    shutdownState,
  )

  return { prisma, redis, redisClient, service, shutdownState }
}

describe('HealthService', () => {
  it('keeps the compatibility health payload unchanged', () => {
    const { service } = createSubject()

    const payload = service.getHealth()

    expect(payload).toMatchObject({ service: 'backend', status: 'ok' })
    expect(typeof payload.timestamp).toBe('string')
  })

  it('returns live health without touching Prisma or Redis', () => {
    const { prisma, redis, service } = createSubject()

    const payload = service.getLiveHealth()

    expect(payload).toMatchObject({ service: 'backend', status: 'ok' })
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
    expect(redis.getClient).not.toHaveBeenCalled()
  })

  it('returns ready health after Prisma and Redis probes succeed', async () => {
    const { prisma, redisClient, service } = createSubject()

    await expect(service.getReadyHealth()).resolves.toMatchObject({ service: 'backend', status: 'ok' })
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(redisClient.ping).toHaveBeenCalledTimes(1)
  })

  it('rejects readiness when Prisma probe fails', async () => {
    const { prisma, service } = createSubject()
    prisma.$queryRaw.mockRejectedValueOnce(new Error('db down'))

    await expect(service.getReadyHealth()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('rejects readiness when Redis probe fails', async () => {
    const { redisClient, service } = createSubject()
    redisClient.ping.mockRejectedValueOnce(new Error('redis down'))

    await expect(service.getReadyHealth()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('rejects readiness during shutdown while live health still avoids dependencies', async () => {
    const { prisma, redis, service, shutdownState } = createSubject()
    shutdownState.beforeApplicationShutdown()

    await expect(service.getReadyHealth()).rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(service.getLiveHealth()).toMatchObject({ service: 'backend', status: 'ok' })
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
    expect(redis.getClient).not.toHaveBeenCalled()
  })
})
