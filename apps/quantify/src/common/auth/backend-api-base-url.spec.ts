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
    })

    expect(resolveBackendApiBaseUrl(env)).toBe('https://backend.example.com/api/v1')
  })

  it('treats backend API base URL placeholder as missing', () => {
    const env = createEnv({
      BACKEND_API_BASE_URL: '__SET_IN_env.local__',
    })

    expect(() => resolveBackendApiBaseUrl(env)).toThrow('BACKEND_API_BASE_URL')
  })

  it('rejects host-only backend API base URL instead of appending api prefix', () => {
    const env = createEnv({
      BACKEND_API_BASE_URL: 'https://backend.example.com',
    })

    expect(() => resolveBackendApiBaseUrl(env)).toThrow('/api/v1')
  })

  it('throws when backend API config is missing', () => {
    expect(() => resolveBackendApiBaseUrl(createEnv({}))).toThrow('BACKEND_API_BASE_URL')
  })
})
