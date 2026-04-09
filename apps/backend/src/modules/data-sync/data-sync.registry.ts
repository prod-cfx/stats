import type { FactoryProvider, Type } from '@nestjs/common'
import type { DataPullJob } from './contracts/data-pull-job'
import type { OrderbookWsAdapter } from './services/orderbook-ws-adapter'
import type { TradesWsAdapter } from './services/trades-ws-adapter'
import { CoinglassOiOhlcAggregatedJob } from '@/modules/open-interest/jobs/oi-ohlc-aggregated.job'
import { OpenInterestSyncJob } from '@/modules/open-interest/jobs/open-interest-sync.job'
import {
  DATA_PULL_JOB_REGISTRY,
  ORDERBOOK_WS_ADAPTER_REGISTRY,
  TRADES_WS_ADAPTER_REGISTRY,
} from './data-sync.tokens'
import { BbxCryptoStockQuotesJob } from './jobs/bbx-crypto-stock-quotes.job'
import { BbxCryptoStockScraperJob } from './jobs/bbx-crypto-stock-scraper.job'
import { BinanceKlineHistoryJob } from './jobs/binance-kline-history.job'
import { CoinglassAggregatedLiquidationJob } from './jobs/coinglass-aggregated-liquidation.job'
import { CoinglassCoinsPriceChangeJob } from './jobs/coinglass-coins-price-change.job'
import { CoinglassFuturesPriceHistoryJob } from './jobs/coinglass-futures-price-history.job'
import { CoinglassHeatmapJob } from './jobs/coinglass-heatmap.job'
import { CoinglassLongShortRatioJob } from './jobs/coinglass-long-short-ratio.job'
import { CoinglassPairsMarketsJob } from './jobs/coinglass-pairs-markets.job'
import { CoinglassTakerVolumeJob } from './jobs/coinglass-taker-volume.job'
import { CoinglassWhaleAlertJob } from './jobs/coinglass-whale-alert.job'
import { CoinglassWhalePositionJob } from './jobs/coinglass-whale-position.job'
import { ExampleKlineJob } from './jobs/example-kline.job'
import { ExampleNewsJob } from './jobs/example-news.job'
import { ExampleOrderbookJob } from './jobs/example-orderbook.job'
import { HyperliquidUserFillsSyncJob } from './jobs/hyperliquid-user-fills-sync.job'
import { HyperliquidUserFundingSyncJob } from './jobs/hyperliquid-user-funding-sync.job'
import { HyperliquidUserOrdersSyncJob } from './jobs/hyperliquid-user-orders-sync.job'
import { PolymarketMarketsJob } from './jobs/polymarket-markets.job'
import { PolymarketOrderbookJob } from './jobs/polymarket-orderbook.job'
import { BinanceCexFutureOrderbookWsAdapter } from './services/adapters/binance-cex-future-orderbook-ws.adapter'
import { BinanceCexFutureTradesWsAdapter } from './services/adapters/binance-cex-future-trades-ws.adapter'
import { BinanceCexPerpetualOrderbookWsAdapter } from './services/adapters/binance-cex-perpetual-orderbook-ws.adapter'
import { BinanceCexPerpetualTradesWsAdapter } from './services/adapters/binance-cex-perpetual-trades-ws.adapter'
import { BinanceCexSpotOrderbookWsAdapter } from './services/adapters/binance-cex-spot-orderbook-ws.adapter'
import { BinanceCexSpotTradesWsAdapter } from './services/adapters/binance-cex-spot-trades-ws.adapter'
import { BitmaxCexFutureOrderbookWsAdapter } from './services/adapters/bitmax-cex-future-orderbook-ws.adapter'
import { BitmaxCexPerpetualOrderbookWsAdapter } from './services/adapters/bitmax-cex-perpetual-orderbook-ws.adapter'
import { BitmaxCexSpotOrderbookWsAdapter } from './services/adapters/bitmax-cex-spot-orderbook-ws.adapter'
import { BybitCexFutureOrderbookWsAdapter } from './services/adapters/bybit-cex-future-orderbook-ws.adapter'
import { BybitCexPerpetualOrderbookWsAdapter } from './services/adapters/bybit-cex-perpetual-orderbook-ws.adapter'
import { BybitCexSpotOrderbookWsAdapter } from './services/adapters/bybit-cex-spot-orderbook-ws.adapter'
import { HyperliquidDexPerpetualOrderbookWsAdapter } from './services/adapters/hyperliquid-dex-perpetual-orderbook-ws.adapter'
import { HyperliquidDexPerpetualTradesWsAdapter } from './services/adapters/hyperliquid-dex-perpetual-trades-ws.adapter'
import { HyperliquidDexSpotOrderbookWsAdapter } from './services/adapters/hyperliquid-dex-spot-orderbook-ws.adapter'
import { OkxCexFutureOrderbookWsAdapter } from './services/adapters/okx-cex-future-orderbook-ws.adapter'
import { OkxCexFutureTradesWsAdapter } from './services/adapters/okx-cex-future-trades-ws.adapter'
import { OkxCexPerpetualOrderbookWsAdapter } from './services/adapters/okx-cex-perpetual-orderbook-ws.adapter'
import { OkxCexPerpetualTradesWsAdapter } from './services/adapters/okx-cex-perpetual-trades-ws.adapter'
import { OkxCexSpotOrderbookWsAdapter } from './services/adapters/okx-cex-spot-orderbook-ws.adapter'
import { OkxCexSpotTradesWsAdapter } from './services/adapters/okx-cex-spot-trades-ws.adapter'

type RegistryClass = Type<unknown>

export function createRegistryProvider<T>(
  token: string,
  classes: readonly RegistryClass[],
): FactoryProvider<T[]> {
  return {
    provide: token,
    useFactory: (...instances: T[]): T[] => instances,
    inject: [...classes],
  }
}

// 新增 data pull job 时，只需在此列表维护一次。
export const DATA_PULL_JOB_CLASSES = [
  ExampleKlineJob,
  ExampleNewsJob,
  CoinglassHeatmapJob,
  CoinglassWhaleAlertJob,
  CoinglassWhalePositionJob,
  CoinglassCoinsPriceChangeJob,
  CoinglassFuturesPriceHistoryJob,
  BinanceKlineHistoryJob,
  ExampleOrderbookJob,
  OpenInterestSyncJob,
  CoinglassOiOhlcAggregatedJob,
  CoinglassAggregatedLiquidationJob,
  CoinglassLongShortRatioJob,
  CoinglassPairsMarketsJob,
  CoinglassTakerVolumeJob,
  BbxCryptoStockQuotesJob,
  BbxCryptoStockScraperJob,
  PolymarketMarketsJob,
  PolymarketOrderbookJob,
  HyperliquidUserFillsSyncJob,
  HyperliquidUserOrdersSyncJob,
  HyperliquidUserFundingSyncJob,
] as const satisfies readonly Type<DataPullJob>[]

// 新增 orderbook adapter 时，只需在此列表维护一次。
export const ORDERBOOK_WS_ADAPTER_CLASSES = [
  BinanceCexSpotOrderbookWsAdapter,
  BinanceCexPerpetualOrderbookWsAdapter,
  BinanceCexFutureOrderbookWsAdapter,
  BitmaxCexSpotOrderbookWsAdapter,
  BitmaxCexPerpetualOrderbookWsAdapter,
  BitmaxCexFutureOrderbookWsAdapter,
  BybitCexSpotOrderbookWsAdapter,
  BybitCexPerpetualOrderbookWsAdapter,
  BybitCexFutureOrderbookWsAdapter,
  OkxCexSpotOrderbookWsAdapter,
  OkxCexPerpetualOrderbookWsAdapter,
  OkxCexFutureOrderbookWsAdapter,
  HyperliquidDexPerpetualOrderbookWsAdapter,
  HyperliquidDexSpotOrderbookWsAdapter,
] as const satisfies readonly Type<OrderbookWsAdapter>[]

// 新增 trades adapter 时，只需在此列表维护一次。
export const TRADES_WS_ADAPTER_CLASSES = [
  BinanceCexSpotTradesWsAdapter,
  BinanceCexPerpetualTradesWsAdapter,
  BinanceCexFutureTradesWsAdapter,
  OkxCexSpotTradesWsAdapter,
  OkxCexPerpetualTradesWsAdapter,
  OkxCexFutureTradesWsAdapter,
  HyperliquidDexPerpetualTradesWsAdapter,
] as const satisfies readonly Type<TradesWsAdapter>[]

export const DATA_PULL_JOB_PROVIDERS = [
  ...DATA_PULL_JOB_CLASSES,
  createRegistryProvider<DataPullJob>(DATA_PULL_JOB_REGISTRY, DATA_PULL_JOB_CLASSES),
] as const

export const ORDERBOOK_WS_ADAPTER_PROVIDERS = [
  ...ORDERBOOK_WS_ADAPTER_CLASSES,
  createRegistryProvider<OrderbookWsAdapter>(
    ORDERBOOK_WS_ADAPTER_REGISTRY,
    ORDERBOOK_WS_ADAPTER_CLASSES,
  ),
] as const

export const TRADES_WS_ADAPTER_PROVIDERS = [
  ...TRADES_WS_ADAPTER_CLASSES,
  createRegistryProvider<TradesWsAdapter>(
    TRADES_WS_ADAPTER_REGISTRY,
    TRADES_WS_ADAPTER_CLASSES,
  ),
] as const
