import type { IExchangeClient } from '../core/interface'
import type {
  CreateOrderInput,
  MarketType,
  OrderType,
  UnifiedBalance,
  UnifiedInstrumentConstraints,
  UnifiedOrder,
  UnifiedPosition,
  UnifiedTicker,
} from '../core/types'
import type { HyperliquidConfig } from '../factory/account-store'
import { randomBytes } from 'node:crypto'
import { Wallet } from 'ethers'
import { AuthError, ExchangeError, OrderNotFoundError } from '../core/errors'
import { formatPrice, formatSize } from './hyperliquid-format'

interface HyperliquidSdk {
  HttpTransport: new (config: unknown) => unknown
  InfoClient: new (config: unknown) => any
  ExchangeClient: new (config: unknown) => any
}

interface HyperliquidAssetMeta {
  assetId: number
  szDecimals: number
  marketIndex?: number
}

function loadHyperliquidSdk(): HyperliquidSdk {
  // 延迟加载：避免在未使用 Hyperliquid 交易路径时触发 ESM 依赖解析（尤其是 Jest e2e 场景）
  // eslint-disable-next-line ts/no-require-imports -- Runtime lazy-loading is intentional here.
  return require('@nktkas/hyperliquid') as HyperliquidSdk
}

/**
 * Hyperliquid 交易所适配器（基于 @nktkas/hyperliquid SDK）。
 *
 * 特点：
 * - 使用 Agent Private Key 对订单进行签名
 * - 使用 mainWalletAddress 作为资金归属钱包
 * - 完整实现统一交易接口
 * - 内置速率限制和请求重试机制
 */
export class HyperliquidClient implements IExchangeClient {
  // ========== 配置常量 ==========

  /** 市价单滑点容忍度 (2%) */
  private readonly MARKET_ORDER_SLIPPAGE = 0.02

  /** Ticker 缓存有效期（5秒） */
  private readonly TICKER_CACHE_TTL = 5000

  /** 最小请求间隔（100毫秒） */
  private readonly MIN_REQUEST_INTERVAL = 100

  /** 最大并发请求数 */
  private readonly MAX_CONCURRENT_REQUESTS = 10

  /** 最大重试次数 */
  private readonly MAX_RETRIES = 3

  /** 重试基础延迟（1秒） */
  private readonly RETRY_BASE_DELAY = 1000

  /** Ticker 价差百分比（0.01%） */
  private readonly TICKER_SPREAD_PERCENTAGE = 0.0001

  // ========== 实例字段 ==========

  private readonly mainWalletAddress: string
  private readonly agentPrivateKey: string
  private readonly marketType: MarketType

  // 实际用于查询账户状态的钱包地址（主账户或显式指定的子账户/vault）
  private readonly tradingWalletAddress: string

  private readonly infoClient: any
  private readonly exchClient: any

  // 速率限制
  private lastRequestTime = 0
  private pendingRequests = 0

  // Ticker 缓存
  private tickerCache = new Map<string, { data: UnifiedTicker; timestamp: number }>()

  // 资产元数据缓存（按市场隔离）
  private perpAssetMetaCache: Map<string, HyperliquidAssetMeta> | null = null
  private perpAssetMetaCacheTime = 0
  private spotAssetMetaCache: Map<string, HyperliquidAssetMeta> | null = null
  private spotAssetMetaCacheTime = 0
  private readonly ASSET_META_CACHE_TTL = 3600000 // 1小时

  constructor(config: HyperliquidConfig, marketType: MarketType = 'perp') {
    const hl = loadHyperliquidSdk()

    this.mainWalletAddress = config.mainWalletAddress
    this.agentPrivateKey = config.agentPrivateKey
    this.marketType = marketType

    // 初始化 HTTP Transport
    // 根据配置的 isTestnet 标志选择网络（测试网或主网）
    const transport = new hl.HttpTransport({
      // SDK 会根据 isTestnet 选择正确的 endpoint
      // - true  => https://api.hyperliquid-testnet.xyz
      // - false => https://api.hyperliquid.xyz
      isTestnet: config.isTestnet ?? false,
    } as any)

    // 创建签名钱包（使用 agent 私钥）
    const wallet = new Wallet(this.agentPrivateKey)

    // Hyperliquid Agent/Vault 架构：
    // - agent 钱包：用于签名交易
    // - 主账户地址：用于账户归属和查询
    // - 仅在代表子账户/vault 交易时才需要 defaultVaultAddress
    this.tradingWalletAddress = this.mainWalletAddress

    // 初始化客户端
    this.infoClient = new hl.InfoClient({ transport })
    this.exchClient = new hl.ExchangeClient({
      transport,
      wallet,
    } as any)
  }

  async init(): Promise<void> {
    await this.ping()
  }

  async ping(): Promise<void> {
    try {
      // 使用轻量级接口探活：获取所有币种中间价
      await this.infoClient.allMids()
    }
    catch (error) {
      throw new ExchangeError(
        `Hyperliquid ping failed: ${(error as Error).message}`,
        undefined,
        this.sanitizeError(error, 'ping'),
      )
    }
  }

  /**
   * 验证凭据有效性（私钥和授权关系）
   *
   * 通过尝试取消一个不存在的订单来验证签名。
   * - 如果私钥无效或 agent 未被主钱包授权，会返回签名/授权错误
   * - 如果签名有效但订单不存在，会返回“订单不存在”错误，这证明凭据有效
   *
   * 这个方法不会产生任何实际副作用。
   */
  async validateCredentials(): Promise<boolean> {
    // 使用一个随机的 clientOrderId 来验证签名
    const fakeCloid = this.generateClientOrderId()

    try {
      // 获取 BTC 的 assetId（最常用的资产）
      const { assetId } = await this.getPerpAssetMeta('BTC')

      // 尝试通过 cloid 取消一个不存在的订单
      // 这会触发签名验证，但不会产生实际副作用
      const cancelByCloidAction: any = {
        type: 'cancelByCloid',
        cancels: [{ asset: assetId, cloid: fakeCloid }],
      }

      const response: any = await this.rateLimit(async () =>
        (this.exchClient as any).cancelByCloid(cancelByCloidAction),
      )

      // 如果响应状态是 err，检查错误类型
      if (response.status === 'err') {
        const errorMsg = String(response.response || '').toLowerCase()

        // 签名/授权相关错误 - 凭据无效
        if (
          errorMsg.includes('signature') ||
          errorMsg.includes('invalid') ||
          errorMsg.includes('unauthorized') ||
          errorMsg.includes('not authorized') ||
          errorMsg.includes('agent') ||
          errorMsg.includes('permission')
        ) {
          throw new AuthError(`Hyperliquid authentication failed: ${response.response}`)
        }
      }

      // 检查响应中的具体状态
      const statuses = response.response?.data?.statuses
      if (statuses && statuses.length > 0) {
        const cancelStatus = statuses[0]

        // “订单不存在”错误说明签名验证通过
        if ('error' in cancelStatus) {
          const errorMsg = String(cancelStatus.error).toLowerCase()

          // 签名/授权相关错误
          if (
            errorMsg.includes('signature') ||
            errorMsg.includes('invalid') ||
            errorMsg.includes('unauthorized') ||
            errorMsg.includes('not authorized') ||
            errorMsg.includes('agent') ||
            errorMsg.includes('permission')
          ) {
            throw new AuthError(`Hyperliquid authentication failed: ${cancelStatus.error}`)
          }

          // 其他错误（如“订单不存在”）说明签名验证通过
          return true
        }
      }

      // 没有错误说明签名验证通过
      return true
    }
    catch (error) {
      // 如果是我们抛出的 AuthError，直接透传
      if (error instanceof AuthError) {
        throw error
      }

      // 分析其他错误
      const message = String((error as Error).message || '').toLowerCase()

      // 对于“订单不存在 / 已取消 / 已成交”这类错误，说明签名已通过，只是订单本身不存在。
      // 这正是我们期望的验证路径，因此应视为凭据有效而不是错误。
      if (
        message.includes('order was never placed') ||
        message.includes('already canceled') ||
        message.includes('already cancelled') ||
        message.includes('already filled')
      ) {
        return true
      }

      // 签名/授权相关错误
      if (
        message.includes('signature') ||
        message.includes('invalid private key') ||
        message.includes('unauthorized') ||
        message.includes('not authorized') ||
        message.includes('agent') ||
        message.includes('permission')
      ) {
        throw new AuthError(`Hyperliquid authentication failed: ${(error as Error).message}`)
      }

      // 网络或其他临时错误，包装后抛出
      throw new ExchangeError(
        `Credential validation failed: ${(error as Error).message}`,
        undefined,
        this.sanitizeError(error, 'validateCredentials'),
      )
    }
  }

  // ========== 速率限制与重试机制 ==========

  /**
   * 速率限制包装器，确保请求间隔和并发限制。
   */
  private async rateLimit<T>(fn: () => Promise<T>): Promise<T> {
    // 检查并发限制
    while (this.pendingRequests >= this.MAX_CONCURRENT_REQUESTS) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // 检查请求间隔
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve =>
        setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest),
      )
    }

    this.pendingRequests++
    this.lastRequestTime = Date.now()

    try {
      return await fn()
    }
    finally {
      this.pendingRequests--
    }
  }

  /**
   * 重试包装器，处理临时性故障。
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    operation: string,
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await this.rateLimit(fn)
      }
      catch (error) {
        lastError = error as Error

        // 不重试的错误类型
        if (error instanceof ExchangeError) {
          const noRetryErrors = ['INVALID_SYMBOL', 'INVALID_ORDER_TYPE', 'REQUIRES_PRICE']
          if (noRetryErrors.includes(error.code || '')) {
            throw error
          }
        }

        // 最后一次尝试失败
        if (attempt >= this.MAX_RETRIES) {
          break
        }

        // 指数退避
        const delay = this.RETRY_BASE_DELAY * (2 ** attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw new ExchangeError(
      `${operation} failed after ${this.MAX_RETRIES + 1} attempts: ${lastError!.message}`,
      'MAX_RETRIES_EXCEEDED',
      this.sanitizeError(lastError!, operation),
    )
  }

  /**
   * 净化错误详情，移除敏感信息。
   */
  private sanitizeError(error: unknown, operation: string): Record<string, unknown> {
    const errorObj = error as Error
    return {
      timestamp: Date.now(),
      operation,
      message: errorObj.message,
      // 不包含可能含有敏感信息的完整错误对象
    }
  }

  /**
   * 创建订单
   *
   * @param input - 订单参数，包含 symbol、side、type、amount、price 等
   * @returns 统一格式的订单对象
   * @throws {ExchangeError} 订单创建失败或参数错误
   *
   * @example
   * ```typescript
   * const order = await client.createOrder({
   *   symbol: 'BTC/USDT:PERP',
   *   marketType: 'perp',
   *   side: 'buy',
   *   type: 'limit',
   *   amount: 0.01,
   *   price: 50000,
   * })
   * ```
   */
  async createOrder(input: CreateOrderInput): Promise<UnifiedOrder> {
    const marketType = input.marketType
    if (marketType !== 'perp' && marketType !== 'spot') {
      throw new ExchangeError('Unsupported market type', 'INVALID_MARKET_TYPE')
    }

    const coin = this.mapSymbolToHl(input.symbol, marketType)
    const isBuy = input.side === 'buy'
    const sz = Number(input.amount)

    // 强制生成唯一 clientOrderId 以确保幂等性（防止重复下单）
    const clientOrderId = input.clientOrderId || this.generateClientOrderId()

    // 获取资产 ID（Hyperliquid SDK 要求）
    const { assetId, szDecimals } = await this.getAssetMeta(coin, marketType)

    // 准备订单类型和价格
    const { orderType, limitPx } = await this.prepareOrderRequest(input, coin, isBuy, marketType)

    // 构造订单请求（使用 SDK 的正确格式）
    // 注意：a = assetId（整数），s = size（字符串），p = price（字符串）
    const orderRequest: any = {
      a: assetId, // 资产 ID（整数）
      b: isBuy,
      p: formatPrice(limitPx, szDecimals, marketType === 'perp'),
      s: formatSize(sz, szDecimals), // 下单数量（字符串）
      r: input.reduceOnly ?? false,
      t: orderType,
      c: clientOrderId,
    }

    // 构造订单动作
    const orderAction: any = {
      type: 'order',
      orders: [orderRequest],
      grouping: 'na',
    }

    try {
      // 发送订单（不使用 withRetry，避免重复下单）
      const response: any = await this.rateLimit(async () =>
        (this.exchClient as any).order(orderAction),
      )

      // 检查响应状态
      if (response.status === 'err') {
        throw new ExchangeError(`Order failed: ${response.response}`)
      }

      // 解析响应
      const statuses = response.response.data?.statuses
      if (!statuses || statuses.length === 0) {
        throw new ExchangeError('No order status returned')
      }

      const orderStatus = statuses[0]
      if (!orderStatus || 'error' in orderStatus) {
        const errorMsg = 'error' in orderStatus ? orderStatus.error : 'Unknown error'
        throw new ExchangeError(`Order failed: ${errorMsg}`)
      }

      // 获取订单详情
      const filled = orderStatus.filled || { totalSz: '0', avgPx: '0' }

      // 获取订单 ID：
      // 1. 优先使用 resting.oid（未完全成交的订单）
      // 2. 其次使用 filled.oid（瞬时成交的订单）
      // 3. 最后使用 clientOrderId 作为临时标识
      const orderId = String(
        orderStatus.resting?.oid ||
        orderStatus.filled?.oid ||
        clientOrderId,
      )

      return {
        id: orderId,
        clientOrderId,
        symbol: input.symbol,
        marketType,
        side: input.side,
        type: input.type,
        price: limitPx,
        amount: sz,
        filled: Number(filled.totalSz),
        status: this.mapOrderStatus(orderStatus),
        createdAt: Date.now(),
        raw: orderStatus,
      }
    }
    catch (error) {
      throw new ExchangeError(
        `Failed to create order: ${(error as Error).message}`,
        undefined,
        this.sanitizeError(error, 'createOrder'),
      )
    }
  }

  async fetchInstrumentConstraints(symbol: string): Promise<UnifiedInstrumentConstraints> {
    const rawSymbol = this.mapSymbolToHl(symbol, this.marketType)
    const assetMeta = await this.getAssetMeta(rawSymbol, this.marketType)
    const quantityStepSize = this.decimalStep(assetMeta.szDecimals)
    const priceDecimals = Math.max((this.marketType === 'perp' ? 6 : 8) - assetMeta.szDecimals, 0)
    const constraintsSymbol = this.mapHlSymbolToInternal(rawSymbol, this.marketType)

    return {
      exchangeId: 'hyperliquid',
      marketType: this.marketType,
      symbol,
      rawSymbol: constraintsSymbol,
      priceTickSize: this.decimalStep(priceDecimals),
      quantityStepSize,
      minQuantity: quantityStepSize,
      contractValue: this.marketType === 'perp' ? '1' : null,
      clientOrderId: {
        maxLength: 34,
        pattern: '^0x[0-9a-f]{32}$',
      },
      raw: { rawSymbol, ...assetMeta },
    }
  }

  /**
   * 准备订单请求 - 策略模式处理不同订单类型
   */
  private async prepareOrderRequest(
    input: CreateOrderInput,
    coin: string,
    isBuy: boolean,
    marketType: MarketType,
  ): Promise<{ orderType: any; limitPx: number }> {
    if (input.type === 'market') {
      return this.prepareMarketOrder(coin, isBuy, marketType)
    }

    if (input.type === 'limit') {
      if (input.price === undefined) {
        throw new ExchangeError('Limit order requires price', 'REQUIRES_PRICE')
      }
      return {
        orderType: { limit: { tif: 'Gtc' } },
        limitPx: input.price,
      }
    }

    throw new ExchangeError(
      `Unsupported order type: ${input.type}`,
      'INVALID_ORDER_TYPE',
    )
  }

  /**
   * 准备市价单，使用 IOC 限价单实现。
   */
  private async prepareMarketOrder(
    coin: string,
    isBuy: boolean,
    marketType: MarketType,
  ): Promise<{ orderType: any; limitPx: number }> {
    const midPrice = marketType === 'spot'
      ? await this.getSpotMidPrice(coin)
      : await this.getPerpMidPrice(coin)

    if (midPrice === 0) {
      throw new ExchangeError(`Unable to get market price for ${coin}`)
    }

    // 使用配置的滑点容忍度
    const slippageFactor = 1 + (isBuy ? this.MARKET_ORDER_SLIPPAGE : -this.MARKET_ORDER_SLIPPAGE)

    return {
      orderType: { limit: { tif: 'FrontendMarket' } },
      limitPx: midPrice * slippageFactor,
    }
  }

  /**
   * 取消订单
   *
   * @param id - 订单 ID（可以是数字 oid 或 0x 开头的 clientOrderId）
   * @param symbol - 交易对 symbol
   * @returns 取消后的订单状态（包含真实的订单信息）
   * @throws {ExchangeError} 取消失败
   *
   * @remarks
   * 该方法会自动判断 id 的类型：
   * - 如果是数字或可转换为有效数字，使用 cancel 接口（按 oid 取消）
   * - 如果是 0x 开头的字符串，使用 cancelByCloid 接口（按 clientOrderId 取消）
   *
   * 为了返回准确的订单信息，该方法会先查询订单详情再执行取消操作。
   */
  async cancelOrder(id: string, symbol: string): Promise<UnifiedOrder> {
    return this.withRetry(async () => {
      const marketType = this.getMarketTypeForSymbol(symbol)
      const coin = this.mapSymbolToHl(symbol, marketType)

      // 获取资产 ID（Hyperliquid SDK 要求）
      const { assetId } = await this.getAssetMeta(coin, marketType)

      // 先查询订单详情，以便返回准确的订单信息
      let orderInfo: UnifiedOrder | null = null
      try {
        orderInfo = await this.fetchOrder(id, symbol)
      }
      catch {
        // 如果查询失败，继续取消操作，但无法返回完整信息
        // 不抛出异常，仅记录错误
      }

      // 判断 id 类型并选择合适的取消接口
      const isCloid = id.startsWith('0x')
      let response: any

      if (isCloid) {
        // 使用 cancelByCloid 接口（按 clientOrderId 取消）
        const cancelByCloidAction: any = {
          type: 'cancelByCloid',
          cancels: [{ asset: assetId, cloid: id }],
        }

        response = await this.rateLimit(async () =>
          (this.exchClient as any).cancelByCloid(cancelByCloidAction),
        )
      }
      else {
        // 验证 id 是否为有效数字
        const oid = Number(id)
        if (Number.isNaN(oid)) {
          throw new ExchangeError(
            `Invalid order ID: ${id}. Must be a valid number or 0x-prefixed clientOrderId`,
            'INVALID_ORDER_ID',
          )
        }

        // 使用 cancel 接口（按 oid 取消）
        const cancelAction: any = {
          type: 'cancel',
          cancels: [{ a: assetId, o: oid }],
        }

        response = await this.rateLimit(async () =>
          (this.exchClient as any).cancel(cancelAction),
        )
      }

      // 检查响应
      if (response.status === 'err') {
        throw new ExchangeError(`Cancel failed: ${response.response}`)
      }

      const statuses = response.response?.data?.statuses
      if (!statuses || statuses.length === 0) {
        throw new ExchangeError('No cancel status returned')
      }

      const cancelStatus = statuses[0]
      if (!cancelStatus || 'error' in cancelStatus) {
        const errorMsg = 'error' in cancelStatus ? cancelStatus.error : 'Unknown error'
        throw new ExchangeError(`Cancel failed: ${errorMsg}`)
      }

      // 返回取消后的订单状态（使用查询到的真实信息）
      if (orderInfo) {
        return {
          ...orderInfo,
          status: 'canceled',
          raw: cancelStatus,
        }
      }

      // 如果无法查询到订单信息，返回基本信息
      return {
        id,
        clientOrderId: isCloid ? id : undefined,
        symbol,
        marketType,
        side: 'buy', // 无法确定真实方向
        type: 'limit', // 无法确定真实类型
        price: 0,
        amount: 0,
        filled: 0,
        status: 'canceled',
        createdAt: Date.now(),
        raw: cancelStatus,
      }
    }, 'cancelOrder')
  }

  /**
   * 查询单个订单
   *
   * @param id - 订单 ID（可以是数字 oid 或 0x 开头的 clientOrderId）
   * @param symbol - 交易对 symbol
   * @returns 订单详情（聚合了多笔成交）
   * @throws {OrderNotFoundError} 订单不存在
   *
   * @remarks
   * 该方法会自动判断 id 的类型：
   * - 如果是数字，按 oid 查询
   * - 如果是 0x 开头的字符串，按 clientOrderId 查询
   *
   * 对于已关闭的订单，会聚合所有相同 oid/cloid 的 fill 记录。
   * 计算总成交量和加权平均价格，确保返回准确的订单信息。
   */
  async fetchOrder(id: string, symbol: string): Promise<UnifiedOrder> {
    return this.withRetry(async () => {
      const marketType = this.getMarketTypeForSymbol(symbol)
      const isCloid = id.startsWith('0x')

      // 获取用户的所有未完成订单（使用 trading 钱包地址）
      const openOrders: any = await this.infoClient.openOrders({ user: this.tradingWalletAddress })

      // 根据 id 类型查找匹配的订单
      const normalizedCoin = this.mapSymbolToHl(symbol, marketType)
      const order = openOrders.find((o: any) => {
        if (!this.matchesOrderSymbol(o.coin, normalizedCoin, marketType))
          return false
        if (isCloid) {
          return o.cloid === id
        }
        return String(o.oid) === id
      })

      if (!order) {
        // 如果在未完成订单中找不到，尝试从订单历史中查找
        const fills: any = await this.infoClient.userFills({ user: this.tradingWalletAddress })

        // 根据 id 类型查找所有匹配的 fill 记录
        const matchedFills = fills.filter((f: any) => {
          if (!this.matchesOrderSymbol(f.coin, normalizedCoin, marketType))
            return false
          if (isCloid) {
            return f.cloid === id
          }
          return String(f.oid) === id
        })

        if (matchedFills.length === 0) {
          throw new OrderNotFoundError(`Order ${id} not found`)
        }

        // 聚合所有 fill（与 fetchClosedOrders 保持一致）
        const side = matchedFills[0].side === 'B' ? 'buy' : 'sell'
        const coin = matchedFills[0].coin

        let totalSz = 0
        let totalValue = 0
        let lastTime = 0
        let clientOrderId: string | undefined
        let orderId = id // 默认使用传入的 id

        for (const fill of matchedFills) {
          totalSz += Number(fill.sz)
          totalValue += Number(fill.sz) * Number(fill.px)
          lastTime = Math.max(lastTime, fill.time)
          if (fill.cloid) {
            clientOrderId = fill.cloid
          }
          // 如果是通过 cloid 查询的，尝试获取真实 oid
          if (isCloid && fill.oid !== undefined) {
            orderId = String(fill.oid)
          }
        }

        const avgPx = totalSz > 0 ? totalValue / totalSz : 0

        return {
          id: orderId, // 优先返回真实 oid
          clientOrderId,
          symbol,
          marketType,
          side,
          // 注意：Hyperliquid fills API 不返回原始 orderType
          // 由于 Hyperliquid 的市价单本质上是 IOC 限价单，
          // 这里使用 'limit' 作为默认值，比硬编码 'market' 更准确
          type: 'limit',
          price: avgPx, // 加权平均价格
          amount: totalSz, // 总成交量
          filled: totalSz,
          status: 'closed',
          createdAt: lastTime,
          raw: { fills: matchedFills, coin },
        }
      }

      // 订单仍在队列中，需要查询已成交部分
      // Hyperliquid 的部分成交会记录在 userFills 中，即使订单还在 openOrders 里
      const fills: any = await this.infoClient.userFills({ user: this.tradingWalletAddress })

      // 根据 id 类型查找匹配的 fills
      const matchedFills = fills.filter((f: any) => {
        if (!this.matchesOrderSymbol(f.coin, normalizedCoin, marketType))
          return false
        if (isCloid) {
          return f.cloid === id
        }
        return String(f.oid) === id
      })

      // 计算已成交数量和加权平均价格
      let totalFilledSz = 0
      let totalFilledValue = 0

      for (const fill of matchedFills) {
        totalFilledSz += Number(fill.sz)
        totalFilledValue += Number(fill.sz) * Number(fill.px)
      }

      const avgFilledPx = totalFilledSz > 0 ? totalFilledValue / totalFilledSz : 0

      // 映射订单信息
      const unifiedOrder = this.mapOpenOrderToUnified(order, symbol, marketType)

      // 更新已成交信息，并根据成交情况设置正确的状态
      // 如果有部分成交但订单仍在 order book 中，状态应为 'partially_filled'
      // 这样调用方可以区分“等待首次成交”和“已部分成交”
      const status = totalFilledSz > 0 ? 'partially_filled' : 'open'

      return {
        ...unifiedOrder,
        filled: totalFilledSz,
        // 如果有成交，使用实际成交均价；否则使用挂单价格
        price: totalFilledSz > 0 ? avgFilledPx : unifiedOrder.price,
        status,
        updatedAt: Date.now(),
      }
    }, 'fetchOrder')
  }

  /**
   * 查询未完成订单
   *
   * @param symbol - 可选的交易对过滤条件
   * @returns 未完成订单列表
   */
  async fetchOpenOrders(symbol?: string): Promise<UnifiedOrder[]> {
    return this.withRetry(async () => {
      const orders: any = await this.infoClient.openOrders({ user: this.tradingWalletAddress })
      const marketType = symbol ? this.getMarketTypeForSymbol(symbol) : this.marketType
      const normalizedCoin = symbol ? this.mapSymbolToHl(symbol, marketType) : undefined

      // 如果指定了 symbol，过滤订单
      const filtered = symbol
        ? orders.filter((o: any) => this.matchesOrderSymbol(o.coin, normalizedCoin!, marketType))
        : orders.filter((o: any) => this.matchesMarketType(o.coin, marketType))

      return filtered.map((o: any) =>
        this.mapOpenOrderToUnified(
          o,
          symbol || this.mapHlSymbolToInternal(o.coin, marketType),
          marketType,
        ),
      )
    }, 'fetchOpenOrders')
  }

  /**
   * 查询历史订单
   *
   * @param symbol - 可选的交易对过滤条件
   * @returns 历史订单列表（聚合了多笔成交的完整订单）
   *
   * @remarks
   * Hyperliquid 通过 fills 接口获取成交记录。
   * 对于分多次成交的订单，该方法会按 oid 聚合所有 fill。
   * 计算总成交量和加权平均价格，确保返回的订单数据准确。
   */
  async fetchClosedOrders(symbol?: string): Promise<UnifiedOrder[]> {
    return this.withRetry(async () => {
      // Hyperliquid 通过 fills 接口获取历史成交
      const fills: any = await this.infoClient.userFills({ user: this.tradingWalletAddress })
      const marketType = symbol ? this.getMarketTypeForSymbol(symbol) : this.marketType
      const normalizedCoin = symbol ? this.mapSymbolToHl(symbol, marketType) : undefined

      // 如果指定了 symbol，过滤成交
      const filtered = symbol
        ? fills.filter((f: any) => this.matchesOrderSymbol(f.coin, normalizedCoin!, marketType))
        : fills.filter((f: any) => this.matchesMarketType(f.coin, marketType))

      // 按订单 ID 聚合所有 fill（处理分多次成交的订单）
      const orderMap = new Map<
        string,
        {
          oid: string
          coin: string
          side: string
          fills: Array<{ sz: number; px: number; time: number; cloid?: string }>
        }
      >()

      for (const fill of filtered) {
        const oid = String(fill.oid)
        if (!orderMap.has(oid)) {
          orderMap.set(oid, {
            oid,
            coin: fill.coin,
            side: fill.side,
            fills: [],
          })
        }

        const order = orderMap.get(oid)!
        order.fills.push({
          sz: Number(fill.sz),
          px: Number(fill.px),
          time: fill.time,
          cloid: fill.cloid,
        })
      }

      // 将聚合后的订单转换为统一格式
      return Array.from(orderMap.values()).map((order) => {
        const side = order.side === 'B' ? 'buy' : 'sell'
        const internalSymbol = symbol || this.mapHlSymbolToInternal(order.coin, marketType)

        // 计算总成交量和加权平均价格
        let totalSz = 0
        let totalValue = 0
        let lastTime = 0
        let clientOrderId: string | undefined

        for (const fill of order.fills) {
          totalSz += fill.sz
          totalValue += fill.sz * fill.px
          lastTime = Math.max(lastTime, fill.time)
          if (fill.cloid) {
            clientOrderId = fill.cloid
          }
        }

        const avgPx = totalSz > 0 ? totalValue / totalSz : 0

        return {
          id: order.oid,
          clientOrderId,
          symbol: internalSymbol,
          marketType,
          side,
          // 注意：Hyperliquid fills API 不返回原始 orderType
          // 由于 Hyperliquid 的市价单本质上是 IOC 限价单，
          // 这里使用 'limit' 作为默认值，比硬编码 'market' 更准确
          type: 'limit' as OrderType,
          price: avgPx, // 使用加权平均价格
          amount: totalSz,
          filled: totalSz,
          status: 'closed' as const,
          createdAt: lastTime,
          raw: order,
        }
      })
    }, 'fetchClosedOrders')
  }

  /**
   * 查询持仓
   *
   * @returns 持仓列表
   */
  async fetchPositions(): Promise<UnifiedPosition[]> {
    return this.withRetry(async () => {
      if (this.marketType === 'spot') {
        return []
      }

      const clearinghouseState: any = await this.infoClient.clearinghouseState({ user: this.tradingWalletAddress })

      if (!clearinghouseState.assetPositions) {
        return []
      }

      return clearinghouseState.assetPositions
        .filter((p: any) => {
          const size = Number(p.position?.szi || 0)
          return size !== 0 // 只返回有持仓的项
        })
        .map((p: any) => {
          const size = Number(p.position.szi)
          const side: UnifiedPosition['side'] = size > 0 ? 'long' : size < 0 ? 'short' : 'flat'
          const symbol = this.mapHlSymbolToInternal(p.position.coin, 'perp')

          return {
            symbol,
            marketType: 'perp' as MarketType,
            side,
            size: Math.abs(size),
            entryPrice: Number(p.position.entryPx || 0),
            leverage: Number(p.position.leverage?.value || 1),
            unrealizedPnl: Number(p.position.unrealizedPnl || 0),
            liquidationPrice: Number(p.position.liquidationPx || 0),
            raw: p,
          }
        })
    }, 'fetchPositions')
  }

  /**
   * 查询余额
   *
   * @returns 余额列表
   */
  async fetchBalance(): Promise<UnifiedBalance[]> {
    return this.withRetry(async () => {
      if (this.marketType === 'spot') {
        const spotState: any = await this.infoClient.spotClearinghouseState({ user: this.tradingWalletAddress })
        return (spotState?.balances ?? []).map((balance: any) => {
          const total = Number(balance.total || 0)
          const locked = Number(balance.hold || 0)

          return {
            asset: String(balance.coin).toUpperCase(),
            free: Math.max(0, total - locked),
            locked,
            total,
          }
        })
      }

      const clearinghouseState: any = await this.infoClient.clearinghouseState({ user: this.tradingWalletAddress })

      // Hyperliquid 使用 USDC 作为保证金
      const withdrawable = Number(clearinghouseState?.withdrawable || 0)
      const accountValue = Number(clearinghouseState?.marginSummary?.accountValue || 0)
      const marginUsed = accountValue - withdrawable

      return [
        {
          asset: 'USDC',
          free: Math.max(0, withdrawable),
          locked: Math.max(0, marginUsed),
          total: accountValue,
        },
      ]
    }, 'fetchBalance')
  }

  /**
   * 查询行情数据
   *
   * @param symbol - 交易对 symbol
   * @returns 行情数据（包含最新价、买卖价、24h 高低价和成交量）
   */
  async fetchTicker(symbol: string): Promise<UnifiedTicker> {
    // 检查缓存
    const cached = this.tickerCache.get(symbol)
    if (cached && Date.now() - cached.timestamp < this.TICKER_CACHE_TTL) {
      return cached.data
    }

    return this.withRetry(async () => {
      const marketType = this.getMarketTypeForSymbol(symbol)
      const coin = this.mapSymbolToHl(symbol, marketType)

      if (marketType === 'spot') {
        const ticker = await this.fetchSpotTicker(symbol, coin)
        this.tickerCache.set(symbol, { data: ticker, timestamp: Date.now() })
        return ticker
      }

      // 并行获取所有需要的数据
      const [midsResult, metaResult, candlesResult] = await Promise.allSettled([
        this.infoClient.allMids(),
        this.infoClient.meta(),
        this.infoClient.candleSnapshot({
          coin,
          interval: '1h',
          startTime: Date.now() - 24 * 60 * 60 * 1000,
          endTime: Date.now(),
        }),
      ])

      // 处理 mids 结果
      if (midsResult.status === 'rejected') {
        throw new ExchangeError(`Failed to fetch market price: ${midsResult.reason}`)
      }
      const mids = midsResult.value
      const mid = mids[coin]

      if (!mid) {
        throw new ExchangeError(`Ticker not found for ${coin}`)
      }

      // 处理 meta 结果（可选）
      const assetInfo = metaResult.status === 'fulfilled'
        ? metaResult.value.universe.find(u => u.name === coin)
        : undefined

      // 处理 candles 结果并计算 24 小时统计
      let high = Number(mid)
      let low = Number(mid)
      let volume = 0

      if (candlesResult.status === 'fulfilled' && candlesResult.value.length > 0) {
        const candles = candlesResult.value
        high = Math.max(...candles.map(c => Number(c.h)))
        low = Math.min(...candles.map(c => Number(c.l)))
        volume = candles.reduce((sum, c) => sum + Number(c.v), 0)
      }

      // 计算买卖价差
      const spread = Number(mid) * this.TICKER_SPREAD_PERCENTAGE
      const bid = Number(mid) - spread
      const ask = Number(mid) + spread

      const ticker: UnifiedTicker = {
        symbol,
        last: Number(mid),
        bid,
        ask,
        high,
        low,
        volume,
        raw: { mid, assetInfo, coin },
      }

      // 更新缓存
      this.tickerCache.set(symbol, { data: ticker, timestamp: Date.now() })

      return ticker
    }, 'fetchTicker')
  }

  // ========== 私有映射方法 ==========

  /**
   * 将内部统一 symbol 转换为 Hyperliquid 币种名称。
   *
   * @param symbol - 统一格式 symbol（如 BTC/USDT:PERP）
   * @returns Hyperliquid 币种名称（如 BTC）
   * @throws {ExchangeError} symbol 格式无效
   *
   * @example
   * ```typescript
   * mapSymbolToHl('BTC/USDT:PERP') // 返回: 'BTC'
   * mapSymbolToHl('ETH/USDT:PERP') // 返回: 'ETH'
   * ```
   */
  private mapSymbolToHl(symbol: string, marketType: MarketType): string {
    return marketType === 'spot'
      ? this.mapSymbolToHlSpot(symbol)
      : this.mapSymbolToHlPerp(symbol)
  }

  /**
   * 将 Hyperliquid 币种名称转换为内部统一 symbol。
   *
   * @param coin - Hyperliquid 币种名称（如 BTC）
   * @returns 统一格式 symbol（如 BTC/USDT:PERP）
   *
   * @example
   * ```typescript
   * mapHlSymbolToInternal('BTC') // 返回: 'BTC/USDT:PERP'
   * mapHlSymbolToInternal('ETH') // 返回: 'ETH/USDT:PERP'
   * ```
   */
  private mapHlSymbolToInternal(coin: string, marketType: MarketType): string {
    return marketType === 'spot'
      ? this.mapHlSpotSymbolToInternal(coin)
      : this.mapHlPerpSymbolToInternal(coin)
  }

  /**
   * 获取币种对应的资产 ID（asset index）。
   *
   * @param coin - 币种名称（如 BTC）
   * @returns 资产 ID
   * @throws {ExchangeError} 币种不存在
   *
   * @remarks
   * Hyperliquid SDK 要求在下单和撤单时使用资产 ID（整数）而非币种名称。
   * 该方法会缓存 meta 信息 1 小时，避免频繁请求。
   *
   * @example
   * ```typescript
   * const assetId = await this.getAssetId('BTC') // 返回: 0
   * const assetId = await this.getAssetId('ETH') // 返回: 1
   * ```
   */
  private async getAssetMeta(coin: string, marketType: MarketType): Promise<HyperliquidAssetMeta> {
    return marketType === 'spot'
      ? this.getSpotAssetMeta(coin)
      : this.getPerpAssetMeta(coin)
  }

  /**
   * 将 Hyperliquid 的未完成订单映射为统一格式。
   *
   * @param order - Hyperliquid 未完成订单对象
   * @param symbol - 统一格式 symbol
   * @returns 统一格式订单对象
   */
  private mapOpenOrderToUnified(order: any, symbol: string, marketType: MarketType): UnifiedOrder {
    const side = order.side === 'B' ? 'buy' : 'sell'
    const sz = Number(order.origSz ?? order.sz)
    const limitPx = Number(order.limitPx)

    // 判断订单类型
    let type: OrderType = 'limit'
    if (order.orderType && typeof order.orderType === 'object') {
      if ('limit' in order.orderType && order.orderType.limit.tif === 'Ioc') {
        type = 'market'
      }
    }

    return {
      id: String(order.oid),
      clientOrderId: order.cloid,
      symbol,
      marketType,
      side,
      type,
      price: limitPx,
      amount: sz,
      filled: 0, // 未完成订单的已成交数量需要从其他接口获取
      status: 'open',
      createdAt: order.timestamp,
      raw: order,
    }
  }

  /**
   * 将 Hyperliquid 的成交记录映射为统一订单格式。
   *
   * @param fill - Hyperliquid 成交记录
   * @param symbol - 统一格式 symbol
   * @returns 统一格式订单对象
   */
  private mapFillToOrder(fill: any, symbol: string, marketType: MarketType): UnifiedOrder {
    const side = fill.side === 'B' ? 'buy' : 'sell'
    const sz = Number(fill.sz)
    const px = Number(fill.px)

    return {
      id: String(fill.oid),
      clientOrderId: fill.cloid,
      symbol,
      marketType,
      side,
      type: 'market', // 已成交的订单类型难以判断，默认为市价
      price: px,
      amount: sz,
      filled: sz, // 成交记录的数量即为已成交数量
      status: 'closed',
      createdAt: fill.time,
      raw: fill,
    }
  }

  /**
   * 映射订单状态。
   *
   * @param status - Hyperliquid 订单状态
   * @returns 统一格式订单状态
   */
  private mapOrderStatus(status: any): UnifiedOrder['status'] {
    if ('error' in status) {
      return 'rejected'
    }

    if (status.filled) {
      const totalSz = Number(status.filled.totalSz)
      if (totalSz > 0 && status.resting) {
        return 'partially_filled'
      }
      if (totalSz > 0 && !status.resting) {
        return 'closed'
      }
    }

    if (status.resting) {
      return 'open'
    }

    return 'rejected'
  }

  private mapSymbolToHlPerp(symbol: string): string {
    const perpPattern = /^([A-Z0-9]+)\/[A-Z]+:PERP$/i
    const match = symbol.match(perpPattern)

    if (!match) {
      throw new ExchangeError(
        `Invalid symbol format: ${symbol}. Expected format: BASE/QUOTE:PERP`,
        'INVALID_SYMBOL',
      )
    }

    return match[1].toUpperCase()
  }

  private mapSymbolToHlSpot(symbol: string): string {
    const spotPattern = /^([A-Z0-9]+)\/([A-Z0-9]+)$/i
    const match = symbol.match(spotPattern)

    if (!match) {
      throw new ExchangeError(
        `Invalid symbol format: ${symbol}. Expected format: BASE/QUOTE`,
        'INVALID_SYMBOL',
      )
    }

    return `${match[1].toUpperCase()}/${match[2].toUpperCase()}`
  }

  private mapHlPerpSymbolToInternal(coin: string): string {
    return `${coin.toUpperCase()}/USDT:PERP`
  }

  private mapHlSpotSymbolToInternal(coin: string): string {
    return coin.toUpperCase()
  }

  private getMarketTypeForSymbol(symbol: string): MarketType {
    return symbol.includes(':PERP') ? 'perp' : 'spot'
  }

  private matchesMarketType(coin: string, marketType: MarketType): boolean {
    return marketType === 'spot' ? coin.includes('/') : !coin.includes('/')
  }

  private matchesOrderSymbol(rawCoin: string, normalizedCoin: string, marketType: MarketType): boolean {
    if (!this.matchesMarketType(rawCoin, marketType))
      return false

    return rawCoin.toUpperCase() === normalizedCoin.toUpperCase()
  }

  private async getPerpAssetMeta(coin: string): Promise<HyperliquidAssetMeta> {
    const now = Date.now()
    if (this.perpAssetMetaCache && now - this.perpAssetMetaCacheTime < this.ASSET_META_CACHE_TTL) {
      const assetMeta = this.perpAssetMetaCache.get(coin)
      if (assetMeta) {
        return assetMeta
      }
    }

    const meta: any = await this.infoClient.meta()
    const nextCache = new Map<string, HyperliquidAssetMeta>()
    for (const asset of meta?.universe ?? []) {
      if (!asset?.name) {
        continue
      }

      nextCache.set(asset.name, {
        assetId: asset.index ?? nextCache.size,
        szDecimals: Number(asset.szDecimals ?? 0),
      })
    }

    this.perpAssetMetaCache = nextCache
    this.perpAssetMetaCacheTime = now

    const assetMeta = nextCache.get(coin)
    if (!assetMeta) {
      throw new ExchangeError(`Asset ${coin} not found in Hyperliquid meta`, 'ASSET_NOT_FOUND')
    }

    return assetMeta
  }

  private async getSpotAssetMeta(symbol: string): Promise<HyperliquidAssetMeta> {
    const now = Date.now()
    if (this.spotAssetMetaCache && now - this.spotAssetMetaCacheTime < this.ASSET_META_CACHE_TTL) {
      const assetMeta = this.spotAssetMetaCache.get(symbol)
      if (assetMeta) {
        return assetMeta
      }
    }

    const meta: any = await this.infoClient.spotMeta()
    const tokenMap = new Map<number, { name: string; szDecimals: number }>()
    for (const token of meta?.tokens ?? []) {
      tokenMap.set(Number(token.index), {
        name: String(token.name).toUpperCase(),
        szDecimals: Number(token.szDecimals ?? 0),
      })
    }

    const nextCache = new Map<string, HyperliquidAssetMeta>()
    for (const market of meta?.universe ?? []) {
      if (!Array.isArray(market?.tokens) || market.tokens.length < 2) {
        continue
      }

      const baseToken = tokenMap.get(Number(market.tokens[0]))
      const quoteToken = tokenMap.get(Number(market.tokens[1]))
      if (!baseToken || !quoteToken) {
        continue
      }

      const spotSymbol = `${baseToken.name}/${quoteToken.name}`
      nextCache.set(spotSymbol, {
        assetId: 10000 + Number(market.index),
        szDecimals: baseToken.szDecimals,
        marketIndex: Number(market.index),
      })
    }

    this.spotAssetMetaCache = nextCache
    this.spotAssetMetaCacheTime = now

    const assetMeta = nextCache.get(symbol)
    if (!assetMeta) {
      throw new ExchangeError(`Asset ${symbol} not found in Hyperliquid spot meta`, 'ASSET_NOT_FOUND')
    }

    return assetMeta
  }

  private async getPerpMidPrice(coin: string): Promise<number> {
    const mids: any = await this.infoClient.allMids()
    return Number(mids?.[coin] || 0)
  }

  private async getSpotMidPrice(symbol: string): Promise<number> {
    const [meta, assetCtxs]: any = await this.infoClient.spotMetaAndAssetCtxs()
    const assetMeta = await this.getSpotAssetMeta(symbol)
    const assetCtx = assetCtxs?.[assetMeta.marketIndex ?? -1]
      ?? assetCtxs?.find((ctx: any) => String(ctx.coin).toUpperCase() === symbol.toUpperCase())

    if (!assetCtx) {
      throw new ExchangeError(`Ticker not found for ${symbol}`, 'INVALID_SYMBOL')
    }

    void meta
    return Number(assetCtx.midPx ?? assetCtx.markPx ?? 0)
  }

  private async fetchSpotTicker(symbol: string, coin: string): Promise<UnifiedTicker> {
    const [, assetCtxs]: any = await this.infoClient.spotMetaAndAssetCtxs()
    const assetMeta = await this.getSpotAssetMeta(coin)
    const assetCtx = assetCtxs?.[assetMeta.marketIndex ?? -1]
      ?? assetCtxs?.find((ctx: any) => String(ctx.coin).toUpperCase() === coin.toUpperCase())

    if (!assetCtx) {
      throw new ExchangeError(`Ticker not found for ${coin}`, 'INVALID_SYMBOL')
    }

    const last = Number(assetCtx.midPx ?? assetCtx.markPx ?? 0)
    const spread = last * this.TICKER_SPREAD_PERCENTAGE

    return {
      symbol,
      last,
      bid: Math.max(0, last - spread),
      ask: last + spread,
      high: Math.max(last, Number(assetCtx.prevDayPx ?? last)),
      low: Math.min(last, Number(assetCtx.prevDayPx ?? last)),
      volume: Number(assetCtx.dayBaseVlm ?? 0),
      raw: assetCtx,
    }
  }

  /**
   * 生成唯一的客户端订单 ID（符合 Hyperliquid SDK 要求）。
   *
   * @returns 唯一的客户端订单 ID（格式：0x + 32 个十六进制字符，16 字节）
   * @remarks
   * Hyperliquid SDK 要求 clientOrderId 必须是 0x 开头的 16 字节十六进制字符串（32 个十六进制字符）。
   * 否则会报错：
   *   "Invalid length: Expected 34 but received 66 at action.cancels.0.cloid"
   * 其中 34 = 2（0x 前缀）+ 32（十六进制字符个数）。
   * 因此这里使用 crypto.randomBytes(16) 生成 16 字节随机数。
   * 用于确保订单幂等性，防止重复下单。
   *
   * @example
   * ```typescript
   * generateClientOrderId()
   * // 返回: '0x1234567890abcdef1234567890abcdef'
   * //       (0x + 32 个十六进制字符 = 34 个字符，代表 16 字节)
   * ```
   */
  private generateClientOrderId(): string {
    // 生成真正的 16 字节随机数据 = 32 个十六进制字符
    const buf = randomBytes(16)
    return `0x${buf.toString('hex')}`
  }

  private decimalStep(decimals: number): string {
    if (decimals <= 0) return '1'
    return `0.${'0'.repeat(decimals - 1)}1`
  }
}
