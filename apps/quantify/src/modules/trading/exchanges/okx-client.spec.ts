import type { ExchangeError } from '../core/errors'
import { OkxClient } from './okx-client'

describe('okxClient', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
  })

  function okJson(body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  function createClient(options: { marketType?: 'spot' | 'perp' } = {}) {
    return new OkxClient(options.marketType ?? 'spot', {
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

  it('throws exchange error when fetching an order from empty OKX data', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({
        data: [],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    await expect(createClient().fetchOrder('missing-order', 'BTC/USDT'))
      .rejects.toMatchObject({
        name: 'ExchangeError',
        message: 'OKX fetchOrder returned empty response',
      })
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

  it('returns OKX perp instrument constraints for execution admission', async () => {
    const requests: Array<{ pathname: string; search: string }> = []
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      requests.push({ pathname: url.pathname, search: url.search })
      if (url.pathname === '/api/v5/public/instruments') {
        return okJson({
          data: [{
            instId: 'BTC-USDT-SWAP',
            ctVal: '0.01',
            lotSz: '1',
            tickSz: '0.1',
            minSz: '1',
          }],
        })
      }
      return okJson({ code: '0', data: [] })
    }) as typeof fetch

    const constraints = await createClient({ marketType: 'perp' }).fetchInstrumentConstraints?.('BTC/USDT:PERP')

    expect(constraints).toEqual({
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      rawSymbol: 'BTC-USDT-SWAP',
      priceTickSize: '0.1',
      quantityStepSize: '1',
      minQuantity: '1',
      contractValue: '0.01',
      clientOrderId: {
        maxLength: 32,
        pattern: '^[A-Za-z0-9]+$',
      },
      raw: expect.objectContaining({ instId: 'BTC-USDT-SWAP' }),
    })
    expect(requests.some(request => request.pathname === '/api/v5/public/instruments')).toBe(true)
    expect(requests.some((request) => {
      const search = new URLSearchParams(request.search)
      return search.get('instType') === 'SWAP' && search.get('instId') === 'BTC-USDT-SWAP'
    })).toBe(true)
  })

  it('throws when OKX perp instrument constraints are incomplete', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.pathname === '/api/v5/public/instruments') {
        return okJson({
          data: [{
            instId: 'BTC-USDT-SWAP',
            minSz: '1',
          }],
        })
      }
      return okJson({ code: '0', data: [] })
    }) as typeof fetch

    await expect(createClient({ marketType: 'perp' }).fetchInstrumentConstraints?.('BTC/USDT:PERP'))
      .rejects.toMatchObject({
        name: 'ExchangeError',
        message: 'OKX instrument constraints incomplete for BTC-USDT-SWAP',
      })
  })

  it('returns OKX spot instrument constraints for execution admission', async () => {
    const requests: Array<{ pathname: string; search: string }> = []
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      requests.push({ pathname: url.pathname, search: url.search })
      if (url.pathname === '/api/v5/public/instruments') {
        return okJson({
          data: [{
            instId: 'BTC-USDT',
            lotSz: '0.00000001',
            tickSz: '0.01',
            minSz: '0.00001',
          }],
        })
      }
      return okJson({ code: '0', data: [] })
    }) as typeof fetch

    const constraints = await createClient({ marketType: 'spot' }).fetchInstrumentConstraints?.('BTC/USDT')

    expect(constraints).toEqual({
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      rawSymbol: 'BTC-USDT',
      priceTickSize: '0.01',
      quantityStepSize: '0.00000001',
      minQuantity: '0.00001',
      contractValue: null,
      clientOrderId: {
        maxLength: 32,
        pattern: '^[A-Za-z0-9]+$',
      },
      raw: expect.objectContaining({ instId: 'BTC-USDT' }),
    })
    expect(requests.some((request) => {
      const search = new URLSearchParams(request.search)
      return search.get('instType') === 'SPOT' && search.get('instId') === 'BTC-USDT'
    })).toBe(true)
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
      tdMode: 'cross',
    })

    expect(order.amount).toBeCloseTo(0.0013)
    expect(order.filled).toBeCloseTo(0.0013)
    expect(order.price).toBeCloseTo(74147.2)
  })

  it('rounds OKX perp buy limit prices down to instrument tick size when creating orders', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)

      if (url.pathname === '/api/v5/public/instruments') {
        return new Response(JSON.stringify({
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              ctVal: '0.01',
              lotSz: '0.01',
              tickSz: '0.1',
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
        ordType: 'limit',
        px: '79283.3',
        sz: '10',
        tdMode: 'cross',
      })

      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'perp-limit-order-1',
            sCode: '0',
            sMsg: '',
            instId: 'BTC-USDT-SWAP',
            state: 'live',
            side: 'buy',
            ordType: 'limit',
            px: '79283.3',
            sz: '10',
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
      side: 'buy',
      type: 'limit',
      amount: 0.1,
      price: 79283.33333333333,
      tdMode: 'cross',
    })

    expect(order.price).toBeCloseTo(79283.3)
  })

  it('rounds OKX perp sell limit prices up to instrument tick size when creating orders', async () => {
    let submittedBody: Record<string, unknown> | null = null

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)

      if (url.pathname === '/api/v5/public/instruments') {
        return new Response(JSON.stringify({
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              ctVal: '0.01',
              lotSz: '0.01',
              tickSz: '0.1',
            },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      const rawBody = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
      submittedBody = rawBody

      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'perp-limit-order-2',
            sCode: '0',
            sMsg: '',
            instId: 'BTC-USDT-SWAP',
            state: 'live',
            side: 'sell',
            ordType: 'limit',
            px: '79283.4',
            sz: '10',
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
      amount: 0.1,
      price: 79283.33333333333,
      tdMode: 'cross',
    })

    expect(submittedBody).toMatchObject({
      instId: 'BTC-USDT-SWAP',
      instType: 'SWAP',
      side: 'sell',
      ordType: 'limit',
      px: '79283.4',
      sz: '10',
      tdMode: 'cross',
    })
    expect(order.price).toBeCloseTo(79283.4)
  })

  it('uses submitted OKX perp price and size when create order ack omits px and sz', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)

      if (url.pathname === '/api/v5/public/instruments') {
        return new Response(JSON.stringify({
          data: [
            {
              instId: 'BTC-USDT-SWAP',
              ctVal: '0.01',
              lotSz: '0.01',
              tickSz: '0.1',
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
            ordId: 'perp-limit-order-ack-only',
            clOrdId: 'gridclient1',
            sCode: '0',
            sMsg: '',
            state: '',
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
      side: 'buy',
      type: 'limit',
      amount: 0.10049,
      price: 79283.33333333333,
      tdMode: 'cross',
      clientOrderId: 'gridclient1',
    })

    expect(order.price).toBeCloseTo(79283.3)
    expect(order.amount).toBeCloseTo(0.1004)
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
      extra: { tdMode: 'cross' },
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

  it('fetches full order details after OKX cancel ack omits order fields', async () => {
    const seenRequests: Array<{ method: string, url: URL }> = []

    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)
      const method = init?.method ?? 'GET'
      seenRequests.push({ method, url })

      if (url.pathname === '/api/v5/trade/cancel-order') {
        return new Response(JSON.stringify({
          data: [
            {
              ordId: 'cancel-ack-1',
              clOrdId: 'grid-client-cancel',
              sCode: '0',
              sMsg: '',
              ts: '1773829253570',
            },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      expect(url.pathname).toBe('/api/v5/trade/order')
      expect(url.searchParams.get('ordId')).toBe('cancel-ack-1')
      expect(url.searchParams.get('instId')).toBe('BTC-USDT')

      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'cancel-ack-1',
            clOrdId: 'grid-client-cancel',
            instId: 'BTC-USDT',
            state: 'canceled',
            side: 'sell',
            ordType: 'limit',
            sz: '0.002',
            fillSz: '0.001',
            px: '71000',
            uTime: '1773829253570',
            cTime: '1773829253522',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const order = await createClient().cancelOrder('cancel-ack-1', 'BTC/USDT')

    expect(seenRequests.map(request => `${request.method} ${request.url.pathname}`)).toEqual([
      'POST /api/v5/trade/cancel-order',
      'GET /api/v5/trade/order',
    ])
    expect(order).toEqual(expect.objectContaining({
      id: 'cancel-ack-1',
      clientOrderId: 'grid-client-cancel',
      side: 'sell',
      type: 'limit',
      price: 71000,
      amount: 0.002,
      filled: 0.001,
      status: 'canceled',
    }))
  })

  it('throws exchange error when canceling an order from empty OKX data', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({
        data: [],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    await expect(createClient().cancelOrder('missing-order', 'BTC/USDT'))
      .rejects.toMatchObject({
        name: 'ExchangeError',
        message: 'OKX cancelOrder returned empty response',
      })
  })

  it('throws exchange error when OKX rejects a cancel ack', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({
        data: [
          {
            ordId: 'rejected-cancel-1',
            sCode: '51400',
            sMsg: 'Cancellation failed.',
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    await expect(createClient().cancelOrder('rejected-cancel-1', 'BTC/USDT'))
      .rejects.toEqual(expect.objectContaining<Partial<ExchangeError>>({
        name: 'ExchangeError',
        code: '51400',
      }))
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
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

  it.each([
    ['spot' as const, 'SPOT'],
    ['perp' as const, 'SWAP'],
  ])('includes instType when listing %s open orders without symbol', async (marketType, expectedInstType) => {
    let pendingUrl: URL | undefined
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

      pendingUrl = url
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    await new OkxClient(marketType, {
      apiKey: 'test-api-key',
      secret: 'test-secret',
      passphrase: 'test-passphrase',
      isTestnet: true,
    }).fetchOpenOrders()

    expect(pendingUrl?.pathname).toBe('/api/v5/trade/orders-pending')
    expect(pendingUrl?.searchParams.get('instType')).toBe(expectedInstType)
    expect(pendingUrl?.searchParams.has('instId')).toBe(false)
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
      accFillSz: '0.0015',
      fillSz: '0.0004',
      px: '71000',
      avgPx: '70950',
      uTime: '1773829253570',
      cTime: '1773829253522',
    }

    let historyUrl: URL | undefined
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      historyUrl = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)

      return new Response(JSON.stringify({
        data: [rawOrder],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const orders = await createClient().fetchClosedOrders('BTC/USDT')

    expect(historyUrl?.pathname).toBe('/api/v5/trade/orders-history')
    expect(historyUrl?.searchParams.get('instType')).toBe('SPOT')
    expect(historyUrl?.searchParams.get('instId')).toBe('BTC-USDT')
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
