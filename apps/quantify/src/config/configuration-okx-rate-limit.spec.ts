import {
  backendConfigLoaders,
  featureFlagsConfig,
  httpEgressConfig,
  prismaPoolConfig,
  shardingConfig,
  strategySignalsConfig,
} from './configuration'

describe('OKX rate limit configuration', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key]
    }
    Object.assign(process.env, originalEnv)
    for (const key of [
      'QUANTIFY_OKX_RETRY_ENABLED',
      'QUANTIFY_SIGNAL_GEN_SPREAD_ENABLED',
      'QUANTIFY_INSTRUMENT_CACHE_SHARED',
      'QUANTIFY_TOKEN_BUCKET_ENABLED',
      'QUANTIFY_OKX_WS_ENABLED',
      'QUANTIFY_PUBLIC_DATA_SHARED',
      'QUANTIFY_SHARDING_ENABLED',
      'SHARD_COUNT',
      'SHARD_INDEX',
      'QUANTIFY_EGRESS_PROXY_URL',
      'QUANTIFY_EGRESS_LOCAL_ADDRESS',
      'QUANTIFY_PRISMA_CONNECTION_LIMIT',
      'QUANTIFY_PRISMA_POOL_TIMEOUT',
      'STRATEGY_SIGNALS_SPREAD_WINDOW_SECONDS',
    ]) {
      delete process.env[key]
    }
  })

  afterAll(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key]
    }
    Object.assign(process.env, originalEnv)
  })

  it('keeps all OKX rollout feature flags off by default', () => {
    expect(featureFlagsConfig()).toEqual({
      okxRetryEnabled: false,
      signalGenerationSpreadEnabled: false,
      instrumentCacheShared: false,
      tokenBucketEnabled: false,
      okxWsEnabled: false,
      publicDataShared: false,
      shardingEnabled: false,
    })
  })

  it('parses sharding, egress, prisma pool, and spread env values', () => {
    process.env.QUANTIFY_SHARDING_ENABLED = 'true'
    process.env.SHARD_COUNT = '4'
    process.env.SHARD_INDEX = '2'
    process.env.QUANTIFY_EGRESS_PROXY_URL = 'http://127.0.0.1:8080'
    process.env.QUANTIFY_EGRESS_LOCAL_ADDRESS = '10.0.0.15'
    process.env.QUANTIFY_PRISMA_CONNECTION_LIMIT = '64'
    process.env.QUANTIFY_PRISMA_POOL_TIMEOUT = '12'
    process.env.QUANTIFY_SIGNAL_GEN_SPREAD_ENABLED = 'true'
    process.env.STRATEGY_SIGNALS_SPREAD_WINDOW_SECONDS = '180'

    expect(shardingConfig()).toEqual({ enabled: true, count: 4, index: 2 })
    expect(httpEgressConfig()).toEqual({
      proxyUrl: 'http://127.0.0.1:8080',
      localAddress: '10.0.0.15',
    })
    expect(prismaPoolConfig()).toEqual({ connectionLimit: 64, poolTimeout: 12 })
    expect(strategySignalsConfig().spread).toEqual({ enabled: true, windowSeconds: 180 })
  })

  it('loads the new configuration namespaces globally', () => {
    const names = backendConfigLoaders.map(loader => loader.KEY)

    expect(names).toEqual(expect.arrayContaining([
      'CONFIGURATION(featureFlags)',
      'CONFIGURATION(sharding)',
      'CONFIGURATION(httpEgress)',
      'CONFIGURATION(prismaPool)',
    ]))
  })
})
