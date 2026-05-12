import { HealthService } from './health.service'

describe('healthService', () => {
  it('returns quantify as service name', () => {
    const service = new HealthService()

    expect(service.getHealth().service).toBe('quantify')
  })

  it('includes default shard metadata', () => {
    const service = new HealthService()

    expect(service.getHealth().shard).toEqual({
      enabled: false,
      count: 1,
      index: 0,
      activeStrategies: 0,
    })
  })

  it('reads shard metadata from sharding config', () => {
    const service = new HealthService({
      get: jest.fn().mockReturnValue({ enabled: true, count: 4, index: 2 }),
    })

    expect(service.getHealth().shard).toEqual({
      enabled: true,
      count: 4,
      index: 2,
      activeStrategies: 0,
    })
  })
})
