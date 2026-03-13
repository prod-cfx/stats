import type {
  CreateOrderInput,
  MarketType,
  OrderType,
  UnifiedBalance,
  UnifiedOrder,
  UnifiedPosition,
  UnifiedTicker,
} from '../core/types'
import type { OkxConfig } from '../factory/account-store'
import { createHmac } from 'node:crypto'
import { AuthError, ExchangeError } from '../core/errors'
import { BaseCexClient } from './base-cex-client'

type HttpMethod = 'GET' | 'POST' | 'DELETE'

interface OkxOrderResponse {
  ordId: string
  clOrdId?: string
  instId: string
  state: string
  side: string
  ordType: string
  fillSz: string
  sz: string
  px?: string
  avgPx?: string
  uTime?: string
  cTime?: string
}

interface OkxBalanceItem {
  ccy: string
  availEq: string
  eq: string
}

interface OkxBalanceSnapshot {
  details?: OkxBalanceItem[]
  ccy?: string
  availEq?: string
  eq?: string
}

interface OkxBalanceResponse {
  data: OkxBalanceSnapshot[]
}

interface OkxPositionItem {
  instId: string
  instType: string
  mgnMode: string
  posSide: string
  pos: string
  avgPx: string
  lever: string
  upl: string
  liqPx: string
}

export class OkxClient extends BaseCexClient {
  private readonly apiKey: string

  private readonly secret: string

  private readonly passphrase: string

  private readonly useUnifiedAccount: boolean

  constructor(
    marketType: MarketType,
    private readonly config: OkxConfig,
  ) {
    super('https://www.okx.com', marketType)
    this.apiKey = config.apiKey
    this.secret = config.secret
    this.passphrase = config.passphrase
    this.useUnifiedAccount = config.useUnifiedAccount ?? true
  }

  async init(): Promise<void> {
    await this.ping()
  }

  async ping(): Promise<void> {
    await this.request('GET', '/api/v5/public/time')
  }

  async createOrder(input: CreateOrderInput): Promise<UnifiedOrder> {
    const instId = this.toInstrumentId(input.symbol, input.marketType)
    const instType = this.marketType === 'spot' ? 'SPOT' : 'SWAP'

    const ordType = this.mapOrderType(input.type)

    const body: Record<string, unknown> = {
      instId,
      instType,
      side: input.side,
      ordType,
      sz: this.toSize(input.amount),
    }

    if (ordType === 'limit') {
      if (input.price === undefined) {
        throw new ExchangeError('Limit order requires price')
      }
      body.px = this.toPrice(input.price)
    }

    // OKX 所有产品都需要 tdMode：现货使用 'cash'，永续默认 'cross'（可通过 extra 覆盖）
    if (this.marketType === 'perp') {
      body.tdMode = (input.extra?.tdMode as string | undefined) ?? 'cross'
    }
    else {
      body.tdMode = 'cash'
    }

    if (input.clientOrderId) {
      body.clOrdId = input.clientOrderId
    }

    const res = await this.request<{ data: OkxOrderResponse[] }>(
      'POST',
      '/api/v5/trade/order',
      {},
      true,
      body,
    )

    const order = res.data[0]
    if (!order) {
      throw new ExchangeError('OKX createOrder returned empty response', undefined, res)
    }
    const createdAt = order.cTime ? Number.parseInt(order.cTime, 10) : Date.now()
    const updatedAt = order.uTime ? Number.parseInt(order.uTime, 10) : undefined

    return {
      id: order.ordId,
      clientOrderId: order.clOrdId,
      symbol: input.symbol,
      marketType: input.marketType,
      side: input.side,
      type: input.type,
      // 以交易所实际接收的价格和数量为准，保证与后续查询/取消路径一致
      price: order.px ? Number.parseFloat(order.px) : input.price,
      amount: order.sz ? Number.parseFloat(order.sz) : input.amount,
      filled: Number.parseFloat(order.fillSz ?? '0'),
      status: this.mapOrderStatus(order.state),
      createdAt,
      updatedAt,
      raw: order,
    }
  }

  async cancelOrder(id: string, symbol: string): Promise<UnifiedOrder> {
    const instId = this.toInstrumentId(symbol, this.marketType)
    const body: Record<string, unknown> = { instId, ordId: id }

    const res = await this.request<{ data: OkxOrderResponse[] }>(
      'POST',
      '/api/v5/trade/cancel-order',
      {},
      true,
      body,
    )

    const order = res.data[0]
    const createdAt = order.cTime ? Number.parseInt(order.cTime, 10) : Date.now()
    const updatedAt = order.uTime ? Number.parseInt(order.uTime, 10) : undefined

    return {
      id: order.ordId,
      clientOrderId: order.clOrdId,
      symbol,
      marketType: this.marketType,
      side: order.side === 'sell' ? 'sell' : 'buy',
      type: this.reverseMapOrderType(order.ordType),
      price: order.px ? Number.parseFloat(order.px) : undefined,
      amount: Number.parseFloat(order.sz),
      filled: Number.parseFloat(order.fillSz ?? '0'),
      status: this.mapOrderStatus(order.state),
      createdAt,
      updatedAt,
      raw: order,
    }
  }

  async fetchOrder(id: string, symbol: string): Promise<UnifiedOrder> {
    const instId = this.toInstrumentId(symbol, this.marketType)
    const params: Record<string, unknown> = { instId, ordId: id }

    const res = await this.request<{ data: OkxOrderResponse[] }>(
      'GET',
      '/api/v5/trade/order',
      params,
      true,
    )

    const order = res.data[0]
    const createdAt = order.cTime ? Number.parseInt(order.cTime, 10) : Date.now()
    const updatedAt = order.uTime ? Number.parseInt(order.uTime, 10) : undefined

    return {
      id: order.ordId,
      clientOrderId: order.clOrdId,
      symbol,
      marketType: this.marketType,
      side: order.side === 'sell' ? 'sell' : 'buy',
      type: this.reverseMapOrderType(order.ordType),
      price: order.px ? Number.parseFloat(order.px) : undefined,
      amount: Number.parseFloat(order.sz),
      filled: Number.parseFloat(order.fillSz ?? '0'),
      status: this.mapOrderStatus(order.state),
      createdAt,
      updatedAt,
      raw: order,
    }
  }

  async fetchOpenOrders(symbol?: string): Promise<UnifiedOrder[]> {
    const params: Record<string, unknown> = {}

    if (symbol) {
      params.instId = this.toInstrumentId(symbol, this.marketType)
    }

    const res = await this.request<{ data: OkxOrderResponse[] }>(
      'GET',
      '/api/v5/trade/orders-pending',
      params,
      true,
    )

    return res.data.map(order => this.mapOrderFromResponse(order, symbol ?? this.fromInstrumentId(order.instId)))
  }

  async fetchClosedOrders(symbol?: string): Promise<UnifiedOrder[]> {
    const params: Record<string, unknown> = {}

    if (symbol) {
      params.instId = this.toInstrumentId(symbol, this.marketType)
    }

    const res = await this.request<{ data: OkxOrderResponse[] }>(
      'GET',
      '/api/v5/trade/orders-history',
      params,
      true,
    )

    return res.data
      .filter(order => order.state !== 'live' && order.state !== 'partially_filled')
      .map(order => this.mapOrderFromResponse(order, symbol ?? this.fromInstrumentId(order.instId)))
  }

  async fetchPositions(): Promise<UnifiedPosition[]> {
    if (this.marketType === 'spot') {
      return []
    }

    const res = await this.request<{ data: OkxPositionItem[] }>(
      'GET',
      '/api/v5/account/positions',
      { instType: 'SWAP' },
      true,
    )

    return res.data
      .filter(p => p.instType === 'SWAP' && p.pos !== '0')
      .map(p => {
        const symbol = this.fromInstrumentId(p.instId)
        const size = Number.parseFloat(p.pos)
        const side: UnifiedPosition['side'] =
          p.posSide === 'long' ? 'long' : p.posSide === 'short' ? 'short' : size >= 0 ? 'long' : 'short'

        return {
          symbol,
          marketType: 'perp',
          side,
          size: Math.abs(size),
          entryPrice: Number.parseFloat(p.avgPx),
          leverage: Number.parseFloat(p.lever),
          unrealizedPnl: Number.parseFloat(p.upl),
          liquidationPrice: Number.parseFloat(p.liqPx),
          raw: p,
        }
      })
  }

  async fetchBalance(): Promise<UnifiedBalance[]> {
    const res = await this.request<OkxBalanceResponse>(
      'GET',
      '/api/v5/account/balance',
      {},
      true,
    )

    // OKX 响应格式：data: [{ details: [...] }] 或少数情况下扁平结构
    const items = res.data.flatMap((snapshot) => {
      if (snapshot.details?.length) {
        return snapshot.details
      }
      if (snapshot.ccy) {
        return [
          {
            ccy: snapshot.ccy,
            availEq: snapshot.availEq ?? '0',
            eq: snapshot.eq ?? '0',
          },
        ]
      }
      return []
    })

    return items
      .filter(b => b.ccy) // 过滤掉无效币种
      .map((b) => {
        const total = Number.parseFloat(b.eq) || 0
        const free = Number.parseFloat(b.availEq) || 0
        const locked = total - free
        return {
          asset: b.ccy,
          free,
          locked,
          total,
        }
      })
  }

  async fetchTicker(symbol: string): Promise<UnifiedTicker> {
    const instId = this.toInstrumentId(symbol, this.marketType)
    const res = await this.request<{ data: Array<{
      instId: string
      last: string
      bidPx: string
      askPx: string
      high24h: string
      low24h: string
      vol24h: string
    }> }>(
      'GET',
      '/api/v5/market/ticker',
      { instId },
    )

    const t = res.data[0]

    return {
      symbol,
      last: Number.parseFloat(t.last),
      bid: Number.parseFloat(t.bidPx),
      ask: Number.parseFloat(t.askPx),
      high: Number.parseFloat(t.high24h),
      low: Number.parseFloat(t.low24h),
      volume: Number.parseFloat(t.vol24h),
      raw: t,
    }
  }

  protected async signRequest(
    method: HttpMethod,
    path: string,
    params: Record<string, unknown>,
    isPrivate: boolean,
    body?: unknown,
  ): Promise<{ url: string; headers: Record<string, string>; body?: string }> {
    const query = this.buildQuery(params)
    const url = query ? `${path}?${query}` : path
    const headers: Record<string, string> = {}

    if (!isPrivate) {
      return { url, headers }
    }

    const { apiKey, secret, passphrase } = this.config
    if (!apiKey || !secret || !passphrase) {
      throw new AuthError('OKX apiKey/secret/passphrase missing')
    }

    const timestamp = new Date().toISOString()
    const bodyString = body !== undefined ? JSON.stringify(body) : ''
    const prehash = `${timestamp}${method.toUpperCase()}${path}${query ? `?${query}` : ''}${bodyString}`

    const sign = createHmac('sha256', secret)
      .update(prehash)
      .digest('base64')

    headers['OK-ACCESS-KEY'] = apiKey
    headers['OK-ACCESS-PASSPHRASE'] = passphrase
    headers['OK-ACCESS-SIGN'] = sign
    headers['OK-ACCESS-TIMESTAMP'] = timestamp
    headers['Content-Type'] = 'application/json'

    // 启用 OKX 模拟盘
    if (this.config.isTestnet) {
      headers['x-simulated-trading'] = '1'
    }

    return { url, headers, body: bodyString || undefined }
  }

  protected mapError(status: number, data: unknown): ExchangeError {
    if (typeof data === 'object' && data !== null && 'code' in data && 'msg' in data) {
      const record = data as { code: string; msg: string }
      const { code, msg } = record

      // API Key 无效或不存在
      if (code === '50113') {
        return new AuthError('API Key无效，请检查是否正确复制', data)
      }

      // API Key 过期
      if (code === '50114') {
        return new AuthError('API Key已过期，请重新创建API Key（注意：未绑定IP的交易权限Key会在14天不使用后自动失效）', data)
      }

      // Passphrase 错误
      if (code === '50111') {
        return new AuthError('Passphrase错误，请检查创建API Key时设置的密码短语', data)
      }

      // IP 白名单限制
      if (code === '50112') {
        return new AuthError('IP地址未加入白名单，请在OKX API管理页面添加服务器IP或取消IP限制', data)
      }

      // 权限不足
      if (code === '51001' || msg.toLowerCase().includes('permission') || msg.includes('权限')) {
        return new AuthError('API Key权限不足，请确保开启"读取"和"交易"权限', data)
      }

      // API Key 被禁用
      if (code === '50115') {
        return new AuthError('API Key已被禁用或删除，请在OKX API管理页面检查状态', data)
      }

      // 签名错误
      if (code === '50103' || code === '50102') {
        return new AuthError('API签名验证失败，请检查API Secret和Passphrase是否正确', data)
      }

      // 其他认证相关错误（5开头的1xx系列错误）
      if (typeof code === 'string' && /^501\d{2}$/.test(code)) {
        return new AuthError(`OKX认证失败: ${msg}`, data)
      }

      return new ExchangeError(`OKX error ${code}: ${msg}`, code, data)
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

  private toInstrumentId(symbol: string, marketType: MarketType): string {
    // 统一 symbol: BTC/USDT 或 BTC/USDT:PERP
    const baseQuote = symbol.includes(':') ? symbol.split(':')[0] : symbol
    const [base, quote] = baseQuote.split('/')
    if (marketType === 'spot') {
      return `${base}-${quote}`
    }
    // SWAP 合约
    return `${base}-${quote}-SWAP`
  }

  private fromInstrumentId(instId: string): string {
    // BTC-USDT 或 BTC-USDT-SWAP
    const parts = instId.split('-')
    if (parts.length < 2) return instId
    const [base, quote, suffix] = parts
    const isPerp = suffix === 'SWAP'
    return `${base}/${quote}${isPerp ? ':PERP' : ''}`
  }

  private mapOrderType(type: OrderType): string {
    switch (type) {
      case 'limit':
        return 'limit'
      case 'market':
        return 'market'
      default:
        throw new ExchangeError(`Unsupported OKX order type: ${type}`)
    }
  }

  /**
   * 将 OKX 的 ordType 映射为统一的 OrderType。
   *
   * - limit / post_only / ioc / fok 等都视为限价单语义
   * - market 视为市价单
   * - conditional / trigger / stop_* 视为止损单
   * 对未知类型直接抛出 ExchangeError，避免静默误判。
   */
  private reverseMapOrderType(ordType: string): OrderType {
    const lower = ordType.toLowerCase()

    // 限价类：普通限价 + 各种 TIF 变体
    if (lower === 'limit' || lower === 'post_only' || lower === 'fok' || lower === 'ioc') {
      return 'limit'
    }

    // 市价
    if (lower === 'market') {
      return 'market'
    }

    // 止损/条件单
    if (lower === 'conditional' || lower === 'trigger' || lower === 'stop' || lower === 'oco') {
      return 'stop'
    }

    throw new ExchangeError(`Unsupported OKX order type: ${ordType}`)
  }

  private mapOrderStatus(state: string): UnifiedOrder['status'] {
    const lower = state.toLowerCase()
    switch (lower) {
      case 'live':
        return 'open'
      case 'partially_filled':
        return 'partially_filled'
      case 'filled':
        return 'closed'
      case 'canceled':
      case 'cancelled':
      case 'cancelling':
      case 'mmp_canceled':
        return 'canceled'
      case 'failed':
        return 'rejected'
      default:
        // 对未知状态保守地视为 rejected，避免错误展示为未成交
        return 'rejected'
    }
  }

  private toSize(value: number): string {
    return Number(value).toString()
  }

  private toPrice(value: number): string {
    return Number(value).toString()
  }

  private mapOrderFromResponse(order: OkxOrderResponse, symbol: string): UnifiedOrder {
    const createdAt = order.cTime ? Number.parseInt(order.cTime, 10) : Date.now()
    const updatedAt = order.uTime ? Number.parseInt(order.uTime, 10) : undefined

    return {
      id: order.ordId,
      clientOrderId: order.clOrdId,
      symbol,
      marketType: this.marketType,
      side: order.side === 'sell' ? 'sell' : 'buy',
      type: this.reverseMapOrderType(order.ordType),
      price: order.px ? Number.parseFloat(order.px) : undefined,
      amount: Number.parseFloat(order.sz),
      filled: Number.parseFloat(order.fillSz ?? '0'),
      status: this.mapOrderStatus(order.state),
      createdAt,
      updatedAt,
      raw: order,
    }
  }
}


