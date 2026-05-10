import { LlmStrategyInstanceDrawdownAggregatorService } from './llm-strategy-instance-drawdown-aggregator.service'

describe('LlmStrategyInstanceDrawdownAggregatorService (#1058)', () => {
  function createRepoMock(overrides: Partial<{
    findInstancesAffectedByAccount: jest.Mock
    aggregateInstanceDrawdown: jest.Mock
    writeInstanceDrawdown: jest.Mock
  }> = {}) {
    return {
      findInstancesAffectedByAccount: overrides.findInstancesAffectedByAccount
        ?? jest.fn().mockResolvedValue([{ id: 'inst-1' }]),
      aggregateInstanceDrawdown: overrides.aggregateInstanceDrawdown
        ?? jest.fn().mockResolvedValue(12.5),
      writeInstanceDrawdown: overrides.writeInstanceDrawdown
        ?? jest.fn().mockResolvedValue(undefined),
    }
  }

  describe('recomputeForAccount', () => {
    it('writes per-account drawdown to all affected StrategyInstances (per-user single tenant)', async () => {
      const repo = createRepoMock({
        findInstancesAffectedByAccount: jest.fn().mockResolvedValue([
          { id: 'inst-A' },
          { id: 'inst-B' },
        ]),
        aggregateInstanceDrawdown: jest.fn()
          .mockResolvedValueOnce(5.5)
          .mockResolvedValueOnce(20.1),
      })
      const service = new LlmStrategyInstanceDrawdownAggregatorService(repo as any)

      await service.recomputeForAccount('acct-1')

      expect(repo.findInstancesAffectedByAccount).toHaveBeenCalledWith('acct-1')
      expect(repo.aggregateInstanceDrawdown).toHaveBeenNthCalledWith(1, 'inst-A')
      expect(repo.aggregateInstanceDrawdown).toHaveBeenNthCalledWith(2, 'inst-B')
      expect(repo.writeInstanceDrawdown).toHaveBeenNthCalledWith(1, 'inst-A', 5.5)
      expect(repo.writeInstanceDrawdown).toHaveBeenNthCalledWith(2, 'inst-B', 20.1)
    })

    it('writes NULL when aggregator returns null (no active subscriptions)', async () => {
      const repo = createRepoMock({
        aggregateInstanceDrawdown: jest.fn().mockResolvedValue(null),
      })
      const service = new LlmStrategyInstanceDrawdownAggregatorService(repo as any)

      await service.recomputeForAccount('acct-1')

      expect(repo.writeInstanceDrawdown).toHaveBeenCalledWith('inst-1', null)
    })

    it('returns early when no instances are affected', async () => {
      const repo = createRepoMock({
        findInstancesAffectedByAccount: jest.fn().mockResolvedValue([]),
      })
      const service = new LlmStrategyInstanceDrawdownAggregatorService(repo as any)

      await service.recomputeForAccount('acct-1')

      expect(repo.aggregateInstanceDrawdown).not.toHaveBeenCalled()
      expect(repo.writeInstanceDrawdown).not.toHaveBeenCalled()
    })

    it('invalidates instance to NULL when single recompute throws (M3 fail-closed)', async () => {
      const repo = createRepoMock({
        aggregateInstanceDrawdown: jest.fn().mockRejectedValue(new Error('aggregate failed')),
      })
      const service = new LlmStrategyInstanceDrawdownAggregatorService(repo as any)

      await service.recomputeForAccount('acct-1')

      expect(repo.writeInstanceDrawdown).toHaveBeenCalledWith('inst-1', null)
    })

    it('does not throw when invalidate itself fails (R-5 防递归 throw)', async () => {
      const repo = createRepoMock({
        aggregateInstanceDrawdown: jest.fn().mockRejectedValue(new Error('agg fail')),
        writeInstanceDrawdown: jest.fn().mockRejectedValue(new Error('write fail')),
      })
      const service = new LlmStrategyInstanceDrawdownAggregatorService(repo as any)

      await expect(service.recomputeForAccount('acct-1')).resolves.toBeUndefined()
    })

    it('swallows top-level findInstances errors without throwing', async () => {
      const repo = createRepoMock({
        findInstancesAffectedByAccount: jest.fn().mockRejectedValue(new Error('lookup failed')),
      })
      const service = new LlmStrategyInstanceDrawdownAggregatorService(repo as any)

      await expect(service.recomputeForAccount('acct-1')).resolves.toBeUndefined()
      expect(repo.aggregateInstanceDrawdown).not.toHaveBeenCalled()
    })

    it('skips re-entry when already in flight for the same accountId (W1 dedupe)', async () => {
      let resolveFirst: () => void = () => {}
      const firstCall = new Promise<void>(resolve => { resolveFirst = resolve })
      const repo = createRepoMock({
        findInstancesAffectedByAccount: jest.fn()
          .mockImplementationOnce(() => firstCall.then(() => [{ id: 'inst-1' }])),
      })
      const service = new LlmStrategyInstanceDrawdownAggregatorService(repo as any)

      const p1 = service.recomputeForAccount('acct-1')
      const p2 = service.recomputeForAccount('acct-1')
      resolveFirst()
      await Promise.all([p1, p2])

      expect(repo.findInstancesAffectedByAccount).toHaveBeenCalledTimes(1)
    })
  })

  describe('recomputeForInstance', () => {
    it('directly recomputes instance bypassing account lookup (W4 sub-cancel)', async () => {
      const repo = createRepoMock({
        aggregateInstanceDrawdown: jest.fn().mockResolvedValue(7.7),
      })
      const service = new LlmStrategyInstanceDrawdownAggregatorService(repo as any)

      await service.recomputeForInstance('inst-X')

      expect(repo.findInstancesAffectedByAccount).not.toHaveBeenCalled()
      expect(repo.aggregateInstanceDrawdown).toHaveBeenCalledWith('inst-X')
      expect(repo.writeInstanceDrawdown).toHaveBeenCalledWith('inst-X', 7.7)
    })

    it('writes NULL when instance has no active subs after cancellation', async () => {
      const repo = createRepoMock({
        aggregateInstanceDrawdown: jest.fn().mockResolvedValue(null),
      })
      const service = new LlmStrategyInstanceDrawdownAggregatorService(repo as any)

      await service.recomputeForInstance('inst-X')

      expect(repo.writeInstanceDrawdown).toHaveBeenCalledWith('inst-X', null)
    })

    it('invalidates to NULL when aggregation throws (M3)', async () => {
      const repo = createRepoMock({
        aggregateInstanceDrawdown: jest.fn().mockRejectedValue(new Error('boom')),
      })
      const service = new LlmStrategyInstanceDrawdownAggregatorService(repo as any)

      await service.recomputeForInstance('inst-X')

      expect(repo.writeInstanceDrawdown).toHaveBeenCalledWith('inst-X', null)
    })
  })
})
