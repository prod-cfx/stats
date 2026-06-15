import type { TransactionHost } from '@nestjs-cls/transactional'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { ClsService } from 'nestjs-cls'
import { TransactionEventsService } from './transaction-events.service'

const AFTER_COMMIT_TASKS_KEY = 'AFTER_COMMIT_TASKS'

interface TxHostMock {
  isTransactionActive: jest.Mock<boolean, []>
  withTransaction: jest.Mock<Promise<unknown>, [() => Promise<unknown>]>
}

function createClsMock(active = true): ClsService {
  const store = new Map<string, unknown>()
  return {
    get: jest.fn((key: string) => store.get(key)),
    set: jest.fn((key: string, value: unknown) => {
      store.set(key, value)
    }),
    isActive: jest.fn(() => active),
    run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
  } as unknown as ClsService
}

function createTxHostMock(inTransaction: boolean): TxHostMock {
  return {
    isTransactionActive: jest.fn(() => inTransaction),
    withTransaction: jest.fn(async <T>(fn: () => Promise<T>) => fn()),
  }
}

function createService(cls: ClsService, txHost: TxHostMock): TransactionEventsService {
  return new TransactionEventsService(cls, txHost as unknown as TransactionHost<TransactionalAdapterPrisma>)
}

describe('transactionEventsService', () => {
  it('queues tasks without running them when a transaction is active', () => {
    const cls = createClsMock()
    const txHost = createTxHostMock(true)
    const service = createService(cls, txHost)
    const task = jest.fn()

    service.afterCommit(task)

    expect(task).not.toHaveBeenCalled()
    expect(cls.get(AFTER_COMMIT_TASKS_KEY)).toEqual([task])
  })

  it('throws and does not run tasks when CLS is active but no transaction exists', async () => {
    const cls = createClsMock()
    const txHost = createTxHostMock(false)
    const service = createService(cls, txHost)
    const task = jest.fn()

    expect(() => service.afterCommit(task)).toThrow(
      new Error(
        'afterCommit called without an active transaction; use @TransactionalWithAfterCommit() for HTTP handlers or withAfterCommit() for non-HTTP work',
      ),
    )
    await Promise.resolve()

    expect(task).not.toHaveBeenCalled()
  })

  it('throws and does not run tasks when called without CLS context', async () => {
    const cls = createClsMock(false)
    const txHost: TxHostMock = {
      isTransactionActive: jest.fn(() => {
        throw new Error('No CLS context')
      }),
      withTransaction: jest.fn(async <T>(fn: () => Promise<T>) => fn()),
    }
    const service = createService(cls, txHost)
    const task = jest.fn()

    expect(() => service.afterCommit(task)).toThrow('afterCommit called without CLS context')
    await Promise.resolve()

    expect(task).not.toHaveBeenCalled()
  })

  it('drains queued tasks after withAfterCommit finishes the wrapped function', async () => {
    const cls = createClsMock(false)
    const txHost = createTxHostMock(true)
    const service = createService(cls, txHost)
    const order: string[] = []
    const task = jest.fn(() => {
      order.push('task')
    })

    const result = await service.withAfterCommit(async () => {
      order.push('fn')
      service.afterCommit(task)
      order.push('after-queue')
      return 'ok'
    })

    expect(result).toBe('ok')
    expect(order).toEqual(['fn', 'after-queue', 'task'])
    expect(task).toHaveBeenCalledTimes(1)
    expect(cls.run).toHaveBeenCalledTimes(1)
    expect(txHost.withTransaction).toHaveBeenCalledTimes(1)
  })
})
