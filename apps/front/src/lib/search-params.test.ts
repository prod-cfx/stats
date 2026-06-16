import { createSearchParamReader } from './search-params'

describe('createSearchParamReader', () => {
  it('returns callable get and has methods after destructuring', () => {
    const params = new URLSearchParams('symbol=BTCUSDT&agg=1')
    const { get, has } = createSearchParamReader(params)

    expect(get('symbol')).toBe('BTCUSDT')
    expect(get('missing')).toBeNull()
    expect(has('agg')).toBe(true)
    expect(has('missing')).toBe(false)
  })

  it('preserves mocked search params behavior used by component tests', () => {
    const params = {
      get: (key: string) => (key === 'redirect' ? '/zh/account' : null),
      has: (key: string) => key === 'redirect',
    }
    const { get, has } = createSearchParamReader(params)

    expect(get('redirect')).toBe('/zh/account')
    expect(has('redirect')).toBe(true)
  })

  it('returns empty values when search params are unavailable', () => {
    const { get, has } = createSearchParamReader(null)

    expect(get('symbol')).toBeNull()
    expect(has('symbol')).toBe(false)
  })
})
