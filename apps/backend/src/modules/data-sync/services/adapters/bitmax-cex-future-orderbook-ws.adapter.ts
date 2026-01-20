import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '@/common/services/redis.service'
import { BitmaxOrderbookWsAdapterBase } from './bitmax/bitmax-orderbook-ws.base'

@Injectable()
export class BitmaxCexFutureOrderbookWsAdapter extends BitmaxOrderbookWsAdapterBase {
  readonly key = 'BITMAX.CEX.FUTURE' as const

  protected readonly venueId = 'bitmax-future'
  protected readonly instrumentType = 'FUTURE' as const

  protected getWsBaseUrl(): string {
    return (
      this.configService.get<string>('ORDERBOOK_WS_BITMAX_FUTURES_WS_BASE_URL') ??
      'wss://ascendex.com:443/api/pro/v2/stream'
    )
  }

  protected getRestBaseUrl(): string {
    return this.configService.get<string>('ORDERBOOK_WS_BITMAX_FUTURES_REST_BASE_URL') ?? 'https://ascendex.com'
  }

  protected getMaxStreamsPerConnection(): number {
    return (
      this.configService.get<number>('ORDERBOOK_WS_BITMAX_FUTURE_MAX_STREAMS_PER_CONNECTION') ??
      this.configService.get<number>('ORDERBOOK_WS_MAX_STREAMS_PER_CONNECTION') ??
      100
    )
  }

  protected hasRestSnapshot(): boolean {
    // 期货 API 没有 REST snapshot 端点
    return false
  }

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(RedisService) redisService: RedisService,
  ) {
    super(configService, redisService)
  }
}
