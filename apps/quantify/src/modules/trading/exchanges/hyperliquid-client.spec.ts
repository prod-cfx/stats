import { HyperliquidClient } from './hyperliquid-client'

const exchangeClientMock = jest.fn()
const infoClientMock = jest.fn()

jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn(),
  InfoClient: function InfoClient(...args: any[]) {
    return infoClientMock(...args)
  },
  ExchangeClient: function ExchangeClient(...args: any[]) {
    return exchangeClientMock(...args)
  },
}))

jest.mock('./hyperliquid-format', () => ({
  formatPrice: jest.fn((price: string | number) => String(price === 0.18027900000000002 ? '0.18027' : price)),
  formatSize: jest.fn((size: string | number) => String(size === 10.9 ? '10' : size)),
}))

jest.mock('ethers', () => ({
  Wallet: jest.fn().mockImplementation((privateKey: string) => ({ privateKey })),
}))

const { formatPrice, formatSize } = jest.requireMock('./hyperliquid-format') as {
  formatPrice: jest.Mock
  formatSize: jest.Mock
}

describe('hyperliquidClient', () => {
  beforeEach(() => {
    exchangeClientMock.mockReset()
    infoClientMock.mockReset()
    formatPrice.mockClear()
    formatSize.mockClear()
  })

  it('does not pass defaultVaultAddress when trading on the main account', () => {
    const client = new HyperliquidClient({
      mainWalletAddress: '0x049351452584031Ff1f81bdDA1cDf4DB32BB1c09',
      agentPrivateKey: '0x4ccd2503441a4913d4212a764b9bccfc73378bfa5443fc90e14da28aa5f2ddc6',
      isTestnet: true,
    })
    expect(client).toBeInstanceOf(HyperliquidClient)

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

    const client = new (HyperliquidClient as any)({
      mainWalletAddress: '0x049351452584031Ff1f81bdDA1cDf4DB32BB1c09',
      agentPrivateKey: '0x4ccd2503441a4913d4212a764b9bccfc73378bfa5443fc90e14da28aa5f2ddc6',
      isTestnet: true,
    }, 'spot')

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

  it('places a spot limit order using spot asset metadata', async () => {
    const orderMock = jest.fn().mockResolvedValue({
      status: 'ok',
      response: {
        data: {
          statuses: [
            {
              resting: {
                oid: 456,
                cloid: '0xabcdefabcdefabcdefabcdefabcdefab',
              },
            },
          ],
        },
      },
    })

    infoClientMock.mockImplementation(() => ({
      allMids: jest.fn().mockResolvedValue({}),
      spotMeta: jest.fn().mockResolvedValue({
        universe: [
          { tokens: [0, 1], name: 'PURR/USDC', index: 7, isCanonical: true },
        ],
        tokens: [
          {
            name: 'PURR',
            szDecimals: 2,
            weiDecimals: 8,
            index: 0,
            tokenId: '0x0000000000000000000000000000000000000000000000000000000000000000',
            isCanonical: true,
            evmContract: null,
            fullName: 'Purr',
            deployerTradingFeeShare: '0',
          },
          {
            name: 'USDC',
            szDecimals: 6,
            weiDecimals: 6,
            index: 1,
            tokenId: '0x0000000000000000000000000000000000000000000000000000000000000001',
            isCanonical: true,
            evmContract: null,
            fullName: 'USD Coin',
            deployerTradingFeeShare: '0',
          },
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

    const order = await client.createOrder({
      symbol: 'PURR/USDC',
      marketType: 'spot',
      side: 'buy',
      type: 'limit',
      amount: 12.345,
      price: 0.42,
    })

    expect(order.id).toBe('456')
    expect(order.symbol).toBe('PURR/USDC')
    expect(order.marketType).toBe('spot')
    expect(orderMock).toHaveBeenCalledWith({
      type: 'order',
      orders: [
        expect.objectContaining({
          a: 10007,
          b: true,
          p: '0.42',
          s: '12.345',
          r: false,
          t: { limit: { tif: 'Gtc' } },
        }),
      ],
      grouping: 'na',
    })
    expect(formatPrice).toHaveBeenCalledWith(0.42, 2, false)
    expect(formatSize).toHaveBeenCalledWith(12.345, 2)
  })

  it('fetches spot balances from the spot clearinghouse state', async () => {
    infoClientMock.mockImplementation(() => ({
      allMids: jest.fn().mockResolvedValue({}),
      spotClearinghouseState: jest.fn().mockResolvedValue({
        balances: [
          { coin: 'PURR', token: 0, total: '12.5', hold: '2.5', entryNtl: '4.2' },
          { coin: 'USDC', token: 1, total: '100.25', hold: '5.25', entryNtl: '100.25' },
        ],
      }),
    }))
    exchangeClientMock.mockImplementation(() => ({}))

    const client = new (HyperliquidClient as any)({
      mainWalletAddress: '0x049351452584031Ff1f81bdDA1cDf4DB32BB1c09',
      agentPrivateKey: '0x4ccd2503441a4913d4212a764b9bccfc73378bfa5443fc90e14da28aa5f2ddc6',
      isTestnet: true,
    }, 'spot')

    const balances = await client.fetchBalance()

    expect(balances).toEqual([
      { asset: 'PURR', free: 10, locked: 2.5, total: 12.5 },
      { asset: 'USDC', free: 95, locked: 5.25, total: 100.25 },
    ])
  })
})
