import type { IExchangeClient } from '../core/interface'
import type { ExchangeId, MarketType } from '../core/types'
import type { ExchangeAccountConfig, HyperliquidConfig } from './account-store'
import { Injectable } from '@nestjs/common'
import { UnsupportedExchangeException } from '../exceptions'
import { BinanceClient } from '../exchanges/binance-client'
import { OkxClient } from '../exchanges/okx-client'

type HyperliquidClientConstructor = new (config: HyperliquidConfig) => IExchangeClient

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
      const { HyperliquidClient } = require('../exchanges/hyperliquid-client') as typeof import('../exchanges/hyperliquid-client')
      // 返回客户端实例（注意：方法会抛出 ExchangeError）
      const HyperliquidClient = this.loadHyperliquidClient()
      return new HyperliquidClient(account.config)
    }

    throw new UnsupportedExchangeException({ exchangeId })
  }

  private loadHyperliquidClient(): HyperliquidClientConstructor {
    // 延迟加载 Hyperliquid 适配器，避免 Binance/OKX 链路在模块初始化阶段
    // 被其 ESM 依赖牵连，导致与当前执行路径无关的测试或服务启动失败。
    const hyperliquidModule = require('../exchanges/hyperliquid-client') as {
      HyperliquidClient: HyperliquidClientConstructor
    }

    return hyperliquidModule.HyperliquidClient
  }
}
