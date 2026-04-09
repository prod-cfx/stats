import {
  createRegistryProvider,
  DATA_PULL_JOB_CLASSES,
  ORDERBOOK_WS_ADAPTER_CLASSES,
  TRADES_WS_ADAPTER_CLASSES,
} from './data-sync.registry'

describe('data-sync registry', () => {
  it('维护稳定的 data pull job 声明列表', () => {
    expect(DATA_PULL_JOB_CLASSES.map(jobClass => jobClass.name)).toEqual([
      'ExampleKlineJob',
      'ExampleNewsJob',
      'CoinglassHeatmapJob',
      'CoinglassWhaleAlertJob',
      'CoinglassWhalePositionJob',
      'CoinglassCoinsPriceChangeJob',
      'CoinglassFuturesPriceHistoryJob',
      'BinanceKlineHistoryJob',
      'ExampleOrderbookJob',
      'OpenInterestSyncJob',
      'CoinglassOiOhlcAggregatedJob',
      'CoinglassAggregatedLiquidationJob',
      'CoinglassLongShortRatioJob',
      'CoinglassPairsMarketsJob',
      'CoinglassTakerVolumeJob',
      'BbxCryptoStockQuotesJob',
      'BbxCryptoStockScraperJob',
      'PolymarketMarketsJob',
      'PolymarketOrderbookJob',
      'HyperliquidUserFillsSyncJob',
      'HyperliquidUserOrdersSyncJob',
      'HyperliquidUserFundingSyncJob',
    ])
  })

  it('维护稳定的 orderbook adapter 声明列表', () => {
    expect(ORDERBOOK_WS_ADAPTER_CLASSES.map(adapterClass => adapterClass.name)).toEqual([
      'BinanceCexSpotOrderbookWsAdapter',
      'BinanceCexPerpetualOrderbookWsAdapter',
      'BinanceCexFutureOrderbookWsAdapter',
      'BitmaxCexSpotOrderbookWsAdapter',
      'BitmaxCexPerpetualOrderbookWsAdapter',
      'BitmaxCexFutureOrderbookWsAdapter',
      'BybitCexSpotOrderbookWsAdapter',
      'BybitCexPerpetualOrderbookWsAdapter',
      'BybitCexFutureOrderbookWsAdapter',
      'OkxCexSpotOrderbookWsAdapter',
      'OkxCexPerpetualOrderbookWsAdapter',
      'OkxCexFutureOrderbookWsAdapter',
      'HyperliquidDexPerpetualOrderbookWsAdapter',
      'HyperliquidDexSpotOrderbookWsAdapter',
    ])
  })

  it('维护稳定的 trades adapter 声明列表', () => {
    expect(TRADES_WS_ADAPTER_CLASSES.map(adapterClass => adapterClass.name)).toEqual([
      'BinanceCexSpotTradesWsAdapter',
      'BinanceCexPerpetualTradesWsAdapter',
      'BinanceCexFutureTradesWsAdapter',
      'OkxCexSpotTradesWsAdapter',
      'OkxCexPerpetualTradesWsAdapter',
      'OkxCexFutureTradesWsAdapter',
      'HyperliquidDexPerpetualTradesWsAdapter',
    ])
  })

  it('createRegistryProvider 使用声明顺序作为 inject 与输出顺序', () => {
    class Foo {}
    class Bar {}

    const provider = createRegistryProvider('TEST_REGISTRY', [Foo, Bar])
    const instances = [new Foo(), new Bar()]

    expect(provider.inject).toEqual([Foo, Bar])
    expect(provider.useFactory?.(...instances)).toEqual(instances)
  })

  it('catalog 中不存在重复 class', () => {
    const allCatalogs = [
      DATA_PULL_JOB_CLASSES,
      ORDERBOOK_WS_ADAPTER_CLASSES,
      TRADES_WS_ADAPTER_CLASSES,
    ]

    for (const catalog of allCatalogs) {
      const names = catalog.map(item => item.name)
      expect(new Set(names).size).toBe(names.length)
    }
  })
})
