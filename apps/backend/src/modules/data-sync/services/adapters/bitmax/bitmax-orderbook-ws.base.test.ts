import { isBitmaxConnectionActivityMessage } from './bitmax-orderbook-ws.base'

describe('bitmax orderbook ws base', () => {
  it('treats Bitmax depth updates as connection activity', () => {
    expect(isBitmaxConnectionActivityMessage({ m: 'depth' })).toBe(true)
    expect(isBitmaxConnectionActivityMessage({ m: 'depth-snapshot' })).toBe(true)
  })

  it('treats control frames as connection activity', () => {
    expect(isBitmaxConnectionActivityMessage({ m: 'connected' })).toBe(true)
    expect(isBitmaxConnectionActivityMessage({ m: 'ping' })).toBe(true)
    expect(isBitmaxConnectionActivityMessage({ m: 'pong' })).toBe(true)
    expect(isBitmaxConnectionActivityMessage({ m: 'sub' })).toBe(true)
    expect(isBitmaxConnectionActivityMessage({ m: 'unsub' })).toBe(true)
    expect(isBitmaxConnectionActivityMessage({ m: 'error' })).toBe(true)
  })

  it('ignores invalid frames', () => {
    expect(isBitmaxConnectionActivityMessage(null)).toBe(false)
    expect(isBitmaxConnectionActivityMessage(undefined)).toBe(false)
    expect(isBitmaxConnectionActivityMessage({ m: '' as never })).toBe(true)
  })
})
