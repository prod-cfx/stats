import { HyperliquidDexPerpetualOrderbookWsAdapter } from '../hyperliquid-dex-perpetual-orderbook-ws.adapter'

describe('HyperliquidOrderbookWsAdapterBase', () => {
  const redisClient = {
    set: jest.fn(),
  }
  const redisService = {
    getClient: jest.fn(() => redisClient),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

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

  it('does not reject websocket message handling when redis publish fails', async () => {
    redisClient.set.mockRejectedValueOnce(new Error('redis down'))
    const adapter = createAdapter({ ORDERBOOK_WS_PUBLISH_INTERVAL_MS: 0 })

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
    ;(adapter as unknown as { redis: typeof redisClient }).redis = redisClient

    await expect((adapter as unknown as { onMessage: (raw: Buffer) => Promise<void> }).onMessage(Buffer.from(JSON.stringify({
      channel: 'l2Book',
      data: {
        coin: 'AVAX',
        time: Date.now(),
        levels: [
          [{ px: '10', sz: '1', n: 1 }],
          [{ px: '11', sz: '2', n: 1 }],
        ],
      },
    })))).resolves.toBeUndefined()
  })
})
