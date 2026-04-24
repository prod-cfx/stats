import { describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import RootLayout from './layout'

const mockCookies = jest.fn()

jest.mock('./globals.css', () => ({}))

jest.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}))

describe('RootLayout', () => {
  it('defaults html lang to English when no locale cookie is set', async () => {
    const cookieStore = {
      get: jest.fn(() => undefined),
    }

    mockCookies.mockResolvedValueOnce(cookieStore)

    const element = await RootLayout({
      children: React.createElement('div', null, 'content'),
    })

    expect(mockCookies).toHaveBeenCalledTimes(1)

    expect(element.props.lang).toBe('en')
  })

  it('honors an explicit Chinese locale cookie for html lang', async () => {
    const cookieStore = {
      get: jest.fn(() => ({ value: 'zh' })),
    }

    mockCookies.mockResolvedValueOnce(cookieStore)

    const element = await RootLayout({
      children: React.createElement('div', null, 'content'),
    })

    expect(element.props.lang).toBe('zh-CN')
  })
})
