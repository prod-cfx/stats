import type { TransactionHost } from '@nestjs-cls/transactional'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import { Logger } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'
import { SettingsRepository } from './settings.repository'

function createRepository(systemSetting: {
  findMany?: jest.Mock
  findUnique?: jest.Mock
}) {
  return new SettingsRepository({
    tx: {
      systemSetting: {
        findMany: systemSetting.findMany ?? jest.fn(),
        findUnique: systemSetting.findUnique ?? jest.fn(),
      },
    },
  } as unknown as TransactionHost<TransactionalAdapterPrisma>)
}

describe('SettingsRepository', () => {
  const originalUseMockData = process.env.USE_MOCK_DATA

  beforeEach(() => {
    process.env.USE_MOCK_DATA = 'false'
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    if (originalUseMockData === undefined) {
      delete process.env.USE_MOCK_DATA
    } else {
      process.env.USE_MOCK_DATA = originalUseMockData
    }
    jest.restoreAllMocks()
  })

  it('throws a domain exception when findAll database access fails outside mock mode', async () => {
    const repository = createRepository({ findMany: jest.fn().mockRejectedValue(new Error('db down')) })

    await expect(repository.findAll()).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      args: { detail: 'DatabaseError' },
    } satisfies Partial<DomainException>)
  })

  it('throws a domain exception when findByKey database access fails outside mock mode', async () => {
    const repository = createRepository({ findUnique: jest.fn().mockRejectedValue(new Error('db down')) })

    await expect(repository.findByKey('app.name')).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      args: { detail: 'DatabaseError' },
    } satisfies Partial<DomainException>)
  })

  it('keeps returning mock settings when mock mode is enabled', async () => {
    process.env.USE_MOCK_DATA = 'true'
    const repository = createRepository({ findMany: jest.fn() })

    await expect(repository.findAll()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'app.name' }),
    ]))
  })

  it('keeps returning a mock setting by key when mock mode is enabled', async () => {
    process.env.USE_MOCK_DATA = 'true'
    const findUnique = jest.fn()
    const repository = createRepository({ findUnique })

    await expect(repository.findByKey('app.name')).resolves.toEqual(expect.objectContaining({
      key: 'app.name',
      value: 'Coinflux Mock',
    }))
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('keeps returning null for unknown mock settings when mock mode is enabled', async () => {
    process.env.USE_MOCK_DATA = 'true'
    const findUnique = jest.fn()
    const repository = createRepository({ findUnique })

    await expect(repository.findByKey('missing.setting')).resolves.toBeNull()
    expect(findUnique).not.toHaveBeenCalled()
  })
})
