import type { DataSource, MarketType } from '@/types/trading'

export interface MarketItem {
  displaySymbol: string
  chartSymbol: string
  base: string
  price: number
  changePct: number
  /**
   * Turnover (USD), used as a rough proxy for "成交额"
   */
  volume: number
}

/**
 * Shared mock ticker list for both TopBar and global search.
 *
 * Notes:
 * - We keep this as a pure function so it can be reused anywhere without hooks.
 * - It mirrors the previous in-TopBar logic to avoid drifting UI behavior.
 */
export function getMockMarketList(args: {
  marketType: MarketType
  isAggregated: boolean
  selectedExchange: DataSource
}): MarketItem[] {
  const { marketType, isAggregated, selectedExchange } = args

  const baseList: MarketItem[] = [
    {
      displaySymbol: 'BTC',
      chartSymbol: 'BTCUSDT',
      base: 'BTC',
      price: 87010.0,
      changePct: -0.45,
      volume: 68200 * 87000,
    },
    {
      displaySymbol: 'ETH',
      chartSymbol: 'ETHUSDT',
      base: 'ETH',
      price: 4850.2,
      changePct: 1.25,
      volume: 450000 * 4800,
    },
    {
      displaySymbol: 'SOL',
      chartSymbol: 'SOLUSDT',
      base: 'SOL',
      price: 145.8,
      changePct: 5.4,
      volume: 1200000 * 145,
    },
    {
      displaySymbol: 'XRP',
      chartSymbol: 'XRPUSDT',
      base: 'XRP',
      price: 1.12,
      changePct: -2.3,
      volume: 50000000 * 1.1,
    },
    {
      displaySymbol: 'BNB',
      chartSymbol: 'BNBUSDT',
      base: 'BNB',
      price: 620.5,
      changePct: 0.8,
      volume: 150000 * 620,
    },
    {
      displaySymbol: 'DOGE',
      chartSymbol: 'DOGEUSDT',
      base: 'DOGE',
      price: 0.38,
      changePct: 8.5,
      volume: 800000000 * 0.38,
    },
    {
      displaySymbol: 'ADA',
      chartSymbol: 'ADAUSDT',
      base: 'ADA',
      price: 0.75,
      changePct: -1.1,
      volume: 45000000 * 0.75,
    },
    {
      displaySymbol: 'AVAX',
      chartSymbol: 'AVAXUSDT',
      base: 'AVAX',
      price: 42.6,
      changePct: 3.2,
      volume: 800000 * 42,
    },
    {
      displaySymbol: 'LINK',
      chartSymbol: 'LINKUSDT',
      base: 'LINK',
      price: 18.9,
      changePct: 0.5,
      volume: 1200000 * 18,
    },
    {
      displaySymbol: 'DOT',
      chartSymbol: 'DOTUSDT',
      base: 'DOT',
      price: 8.4,
      changePct: -0.9,
      volume: 2500000 * 8.4,
    },
  ]

  return baseList.map(item => {
    let price = item.price
    let volume = item.volume

    if (!isAggregated) {
      if (selectedExchange === 'binance') {
        price *= 1.0001
        volume *= 0.6
      } else {
        price *= 0.9999
        volume *= 0.3
      }
    }

    // Slightly different data for Spot vs Futures
    if (marketType === 'spot') {
      price *= 1.0005 // Spot usually slight premium/discount
      volume *= 0.8
    }

    const displaySymbol =
      marketType === 'futures'
        ? `${item.chartSymbol}` // BTCUSDT
        : `${item.base}/USDT` // BTC/USDT

    return {
      ...item,
      displaySymbol,
      price,
      volume,
    }
  })
}

