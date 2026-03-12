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
    // 閫氳繃鍒ゅ畾 account.exchangeId 璁?TypeScript 鎺ㄦ柇鍑虹簿纭被鍨?
    if (account.exchangeId === 'binance' && exchangeId === 'binance') {
      return new BinanceClient(marketType, account.config)
    }

    if (account.exchangeId === 'okx' && exchangeId === 'okx') {
      return new OkxClient(marketType, account.config)
    }

    if (account.exchangeId === 'hyperliquid' && exchangeId === 'hyperliquid') {
      // Hyperliquid 鍙敮鎸佹案缁悎绾?
      if (marketType !== 'perp') {
        throw new UnsupportedExchangeException({ exchangeId })
      }
      // 杩斿洖瀹㈡埛绔疄渚嬶紙娉ㄦ剰锛氬綋鍓嶄负楠ㄦ灦瀹炵幇锛屾柟娉曚細鎶?ExchangeError锛?
      return new HyperliquidClient(account.config)
    }

    throw new UnsupportedExchangeException({ exchangeId })
  }
}
