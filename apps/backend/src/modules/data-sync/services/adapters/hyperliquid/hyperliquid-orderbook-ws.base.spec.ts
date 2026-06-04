import { HyperliquidDexPerpetualOrderbookWsAdapter } from '../hyperliquid-dex-perpetual-orderbook-ws.adapter'

describe('HyperliquidOrderbookWsAdapterBase', () => {
  const redisService = {
    getClient: jest.fn(),
  }

  function createAdapter(configValues: Record<string, unknown>) {
    const configService = {
      get: jest.fn((key: string) => configValues[key]),
    }

    return new HyperliquidDexPerpetualOrderbookWsAdapter(
      configService as never,
      redisService as never,
    )
  }

  it('keeps hyperliquid orderbook sync enabled when the dedicated env flag is not configured', async () => {
    const adapter = createAdapter({})
    const ensureConnectedSpy = jest.spyOn(adapter, 'ensureConnected').mockResolvedValue(undefined)

    await adapter.syncTargetConfigs([
      {
        venue: 'HYPERLIQUID',
        venueType: 'DEX',
        instrumentType: 'PERPETUAL',
        baseAsset: 'AVAX',
        quoteAsset: 'USDT',
        priority: 1,
        depthLevels: 100,
      } as never,
    ])

    expect(ensureConnectedSpy).not.toHaveBeenCalled()
    expect((adapter as unknown as { states: Map<string, unknown> }).states.has('AVAX')).toBe(true)
  })
})
