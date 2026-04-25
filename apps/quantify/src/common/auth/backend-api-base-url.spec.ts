import { resolveBackendApiBaseUrl } from './backend-api-base-url'

function createEnv(values: Record<string, string | undefined>) {
  return {
    getString: jest.fn((key: string) => values[key]),
  }
}

describe('resolveBackendApiBaseUrl', () => {
  it('uses explicit backend api base url first', () => {
    const env = createEnv({
      BACKEND_API_BASE_URL: 'https://backend.example.com/api/v1/',
      NEXT_PUBLIC_API_SERVER_URL: 'https://public-backend.example.com',
    })

    expect(resolveBackendApiBaseUrl(env)).toBe('https://backend.example.com/api/v1')
  })

  it('derives api base url from public backend server url when explicit value is unset', () => {
    const env = createEnv({
      BACKEND_API_BASE_URL: '__SET_IN_env.local__',
      NEXT_PUBLIC_API_SERVER_URL: 'https://cfx-backend-staging.devbase.cloud/',
    })

    expect(resolveBackendApiBaseUrl(env)).toBe('https://cfx-backend-staging.devbase.cloud/api/v1')
  })

  it('keeps an existing api prefix when deriving from public backend server url', () => {
    const env = createEnv({
      NEXT_PUBLIC_API_SERVER_URL: 'https://backend.example.com/api/v1/',
    })

    expect(resolveBackendApiBaseUrl(env)).toBe('https://backend.example.com/api/v1')
  })

  it('falls back to local backend api url for development defaults', () => {
    expect(resolveBackendApiBaseUrl(createEnv({}))).toBe('http://127.0.0.1:3000/api/v1')
  })
})
