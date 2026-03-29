import { AccountExchangeAccountsController } from './account-exchange-accounts.controller'

describe('accountExchangeAccountsController', () => {
  function createController() {
    const service = {
      list: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({
        id: 'account-1',
        exchangeId: 'binance',
        isBound: true,
        name: 'Primary Binance',
        maskedCredential: 'abcd****wxyz',
        isTestnet: false,
        lastValidatedAt: new Date('2026-03-20T00:00:00.000Z'),
        createdAt: new Date('2026-03-20T00:00:00.000Z'),
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    }

    const controller = new AccountExchangeAccountsController(service as never)

    return { controller, service }
  }

  it('uses authenticated user id when listing bindings', async () => {
    const { controller, service } = createController()

    await controller.list('user-1')

    expect(service.list).toHaveBeenCalledWith('user-1', { degradeOnTransientFailure: true })
  })

  it('uses authenticated user id when upserting bindings', async () => {
    const { controller, service } = createController()

    await controller.upsert({
      id: 'user-1',
      email: 'user-1@example.com',
      roles: [],
      principalType: 'user',
    }, {
      exchangeId: 'binance',
      apiKey: 'key',
      apiSecret: 'secret',
    })

    expect(service.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        email: 'user-1@example.com',
      }),
      expect.objectContaining({
        exchangeId: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
      }),
    )
  })

  it('deletes by exchangeId for the authenticated user', async () => {
    const { controller, service } = createController()

    await controller.delete('user-1', 'binance')

    expect(service.delete).toHaveBeenCalledWith('user-1', 'binance')
  })
})
