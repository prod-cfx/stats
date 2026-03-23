import type { INestApplication } from '@nestjs/common'
import type { Socket as ClientSocket } from 'socket.io-client'
import { io as ioClient } from 'socket.io-client'

import { createTestingApp } from '../fixtures/fixtures'

const E2E_ENABLED = process.env.KLINE_TICKER_E2E === 'true'
const describeIf = E2E_ENABLED ? describe : describe.skip

describeIf('KlineGateway - Ticker WebSocket (E2E)', () => {
  let app: INestApplication
  let serverPort: number
  const clients: ClientSocket[] = []

  const connectClient = (): Promise<ClientSocket> => {
    return new Promise((resolve, reject) => {
      const client = ioClient(`http://localhost:${serverPort}/kline`, {
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionDelayMax: 500,
        reconnectionAttempts: 10,
      })

      client.on('connect', () => {
        clients.push(client)
        resolve(client)
      })

      client.on('connect_error', error => {
        reject(error)
      })

      setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 5000)
    })
  }

  const waitForEvent = (
    client: ClientSocket,
    eventName: string,
    timeoutMs = 5000,
  ): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      let handler: (data: unknown) => void

      const timer = setTimeout(() => {
        client.off(eventName, handler)
        reject(new Error(`Timeout waiting for event: ${eventName}`))
      }, timeoutMs)

      handler = (data: unknown) => {
        clearTimeout(timer)
        client.off(eventName, handler)
        resolve(data)
      }

      client.on(eventName, handler)
    })
  }

  beforeAll(async () => {
    const ctx = await createTestingApp()
    app = ctx.app

    const server = app.getHttpServer()
    await new Promise<void>(resolve => {
      server.listen(0, () => {
        serverPort = server.address().port
        resolve()
      })
    })
  })

  afterAll(async () => {
    for (const client of clients) {
      if (client.connected) {
        client.disconnect()
      }
    }
    clients.length = 0

    if (app) {
      await app.close()
    }
  })

  afterEach(async () => {
    const clientsCopy = [...clients]
    for (const client of clientsCopy) {
      if (client.connected) {
        client.disconnect()
        const idx = clients.indexOf(client)
        if (idx > -1) {
          clients.splice(idx, 1)
        }
      }
    }
  })

  it('should subscribe and receive ticker data', async () => {
    const client = await connectClient()

    client.emit('subscribeTicker', {
      symbol: 'BTC',
      exchange: 'BINANCE',
      instrumentType: 'PERPETUAL',
    })

    const subscriptionEvent = (await waitForEvent(client, 'tickerSubscribed')) as Record<
      string,
      unknown
    >
    expect(subscriptionEvent.symbol).toBe('BTC')
    expect(subscriptionEvent.exchange).toBe('BINANCE')
    expect(subscriptionEvent.instrumentType).toBe('PERPETUAL')

    const tickerEvent = (await waitForEvent(client, 'ticker', 8000)) as Record<string, unknown>
    expect(tickerEvent.symbol).toBe('BTC')
    expect(typeof tickerEvent.timestamp).toBe('number')
    expect(tickerEvent.timestamp).toBeGreaterThan(0)

    const high24h = tickerEvent.high24h
    expect(high24h === null || typeof high24h === 'number').toBe(true)

    const low24h = tickerEvent.low24h
    expect(low24h === null || typeof low24h === 'number').toBe(true)
  })

  it('should stop receiving data after unsubscribe', async () => {
    const client = await connectClient()

    client.emit('subscribeTicker', {
      symbol: 'BTC',
      exchange: 'BINANCE',
      instrumentType: 'PERPETUAL',
    })

    await waitForEvent(client, 'tickerSubscribed')
    await waitForEvent(client, 'ticker', 8000)

    await new Promise(resolve => setTimeout(resolve, 1500))

    client.emit('unsubscribeTicker', {
      symbol: 'BTC',
      exchange: 'BINANCE',
      instrumentType: 'PERPETUAL',
    })

    const unsubscribeEvent = (await waitForEvent(client, 'tickerUnsubscribed')) as Record<
      string,
      unknown
    >
    expect(unsubscribeEvent.symbol).toBe('BTC')

    let noMoreEvents = true
    const tickerListener = () => {
      noMoreEvents = false
    }
    client.on('ticker', tickerListener)

    await new Promise(resolve => setTimeout(resolve, 3000))

    client.off('ticker', tickerListener)
    expect(noMoreEvents).toBe(true)
  })

  it('should enforce maximum ticker subscriptions per client (10)', async () => {
    const client = await connectClient()
    const symbols = ['BTC', 'ETH', 'XRP', 'SOL', 'ADA', 'DOT', 'LINK', 'MATIC', 'AVAX', 'FIL']

    for (const symbol of symbols) {
      client.emit('subscribeTicker', {
        symbol,
        exchange: 'BINANCE',
        instrumentType: 'PERPETUAL',
      })

      const event = (await waitForEvent(client, 'tickerSubscribed')) as Record<string, unknown>
      expect(event.symbol).toBe(symbol)
    }

    let errorReceived = false
    let errorEvent: Record<string, unknown> | null = null
    const errorListener = (data: unknown) => {
      errorReceived = true
      errorEvent = data as Record<string, unknown>
    }
    client.on('error', errorListener)

    client.emit('subscribeTicker', {
      symbol: 'XLM',
      exchange: 'BINANCE',
      instrumentType: 'PERPETUAL',
    })

    await new Promise(resolve => setTimeout(resolve, 500))
    client.off('error', errorListener)

    expect(errorReceived).toBe(true)
    expect(errorEvent?.code).toBe('MAX_TICKER_SUBSCRIPTIONS_EXCEEDED')
  })

  it('should handle symbol switching (unsubscribe old, subscribe new)', async () => {
    const client = await connectClient()

    client.emit('subscribeTicker', {
      symbol: 'BTC',
      exchange: 'BINANCE',
      instrumentType: 'PERPETUAL',
    })

    const subscribedBtc = (await waitForEvent(client, 'tickerSubscribed')) as Record<
      string,
      unknown
    >
    expect(subscribedBtc.symbol).toBe('BTC')

    await waitForEvent(client, 'ticker', 8000)
    await new Promise(resolve => setTimeout(resolve, 1500))

    client.emit('unsubscribeTicker', {
      symbol: 'BTC',
      exchange: 'BINANCE',
      instrumentType: 'PERPETUAL',
    })

    const unsubscribedBtc = (await waitForEvent(client, 'tickerUnsubscribed')) as Record<
      string,
      unknown
    >
    expect(unsubscribedBtc.symbol).toBe('BTC')

    client.emit('subscribeTicker', {
      symbol: 'ETH',
      exchange: 'BINANCE',
      instrumentType: 'PERPETUAL',
    })

    const subscribedEth = (await waitForEvent(client, 'tickerSubscribed')) as Record<
      string,
      unknown
    >
    expect(subscribedEth.symbol).toBe('ETH')

    const tickerEth = (await waitForEvent(client, 'ticker', 8000)) as Record<string, unknown>
    expect(tickerEth.symbol).toBe('ETH')
  })

  it('should cleanup subscriptions on client disconnect and allow new subscription', async () => {
    const client1 = await connectClient()
    const symbol = 'BTC'

    client1.emit('subscribeTicker', {
      symbol,
      exchange: 'BINANCE',
      instrumentType: 'PERPETUAL',
    })

    await waitForEvent(client1, 'tickerSubscribed')
    await waitForEvent(client1, 'ticker', 8000)

    client1.disconnect()
    const idx = clients.indexOf(client1)
    if (idx > -1) {
      clients.splice(idx, 1)
    }

    await new Promise(resolve => setTimeout(resolve, 1000))

    const client2 = await connectClient()

    client2.emit('subscribeTicker', {
      symbol,
      exchange: 'BINANCE',
      instrumentType: 'PERPETUAL',
    })

    const subscriptionEvent = (await waitForEvent(client2, 'tickerSubscribed')) as Record<
      string,
      unknown
    >
    expect(subscriptionEvent.symbol).toBe(symbol)

    const tickerEvent = (await waitForEvent(client2, 'ticker', 8000)) as Record<string, unknown>
    expect(tickerEvent.symbol).toBe(symbol)
  })

  it('should subscribe in aggregated mode (symbol only, no exchange/instrumentType)', async () => {
    const client = await connectClient()

    client.emit('subscribeTicker', {
      symbol: 'BTC',
    })

    const subscriptionEvent = (await waitForEvent(client, 'tickerSubscribed')) as Record<
      string,
      unknown
    >
    expect(subscriptionEvent.symbol).toBe('BTC')
    expect(subscriptionEvent.exchange).toBe('BINANCE')
    expect(subscriptionEvent.instrumentType).toBe('PERPETUAL')

    const tickerEvent = (await waitForEvent(client, 'ticker', 8000)) as Record<string, unknown>
    expect(tickerEvent.symbol).toBe('BTC')
    expect(typeof tickerEvent.timestamp).toBe('number')
  })
})
