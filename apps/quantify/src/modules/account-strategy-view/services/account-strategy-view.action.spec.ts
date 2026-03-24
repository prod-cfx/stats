import { AccountStrategyAction } from '../dto/account-strategy-action.dto'
import { AccountStrategyViewService } from './account-strategy-view.service'

describe('accountStrategyViewService.performAction', () => {
  it('maps run action to strategy instance running status update', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-1',
        status: 'stopped',
        createdBy: 'user-1',
        strategyTemplateId: 'tpl-1',
        subscriptions: [{ userId: 'user-1', status: 'active' }],
      }),
    }

    const statsService = { calculateStats: jest.fn(), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn().mockResolvedValue({}) }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-1' } as any)

    await service.performAction('inst-1', { userId: 'user-1', action: AccountStrategyAction.RUN })

    expect(strategyInstancesService.updateInstance).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ status: 'running', updatedBy: 'user-1' }),
      'user-1',
    )
  })

  it('maps stop action to strategy instance stopped status update', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-1',
        status: 'running',
        createdBy: 'user-1',
        strategyTemplateId: 'tpl-1',
        subscriptions: [{ userId: 'user-1', status: 'active' }],
      }),
    }

    const statsService = { calculateStats: jest.fn(), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn().mockResolvedValue({}) }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-1' } as any)

    await service.performAction('inst-1', { userId: 'user-1', action: AccountStrategyAction.STOP })

    expect(strategyInstancesService.updateInstance).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ status: 'stopped', updatedBy: 'user-1' }),
      'user-1',
    )
  })

  it('rejects subscriber changing global strategy instance status', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-1',
        status: 'running',
        createdBy: 'owner-1',
        strategyTemplateId: 'tpl-1',
        subscriptions: [{ userId: 'user-2', status: 'active' }],
      }),
    }

    const statsService = { calculateStats: jest.fn(), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn().mockResolvedValue({}) }
    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )

    await expect(
      service.performAction('inst-1', { userId: 'user-2', action: AccountStrategyAction.STOP }),
    ).rejects.toThrow('account_strategy.owner_only')

    expect(strategyInstancesService.updateInstance).not.toHaveBeenCalled()
  })
})
