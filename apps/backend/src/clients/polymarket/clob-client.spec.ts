import type { ConfigService } from '@nestjs/config'
import { ErrorCode } from '@ai/shared'
import WebSocket from 'ws'
import { DomainException } from '@/common/exceptions/domain.exception'
import { PolymarketClobClient } from './clob-client'

type MockHandler = (...args: any[]) => void

jest.mock('ws', () => ({
  __esModule: true,
  default: class MockWebSocket {
    public static instances: MockWebSocket[] = []

    private readonly handlers = new Map<string, MockHandler[]>()

    constructor(
      public readonly url: string,
      public readonly options?: Record<string, unknown>,
    ) {
      MockWebSocket.instances.push(this)
    }

    on(event: string, handler: MockHandler) {
      const handlers = this.handlers.get(event) ?? []
      handlers.push(handler)
      this.handlers.set(event, handlers)
    }

    emit(event: string, ...args: unknown[]) {
      for (const handler of this.handlers.get(event) ?? []) {
        handler(...args)
      }
    }

    send = jest.fn()
    close = jest.fn()
  },
}))

function createConfigService(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService
}

describe('polymarketClobClient', () => {
  afterEach(() => {
    ;(WebSocket as any).instances = []
    jest.clearAllMocks()
  })

  it('maps non-Error websocket failures to DomainException with an ErrorCode', () => {
    const client = new PolymarketClobClient(createConfigService({
      polymarket: {
        clob: {
          wsUrl: 'wss://polymarket.test/ws',
        },
      },
    }))
    const onError = jest.fn()

    client.createMarketChannel({
      assetIds: ['asset-1'],
      onMessage: jest.fn(),
      onError,
    })

    const socket = (WebSocket as any).instances[0]
    socket.emit('error', 'socket exploded')

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(expect.any(DomainException))

    const error = onError.mock.calls[0][0] as DomainException
    expect(error.code).toBe(ErrorCode.POLYMARKET_CLIENT_ERROR)
    expect(error.args).toEqual({ reason: 'socket exploded' })
  })
})
