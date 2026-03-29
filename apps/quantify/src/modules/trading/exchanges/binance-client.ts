import type {
  CreateOrderInput,
  MarketType,
  OrderType,
  TimeInForce,
  UnifiedBalance,
  UnifiedOrder,
  UnifiedPosition,
  UnifiedTicker,
} from '../core/types'
import type { BinanceConfig } from '../factory/account-store'
import { createHmac } from 'node:crypto'
import { AuthError, ExchangeError } from '../core/errors'
import { BaseCexClient } from './base-cex-client'

type HttpMethod = 'GET' | 'POST' | 'DELETE'

interface BinanceOrderResponse {
  orderId: number
  clientOrderId: string
  status: string
  executedQty: string
  origQty: string
  price: string
  avgPrice?: string
  side: string
  type: string
  symbol: string
  cummulativeQuoteQty?: string
  updateTime?: number
  time?: number
  transactTime?: number
}

interface BinanceAccountBalance {
  asset: string
  free: string
  locked: string
}

interface BinanceSpotAccountResponse {
  balances: BinanceAccountBalance[]
}

interface BinanceFuturesBalance {
  asset: string
  balance: string
  availableBalance: string
}

interface BinancePositionRisk {
  symbol: string
  positionAmt: string
  entryPrice: string
  leverage: string
  unRealizedProfit: string
  liquidationPrice: string
}

export class BinanceClient extends BaseCexClient {
  private readonly apiKey: string

  private readonly secret: string

  private readonly recvWindow: number

  constructor(
    marketType: MarketType,
    private readonly config: BinanceConfig,
  ) {
    const baseUrl = BinanceClient.resolveBaseUrl(marketType, config)
    super(baseUrl, marketType)

    this.apiKey = config.apiKey
    this.secret = config.secret
    this.recvWindow = config.recvWindow ?? 5000
  }

  async init(): Promise<void> {
    await this.ping()
  }

  async ping(): Promise<void> {
    const path = this.marketType === 'spot' ? '/api/v3/ping' : '/fapi/v1/ping'
    await this.request('GET', path)
  }

  async createOrder(input: CreateOrderInput): Promise<UnifiedOrder> {
    const symbol = this.toExchangeSymbol(input.symbol, input.marketType)
    const side = input.side.toUpperCase()
    const type = this.mapOrderType(input.type)

    const params: Record<string, unknown> = {
      symbol,
      side,
      type,
      quantity: this.toFixed(input.amount),
    }

    if (type === 'LIMIT') {
      if (input.price === undefined) {
        throw new ExchangeError('Limit order requires price')
      }

      params.price = this.toFixed(input.price)
      params.timeInForce = this.mapTimeInForce(input.timeInForce)
    }

    if (input.clientOrderId) {
      params.newClientOrderId = input.clientOrderId
    }

    if (input.reduceOnly && this.marketType === 'perp') {
      params.reduceOnly = true
    }

    const path = this.marketType === 'spot' ? '/api/v3/order' : '/fapi/v1/order'

    const res = await this.request<BinanceOrderResponse>('POST', path, params, true)

    const createdAt = res.updateTime ?? Date.now()
    const resolvedPrice = this.resolveOrderPrice(res, input.price)

    return {
      id: String(res.orderId),
      clientOrderId: res.clientOrderId,
      symbol: input.symbol,
      marketType: input.marketType,
      side: input.side,
      type: input.type,
      price: resolvedPrice,
      amount: Number.parseFloat(res.origQty),
      filled: Number.parseFloat(res.executedQty),
      status: this.mapOrderStatus(res.status),
      createdAt,
      updatedAt: res.updateTime,
      raw: res,
    }
  }

  async cancelOrder(id: string, symbol: string): Promise<UnifiedOrder> {
    const rawSymbol = this.toExchangeSymbol(symbol, this.marketType)
    const path = this.marketType === 'spot' ? '/api/v3/order' : '/fapi/v1/order'
    const params: Record<string, unknown> = { symbol: rawSymbol, orderId: id }

    const res = await this.request<BinanceOrderResponse>('DELETE', path, params, true)

    const createdAt = res.updateTime ?? Date.now()
    const resolvedPrice = this.resolveOrderPrice(res)

    return {
      id: String(res.orderId),
      clientOrderId: res.clientOrderId,
      symbol,
      marketType: this.marketType,
      side: res.side?.toLowerCase() === 'sell' ? 'sell' : 'buy',
      type: this.reverseMapOrderType(res.type as OrderType),
      price: resolvedPrice,
      amount: Number.parseFloat(res.origQty),
      filled: Number.parseFloat(res.executedQty),
      status: this.mapOrderStatus(res.status),
      createdAt,
      updatedAt: res.updateTime,
      raw: res,
    }
  }

  async fetchOrder(id: string, symbol: string): Promise<UnifiedOrder> {
    const rawSymbol = this.toExchangeSymbol(symbol, this.marketType)
    const path = this.marketType === 'spot' ? '/api/v3/order' : '/fapi/v1/order'
    const params: Record<string, unknown> = { symbol: rawSymbol, orderId: id }

    const res = await this.request<BinanceOrderResponse>('GET', path, params, true)

    const createdAt = res.updateTime ?? Date.now()
    const resolvedPrice = this.resolveOrderPrice(res)

    return {
      id: String(res.orderId),
      clientOrderId: res.clientOrderId,
      symbol,
      marketType: this.marketType,
      side: res.side?.toLowerCase() === 'sell' ? 'sell' : 'buy',
      type: this.reverseMapOrderType(res.type as OrderType),
      price: resolvedPrice,
      amount: Number.parseFloat(res.origQty),
      filled: Number.parseFloat(res.executedQty),
      status: this.mapOrderStatus(res.status),
      createdAt,
      updatedAt: res.updateTime,
      raw: res,
    }
  }

  async fetchOpenOrders(symbol?: string): Promise<UnifiedOrder[]> {
    const path = this.marketType === 'spot' ? '/api/v3/openOrders' : '/fapi/v1/openOrders'
    const params: Record<string, unknown> = {}

    if (symbol) {
      params.symbol = this.toExchangeSymbol(symbol, this.marketType)
    }

    const res = await this.request<BinanceOrderResponse[]>('GET', path, params, true)

    return res.map(order => this.mapOrderFromResponse(order, symbol ?? this.fromExchangeSymbol(order.symbol)))
  }

  async fetchClosedOrders(symbol?: string): Promise<UnifiedOrder[]> {
    if (!symbol) {
      // Binance /api/v3/allOrders 和 /fapi/v1/allOrders 都要求 symbol 为必填参数
      throw new ExchangeError('Binance fetchClosedOrders requires symbol parameter', 'MISSING_SYMBOL')
    }

    const path = this.marketType === 'spot' ? '/api/v3/allOrders' : '/fapi/v1/allOrders'
    const params: Record<string, unknown> = {
      symbol: this.toExchangeSymbol(symbol, this.marketType),
    }

    const res = await this.request<BinanceOrderResponse[]>('GET', path, params, true)

    return res
      .filter(order => order.status !== 'NEW' && order.status !== 'PARTIALLY_FILLED')
      .map(order => this.mapOrderFromResponse(order, symbol ?? this.fromExchangeSymbol(order.symbol)))
  }

  async fetchPositions(): Promise<UnifiedPosition[]> {
    if (this.marketType === 'spot') {
      return []
    }

    const positions = await this.request<BinancePositionRisk[]>('GET', '/fapi/v2/positionRisk', {}, true)

    return positions
      .filter(p => Number.parseFloat(p.positionAmt) !== 0)
      .map(p => {
        const size = Number.parseFloat(p.positionAmt)
        const side: UnifiedPosition['side'] = size > 0 ? 'long' : 'short'
        const symbol = this.fromExchangeSymbol(p.symbol)

        return {
          symbol,
          marketType: 'perp',
          side,
          size: Math.abs(size),
          entryPrice: Number.parseFloat(p.entryPrice),
          leverage: Number.parseFloat(p.leverage),
          unrealizedPnl: Number.parseFloat(p.unRealizedProfit),
          liquidationPrice: Number.parseFloat(p.liquidationPrice),
          raw: p,
        }
      })
  }

  async fetchBalance(): Promise<UnifiedBalance[]> {
    if (this.marketType === 'spot') {
      const res = await this.request<BinanceSpotAccountResponse>('GET', '/api/v3/account', {}, true)
      return res.balances.map(b => {
        const free = Number.parseFloat(b.free)
        const locked = Number.parseFloat(b.locked)
        return {
          asset: b.asset,
          free,
          locked,
          total: free + locked,
        }
      })
    }

    const res = await this.request<BinanceFuturesBalance[]>('GET', '/fapi/v2/balance', {}, true)

    return res.map(b => {
      const total = Number.parseFloat(b.balance)
      const free = Number.parseFloat(b.availableBalance)
      const locked = total - free
      return {
        asset: b.asset,
        free,
        locked,
        total,
      }
    })
  }

  async fetchTicker(symbol: string): Promise<UnifiedTicker> {
    const rawSymbol = this.toExchangeSymbol(symbol, this.marketType)
    const path = this.marketType === 'spot' ? '/api/v3/ticker/24hr' : '/fapi/v1/ticker/24hr'
    const params: Record<string, unknown> = { symbol: rawSymbol }

    // Binance 现货与合约 24hr ticker 结构基本兼容
    const res = await this.request<{
      lastPrice: string
      bidPrice: string
      askPrice: string
      highPrice: string
      lowPrice: string
      volume: string
    }>('GET', path, params)

    return {
      symbol,
      last: Number.parseFloat(res.lastPrice),
      bid: Number.parseFloat(res.bidPrice),
      ask: Number.parseFloat(res.askPrice),
      high: Number.parseFloat(res.highPrice),
      low: Number.parseFloat(res.lowPrice),
      volume: Number.parseFloat(res.volume),
      raw: res,
    }
  }

  protected async signRequest(
    method: HttpMethod,
    path: string,
    params: Record<string, unknown>,
    isPrivate: boolean,
    body?: unknown,
  ): Promise<{ url: string; headers: Record<string, string>; body?: string }> {
    const headers: Record<string, string> = {}

    if (!isPrivate) {
      const query = this.buildQuery(params)
      const url = query ? `${path}?${query}` : path
      return { url, headers }
    }

    if (!this.apiKey || !this.secret) {
      throw new AuthError('Binance apiKey/secret missing')
    }

    const timestamp = Date.now()
    const fullParams: Record<string, unknown> = {
      ...params,
      timestamp,
      recvWindow: this.recvWindow,
    }
    const query = this.buildQuery(fullParams)

    const signature = createHmac('sha256', this.secret)
      .update(query)
      .digest('hex')

    const url = `${path}?${query}&signature=${signature}`

    headers['X-MBX-APIKEY'] = this.apiKey

    const bodyString = body !== undefined ? JSON.stringify(body) : undefined

    return { url, headers, body: bodyString }
  }

  protected mapError(status: number, data: unknown): ExchangeError {
    if (typeof data === 'object' && data !== null) {
      const record = data as Record<string, unknown>
      const code = typeof record.code === 'number' || typeof record.code === 'string' ? String(record.code) : undefined
      const message = typeof record.msg === 'string' ? record.msg : `Binance request failed with status ${status}`
      const messageLower = message.toLowerCase()

      // -2015 在 Binance 侧可能是 key/secret、IP 白名单、权限等混合问题，需要结合消息细分
      if (code === '-2015') {
        if (messageLower.includes('ip') || message.includes('白名单')) {
          return new AuthError('IP地址未加入白名单，请在币安API管理页面添加服务器IP或取消IP限制', data)
        }
        if (messageLower.includes('permission') || message.includes('权限')) {
          return new AuthError('API Key权限不足，请确保开启"读取"和"交易"权限', data)
        }
        if (messageLower.includes('disabled') || messageLower.includes('delete')) {
          return new AuthError('API Key已被禁用，请在币安API管理页面检查状态', data)
        }
        return new AuthError('API Key或Secret错误，请检查是否正确复制（不要有多余空格）', data)
      }

      // API Key 和 Secret 错误
      if (code === '-2014') {
        return new AuthError('API Key或Secret错误，请检查是否正确复制（不要有多余空格）', data)
      }

      // 签名无效（-1022 可能是签名错误或 IP 限制，需要检查消息内容）
      if (code === '-1022') {
        if (messageLower.includes('ip')) {
          return new AuthError('IP地址未加入白名单，请在币安API管理页面添加服务器IP或取消IP限制', data)
        }
        return new AuthError('API签名验证失败，请检查 API Secret 是否正确', data)
      }

      // 权限不足
      if (messageLower.includes('permission') || message.includes('权限')) {
        return new AuthError('API Key权限不足，请确保开启"读取"和"交易"权限', data)
      }

      // API Key 被禁用/删除
      if (messageLower.includes('disabled') || messageLower.includes('delete')) {
        return new AuthError('API Key已被禁用，请在币安API管理页面检查状态', data)
      }

      return new ExchangeError(message, code, data)
    }

    return super.mapError(status, data)
  }

  private buildQuery(params: Record<string, unknown>): string {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue
      searchParams.set(key, String(value))
    }
    return searchParams.toString()
  }

  private toExchangeSymbol(symbol: string, marketType: MarketType): string {
    if (marketType === 'spot') {
      // BTC/USDT -> BTCUSDT
      return symbol.replace('/', '')
    }
    // perp: BTC/USDT:PERP -> BTCUSDT
    const withoutPerp = symbol.includes(':') ? symbol.split(':')[0] : symbol
    return withoutPerp.replace('/', '')
  }

  private fromExchangeSymbol(rawSymbol: string): string {
    /**
     * 将 Binance 原始 symbol（如 BTCUSDT、ETHBTC、SOLFDUSD）转换为统一格式。
     * - 现货: BASE/QUOTE
     * - 永续: BASE/QUOTE:PERP
     *
     * 这里使用常见报价币列表进行拆分，未命中的情况明确抛出异常。
     * 避免产生下游调用方无法解析的“假统一 symbol”。
     */
    const knownQuotes = [
      'USDT',
      'USDC',
      'FDUSD',
      'TUSD',
      'BUSD',
      'BTC',
      'BNB',
      'ETH',
      'EUR',
      'TRY',
      'BRL',
    ]

    for (const quote of knownQuotes) {
      if (rawSymbol.endsWith(quote)) {
        const base = rawSymbol.slice(0, -quote.length)
        if (!base) {
          break
        }
        const unified = `${base}/${quote}`
        return this.marketType === 'perp' ? `${unified}:PERP` : unified
      }
    }

    throw new ExchangeError(`Unsupported Binance symbol format: ${rawSymbol}`)
  }

  private mapOrderType(type: OrderType): string {
    switch (type) {
      case 'limit':
        return 'LIMIT'
      case 'market':
        return 'MARKET'
      default:
        throw new ExchangeError(`Unsupported Binance order type: ${type}`)
    }
  }

  /**
   * 将 Binance 的订单类型字符串映射为统一的 OrderType。
   *
   * 仅支持一小部分常见类型；对未知类型直接抛出 ExchangeError。
   * 避免静默误判。
   */
  private reverseMapOrderType(type: string): OrderType {
    const upper = type.toUpperCase()
    if (upper === 'LIMIT') return 'limit'
    if (upper === 'MARKET') return 'market'
    if (upper === 'STOP' || upper === 'STOP_MARKET' || upper === 'TAKE_PROFIT' || upper === 'TAKE_PROFIT_MARKET') {
      return 'stop'
    }
    if (upper === 'STOP_LOSS' || upper === 'STOP_LOSS_LIMIT') {
      return 'stop_limit'
    }

    throw new ExchangeError(`Unsupported Binance order type: ${type}`)
  }

  private mapOrderSide(side: string): 'buy' | 'sell' {
    const upper = side.toUpperCase()
    if (upper === 'BUY') return 'buy'
    if (upper === 'SELL') return 'sell'
    throw new ExchangeError(`Unsupported Binance order side: ${side}`)
  }

  private mapTimeInForce(tif?: TimeInForce): string {
    if (!tif) return 'GTC'
    return tif.toUpperCase()
  }

  private mapOrderStatus(status: string): UnifiedOrder['status'] {
    switch (status) {
      case 'NEW':
        return 'open'
      case 'PARTIALLY_FILLED':
        return 'partially_filled'
      case 'FILLED':
        return 'closed'
      case 'CANCELED':
      case 'PENDING_CANCEL':
        return 'canceled'
      case 'REJECTED':
        return 'rejected'
      // 以下状态在 Binance 中表示订单已不再处于活跃状态
      case 'EXPIRED':
      case 'EXPIRED_IN_MATCH':
      case 'STOPPED':
      case 'PARTIALLY_CANCELED':
        return 'canceled'
      case 'CALCULATED':
        return 'closed'
      // 由保险/ADL 系统新建的订单，显式标记为 open，便于下游调用方区分
      case 'NEW_INSURANCE':
      case 'NEW_ADL':
        return 'open'
      default:
        // 对于未知状态，宁可视为 rejected，也不要错误地展示为 open，避免“幽灵订单”。
        return 'rejected'
    }
  }

  private mapOrderFromResponse(order: BinanceOrderResponse, symbol: string): UnifiedOrder {
    // 优先使用交易所提供的时间戳：time > transactTime > updateTime > Date.now()
    const createdAt = order.time ?? order.transactTime ?? order.updateTime ?? Date.now()
    const resolvedPrice = this.resolveOrderPrice(order)

    return {
      id: order.orderId.toString(),
      clientOrderId: order.clientOrderId,
      symbol,
      marketType: this.marketType,
      side: this.mapOrderSide(order.side),
      type: this.reverseMapOrderType(order.type),
      status: this.mapOrderStatus(order.status),
      price: resolvedPrice,
      amount: Number.parseFloat(order.origQty),
      filled: Number.parseFloat(order.executedQty),
      createdAt,
      updatedAt: order.updateTime ?? createdAt,
      raw: order,
    }
  }

  private resolveOrderPrice(order: BinanceOrderResponse, fallbackPrice?: number): number {
    const directPrice = Number.parseFloat(order.price)
    if (Number.isFinite(directPrice) && directPrice > 0) {
      return directPrice
    }

    const avgPrice = Number.parseFloat(order.avgPrice ?? '')
    if (Number.isFinite(avgPrice) && avgPrice > 0) {
      return avgPrice
    }

    const executedQuantity = Number.parseFloat(order.executedQty)
    const executedQuote = Number.parseFloat(order.cummulativeQuoteQty ?? '')
    if (
      Number.isFinite(executedQuantity)
      && executedQuantity > 0
      && Number.isFinite(executedQuote)
      && executedQuote > 0
    ) {
      return executedQuote / executedQuantity
    }

    if (typeof fallbackPrice === 'number' && Number.isFinite(fallbackPrice) && fallbackPrice > 0) {
      return fallbackPrice
    }

    return 0
  }

  private toFixed(value: number, digits = 8): string {
    return Number(value).toFixed(digits)
  }

  private static resolveBaseUrl(marketType: MarketType, config: BinanceConfig): string {
    if (config.isTestnet) {
      // Binance 官方测试网
      // - 现货: https://testnet.binance.vision
      // - USDT 永续: https://testnet.binancefuture.com
      return marketType === 'spot'
        ? 'https://testnet.binance.vision'
        : 'https://testnet.binancefuture.com'
    }

    return marketType === 'spot'
      ? 'https://api.binance.com'
      : 'https://fapi.binance.com'
  }
}
