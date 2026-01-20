import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '@/common/services/redis.service'
import { BitmaxOrderbookWsAdapterBase } from './bitmax/bitmax-orderbook-ws.base'

@Injectable()
export class BitmaxCexSpotOrderbookWsAdapter extends BitmaxOrderbookWsAdapterBase {
  readonly key = 'BITMAX.CEX.SPOT' as const

  protected readonly venueId = 'bitmax-spot'
  protected readonly instrumentType = 'SPOT' as const

  protected getWsBaseUrl(): string {
    return (
      this.configService.get<string>('ORDERBOOK_WS_BITMAX_SPOT_WS_BASE_URL') ??
      'wss://ascendex.com/api/pro/v1/stream'
    )
  }

  protected getRestBaseUrl(): string {
    return this.configService.get<string>('ORDERBOOK_WS_BITMAX_SPOT_REST_BASE_URL') ?? 'https://ascendex.com'
  }

  protected getMaxStreamsPerConnection(): number {
    return (
      this.configService.get<number>('ORDERBOOK_WS_BITMAX_SPOT_MAX_STREAMS_PER_CONNECTION') ??
      this.configService.get<number>('ORDERBOOK_WS_MAX_STREAMS_PER_CONNECTION') ??
      100
    )
  }

  protected hasRestSnapshot(): boolean {
    return true
  }

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(RedisService) redisService: RedisService,
  ) {
    super(configService, redisService)
  }
}
