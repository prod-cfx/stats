jest.mock('@/modules/account-strategy-view/services/account-strategy-view.service', () => ({
  AccountStrategyViewService: class AccountStrategyViewService {},
}))

import { StrategyPlazaOkxDemoApiKeyRequiredException, StrategyPlazaOkxLiveApiKeyRequiredException } from '../exceptions'
import { StrategyPlazaRunService } from './strategy-plaza-run.service'

describe('StrategyPlazaRunService', () => {
  type TemplateStub = {
    id: string
    name: string
    runConfig: {
      exchange: 'okx'
      marketType: 'perp'
      symbol: string
      timeframe: string
      positionPct: number
      leverage: number
      publishedSnapshotId: string
      deploymentExecutionConfig: {
        leverage: number
        priceSource: 'mark'
        orderType: 'market'
        timeInForce: 'ioc'
      }
    }
  }

  const template = {
    id: 'ma-cross',
    name: 'MA 均线交叉',
    runConfig: {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'BTC-USDT-SWAP',
      timeframe: '15m',
      positionPct: 10,
      leverage: 2,
      publishedSnapshotId: 'official-plaza-ma-cross-v1-snapshot',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    },
  } satisfies TemplateStub

  function buildService(overrides?: {
    account?: { id: string, name: string } | null
    liveAccount?: { id: string, name: string } | null
    deployResult?: unknown
    existingStrategyInstanceId?: string
    existingStrategyDetail?: unknown
    snapshotId?: string
  }) {
    const account = overrides && 'account' in overrides
      ? overrides.account
      : { id: 'acct-okx-demo', name: 'OKX Demo' }

    const templates = { getRequired: jest.fn().mockReturnValue(template) }
    const exchangeAccounts = {
      findLatestOkxDemoAccountForUser: jest.fn().mockResolvedValue(account),
      findExchangeAccountFirst: jest.fn().mockResolvedValue(
        overrides && 'liveAccount' in overrides
          ? overrides.liveAccount
          : { id: 'acct-okx-live', name: 'OKX Live' },
      ),
    }
    const compiledSnapshots = {
      resolveExistingCompiledSnapshotForUser: jest.fn().mockResolvedValue(
        overrides?.existingStrategyInstanceId
          ? {
              id: overrides?.snapshotId ?? 'user-visible-ma-cross-snapshot',
              existingStrategyInstanceId: overrides.existingStrategyInstanceId,
            }
          : null,
      ),
      resolveCompiledSnapshotForUser: jest.fn().mockResolvedValue({
        id: overrides?.snapshotId ?? 'user-visible-ma-cross-snapshot',
      }),
    }
    const accountStrategyViewService = {
      deployStrategy: jest.fn().mockResolvedValue(overrides?.deployResult ?? { id: 'strategy-1', status: 'running' }),
      getStrategyDetail: jest.fn().mockResolvedValue(overrides?.existingStrategyDetail ?? {
        id: overrides?.existingStrategyInstanceId ?? 'strategy-existing',
        name: 'MA 均线交叉',
        status: 'stopped',
      }),
    }
    const service = new StrategyPlazaRunService(
      templates as never,
      exchangeAccounts as never,
      compiledSnapshots as never,
      accountStrategyViewService as never,
    )

    return {
      accountStrategyViewService,
      exchangeAccounts,
      compiledSnapshots,
      service,
      templates,
    }
  }

  it('requires an OKX demo API key before running', async () => {
    const { accountStrategyViewService, compiledSnapshots, service } = buildService({ account: null })

    await expect(service.runTemplate({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-123456',
    })).rejects.toBeInstanceOf(StrategyPlazaOkxDemoApiKeyRequiredException)

    expect(compiledSnapshots.resolveExistingCompiledSnapshotForUser).toHaveBeenCalledWith({
      template,
      userId: 'user-1',
    })
    expect(compiledSnapshots.resolveCompiledSnapshotForUser).not.toHaveBeenCalled()
    expect(accountStrategyViewService.deployStrategy).not.toHaveBeenCalled()
  })

  it('deploys with a user-visible compiled rules snapshot and template-owned parameters only', async () => {
    const { accountStrategyViewService, compiledSnapshots, service } = buildService()

    await service.runTemplate({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-123456',
    })

    expect(compiledSnapshots.resolveExistingCompiledSnapshotForUser).toHaveBeenCalledWith({
      template,
      userId: 'user-1',
    })
    expect(compiledSnapshots.resolveCompiledSnapshotForUser).toHaveBeenCalledWith({
      template,
      userId: 'user-1',
    })
    expect(accountStrategyViewService.deployStrategy).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'MA 均线交叉',
      deployRequestId: 'plaza:ma-cross:run-123456',
      publishedSnapshotId: 'user-visible-ma-cross-snapshot',
      exchangeAccountId: 'acct-okx-demo',
      exchangeAccountName: 'OKX Demo',
      mode: 'TESTNET',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    })
  })

  it('deploys live with a selected user OKX mainnet account', async () => {
    const { accountStrategyViewService, exchangeAccounts, service } = buildService()

    await service.runTemplate({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-live-123456',
      mode: 'LIVE',
      exchangeAccountId: 'acct-okx-live',
    })

    expect(exchangeAccounts.findLatestOkxDemoAccountForUser).not.toHaveBeenCalled()
    expect(exchangeAccounts.findExchangeAccountFirst).toHaveBeenCalledWith({
      where: {
        id: 'acct-okx-live',
        userId: 'user-1',
        exchangeId: 'okx',
        isTestnet: false,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, name: true },
    })
    expect(accountStrategyViewService.deployStrategy).toHaveBeenCalledWith(expect.objectContaining({
      deployRequestId: 'plaza:ma-cross:run-live-123456',
      exchangeAccountId: 'acct-okx-live',
      exchangeAccountName: 'OKX Live',
      mode: 'LIVE',
    }))
  })

  it('requires an OKX live API key before live deployment', async () => {
    const { accountStrategyViewService, service } = buildService({ liveAccount: null })

    await expect(service.runTemplate({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-live-123456',
      mode: 'LIVE',
      exchangeAccountId: 'acct-okx-live',
    })).rejects.toBeInstanceOf(StrategyPlazaOkxLiveApiKeyRequiredException)

    expect(accountStrategyViewService.deployStrategy).not.toHaveBeenCalled()
  })

  it('returns the existing plaza strategy without deploying again', async () => {
    const { accountStrategyViewService, exchangeAccounts, compiledSnapshots, service } = buildService({
      existingStrategyInstanceId: 'strategy-existing',
      existingStrategyDetail: {
        id: 'strategy-existing',
        name: 'MA 均线交叉',
        status: 'stopped',
      },
    })

    await expect(service.runTemplate({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-123456',
    })).resolves.toEqual({
      result: 'existing',
      strategy: {
        id: 'strategy-existing',
        name: 'MA 均线交叉',
        status: 'stopped',
      },
    })

    expect(accountStrategyViewService.getStrategyDetail).toHaveBeenCalledWith('user-1', 'strategy-existing')
    expect(compiledSnapshots.resolveExistingCompiledSnapshotForUser).toHaveBeenCalledWith({
      template,
      userId: 'user-1',
    })
    expect(exchangeAccounts.findLatestOkxDemoAccountForUser).not.toHaveBeenCalled()
    expect(compiledSnapshots.resolveCompiledSnapshotForUser).not.toHaveBeenCalled()
    expect(accountStrategyViewService.deployStrategy).not.toHaveBeenCalled()
  })

  it('does not reuse an existing plaza strategy when the user explicitly requests live deployment', async () => {
    const { accountStrategyViewService, exchangeAccounts, compiledSnapshots, service } = buildService({
      existingStrategyInstanceId: 'strategy-existing-testnet',
      existingStrategyDetail: {
        id: 'strategy-existing-testnet',
        name: 'MA 均线交叉',
        status: 'running',
      },
    })

    await service.runTemplate({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-live-123456',
      mode: 'LIVE',
      exchangeAccountId: 'acct-okx-live',
    })

    expect(compiledSnapshots.resolveExistingCompiledSnapshotForUser).not.toHaveBeenCalled()
    expect(exchangeAccounts.findExchangeAccountFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'acct-okx-live', isTestnet: false }),
    }))
    expect(accountStrategyViewService.getStrategyDetail).not.toHaveBeenCalled()
    expect(accountStrategyViewService.deployStrategy).toHaveBeenCalledWith(expect.objectContaining({
      deployRequestId: 'plaza:ma-cross:run-live-123456',
      mode: 'LIVE',
      exchangeAccountId: 'acct-okx-live',
    }))
  })

  it('returns an existing plaza strategy even when the OKX demo key is missing', async () => {
    const { accountStrategyViewService, exchangeAccounts, service } = buildService({
      account: null,
      existingStrategyInstanceId: 'strategy-existing',
      existingStrategyDetail: {
        id: 'strategy-existing',
        name: 'MA 均线交叉',
        status: 'running',
      },
    })

    await expect(service.runTemplate({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-123456',
    })).resolves.toEqual({
      result: 'existing',
      strategy: {
        id: 'strategy-existing',
        name: 'MA 均线交叉',
        status: 'running',
      },
    })

    expect(exchangeAccounts.findLatestOkxDemoAccountForUser).not.toHaveBeenCalled()
    expect(accountStrategyViewService.deployStrategy).not.toHaveBeenCalled()
  })
})
