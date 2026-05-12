import type { IExchangeClient } from '../core/interface'
import type { ExchangeId, MarketType } from '../core/types'
import type { HttpEgressOptions } from '../exchanges/base-cex-client'
import type { ExchangeAccountConfig, HyperliquidConfig } from './account-store'
import type { OnModuleDestroy } from '@nestjs/common'
import type { Dispatcher } from 'undici'
import { Inject, Injectable, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MessageBusMetricsService } from '@/modules/message-bus/metrics/message-bus-metrics.service'
import { UnsupportedExchangeException } from '../exceptions'
import { BinanceClient } from '../exchanges/binance-client'
import { createHttpEgressDispatcher } from '../exchanges/base-cex-client'
import { OkxClient } from '../exchanges/okx-client'
import { RateLimiterRegistry } from '../services/rate-limiter-registry.service'

type HyperliquidClientConstructor = new (config: HyperliquidConfig, marketType?: MarketType) => IExchangeClient

@Injectable()
export class ExchangeFactory implements OnModuleDestroy {
  private readonly dispatchers = new Map<string, Dispatcher>()

  constructor(
    @Optional()
    @Inject(ConfigService)
    private readonly configService?: Pick<ConfigService, 'get'>,
    @Optional()
    private readonly rateLimiter?: RateLimiterRegistry,
    @Optional()
    private readonly metrics?: MessageBusMetricsService,
  ) {}

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
      return new OkxClient(marketType, account.config, {
        dispatcher: this.getHttpEgressDispatcher(),
        rateLimiter: this.rateLimiter,
        tokenBucketEnabled: this.isTokenBucketEnabled(),
        retryEnabled: this.isOkxRetryEnabled(),
        metrics: this.metrics,
      })
    }

    if (account.exchangeId === 'hyperliquid' && exchangeId === 'hyperliquid') {
      // 返回客户端实例（注意：方法会抛出 ExchangeError）
      const HyperliquidClient = this.loadHyperliquidClient()
      return new HyperliquidClient(account.config, marketType)
    }

    throw new UnsupportedExchangeException({ exchangeId })
  }

  async onModuleDestroy(): Promise<void> {
    const dispatchers = [...this.dispatchers.values()]
    this.dispatchers.clear()

    await Promise.all(dispatchers.map(dispatcher => dispatcher.close()))
  }

  private loadHyperliquidClient(): HyperliquidClientConstructor {
    // 延迟加载 Hyperliquid 适配器，避免 Binance/OKX 链路在模块初始化阶段
    // 被其 ESM 依赖牵连，导致与当前执行路径无关的测试或服务启动失败。
    // eslint-disable-next-line ts/no-require-imports
    const hyperliquidModule = require('../exchanges/hyperliquid-client') as {
      HyperliquidClient: HyperliquidClientConstructor
    }

    return hyperliquidModule.HyperliquidClient
  }

  private isTokenBucketEnabled(): boolean {
    const direct = this.configService?.get<boolean>('featureFlags.tokenBucketEnabled')
    if (typeof direct === 'boolean') return direct

    return this.configService?.get<{ tokenBucketEnabled?: boolean }>('featureFlags')?.tokenBucketEnabled ?? false
  }

  private isOkxRetryEnabled(): boolean {
    const direct = this.configService?.get<boolean>('featureFlags.okxRetryEnabled')
    if (typeof direct === 'boolean') return direct

    return this.configService?.get<{ okxRetryEnabled?: boolean }>('featureFlags')?.okxRetryEnabled ?? false
  }

  private getHttpEgressOptions(): HttpEgressOptions | undefined {
    const proxyUrl = this.readOptionalString('httpEgress.proxyUrl')
    const localAddress = this.readOptionalString('httpEgress.localAddress')

    if (!proxyUrl && !localAddress) {
      return undefined
    }

    return { proxyUrl, localAddress }
  }

  private getHttpEgressDispatcher(): Dispatcher | undefined {
    const options = this.getHttpEgressOptions()
    if (!options) return undefined

    const key = `${options.proxyUrl ?? ''}|${options.localAddress ?? ''}`
    const existing = this.dispatchers.get(key)
    if (existing) return existing

    const dispatcher = createHttpEgressDispatcher(options)
    if (dispatcher) this.dispatchers.set(key, dispatcher)
    return dispatcher
  }

  private readOptionalString(key: string): string | undefined {
    const value = this.configService?.get<string>(key)
    if (typeof value !== 'string') {
      return undefined
    }

    const trimmed = value.trim()
    return trimmed ? trimmed : undefined
  }
}
