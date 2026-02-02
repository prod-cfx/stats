import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class HyperliquidTradesWsConfig {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  get isEnabled(): boolean {
    const raw = this.configService.get<string>('HYPERLIQUID_TRADES_WS_ENABLED')
    if (typeof raw === 'string') {
      return raw.toLowerCase() === 'true'
    }
    return Boolean(raw)
  }
}
