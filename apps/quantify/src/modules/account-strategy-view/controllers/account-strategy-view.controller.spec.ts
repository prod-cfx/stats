import { AccountStrategyAction } from '../dto/account-strategy-action.dto'
import { AccountStrategyViewController } from './account-strategy-view.controller'

describe('accountStrategyViewController', () => {
  it('uses header user id when query userId is missing', async () => {
    const service = {
      listStrategies: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    }
    const controller = new AccountStrategyViewController(service as any)

    await controller.list({ page: 1, limit: 20, status: 'running' } as any, 'user-1')

    expect(service.listStrategies).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    )
  })

  it('rejects mismatched header user id and requested user id', async () => {
    const service = {
      getStrategyDetail: jest.fn(),
    }
    const controller = new AccountStrategyViewController(service as any)

    await expect(
      controller.detail('inst-1', 'user-2', 'user-1'),
    ).rejects.toThrow('userId does not match authenticated principal')
  })

  it('injects resolved userId into action dto', async () => {
    const service = {
      performAction: jest.fn().mockResolvedValue({ id: 'inst-1' }),
    }
    const controller = new AccountStrategyViewController(service as any)

    await controller.action(
      'inst-1',
      { action: AccountStrategyAction.RUN } as any,
      'user-1',
    )

    expect(service.performAction).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ userId: 'user-1', action: AccountStrategyAction.RUN }),
    )
  })

  it('injects resolved userId into deploy dto', async () => {
    const service = {
      deployStrategy: jest.fn().mockResolvedValue({ id: 'inst-1' }),
    }
    const controller = new AccountStrategyViewController(service as any)

    await controller.deploy(
      {
        name: '测试策略',
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '5m/15m',
        positionPct: 10,
      } as any,
      'user-1',
    )

    expect(service.deployStrategy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        exchange: 'binance',
      }),
    )
  })
})
