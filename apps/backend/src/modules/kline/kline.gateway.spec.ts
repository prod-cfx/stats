import type { Socket } from 'socket.io'

import { parseAllowedOrigins } from './kline.gateway'
import { KlineGateway } from './kline.gateway'
import { KlineSubscriptionRegistryService } from './services/kline-subscription-registry.service'
import { OrderbookSubscriptionService } from './services/orderbook-subscription.service'
import { SocketAuthService } from './services/socket-auth.service'
import { TickerSubscriptionService } from './services/ticker-subscription.service'
import { TradesSubscriptionService } from './services/trades-subscription.service'

interface GatewayFixture {
  gateway: KlineGateway
  klineAggregatorService: { subscribe: jest.Mock, unsubscribe: jest.Mock }
  socketAuthService: SocketAuthService
  klineRegistry: KlineSubscriptionRegistryService
  tradesService: TradesSubscriptionService
  orderbookService: OrderbookSubscriptionService
  tickerService: TickerSubscriptionService
}

function createSocket(id = 'client-1'): Socket {
  return {
    id,
    data: {},
    handshake: {
      auth: {},
      query: {},
      headers: {},
      time: new Date().toISOString(),
    },
    emit: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    rooms: new Set([id]),
  } as unknown as Socket
}

function createGateway(): GatewayFixture {
  const klineAggregatorService = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  }
  const socketAuthService = new SocketAuthService({ verify: jest.fn() } as unknown as ConstructorParameters<typeof SocketAuthService>[0])
  const klineRegistry = new KlineSubscriptionRegistryService()
  const tradesService = new TradesSubscriptionService()
  const orderbookService = new OrderbookSubscriptionService()
  const tickerService = new TickerSubscriptionService()

  const gateway = new KlineGateway(
    klineAggregatorService as unknown as ConstructorParameters<typeof KlineGateway>[0],
    {
      getTicker: jest.fn(),
      getLargeTrades: jest.fn(),
      getLatestTrades: jest.fn(),
    } as unknown as ConstructorParameters<typeof KlineGateway>[1],
    {
      get: jest.fn(),
      set: jest.fn(),
    } as unknown as ConstructorParameters<typeof KlineGateway>[2],
    {
      getClient: jest.fn(() => ({ get: jest.fn() })),
    } as unknown as ConstructorParameters<typeof KlineGateway>[3],
    {
      getAggregatedOrderbook: jest.fn(),
    } as unknown as ConstructorParameters<typeof KlineGateway>[4],
    socketAuthService,
    klineRegistry,
    tradesService,
    orderbookService,
    tickerService,
  )

  gateway.server = {
    sockets: {
      sockets: new Map(),
    },
    to: jest.fn(() => ({ emit: jest.fn() })),
  } as unknown as KlineGateway['server']

  return {
    gateway,
    klineAggregatorService,
    socketAuthService,
    klineRegistry,
    tradesService,
    orderbookService,
    tickerService,
  }
}

describe('KlineGateway subscription ownership', () => {
  it('does not own polling timer maps directly', () => {
    const { gateway } = createGateway()
    const gatewayRecord = gateway as unknown as Record<string, unknown>

    expect(gatewayRecord.tradesIntervals).toBeUndefined()
    expect(gatewayRecord.orderbookIntervals).toBeUndefined()
    expect(gatewayRecord.tickerIntervals).toBeUndefined()
  })

  it('marks clients as guests and initializes subscription state on connection', () => {
    const { gateway, klineRegistry } = createGateway()
    const client = createSocket()

    gateway.handleConnection(client)

    expect(client.data.isGuest).toBe(true)
    expect(klineRegistry.clientSubscriptions.has(client.id)).toBe(true)
  })

  it('stores authenticated user data and initializes subscription state on connection', () => {
    const { gateway, klineRegistry, socketAuthService } = createGateway()
    const client = createSocket()
    client.handshake.auth = { token: 'valid-token' }
    jest.spyOn(socketAuthService, 'authenticate')

    const jwtService = socketAuthService as unknown as { jwtService: { verify: jest.Mock } }
    jwtService.jwtService.verify.mockReturnValue({ sub: 'user-1', username: 'alice' })

    gateway.handleConnection(client)

    expect(client.data.isGuest).toBe(false)
    expect(client.data.userId).toBe('user-1')
    expect(klineRegistry.clientSubscriptions.has(client.id)).toBe(true)
    expect(socketAuthService.authenticate).toHaveBeenCalledWith(client)
  })

  it('keeps kline subscription limit behavior unchanged', () => {
    const { gateway, klineRegistry } = createGateway()
    const client = createSocket()
    klineRegistry.clientSubscriptions.set(client.id, new Set(Array.from({ length: 10 }, (_, index) => `sub-${index}`)))

    gateway.handleSubscribe({ symbol: 'BTCUSDT', interval: '1m' }, client)

    expect(client.emit).toHaveBeenCalledWith('error', {
      message: 'Maximum kline subscriptions (10) reached',
      code: 'MAX_KLINE_SUBSCRIPTIONS_EXCEEDED',
    })
  })

  it('enforces total subscription limit across subscription services', async () => {
    const { gateway, orderbookService, tickerService } = createGateway()
    const client = createSocket()
    orderbookService.clientSubscriptions.set(client.id, new Set(Array.from({ length: 10 }, (_, index) => `orderbook-${index}`)))
    tickerService.clientSubscriptions.set(client.id, new Set(Array.from({ length: 10 }, (_, index) => `ticker-${index}`)))

    gateway.handleSubscribe({ symbol: 'BTCUSDT', interval: '1m' }, client)
    await gateway.handleSubscribeTrades({ exchange: 'BINANCE', instrumentType: 'PERPETUAL', symbol: 'BTCUSDT', limit: 50, page: 1 }, client)
    await gateway.handleSubscribeOrderbook(client, { exchange: 'BINANCE', instrumentType: 'PERPETUAL', symbol: 'BTCUSDT' })

    expect(client.emit).toHaveBeenCalledWith('error', {
      message: 'Maximum total subscriptions (20) reached',
      code: 'MAX_SUBSCRIPTIONS_EXCEEDED',
    })
    expect(client.emit).toHaveBeenCalledWith('tradesSubscriptionError', {
      message: 'Maximum total subscriptions (20) reached',
      limit: 20,
    })
    expect(client.join).not.toHaveBeenCalled()
  })

  it('allows duplicate orderbook subscription when orderbook limit is already reached', async () => {
    const { gateway, orderbookService } = createGateway()
    const client = createSocket()
    const subscriptionKey = 'BINANCE:PERPETUAL:BTCUSDT:single:60'
    orderbookService.clientSubscriptions.set(client.id, new Set([
      subscriptionKey,
      ...Array.from({ length: 9 }, (_, index) => `orderbook-${index}`),
    ]))
    orderbookService.intervals.set(subscriptionKey, {
      timer: null as unknown as NodeJS.Timeout,
      clients: new Set([client.id]),
      roomName: `orderbook:${subscriptionKey}`,
      isRunning: false,
      params: { exchange: 'BINANCE', instrumentType: 'PERPETUAL', symbol: 'BTCUSDT', isAggregated: false, depth: 60 },
    })

    await gateway.handleSubscribeOrderbook(client, { exchange: 'BINANCE', instrumentType: 'PERPETUAL', symbol: 'BTCUSDT' })

    expect(client.emit).not.toHaveBeenCalledWith('error', {
      message: 'Maximum orderbook subscriptions (10) reached',
    })
    expect(client.join).toHaveBeenCalledWith(`orderbook:${subscriptionKey}`)
  })

  it('unsubscribes kline callback and emits existing payload', () => {
    const { gateway, klineAggregatorService, klineRegistry } = createGateway()
    const client = createSocket()
    const subscriptionKey = 'BINANCE:PERPETUAL:BTCUSDT:1m'
    const callback = jest.fn()
    klineRegistry.clientSubscriptions.set(client.id, new Set([subscriptionKey]))
    klineRegistry.clientCallbacks.set(`${client.id}:${subscriptionKey}`, callback)

    gateway.handleUnsubscribe({ symbol: 'BTCUSDT', interval: '1m' }, client)

    expect(klineAggregatorService.unsubscribe).toHaveBeenCalledWith('BINANCE', 'PERPETUAL', 'BTCUSDT', '1m', callback)
    expect(client.emit).toHaveBeenCalledWith('unsubscribed', {
      symbol: 'BTCUSDT',
      interval: '1m',
      subscriptionKey,
    })
    expect(klineRegistry.clientCallbacks.has(`${client.id}:${subscriptionKey}`)).toBe(false)
  })

  it('cleans all subscription state on disconnect', () => {
    const { gateway, klineAggregatorService, klineRegistry, tradesService, orderbookService, tickerService } = createGateway()
    const client = createSocket()
    const klineKey = 'BINANCE:PERPETUAL:BTCUSDT:1m'
    const tradesKey = 'trades:BINANCE:PERPETUAL:BTCUSDT'
    const orderbookKey = 'BINANCE:PERPETUAL:BTCUSDT:single:60'
    const tickerKey = 'BINANCE:PERPETUAL:BTC:USDT'
    const klineCallback = jest.fn()
    const tickerCallback = jest.fn()
    const tradesTimer = setTimeout(() => undefined, 1000)
    const orderbookTimer = setTimeout(() => undefined, 1000)
    const tickerTimer = setTimeout(() => undefined, 1000)

    klineRegistry.clientSubscriptions.set(client.id, new Set([klineKey]))
    klineRegistry.clientCallbacks.set(`${client.id}:${klineKey}`, klineCallback)
    tradesService.clientSubscriptions.set(client.id, new Set([tradesKey]))
    tradesService.intervals.set(tradesKey, {
      timer: tradesTimer,
      clients: new Set([client.id]),
      roomName: `trades:${tradesKey}`,
      isRunning: false,
      params: { exchange: 'BINANCE', instrumentType: 'PERPETUAL', symbol: 'BTCUSDT', limit: 50 },
    })
    orderbookService.clientSubscriptions.set(client.id, new Set([orderbookKey]))
    orderbookService.intervals.set(orderbookKey, {
      timer: orderbookTimer,
      clients: new Set([client.id]),
      roomName: `orderbook:${orderbookKey}`,
      isRunning: false,
      params: { exchange: 'BINANCE', instrumentType: 'PERPETUAL', symbol: 'BTCUSDT', isAggregated: false, depth: 60 },
    })
    tickerService.clientSubscriptions.set(client.id, new Set([tickerKey]))
    tickerService.intervals.set(tickerKey, {
      timer: tickerTimer,
      clients: new Set([client.id]),
      roomName: `ticker:${tickerKey}`,
      isRunning: false,
      lastKlinePrice: null,
      klineCallback: tickerCallback,
      params: { exchange: 'BINANCE', instrumentType: 'PERPETUAL', symbol: 'BTC', quoteAsset: 'USDT' },
    })

    gateway.handleDisconnect(client)

    expect(klineAggregatorService.unsubscribe).toHaveBeenCalledWith('BINANCE', 'PERPETUAL', 'BTCUSDT', '1m', klineCallback)
    expect(klineAggregatorService.unsubscribe).toHaveBeenCalledWith('BINANCE', 'PERPETUAL', 'BTCUSDT', '1m', tickerCallback)
    expect(klineRegistry.clientSubscriptions.has(client.id)).toBe(false)
    expect(tradesService.intervals.has(tradesKey)).toBe(false)
    expect(orderbookService.intervals.has(orderbookKey)).toBe(false)
    expect(tickerService.intervals.has(tickerKey)).toBe(false)
  })
})

describe('KlineGateway allowed origins', () => {
  const originalAppEnv = process.env.APP_ENV
  const originalNodeEnv = process.env.NODE_ENV
  const originalFrontendRedirectOrigins = process.env.FRONTEND_REDIRECT_ORIGINS
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS

  afterEach(() => {
    if (originalAppEnv === undefined) {
      delete process.env.APP_ENV
    } else {
      process.env.APP_ENV = originalAppEnv
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }

    if (originalFrontendRedirectOrigins === undefined) {
      delete process.env.FRONTEND_REDIRECT_ORIGINS
    } else {
      process.env.FRONTEND_REDIRECT_ORIGINS = originalFrontendRedirectOrigins
    }

    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins
    }
  })

  it('accepts production coinflux.ai origins from ALLOWED_ORIGINS', () => {
    process.env.APP_ENV = 'production'
    process.env.FRONTEND_REDIRECT_ORIGINS = 'https://www.coinflux.ai'
    process.env.ALLOWED_ORIGINS = 'https://admin.coinflux.ai'

    expect(parseAllowedOrigins()).toEqual([
      'https://www.coinflux.ai',
      'https://admin.coinflux.ai',
    ])
  })

  it('drops non-https production origins', () => {
    process.env.APP_ENV = 'production'
    process.env.FRONTEND_REDIRECT_ORIGINS = ''
    process.env.ALLOWED_ORIGINS = 'http://www.coinflux.ai,https://admin.coinflux.ai'

    expect(parseAllowedOrigins()).toEqual(['https://admin.coinflux.ai'])
  })

  it('falls back to front and admin production origins together', () => {
    process.env.APP_ENV = 'production'
    process.env.FRONTEND_REDIRECT_ORIGINS = ''
    process.env.ALLOWED_ORIGINS = ''

    expect(parseAllowedOrigins()).toEqual([
      'https://www.coinflux.ai',
      'https://admin.coinflux.ai',
    ])
  })

  it('treats APP_ENV production as production even when NODE_ENV is absent', () => {
    process.env.APP_ENV = 'production'
    delete process.env.NODE_ENV
    process.env.FRONTEND_REDIRECT_ORIGINS = ''
    process.env.ALLOWED_ORIGINS = 'http://localhost:3001'

    expect(parseAllowedOrigins()).toEqual([
      'https://www.coinflux.ai',
      'https://admin.coinflux.ai',
    ])
  })
})
