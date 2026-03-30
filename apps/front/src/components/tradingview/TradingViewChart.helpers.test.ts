import { describe, expect, it } from '@jest/globals'

import {
  extractLongShortRatioItems,
  getSafeChartFromWidget,
} from './TradingViewChart.helpers'

describe('TradingViewChart helpers', () => {
  describe('extractLongShortRatioItems', () => {
    it('returns array payload as-is', () => {
      const items = [
        { timestamp: '2026-03-30T00:00:00.000Z', longShortRatio: '1.2' },
        { timestamp: '2026-03-30T00:15:00.000Z', longShortRatio: '1.3' },
      ]

      expect(extractLongShortRatioItems(items)).toEqual(items)
    })

    it('unwraps paginated payload items array', () => {
      const payload = {
        total: 2,
        page: 1,
        limit: 2,
        items: [
          { timestamp: '2026-03-30T00:00:00.000Z', longShortRatio: '1.2' },
          { timestamp: '2026-03-30T00:15:00.000Z', longShortRatio: '1.3' },
        ],
      }

      expect(extractLongShortRatioItems(payload)).toEqual(payload.items)
    })

    it('falls back to empty array for invalid payload', () => {
      expect(extractLongShortRatioItems({ total: 0, page: 1, limit: 20 })).toEqual([])
    })
  })

  describe('getSafeChartFromWidget', () => {
    it('returns activeChart when available', () => {
      const chart = { id: 'chart-1' }
      const widget = {
        activeChart: () => chart,
        chart: () => ({ id: 'fallback' }),
      }

      expect(getSafeChartFromWidget(widget)).toBe(chart)
    })

    it('falls back to chart when activeChart throws', () => {
      const fallback = { id: 'fallback' }
      const widget = {
        activeChart: () => {
          throw new Error('activeChart unavailable')
        },
        chart: () => fallback,
      }

      expect(getSafeChartFromWidget(widget)).toBe(fallback)
    })

    it('returns null when both accessors fail', () => {
      const widget = {
        activeChart: () => {
          throw new Error('activeChart unavailable')
        },
        chart: () => {
          throw new Error('chart unavailable')
        },
      }

      expect(getSafeChartFromWidget(widget)).toBeNull()
    })
  })
})
