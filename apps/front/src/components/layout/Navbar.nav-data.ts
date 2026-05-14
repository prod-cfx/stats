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

interface MobileAccountInput extends MobileNavInput {
  isLoggedIn: boolean
}

const withLng = (lng: string, path: string) => `/${lng}${path}`

export function buildMobileDataLinks({ lng, t }: MobileNavInput): NavbarLink[] {
  return [
    { name: t('nav.marketData'), href: withLng(lng, '/market') },
    { name: t('nav.long_short_ratio'), href: withLng(lng, '/long-short-ratio') },
    { name: t('nav.aggregated_orderbook'), href: withLng(lng, '/aggregated-orderbook') },
    { name: t('nav.prediction_market'), href: withLng(lng, '/prediction-market') },
    { name: t('nav.public_companies'), href: withLng(lng, '/public-companies') },
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
