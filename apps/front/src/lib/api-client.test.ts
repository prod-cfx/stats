import { afterEach, describe, expect, it, jest } from '@jest/globals'

const ORIGINAL_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const ORIGINAL_API_SERVER_URL = process.env.NEXT_PUBLIC_API_SERVER_URL

async function loadApiClient() {
  jest.resetModules()
  return import('./api-client')
}

describe('api-client env resolution', () => {
  afterEach(() => {
    jest.resetModules()

    if (ORIGINAL_API_BASE_URL === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = ORIGINAL_API_BASE_URL
    }

    if (ORIGINAL_API_SERVER_URL === undefined) {
      delete process.env.NEXT_PUBLIC_API_SERVER_URL
    } else {
      process.env.NEXT_PUBLIC_API_SERVER_URL = ORIGINAL_API_SERVER_URL
    }
  })

  it('falls back to NEXT_PUBLIC_API_SERVER_URL when NEXT_PUBLIC_API_BASE_URL is placeholder text', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = '__SET_IN_env.local__'
    process.env.NEXT_PUBLIC_API_SERVER_URL = 'https://cfx-backend-staging.devbase.cloud'

    const { API_BASE_URL } = await loadApiClient()

    expect(API_BASE_URL).toBe('https://cfx-backend-staging.devbase.cloud/api/v1')
  })

  it('builds SERVER_API_BASE_URL as absolute when NEXT_PUBLIC_API_BASE_URL is relative', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = '/api/v1'
    process.env.NEXT_PUBLIC_API_SERVER_URL = 'http://localhost:3000'

    const { SERVER_API_BASE_URL } = await loadApiClient()

    expect(SERVER_API_BASE_URL).toBe('http://localhost:3000/api/v1')
  })

  it('keeps SERVER_API_BASE_URL unchanged when NEXT_PUBLIC_API_BASE_URL is absolute', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com/api/v1'
    process.env.NEXT_PUBLIC_API_SERVER_URL = 'http://localhost:3000'

    const { SERVER_API_BASE_URL } = await loadApiClient()

    expect(SERVER_API_BASE_URL).toBe('https://api.example.com/api/v1')
  })
})
