import { AccountStrategyAction } from '../dto/account-strategy-action.dto'
import { AccountStrategyViewService } from './account-strategy-view.service'

const defaultRow = {
  id: 'inst-1',
  status: 'running',
  createdBy: 'user-1',
  strategyTemplateId: 'tpl-1',
  params: {
    exchange: 'okx',
    symbol: 'BTCUSDT',
    marketType: 'spot',
  },
  strategyTemplate: {
    defaultParams: {},
  },
  subscriptions: [{
    userId: 'user-1',
    status: 'active',
    exchangeAccount: { id: 'exchange-account-1', exchangeId: 'okx' },
  }],
}

function createActionTestContext(
  rowOverrides: Record<string, unknown> = {},
) {
  const repo = {
    findStrategyForUser: jest.fn().mockResolvedValue({
      ...defaultRow,
      ...rowOverrides,
    }),
    findUserStrategyAccount: jest.fn().mockResolvedValue({ id: 'account-1' }),
    loadOpenPositionsForLiquidation: jest.fn().mockResolvedValue([]),
    deleteStrategyForUser: jest.fn().mockResolvedValue(undefined),
  }

  const statsService = { calculateStats: jest.fn(), calculateBatchStats: jest.fn() }
  const strategyInstancesService = { updateInstance: jest.fn().mockResolvedValue({}) }
  const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
  const tradingService = {
    getOpenOrders: jest.fn().mockResolvedValue([]),
    cancelOrder: jest.fn().mockResolvedValue({ status: 'canceled' }),
  }
  const positionsService = { closePosition: jest.fn().mockResolvedValue({ success: true }) }
  const service = new AccountStrategyViewService(
    repo as any,
    statsService as any,
    strategyInstancesService as any,
    marketDataIngestionService as any,
    undefined,
    undefined,
    tradingService as any,
    undefined,
    undefined,
    positionsService as any,
  )
  service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-1' } as any)

  return {
    repo,
    strategyInstancesService,
    tradingService,
    positionsService,
    service,
  }
}

describe('accountStrategyViewService.performAction', () => {
  it('maps run action to strategy instance running status update', async () => {
    const { service, strategyInstancesService } = createActionTestContext({ status: 'stopped' })

    await service.performAction('inst-1', { userId: 'user-1', action: AccountStrategyAction.RUN })

    expect(strategyInstancesService.updateInstance).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ status: 'running', updatedBy: 'user-1' }),
      'user-1',
    )
  })

  it('maps stop action to strategy instance stopped status update', async () => {
    const { service, strategyInstancesService } = createActionTestContext()

    await service.performAction('inst-1', { userId: 'user-1', action: AccountStrategyAction.STOP })

    expect(strategyInstancesService.updateInstance).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ status: 'stopped', updatedBy: 'user-1' }),
      'user-1',
    )
  })

  it('rejects deleting a running strategy instance', async () => {
    const { service, repo } = createActionTestContext({ status: 'running' })

    await expect(service.deleteStrategy('user-1', 'inst-1')).rejects.toThrow('account_strategy.delete_running_forbidden')
    expect(repo.deleteStrategyForUser).not.toHaveBeenCalled()
  })

  it('rejects subscriber changing global strategy instance status', async () => {
    const { service, strategyInstancesService } = createActionTestContext({
      createdBy: 'owner-1',
      subscriptions: [{ userId: 'user-2', status: 'active', exchangeAccount: { id: 'exchange-account-1', exchangeId: 'okx' } }],
    })

    await expect(
      service.performAction('inst-1', { userId: 'user-2', action: AccountStrategyAction.STOP }),
    ).rejects.toThrow('account_strategy.owner_only')

    expect(strategyInstancesService.updateInstance).not.toHaveBeenCalled()
  })

  it('rejects liquidate_and_stop for non-owner without calling closePosition', async () => {
    const { service, strategyInstancesService, positionsService } = createActionTestContext({
      createdBy: 'owner-1',
      subscriptions: [{ userId: 'user-2', status: 'active' }],
    })

    await expect(
      service.performAction('inst-1', { userId: 'user-2', action: 'liquidate_and_stop' as any }),
    ).rejects.toThrow('account_strategy.owner_only')

    expect(positionsService.closePosition).not.toHaveBeenCalled()
    expect(strategyInstancesService.updateInstance).not.toHaveBeenCalled()
  })

  it('rejects action when strategy is not visible and does not update status', async () => {
    const { service, strategyInstancesService } = createActionTestContext({
      subscriptions: [{ userId: 'user-1', status: 'inactive', exchangeAccount: { id: 'exchange-account-1', exchangeId: 'okx' } }],
    })

    await expect(
      service.performAction('inst-1', { userId: 'user-1', action: AccountStrategyAction.STOP }),
    ).rejects.toThrow('account_strategy.not_found')

    expect(strategyInstancesService.updateInstance).not.toHaveBeenCalled()
  })

  it('rejects liquidate_and_stop when strategy is not visible', async () => {
    const { service, strategyInstancesService, positionsService } = createActionTestContext({
      subscriptions: [{ userId: 'user-1', status: 'inactive', exchangeAccount: { id: 'exchange-account-1', exchangeId: 'okx' } }],
    })

    await expect(
      service.performAction('inst-1', { userId: 'user-1', action: 'liquidate_and_stop' as any }),
    ).rejects.toThrow('account_strategy.not_found')

    expect(positionsService.closePosition).not.toHaveBeenCalled()
    expect(strategyInstancesService.updateInstance).not.toHaveBeenCalled()
  })

  it('rejects invalid action even when strategy status is already stopped', async () => {
    const { service, strategyInstancesService } = createActionTestContext({ status: 'stopped' })
    service.getStrategyDetail = jest.fn()

    await expect(
      service.performAction('inst-1', { userId: 'user-1', action: 'INVALID_ACTION' as any }),
    ).rejects.toThrow('account_strategy.invalid_action')

    expect(service.getStrategyDetail).not.toHaveBeenCalled()
    expect(strategyInstancesService.updateInstance).not.toHaveBeenCalled()
  })

  it('returns detail for liquidate_and_stop when strategy is already stopped', async () => {
    const { repo, service, strategyInstancesService, positionsService } = createActionTestContext({
      status: 'stopped',
    })

    await expect(
      service.performAction('inst-1', { userId: 'user-1', action: 'liquidate_and_stop' as any }),
    ).resolves.toEqual({ id: 'inst-1' })

    expect(repo.findUserStrategyAccount).not.toHaveBeenCalled()
    expect(repo.loadOpenPositionsForLiquidation).not.toHaveBeenCalled()
    expect(positionsService.closePosition).not.toHaveBeenCalled()
    expect(strategyInstancesService.updateInstance).not.toHaveBeenCalled()
  })

  it('treats liquidate_and_stop as stop when there are no open positions', async () => {
    const { repo, service, strategyInstancesService, tradingService, positionsService } = createActionTestContext()

    await service.performAction('inst-1', {
      userId: 'user-1',
      action: 'liquidate_and_stop' as any,
    })

    expect(tradingService.getOpenOrders).toHaveBeenCalledWith(
      'user-1',
      'okx',
      'spot',
      'BTC/USDT',
      'exchange-account-1',
    )
    expect(tradingService.cancelOrder).not.toHaveBeenCalled()
    expect(repo.findUserStrategyAccount).toHaveBeenCalledWith('user-1', 'tpl-1')
    expect(repo.loadOpenPositionsForLiquidation).toHaveBeenCalledWith('account-1')
    expect(positionsService.closePosition).not.toHaveBeenCalled()
    expect(strategyInstancesService.updateInstance).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ status: 'stopped', updatedBy: 'user-1' }),
      'user-1',
    )
  })

  it('cancels open orders before closing positions', async () => {
    const { repo, service, strategyInstancesService, tradingService, positionsService } = createActionTestContext()
    tradingService.getOpenOrders.mockResolvedValue([
      { id: 'order-1', symbol: 'BTC/USDT', status: 'open' },
      { id: 'order-2', symbol: 'BTC/USDT', status: 'closed' },
    ])
    repo.loadOpenPositionsForLiquidation.mockResolvedValue([{
      id: 'pos-1',
      symbol: 'BTCUSDT',
      positionSide: 'LONG',
      quantity: { toString: () => '0.25' },
      exchangeId: 'okx',
      marketType: 'spot',
      status: 'OPEN',
    }])

    await service.performAction('inst-1', {
      userId: 'user-1',
      action: 'liquidate_and_stop' as any,
    })

    expect(tradingService.cancelOrder).toHaveBeenCalledWith(
      'user-1',
      'okx',
      'spot',
      'order-1',
      'BTC/USDT',
      'exchange-account-1',
    )
    expect(positionsService.closePosition).toHaveBeenCalledTimes(1)
    expect(strategyInstancesService.updateInstance).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ status: 'stopped', updatedBy: 'user-1' }),
      'user-1',
    )
  })

  it('does not stop the strategy when canceling open orders fails', async () => {
    const { service, strategyInstancesService, tradingService, positionsService } = createActionTestContext()
    tradingService.getOpenOrders.mockResolvedValue([
      { id: 'order-1', symbol: 'BTC/USDT', status: 'open' },
    ])
    tradingService.cancelOrder.mockRejectedValue(new Error('cancel failed'))

    await expect(
      service.performAction('inst-1', {
        userId: 'user-1',
        action: 'liquidate_and_stop' as any,
      }),
    ).rejects.toThrow('cancel failed')

    expect(positionsService.closePosition).not.toHaveBeenCalled()
    expect(strategyInstancesService.updateInstance).not.toHaveBeenCalled()
  })

  it('serializes duplicate liquidate_and_stop requests for the same strategy', async () => {
    const { repo, service, strategyInstancesService, tradingService, positionsService } = createActionTestContext()
    const runningRow = {
      ...defaultRow,
      status: 'running',
    }
    const stoppedRow = {
      ...defaultRow,
      status: 'stopped',
    }
    repo.findStrategyForUser
      .mockResolvedValueOnce(runningRow)
      .mockResolvedValueOnce(runningRow)
      .mockResolvedValueOnce(runningRow)
      .mockResolvedValueOnce(stoppedRow)
    tradingService.getOpenOrders.mockResolvedValue([
      { id: 'order-1', symbol: 'BTC/USDT', status: 'open' },
    ])
    repo.loadOpenPositionsForLiquidation.mockResolvedValue([{
      id: 'pos-1',
      symbol: 'BTCUSDT',
      positionSide: 'LONG',
      quantity: { toString: () => '0.25' },
      exchangeId: 'okx',
      marketType: 'spot',
      status: 'OPEN',
    }])

    await Promise.all([
      service.performAction('inst-1', { userId: 'user-1', action: 'liquidate_and_stop' as any }),
      service.performAction('inst-1', { userId: 'user-1', action: 'liquidate_and_stop' as any }),
    ])

    expect(tradingService.cancelOrder).toHaveBeenCalledTimes(1)
    expect(positionsService.closePosition).toHaveBeenCalledTimes(1)
    expect(strategyInstancesService.updateInstance).toHaveBeenCalledTimes(1)
  })

  it('liquidates each open position before stopping the strategy', async () => {
    const { repo, service, strategyInstancesService, positionsService } = createActionTestContext()
    repo.loadOpenPositionsForLiquidation.mockResolvedValue([
      {
        id: 'pos-1',
        symbol: 'BTCUSDT',
        positionSide: 'LONG',
        quantity: { toString: () => '0.25' },
        exchangeId: 'okx',
        marketType: 'perp',
        status: 'OPEN',
      },
      {
        id: 'pos-2',
        symbol: 'ETHUSDT',
        positionSide: 'SHORT',
        quantity: { toString: () => '1.5' },
        exchangeId: 'okx',
        marketType: 'perp',
        status: 'OPEN',
      },
    ])

    await service.performAction('inst-1', {
      userId: 'user-1',
      action: 'liquidate_and_stop' as any,
    })

    expect(positionsService.closePosition).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      userStrategyAccountId: 'account-1',
      positionId: 'pos-1',
      quantity: '0.25',
      exchangeId: 'okx',
      marketType: 'perp',
      note: 'AI Quant 平仓并停止',
    })
    expect(positionsService.closePosition).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      userStrategyAccountId: 'account-1',
      positionId: 'pos-2',
      quantity: '1.5',
      exchangeId: 'okx',
      marketType: 'perp',
      note: 'AI Quant 平仓并停止',
    })
    expect(strategyInstancesService.updateInstance).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ status: 'stopped', updatedBy: 'user-1' }),
      'user-1',
    )
  })

  it('does not stop the strategy when any closePosition call fails', async () => {
    const { repo, service, strategyInstancesService, positionsService } = createActionTestContext()
    repo.loadOpenPositionsForLiquidation.mockResolvedValue([
      {
        id: 'pos-1',
        quantity: { toString: () => '0.25' },
        exchangeId: 'okx',
        marketType: 'perp',
        status: 'OPEN',
      },
      {
        id: 'pos-2',
        quantity: { toString: () => '1.5' },
        exchangeId: 'okx',
        marketType: 'perp',
        status: 'OPEN',
      },
    ])
    positionsService.closePosition
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('close failed'))

    await expect(
      service.performAction('inst-1', {
        userId: 'user-1',
        action: 'liquidate_and_stop' as any,
      }),
    ).rejects.toThrow('close failed')

    expect(strategyInstancesService.updateInstance).not.toHaveBeenCalled()
  })
})
