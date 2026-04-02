import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const FRONT_ROOT = join(fileURLToPath(new URL('..', import.meta.url)))

function readFrontSource(relativePath: string) {
  return readFileSync(join(FRONT_ROOT, relativePath), 'utf8')
}

describe('issue #618 chart bundle guards', () => {
  it('uses modular echarts imports instead of the full library entrypoint', () => {
    const liquidationMapChart = readFrontSource(
      'components/liquidation-map/LiquidationMapChart.tsx',
    )
    const pnlTrendChart = readFrontSource('components/whale-tracking/profile/PnLTrendChart.tsx')

    expect(liquidationMapChart).not.toContain("import * as echarts from 'echarts'")
    expect(pnlTrendChart).not.toContain("import * as echarts from 'echarts'")

    expect(liquidationMapChart).toContain("from 'echarts/core'")
    expect(pnlTrendChart).toContain("from 'echarts/core'")
  })

  it('avoids static echarts-for-react imports in lazy chart components', () => {
    const depthChart = readFrontSource('components/aggregated-orderbook/DepthChart.tsx')
    const whaleTradingStatsModal = readFrontSource(
      'components/whale-tracking/WhaleTradingStatsModal.tsx',
    )
    const profileSummary = readFrontSource('components/whale-tracking/profile/ProfileSummary.tsx')

    expect(depthChart).not.toContain("from 'echarts-for-react'")
    expect(whaleTradingStatsModal).not.toContain("from 'echarts-for-react'")
    expect(profileSummary).not.toContain("from 'echarts-for-react'")
  })

  it('lazy loads the heavy chart components from their callers', () => {
    const expectedLazyImports = [
      [
        'app/[lng]/liquidation-map/LiquidationMapClient.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/liquidation-map\/LiquidationMapChart'\)/,
      ],
      [
        'features/dashboards/widgets/contents/LiquidationMapWidget.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/liquidation-map\/LiquidationMapChart'\)/,
      ],
      [
        'components/tradingview/TradingViewChart.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/liquidation-map\/LiquidationMapChart'\)/,
      ],
      [
        'components/trading/center-chart-panel/TradingViewLightweightChart.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/liquidation-map\/LiquidationMapChart'\)/,
      ],
      [
        'components/whale-tracking/profile/PnLTrendCard.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('\.\/PnLTrendChart'\)/,
      ],
      [
        'components/aggregated-orderbook/AggregatedOrderbookView.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/aggregated-orderbook\/DepthChart'\)/,
      ],
      [
        'components/whale-tracking/discover/DiscoverGrid.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('\.\.\/WhaleTradingStatsModal'\)/,
      ],
      [
        'components/whale-tracking/notifications/AddressMonitorSection.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/whale-tracking\/WhaleTradingStatsModal'\)/,
      ],
      [
        'components/whale-tracking/realtime/RealtimeWhalesTable.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('\.\.\/WhaleTradingStatsModal'\)/,
      ],
      [
        'components/whale-tracking/holdings/WhalePositionsTable.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('\.\.\/WhaleTradingStatsModal'\)/,
      ],
      [
        'app/[lng]/whale-tracking/profile/ProfileClient.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/whale-tracking\/profile\/ProfileSummary'\)/,
      ],
    ] as const

    for (const [file, lazyImport] of expectedLazyImports) {
      const source = readFrontSource(file)
      expect(source, file).toContain("from 'next/dynamic'")
      expect(source, file).toMatch(lazyImport)
    }
  })

  it('lazy loads modal-heavy interaction surfaces from their callers', () => {
    const expectedLazyImports = [
      [
        'features/dashboards/components/DashboardCanvas.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/dashboard\/AddWidgetModal'\)/,
      ],
      [
        'components/dashboard/EditorCanvas.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('\.\/AddWidgetModal'\)/,
      ],
      [
        'app/[lng]/whale-tracking/profile/ProfileClient.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('@\/features\/whale-notification\/components\/CreateMonitorModal'\)/,
      ],
      [
        'components/whale-tracking/notifications/NotificationsClient.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('@\/features\/whale-notification\/components\/CreateMonitorModal'\)/,
      ],
      [
        'components/whale-tracking/notifications/AddressMonitorSection.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('@\/features\/whale-notification\/components\/CreateMonitorModal'\)/,
      ],
      [
        'components/whale-tracking/realtime/RealtimeWhalesTable.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('@\/features\/whale-notification\/components\/CreateMonitorModal'\)/,
      ],
      [
        'app/[lng]/prediction-market/page.tsx',
        /dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/prediction-market\/PredictionMarketGrid'\)/,
      ],
    ] as const

    for (const [file, lazyImport] of expectedLazyImports) {
      const source = readFrontSource(file)
      expect(source, file).toContain("from 'next/dynamic'")
      expect(source, file).toMatch(lazyImport)
    }
  })
})
