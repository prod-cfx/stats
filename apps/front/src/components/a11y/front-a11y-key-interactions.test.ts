import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@jest/globals'

const FRONT_ROOT = join(__dirname, '..', '..')

function readFrontSource(relativePath: string) {
  return readFileSync(join(FRONT_ROOT, relativePath), 'utf8')
}

function readLocale(locale: 'en' | 'zh') {
  return JSON.parse(readFrontSource(`../public/locales/${locale}/common.json`)) as Record<string, any>
}

function getPath(source: Record<string, any>, path: string) {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && key in value) {
      return (value as Record<string, unknown>)[key]
    }

    return undefined
  }, source)
}

describe('issue #2513 front key interaction accessibility', () => {
  it('gives shared dialogs accessible names and modal close controls labels', () => {
    const modal = readFrontSource('components/ui/Modal.tsx')
    const confirmDialog = readFrontSource('components/ui/ConfirmDialog.tsx')

    expect(modal).toContain('role="dialog"')
    expect(modal).toContain('aria-modal="true"')
    expect(modal).toContain('aria-labelledby={titleId}')
    expect(modal).toContain('aria-label={t(\'common.close\')}')
    expect(modal).toContain('tabIndex={-1}')

    expect(confirmDialog).toContain('role="dialog"')
    expect(confirmDialog).toContain('aria-modal="true"')
    expect(confirmDialog).toContain('aria-labelledby={titleId}')
    expect(confirmDialog).toContain('aria-describedby={descriptionId}')
    expect(confirmDialog).toContain('tabIndex={-1}')
  })

  it('keeps dashboard card actions outside card navigation buttons', () => {
    const dashboardClient = readFrontSource('app/[lng]/dashboard/DashboardClient.tsx')

    expect(dashboardClient).toContain('data-testid="dashboard-card-open"')
    expect(dashboardClient).toContain('data-testid="dashboard-card-actions"')
    expect(dashboardClient).toContain('aria-label={tr(\'dashboard.actions.openActions\'')
    expect(dashboardClient).not.toContain('aria-label="dashboard-actions"')
  })

  it('uses semantic buttons for explore dashboard cards and trade percent controls', () => {
    const exploreDashboards = readFrontSource('components/dashboard/ExploreDashboards.tsx')
    const leftTradePanel = readFrontSource('components/trading/left-trade-panel/LeftTradePanel.tsx')

    expect(exploreDashboards).toContain('type="button"')
    expect(exploreDashboards).toContain('aria-label={`${t(\'dashboard.explore.openDashboard\'')
    expect(exploreDashboards).not.toContain('<div key={idx} onClick={() => handleCardClick')

    expect(leftTradePanel).toContain('aria-label={t(\'tradePanel.percentSlider\'')
    expect(leftTradePanel).toContain('aria-label={t(\'tradePanel.setPercent\', { percent: p })}')
    expect(leftTradePanel).toContain('aria-disabled="true"')
    expect(leftTradePanel).not.toContain('<span\n              key={p}\n              onClick={() => setPercent(p)}')
  })

  it('defines locale labels used by new accessible controls', () => {
    for (const locale of ['en', 'zh'] as const) {
      const messages = readLocale(locale)

      expect(getPath(messages, 'dashboard.explore.openDashboard')).toEqual(expect.any(String))
      expect(getPath(messages, 'tradePanel.percentSlider')).toEqual(expect.any(String))
      expect(getPath(messages, 'tradePanel.setPercent')).toEqual(expect.any(String))
    }
  })

  it('makes whale trader cards and exchange account dialogs keyboard and screen-reader addressable', () => {
    const traderCard = readFrontSource('components/whale-tracking/discover/TraderCard.tsx')
    const exchangeApi = readFrontSource('components/account/ExchangeApiSection.tsx')

    expect(traderCard).toContain('aria-label={tr(\'whaleTracking.discover.actions.showStats\'')
    expect(traderCard).toContain('aria-label={tr(\'common.copy\'')
    expect(traderCard).not.toContain('onClick={() => onShowStats?.(address)}>')
    expect(traderCard).not.toContain('role="button"')

    expect(exchangeApi).toContain('aria-labelledby="exchange-api-config-title"')
    expect(exchangeApi).toContain('aria-labelledby="exchange-api-delete-title"')
    expect(exchangeApi).toContain('aria-label={t(\'aiQuant.accountName\')}')
    expect(exchangeApi).toContain('aria-label={t(\'aiQuant.apiKey\')}')
    expect(exchangeApi).toContain('tabIndex={-1}')
  })
})
