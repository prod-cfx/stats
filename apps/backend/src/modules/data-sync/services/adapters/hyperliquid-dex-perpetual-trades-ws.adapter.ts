import type { TradesAdapterKey, TradesConfig } from '../trades-ws-adapter'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '@/prisma/prisma.service'
import { HyperliquidTradesWsAdapterBase } from './hyperliquid/hyperliquid-trades-ws.base'

@Injectable()
export class HyperliquidDexPerpetualTradesWsAdapter extends HyperliquidTradesWsAdapterBase {
  readonly key: TradesAdapterKey = 'hyperliquid-perp-trades'

  protected readonly venueId = 'hyperliquid-perp'
  protected readonly instrumentType = 'PERPETUAL' as const

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(PrismaService) prismaService: PrismaService,
  ) {
    super(configService, prismaService)
  }

  protected toCoin(cfg: TradesConfig): string {
    return cfg.baseAsset.toUpperCase()
  }
}
