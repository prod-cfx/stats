import type { Dispatcher } from 'undici'
import { Agent, ProxyAgent } from 'undici'
import { BaseCexClient, createHttpEgressDispatcher } from './base-cex-client'

class TestCexClient extends BaseCexClient {
  readonly calls: string[] = []

  constructor(dispatcher?: Dispatcher) {
    super('https://example.test', 'spot', dispatcher)
  }

  async init(): Promise<void> {}

  async ping(): Promise<void> {
    await this.request('GET', '/ping')
  }

  async privatePing(): Promise<void> {
    await this.request('GET', '/private-ping', {}, true)
  }

  async createOrder(): Promise<never> {
    throw new Error('not implemented')
  }

  async cancelOrder(): Promise<never> {
    throw new Error('not implemented')
  }

  async fetchOrder(): Promise<never> {
    throw new Error('not implemented')
  }

  async fetchOpenOrders(): Promise<never> {
    throw new Error('not implemented')
  }

  async fetchClosedOrders(): Promise<never> {
    throw new Error('not implemented')
  }

  async fetchPositions(): Promise<never> {
    throw new Error('not implemented')
  }

  async fetchBalance(): Promise<never> {
    throw new Error('not implemented')
  }

  async fetchTicker(): Promise<never> {
    throw new Error('not implemented')
  }

  protected async signRequest(): Promise<{ url: string; headers: Record<string, string> }> {
    this.calls.push('signRequest')
    return { url: '/ping', headers: { accept: 'application/json' } }
  }

  protected override async beforeRequest(): Promise<void> {
    this.calls.push('beforeRequest')
  }
}

describe('BaseCexClient', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('passes the configured dispatcher to fetch init', async () => {
    const dispatcher = { dispatch: jest.fn() } as unknown as Dispatcher
    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })
    globalThis.fetch = fetchMock as typeof fetch

    await new TestCexClient(dispatcher).ping()

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://example.test/ping'),
      expect.objectContaining({ dispatcher }),
    )
  })

  it('omits dispatcher from fetch init when none is configured', async () => {
    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })
    globalThis.fetch = fetchMock as typeof fetch

    await new TestCexClient().ping()

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://example.test/ping'),
      expect.not.objectContaining({ dispatcher: expect.anything() }),
    )
  })

  it('waits for request admission before signing private requests', async () => {
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as typeof fetch
    const client = new TestCexClient()

    await client.privatePing()

    expect(client.calls).toEqual(['beforeRequest', 'signRequest'])
  })

  it('creates a ProxyAgent before localAddress when both egress options are configured', () => {
    const dispatcher = createHttpEgressDispatcher({
      proxyUrl: 'http://127.0.0.1:7890',
      localAddress: '10.0.0.12',
    })

    expect(dispatcher).toBeInstanceOf(ProxyAgent)
  })

  it('creates an Agent for localAddress and no dispatcher for blank egress config', () => {
    expect(createHttpEgressDispatcher({ localAddress: '10.0.0.12' })).toBeInstanceOf(Agent)
    expect(createHttpEgressDispatcher({ proxyUrl: ' ', localAddress: ' ' })).toBeUndefined()
  })
})
