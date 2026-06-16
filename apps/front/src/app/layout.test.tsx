import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import RootLayout from './layout'
import { ROOT_LAYOUT_BOOTSTRAP_SCRIPT } from './layout-bootstrap-script'

const mockCookies = jest.fn()
const mockHeaders = jest.fn()

jest.mock('./globals.css', () => ({}))

jest.mock('next/headers', () => ({
  cookies: () => mockCookies(),
  headers: () => mockHeaders(),
}))

jest.mock('next/script', () => ({
  __esModule: true,
  default: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('script', props, children),
}))

describe('RootLayout', () => {
  beforeEach(() => {
    mockCookies.mockReset()
    mockHeaders.mockReset()
  })

  function mockLocaleHeader(value?: string) {
    mockHeaders.mockResolvedValueOnce({
      get: jest.fn((name: string) => (name === 'x-coinflux-locale' ? value : null)),
    })
  }

  it('defaults html lang to English when no locale cookie is set', async () => {
    const cookieStore = {
      get: jest.fn(() => undefined),
    }

    mockCookies.mockResolvedValueOnce(cookieStore)
    mockLocaleHeader()

    const element = await RootLayout({
      children: React.createElement('div', null, 'content'),
    })

    expect(element.props.lang).toBe('en')
  })

  it('defaults html lang to English when only a stale Chinese locale cookie is set', async () => {
    const cookieStore = {
      get: jest.fn(() => ({ value: 'zh' })),
    }

    mockCookies.mockResolvedValueOnce(cookieStore)
    mockLocaleHeader()

    const element = await RootLayout({
      children: React.createElement('div', null, 'content'),
    })

    expect(element.props.lang).toBe('en')
  })

  it('uses the route locale header even when a stale cookie differs', async () => {
    const cookieStore = {
      get: jest.fn(() => ({ value: 'zh' })),
    }

    mockCookies.mockResolvedValueOnce(cookieStore)
    mockLocaleHeader('en')

    const element = await RootLayout({
      children: React.createElement('div', null, 'content'),
    })

    expect(element.props.lang).toBe('en')
  })

  it('uses Chinese html lang for a direct zh route without a locale cookie', async () => {
    const cookieStore = {
      get: jest.fn(() => undefined),
    }

    mockCookies.mockResolvedValueOnce(cookieStore)
    mockLocaleHeader('zh')

    const element = await RootLayout({
      children: React.createElement('div', null, 'content'),
    })

    expect(element.props.lang).toBe('zh-CN')
  })

  it('keeps the bootstrap script static and free of server-provided data', () => {
    expect(ROOT_LAYOUT_BOOTSTRAP_SCRIPT).toContain('localStorage.getItem')
    expect(ROOT_LAYOUT_BOOTSTRAP_SCRIPT).toContain("'cf-theme'")
    expect(ROOT_LAYOUT_BOOTSTRAP_SCRIPT).not.toMatch(/headers\(|cookies\(|searchParams|process\.env/)
  })

  it('loads the bootstrap script through Next Script before hydration', async () => {
    mockLocaleHeader('en')

    const element = await RootLayout({
      children: React.createElement('div', null, 'content'),
    })

    const head = React.Children.toArray(element.props.children)[0] as React.ReactElement
    const script = React.Children.only(head.props.children) as React.ReactElement

    expect(script.props.id).toBe('root-layout-bootstrap')
    expect(script.props.strategy).toBe('beforeInteractive')
    expect(script.props.dangerouslySetInnerHTML).toBeUndefined()
    expect(script.props.children).toBe(ROOT_LAYOUT_BOOTSTRAP_SCRIPT)
  })
})
