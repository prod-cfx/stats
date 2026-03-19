const exchangeClientMock = jest.fn()
const infoClientMock = jest.fn()

jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn(),
  InfoClient: infoClientMock,
  ExchangeClient: exchangeClientMock,
}))

jest.mock('@nktkas/hyperliquid/utils', () => ({
  formatPrice: jest.fn((price: string | number) => String(price === 0.18027900000000002 ? '0.18027' : price)),
  formatSize: jest.fn((size: string | number) => String(size === 10.9 ? '10' : size)),
}))

jest.mock('ethers', () => ({
  Wallet: jest.fn().mockImplementation((privateKey: string) => ({ privateKey })),
}))

import { HyperliquidClient } from './hyperliquid-client'

describe('HyperliquidClient', () => {
  beforeEach(() => {
    exchangeClientMock.mockReset()
    infoClientMock.mockReset()
  })

  it('does not pass defaultVaultAddress when trading on the main account', () => {
    new HyperliquidClient({
      mainWalletAddress: '0x049351452584031Ff1f81bdDA1cDf4DB32BB1c09',
      agentPrivateKey: '0x4ccd2503441a4913d4212a764b9bccfc73378bfa5443fc90e14da28aa5f2ddc6',
      isTestnet: true,
    })

    expect(exchangeClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet: expect.objectContaining({
          privateKey: '0x4ccd2503441a4913d4212a764b9bccfc73378bfa5443fc90e14da28aa5f2ddc6',
        }),
      }),
    )
    expect(exchangeClientMock.mock.calls[0]?.[0]).not.toHaveProperty('defaultVaultAddress')
  })

  it('formats size and price using exchange precision before placing orders', async () => {
    const orderMock = jest.fn().mockResolvedValue({
      status: 'ok',
      response: {
        data: {
          statuses: [
            {
              resting: {
                oid: 123,
                cloid: '0x1234567890abcdef1234567890abcdef',
              },
            },
          ],
        },
      },
    })

    infoClientMock.mockImplementation(() => ({
      allMids: jest.fn().mockResolvedValue({ JUP: '0.16389' }),
      meta: jest.fn().mockResolvedValue({
        universe: [
          { name: 'JUP', szDecimals: 0 },
        ],
      }),
    }))
    exchangeClientMock.mockImplementation(() => ({
      order: orderMock,
    }))

    const client = new HyperliquidClient({
      mainWalletAddress: '0x049351452584031Ff1f81bdDA1cDf4DB32BB1c09',
      agentPrivateKey: '0x4ccd2503441a4913d4212a764b9bccfc73378bfa5443fc90e14da28aa5f2ddc6',
      isTestnet: true,
    })

    await client.createOrder({
      symbol: 'JUP/USDC:PERP',
      marketType: 'perp',
      side: 'buy',
      type: 'market',
      amount: 10.9,
    })

    expect(orderMock).toHaveBeenCalledWith({
      type: 'order',
      orders: [
        expect.objectContaining({
          a: 0,
          b: true,
          p: '0.1671678',
          s: '10',
          r: false,
          t: { limit: { tif: 'FrontendMarket' } },
        }),
      ],
      grouping: 'na',
    })
  })
})
