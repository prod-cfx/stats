import type {
  CreateOrderInput,
  ExchangeId,
  MarketType,
  UnifiedBalance,
  UnifiedOrder,
  UnifiedPosition,
} from './core/types'
import type { BinanceConfig, ExchangeAccountConfig, ExchangeAccountStore, HyperliquidConfig, OkxConfig } from './factory/account-store'
import { Inject, Injectable } from '@nestjs/common'
import { AuthError, ExchangeError } from './core/errors'
import {
  ExchangeOperationFailedException,
  InvalidCredentialsException,
  OrderCreationFailedException,
  TradingAccountNotFoundException,
  UnsupportedExchangeException,
  UnsupportedMarketTypeException,
} from './exceptions'
import { ExchangeFactory } from './factory/exchange-factory'

@Injectable()
export class TradingService {
  constructor(
    @Inject(ExchangeFactory)
    private readonly exchangeFactory: ExchangeFactory,
    @Inject('ExchangeAccountStore')
    private readonly accountStore: ExchangeAccountStore,
  ) {}

  async placeOrder(
    userId: string,
    exchangeId: ExchangeId,
    marketType: MarketType,
    input: CreateOrderInput,
    /** 可选：精确指定交易所账户 ID（用于 LLM 订阅等场景） */
    exchangeAccountId?: string,
  ): Promise<UnifiedOrder> {
    // 如果指定了具体账户 ID，则精确查找；否则按 (userId, exchangeId) 取最新账户
    // 注意：getAccountConfigById 必须传入 userId，防止越权访问他人账户
    const account = exchangeAccountId
      ? await this.accountStore.getAccountConfigById(exchangeAccountId, userId)
      : await this.accountStore.getAccountConfig(userId, exchangeId)
    if (!account) {
      throw new TradingAccountNotFoundException({ userId, exchangeId })
    }

    // 校验 marketType 一致性：参数和 input 中的 marketType 必须一致
    if (input.marketType && input.marketType !== marketType) {
      throw new UnsupportedMarketTypeException({ exchangeId, marketType: input.marketType })
    }

    const client = this.exchangeFactory.createClient(exchangeId, marketType, account)

    try {
      // 预留风控入口：下单前可在此加入限额、黑名单等检查
      return await client.createOrder(input)
    }
    catch (error) {
      // 捕获交易所错误并映射为业务异常，避免直接暴露第三方错误详情
      if (error instanceof ExchangeError) {
        throw new OrderCreationFailedException({ exchangeId, reason: error.message })
      }
      throw error
    }
  }

  async getOrder(
    userId: string,
    exchangeId: ExchangeId,
    marketType: MarketType,
    orderId: string,
    symbol: string,
    exchangeAccountId?: string,
  ): Promise<UnifiedOrder> {
    const account = exchangeAccountId
      ? await this.accountStore.getAccountConfigById(exchangeAccountId, userId)
      : await this.accountStore.getAccountConfig(userId, exchangeId)
    if (!account) {
      throw new TradingAccountNotFoundException({ userId, exchangeId })
    }

    const client = this.exchangeFactory.createClient(exchangeId, marketType, account)

    try {
      return await client.fetchOrder(orderId, symbol)
    }
    catch (error) {
      if (error instanceof ExchangeError) {
        throw new ExchangeOperationFailedException({ operation: 'fetch order', exchangeId, reason: error.message })
      }
      throw new ExchangeOperationFailedException({
        operation: 'fetch order',
        exchangeId,
        reason: (error as Error).message,
      })
    }
  }

  async getPositions(
    userId: string,
    exchangeId: ExchangeId,
    marketType: MarketType,
  ): Promise<UnifiedPosition[]> {
    const account = await this.accountStore.getAccountConfig(userId, exchangeId)
    if (!account) {
      throw new TradingAccountNotFoundException({ userId, exchangeId })
    }
    const client = this.exchangeFactory.createClient(exchangeId, marketType, account)

    try {
      return await client.fetchPositions()
    }
    catch (error) {
      if (error instanceof ExchangeError) {
        throw new ExchangeOperationFailedException({ operation: 'fetch positions', exchangeId, reason: error.message })
      }
      throw error
    }
  }

  async getBalance(
    userId: string,
    exchangeId: ExchangeId,
    marketType: MarketType,
    exchangeAccountId?: string,
  ): Promise<UnifiedBalance[]> {
    const account = exchangeAccountId
      ? await this.accountStore.getAccountConfigById(exchangeAccountId, userId)
      : await this.accountStore.getAccountConfig(userId, exchangeId)
    if (!account) {
      throw new TradingAccountNotFoundException({ userId, exchangeId })
    }
    const client = this.exchangeFactory.createClient(exchangeId, marketType, account)

    try {
      return await client.fetchBalance()
    }
    catch (error) {
      if (error instanceof ExchangeError) {
        throw new ExchangeOperationFailedException({ operation: 'fetch balance', exchangeId, reason: error.message })
      }
      throw error
    }
  }

  /**
   * 校验交易所凭据是否有效。
   *
   * 支持的交易所：
   * - Binance/OKX：验证 API key/secret（通过 fetchBalance）
   * - Hyperliquid：验证钱包地址和私钥签名（通过专用 validateCredentials 方法）
   *
   * 使用方式：
   * - 在用户提交凭据后，调用该方法进行一次轻量的私有接口访问
   * - 若返回 true，说明认证通过
   * - 若抛出 InvalidCredentialsException，表示密钥无效或权限不足
   * - 若抛出 ExchangeOperationFailedException，则属于环境或交易所错误，应提示用户稍后重试
   */
  async validateCexCredentials(
    exchangeId: ExchangeId,
    marketType: MarketType,
    config: BinanceConfig | OkxConfig | HyperliquidConfig,
  ): Promise<boolean> {
    if (exchangeId !== 'binance' && exchangeId !== 'okx' && exchangeId !== 'hyperliquid') {
      throw new UnsupportedExchangeException({ exchangeId })
    }

    let account: ExchangeAccountConfig
    if (exchangeId === 'binance') {
      account = { exchangeId: 'binance', config: config as BinanceConfig }
    }
    else if (exchangeId === 'okx') {
      account = { exchangeId: 'okx', config: config as OkxConfig }
    }
    else {
      account = { exchangeId: 'hyperliquid', config: config as HyperliquidConfig }
    }

    const client = this.exchangeFactory.createClient(exchangeId, marketType, account)

    try {
      if (exchangeId === 'hyperliquid') {
        // Hyperliquid 需要使用专门的凭据验证方法
        // 因为 fetchBalance 使用的是公开 API，不验证签名
        // validateCredentials 会尝试调用需要签名的接口来验证 agent 授权
        await (client as any).validateCredentials()
      }
      else {
        // Binance/OKX 使用 fetchBalance 验证 API key/secret
        await client.fetchBalance()
      }
      return true
    }
    catch (error) {
      if (error instanceof AuthError) {
        // 认证错误：key/secret 无效、权限不足等
        // 传递详细的错误信息给异常
        throw new InvalidCredentialsException({
          exchangeId,
          message: error.message
        })
      }

      if (error instanceof ExchangeError) {
        // 非认证类的交易所错误统一包装为领域异常，避免直接暴露第三方错误
        throw new ExchangeOperationFailedException({ operation: 'validate credentials', exchangeId, reason: error.message })
      }

      throw error
    }
  }
}
