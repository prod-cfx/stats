import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { config, proxy } from './proxy'

const mockCookieSet = jest.fn()
const mockNext = jest.fn((options?: unknown) => ({
  cookies: {
    set: mockCookieSet,
  },
  options,
}))

jest.mock('next/server', () => ({
  NextResponse: {
    next: (options?: unknown) => mockNext(options),
  },
}))

function createRequest(pathname: string, headers = new Headers()) {
  return {
    headers,
    nextUrl: { pathname },
  } as Parameters<typeof proxy>[0]
}

function getForwardedHeaders() {
  const options = mockNext.mock.calls[0]?.[0] as
    | { request?: { headers?: Headers } }
    | undefined
  return options?.request?.headers
}

describe('middleware', () => {
  beforeEach(() => {
    mockCookieSet.mockReset()
    mockNext.mockClear()
  })

  it.each([
    ['/en/ai-quant', 'en'],
    ['/zh/ai-quant', 'zh'],
  ])('syncs locale header and cookie for %s', (pathname, locale) => {
    const headers = new Headers({ 'x-existing-header': 'keep-me' })

    proxy(createRequest(pathname, headers))

    const forwardedHeaders = getForwardedHeaders()
    expect(forwardedHeaders?.get('x-coinflux-locale')).toBe(locale)
    expect(forwardedHeaders?.get('x-existing-header')).toBe('keep-me')
    expect(mockCookieSet).toHaveBeenCalledWith('i18next', locale, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    })
  })

  it('leaves non-locale paths untouched', () => {
    proxy(createRequest('/account'))

    expect(mockNext).toHaveBeenCalledWith(undefined)
    expect(mockCookieSet).not.toHaveBeenCalled()
  })

  it('keeps static assets out of the middleware matcher', () => {
    expect(config.matcher).toEqual(['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'])
  })
})
