import type { DataPullJob } from '../contracts/data-pull-job'
import { DataPullJobRegistryResolver } from './data-pull-job-registry.resolver'

function createJob(key: string, name?: string): DataPullJob {
  return {
    key,
    name,
    metaSchema: null,
    run: jest.fn(),
  }
}

describe('dataPullJobRegistryResolver', () => {
  it('finds jobs by exact key and by key prefix', () => {
    const exact = createJob('coinglass-aggregated-liquidation')
    const other = createJob('coinglass-heatmap')
    const resolver = new DataPullJobRegistryResolver([exact, other])

    expect(resolver.findJobForTask('coinglass-aggregated-liquidation')).toBe(exact)
    expect(resolver.findJobForTask('coinglass-aggregated-liquidation:BTC')).toBe(exact)
    expect(resolver.findJobForTask('unknown-job')).toBeUndefined()
  })

  it('reports registered keys and jobs in stable order', () => {
    const resolver = new DataPullJobRegistryResolver([
      createJob('z-job'),
      createJob('a-job', 'A Job'),
    ])

    expect(resolver.getRegisteredKeys()).toEqual(['a-job', 'z-job'])
    expect(resolver.getRegisteredJobs()).toEqual([
      { key: 'a-job', name: 'A Job', metaSchema: null },
      { key: 'z-job', name: 'z-job', metaSchema: null },
    ])
  })

  it('checks key registration with exact and prefix matching', () => {
    const resolver = new DataPullJobRegistryResolver([
      createJob('example-kline'),
    ])

    expect(resolver.isKeyRegistered('example-kline')).toBe(true)
    expect(resolver.isKeyRegistered('example-kline:BTC')).toBe(true)
    expect(resolver.isKeyRegistered('example-news')).toBe(false)
  })
})
