import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '@/common/services/redis.service'
import { OkxOrderbookWsAdapterBase } from './okx/okx-orderbook-ws.base'

@Injectable()
export class OkxCexPerpetualOrderbookWsAdapter extends OkxOrderbookWsAdapterBase {
  readonly key = 'OKX.CEX.PERPETUAL' as const

  protected readonly venueId = 'okx-perp'
  protected readonly instrumentType = 'PERPETUAL' as const

  protected getWsBaseUrl(): string {
    return (
      this.configService.get<string>('ORDERBOOK_WS_OKX_WS_BASE_URL') ??
      'wss://ws.okx.com:8443/ws/v5/public'
    )
  }

  protected getRestBaseUrl(): string {
    return this.configService.get<string>('ORDERBOOK_WS_OKX_REST_BASE_URL') ?? 'https://www.okx.com'
  }

  protected getWsChannel(): string {
    return 'books'
  }

  protected getMaxStreamsPerConnection(): number {
    return (
      this.configService.get<number>('ORDERBOOK_WS_OKX_MAX_STREAMS_PER_CONNECTION') ??
      this.configService.get<number>('ORDERBOOK_WS_MAX_STREAMS_PER_CONNECTION') ??
      100
    )
  }

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(RedisService) redisService: RedisService,
  ) {
    super(configService, redisService)
  }
}

