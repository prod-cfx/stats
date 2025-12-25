import type { ConfigService } from '@nestjs/config'
import type { RedisService } from '@/common/services/redis.service'
import { Injectable } from '@nestjs/common'
import { BinanceOrderbookWsAdapterBase } from './binance/binance-orderbook-ws.base'

@Injectable()
export class BinanceCexFutureOrderbookWsAdapter extends BinanceOrderbookWsAdapterBase {
  readonly key = 'BINANCE.CEX.FUTURE' as const

  protected readonly venueId = 'binance-future'
  protected readonly instrumentType = 'FUTURE' as const

  protected getWsBaseUrl(): string {
    return this.configService.get<string>('BINANCE_FUTURE_WS_BASE_URL') ?? 'wss://dstream.binance.com'
  }

  protected getRestBaseUrl(): string {
    return this.configService.get<string>('BINANCE_FUTURE_REST_BASE_URL') ?? 'https://dapi.binance.com'
  }

  protected getRestDepthPath(): string {
    return '/dapi/v1/depth'
  }

  protected getMaxStreamsPerConnection(): number {
    return (
      this.configService.get<number>('ORDERBOOK_WS_BINANCE_CEX_FUTURE_MAX_STREAMS_PER_CONNECTION') ??
      this.configService.get<number>('ORDERBOOK_WS_MAX_STREAMS_PER_CONNECTION') ??
      150
    )
  }

  constructor(
    configService: ConfigService,
    redisService: RedisService,
  ) {
    super(configService, redisService)
  }
}

