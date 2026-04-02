import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@jest/globals'

const FRONT_ROOT = join(__dirname, '..')

function readFrontSource(relativePath: string) {
  return readFileSync(join(FRONT_ROOT, relativePath), 'utf8')
}

describe('issue #625 rerender guards', () => {
  it('resets aggregated orderbook exchanges without effect-driven derived state', () => {
    const source = readFrontSource('components/aggregated-orderbook/AggregatedOrderbookView.tsx')

    expect(source).not.toContain('useEffect(() => {\n    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect\n    setSelectedExchanges(')
    expect(source).toContain('const handleMarketTypeChange = useCallback(')
    expect(source).toContain('if (nextMarketType === marketType)')
    expect(source).toContain("setSelectedExchanges(nextMarketType === 'futures' ? FUTURES_EXCHANGES : SPOT_EXCHANGES)")
  })

  it('keeps aggregated orderbook mode icons stable at module scope', () => {
    const source = readFrontSource('components/aggregated-orderbook/AggregatedOrderbookView.tsx')

    expect(source).toContain('const BothIcon = memo(')
    expect(source).toContain('const BidsIcon = memo(')
    expect(source).toContain('const AsksIcon = memo(')
  })

  it('memoizes interaction callbacks in discover and filter components', () => {
    const traderCard = readFrontSource('components/whale-tracking/discover/TraderCard.tsx')
    const filterButton = readFrontSource('components/ui/FilterButton.tsx')

    expect(traderCard).toContain('const copyAddress = useCallback(async (e: React.MouseEvent) => {')
    expect(filterButton).toContain('const handleClickOutside = useCallback((event: MouseEvent) => {')
    expect(filterButton).toContain('}, [])')
    expect(filterButton).toContain("document.addEventListener('mousedown', handleClickOutside)")
  })

  it('reuses memoized style objects for frequently rerendered rows and avatars', () => {
    const orderbookTable = readFrontSource('components/aggregated-orderbook/OrderbookTable.tsx')
    const traderCard = readFrontSource('components/whale-tracking/discover/TraderCard.tsx')

    expect(orderbookTable).toContain('const rowButtonStyle = useMemo(')
    expect(orderbookTable).toContain('const depthBarStyle = useMemo(')
    expect(orderbookTable).toContain('const tableBodyStyle = useMemo(')
    expect(orderbookTable).toContain('const rowContainerStyle = useMemo(')
    expect(traderCard).toContain('const avatarStyle = useMemo(')
    expect(traderCard).toContain('style={avatarStyle}')
  })
})
