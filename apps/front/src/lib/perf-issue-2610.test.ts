import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@jest/globals'

const FRONT_ROOT = join(__dirname, '..')

function readFrontSource(relativePath: string) {
  return readFileSync(join(FRONT_ROOT, relativePath), 'utf8')
}

const formatterTargets = [
  'components/aggregated-orderbook/AggregatedOI.tsx',
  'components/aggregated-orderbook/AggregatedOrderbookView.tsx',
  'components/liquidation-data/LiquidationSummary.tsx',
  'components/trading/right-panel/RightPanel.tsx',
  'app/[lng]/long-short-ratio/LongShortRatioClient.tsx',
  'components/trading/left-trade-panel/LeftTradePanel.tsx',
  'components/liquidation-data/ExchangeLiquidationTable.tsx',
  'components/trading/top-bar/TopBar.tsx',
  'components/whale-tracking/discover/TraderCard.tsx',
  'features/dashboards/widgets/contents/LongShortRatioWidget.tsx',
  'components/trading/bottom-panel/BottomPanel.tsx',
]

const sortTargets = [
  'components/whale-tracking/holdings/WhalePositionsTable.tsx',
  'components/aggregated-orderbook/AggregatedOI.tsx',
  'components/whale-tracking/realtime/RealtimeWhalesTable.tsx',
  'components/aggregated-orderbook/AggregatedOrderbookView.tsx',
  'components/public-companies/PublicCompaniesTable.tsx',
  'components/aggregated-orderbook/AggregatedVolume.tsx',
  'components/aggregated-orderbook/OrderbookTable.tsx',
  'components/aggregated-orderbook/DepthChart.tsx',
  'components/whale-tracking/discover/DiscoverGrid.tsx',
]

describe('issue #2610 formatter and array performance hotspots', () => {
  it('keeps listed render targets from constructing Intl.NumberFormat directly', () => {
    for (const target of formatterTargets) {
      expect(readFrontSource(target)).not.toContain('new Intl.NumberFormat')
    }
  })

  it('uses runtime-compatible immutable sort copies in listed files', () => {
    for (const target of sortTargets) {
      const source = readFrontSource(target)

      expect(source).not.toMatch(/\[\.\.\.[^\]]+\]\.sort\(/)
      expect(source).not.toContain('.slice().sort(')
      expect(source).not.toContain('.toSorted(')
    }
  })

  it('removes repeated filter/map chains from listed hot paths', () => {
    const centerChartPanel = readFrontSource('components/trading/center-chart-panel/CenterChartPanel.tsx')
    const displayLogicGraph = readFrontSource('components/ai-quant/DisplayLogicGraphPreview.tsx')
    const strategyPlaza = readFrontSource('components/ai-quant/StrategyPlaza.tsx')

    expect(centerChartPanel).not.toContain(".filter(x => x.kind === 'chartSeries' || x.kind === 'chartOverlay')")
    expect(centerChartPanel).not.toContain(".filter(x => x.group === 'featured')")
    expect(centerChartPanel).not.toContain('.filter(x => x.isActive)')
    expect(displayLogicGraph).not.toContain('block.items.filter(isExecuteItem).map(')
    expect(displayLogicGraph).not.toContain(".filter(item => item.kind === 'condition')")
    expect(displayLogicGraph).not.toContain(".filter(item => item.kind === 'action')")
    expect(strategyPlaza).not.toContain("favoriteOnly\n          ? favorites[item.template.id]")
    expect(strategyPlaza).not.toContain(".filter(\n        item =>")
    expect(strategyPlaza).not.toContain('.slice().sort(')
  })
})
