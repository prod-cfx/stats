'use client'

export function getSameOriginReturnHref(fallbackHref: string, currentHref?: string) {
  if (typeof window === 'undefined') return fallbackHref
  if (!document.referrer) return fallbackHref

  try {
    const referrer = new URL(document.referrer)
    if (referrer.origin !== window.location.origin) return fallbackHref

    const current = new URL(currentHref ?? window.location.href)
    if (referrer.pathname === current.pathname && referrer.search === current.search && referrer.hash === current.hash) {
      return fallbackHref
    }

    return `${referrer.pathname}${referrer.search}${referrer.hash}`
  } catch {
    return fallbackHref
  }
}
