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

  it('sends client order id and default OKX limit behavior for GTC limit orders', async () => {
    globalThis.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const rawBody = typeof init?.body === 'string' ? JSON.parse(init.body) : {}

      expect(rawBody).toMatchObject({
        instId: 'BTC-USDT',
        instType: 'SPOT',
        side: 'buy',
        ordType: 'limit',
        px: '70000',
        sz: '0.001',
        clOrdId: 'grid-client-1',
        tdMode: 'cash',
      })
      expect(rawBody).not.toHaveProperty('timeInForce')

      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'limit-order-1',
            clOrdId: 'grid-client-1',
            sCode: '0',
            sMsg: '',
            instId: 'BTC-USDT',
            state: 'live',
            side: 'buy',
            ordType: 'limit',
            px: '70000',
            sz: '0.001',
            fillSz: '0',
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
      type: 'limit',
      amount: 0.001,
      price: 70000,
      timeInForce: 'GTC',
      clientOrderId: 'grid-client-1',
    })

    expect(order.clientOrderId).toBe('grid-client-1')
    expect(order.status).toBe('open')
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
    })

    expect(order.amount).toBeCloseTo(0.0013)
    expect(order.filled).toBeCloseTo(0.0013)
    expect(order.price).toBeCloseTo(74147.2)
  })

  it('preserves OKX perp tdMode, posSide, and reduceOnly order params', async () => {
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
        side: 'sell',
        ordType: 'limit',
        px: '75000',
        sz: '0.13',
        tdMode: 'isolated',
        posSide: 'short',
        reduceOnly: true,
      })

      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'perp-limit-1',
            sCode: '0',
            sMsg: '',
            instId: 'BTC-USDT-SWAP',
            state: 'live',
            side: 'sell',
            ordType: 'limit',
            px: '75000',
            sz: '0.13',
            fillSz: '0',
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
      type: 'limit',
      amount: 0.001348,
      price: 75000,
      tdMode: 'isolated',
      posSide: 'short',
      reduceOnly: true,
    })

    expect(order.id).toBe('perp-limit-1')
    expect(order.status).toBe('open')
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
    })

    expect(order.id).toBe('perp-close-1')
    expect(order.status).toBe('open')
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

  it('maps OKX open order client order ids', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'open-order-1',
            clOrdId: 'grid-client-open',
            instId: 'BTC-USDT',
            state: 'live',
            side: 'buy',
            ordType: 'limit',
            sz: '0.001',
            fillSz: '0',
            px: '70000',
            uTime: '1773829253570',
            cTime: '1773829253522',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const orders = await createClient().fetchOpenOrders('BTC/USDT')

    expect(orders[0]?.clientOrderId).toBe('grid-client-open')
    expect(orders[0]?.status).toBe('open')
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

  it('maps OKX closed order fill, status, side, price, client id, and raw payload', async () => {
    const rawOrder = {
      ordId: 'closed-order-1',
      clOrdId: 'grid-client-closed',
      instId: 'BTC-USDT',
      state: 'filled',
      side: 'sell',
      ordType: 'limit',
      sz: '0.002',
      fillSz: '0.0015',
      px: '71000',
      avgPx: '70950',
      uTime: '1773829253570',
      cTime: '1773829253522',
    }

    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({
        data: [rawOrder],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const orders = await createClient().fetchClosedOrders('BTC/USDT')

    expect(orders).toEqual([
      expect.objectContaining({
        id: 'closed-order-1',
        clientOrderId: 'grid-client-closed',
        side: 'sell',
        price: 71000,
        amount: 0.002,
        filled: 0.0015,
        status: 'closed',
        raw: rawOrder,
      }),
    ])
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
