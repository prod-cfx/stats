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

    // OKX 鎵€鏈変骇鍝侀兘闇€瑕?tdMode锛氱幇璐т娇鐢?'cash'锛屾案缁粯璁?'cross'锛堝彲閫氳繃 extra 瑕嗙洊锛?
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
      // 浠ヤ氦鏄撴墍瀹為檯鎺ユ敹鐨勪环鏍煎拰鏁伴噺涓哄噯锛屼繚璇佷笌鍚庣画鏌ヨ/鍙栨秷璺緞涓€鑷?
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

    // OKX 鍝嶅簲鏍煎紡锛歞ata: [{ details: [...] }] 鎴栧皯鏁版儏鍐典笅鎵佸钩缁撴瀯
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
      .filter(b => b.ccy) // 杩囨护鎺夋棤鏁堝竵绉?
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

    // 鍚敤 OKX 妯℃嫙鐩?
    if (this.config.isTestnet) {
      headers['x-simulated-trading'] = '1'
    }

    return { url, headers, body: bodyString || undefined }
  }

  protected mapError(status: number, data: unknown): ExchangeError {
    if (typeof data === 'object' && data !== null && 'code' in data && 'msg' in data) {
      const record = data as { code: string; msg: string }
      const { code, msg } = record

      // API Key 鏃犳晥鎴栦笉瀛樺湪
      if (code === '50113') {
        return new AuthError('API Key鏃犳晥锛岃妫€鏌ユ槸鍚︽纭鍒?, data)
      }

      // API Key 杩囨湡
      if (code === '50114') {
        return new AuthError('API Key宸茶繃鏈燂紝璇烽噸鏂板垱寤篈PI Key锛堟敞鎰忥細鏈粦瀹欼P鐨勪氦鏄撴潈闄怟ey浼氬湪14澶╀笉浣跨敤鍚庤嚜鍔ㄥけ鏁堬級', data)
      }

      // Passphrase 閿欒
      if (code === '50111') {
        return new AuthError('Passphrase閿欒锛岃妫€鏌ュ垱寤篈PI Key鏃惰缃殑瀵嗙爜鐭', data)
      }

      // IP 鐧藉悕鍗曢檺鍒?
      if (code === '50112') {
        return new AuthError('IP鍦板潃鏈姞鍏ョ櫧鍚嶅崟锛岃鍦∣KX API绠＄悊椤甸潰娣诲姞鏈嶅姟鍣↖P鎴栧彇娑圛P闄愬埗', data)
      }

      // 鏉冮檺涓嶈冻
      if (code === '51001' || msg.toLowerCase().includes('permission') || msg.includes('鏉冮檺')) {
        return new AuthError('API Key鏉冮檺涓嶈冻锛岃纭繚寮€鍚?璇诲彇"鍜?浜ゆ槗"鏉冮檺', data)
      }

      // API Key 琚鐢?
      if (code === '50115') {
        return new AuthError('API Key宸茶绂佺敤鎴栧垹闄わ紝璇峰湪OKX API绠＄悊椤甸潰妫€鏌ョ姸鎬?, data)
      }

      // 绛惧悕閿欒
      if (code === '50103' || code === '50102') {
        return new AuthError('API绛惧悕楠岃瘉澶辫触锛岃妫€鏌PI Secret鍜孭assphrase鏄惁姝ｇ‘', data)
      }

      // 鍏朵粬璁よ瘉鐩稿叧閿欒锛?寮€澶寸殑1xx绯诲垪閿欒锛?
      if (typeof code === 'string' && /^501\d{2}$/.test(code)) {
        return new AuthError(`OKX璁よ瘉澶辫触: ${msg}`, data)
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
    // 缁熶竴 symbol: BTC/USDT 鎴?BTC/USDT:PERP
    const baseQuote = symbol.includes(':') ? symbol.split(':')[0] : symbol
    const [base, quote] = baseQuote.split('/')
    if (marketType === 'spot') {
      return `${base}-${quote}`
    }
    // SWAP 鍚堢害
    return `${base}-${quote}-SWAP`
  }

  private fromInstrumentId(instId: string): string {
    // BTC-USDT 鎴?BTC-USDT-SWAP
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
   * 灏?OKX 鐨?ordType 鏄犲皠涓虹粺涓€鐨?OrderType銆?
   *
   * - limit / post_only / ioc / fok 绛夐兘瑙嗕负闄愪环鍗曡涔?
   * - market 瑙嗕负甯備环鍗?
   * - conditional / trigger / stop_* 瑙嗕负姝㈡崯鍗?
   * 瀵规湭鐭ョ被鍨嬬洿鎺ユ姏鍑?ExchangeError锛岄伩鍏嶉潤榛樿鍒ゃ€?
   */
  private reverseMapOrderType(ordType: string): OrderType {
    const lower = ordType.toLowerCase()

    // 闄愪环绫伙細鏅€氶檺浠?+ 鍚勭 TIF 鍙樹綋
    if (lower === 'limit' || lower === 'post_only' || lower === 'fok' || lower === 'ioc') {
      return 'limit'
    }

    // 甯備环
    if (lower === 'market') {
      return 'market'
    }

    // 姝㈡崯/鏉′欢鍗?
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
        // 瀵规湭鐭ョ姸鎬佷繚瀹堝湴瑙嗕负 rejected锛岄伩鍏嶉敊璇睍绀轰负鏈垚浜?
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
