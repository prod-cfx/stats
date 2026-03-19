import { ExchangeFactory } from './exchange-factory'

describe('exchangeFactory', () => {
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
