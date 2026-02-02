import type { TradesAdapterKey, TradesConfig } from '../trades-ws-adapter'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '@/prisma/prisma.service'
import { WhaleAlertService } from '@/modules/whale-alert/whale-alert.service'
import { HyperliquidTradesWsAdapterBase } from './hyperliquid/hyperliquid-trades-ws.base'
import { HyperliquidTradesWsConfig } from './hyperliquid/hyperliquid-trades-ws.config'

@Injectable()
export class HyperliquidDexPerpetualTradesWsAdapter extends HyperliquidTradesWsAdapterBase {
  readonly key: TradesAdapterKey = 'hyperliquid-perp-trades'

  protected readonly venueId = 'hyperliquid-perp'
  protected readonly instrumentType = 'PERPETUAL' as const

  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(HyperliquidTradesWsConfig) hyperliquidTradesConfig: HyperliquidTradesWsConfig,
    @Inject(PrismaService) prismaService: PrismaService,
    @Inject(WhaleAlertService) whaleAlertService: WhaleAlertService,
  ) {
    super(configService, hyperliquidTradesConfig, prismaService, whaleAlertService)
  }

  protected toCoin(cfg: TradesConfig): string {
    return cfg.baseAsset.toUpperCase()
  }
}
