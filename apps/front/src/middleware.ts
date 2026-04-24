import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const LOCALE_HEADER = 'x-coinflux-locale'
const LOCALE_COOKIE = 'i18next'
const SUPPORTED_LOCALES = new Set(['en', 'zh'])

function getRouteLocale(pathname: string) {
  const locale = pathname.split('/').filter(Boolean)[0]
  return SUPPORTED_LOCALES.has(locale) ? locale : null
}

export function middleware(request: NextRequest) {
  const locale = getRouteLocale(request.nextUrl.pathname)
  if (!locale) return NextResponse.next()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(LOCALE_HEADER, locale)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  response.cookies.set(LOCALE_COOKIE, locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  })

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
