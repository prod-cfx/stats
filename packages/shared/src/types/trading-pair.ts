import type { MarketInstrumentType } from './market-data'

// 交易配置使用的 venue 类型（与订单簿 VenueType 区分开）
export const TRADING_VENUE_TYPES = ['DEX', 'CEX'] as const
export type TradingVenueType = (typeof TRADING_VENUE_TYPES)[number]

export const EXCHANGES = ['BINANCE', 'OKX', 'BYBIT'] as const
export type TradingExchangeId = (typeof EXCHANGES)[number]

export interface BaseTradingPairConfig {
  /** 统一内部 ID，例如 BTCUSDT.BINANCE.PERP */
  id: string
  /** 展示用符号，例如 BTC/USDT */
  displaySymbol: string
  /** 统一 symbol，例如 BTCUSDT 或 BTC-USDT */
  symbol: string
  baseAsset: string
  quoteAsset: string

  /** 现货 / 永续 / 期货 */
  instrumentType: MarketInstrumentType

  /** 精度与下单约束 */
  pricePrecision: number
  quantityPrecision: number
  minNotional?: number
  minQuantity?: number

  /** 是否启用 */
  enabled: boolean
}

/** CEX 专用配置 */
export interface CexTradingPairConfig extends BaseTradingPairConfig {
  venueType: 'CEX'
  /** 交易所 ID */
  exchange: TradingExchangeId
  /** 交易所原始 symbol（与内部 symbol 不一致时使用） */
  exchangeSymbol?: string
  /** 杠杆与合约面值等 */
  maxLeverage?: number
  contractSize?: number
}

/** DEX 专用配置 */
export interface DexTradingPairConfig extends BaseTradingPairConfig {
  venueType: 'DEX'
  /** 链 ID，例如 1=Ethereum Mainnet */
  chainId: number
  /** Token 合约地址 */
  baseTokenAddress: string
  quoteTokenAddress: string
  /** 路由 / 池子配置 */
  routerAddress?: string
  poolAddress?: string
  /** DEX 名称，例如 UNISWAP_V3 */
  dexName: string
}

export type TradingPairConfig = CexTradingPairConfig | DexTradingPairConfig

