import type { MarketDataReadGateway } from '@/modules/market-data/services/market-data-read.gateway'
import { TradingPriceInputService } from '../services/trading-price-input.service'

describe('trading market-data smoke', () => {
  const mockGateway = {
    getLatestQuote: jest.fn(),
  }

  let service: TradingPriceInputService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new TradingPriceInputService(mockGateway as unknown as MarketDataReadGateway)
  })

  it('reads lastPrice from market data gateway for mock order validation', async () => {
    mockGateway.getLatestQuote.mockResolvedValue({ symbol: 'BTCUSDT', lastPrice: 65000 })

    await expect(service.getReferencePrice('BTCUSDT')).resolves.toBe(65000)
    expect(mockGateway.getLatestQuote).toHaveBeenCalledWith('BTCUSDT')
  })
})
