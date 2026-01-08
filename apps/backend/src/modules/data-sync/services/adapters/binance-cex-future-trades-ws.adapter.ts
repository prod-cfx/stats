/* eslint-disable perfectionist/sort-imports */

import type { TradesAdapterKey } from '../trades-ws-adapter'
import type { ConfigService } from '@nestjs/config'
import { Injectable } from '@nestjs/common'
import type { PrismaService } from '@/prisma/prisma.service'
import { BinanceTradesWsAdapterBase } from './binance/binance-trades-ws.base'

@Injectable()
export class BinanceCexFutureTradesWsAdapter extends BinanceTradesWsAdapterBase {
  readonly key: TradesAdapterKey = 'binance-future-trades'
  protected readonly exchange = 'BINANCE'
  protected readonly instrumentType = 'FUTURE' as const

  constructor(
    configService: ConfigService,
    prismaService: PrismaService,
  ) {
    super(configService, prismaService)
  }

  protected getWsBaseUrl(): string {
    const raw =
      this.configService.get<string>('TRADES_BINANCE_FUTURE_WS_BASE_URL')
      ?? this.configService.get<string>('BINANCE_FUTURE_WS_BASE_URL')
    const value = typeof raw === 'string' ? raw.trim() : ''
    return value.length ? value : 'wss://dstream.binance.com'
  }

  protected getMaxStreamsPerConnection(): number {
    const raw =
      this.configService.get<string>('TRADES_WS_BINANCE_CEX_FUTURE_MAX_STREAMS_PER_CONNECTION')
      ?? this.configService.get<string>('TRADES_WS_MAX_STREAMS_PER_CONNECTION')
    const parsed = raw != null ? Number(raw) : Number.NaN
    return Number.isFinite(parsed) ? parsed : 200
  }
}






