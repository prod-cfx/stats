jest.mock('@/modules/account-strategy-view/services/account-strategy-view.service', () => ({
  AccountStrategyViewService: class AccountStrategyViewService {},
}))

import { StrategyPlazaOkxDemoApiKeyRequiredException } from '../exceptions'
import { StrategyPlazaRunService } from './strategy-plaza-run.service'

describe('StrategyPlazaRunService', () => {
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
  } as any

  function buildService(overrides?: {
    account?: { id: string, name: string } | null
    deployResult?: unknown
  }) {
    const account = overrides && 'account' in overrides
      ? overrides.account
      : { id: 'acct-okx-demo', name: 'OKX Demo' }

    return new StrategyPlazaRunService(
      { getRequired: jest.fn().mockReturnValue(template) } as any,
      {
        findLatestOkxDemoAccountForUser: jest.fn().mockResolvedValue(account),
      } as any,
      {
        deployStrategy: jest.fn().mockResolvedValue(overrides?.deployResult ?? { id: 'strategy-1', status: 'running' }),
      } as any,
    )
  }

  it('requires an OKX demo API key before running', async () => {
    const service = buildService({ account: null })

    await expect(service.runTemplate({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-123456',
    })).rejects.toBeInstanceOf(StrategyPlazaOkxDemoApiKeyRequiredException)
  })

  it('deploys with template-owned parameters only', async () => {
    const service = buildService()

    await service.runTemplate({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-123456',
    })

    const accountStrategyService = (service as any).accountStrategyViewService
    expect(accountStrategyService.deployStrategy).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'MA 均线交叉',
      deployRequestId: 'plaza:ma-cross:run-123456',
      publishedSnapshotId: 'official-plaza-ma-cross-v1-snapshot',
      exchangeAccountId: 'acct-okx-demo',
      exchangeAccountName: 'OKX Demo',
      mode: 'TESTNET',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    })
  })
})
