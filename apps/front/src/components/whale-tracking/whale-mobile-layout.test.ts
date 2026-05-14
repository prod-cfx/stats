import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@jest/globals'

const FRONT_ROOT = join(__dirname, '..', '..')

function readFrontSource(relativePath: string) {
  return readFileSync(join(FRONT_ROOT, relativePath), 'utf8')
}

describe('issue #1350 whale mobile layouts', () => {
  it('renders mobile card lists while keeping desktop tables for whale data surfaces', () => {
    const realtime = readFrontSource('components/whale-tracking/realtime/RealtimeWhalesTable.tsx')
    const holdings = readFrontSource('components/whale-tracking/holdings/WhalePositionsTable.tsx')
    const addressMonitor = readFrontSource('components/whale-tracking/notifications/AddressMonitorSection.tsx')
    const realtimeMonitor = readFrontSource('components/whale-tracking/notifications/RealtimeWhaleMonitorSection.tsx')
    const profileTabs = readFrontSource('components/whale-tracking/profile/ProfileDataTabs.tsx')
    const completedTrades = readFrontSource('components/whale-tracking/profile/CompletedTradesTable.tsx')

    for (const source of [realtime, holdings, addressMonitor, realtimeMonitor, profileTabs, completedTrades]) {
      expect(source).toContain('md:hidden')
      expect(source).toContain('hidden md:block')
    }
  })

  it('keeps key mobile action entrypoints visible in card layouts', () => {
    const realtime = readFrontSource('components/whale-tracking/realtime/RealtimeWhalesTable.tsx')
    const holdings = readFrontSource('components/whale-tracking/holdings/WhalePositionsTable.tsx')
    const addressMonitor = readFrontSource('components/whale-tracking/notifications/AddressMonitorSection.tsx')

    expect(realtime).toContain('data-testid="realtime-mobile-card-list"')
    expect(realtime).toContain('data-testid="realtime-mobile-copy"')
    expect(realtime).toContain('data-testid="realtime-mobile-stats"')
    expect(holdings).toContain('data-testid="holdings-mobile-copy"')
    expect(holdings).toContain('data-testid="holdings-mobile-stats"')
    expect(addressMonitor).toContain('data-testid="address-monitor-mobile-copy"')
    expect(addressMonitor).toContain('data-testid="address-monitor-mobile-stats"')
    expect(addressMonitor).toContain('data-testid="address-monitor-mobile-disable-telegram"')
    expect(addressMonitor).toContain('data-testid="address-monitor-mobile-edit"')
    expect(addressMonitor).toContain('data-testid="address-monitor-mobile-delete"')
  })

  it('adds compact mobile controls for tabs and modals', () => {
    const profileTabs = readFrontSource('components/whale-tracking/profile/ProfileDataTabs.tsx')
    const createMonitorModal = readFrontSource('features/whale-notification/components/CreateMonitorModal.tsx')
    const statsModal = readFrontSource('components/whale-tracking/WhaleTradingStatsModal.tsx')

    expect(profileTabs).toContain('overflow-x-auto')
    expect(profileTabs).toContain('data-testid="profile-mobile-card-list"')
    expect(createMonitorModal).toContain('w-full sm:w-auto')
    expect(statsModal).toContain('flex-col gap-3 sm:flex-row')
  })
})
