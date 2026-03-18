import { MarketDataService } from '../market-data.service'

describe('marketDataService symbol code compatibility', () => {
  const prismaMock = {
    symbol: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    marketBar: {
      upsert: jest.fn(),
    },
    marketQuote: {
      create: jest.fn(),
    },
  }

  const indicatorEngineMock = {
    handleNewBar: jest.fn(),
  }

  let service: MarketDataService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new MarketDataService(prismaMock as never, indicatorEngineMock as never)
  })

  it('falls back unsuffixed symbol to :SPOT', async () => {
    prismaMock.symbol.findMany.mockResolvedValue([{ id: 'spot-id', code: 'BTCUSDT:SPOT' }])

    await expect(service.getSymbolOrThrow('BTCUSDT')).resolves.toEqual({ id: 'spot-id', code: 'BTCUSDT:SPOT' })
  })

  it('prefers exact suffixed symbol', async () => {
    prismaMock.symbol.findMany.mockResolvedValue([{ id: 'perp-id', code: 'BTCUSDT:PERP' }])

    await expect(service.getSymbolOrThrow('BTCUSDT:PERP')).resolves.toEqual({ id: 'perp-id', code: 'BTCUSDT:PERP' })
  })

  it('falls back to legacy unsuffixed symbol when spot code is missing', async () => {
    prismaMock.symbol.findMany.mockResolvedValue([{ id: 'legacy-id', code: 'BTCUSDT' }])

    await expect(service.getSymbolOrThrow('BTCUSDT')).resolves.toEqual({ id: 'legacy-id', code: 'BTCUSDT' })
  })

  it('warns when both spot and perp exist for unsuffixed input', async () => {
    const warnSpy = jest.spyOn((service as any).logger, 'warn')
    prismaMock.symbol.findMany.mockResolvedValue([
      { id: 'spot-id', code: 'BTCUSDT:SPOT' },
      { id: 'perp-id', code: 'BTCUSDT:PERP' },
    ])

    await service.getSymbolOrThrow('BTCUSDT')

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ambiguous symbol code'))
  })

  it('normalizes provider symbol code using instrumentType', async () => {
    await service.upsertSymbolsFromProvider(
      [
        {
          symbol: 'BTCUSDT',
          status: 'ACTIVE',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          instrumentType: 'PERPETUAL',
        },
      ],
      'BINANCE',
    )

    expect(prismaMock.symbol.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: 'BTCUSDT:PERP' },
        create: expect.objectContaining({ code: 'BTCUSDT:PERP', instrumentType: 'PERPETUAL' }),
        update: expect.objectContaining({ instrumentType: 'PERPETUAL' }),
      }),
    )
  })
})
