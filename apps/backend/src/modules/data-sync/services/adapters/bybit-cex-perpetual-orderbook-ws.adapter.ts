import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '@/common/services/redis.service'
import { BybitOrderbookWsAdapterBase } from './bybit/bybit-orderbook-ws.base'

@Injectable()
export class BybitCexPerpetualOrderbookWsAdapter extends BybitOrderbookWsAdapterBase {
  readonly key = 'BYBIT.CEX.PERPETUAL' as const

  protected readonly venueId = 'bybit-perp'
  protected readonly instrumentType = 'PERPETUAL' as const
  protected readonly category = 'linear' as const

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(RedisService) redisService: RedisService,
  ) {
    super(configService, redisService)
  }
}

