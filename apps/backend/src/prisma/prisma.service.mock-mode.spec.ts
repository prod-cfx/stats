import type { ConfigService } from '@nestjs/config'
import type { EnvService } from '../common/services/env.service'
import { PrismaPg } from '@prisma/adapter-pg'
import { restoreProcessEnv, snapshotProcessEnv } from '../common/env/env.accessor'
import { PrismaService } from './prisma.service'

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation((options: { connectionString: string }) => ({ options })),
}))

jest.mock('@/prisma/prisma.types', () => ({
  PrismaClient: class {
    $connect = jest.fn()
    $disconnect = jest.fn()
    $extends = jest.fn(() => this)

    constructor(readonly options: unknown) {}
  },
}))

const ENV_KEYS = ['APP_ENV', 'NODE_ENV', 'USE_MOCK_DATA', 'SKIP_PRISMA_CONNECT', 'DATABASE_URL'] as const

function createConfigService(): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: string) => process.env[key] ?? defaultValue),
  } as unknown as ConfigService
}

function createEnvService(): EnvService {
  return {
    getString: jest.fn((key: string) => process.env[key]),
  } as unknown as EnvService
}

describe('PrismaService mock mode gating', () => {
  const originalEnv = snapshotProcessEnv(ENV_KEYS)

  beforeEach(() => {
    jest.clearAllMocks()
    restoreProcessEnv(originalEnv)
    process.env.APP_ENV = 'production'
    process.env.NODE_ENV = 'production'
    process.env.USE_MOCK_DATA = 'true'
    delete process.env.SKIP_PRISMA_CONNECT
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/app'
  })

  afterAll(() => {
    restoreProcessEnv(originalEnv)
  })

  it('connects to the configured database in production even when USE_MOCK_DATA is true', async () => {
    const service = new PrismaService(createConfigService(), createEnvService(), { monitoredTables: [] })

    expect(PrismaPg).toHaveBeenCalledWith({ connectionString: 'postgresql://user:pass@localhost:5432/app' })

    await service.onModuleInit()
    await service.beforeApplicationShutdown()

    expect(service.$connect).toHaveBeenCalledTimes(1)
    expect(service.$disconnect).toHaveBeenCalledTimes(1)
  })
})
