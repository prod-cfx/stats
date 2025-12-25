import { Injectable } from '@nestjs/common'
import { BinanceOrderbookWsAdapterBase } from './binance/binance-orderbook-ws.base'

@Injectable()
export class BinanceCexPerpetualOrderbookWsAdapter extends BinanceOrderbookWsAdapterBase {
  readonly key = 'BINANCE.CEX.PERPETUAL' as const

  protected readonly venueId = 'binance-perp'
  protected readonly instrumentType = 'PERPETUAL' as const

  protected getWsBaseUrl(): string {
    return this.configService.get<string>('BINANCE_PERP_WS_BASE_URL') ?? 'wss://fstream.binance.com'
  }

  protected getRestBaseUrl(): string {
    return this.configService.get<string>('BINANCE_PERP_REST_BASE_URL') ?? 'https://fapi.binance.com'
  }

  protected getRestDepthPath(): string {
    return '/fapi/v1/depth'
  }

  protected getMaxStreamsPerConnection(): number {
    return (
      this.configService.get<number>('ORDERBOOK_WS_BINANCE_CEX_PERPETUAL_MAX_STREAMS_PER_CONNECTION') ??
      this.configService.get<number>('ORDERBOOK_WS_MAX_STREAMS_PER_CONNECTION') ??
      150
    )
  }
}

