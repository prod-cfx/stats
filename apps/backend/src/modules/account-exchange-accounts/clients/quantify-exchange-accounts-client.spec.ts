import { createQuantifyApiClient } from '@ai/api-contracts'
import type { QuantifyClientError } from '@/common/clients/quantify-contract.shared'
import { QuantifyExchangeAccountsClient } from './quantify-exchange-accounts.client'

jest.mock('@ai/api-contracts', () => ({
  createQuantifyApiClient: jest.fn(),
}))

describe('quantifyExchangeAccountsClient', () => {
  const mockedCreateQuantifyApiClient = jest.mocked(createQuantifyApiClient)

  function createContractMock() {
    return {
      ExchangeAccountsController_list: jest.fn(),
      ExchangeAccountsController_create: jest.fn(),
      ExchangeAccountsController_delete: jest.fn(),
    }
  }

  const env = {
    getString: jest.fn((key: string) => key === 'QUANTIFY_API_BASE_URL' ? 'http://quantify.test/api/v1' : undefined),
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('calls the quantify contract list alias with structured query params', async () => {
    const contract = createContractMock()
    contract.ExchangeAccountsController_list.mockResolvedValue({
      data: [],
    })
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const client = new QuantifyExchangeAccountsClient(env as never)
    await client.list('user-1')

    expect(contract.ExchangeAccountsController_list).toHaveBeenCalledWith({
      queries: { userId: 'user-1' },
    })
  })

  it('calls the quantify contract create alias with the merged user payload', async () => {
    const contract = createContractMock()
    contract.ExchangeAccountsController_create.mockResolvedValue({
      data: { id: 'acc-1', exchangeId: 'okx' },
    })
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const client = new QuantifyExchangeAccountsClient(env as never)
    await client.upsert({
      id: 'user-1',
      email: 'user-1@example.com',
      roles: [],
      principalType: 'user',
    }, {
      exchangeId: 'okx',
      apiKey: 'key',
      apiSecret: 'secret',
      passphrase: 'pass',
    })

    expect(contract.ExchangeAccountsController_create).toHaveBeenCalledWith({
      userId: 'user-1',
      userEmail: 'user-1@example.com',
      exchangeId: 'okx',
      apiKey: 'key',
      apiSecret: 'secret',
      passphrase: 'pass',
    })
  })

  it('calls the quantify contract delete alias with path and query params', async () => {
    const contract = createContractMock()
    contract.ExchangeAccountsController_delete.mockResolvedValue(undefined)
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const client = new QuantifyExchangeAccountsClient(env as never)
    await client.delete('user-1', 'okx')

    expect(contract.ExchangeAccountsController_delete).toHaveBeenCalledWith(undefined, {
      params: { exchangeId: 'okx' },
      queries: { userId: 'user-1' },
    })
  })

  it('throws a 502 client error when quantify returns non-json error bodies', async () => {
    const contract = createContractMock()
    contract.ExchangeAccountsController_create.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 502,
        data: '<html>bad gateway</html>',
      },
    })
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

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
    const contract = createContractMock()
    contract.ExchangeAccountsController_list.mockRejectedValue(new TypeError('fetch failed'))
    mockedCreateQuantifyApiClient.mockReturnValue(contract as never)

    const client = new QuantifyExchangeAccountsClient(env as never)

    await expect(client.list('user-1')).rejects.toMatchObject<Partial<QuantifyClientError>>({
      status: 502,
      message: 'Quantify request failed',
      args: {
        cause: 'fetch failed',
      },
    })
  })

  it('appends /api/v1 when only QUANTIFY_BASE_URL is configured', () => {
    mockedCreateQuantifyApiClient.mockReturnValue(createContractMock() as never)

    const envWithBaseOnly = {
      getString: jest.fn((key: string) => {
        if (key === 'QUANTIFY_API_BASE_URL') return undefined
        if (key === 'QUANTIFY_BASE_URL') return 'http://quantify.test'
        return undefined
      }),
    }

    new QuantifyExchangeAccountsClient(envWithBaseOnly as never)

    expect(mockedCreateQuantifyApiClient).toHaveBeenCalledWith('http://quantify.test/api/v1', {
      validate: 'all',
    })
  })

  it('ignores placeholder QUANTIFY_BASE_URL and falls back to localhost default', () => {
    mockedCreateQuantifyApiClient.mockReturnValue(createContractMock() as never)

    const envWithPlaceholder = {
      getString: jest.fn((key: string) => {
        if (key === 'QUANTIFY_API_BASE_URL') return undefined
        if (key === 'QUANTIFY_BASE_URL') return '__SET_IN_env.local__'
        return undefined
      }),
    }

    new QuantifyExchangeAccountsClient(envWithPlaceholder as never)

    expect(mockedCreateQuantifyApiClient).toHaveBeenCalledWith('http://localhost:3010/api/v1', {
      validate: 'all',
    })
  })

  it('falls back to localhost when staging config points to the public quantify domain', () => {
    mockedCreateQuantifyApiClient.mockReturnValue(createContractMock() as never)

    const envWithPublicStagingDomain = {
      getString: jest.fn((key: string) => {
        if (key === 'APP_ENV') return 'staging'
        if (key === 'QUANTIFY_API_BASE_URL') return 'https://cfx-quantify-staging.devbase.cloud/api/v1'
        return undefined
      }),
    }

    new QuantifyExchangeAccountsClient(envWithPublicStagingDomain as never)

    expect(mockedCreateQuantifyApiClient).toHaveBeenCalledWith('http://127.0.0.1:3010/api/v1', {
      validate: 'all',
    })
  })
})
