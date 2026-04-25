import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import RootPage from './(redirect)/page'

const mockCookies = jest.fn()

jest.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}))

jest.mock('./(redirect)/RootRedirectClient', () => ({
  RootRedirectClient: ({ preferredLng }: { preferredLng: 'zh' | 'en' }) => ({
    type: 'RootRedirectClient',
    props: { preferredLng },
  }),
}))

describe('RootPage', () => {
  beforeEach(() => {
    mockCookies.mockReset()
  })

  it('defaults the entry route to English even when a stale Chinese locale cookie exists', async () => {
    mockCookies.mockResolvedValueOnce({
      get: jest.fn(() => ({ value: 'zh' })),
    })

    const element = await RootPage()

    expect(element.props.preferredLng).toBe('en')
  })
})
