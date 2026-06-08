import { resolveQuantifyBaseUrl } from './quantify-contract.shared'

function createEnv(values: Record<string, string | undefined>) {
  return {
    getString: jest.fn((key: string) => values[key]),
  }
}

describe('resolveQuantifyBaseUrl', () => {
  it('uses explicit quantify API base URL first', () => {
    expect(resolveQuantifyBaseUrl(createEnv({ QUANTIFY_API_BASE_URL: 'http://quantify.example.com/api/v1/' }) as never)).toBe(
      'http://quantify.example.com/api/v1',
    )
  })

  it('derives API prefix from quantify base URL', () => {
    expect(resolveQuantifyBaseUrl(createEnv({ QUANTIFY_BASE_URL: 'http://quantify.example.com/' }) as never)).toBe(
      'http://quantify.example.com/api/v1',
    )
  })

  it('throws when quantify API config is missing', () => {
    expect(() => resolveQuantifyBaseUrl(createEnv({}) as never)).toThrow('QUANTIFY_API_BASE_URL')
  })
})
