import type { TradesAdapterKey, TradesConfig } from '../trades-ws-adapter'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  WHALE_ALERT_INGESTION_SERVICE,
  type WhaleAlertIngestionPort,
} from '@/modules/whale-alert/whale-alert-ingestion.service'
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
    @Inject(WHALE_ALERT_INGESTION_SERVICE) whaleAlertIngestionService: WhaleAlertIngestionPort,
  ) {
    super(configService, hyperliquidTradesConfig, whaleAlertIngestionService)
  }

  protected toCoin(cfg: TradesConfig): string {
    return cfg.baseAsset.toUpperCase()
  }
}
