import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server.node'

const mockAiQuantPageClient = jest.fn(() => null)

jest.mock('./AiQuantPageClient', () => ({
  AiQuantPageClient: (props: unknown) => {
    mockAiQuantPageClient(props as never)
    return null
  },
}))

jest.mock('@/components/layout/Footer', () => ({
  Footer: () => null,
}))

jest.mock('@/components/layout/Navbar', () => ({
  Navbar: () => null,
}))

describe('AiQuantPage', () => {
  const originalAppEnv = process.env.NEXT_PUBLIC_APP_ENV
  const originalAppVersion = process.env.NEXT_PUBLIC_APP_VERSION
  const originalCommitSha = process.env.VERCEL_GIT_COMMIT_SHA

  beforeEach(() => {
    jest.resetModules()
    mockAiQuantPageClient.mockClear()
    process.env.NEXT_PUBLIC_APP_ENV = 'development'
    delete process.env.NEXT_PUBLIC_APP_VERSION
    delete process.env.VERCEL_GIT_COMMIT_SHA
  })

  afterEach(() => {
    if (originalAppEnv === undefined) {
      delete process.env.NEXT_PUBLIC_APP_ENV
    } else {
      process.env.NEXT_PUBLIC_APP_ENV = originalAppEnv
    }

    if (originalAppVersion === undefined) {
      delete process.env.NEXT_PUBLIC_APP_VERSION
    } else {
      process.env.NEXT_PUBLIC_APP_VERSION = originalAppVersion
    }

    if (originalCommitSha === undefined) {
      delete process.env.VERCEL_GIT_COMMIT_SHA
    } else {
      process.env.VERCEL_GIT_COMMIT_SHA = originalCommitSha
    }
  })

  it('enables server-owned conversations outside staging', async () => {
    const { default: AiQuantPage } = await import('./page')

    renderToStaticMarkup(<AiQuantPage />)

    expect(mockAiQuantPageClient).toHaveBeenCalledWith(
      expect.objectContaining({
        deployVersion: 'development',
        serverOwnedConversations: true,
      }),
    )
  })
})
