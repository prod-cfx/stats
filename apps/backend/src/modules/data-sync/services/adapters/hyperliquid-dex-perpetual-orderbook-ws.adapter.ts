import type { OrderbookPairConfig } from '@/prisma/prisma.types'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '@/common/services/redis.service'
import { HyperliquidOrderbookWsAdapterBase } from './hyperliquid/hyperliquid-orderbook-ws.base'

@Injectable()
export class HyperliquidDexPerpetualOrderbookWsAdapter extends HyperliquidOrderbookWsAdapterBase {
  readonly key = 'HYPERLIQUID.DEX.PERPETUAL' as const

  protected readonly venueId = 'hyperliquid-perp'
  protected readonly instrumentType = 'PERPETUAL' as const

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(RedisService) redisService: RedisService,
  ) {
    super(configService, redisService)
  }

  /**
   * 永续合约：直接使用 baseAsset 作为 coin
   * 例如：BTC, ETH, SOL
   */
  protected toCoin(cfg: OrderbookPairConfig): string {
    return cfg.baseAsset.toUpperCase()
  }
}
