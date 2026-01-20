import type { OrderbookPairConfig } from '@prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '@/common/services/redis.service'
import { HyperliquidOrderbookWsAdapterBase } from './hyperliquid/hyperliquid-orderbook-ws.base'

@Injectable()
export class HyperliquidDexSpotOrderbookWsAdapter extends HyperliquidOrderbookWsAdapterBase {
  readonly key = 'HYPERLIQUID.DEX.SPOT' as const

  protected readonly venueId = 'hyperliquid-spot'
  protected readonly instrumentType = 'SPOT' as const

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(RedisService) redisService: RedisService,
  ) {
    super(configService, redisService)
  }

  /**
   * 现货：使用 baseAsset/quoteAsset 格式
   * 例如：PURR/USDC, HYPE/USDC
   *
   * 注意：Hyperliquid 现货使用以下格式：
   * - PURR/USDC 直接使用
   * - 其他 token 可使用 @{index} 格式（需要从 spotMeta 获取 index）
   *
   * 为简化实现，这里统一使用 baseAsset/quoteAsset 格式
   * 如果需要 @index 格式，可在 metadata 中配置 spotIndex 字段
   */
  protected toCoin(cfg: OrderbookPairConfig): string {
    // 检查是否在 metadata 中配置了 spotIndex
    const metadata = cfg.metadata as Record<string, unknown> | null
    if (metadata && typeof metadata.spotIndex === 'number') {
      return `@${metadata.spotIndex}`
    }

    // 默认使用 baseAsset/quoteAsset 格式
    const base = cfg.baseAsset.toUpperCase()
    const quote = cfg.quoteAsset.toUpperCase()
    return `${base}/${quote}`
  }
}
