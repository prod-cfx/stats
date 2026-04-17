import { AccountStrategyViewRepository } from './account-strategy-view.repository'

function createTxHost(tx: any) {
  return {
    tx,
    withTransaction: jest.fn(async (callback: () => Promise<any>) => callback()),
  }
}

describe('accountStrategyViewRepository deploy request persistence boundary', () => {
  it('creates deploy requests with the root prisma client instead of transactional tx context', async () => {
    const tx = {
      deployRequest: {
        create: jest.fn().mockRejectedValue(new Error('expired transaction')),
      },
    }
    const prisma = {
      deployRequest: {
        create: jest.fn().mockResolvedValue({ id: 'req-1', status: 'PROCESSING' }),
      },
    }

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, prisma as any)

    await expect(repo.createDeployRequestProcessing('user-1', 'deploy-req-1', 'hash-1')).resolves.toEqual({
      id: 'req-1',
      status: 'PROCESSING',
    })

    expect(prisma.deployRequest.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        deployRequestId: 'deploy-req-1',
        payloadHash: 'hash-1',
        status: 'PROCESSING',
      },
    })
    expect(tx.deployRequest.create).not.toHaveBeenCalled()
  })

  it('marks deploy requests failed with the root prisma client instead of transactional tx context', async () => {
    const tx = {
      deployRequest: {
        update: jest.fn().mockRejectedValue(new Error('expired transaction')),
      },
    }
    const prisma = {
      deployRequest: {
        update: jest.fn().mockResolvedValue({ id: 'req-1', status: 'FAILED' }),
      },
    }

    const repo = new AccountStrategyViewRepository(createTxHost(tx) as any, prisma as any)

    await expect(repo.markDeployRequestFailed('req-1', 'INTERNAL_SERVER_ERROR', 'boom')).resolves.toEqual({
      id: 'req-1',
      status: 'FAILED',
    })

    expect(prisma.deployRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: {
        status: 'FAILED',
        errorCode: 'INTERNAL_SERVER_ERROR',
        errorMessage: 'boom',
      },
    })
    expect(tx.deployRequest.update).not.toHaveBeenCalled()
  })
})
