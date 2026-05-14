import type { MarketDataCatalogItem } from '@/lib/market-data/catalog-types'

export interface NavbarLink {
  name: string
  href: string
  children?: NavbarLink[]
}

export type NavbarTranslate = (key: string, options?: { defaultValue?: string }) => string

interface MobileNavInput {
  lng: string
  t: NavbarTranslate
}

interface DataNavInput extends MobileNavInput {
  catalogItems: MarketDataCatalogItem[]
}

interface MobileAccountInput extends MobileNavInput {
  isLoggedIn: boolean
}

const withLng = (lng: string, path: string) => `/${lng}${path}`

const normalizeCatalogHref = (lng: string, href: string) => {
  if (href.startsWith('/zh/') || href.startsWith('/en/')) return href
  const path = href.startsWith('/') ? href : `/${href}`
  return withLng(lng, path)
}

const dataNavOrder = [
  'nav-liquidation-map',
  'nav-long-short-ratio',
  'nav-aggregated-orderbook',
  'nav-liquidation-data',
  'nav-prediction-market',
  'nav-public-companies',
]

const dataNavHiddenIds = new Set(['nav-liquidation-map', 'nav-liquidation-data'])

export function buildDataNavLinks({ lng, t, catalogItems }: DataNavInput): NavbarLink[] {
  return [
    { name: t('nav.marketData'), href: withLng(lng, '/market') },
    ...catalogItems
      .filter(item => item.kind === 'nav' && item.href && !dataNavHiddenIds.has(item.id))
      .slice()
      .sort((a, b) => dataNavOrder.indexOf(a.id) - dataNavOrder.indexOf(b.id))
      .map(item => ({
        name: t(item.labelKey),
        href: normalizeCatalogHref(lng, item.href!),
      })),
  ]
}

export function buildMobileWhaleLinks({ lng, t }: MobileNavInput): NavbarLink[] {
  return [
    { name: t('nav.discover'), href: withLng(lng, '/whale-tracking/discover') },
    { name: t('nav.realtime_whales'), href: withLng(lng, '/whale-tracking/realtime') },
    { name: t('nav.whale_holdings'), href: withLng(lng, '/whale-tracking/holdings') },
    { name: t('nav.whale_notifications'), href: withLng(lng, '/whale-tracking/notifications') },
  ]
}

export function buildMobileAccountLinks({
  lng,
  t,
  isLoggedIn,
}: MobileAccountInput): NavbarLink[] {
  if (!isLoggedIn) {
    return [{ name: t('nav.login'), href: withLng(lng, '/auth/login') }]
  }

  return [
    { name: t('account.settings'), href: withLng(lng, '/account?tab=settings') },
    { name: t('nav.aiQuant'), href: withLng(lng, '/account?tab=ai-quant') },
  ]
}
