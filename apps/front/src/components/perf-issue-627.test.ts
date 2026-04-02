import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@jest/globals'

const FRONT_ROOT = join(__dirname, '..')

function readFrontSource(relativePath: string) {
  return readFileSync(join(FRONT_ROOT, relativePath), 'utf8')
}

describe('issue #627 js micro-optimizations', () => {
  it('avoids chained array traversals in hot utility and rendering paths', () => {
    const exchangeApiSection = readFrontSource('components/account/ExchangeApiSection.tsx')
    const profileDataTabs = readFrontSource('components/whale-tracking/profile/ProfileDataTabs.tsx')
    const strategyParamSync = readFrontSource('components/ai-quant/strategy-param-sync.ts')

    expect(exchangeApiSection).not.toContain('EXCHANGES.filter(exchangeId => accounts[exchangeId].isBound).map(')
    expect(profileDataTabs).not.toContain('order.details.map(d => d.id).filter(Boolean)')
    expect(strategyParamSync).not.toContain('entryRules.map(extractWindowDropRule).find(Boolean)')
    expect(strategyParamSync).not.toContain('exitRules.map(extractWindowRiseRule).find(Boolean)')
    expect(strategyParamSync).not.toContain('entryRules.map(extractPriceRule).find(')
    expect(strategyParamSync).not.toContain('exitRules.map(extractPriceRule).find(')
  })

  it('uses Set lookups instead of linear includes checks inside loops', () => {
    const centerChartPanel = readFrontSource('components/trading/center-chart-panel/CenterChartPanel.tsx')
    const hyperliquidApi = readFrontSource('lib/hyperliquid-api.ts')

    expect(centerChartPanel).toContain('const activeIdSet = new Set(activeIds)')
    expect(centerChartPanel).toContain('isActive: activeIdSet.has(x.id)')
    expect(centerChartPanel).toContain('if (activeIdSet.has(id)) {')
    expect(hyperliquidApi).toContain('const tokenIndexSet = new Set([tokenIndex])')
    expect(hyperliquidApi).toContain('u.tokens.some(token => tokenIndexSet.has(token))')
  })

  it('keeps redirect entrypoints free of effect-scoped dynamic regular expressions', () => {
    const rootRedirectPage = readFrontSource('app/(redirect)/page.tsx')
    const rootRedirectClient = readFrontSource('app/(redirect)/RootRedirectClient.tsx')

    expect(rootRedirectPage).not.toContain('new RegExp(')
    expect(rootRedirectClient).not.toContain('new RegExp(')
  })
})
