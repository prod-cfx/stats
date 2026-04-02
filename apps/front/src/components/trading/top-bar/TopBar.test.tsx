import type { TickerData } from '@/lib/api'
import { describe, expect, it } from '@jest/globals'

import {
  calculateFromTicker,
  calculatePriceChange,
  calculateTopBarDisplayValues,
} from './price-change'

describe('top-bar - calculatePriceChange', () => {
  describe('实时 K线 + ticker 24h 前价格', () => {
    it('应该基于实时 K线价格和 ticker 数据计算涨跌幅', () => {
      const tickerData: TickerData = {
        symbol: 'BTCUSDT',
        currentPrice: '100',
        priceChangePercent24h: '10',
        volumeUsd: '1000000',
      }
      const klineClosePrice = 110
      const lastPrice = 110
      const fallbackPct = 0.5

      const result = calculatePriceChange(tickerData, klineClosePrice, lastPrice, fallbackPct)

      // 24h 前价格 = 100 / (1 + 0.1) = 90.909...
      // 涨跌幅 = (110 - 90.909) / 90.909 * 100 = 21.0%
      expect(result.changePct).toBeCloseTo(21.0, 1)
      expect(result.changeAbs).toBeCloseTo(19.09, 1)
    })

    it('应该处理负涨跌幅', () => {
      const tickerData: TickerData = {
        symbol: 'BTCUSDT',
        currentPrice: '100',
        priceChangePercent24h: '-10',
        volumeUsd: '1000000',
      }
      const klineClosePrice = 90
      const lastPrice = 90
      const fallbackPct = 0.5

      const result = calculatePriceChange(tickerData, klineClosePrice, lastPrice, fallbackPct)

      // 24h 前价格 = 100 / (1 - 0.1) = 111.111...
      // 涨跌幅 = (90 - 111.111) / 111.111 * 100 = -19.0%
      expect(result.changePct).toBeCloseTo(-19.0, 1)
      expect(result.changeAbs).toBeCloseTo(-21.11, 1)
    })
  })

  describe('降级到 ticker 数据', () => {
    it('当 klineClosePrice 为 null 时应该使用 ticker 数据', () => {
      const tickerData: TickerData = {
        symbol: 'BTCUSDT',
        currentPrice: '100',
        priceChangePercent24h: '10',
        volumeUsd: '1000000',
      }
      const klineClosePrice = null
      const lastPrice = 100
      const fallbackPct = 0.5

      const result = calculatePriceChange(tickerData, klineClosePrice, lastPrice, fallbackPct)

      expect(result.changePct).toBe(10)
      expect(result.changeAbs).toBe(10)
    })

    it('当 ticker 数据无效时应该降级到 ticker', () => {
      const tickerData: TickerData = {
        symbol: 'BTCUSDT',
        currentPrice: 'invalid',
        priceChangePercent24h: '10',
        volumeUsd: '1000000',
      }
      const klineClosePrice = 110
      const lastPrice = 110
      const fallbackPct = 0.5

      const result = calculatePriceChange(tickerData, klineClosePrice, lastPrice, fallbackPct)

      expect(result.changePct).toBe(10)
      expect(result.changeAbs).toBe(11)
    })
  })

  describe('降级到 mock 数据', () => {
    it('当没有 ticker 数据时应该使用 fallback', () => {
      const tickerData = null
      const klineClosePrice = null
      const lastPrice = 100
      const fallbackPct = 0.5

      const result = calculatePriceChange(tickerData, klineClosePrice, lastPrice, fallbackPct)

      expect(result.changePct).toBe(0.5)
      expect(result.changeAbs).toBe(0.5)
    })
  })

  describe('边界情况', () => {
    it('应该处理 pctFactor 为 0 的情况', () => {
      const tickerData: TickerData = {
        symbol: 'BTCUSDT',
        currentPrice: '100',
        priceChangePercent24h: '-100',
        volumeUsd: '1000000',
      }
      const klineClosePrice = 110
      const lastPrice = 110
      const fallbackPct = 0.5

      const result = calculatePriceChange(tickerData, klineClosePrice, lastPrice, fallbackPct)

      expect(result.changePct).toBe(-100)
    })

    it('应该处理 price24hAgo 为 0 的情况', () => {
      const tickerData: TickerData = {
        symbol: 'BTCUSDT',
        currentPrice: '0',
        priceChangePercent24h: '10',
        volumeUsd: '1000000',
      }
      const klineClosePrice = 110
      const lastPrice = 110
      const fallbackPct = 0.5

      const result = calculatePriceChange(tickerData, klineClosePrice, lastPrice, fallbackPct)

      expect(result.changePct).toBe(10)
    })
  })
})

describe('top-bar - calculateFromTicker', () => {
  it('应该从 ticker 数据计算涨跌幅', () => {
    const tickerData: TickerData = {
      symbol: 'BTCUSDT',
      currentPrice: '100',
      priceChangePercent24h: '10',
      volumeUsd: '1000000',
    }
    const lastPrice = 110

    const result = calculateFromTicker(tickerData, lastPrice)

    expect(result.changePct).toBe(10)
    expect(result.changeAbs).toBe(11)
  })
})

describe('top-bar - calculatetop-barDisplayValues', () => {
  it('ticker 正常时：展示严格使用 ticker last + 24h change%', () => {
    const tickerData: TickerData = {
      symbol: 'BTCUSDT',
      currentPrice: '50000',
      priceChangePercent24h: '2.5',
      volumeUsd: '1000000',
    }

    const result = calculateTopBarDisplayValues({
      tickerData,
      isAggregated: false,
      selectedExchange: 'binance',
      basePrice: 87010,
      fallbackPct: 0.5,
    })

    expect(result.displayLastPrice).toBe(50000)
    expect(result.displayChangePct).toBe(2.5)
    expect(result.displayChangeAbs).toBeCloseTo(1250, 6)
  })

  it('ticker 缺失时：展示回退到 mock，不应出现 NaN', () => {
    const result = calculateTopBarDisplayValues({
      tickerData: null,
      isAggregated: true,
      selectedExchange: 'okx',
      basePrice: 100,
      fallbackPct: 0.5,
    })

    expect(Number.isFinite(result.displayLastPrice)).toBe(true)
    expect(Number.isFinite(result.displayChangePct)).toBe(true)
    expect(Number.isFinite(result.displayChangeAbs)).toBe(true)
  })

  it('ticker 数据非法时：展示回退到 fallbackPct', () => {
    const tickerData: TickerData = {
      symbol: 'BTCUSDT',
      currentPrice: '50000',
      priceChangePercent24h: 'abc',
      volumeUsd: '1000000',
    }

    const result = calculateTopBarDisplayValues({
      tickerData,
      isAggregated: false,
      isBinance: true,
      basePrice: 100,
      fallbackPct: 0.5,
    })

    expect(result.displayLastPrice).toBeCloseTo(100.01, 6)
    expect(result.displayChangePct).toBe(0.5)
    expect(result.displayChangeAbs).toBeCloseTo(0.50005, 6)
  })
})
