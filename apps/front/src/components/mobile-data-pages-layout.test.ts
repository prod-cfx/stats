import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '..')

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

describe('mobile data pages layout contracts', () => {
  it('/market keeps mobile context sticky and gives the chart a non-zero mobile height', () => {
    const marketPage = readSource('app/[lng]/MarketPageClient.tsx')
    const topBar = readSource('components/trading/top-bar/TopBar.tsx')
    const centerChartPanel = readSource('components/trading/center-chart-panel/CenterChartPanel.tsx')
    const rightPanel = readSource('components/trading/right-panel/RightPanel.tsx')

    expect(marketPage).toContain('sticky top-0 z-40 md:static')
    expect(marketPage).toContain('min-h-[360px]')
    expect(marketPage).toContain('h-[58vh]')
    expect(topBar).toContain('md:h-[61px]')
    expect(topBar).toContain('overflow-x-auto')
    expect(topBar).toContain('min-w-0')
    expect(centerChartPanel).toContain('max-h-[calc(100dvh-2rem)]')
    expect(rightPanel).toContain('rounded-none border-l-0 md:rounded-xl md:border-l')
    expect(rightPanel).toContain('h-[160px] md:h-[200px]')
    expect(rightPanel).toContain('h-[360px] md:h-[420px]')
  })

  it('long/short and aggregated orderbook pages avoid double mobile padding and expose scroll affordances', () => {
    const longShortPage = readSource('app/[lng]/long-short-ratio/page.tsx')
    const longShortClient = readSource('app/[lng]/long-short-ratio/LongShortRatioClient.tsx')
    const aggregatedPage = readSource('app/[lng]/aggregated-orderbook/page.tsx')
    const aggregatedClient = readSource('app/[lng]/aggregated-orderbook/AggregatedOrderBookClient.tsx')
    const aggregatedOI = readSource('components/aggregated-orderbook/AggregatedOI.tsx')

    expect(longShortPage).toContain('p-4 md:p-8')
    expect(longShortClient).toContain('overflow-x-auto')
    expect(longShortClient).toContain('min-w-0')
    expect(aggregatedPage).toContain('p-4 md:p-8')
    expect(aggregatedClient).toContain('px-0 py-0 md:p-8')
    expect(aggregatedClient).toContain('aria-hidden="true"')
    expect(aggregatedClient).toContain('min-h-[560px] md:min-h-[750px]')
    expect(aggregatedOI).toContain('aria-hidden="true"')
  })

  it('prediction cards and public company tables keep long mobile text inside local containers', () => {
    const predictionGrid = readSource('components/prediction-market/PredictionMarketGrid.tsx')
    const predictionCard = readSource('components/prediction-market/PredictionCard.tsx')
    const publicCompanies = readSource('components/public-companies/PublicCompaniesTable.tsx')

    expect(predictionGrid).toContain('break-words')
    expect(predictionGrid).toContain('min-w-0')
    expect(predictionCard).toContain('min-w-0')
    expect(predictionCard).toContain('truncate')
    expect(predictionCard).toContain('flex-wrap')
    expect(publicCompanies).toContain('aria-hidden="true"')
    expect(publicCompanies).toContain('min-w-[840px] md:min-w-[1200px]')
    expect(publicCompanies).toContain('left-[56px] md:left-[88px]')
    expect(publicCompanies).toContain('break-words')
  })
})
