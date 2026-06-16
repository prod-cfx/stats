import { makeWhalePositionKey } from './whale-position-key'

describe('makeWhalePositionKey', () => {
  it('uses stable position identity fields instead of row position', () => {
    const position = {
      address: '0xabc',
      asset: 'BTC',
      entryPrice: '$100,000',
      liqPrice: '$80,000',
      side: 'Long',
    }

    expect(makeWhalePositionKey(position)).toBe('0xabc:BTC:Long:$100,000:$80,000')
    expect(makeWhalePositionKey(position)).toBe(makeWhalePositionKey({ ...position }))
  })
})
