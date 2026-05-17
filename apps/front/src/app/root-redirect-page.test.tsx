import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server.node'
import RootPage from './(redirect)/page'

const mockCookies = jest.fn()

jest.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}))

jest.mock('./(redirect)/RootRedirectClient', () => ({
  RootRedirectClient: ({ preferredLng }: { preferredLng: 'zh' | 'en' }) => (
    <div data-preferred-lng={preferredLng} />
  ),
}))

describe('RootPage', () => {
  beforeEach(() => {
    mockCookies.mockReset()
  })

  it('defaults the entry route client boundary to English even when a stale Chinese locale cookie exists', async () => {
    mockCookies.mockResolvedValueOnce({
      get: jest.fn(() => ({ value: 'zh' })),
    })

    const html = renderToStaticMarkup(RootPage())

    expect(html).toContain('data-preferred-lng="en"')
  })
})
