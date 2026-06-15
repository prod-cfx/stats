import { Prisma } from '@/prisma/prisma.types'
import { DataPullTaskRepository } from './data-pull-task.repository'

function createTxHost() {
  return {
    tx: {
      dataPullTask: {
        create: jest.fn(),
        update: jest.fn(),
      },
    },
  }
}

describe('DataPullTaskRepository', () => {
  it('stores domain exception reason when marking task failed', async () => {
    const txHost = createTxHost()
    const repo = new DataPullTaskRepository(txHost as never)
    const error = {
      message: 'polymarket.client_error',
      args: {
        reason: 'Gamma API request failed: status=429 Too Many Requests url=https://gamma-api.polymarket.com/markets body=rate limited',
      },
      stack: 'DomainException: polymarket.client_error\n    at fetchJson',
    }

    await repo.markFailed(7, new Date('2026-06-04T09:49:00.000Z'), error)

    expect(txHost.tx.dataPullTask.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastError: expect.stringContaining('Gamma API request failed: status=429 Too Many Requests'),
      }),
    }))
  })

  it('writes explicit JSON null when creating a task with null meta', async () => {
    const txHost = createTxHost()
    const repo = new DataPullTaskRepository(txHost as never)

    await repo.createTask({ key: 'example.kline_1m', name: 'Example', meta: null })

    expect(txHost.tx.dataPullTask.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        meta: Prisma.DbNull,
      }),
    }))
  })

  it('writes explicit JSON null when updating a task with null meta', async () => {
    const txHost = createTxHost()
    const repo = new DataPullTaskRepository(txHost as never)

    await repo.updateTask(7, { meta: null })

    expect(txHost.tx.dataPullTask.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        meta: Prisma.DbNull,
      }),
    }))
  })
})
