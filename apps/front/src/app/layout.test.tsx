import React from 'react'
import { describe, expect, it, jest } from '@jest/globals'
import RootLayout from './layout'

const mockCookies = jest.fn()
const mockHeaders = jest.fn()

jest.mock('./globals.css', () => ({}))

jest.mock('next/headers', () => ({
  cookies: () => mockCookies(),
  headers: () => mockHeaders(),
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(innerResolve => {
    resolve = innerResolve
  })

  return { promise, resolve }
}

describe('RootLayout', () => {
  it('starts cookies and headers reads in parallel when inferring html lang', async () => {
    const cookieStore = {
      get: jest.fn(() => undefined),
    }
    const headerStore = {
      get: jest.fn(() => 'en-US,en;q=0.9'),
    }
    const cookieDeferred = createDeferred<typeof cookieStore>()

    mockCookies.mockReturnValueOnce(cookieDeferred.promise)
    mockHeaders.mockResolvedValueOnce(headerStore)

    const layoutPromise = RootLayout({
      children: React.createElement('div', null, 'content'),
    })

    expect(mockCookies).toHaveBeenCalledTimes(1)
    expect(mockHeaders).toHaveBeenCalledTimes(1)

    cookieDeferred.resolve(cookieStore)

    const element = await layoutPromise

    expect(element.props.lang).toBe('en')
  })
})
