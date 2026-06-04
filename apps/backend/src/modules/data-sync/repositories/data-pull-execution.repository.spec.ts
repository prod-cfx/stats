import { DataPullExecutionRepository } from './data-pull-execution.repository'

function createTxHost() {
  return {
    tx: {
      dataPullExecution: {
        update: jest.fn(),
      },
    },
  }
}

describe('DataPullExecutionRepository', () => {
  it('stores domain exception reason when marking execution failed', async () => {
    const txHost = createTxHost()
    const repo = new DataPullExecutionRepository(txHost as never)
    const error = {
      message: 'polymarket.client_error',
      args: {
        reason: 'Gamma API request failed: status=403 Forbidden url=https://gamma-api.polymarket.com/markets body=blocked',
      },
      stack: 'DomainException: polymarket.client_error\n    at fetchJson',
    }

    await repo.markFailed(196672, new Date('2026-06-04T09:49:00.000Z'), error)

    expect(txHost.tx.dataPullExecution.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        errorMessage: expect.stringContaining('Gamma API request failed: status=403 Forbidden'),
      }),
    }))
  })
})
