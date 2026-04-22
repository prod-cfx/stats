import { AccountStrategyViewService } from './account-strategy-view.service'

describe('accountStrategyViewService.deployStrategy transaction boundary', () => {
  it('does not create a deploy request when published snapshot validation fails before deploy starts', async () => {
    const repo = {
      deployStrategyForUser: jest.fn(),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue(null),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn(), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined) } as any,
      undefined,
      undefined,
      undefined,
      snapshotsRepository as any,
    )

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'snapshot deploy',
      publishedSnapshotId: 'snapshot-foreign',
      deployRequestId: 'deploy-req-foreign',
      exchangeAccountId: 'acct-1',
    } as any)).rejects.toMatchObject({
      message: 'account_strategy.published_snapshot_not_found',
    })

    expect(repo.createDeployRequestProcessing).not.toHaveBeenCalled()
    expect(repo.markDeployRequestFailed).not.toHaveBeenCalled()
    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
  })
})
