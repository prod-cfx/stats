import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import RootLayout from './layout'

const mockCookies = jest.fn()
const mockHeaders = jest.fn()

jest.mock('./globals.css', () => ({}))

jest.mock('next/headers', () => ({
  cookies: () => mockCookies(),
  headers: () => mockHeaders(),
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
})
