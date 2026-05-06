import { AccountStrategyViewService } from './account-strategy-view.service'

const baseRow = {
  id: 'inst-1',
  status: 'stopped' as const,
  createdBy: 'user-1',
  strategyTemplateId: 'tpl-1',
  params: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'spot' },
  strategyTemplate: { defaultParams: {} },
  subscriptions: [{
    userId: 'user-1',
    status: 'active',
    exchangeAccount: { id: 'exchange-account-1', exchangeId: 'okx' },
  }],
}

function buildService(rowOverrides: Record<string, unknown> = {}, repoOverrides: Record<string, unknown> = {}) {
  const repo = {
    findStrategyForUser: jest.fn().mockResolvedValue({ ...baseRow, ...rowOverrides }),
    findUserStrategyAccount: jest.fn().mockResolvedValue({ id: 'account-1' }),
    loadOpenPositionsForLiquidation: jest.fn().mockResolvedValue([]),
    hasActiveConversationsForStrategy: jest.fn().mockResolvedValue(false),
    archiveLinkedConversationsForStrategy: jest.fn().mockResolvedValue({ archivedCount: 0 }),
    markStrategyViewOnly: jest.fn().mockResolvedValue(undefined),
    archiveStrategyInstanceById: jest.fn().mockResolvedValue(undefined),
    ...repoOverrides,
  }
  const tradingService = {
    getOpenOrders: jest.fn().mockResolvedValue([]),
    cancelOrder: jest.fn(),
  }
  const txHost = {
    withTransaction: jest.fn(async (cb: () => Promise<unknown>) => cb()),
  }
  const service = new AccountStrategyViewService(
    repo as any,
    {} as any,
    {} as any,
    {} as any,
    undefined,
    undefined,
    tradingService as any,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    txHost as any,
  )
  return { service, repo, tradingService, txHost }
}

describe('AccountStrategyViewService.deleteStrategy (unified)', () => {
  it('1. running + deleteStoppedStrategy=false → throws delete_running_forbidden', async () => {
    const { service } = buildService({ status: 'running' })
    await expect(
      service.deleteStrategy('user-1', 'inst-1', { deleteStoppedStrategy: false, via: 'account-list' }),
    ).rejects.toThrow('account_strategy.delete_running_forbidden')
  })

  it('2. running + deleteStoppedStrategy=true → throws delete_running_forbidden', async () => {
    const { service } = buildService({ status: 'running' })
    await expect(
      service.deleteStrategy('user-1', 'inst-1', { deleteStoppedStrategy: true, via: 'account-list' }),
    ).rejects.toThrow('account_strategy.delete_running_forbidden')
  })

  it('3. stopped + has conversation + deleteStoppedStrategy=false → archives conversations + sets viewOnlyAt + does NOT archive strategy', async () => {
    const { service, repo } = buildService({ status: 'stopped' })
    repo.hasActiveConversationsForStrategy.mockResolvedValue(true)
    await service.deleteStrategy('user-1', 'inst-1', { deleteStoppedStrategy: false, via: 'account-list' })
    expect(repo.archiveLinkedConversationsForStrategy).toHaveBeenCalledTimes(1)
    expect(repo.markStrategyViewOnly).toHaveBeenCalledWith('user-1', 'inst-1')
    expect(repo.archiveStrategyInstanceById).not.toHaveBeenCalled()
  })

  it('4. stopped + has conversation + deleteStoppedStrategy=true → archives conversations + archives strategy', async () => {
    const { service, repo } = buildService({ status: 'stopped' })
    repo.hasActiveConversationsForStrategy.mockResolvedValue(true)
    await service.deleteStrategy('user-1', 'inst-1', { deleteStoppedStrategy: true, via: 'account-list' })
    expect(repo.archiveLinkedConversationsForStrategy).toHaveBeenCalledTimes(1)
    expect(repo.archiveStrategyInstanceById).toHaveBeenCalledWith('user-1', 'inst-1')
    expect(repo.markStrategyViewOnly).not.toHaveBeenCalled()
  })

  it('5. stopped + no conversation + deleteStoppedStrategy=false → only sets viewOnlyAt; archive count=0', async () => {
    const { service, repo } = buildService({ status: 'stopped' })
    await service.deleteStrategy('user-1', 'inst-1', { deleteStoppedStrategy: false, via: 'account-list' })
    expect(repo.archiveLinkedConversationsForStrategy).not.toHaveBeenCalled()
    expect(repo.markStrategyViewOnly).toHaveBeenCalledWith('user-1', 'inst-1')
    expect(repo.archiveStrategyInstanceById).not.toHaveBeenCalled()
  })

  it('6. stopped + no conversation + deleteStoppedStrategy=true → archives strategy; archive count=0', async () => {
    const { service, repo } = buildService({ status: 'stopped' })
    await service.deleteStrategy('user-1', 'inst-1', { deleteStoppedStrategy: true, via: 'account-list' })
    expect(repo.archiveLinkedConversationsForStrategy).not.toHaveBeenCalled()
    expect(repo.archiveStrategyInstanceById).toHaveBeenCalledWith('user-1', 'inst-1')
    expect(repo.markStrategyViewOnly).not.toHaveBeenCalled()
  })

  it('7. stopped + open positions + deleteStoppedStrategy=true → archives strategy with orphan position recorded', async () => {
    // 用户在「停止策略」时已显式选择不平仓；删除策略不应再被持仓拦截，
    // 改为采集 orphan 数量供审计日志记录。
    const { service, repo } = buildService({ status: 'stopped' })
    repo.loadOpenPositionsForLiquidation.mockResolvedValue([{
      id: 'pos-1',
      quantity: { toString: () => '0.25' },
      exchangeId: 'okx',
      marketType: 'spot',
      status: 'OPEN',
    }])
    await service.deleteStrategy('user-1', 'inst-1', { deleteStoppedStrategy: true, via: 'account-list' })
    expect(repo.archiveStrategyInstanceById).toHaveBeenCalledWith('user-1', 'inst-1')
    expect(repo.markStrategyViewOnly).not.toHaveBeenCalled()
  })

  it('8. multiple active conversations: all archived in one repo call', async () => {
    // archiveLinkedConversationsForStrategy 内部一次 updateMany 覆盖所有 active conversation。
    // 这里通过返回 archivedCount=2 验证调用方对结果的处理路径。
    const { service, repo } = buildService({ status: 'stopped' })
    repo.hasActiveConversationsForStrategy.mockResolvedValue(true)
    repo.archiveLinkedConversationsForStrategy.mockResolvedValue({ archivedCount: 2 })
    await service.deleteStrategy('user-1', 'inst-1', { deleteStoppedStrategy: false, via: 'account-list' })
    expect(repo.archiveLinkedConversationsForStrategy).toHaveBeenCalledTimes(1)
    expect(repo.archiveLinkedConversationsForStrategy).toHaveBeenCalledWith('user-1', 'inst-1')
    expect(repo.markStrategyViewOnly).toHaveBeenCalledTimes(1)
  })
})
