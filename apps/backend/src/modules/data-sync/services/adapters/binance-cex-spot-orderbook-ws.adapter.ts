import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '@/common/services/redis.service'
import { BinanceOrderbookWsAdapterBase } from './binance/binance-orderbook-ws.base'

@Injectable()
export class BinanceCexSpotOrderbookWsAdapter extends BinanceOrderbookWsAdapterBase {
  readonly key = 'BINANCE.CEX.SPOT' as const

  protected readonly venueId = 'binance-spot'
  protected readonly instrumentType = 'SPOT' as const

  protected getWsBaseUrl(): string {
    return this.configService.get<string>('marketData.wsBaseUrl') ?? 'wss://stream.binance.com:9443'
  }

  protected getRestBaseUrl(): string {
    return this.configService.get<string>('marketData.restBaseUrl') ?? 'https://api.binance.com'
  }

  protected getRestDepthPath(): string {
    return '/api/v3/depth'
  }

  protected getMaxStreamsPerConnection(): number {
    return (
      this.configService.get<number>('ORDERBOOK_WS_BINANCE_CEX_SPOT_MAX_STREAMS_PER_CONNECTION') ??
      this.configService.get<number>('ORDERBOOK_WS_MAX_STREAMS_PER_CONNECTION') ??
      200
    )
  }

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(RedisService) redisService: RedisService,
  ) {
    super(configService, redisService)
  }
}

