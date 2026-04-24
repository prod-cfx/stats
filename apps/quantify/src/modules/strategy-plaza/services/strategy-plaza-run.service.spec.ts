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
      resolveOfficialSnapshotForUser: jest.fn().mockResolvedValue({
        id: overrides?.snapshotId ?? 'user-visible-ma-cross-snapshot',
      }),
    }
    const accountStrategyViewService = {
      deployStrategy: jest.fn().mockResolvedValue(overrides?.deployResult ?? { id: 'strategy-1', status: 'running' }),
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
})
