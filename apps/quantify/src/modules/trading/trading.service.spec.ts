import { ExchangeOperationFailedException } from './exceptions'
import { TradingService } from './trading.service'

describe('tradingService', () => {
  function createService() {
    const client = {
      createOrder: jest.fn(),
      cancelOrder: jest.fn(),
      fetchOrder: jest.fn(),
      fetchOpenOrders: jest.fn(),
      fetchPositions: jest.fn(),
      fetchBalance: jest.fn(),
    }
    const exchangeFactory = {
      createClient: jest.fn(() => client),
    }
    const accountStore = {
      getAccountConfig: jest.fn(),
      getAccountConfigById: jest.fn(),
    }

    const service = new TradingService(exchangeFactory as any, accountStore as any)

    return { service, client, exchangeFactory, accountStore }
  }

  it('fetches order detail through the selected exchange account', async () => {
    const { service, client, accountStore } = createService()

    accountStore.getAccountConfigById.mockResolvedValue({
      exchangeId: 'binance',
      config: { apiKey: 'k', secret: 's', isTestnet: true },
    })
    client.fetchOrder.mockResolvedValue({ id: 'order-1', status: 'closed' })

    const result = await service.getOrder(
      'user-1',
      'binance',
      'perp',
      'order-1',
      'XRP/USDT:PERP',
      'exchange-account-1',
    )

    expect(client.fetchOrder).toHaveBeenCalledWith('order-1', 'XRP/USDT:PERP')
    expect(result).toEqual({ id: 'order-1', status: 'closed' })
  })

  it('fetches open orders through the selected exchange account', async () => {
    const { service, client, accountStore } = createService()

    accountStore.getAccountConfigById.mockResolvedValue({
      exchangeId: 'okx',
      config: { apiKey: 'k', secret: 's', passphrase: 'p', isTestnet: true },
    })
    client.fetchOpenOrders.mockResolvedValue([{ id: 'order-1', status: 'open' }])

    const result = await service.getOpenOrders(
      'user-1',
      'okx',
      'spot',
      'DOGE/USDT',
      'exchange-account-1',
    )

    expect(client.fetchOpenOrders).toHaveBeenCalledWith('DOGE/USDT')
    expect(result).toEqual([{ id: 'order-1', status: 'open' }])
  })

  it('cancels orders through the selected exchange account', async () => {
    const { service, client, accountStore } = createService()

    accountStore.getAccountConfigById.mockResolvedValue({
      exchangeId: 'okx',
      config: { apiKey: 'k', secret: 's', passphrase: 'p', isTestnet: true },
    })
    client.cancelOrder.mockResolvedValue({ id: 'order-1', status: 'canceled' })

    const result = await service.cancelOrder(
      'user-1',
      'okx',
      'spot',
      'order-1',
      'DOGE/USDT',
      'exchange-account-1',
    )

    expect(client.cancelOrder).toHaveBeenCalledWith('order-1', 'DOGE/USDT')
    expect(result).toEqual({ id: 'order-1', status: 'canceled' })
  })

  it('wraps exchange order lookup failures', async () => {
    const { service, client, accountStore } = createService()

    accountStore.getAccountConfig.mockResolvedValue({
      exchangeId: 'binance',
      config: { apiKey: 'k', secret: 's', isTestnet: true },
    })
    client.fetchOrder.mockRejectedValue(new Error('exchange down'))

    await expect(
      service.getOrder('user-1', 'binance', 'spot', 'order-1', 'BTC/USDT'),
    ).rejects.toBeInstanceOf(ExchangeOperationFailedException)
  })

  it('falls back to userId + exchangeId lookup when exchangeAccountId is missing', async () => {
    const { service, client, accountStore } = createService()

    accountStore.getAccountConfig.mockResolvedValue({
      exchangeId: 'okx',
      config: { apiKey: 'k', secret: 's', passphrase: 'p', isTestnet: true },
    })
    client.createOrder.mockResolvedValue({ id: 'order-2', status: 'open' })

    await service.placeOrder(
      'user-9',
      'okx',
      'spot',
      {
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        type: 'market',
        amount: 0.001,
      },
    )

    expect(accountStore.getAccountConfig).toHaveBeenCalledWith('user-9', 'okx')
    expect(accountStore.getAccountConfigById).not.toHaveBeenCalled()
  })

  it('fetches balances through the selected exchange account when exchangeAccountId is provided', async () => {
    const { service, client, accountStore } = createService()

    accountStore.getAccountConfigById.mockResolvedValue({
      exchangeId: 'okx',
      config: { apiKey: 'k', secret: 's', passphrase: 'p', isTestnet: true },
    })
    client.fetchBalance.mockResolvedValue([{ asset: 'USDT', free: 60000, locked: 0, total: 60000 }])

    const result = await service.getBalance('user-1', 'okx', 'spot', 'exchange-account-1')

    expect(accountStore.getAccountConfigById).toHaveBeenCalledWith('exchange-account-1', 'user-1')
    expect(accountStore.getAccountConfig).not.toHaveBeenCalled()
    expect(result).toEqual([{ asset: 'USDT', free: 60000, locked: 0, total: 60000 }])
  })

  it('fetches positions through the selected exchange account when exchangeAccountId is provided', async () => {
    const { service, client, accountStore } = createService()

    accountStore.getAccountConfigById.mockResolvedValue({
      exchangeId: 'okx',
      config: { apiKey: 'k', secret: 's', passphrase: 'p', isTestnet: true },
    })
    client.fetchPositions.mockResolvedValue([{ symbol: 'BTC/USDT:PERP', side: 'long', size: 0.001 }])

    const result = await service.getPositions('user-1', 'okx', 'perp', 'exchange-account-1')

    expect(accountStore.getAccountConfigById).toHaveBeenCalledWith('exchange-account-1', 'user-1')
    expect(accountStore.getAccountConfig).not.toHaveBeenCalled()
    expect(result).toEqual([{ symbol: 'BTC/USDT:PERP', side: 'long', size: 0.001 }])
  })

  it('rejects binance spot orders when the account only has futures capability', async () => {
    const { service, accountStore } = createService()

    accountStore.getAccountConfig.mockResolvedValue({
      exchangeId: 'binance',
      config: { apiKey: 'k', secret: 's', isTestnet: true, spotEnabled: false, futuresEnabled: true },
    })

    await expect(service.placeOrder(
      'user-1',
      'binance',
      'spot',
      {
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        type: 'market',
        amount: 0.001,
      },
    )).rejects.toMatchObject({
      code: expect.any(String),
      args: expect.objectContaining({
        exchangeId: 'binance',
        marketType: 'spot',
      }),
    })
  })

  it('allows binance perp orders when the account has futures capability', async () => {
    const { service, client, accountStore } = createService()

    accountStore.getAccountConfig.mockResolvedValue({
      exchangeId: 'binance',
      config: { apiKey: 'k', secret: 's', isTestnet: true, spotEnabled: false, futuresEnabled: true },
    })
    client.createOrder.mockResolvedValue({ id: 'order-3', status: 'open' })

    await expect(service.placeOrder(
      'user-1',
      'binance',
      'perp',
      {
        symbol: 'BTC/USDT:PERP',
        marketType: 'perp',
        side: 'buy',
        type: 'market',
        amount: 0.001,
      },
    )).resolves.toEqual({ id: 'order-3', status: 'open' })
  })
})
