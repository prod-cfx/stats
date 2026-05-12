import { WorkloadShardingService } from './workload-sharding.service'

describe('workloadShardingService', () => {
  it('always owns work when shard count is one', () => {
    const service = new WorkloadShardingService({ get: jest.fn() } as any)

    expect(service.belongsToShard('strategy-instance-1', { enabled: true, count: 1, index: 0 })).toBe(true)
    expect(service.belongsToShard('strategy-instance-2', { enabled: true, count: 1, index: 99 })).toBe(true)
  })

  it('maps the same id to a stable shard using sha256 first four bytes', () => {
    const service = new WorkloadShardingService({ get: jest.fn() } as any)

    const first = service.getShardIndex('strategy-instance-stable', 4)
    const second = service.getShardIndex('strategy-instance-stable', 4)

    expect(first).toBe(second)
    expect(first).toBeGreaterThanOrEqual(0)
    expect(first).toBeLessThan(4)
  })

  it('distributes ids across four shards without obvious skew', () => {
    const service = new WorkloadShardingService({ get: jest.fn() } as any)
    const counts = [0, 0, 0, 0]

    for (let i = 0; i < 400; i += 1) {
      counts[service.getShardIndex(`strategy-instance-${i}`, 4)]! += 1
    }

    for (const count of counts) {
      expect(count).toBeGreaterThan(70)
      expect(count).toBeLessThan(130)
    }
  })

  it('routes strategy instances and users through the same deterministic shard logic', () => {
    const service = new WorkloadShardingService({ get: jest.fn() } as any)
    const config = { enabled: true, count: 4, index: service.getShardIndex('user-1', 4) }

    expect(service.ownsStrategyInstance('strategy-instance-1', {
      enabled: true,
      count: 4,
      index: service.getShardIndex('strategy-instance-1', 4),
    })).toBe(true)
    expect(service.ownsUser('user-1', config)).toBe(true)
  })
})
