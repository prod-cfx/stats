import type { TradingPairConfig } from '../types/trading-pair'

export const TRADING_PAIRS: TradingPairConfig[] = [
  // CEX 现货
  {
    id: 'BTCUSDT.BINANCE.SPOT',
    venueType: 'CEX',
    exchange: 'BINANCE',
    symbol: 'BTCUSDT',
    displaySymbol: 'BTC/USDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    instrumentType: 'SPOT',
    pricePrecision: 2,
    quantityPrecision: 6,
    minNotional: 10,
    enabled: true,
  },

  // CEX 永续合约
  {
    id: 'BTCUSDT.BINANCE.PERP',
    venueType: 'CEX',
    exchange: 'BINANCE',
    symbol: 'BTCUSDT',
    displaySymbol: 'BTC/USDT Perp',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    instrumentType: 'PERPETUAL',
    pricePrecision: 2,
    quantityPrecision: 3,
    minNotional: 10,
    maxLeverage: 50,
    contractSize: 1,
    enabled: true,
  },

  // DEX 现货池
  {
    id: 'BTCUSDT.UNISWAPV3.ETH_MAINNET',
    venueType: 'DEX',
    dexName: 'UNISWAP_V3',
    chainId: 1,
    baseTokenAddress: '0xBTC...',
    quoteTokenAddress: '0xUSDT...',
    poolAddress: '0xPOOL...',
    symbol: 'BTC/USDT',
    displaySymbol: 'BTC/USDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    instrumentType: 'SPOT',
    pricePrecision: 2,
    quantityPrecision: 6,
    enabled: true,
  },
]
