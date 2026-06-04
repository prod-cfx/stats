import { DataPullTaskRepository } from './data-pull-task.repository'

function createTxHost() {
  return {
    tx: {
      dataPullTask: {
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
})
