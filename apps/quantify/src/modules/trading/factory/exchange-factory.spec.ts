import { ExchangeFactory } from './exchange-factory'
import { OkxClient } from '../exchanges/okx-client'

jest.mock('../exchanges/okx-client', () => ({
  OkxClient: jest.fn(() => ({ source: 'okx' })),
}))

describe('exchangeFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes configured http egress options to OKX clients', () => {
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          'httpEgress.proxyUrl': 'http://127.0.0.1:7890',
          'httpEgress.localAddress': '10.0.0.12',
        }
        return values[key]
      }),
    }
    const factory = new ExchangeFactory(configService as any)

    const client = factory.createClient('okx', 'spot', {
      exchangeId: 'okx',
      config: {
        apiKey: 'test-api-key',
        secret: 'test-secret',
        passphrase: 'test-passphrase',
      },
    })

    expect(client).toEqual({ source: 'okx' })
    expect(OkxClient).toHaveBeenCalledWith(
      'spot',
      {
        apiKey: 'test-api-key',
        secret: 'test-secret',
        passphrase: 'test-passphrase',
      },
      expect.objectContaining({
        dispatcher: expect.any(Object),
        tokenBucketEnabled: false,
      }),
    )
  })

  it('reuses and closes configured OKX http egress dispatchers', async () => {
    const configService = {
      get: jest.fn((key: string) => key === 'httpEgress.proxyUrl' ? 'http://127.0.0.1:7890' : undefined),
    }
    const factory = new ExchangeFactory(configService as any)

    factory.createClient('okx', 'spot', {
      exchangeId: 'okx',
      config: {
        apiKey: 'test-api-key',
        secret: 'test-secret',
        passphrase: 'test-passphrase',
      },
    })
    const firstDispatcher = (OkxClient as jest.Mock).mock.calls[0][2].dispatcher
    const close = jest.spyOn(firstDispatcher, 'close').mockResolvedValue(undefined)

    factory.createClient('okx', 'perp', {
      exchangeId: 'okx',
      config: {
        apiKey: 'second-api-key',
        secret: 'test-secret',
        passphrase: 'test-passphrase',
      },
    })

    expect((OkxClient as jest.Mock).mock.calls[1][2].dispatcher).toBe(firstDispatcher)

    await factory.onModuleDestroy()

    expect(close).toHaveBeenCalledTimes(1)
  })

  it('passes token bucket settings to OKX clients', () => {
    const rateLimiter = { acquire: jest.fn(async () => undefined) }
    const configService = {
      get: jest.fn((key: string) => key === 'featureFlags.tokenBucketEnabled' ? true : undefined),
    }
    const factory = new ExchangeFactory(configService as any, rateLimiter as any)

    factory.createClient('okx', 'spot', {
      exchangeId: 'okx',
      config: {
        apiKey: 'test-api-key',
        secret: 'test-secret',
        passphrase: 'test-passphrase',
      },
    })

    expect(OkxClient).toHaveBeenCalledWith(
      'spot',
      expect.objectContaining({ apiKey: 'test-api-key' }),
      expect.objectContaining({
        rateLimiter,
        tokenBucketEnabled: true,
      }),
    )
  })

  it('passes OKX retry flag to OKX clients', () => {
    const configService = {
      get: jest.fn((key: string) => key === 'featureFlags.okxRetryEnabled' ? true : undefined),
    }
    const factory = new ExchangeFactory(configService as any)

    factory.createClient('okx', 'spot', {
      exchangeId: 'okx',
      config: {
        apiKey: 'test-api-key',
        secret: 'test-secret',
        passphrase: 'test-passphrase',
      },
    })

    expect(OkxClient).toHaveBeenCalledWith(
      'spot',
      expect.objectContaining({ apiKey: 'test-api-key' }),
      expect.objectContaining({
        retryEnabled: true,
      }),
    )
  })

  it('creates a Hyperliquid client for perp accounts', () => {
    const factory = new ExchangeFactory()
    const fakeClient = { source: 'hyperliquid' }
    const HyperliquidClient = jest.fn(() => fakeClient)

    jest.spyOn(factory as any, 'loadHyperliquidClient').mockReturnValue(HyperliquidClient)

    const client = factory.createClient('hyperliquid', 'perp', {
      exchangeId: 'hyperliquid',
      config: {
        mainWalletAddress: '0x049351452584031Ff1f81bdDA1cDf4DB32BB1c09',
        agentPrivateKey: '0x4ccd2503441a4913d4212a764b9bccfc73378bfa5443fc90e14da28aa5f2ddc6',
        isTestnet: true,
      },
    })

    expect(client).toBe(fakeClient)
    expect(HyperliquidClient).toHaveBeenCalledWith(
      {
        mainWalletAddress: '0x049351452584031Ff1f81bdDA1cDf4DB32BB1c09',
        agentPrivateKey: '0x4ccd2503441a4913d4212a764b9bccfc73378bfa5443fc90e14da28aa5f2ddc6',
        isTestnet: true,
      },
      'perp',
    )
  })

  it('creates a Hyperliquid client for spot accounts', () => {
    const factory = new ExchangeFactory()
    const fakeClient = { source: 'hyperliquid-spot' }
    const HyperliquidClient = jest.fn(() => fakeClient)

    jest.spyOn(factory as any, 'loadHyperliquidClient').mockReturnValue(HyperliquidClient)

    const client = factory.createClient('hyperliquid', 'spot', {
      exchangeId: 'hyperliquid',
      config: {
        mainWalletAddress: '0x049351452584031Ff1f81bdDA1cDf4DB32BB1c09',
        agentPrivateKey: '0x4ccd2503441a4913d4212a764b9bccfc73378bfa5443fc90e14da28aa5f2ddc6',
        isTestnet: true,
      },
    })

    expect(client).toBe(fakeClient)
    expect(HyperliquidClient).toHaveBeenCalledWith(
      expect.objectContaining({
        mainWalletAddress: '0x049351452584031Ff1f81bdDA1cDf4DB32BB1c09',
      }),
      'spot',
    )
  })
})
