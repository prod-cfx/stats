import type { QuantifyClientError } from './quantify-exchange-accounts.client'
import { QuantifyExchangeAccountsClient } from './quantify-exchange-accounts.client'

describe('quantifyExchangeAccountsClient', () => {
  const env = {
    getString: jest.fn((key: string) => key === 'QUANTIFY_API_BASE_URL' ? 'http://quantify.test/api/v1' : undefined),
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('throws a 502 client error when quantify returns non-json error bodies', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '<html>bad gateway</html>',
    } as Response)

    const client = new QuantifyExchangeAccountsClient(env as never)

    await expect(client.upsert({
      id: 'user-1',
      email: 'user-1@example.com',
      roles: [],
      principalType: 'user',
    }, {
      exchangeId: 'okx',
      apiKey: 'key',
      apiSecret: 'secret',
      passphrase: 'pass',
    })).rejects.toMatchObject<Partial<QuantifyClientError>>({
      status: 502,
      message: 'Quantify returned a non-JSON error response',
      args: {
        upstreamBody: '<html>bad gateway</html>',
      },
    })
  })

  it('throws a 502 client error when quantify request fails before response parsing', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

    const client = new QuantifyExchangeAccountsClient(env as never)

    await expect(client.list('user-1')).rejects.toMatchObject<Partial<QuantifyClientError>>({
      status: 502,
      message: 'Quantify request failed',
      args: {
        cause: 'fetch failed',
      },
    })
  })
})
