import type { ExchangeError } from '../core/errors'
import { OkxClient } from './okx-client'

describe('okxClient', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
  })

  function createClient() {
    return new OkxClient('spot', {
      apiKey: 'test-api-key',
      secret: 'test-secret',
      passphrase: 'test-passphrase',
      isTestnet: true,
    })
  }

  it('uses base_ccy sizing for spot market buy orders', async () => {
    globalThis.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const rawBody = typeof init?.body === 'string' ? JSON.parse(init.body) : {}

      expect(rawBody).toMatchObject({
        instId: 'BTC-USDT',
        instType: 'SPOT',
        side: 'buy',
        ordType: 'market',
        sz: '0.00134',
        tdMode: 'cash',
        tgtCcy: 'base_ccy',
      })

      return new Response(JSON.stringify({
        data: [
          {
            ordId: '987654',
            clOrdId: 'test-okx-order',
            sCode: '0',
            sMsg: '',
            avgPx: '74212.9',
            fillSz: '0.00133989',
            state: 'filled',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const order = await createClient().createOrder({
      symbol: 'BTC/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      amount: 0.00134,
    })

    expect(order.id).toBe('987654')
    expect(order.status).toBe('closed')
    expect(order.price).toBeCloseTo(74212.9)
    expect(order.filled).toBeCloseTo(0.00133989)
  })

  it('uses avgPx when market order ack does not include px', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({
        data: [
          {
            ordId: '987654',
            clOrdId: 'test-okx-order',
            sCode: '0',
            sMsg: '',
            px: '',
            avgPx: '74212.9',
            fillSz: '0.00133989',
            state: 'filled',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const order = await createClient().createOrder({
      symbol: 'BTC/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      amount: 0.00134,
    })

    expect(order.price).toBeCloseTo(74212.9)
    expect(order.status).toBe('closed')
  })

  it('throws exchange error when OKX rejects an order ack', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({
        data: [
          {
            ordId: '',
            clOrdId: '',
            sCode: '51020',
            sMsg: 'Your order should meet or exceed the minimum order amount.',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    await expect(
      createClient().createOrder({
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        type: 'market',
        amount: 0.00134,
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<ExchangeError>>({
      name: 'ExchangeError',
      code: '51020',
    }))
  })

  it('uses avgPx when fetching a filled order without px', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({
        data: [
          {
            ordId: '987654',
            clOrdId: 'test-okx-order',
            instId: 'BTC-USDT',
            state: 'filled',
            side: 'buy',
            ordType: 'market',
            fillSz: '0.00133999',
            sz: '0.00134',
            px: '',
            avgPx: '74207.9',
            fillPx: '74207.9',
            uTime: '1773829253570',
            cTime: '1773829253522',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const order = await createClient().fetchOrder('987654', 'BTC/USDT')

    expect(order.price).toBeCloseTo(74207.9)
    expect(order.filled).toBeCloseTo(0.00133999)
    expect(order.status).toBe('closed')
  })

  it('uses spot available balance when OKX omits available equity', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({
        data: [
          {
            details: [
              {
                ccy: 'USDT',
                eq: '4901.58222',
                availEq: '',
                availBal: '4901.58222',
                cashBal: '4901.58222',
              },
            ],
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const balances = await createClient().fetchBalance()

    expect(balances).toEqual([
      {
        asset: 'USDT',
        free: 4901.58222,
        locked: 0,
        total: 4901.58222,
      },
    ])
  })

  it('converts perp base size to contract size when creating orders', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)

      if (url.pathname === '/api/v5/public/instruments') {
        return new Response(JSON.stringify({
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              ctVal: '0.01',
              lotSz: '0.01',
            },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      const rawBody = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
      expect(rawBody).toMatchObject({
        instId: 'BTC-USDT-SWAP',
        instType: 'SWAP',
        side: 'buy',
        ordType: 'market',
        sz: '0.13',
        tdMode: 'cross',
      })
      expect(rawBody).not.toHaveProperty('posSide')

      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'perp-order-1',
            sCode: '0',
            sMsg: '',
            sz: '0.13',
            fillSz: '0.13',
            avgPx: '74147.2',
            state: 'filled',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const order = await new OkxClient('perp', {
      apiKey: 'test-api-key',
      secret: 'test-secret',
      passphrase: 'test-passphrase',
      isTestnet: true,
    }).createOrder({
      symbol: 'BTC/USDT:PERP',
      marketType: 'perp',
      side: 'buy',
      type: 'market',
      amount: 0.001348,
      extra: { tdMode: 'cross' },
    })

    expect(order.amount).toBeCloseTo(0.0013)
    expect(order.filled).toBeCloseTo(0.0013)
    expect(order.price).toBeCloseTo(74147.2)
  })

  it('uses typed tdMode and positionSide fields when creating OKX perp orders', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)

      if (url.pathname === '/api/v5/public/instruments') {
        return new Response(JSON.stringify({
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              ctVal: '0.01',
              lotSz: '0.01',
            },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      const rawBody = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
      expect(rawBody).toMatchObject({
        instId: 'BTC-USDT-SWAP',
        instType: 'SWAP',
        side: 'buy',
        ordType: 'market',
        sz: '0.13',
        tdMode: 'cross',
        posSide: 'long',
      })

      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'perp-order-typed-fields',
            sCode: '0',
            sMsg: '',
            sz: '0.13',
            fillSz: '0.13',
            avgPx: '74147.2',
            state: 'filled',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const order = await new OkxClient('perp', {
      apiKey: 'test-api-key',
      secret: 'test-secret',
      passphrase: 'test-passphrase',
      isTestnet: true,
    }).createOrder({
      symbol: 'BTC/USDT:PERP',
      marketType: 'perp',
      side: 'buy',
      type: 'market',
      amount: 0.001348,
      tdMode: 'cross',
      positionSide: 'LONG',
    })

    expect(order.id).toBe('perp-order-typed-fields')
    expect(order.amount).toBeCloseTo(0.0013)
  })

  it('omits posSide by default for OKX perp net mode close orders', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)

      if (url.pathname === '/api/v5/public/instruments') {
        return new Response(JSON.stringify({
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              ctVal: '0.01',
              lotSz: '0.01',
            },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      const rawBody = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
      expect(rawBody).toMatchObject({
        instId: 'BTC-USDT-SWAP',
        side: 'sell',
        reduceOnly: true,
        sz: '0.13',
      })
      expect(rawBody).not.toHaveProperty('posSide')

      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'perp-close-1',
            sCode: '0',
            sMsg: '',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const order = await new OkxClient('perp', {
      apiKey: 'test-api-key',
      secret: 'test-secret',
      passphrase: 'test-passphrase',
      isTestnet: true,
    }).createOrder({
      symbol: 'BTC/USDT:PERP',
      marketType: 'perp',
      side: 'sell',
      type: 'market',
      amount: 0.001348,
      reduceOnly: true,
      extra: { tdMode: 'cross' },
    })

    expect(order.id).toBe('perp-close-1')
    expect(order.status).toBe('open')
  })

  it('rejects OKX perp orders without explicit tdMode', async () => {
    globalThis.fetch = jest.fn(async () => new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch

    await expect(new OkxClient('perp', {
      apiKey: 'test-api-key',
      secret: 'test-secret',
      passphrase: 'test-passphrase',
      isTestnet: true,
    }).createOrder({
      symbol: 'BTC-USDT-SWAP',
      marketType: 'perp',
      side: 'buy',
      type: 'market',
      amount: 0.001348,
    })).rejects.toEqual(expect.objectContaining<Partial<ExchangeError>>({
      name: 'ExchangeError',
      code: 'OKX_TD_MODE_REQUIRED',
    }))
  })

  it('converts perp contract size back to base size when fetching orders', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)

      if (url.pathname === '/api/v5/public/instruments') {
        return new Response(JSON.stringify({
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              ctVal: '0.01',
              lotSz: '0.01',
            },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'perp-order-1',
            instId: 'BTC-USDT-SWAP',
            state: 'filled',
            side: 'buy',
            ordType: 'market',
            sz: '0.13',
            fillSz: '0.13',
            avgPx: '74147.2',
            uTime: '1773829253570',
            cTime: '1773829253522',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const order = await new OkxClient('perp', {
      apiKey: 'test-api-key',
      secret: 'test-secret',
      passphrase: 'test-passphrase',
      isTestnet: true,
    }).fetchOrder('perp-order-1', 'BTC/USDT:PERP')

    expect(order.amount).toBeCloseTo(0.0013)
    expect(order.filled).toBeCloseTo(0.0013)
    expect(order.price).toBeCloseTo(74147.2)
    expect(order.status).toBe('closed')
  })

  it('uses OKX accumulated fill size for perp filled base size', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)

      if (url.pathname === '/api/v5/public/instruments') {
        return new Response(JSON.stringify({
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              ctVal: '0.01',
              lotSz: '0.01',
            },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'perp-order-1',
            instId: 'BTC-USDT-SWAP',
            state: 'filled',
            side: 'buy',
            ordType: 'market',
            sz: '1',
            fillSz: '0.39',
            accFillSz: '1',
            avgPx: '77693.641',
            uTime: '1773829253570',
            cTime: '1773829253522',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const order = await new OkxClient('perp', {
      apiKey: 'test-api-key',
      secret: 'test-secret',
      passphrase: 'test-passphrase',
      isTestnet: true,
    }).fetchOrder('perp-order-1', 'BTC/USDT:PERP')

    expect(order.amount).toBeCloseTo(0.01)
    expect(order.filled).toBeCloseTo(0.01)
  })

  it('converts perp contract size back to base size when canceling orders', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)

      if (url.pathname === '/api/v5/public/instruments') {
        return new Response(JSON.stringify({
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              ctVal: '0.01',
              lotSz: '0.01',
            },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'perp-order-1',
            instId: 'BTC-USDT-SWAP',
            state: 'canceled',
            side: 'buy',
            ordType: 'market',
            sz: '0.13',
            fillSz: '0.13',
            avgPx: '74147.2',
            uTime: '1773829253570',
            cTime: '1773829253522',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const order = await new OkxClient('perp', {
      apiKey: 'test-api-key',
      secret: 'test-secret',
      passphrase: 'test-passphrase',
      isTestnet: true,
    }).cancelOrder('perp-order-1', 'BTC/USDT:PERP')

    expect(order.amount).toBeCloseTo(0.0013)
    expect(order.filled).toBeCloseTo(0.0013)
    expect(order.status).toBe('canceled')
  })

  it('converts perp contract sizes back to base sizes when listing open orders', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)

      if (url.pathname === '/api/v5/public/instruments') {
        return new Response(JSON.stringify({
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              ctVal: '0.01',
              lotSz: '0.01',
            },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'perp-order-1',
            instId: 'BTC-USDT-SWAP',
            state: 'live',
            side: 'buy',
            ordType: 'market',
            sz: '0.13',
            fillSz: '0',
            avgPx: '74147.2',
            uTime: '1773829253570',
            cTime: '1773829253522',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const orders = await new OkxClient('perp', {
      apiKey: 'test-api-key',
      secret: 'test-secret',
      passphrase: 'test-passphrase',
      isTestnet: true,
    }).fetchOpenOrders()

    expect(orders).toHaveLength(1)
    expect(orders[0]?.amount).toBeCloseTo(0.0013)
  })

  it('converts perp contract sizes back to base sizes when listing closed orders', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)

      if (url.pathname === '/api/v5/public/instruments') {
        return new Response(JSON.stringify({
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              ctVal: '0.01',
              lotSz: '0.01',
            },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'perp-order-1',
            instId: 'BTC-USDT-SWAP',
            state: 'filled',
            side: 'buy',
            ordType: 'market',
            sz: '0.13',
            fillSz: '0.13',
            avgPx: '74147.2',
            uTime: '1773829253570',
            cTime: '1773829253522',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const orders = await new OkxClient('perp', {
      apiKey: 'test-api-key',
      secret: 'test-secret',
      passphrase: 'test-passphrase',
      isTestnet: true,
    }).fetchClosedOrders()

    expect(orders).toHaveLength(1)
    expect(orders[0]?.amount).toBeCloseTo(0.0013)
    expect(orders[0]?.status).toBe('closed')
  })

  it('converts perp position contract sizes back to base sizes', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)

      if (url.pathname === '/api/v5/public/instruments') {
        return new Response(JSON.stringify({
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              ctVal: '0.01',
              lotSz: '0.01',
            },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        data: [
          {
            instId: 'BTC-USDT-SWAP',
            instType: 'SWAP',
            mgnMode: 'cross',
            posSide: 'net',
            pos: '4',
            avgPx: '76891.8',
            lever: '3',
            upl: '0',
            liqPx: '',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const positions = await new OkxClient('perp', {
      apiKey: 'test-api-key',
      secret: 'test-secret',
      passphrase: 'test-passphrase',
      isTestnet: true,
    }).fetchPositions()

    expect(positions).toHaveLength(1)
    expect(positions[0]?.size).toBeCloseTo(0.04)
  })
})
