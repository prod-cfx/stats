import type {
  CreateOrderInput,
  ExchangeId,
  MarketType,
  PositionIntentSide,
  UnifiedBalance,
  UnifiedOrder,
  UnifiedPosition,
} from './core/types'
import type { BinanceConfig, ExchangeAccountConfig, ExchangeAccountStore, HyperliquidConfig, OkxConfig } from './factory/account-store'
import { Inject, Injectable, Logger } from '@nestjs/common'
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
  private readonly logger = new Logger(TradingService.name)

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
    this.ensureMarketTypeSupported(exchangeId, marketType, account)

    // 校验 marketType 一致性：参数和 input 中的 marketType 必须一致
    if (input.marketType && input.marketType !== marketType) {
      throw new UnsupportedMarketTypeException({ exchangeId, marketType: input.marketType })
    }

    const client = this.exchangeFactory.createClient(exchangeId, marketType, account)

    try {
      // 预留风控入口：下单前可在此加入限额、黑名单等检查
      const resolvedInput = await this.prepareOrderInput({ exchangeId, marketType, input, client })
      return await client.createOrder(resolvedInput)
    }
    catch (error) {
      // 捕获交易所错误并映射为业务异常，避免直接暴露第三方错误详情
      if (error instanceof ExchangeError) {
        this.logger.error(
          `[TradingService.placeOrder] failed to create order; input=${JSON.stringify(this.summarizeOrderInput(exchangeId, marketType, input))}; reason=${error.message}`,
        )
        throw new OrderCreationFailedException({ exchangeId, reason: error.message })
      }
      throw error
    }
  }


  private async prepareOrderInput(input: {
    exchangeId: ExchangeId
    marketType: MarketType
    input: CreateOrderInput
    client: { createOrder: (input: CreateOrderInput) => Promise<UnifiedOrder>; fetchAccountConfig?: () => Promise<{ posMode: string }> }
  }): Promise<CreateOrderInput> {
    if (input.exchangeId !== 'okx' || input.marketType !== 'perp') {
      return input.input
    }

    const tdMode = input.input.tdMode
    if (!tdMode) {
      throw new ExchangeError('OKX perp order requires explicit tdMode', 'OKX_TD_MODE_REQUIRED', this.summarizeOrderInput(input.exchangeId, input.marketType, input.input))
    }

    if (!input.client.fetchAccountConfig) {
      throw new ExchangeError('OKX position mode capability is unavailable', 'POSITION_MODE_UNAVAILABLE')
    }

    let posMode: string
    try {
      posMode = (await input.client.fetchAccountConfig()).posMode
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new ExchangeError(`POSITION_MODE_UNAVAILABLE: ${reason}`, 'POSITION_MODE_UNAVAILABLE')
    }

    const extra: Record<string, unknown> = { ...(input.input.extra ?? {}), tdMode }
    if (posMode === 'long_short_mode') {
      if (!input.input.positionSide) {
        throw new ExchangeError('OKX long/short mode requires explicit positionSide', 'OKX_POSITION_SIDE_REQUIRED', this.summarizeOrderInput(input.exchangeId, input.marketType, input.input))
      }
      extra.posSide = this.mapOkxPositionSide(input.input.positionSide)
    }
    else if (posMode === 'net_mode') {
      delete extra.posSide
    }
    else {
      throw new ExchangeError(`Unsupported OKX position mode: ${posMode}`, 'POSITION_MODE_UNAVAILABLE')
    }

    return { ...input.input, extra }
  }

  private mapOkxPositionSide(positionSide: PositionIntentSide): 'long' | 'short' {
    return positionSide === 'LONG' ? 'long' : 'short'
  }

  private summarizeOrderInput(exchangeId: ExchangeId, marketType: MarketType, input: CreateOrderInput) {
    return {
      exchangeId,
      marketType,
      symbol: input.symbol,
      side: input.side,
      type: input.type,
      reduceOnly: input.reduceOnly ?? false,
      positionSide: input.positionSide ?? null,
      tdMode: input.tdMode ?? null,
      clientOrderId: input.clientOrderId ?? null,
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
    this.ensureMarketTypeSupported(exchangeId, marketType, account)

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

  async getOpenOrders(
    userId: string,
    exchangeId: ExchangeId,
    marketType: MarketType,
    symbol?: string,
    exchangeAccountId?: string,
  ): Promise<UnifiedOrder[]> {
    const account = exchangeAccountId
      ? await this.accountStore.getAccountConfigById(exchangeAccountId, userId)
      : await this.accountStore.getAccountConfig(userId, exchangeId)
    if (!account) {
      throw new TradingAccountNotFoundException({ userId, exchangeId })
    }
    this.ensureMarketTypeSupported(exchangeId, marketType, account)

    const client = this.exchangeFactory.createClient(exchangeId, marketType, account)

    try {
      return await client.fetchOpenOrders(symbol)
    }
    catch (error) {
      if (error instanceof ExchangeError) {
        throw new ExchangeOperationFailedException({ operation: 'fetch open orders', exchangeId, reason: error.message })
      }
      throw new ExchangeOperationFailedException({
        operation: 'fetch open orders',
        exchangeId,
        reason: (error as Error).message,
      })
    }
  }

  async cancelOrder(
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
    this.ensureMarketTypeSupported(exchangeId, marketType, account)

    const client = this.exchangeFactory.createClient(exchangeId, marketType, account)

    try {
      return await client.cancelOrder(orderId, symbol)
    }
    catch (error) {
      if (error instanceof ExchangeError) {
        throw new ExchangeOperationFailedException({ operation: 'cancel order', exchangeId, reason: error.message })
      }
      throw new ExchangeOperationFailedException({
        operation: 'cancel order',
        exchangeId,
        reason: (error as Error).message,
      })
    }
  }

  async getPositions(
    userId: string,
    exchangeId: ExchangeId,
    marketType: MarketType,
    exchangeAccountId?: string,
  ): Promise<UnifiedPosition[]> {
    const account = exchangeAccountId
      ? await this.accountStore.getAccountConfigById(exchangeAccountId, userId)
      : await this.accountStore.getAccountConfig(userId, exchangeId)
    if (!account) {
      throw new TradingAccountNotFoundException({ userId, exchangeId })
    }
    this.ensureMarketTypeSupported(exchangeId, marketType, account)
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
    this.ensureMarketTypeSupported(exchangeId, marketType, account)
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

  async getLeverageConstraints(
    _input: {
      userId: string
      exchangeId: ExchangeId
      marketType: MarketType
      symbol: string
      exchangeAccountId?: string
    },
  ): Promise<{ minLeverage: number; maxLeverage: number } | null> {
    return null
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

  private ensureMarketTypeSupported(
    exchangeId: ExchangeId,
    marketType: MarketType,
    account: ExchangeAccountConfig,
  ): void {
    if (exchangeId !== 'binance' || account.exchangeId !== 'binance') {
      return
    }

    const supportsSpot = account.config.spotEnabled
    const supportsPerp = account.config.futuresEnabled

    if (marketType === 'spot' && supportsSpot === false) {
      throw new UnsupportedMarketTypeException({ exchangeId, marketType })
    }

    if (marketType === 'perp' && supportsPerp === false) {
      throw new UnsupportedMarketTypeException({ exchangeId, marketType })
    }
  }
}
