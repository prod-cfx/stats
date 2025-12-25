import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '@/common/services/redis.service'
import { BybitOrderbookWsAdapterBase } from './bybit/bybit-orderbook-ws.base'

@Injectable()
export class BybitCexSpotOrderbookWsAdapter extends BybitOrderbookWsAdapterBase {
  readonly key = 'BYBIT.CEX.SPOT' as const

  protected readonly venueId = 'bybit-spot'
  protected readonly instrumentType = 'SPOT' as const
  protected readonly category = 'spot' as const

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(RedisService) redisService: RedisService,
  ) {
    super(configService, redisService)
  }
}

