import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import RootPage from './(redirect)/page'

const mockCookies = jest.fn()
const mockRedirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

jest.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}))

jest.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

describe('RootPage', () => {
  beforeEach(() => {
    mockCookies.mockReset()
    mockRedirect.mockClear()
  })

  it('redirects the entry route to English on the server even when a stale Chinese locale cookie exists', async () => {
    mockCookies.mockResolvedValueOnce({
      get: jest.fn(() => ({ value: 'zh' })),
    })

    expect(() => RootPage()).toThrow('NEXT_REDIRECT:/en')

    expect(mockRedirect).toHaveBeenCalledWith('/en')
  })
})
