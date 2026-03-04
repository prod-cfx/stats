'use client'

export function isTelegramWebAppEnv(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as any).Telegram?.WebApp)
}

export function canShowTelegramDesktopEntry(): boolean {
  if (typeof window === 'undefined') return false

  const ua = window.navigator.userAgent.toLowerCase()
  const isMobile = /iphone|ipad|android|mobile/.test(ua)
  if (isMobile) return false

  const isTelegramWebView = ua.includes('telegram')
  if (isTelegramWebView) return false

  const isDesktopOS = /macintosh|windows nt|linux/.test(ua)
  return isDesktopOS
}
