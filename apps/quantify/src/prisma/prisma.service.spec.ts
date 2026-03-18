import { PrismaService } from './prisma.service'

describe('PrismaService.runInTransaction', () => {
  function createService(options?: {
    existingTx?: unknown
    isActive?: boolean
  }) {
    const tx = { tx: 'client' }
    const cls = {
      get: jest.fn(() => options?.existingTx),
      set: jest.fn(),
      run: jest.fn((callback: () => unknown) => callback()),
      isActive: jest.fn(() => options?.isActive ?? false),
    }
    const envService = {
      isTest: jest.fn(() => false),
      isE2E: jest.fn(() => true),
    }
    const baseClient = {
      $transaction: jest.fn(async (callback: (innerTx: typeof tx) => Promise<unknown>) => callback(tx)),
    }
    const service = Object.create(PrismaService.prototype) as PrismaService
    ;(service as any).cls = cls
    ;(service as any).envService = envService
    ;(service as any).extendedClient = baseClient
    ;(service as any).logger = { error: jest.fn() }

    return { service, cls, tx, baseClient }
  }

  it('creates a CLS context before opening a transaction when none is active', async () => {
    const { service, cls, tx, baseClient } = createService({ isActive: false })

    const result = await service.runInTransaction(async innerTx => innerTx)

    expect(cls.run).toHaveBeenCalledTimes(1)
    expect(baseClient.$transaction).toHaveBeenCalledTimes(1)
    expect(cls.set).toHaveBeenNthCalledWith(1, 'PRISMA_TRANSACTION', tx)
    expect(cls.set).toHaveBeenLastCalledWith('PRISMA_TRANSACTION', null)
    expect(result).toBe(tx)
  })

  it('reuses the current transaction when one already exists', async () => {
    const existingTx = { tx: 'existing' }
    const { service, cls, baseClient } = createService({ existingTx, isActive: true })

    const result = await service.runInTransaction(async innerTx => innerTx)

    expect(cls.run).not.toHaveBeenCalled()
    expect(baseClient.$transaction).not.toHaveBeenCalled()
    expect(result).toBe(existingTx)
  })
})
