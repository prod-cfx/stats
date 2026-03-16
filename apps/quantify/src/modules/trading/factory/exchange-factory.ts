import type { IExchangeClient } from '../core/interface'
import type { ExchangeId, MarketType } from '../core/types'
import type { ExchangeAccountConfig } from './account-store'
import { Injectable } from '@nestjs/common'
import { UnsupportedExchangeException } from '../exceptions'
import { BinanceClient } from '../exchanges/binance-client'
import { HyperliquidClient } from '../exchanges/hyperliquid-client'
import { OkxClient } from '../exchanges/okx-client'

@Injectable()
export class ExchangeFactory {
  createClient(
    exchangeId: ExchangeId,
    marketType: MarketType,
    account: ExchangeAccountConfig,
  ): IExchangeClient {
    // 通过判定 account.exchangeId 让 TypeScript 推断出精确类型
    if (account.exchangeId === 'binance' && exchangeId === 'binance') {
      return new BinanceClient(marketType, account.config)
    }

    if (account.exchangeId === 'okx' && exchangeId === 'okx') {
      return new OkxClient(marketType, account.config)
    }

    if (account.exchangeId === 'hyperliquid' && exchangeId === 'hyperliquid') {
      // Hyperliquid 只支持永续合约
      if (marketType !== 'perp') {
        throw new UnsupportedExchangeException({ exchangeId })
      }
      // 返回客户端实例（注意：方法会抛出 ExchangeError）
      return new HyperliquidClient(account.config)
    }

    throw new UnsupportedExchangeException({ exchangeId })
  }
}
