import { AccountAiQuantStrategiesController } from './account-ai-quant-strategies.controller'

describe('accountAiQuantStrategiesController', () => {
  function createController() {
    const service = {
      listAccountStrategies: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      getAccountStrategyDetail: jest.fn().mockResolvedValue({ id: 'strategy-1' }),
      performAccountStrategyAction: jest.fn().mockResolvedValue({ id: 'strategy-1', status: 'running' }),
      deployAccountStrategy: jest.fn().mockResolvedValue({ id: 'strategy-1', status: 'draft' }),
      updateAccountStrategyExecutionLeverage: jest.fn().mockResolvedValue({ id: 'strategy-1', status: 'draft' }),
      deleteAccountStrategy: jest.fn().mockResolvedValue(undefined),
    }

    const controller = new AccountAiQuantStrategiesController(service as any)
    return { controller, service }
  }

  it('lists strategies for the authenticated user only', async () => {
    const { controller, service } = createController()

    await controller.list('user-1', 'Bearer token-1', {
      page: 2,
      limit: 10,
      status: 'running',
      subscribedOnly: true,
      excludeDraft: true,
    })

    expect(service.listAccountStrategies).toHaveBeenCalledWith('user-1', 'Bearer token-1', {
      page: 2,
      limit: 10,
      status: 'running',
      subscribedOnly: true,
      excludeDraft: true,
    })
  })

  it('forwards authenticated user id when executing strategy actions', async () => {
    const { controller, service } = createController()

    await controller.action('user-1', 'Bearer token-1', 'strategy-1', { action: 'run' })

    expect(service.performAccountStrategyAction).toHaveBeenCalledWith('user-1', 'Bearer token-1', 'strategy-1', {
      action: 'run',
    })
  })

  it('deploys strategies with backend-controlled user identity', async () => {
    const { controller, service } = createController()

    await controller.deploy('user-1', 'Bearer token-1', {
      name: 'My Strategy',
      deployRequestId: 'deploy-req-1',
      publishedSnapshotId: 'snapshot-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeAccountName: 'Binance Testnet',
      leverage: 3,
    })

    expect(service.deployAccountStrategy).toHaveBeenCalledWith('user-1', 'Bearer token-1', {
      name: 'My Strategy',
      deployRequestId: 'deploy-req-1',
      publishedSnapshotId: 'snapshot-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeAccountName: 'Binance Testnet',
      leverage: 3,
    })
  })

  it('updates execution leverage with backend-controlled user identity', async () => {
    const { controller, service } = createController()

    await controller.updateExecutionLeverage('user-1', 'Bearer token-1', 'strategy-1', {
      leverage: 5,
    })

    expect(service.updateAccountStrategyExecutionLeverage).toHaveBeenCalledWith(
      'user-1',
      'Bearer token-1',
      'strategy-1',
      { leverage: 5 },
    )
  })

  it('deletes strategy with backend-controlled user identity', async () => {
    const { controller, service } = createController()

    await controller.remove('user-1', 'Bearer token-1', 'strategy-1')

    expect(service.deleteAccountStrategy).toHaveBeenCalledWith('user-1', 'Bearer token-1', 'strategy-1')
  })
})
