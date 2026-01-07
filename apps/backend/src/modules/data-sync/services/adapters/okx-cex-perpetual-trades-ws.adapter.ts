/* eslint-disable perfectionist/sort-imports */

import type { TradesAdapterKey } from '../trades-ws-adapter'
import type { ConfigService } from '@nestjs/config'
import { Injectable } from '@nestjs/common'
import type { PrismaService } from '@/prisma/prisma.service'
import { OkxTradesWsAdapterBase } from './okx/okx-trades-ws.base'

@Injectable()
export class OkxCexPerpetualTradesWsAdapter extends OkxTradesWsAdapterBase {
  readonly key: TradesAdapterKey = 'okx-perp-trades'
  protected readonly exchange = 'OKX'
  protected readonly instrumentType = 'PERPETUAL' as const

  constructor(
    configService: ConfigService,
    prismaService: PrismaService,
  ) {
    super(configService, prismaService)
  }

  protected getWsBaseUrl(): string {
    const raw = this.configService.get<string>('TRADES_OKX_WS_BASE_URL')
    const value = typeof raw === 'string' ? raw.trim() : ''
    return value.length ? value : 'wss://ws.okx.com:8443/ws/v5/public'
  }

  protected getWsChannel(): string {
    return 'trades'
  }

  protected getMaxStreamsPerConnection(): number {
    const raw = this.configService.get<string>('TRADES_OKX_MAX_STREAMS_PER_CONNECTION')
    const parsed = raw != null ? Number(raw) : Number.NaN
    return Number.isFinite(parsed) ? parsed : 100
  }
}







