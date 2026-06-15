import { describe, expect, it } from '@jest/globals'

import {
  extractLongShortRatioItems,
  findAndDedupeStudyByName,
  getSafeChartFromWidget,
  moveButtonsToHeaderRight,
  resolveMaybePromiseId,
} from './trading-view-chart.helpers'

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

  describe('resolveMaybePromiseId', () => {
    it('resolves immediate ids', () => {
      const onResolved = jest.fn()

      resolveMaybePromiseId(42, onResolved)

      expect(onResolved).toHaveBeenCalledWith('42')
    })

    it('resolves promise ids', async () => {
      const onResolved = jest.fn()

      resolveMaybePromiseId(Promise.resolve('study-1'), onResolved)
      await Promise.resolve()

      expect(onResolved).toHaveBeenCalledWith('study-1')
    })
  })

  describe('findAndDedupeStudyByName', () => {
    it('keeps the first matching study and removes duplicates', () => {
      const removeEntity = jest.fn()
      const chart = {
        getAllStudies: () => [
          { id: 'keep', name: 'Agg Volume' },
          { id: 'other', name: 'Other' },
          { id: 'drop', name: 'Agg Volume' },
        ],
        removeEntity,
      }

      expect(findAndDedupeStudyByName(chart, 'Agg Volume')).toBe('keep')
      expect(removeEntity).toHaveBeenCalledWith('drop')
    })
  })

  describe('moveButtonsToHeaderRight', () => {
    it('uses activeChart contentWindow when iframe internals are unavailable', () => {
      const header = document.createElement('div')
      header.className = 'header-chart-panel'
      const anchor = document.createElement('button')
      Object.defineProperty(anchor, 'getBoundingClientRect', {
        value: () => ({ width: 20, height: 20, top: 10, right: 100 }),
      })
      header.appendChild(anchor)
      document.body.appendChild(header)

      const custom = document.createElement('button')
      const widget = {
        activeChart: () => ({ contentWindow: window }),
      }

      moveButtonsToHeaderRight(widget, [custom])

      expect(header.contains(custom)).toBe(true)
      document.body.removeChild(header)
    })
  })
})
