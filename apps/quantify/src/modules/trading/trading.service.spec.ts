import { ExchangeOperationFailedException } from './exceptions'
import { TradingService } from './trading.service'

describe('tradingService', () => {
  function createService() {
    const client = {
      createOrder: jest.fn(),
      fetchOrder: jest.fn(),
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
})
