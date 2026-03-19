import { marketDataConfig } from './configuration'

describe('marketDataConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.MARKET_DATA_SPOT_REST_BASE_URL
    delete process.env.MARKET_DATA_PERP_REST_BASE_URL
    delete process.env.MARKET_DATA_SPOT_WS_BASE_URL
    delete process.env.MARKET_DATA_PERP_WS_BASE_URL
    delete process.env.MARKET_DATA_SPOT_REST_PATH_TEMPLATE
    delete process.env.MARKET_DATA_PERP_REST_PATH_TEMPLATE
    delete process.env.MARKET_DATA_SPOT_EXCHANGE_INFO_PATH
    delete process.env.MARKET_DATA_PERP_EXCHANGE_INFO_PATH
    delete process.env.MARKET_DATA_SPOT_WS_PATH_TEMPLATE
    delete process.env.MARKET_DATA_PERP_WS_PATH_TEMPLATE
    process.env.MARKET_DATA_API_BASE_URL = 'https://api.binance.com'
    process.env.MARKET_DATA_WS_URL = 'wss://stream.binance.com:9443'
    process.env.MARKET_DATA_WS_STREAM_PATH = 'stream?streams='
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('falls back to default spot/perp endpoints when dedicated env vars are absent', () => {
    const config = marketDataConfig()

    expect(config.spotRestBaseUrl).toBe('https://api.binance.com')
    expect(config.perpRestBaseUrl).toBe('https://fapi.binance.com')
    expect(config.spotWsBaseUrl).toBe('wss://stream.binance.com:9443')
    expect(config.perpWsBaseUrl).toBe('wss://fstream.binance.com')
    expect(config.spotRestPathTemplate).toBe('/api/v3/klines')
    expect(config.perpRestPathTemplate).toBe('/fapi/v1/klines')
    expect(config.spotExchangeInfoPath).toBe('/api/v3/exchangeInfo')
    expect(config.perpExchangeInfoPath).toBe('/fapi/v1/exchangeInfo')
    expect(config.spotWsPathTemplate).toBe('stream?streams=')
    expect(config.perpWsPathTemplate).toBe('stream?streams=')
  })
})
