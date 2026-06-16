import { makePublicCompanyRowKey } from './public-company-row-key'

describe('makePublicCompanyRowKey', () => {
  it('uses stable company identity fields instead of row position', () => {
    const first = makePublicCompanyRowKey({ asset: 'BTC', exchange: 'NASDAQ', ticker: 'MSTR' })
    const second = makePublicCompanyRowKey({ asset: 'BTC', exchange: 'NASDAQ', ticker: 'MSTR' })

    expect(first).toBe('MSTR:NASDAQ:BTC')
    expect(second).toBe(first)
  })

  it('keeps rows distinct when the same ticker trades different assets', () => {
    expect(makePublicCompanyRowKey({ asset: 'BTC', exchange: 'NASDAQ', ticker: 'MSTR' })).not.toBe(
      makePublicCompanyRowKey({ asset: 'ETH', exchange: 'NASDAQ', ticker: 'MSTR' }),
    )
  })
})
