import type { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'
import { AccountExchangeAccountsService } from './account-exchange-accounts.service'

describe('accountExchangeAccountsService', () => {
  const authenticatedUser = {
    id: 'user-1',
    email: 'user-1@example.com',
    roles: [],
    principalType: 'user' as const,
  }

  function createService() {
    const client = {
      list: jest.fn().mockResolvedValue([
        {
          id: null,
          exchangeId: 'binance',
          isBound: false,
          name: null,
          maskedCredential: null,
          isTestnet: null,
          lastValidatedAt: null,
          createdAt: null,
        },
      ]),
      upsert: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    }

    const service = new AccountExchangeAccountsService(client as never)

    return { service, client }
  }

  it('lists exchange binding statuses for the current user', async () => {
    const { service, client } = createService()

    await expect(service.list('user-1')).resolves.toEqual([
      expect.objectContaining({
        exchangeId: 'binance',
        isBound: false,
      }),
    ])

    expect(client.list).toHaveBeenCalledWith('user-1')
  })

  it('maps list failures to domain exceptions instead of leaking raw client errors', async () => {
    const { service, client } = createService()
    client.list.mockRejectedValue(new TypeError('fetch failed'))

    await expect(service.list('user-1')).rejects.toMatchObject<Partial<DomainException>>({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Quantify request failed',
    })
  })

  it('maps quantify credential validation errors into stable backend args', async () => {
    const { service, client } = createService()
    client.upsert.mockRejectedValue({
      status: 400,
      message: 'Passphrase错误，请检查创建API Key时设置的密码短语',
      code: ErrorCode.TRADING_INVALID_CREDENTIALS,
      args: {
        exchangeId: 'okx',
        reasonCode: 'INVALID_PASSPHRASE',
        reasonMessage: 'Passphrase错误，请检查创建API Key时设置的密码短语',
        retryable: false,
      },
    })

    await expect(service.upsert(authenticatedUser, {
      exchangeId: 'okx',
      apiKey: 'key',
      apiSecret: 'secret',
      passphrase: 'bad',
    })).rejects.toMatchObject<Partial<DomainException>>({
      code: ErrorCode.TRADING_INVALID_CREDENTIALS,
      args: expect.objectContaining({
        reasonCode: 'INVALID_PASSPHRASE',
        retryable: false,
      }),
    })
  })

  it('deletes the current user binding by exchangeId', async () => {
    const { service, client } = createService()

    await service.delete('user-1', 'binance')

    expect(client.delete).toHaveBeenCalledWith('user-1', 'binance')
  })

  it('maps unexpected quantify failures to a real 500 response shape', async () => {
    const { service, client } = createService()
    client.upsert.mockRejectedValue(new TypeError('fetch failed'))

    await expect(service.upsert(authenticatedUser, {
      exchangeId: 'okx',
      apiKey: 'key',
      apiSecret: 'secret',
      passphrase: 'pass',
    })).rejects.toMatchObject<Partial<DomainException>>({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Quantify request failed',
    })

    await service.upsert(authenticatedUser, {
      exchangeId: 'okx',
      apiKey: 'key',
      apiSecret: 'secret',
      passphrase: 'pass',
    }).catch((error: DomainException) => {
      expect(error.getStatus()).toBe(500)
    })
  })
})
