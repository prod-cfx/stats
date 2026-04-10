import {
  buildBearerAuthHeaders,
  getErrorHttpStatus,
  unwrapTransportItems,
  unwrapTransportResponse,
} from './api-transport'

describe('api transport helpers', () => {
  it('unwraps standard data envelopes and raw payloads', () => {
    expect(unwrapTransportResponse({ data: { id: '1' } })).toEqual({ id: '1' })
    expect(unwrapTransportResponse({ id: '2' })).toEqual({ id: '2' })
  })

  it('unwraps list items from direct arrays and paginated envelopes', () => {
    expect(unwrapTransportItems<string>(['a', 'b'])).toEqual(['a', 'b'])
    expect(unwrapTransportItems<string>({ data: { items: ['c'] } })).toEqual(['c'])
    expect(unwrapTransportItems<string>({ data: { total: 1 } } as unknown as { data?: { items?: string[] } })).toEqual([])
  })

  it('builds bearer authorization headers from a token', () => {
    expect(buildBearerAuthHeaders('token-123')).toEqual({
      Authorization: 'Bearer token-123',
    })
  })

  it('extracts HTTP status from direct errors and nested response errors', () => {
    expect(getErrorHttpStatus({ status: 401 })).toBe(401)
    expect(getErrorHttpStatus({ response: { status: 403 } })).toBe(403)
    expect(getErrorHttpStatus(new Error('boom'))).toBeUndefined()
  })
})
