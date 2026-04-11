import { createQuantifyApiClient, quantifySchemas } from '@ai/api-contracts'

describe('quantify contracts exports', () => {
  it('exposes a dedicated quantify contract client alongside backend contracts', () => {
    expect(createQuantifyApiClient).toEqual(expect.any(Function))
    expect(quantifySchemas).toBeDefined()
  })
})
