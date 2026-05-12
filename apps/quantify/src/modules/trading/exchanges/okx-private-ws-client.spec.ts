import type { ConfigService } from '@nestjs/config'
import { createHmac } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { EventEmitter2 } from '@nestjs/event-emitter'
import WebSocket from 'ws'
import {
  OKX_PRIVATE_ORDER_EVENT,
  OKX_PRIVATE_POSITION_EVENT,
} from '../events/okx-private-ws.events'
import { OkxPrivateWsClient } from './okx-private-ws-client'

jest.mock('ws', () => jest.fn())

class MockSocket extends EventEmitter {
  readonly sent: string[] = []
  readyState = 1

  send(payload: string) {
    this.sent.push(payload)
  }

  close() {
    this.readyState = 3
    this.emit('close')
  }
}

const MockWebSocket = WebSocket as jest.MockedFunction<typeof WebSocket>

describe('OkxPrivateWsClient', () => {
  const account = {
    apiKey: 'test-api-key',
    secret: 'test-secret',
    passphrase: 'test-passphrase',
  }

  let sockets: MockSocket[]
  let eventEmitter: EventEmitter2
  let configService: Pick<ConfigService, 'get'>
  let accountStore: { listOkxAccountConfigs: jest.Mock<Promise<typeof account[]>, []> }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-12T00:00:00.000Z'))
    sockets = []
    eventEmitter = new EventEmitter2()
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'featureFlags.okxWsEnabled') return true
        return undefined
      }),
    }
    accountStore = {
      listOkxAccountConfigs: jest.fn(async () => []),
    }
    MockWebSocket.mockImplementation(() => {
      const socket = new MockSocket()
      sockets.push(socket)
      return socket as unknown as WebSocket
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('does not connect while the rollout flag is off', async () => {
    configService.get = jest.fn((key: string) => {
      if (key === 'featureFlags.okxWsEnabled') return false
      return undefined
    })
    const client = new OkxPrivateWsClient(configService as ConfigService, eventEmitter, accountStore as never)

    await client.connect(account)

    expect(MockWebSocket).not.toHaveBeenCalled()
  })

  it('sends the OKX login payload when the socket opens', async () => {
    const client = new OkxPrivateWsClient(configService as ConfigService, eventEmitter, accountStore as never)

    await client.connect(account)
    sockets[0].emit('open')

    const timestamp = '1778544000'
    const sign = createHmac('sha256', account.secret)
      .update(`${timestamp}GET/users/self/verify`)
      .digest('base64')
    expect(JSON.parse(sockets[0].sent[0])).toEqual({
      op: 'login',
      args: [{
        apiKey: account.apiKey,
        passphrase: account.passphrase,
        timestamp,
        sign,
      }],
    })
  })

  it('subscribes to orders, account, and positions after login succeeds', async () => {
    const client = new OkxPrivateWsClient(configService as ConfigService, eventEmitter, accountStore as never)

    await client.connect(account)
    sockets[0].emit('message', JSON.stringify({ event: 'login', code: '0' }))

    expect(JSON.parse(sockets[0].sent[0])).toEqual({
      op: 'subscribe',
      args: [
        { channel: 'orders', instType: 'ANY' },
        { channel: 'account' },
        { channel: 'positions', instType: 'ANY' },
      ],
    })
  })

  it('emits normalized order events from OKX orders data', async () => {
    const client = new OkxPrivateWsClient(configService as ConfigService, eventEmitter, accountStore as never)
    const listener = jest.fn()
    eventEmitter.on(OKX_PRIVATE_ORDER_EVENT, listener)

    await client.connect(account)
    sockets[0].emit('message', JSON.stringify({
      arg: { channel: 'orders' },
      data: [{
        instId: 'BTC-USDT-SWAP',
        ordId: 'order-1',
        clOrdId: 'client-1',
        state: 'filled',
        side: 'buy',
        ordType: 'market',
        avgPx: '61000.5',
        fillPx: '61001',
        accFillSz: '0.2',
        fee: '-1.5',
        feeCcy: 'USDT',
        tradeId: 'trade-1',
        uTime: '1778544000123',
      }],
    }))

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      exchangeId: 'okx',
      apiKey: account.apiKey,
      instId: 'BTC-USDT-SWAP',
      orderId: 'order-1',
      clientOrderId: 'client-1',
      state: 'filled',
      side: 'buy',
      orderType: 'market',
      avgPrice: 61000.5,
      fillPrice: 61001,
      filledSize: 0.2,
      fee: -1.5,
      feeCurrency: 'USDT',
      tradeId: 'trade-1',
      updatedAt: new Date('2026-05-12T00:00:00.123Z'),
    }))
  })

  it('emits normalized position events from OKX positions data', async () => {
    const client = new OkxPrivateWsClient(configService as ConfigService, eventEmitter, accountStore as never)
    const listener = jest.fn()
    eventEmitter.on(OKX_PRIVATE_POSITION_EVENT, listener)

    await client.connect(account)
    sockets[0].emit('message', JSON.stringify({
      arg: { channel: 'positions' },
      data: [{
        instId: 'ETH-USDT-SWAP',
        posSide: 'long',
        pos: '1.25',
        avgPx: '3000.5',
        uTime: '1778544000456',
      }],
    }))

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      exchangeId: 'okx',
      apiKey: account.apiKey,
      instId: 'ETH-USDT-SWAP',
      positionSide: 'long',
      quantity: 1.25,
      avgPrice: 3000.5,
      updatedAt: new Date('2026-05-12T00:00:00.456Z'),
    }))
  })

  it('records the disconnect metric when the socket closes', async () => {
    const client = new OkxPrivateWsClient(configService as ConfigService, eventEmitter, accountStore as never)
    const warn = jest.spyOn(
      (client as unknown as { logger: { warn: (message: string) => void } }).logger,
      'warn',
    ).mockImplementation(() => undefined)

    await client.connect(account)
    sockets[0].emit('close')

    expect(warn).toHaveBeenCalledWith('metric=okx_ws_disconnect_total value=1 apiKeyFingerprint=d61ecb9c529c')
  })

  it('connects all stored OKX accounts on module init when the rollout flag is on', async () => {
    accountStore.listOkxAccountConfigs.mockResolvedValue([
      account,
      { ...account, apiKey: 'second-api-key' },
    ])
    const client = new OkxPrivateWsClient(configService as ConfigService, eventEmitter, accountStore as never)

    await client.onModuleInit()

    expect(accountStore.listOkxAccountConfigs).toHaveBeenCalled()
    expect(MockWebSocket).toHaveBeenCalledTimes(2)
  })
})
