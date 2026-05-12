jest.mock('@/modules/account-strategy-view/services/account-strategy-view.service', () => ({
  AccountStrategyViewService: class AccountStrategyViewService {},
}))

import { StrategyPlazaOkxDemoApiKeyRequiredException } from '../exceptions'
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
    }
    const officialSnapshots = {
      resolveExistingOfficialSnapshotForUser: jest.fn().mockResolvedValue(
        overrides?.existingStrategyInstanceId
          ? {
              id: overrides?.snapshotId ?? 'user-visible-ma-cross-snapshot',
              existingStrategyInstanceId: overrides.existingStrategyInstanceId,
            }
          : null,
      ),
      resolveOfficialSnapshotForUser: jest.fn().mockResolvedValue({
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
      officialSnapshots as never,
      accountStrategyViewService as never,
    )

    return {
      accountStrategyViewService,
      exchangeAccounts,
      officialSnapshots,
      service,
      templates,
    }
  }

  it('requires an OKX demo API key before running', async () => {
    const { accountStrategyViewService, officialSnapshots, service } = buildService({ account: null })

    await expect(service.runTemplate({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-123456',
    })).rejects.toBeInstanceOf(StrategyPlazaOkxDemoApiKeyRequiredException)

    expect(officialSnapshots.resolveExistingOfficialSnapshotForUser).toHaveBeenCalledWith({
      template,
      userId: 'user-1',
    })
    expect(officialSnapshots.resolveOfficialSnapshotForUser).not.toHaveBeenCalled()
    expect(accountStrategyViewService.deployStrategy).not.toHaveBeenCalled()
  })

  it('deploys with a user-visible official snapshot and template-owned parameters only', async () => {
    const { accountStrategyViewService, officialSnapshots, service } = buildService()

    await service.runTemplate({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-123456',
    })

    expect(officialSnapshots.resolveExistingOfficialSnapshotForUser).toHaveBeenCalledWith({
      template,
      userId: 'user-1',
    })
    expect(officialSnapshots.resolveOfficialSnapshotForUser).toHaveBeenCalledWith({
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

  it('returns the existing plaza strategy without deploying again', async () => {
    const { accountStrategyViewService, exchangeAccounts, officialSnapshots, service } = buildService({
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
    expect(officialSnapshots.resolveExistingOfficialSnapshotForUser).toHaveBeenCalledWith({
      template,
      userId: 'user-1',
    })
    expect(exchangeAccounts.findLatestOkxDemoAccountForUser).not.toHaveBeenCalled()
    expect(officialSnapshots.resolveOfficialSnapshotForUser).not.toHaveBeenCalled()
    expect(accountStrategyViewService.deployStrategy).not.toHaveBeenCalled()
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
