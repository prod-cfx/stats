import { BybitOrderbookWsAdapterBase } from '../src/modules/data-sync/services/adapters/bybit/bybit-orderbook-ws.base'

class TestBybitOrderbookAdapter extends BybitOrderbookWsAdapterBase {
  readonly key = 'BYBIT.CEX.PERPETUAL' as const
  protected readonly venueId = 'bybit-perp'
  protected readonly instrumentType = 'PERPETUAL' as const
  protected readonly category = 'linear' as const
}

describe('BybitOrderbookWsAdapterBase sequence handling', () => {
  const createAdapter = () => {
    const configService = {
      get: jest.fn(() => undefined),
    }
    const redisService = {
      getClient: jest.fn(() => null),
    }
    return new TestBybitOrderbookAdapter(configService as any, redisService as any)
  }

  const createState = () => ({
    cfg: {
      depthLevels: 50,
    },
    marketKey: 'BTC/USDT:perp',
    bids: new Map<string, number>([['100', 1]]),
    asks: new Map<string, number>([['101', 1]]),
    lastUpdateId: 100,
    lastSeq: 0,
    buffer: [],
    isReady: true,
    lastPublishTs: 0,
  })

  it('applies delta without pu even when u is not continuous', async () => {
    const adapter = createAdapter() as any
    const state = createState()

    adapter.resync = jest.fn().mockResolvedValue(undefined)
    adapter.publish = jest.fn().mockResolvedValue(undefined)

    await adapter.applyEvent('BTCUSDT', state, {
      type: 'delta',
      data: {
        s: 'BTCUSDT',
        b: [['100', '2']],
        a: [['101', '0']],
        u: 200,
      },
      ts: 123,
      cts: 123,
    })

    expect(adapter.resync).not.toHaveBeenCalled()
    expect(state.lastUpdateId).toBe(200)
    expect(state.bids.get('100')).toBe(2)
    expect(state.asks.has('101')).toBe(false)
  })

  it('resyncs when pu exists but does not match last update id', async () => {
    const adapter = createAdapter() as any
    const state = createState()

    adapter.resync = jest.fn().mockResolvedValue(undefined)
    adapter.publish = jest.fn().mockResolvedValue(undefined)

    await adapter.applyEvent('BTCUSDT', state, {
      type: 'delta',
      data: {
        s: 'BTCUSDT',
        b: [['100', '2']],
        a: [['101', '1']],
        u: 101,
        pu: 99,
      },
      ts: 123,
      cts: 123,
    })

    expect(adapter.resync).toHaveBeenCalledTimes(1)
    expect(state.lastUpdateId).toBe(100)
  })
})
