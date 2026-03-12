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

    return {
      id: String(res.orderId),
      clientOrderId: res.clientOrderId,
      symbol: input.symbol,
      marketType: input.marketType,
      side: input.side,
      type: input.type,
      price: Number.parseFloat(res.price || (input.price ?? 0).toString()),
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

    return {
      id: String(res.orderId),
      clientOrderId: res.clientOrderId,
      symbol,
      marketType: this.marketType,
      side: res.side?.toLowerCase() === 'sell' ? 'sell' : 'buy',
      type: this.reverseMapOrderType(res.type as OrderType),
      price: Number.parseFloat(res.price),
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

    return {
      id: String(res.orderId),
      clientOrderId: res.clientOrderId,
      symbol,
      marketType: this.marketType,
      side: res.side?.toLowerCase() === 'sell' ? 'sell' : 'buy',
      type: this.reverseMapOrderType(res.type as OrderType),
      price: Number.parseFloat(res.price),
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
      // Binance /api/v3/allOrders 涓?/fapi/v1/allOrders 閮借姹?symbol 涓哄繀濉弬鏁?
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

    // Binance 鐜拌揣涓庡悎绾?24hr ticker 缁撴瀯鍩烘湰鍏煎
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

      // API Key 鎴?Secret 閿欒
      if (code === '-2015' || code === '-2014') {
        return new AuthError('API Key鎴朣ecret閿欒锛岃妫€鏌ユ槸鍚︽纭鍒讹紙涓嶈鏈夊浣欑┖鏍硷級', data)
      }

      // 绛惧悕鏃犳晥锛?1022 鍙兘鏄鍚嶉敊璇垨IP闄愬埗锛岄渶瑕佹鏌ユ秷鎭唴瀹癸級
      if (code === '-1022') {
        if (messageLower.includes('ip')) {
          return new AuthError('IP鍦板潃鏈姞鍏ョ櫧鍚嶅崟锛岃鍦ㄥ竵瀹堿PI绠＄悊椤甸潰娣诲姞鏈嶅姟鍣↖P鎴栧彇娑圛P闄愬埗', data)
        }
        return new AuthError('API绛惧悕楠岃瘉澶辫触锛岃妫€鏌PI Secret鏄惁姝ｇ‘', data)
      }

      // 鏉冮檺涓嶈冻
      if (messageLower.includes('permission') || message.includes('鏉冮檺')) {
        return new AuthError('API Key鏉冮檺涓嶈冻锛岃纭繚寮€鍚?璇诲彇"鍜?浜ゆ槗"鏉冮檺', data)
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
     * 灏?Binance 鍘熷 symbol锛堝 BTCUSDT銆丒THBTC銆丼OLFDUSD锛夎浆鎹负缁熶竴鏍煎紡锛?
     * - 鐜拌揣: BASE/QUOTE
     * - 姘哥画: BASE/QUOTE:PERP
     *
     * 杩欓噷浣跨敤甯歌鎶ヤ环甯佸垪琛ㄨ繘琛屾媶鍒嗭紝鏈懡涓殑鎯呭喌鏄庣‘鎶涘嚭寮傚父锛?
     * 閬垮厤浜х敓涓嬫父璋冪敤鏂规棤娉曡В鏋愮殑鈥滃亣缁熶竴 symbol鈥濄€?
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
   * 灏?Binance 鐨勮鍗曠被鍨嬪瓧绗︿覆鏄犲皠涓虹粺涓€鐨?OrderType銆?
   *
   * 浠呮敮鎸佷竴灏忛儴鍒嗗父瑙佺被鍨嬶紱瀵规湭鐭ョ被鍨嬬洿鎺ユ姏鍑?ExchangeError锛?
   * 閬垮厤闈欓粯璇垽銆?
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
      // 浠ヤ笅鐘舵€佸湪 Binance 涓〃绀鸿鍗曞凡涓嶅啀澶勪簬娲昏穬鐘舵€?
      case 'EXPIRED':
      case 'EXPIRED_IN_MATCH':
      case 'STOPPED':
      case 'PARTIALLY_CANCELED':
        return 'canceled'
      case 'CALCULATED':
        return 'closed'
      // 鐢变繚闄?ADL 绯荤粺鏂板缓鐨勮鍗曪紝鏄惧紡鏍囪涓?open锛屼究浜庝笅娓歌皟鐢ㄦ柟鍖哄垎
      case 'NEW_INSURANCE':
      case 'NEW_ADL':
        return 'open'
      default:
        // 瀵逛簬鏈煡鐘舵€侊紝瀹佸彲瑙嗕负 rejected锛岃€屼笉鏄敊璇湴灞曠ず涓?open 閬垮厤鈥滃菇鐏佃鍗曗€?
        return 'rejected'
    }
  }

  private mapOrderFromResponse(order: BinanceOrderResponse, symbol: string): UnifiedOrder {
    // 浼樺厛浣跨敤浜ゆ槗鎵€鎻愪緵鐨勬椂闂存埑锛歵ime > transactTime > updateTime > Date.now()
    const createdAt = order.time ?? order.transactTime ?? order.updateTime ?? Date.now()

    return {
      id: order.orderId.toString(),
      clientOrderId: order.clientOrderId,
      symbol,
      marketType: this.marketType,
      side: this.mapOrderSide(order.side),
      type: this.reverseMapOrderType(order.type),
      status: this.mapOrderStatus(order.status),
      price: Number.parseFloat(order.price),
      amount: Number.parseFloat(order.origQty),
      filled: Number.parseFloat(order.executedQty),
      createdAt,
      updatedAt: order.updateTime ?? createdAt,
      raw: order,
    }
  }

  private toFixed(value: number, digits = 8): string {
    return Number(value).toFixed(digits)
  }

  private static resolveBaseUrl(marketType: MarketType, config: BinanceConfig): string {
    if (config.isTestnet) {
      // Binance 瀹樻柟娴嬭瘯缃?
      // - 鐜拌揣: https://testnet.binance.vision
      // - USDT 姘哥画: https://testnet.binancefuture.com
      return marketType === 'spot'
        ? 'https://testnet.binance.vision'
        : 'https://testnet.binancefuture.com'
    }

    return marketType === 'spot'
      ? 'https://api.binance.com'
      : 'https://fapi.binance.com'
  }
}
