import { describe, expect, it } from '@jest/globals'
import {
  buildMobileAccountLinks,
  buildMobileDataLinks,
  buildMobileWhaleLinks,
} from './Navbar.nav-data'

const t = (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key

describe('Navbar mobile navigation data', () => {
  it('exposes required data destinations with locale prefixes and no hidden liquidation links', () => {
    const hrefs = buildMobileDataLinks({ lng: 'en', t }).map(link => link.href)

    expect(hrefs).toEqual([
      '/en/market',
      '/en/long-short-ratio',
      '/en/aggregated-orderbook',
      '/en/prediction-market',
      '/en/public-companies',
    ])
    expect(hrefs).not.toContain('/en/liquidation-map')
    expect(hrefs).not.toContain('/en/liquidation-data')
  })

  it('exposes required whale destinations with locale prefixes', () => {
    const hrefs = buildMobileWhaleLinks({ lng: 'zh', t }).map(link => link.href)

    expect(hrefs).toEqual([
      '/zh/whale-tracking/discover',
      '/zh/whale-tracking/realtime',
      '/zh/whale-tracking/holdings',
      '/zh/whale-tracking/notifications',
    ])
  })

  it('keeps mobile account destinations for logged-in and logged-out users', () => {
    expect(buildMobileAccountLinks({ lng: 'en', t, isLoggedIn: true }).map(link => link.href)).toEqual([
      '/en/account?tab=settings',
      '/en/account?tab=ai-quant',
    ])
    expect(buildMobileAccountLinks({ lng: 'en', t, isLoggedIn: false }).map(link => link.href)).toEqual([
      '/en/auth/login',
    ])
  })
})
