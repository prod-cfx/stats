import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '@/common/services/redis.service'
import { BybitOrderbookWsAdapterBase } from './bybit/bybit-orderbook-ws.base'

@Injectable()
export class BybitCexFutureOrderbookWsAdapter extends BybitOrderbookWsAdapterBase {
  readonly key = 'BYBIT.CEX.FUTURE' as const

  protected readonly venueId = 'bybit-future'
  protected readonly instrumentType = 'FUTURE' as const
  protected readonly category = 'inverse' as const

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(RedisService) redisService: RedisService,
  ) {
    super(configService, redisService)
  }
}

