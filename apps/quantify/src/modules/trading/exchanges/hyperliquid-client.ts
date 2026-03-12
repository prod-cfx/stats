import type { IExchangeClient } from '../core/interface'
import type {
  CreateOrderInput,
  MarketType,
  OrderType,
  UnifiedBalance,
  UnifiedOrder,
  UnifiedPosition,
  UnifiedTicker,
} from '../core/types'
import type { HyperliquidConfig } from '../factory/account-store'
import { randomBytes } from 'node:crypto'
import * as hl from '@nktkas/hyperliquid'
import { Wallet } from 'ethers'
import { AuthError, ExchangeError, OrderNotFoundError } from '../core/errors'

/**
 * Hyperliquid 浜ゆ槗鎵€閫傞厤鍣紙鍩轰簬 @nktkas/hyperliquid SDK锛?
 *
 * 鐗规€э細
 * - 浣跨敤 Agent Private Key 瀵硅鍗曡繘琛岀鍚?
 * - 浣跨敤 mainWalletAddress 浣滀负璧勯噾褰掑睘閽卞寘
 * - 瀹屾暣瀹炵幇缁熶竴浜ゆ槗鎺ュ彛
 * - 鍐呯疆閫熺巼闄愬埗鍜岃姹傞噸璇曟満鍒?
 */
export class HyperliquidClient implements IExchangeClient {
  // ========== 閰嶇疆甯搁噺 ==========

  /** 甯備环鍗曟粦鐐瑰蹇嶅害 (10%) */
  private readonly MARKET_ORDER_SLIPPAGE = 0.1

  /** Ticker 缂撳瓨鏈夋晥鏈?(5绉? */
  private readonly TICKER_CACHE_TTL = 5000

  /** 鏈€灏忚姹傞棿闅?(100姣) */
  private readonly MIN_REQUEST_INTERVAL = 100

  /** 鏈€澶у苟鍙戣姹傛暟 */
  private readonly MAX_CONCURRENT_REQUESTS = 10

  /** 鏈€澶ч噸璇曟鏁?*/
  private readonly MAX_RETRIES = 3

  /** 閲嶈瘯鍩虹寤惰繜 (1绉? */
  private readonly RETRY_BASE_DELAY = 1000

  /** Ticker 浠峰樊鐧惧垎姣?(0.01%) */
  private readonly TICKER_SPREAD_PERCENTAGE = 0.0001

  // ========== 瀹炰緥瀛楁 ==========

  private readonly mainWalletAddress: string
  private readonly agentPrivateKey: string

  // 瀹為檯鐢ㄤ簬浜ゆ槗鍜屾煡璇㈢殑閽卞寘鍦板潃锛坅gent 閽卞寘鍦板潃锛?
  private readonly tradingWalletAddress: string

  private readonly infoClient: hl.InfoClient
  private readonly exchClient: hl.ExchangeClient

  // 閫熺巼闄愬埗
  private lastRequestTime = 0
  private pendingRequests = 0

  // Ticker 缂撳瓨
  private tickerCache = new Map<string, { data: UnifiedTicker; timestamp: number }>()

  // 璧勪骇鍏冩暟鎹紦瀛橈紙coin -> assetId 鏄犲皠锛?
  private assetMetaCache: Map<string, number> | null = null
  private assetMetaCacheTime = 0
  private readonly ASSET_META_CACHE_TTL = 3600000 // 1灏忔椂

  constructor(config: HyperliquidConfig) {
    this.mainWalletAddress = config.mainWalletAddress
    this.agentPrivateKey = config.agentPrivateKey

    // 鍒濆鍖?HTTP Transport
    // 鏍规嵁閰嶇疆鐨?isTestnet 鏍囧織閫夋嫨缃戠粶锛堟祴璇曠綉鎴栦富缃戯級
    const transport = new hl.HttpTransport({
      // SDK 浼氭牴鎹?isTestnet 閫夋嫨姝ｇ‘鐨?endpoint锛?
      // - true  => https://api.hyperliquid-testnet.xyz
      // - false => https://api.hyperliquid.xyz
      isTestnet: config.isTestnet ?? false,
    } as any)

    // 鍒涘缓绛惧悕閽卞寘锛堜娇鐢?agent 绉侀挜锛?
    const wallet = new Wallet(this.agentPrivateKey)

    // Hyperliquid Agent/Vault 鏋舵瀯锛?
    // - agent 閽卞寘锛氱敤浜庣鍚嶄氦鏄?
    // - vault/涓婚挶鍖咃細璧勯噾瀹為檯瀛樻斁鐨勫湴鏂?
    // - 閫氳繃 defaultVaultAddress 鎸囧畾璧勯噾褰掑睘
    // - 鏌ヨ鏃朵娇鐢ㄤ富閽卞寘鍦板潃
    this.tradingWalletAddress = this.mainWalletAddress

    // 鍒濆鍖栧鎴风
    this.infoClient = new hl.InfoClient({ transport })
    this.exchClient = new hl.ExchangeClient({
      transport,
      wallet,
      defaultVaultAddress: this.mainWalletAddress, // 鎸囧畾璧勯噾褰掑睘鍒颁富閽卞寘
    } as any)
  }

  async init(): Promise<void> {
    await this.ping()
  }

  async ping(): Promise<void> {
    try {
      // 浣跨敤杞婚噺绾ф帴鍙ｆ帰娲伙細鑾峰彇鎵€鏈夊竵绉嶄腑闂翠环
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
   * 楠岃瘉鍑嵁鏈夋晥鎬э紙绉侀挜鍜屾巿鏉冨叧绯伙級
   *
   * 閫氳繃灏濊瘯鍙栨秷涓€涓笉瀛樺湪鐨勮鍗曟潵楠岃瘉绛惧悕锛?
   * - 濡傛灉绉侀挜鏃犳晥鎴?agent 鏈涓婚挶鍖呮巿鏉冿紝浼氳繑鍥炵鍚?鎺堟潈閿欒
   * - 濡傛灉绛惧悕鏈夋晥浣嗚鍗曚笉瀛樺湪锛屼細杩斿洖"璁㈠崟涓嶅瓨鍦?閿欒锛岃繖璇佹槑鍑嵁鏈夋晥
   *
   * 杩欎釜鏂规硶涓嶄細浜х敓浠讳綍瀹為檯鍓綔鐢ㄣ€?
   */
  async validateCredentials(): Promise<boolean> {
    // 浣跨敤涓€涓殢鏈虹殑 clientOrderId 鏉ラ獙璇佺鍚?
    const fakeCloid = this.generateClientOrderId()

    try {
      // 鑾峰彇 BTC 鐨?assetId锛堟渶甯哥敤鐨勮祫浜э級
      const assetId = await this.getAssetId('BTC')

      // 灏濊瘯閫氳繃 cloid 鍙栨秷涓€涓笉瀛樺湪鐨勮鍗?
      // 杩欎細瑙﹀彂绛惧悕楠岃瘉锛屼絾涓嶄細浜х敓瀹為檯鍓綔鐢?
      const cancelByCloidAction: any = {
        type: 'cancelByCloid',
        cancels: [{ asset: assetId, cloid: fakeCloid }],
      }

      const response: any = await this.rateLimit(async () =>
        (this.exchClient as any).cancelByCloid(cancelByCloidAction),
      )

      // 濡傛灉鍝嶅簲鐘舵€佹槸 err锛屾鏌ラ敊璇被鍨?
      if (response.status === 'err') {
        const errorMsg = String(response.response || '').toLowerCase()

        // 绛惧悕/鎺堟潈鐩稿叧閿欒 - 鍑嵁鏃犳晥
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

      // 妫€鏌ュ搷搴斾腑鐨勫叿浣撶姸鎬?
      const statuses = response.response?.data?.statuses
      if (statuses && statuses.length > 0) {
        const cancelStatus = statuses[0]

        // "璁㈠崟涓嶅瓨鍦?閿欒璇存槑绛惧悕楠岃瘉閫氳繃浜?
        if ('error' in cancelStatus) {
          const errorMsg = String(cancelStatus.error).toLowerCase()

          // 绛惧悕/鎺堟潈鐩稿叧閿欒
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

          // 鍏朵粬閿欒锛堝"璁㈠崟涓嶅瓨鍦?锛夎鏄庣鍚嶉獙璇侀€氳繃
          return true
        }
      }

      // 娌℃湁閿欒璇存槑绛惧悕楠岃瘉閫氳繃
      return true
    }
    catch (error) {
      // 濡傛灉鏄垜浠姏鍑虹殑 AuthError锛岀洿鎺ヤ紶閫?
      if (error instanceof AuthError) {
        throw error
      }

      // 鍒嗘瀽鍏朵粬閿欒
      const message = String((error as Error).message || '').toLowerCase()

      // 瀵逛簬 "璁㈠崟涓嶅瓨鍦?宸茬粡鍙栨秷/宸叉垚浜? 杩欑被閿欒锛岃鏄庣鍚嶅凡閫氳繃銆佸彧鏄鍗曟湰韬笉瀛樺湪锛?
      // 杩欐鏄垜浠湡鏈涚殑楠岃瘉璺緞锛屽洜姝ゅ簲瑙嗕负鍑嵁鏈夋晥鑰屼笉鏄敊璇€?
      if (
        message.includes('order was never placed') ||
        message.includes('already canceled') ||
        message.includes('already cancelled') ||
        message.includes('already filled')
      ) {
        return true
      }

      // 绛惧悕/鎺堟潈鐩稿叧閿欒
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

      // 缃戠粶鎴栧叾浠栦复鏃堕敊璇紝鍖呰鍚庢姏鍑?
      throw new ExchangeError(
        `Credential validation failed: ${(error as Error).message}`,
        undefined,
        this.sanitizeError(error, 'validateCredentials'),
      )
    }
  }

  // ========== 閫熺巼闄愬埗涓庨噸璇曟満鍒?==========

  /**
   * 閫熺巼闄愬埗鍖呰鍣?- 纭繚璇锋眰闂撮殧鍜屽苟鍙戦檺鍒?
   */
  private async rateLimit<T>(fn: () => Promise<T>): Promise<T> {
    // 妫€鏌ュ苟鍙戦檺鍒?
    while (this.pendingRequests >= this.MAX_CONCURRENT_REQUESTS) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // 妫€鏌ヨ姹傞棿闅?
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
   * 閲嶈瘯鍖呰鍣?- 澶勭悊涓存椂鎬ф晠闅?
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

        // 涓嶉噸璇曠殑閿欒绫诲瀷
        if (error instanceof ExchangeError) {
          const noRetryErrors = ['INVALID_SYMBOL', 'INVALID_ORDER_TYPE', 'REQUIRES_PRICE']
          if (noRetryErrors.includes(error.code || '')) {
            throw error
          }
        }

        // 鏈€鍚庝竴娆″皾璇曞け璐?
        if (attempt >= this.MAX_RETRIES) {
          break
        }

        // 鎸囨暟閫€閬?
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
   * 鍑€鍖栭敊璇鎯?- 绉婚櫎鏁忔劅淇℃伅
   */
  private sanitizeError(error: unknown, operation: string): Record<string, unknown> {
    const errorObj = error as Error
    return {
      timestamp: Date.now(),
      operation,
      message: errorObj.message,
      // 涓嶅寘鍚彲鑳藉惈鏈夋晱鎰熶俊鎭殑瀹屾暣閿欒瀵硅薄
    }
  }

  /**
   * 鍒涘缓璁㈠崟
   *
   * @param input - 璁㈠崟鍙傛暟锛屽寘鎷?symbol, side, type, amount, price 绛?
   * @returns 缁熶竴鏍煎紡鐨勮鍗曞璞?
   * @throws {ExchangeError} 璁㈠崟鍒涘缓澶辫触鎴栧弬鏁伴敊璇?
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
    // 鍙敮鎸佹案缁悎绾?
    if (input.marketType !== 'perp') {
      throw new ExchangeError(
        'Hyperliquid only supports perpetual contracts',
        'INVALID_MARKET_TYPE',
      )
    }

    const coin = this.mapSymbolToHl(input.symbol)
    const isBuy = input.side === 'buy'
    const sz = Number(input.amount)

    // 寮哄埗鐢熸垚鍞竴 clientOrderId 浠ョ‘淇濆箓绛夋€э紙闃叉閲嶅涓嬪崟锛?
    const clientOrderId = input.clientOrderId || this.generateClientOrderId()

    // 鑾峰彇璧勪骇 ID锛圚yperliquid SDK 瑕佹眰锛?
    const assetId = await this.getAssetId(coin)

    // 鍑嗗璁㈠崟绫诲瀷鍜屼环鏍?
    const { orderType, limitPx } = await this.prepareOrderRequest(input, coin, isBuy)

    // 鏋勯€犺鍗曡姹傦紙浣跨敤 SDK 鐨勬纭牸寮忥級
    // 娉ㄦ剰锛歛 = assetId锛堟暣鏁帮級锛宻 = size锛堝瓧绗︿覆锛夛紝p = price锛堝瓧绗︿覆锛?
    const orderRequest: any = {
      a: assetId, // 鉁?璧勪骇 ID锛堟暣鏁帮級
      b: isBuy,
      p: String(limitPx),
      s: String(sz), // 鉁?涓嬪崟鏁伴噺锛堝瓧绗︿覆锛?
      r: input.reduceOnly ?? false,
      t: orderType,
      c: clientOrderId,
    }

    // 鏋勯€犺鍗曞姩浣?
    const orderAction: any = {
      type: 'order',
      orders: [orderRequest],
      grouping: 'na',
    }

    try {
      // 鍙戦€佽鍗曪紙涓嶄娇鐢?withRetry 閬垮厤閲嶅涓嬪崟锛?
      const response: any = await this.rateLimit(async () =>
        (this.exchClient as any).order(orderAction),
      )

      // 妫€鏌ュ搷搴旂姸鎬?
      if (response.status === 'err') {
        throw new ExchangeError(`Order failed: ${response.response}`)
      }

      // 瑙ｆ瀽鍝嶅簲
      const statuses = response.response.data?.statuses
      if (!statuses || statuses.length === 0) {
        throw new ExchangeError('No order status returned')
      }

      const orderStatus = statuses[0]
      if (!orderStatus || 'error' in orderStatus) {
        const errorMsg = 'error' in orderStatus ? orderStatus.error : 'Unknown error'
        throw new ExchangeError(`Order failed: ${errorMsg}`)
      }

      // 鑾峰彇璁㈠崟璇︽儏
      const filled = orderStatus.filled || { totalSz: '0', avgPx: '0' }

      // 鑾峰彇璁㈠崟 ID锛?
      // 1. 浼樺厛浣跨敤 resting.oid锛堟湭瀹屽叏鎴愪氦鐨勮鍗曪級
      // 2. 鍏舵浣跨敤 filled.oid锛堢灛鏃舵垚浜ょ殑璁㈠崟锛?
      // 3. 鏈€鍚庝娇鐢?clientOrderId 浣滀负涓存椂鏍囪瘑
      const orderId = String(
        orderStatus.resting?.oid ||
        orderStatus.filled?.oid ||
        clientOrderId,
      )

      return {
        id: orderId,
        clientOrderId,
        symbol: input.symbol,
        marketType: 'perp',
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

  /**
   * 鍑嗗璁㈠崟璇锋眰 - 绛栫暐妯″紡澶勭悊涓嶅悓璁㈠崟绫诲瀷
   */
  private async prepareOrderRequest(
    input: CreateOrderInput,
    coin: string,
    isBuy: boolean,
  ): Promise<{ orderType: any; limitPx: number }> {
    if (input.type === 'market') {
      return this.prepareMarketOrder(coin, isBuy)
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
   * 鍑嗗甯備环鍗?- 浣跨敤 IOC 闄愪环鍗曞疄鐜?
   */
  private async prepareMarketOrder(
    coin: string,
    isBuy: boolean,
  ): Promise<{ orderType: any; limitPx: number }> {
    const mids: any = await this.infoClient.allMids()
    const midPrice = Number(mids[coin] || 0)

    if (midPrice === 0) {
      throw new ExchangeError(`Unable to get market price for ${coin}`)
    }

    // 浣跨敤閰嶇疆鐨勬粦鐐瑰蹇嶅害
    const slippageFactor = 1 + (isBuy ? this.MARKET_ORDER_SLIPPAGE : -this.MARKET_ORDER_SLIPPAGE)

    return {
      orderType: { limit: { tif: 'Ioc' } },
      limitPx: midPrice * slippageFactor,
    }
  }

  /**
   * 鍙栨秷璁㈠崟
   *
   * @param id - 璁㈠崟 ID锛堝彲浠ユ槸鏁板瓧 oid 鎴?0x 寮€澶寸殑 clientOrderId锛?
   * @param symbol - 浜ゆ槗瀵?symbol
   * @returns 鍙栨秷鍚庣殑璁㈠崟鐘舵€侊紙鍖呭惈鐪熷疄鐨勮鍗曚俊鎭級
   * @throws {ExchangeError} 鍙栨秷澶辫触
   *
   * @remarks
   * 璇ユ柟娉曚細鑷姩鍒ゆ柇 id 鐨勭被鍨嬶細
   * - 濡傛灉鏄暟瀛楁垨鍙浆鎹负鏈夋晥鏁板瓧锛屼娇鐢?cancel 鎺ュ彛锛堟寜 oid 鍙栨秷锛?
   * - 濡傛灉鏄?0x 寮€澶寸殑瀛楃涓诧紝浣跨敤 cancelByCloid 鎺ュ彛锛堟寜 clientOrderId 鍙栨秷锛?
   *
   * 涓轰簡杩斿洖鍑嗙‘鐨勮鍗曚俊鎭紝璇ユ柟娉曚細鍏堟煡璇㈣鍗曡鎯呭啀鎵ц鍙栨秷鎿嶄綔銆?
   */
  async cancelOrder(id: string, symbol: string): Promise<UnifiedOrder> {
    return this.withRetry(async () => {
      const coin = this.mapSymbolToHl(symbol)

      // 鑾峰彇璧勪骇 ID锛圚yperliquid SDK 瑕佹眰锛?
      const assetId = await this.getAssetId(coin)

      // 鍏堟煡璇㈣鍗曡鎯咃紝浠ヤ究杩斿洖鍑嗙‘鐨勮鍗曚俊鎭?
      let orderInfo: UnifiedOrder | null = null
      try {
        orderInfo = await this.fetchOrder(id, symbol)
      }
      catch {
        // 濡傛灉鏌ヨ澶辫触锛岀户缁彇娑堟搷浣滐紝浣嗘棤娉曡繑鍥炲畬鏁翠俊鎭?
        // 涓嶆姏鍑哄紓甯革紝浠呰褰曢敊璇?
      }

      // 鍒ゆ柇 id 绫诲瀷骞堕€夋嫨鍚堥€傜殑鍙栨秷鎺ュ彛
      const isCloid = id.startsWith('0x')
      let response: any

      if (isCloid) {
        // 浣跨敤 cancelByCloid 鎺ュ彛锛堟寜 clientOrderId 鍙栨秷锛?
        const cancelByCloidAction: any = {
          type: 'cancelByCloid',
          cancels: [{ asset: assetId, cloid: id }],
        }

        response = await this.rateLimit(async () =>
          (this.exchClient as any).cancelByCloid(cancelByCloidAction),
        )
      }
      else {
        // 楠岃瘉 id 鏄惁涓烘湁鏁堟暟瀛?
        const oid = Number(id)
        if (Number.isNaN(oid)) {
          throw new ExchangeError(
            `Invalid order ID: ${id}. Must be a valid number or 0x-prefixed clientOrderId`,
            'INVALID_ORDER_ID',
          )
        }

        // 浣跨敤 cancel 鎺ュ彛锛堟寜 oid 鍙栨秷锛?
        const cancelAction: any = {
          type: 'cancel',
          cancels: [{ a: assetId, o: oid }],
        }

        response = await this.rateLimit(async () =>
          (this.exchClient as any).cancel(cancelAction),
        )
      }

      // 妫€鏌ュ搷搴?
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

      // 杩斿洖鍙栨秷鍚庣殑璁㈠崟鐘舵€侊紙浣跨敤鏌ヨ鍒扮殑鐪熷疄淇℃伅锛?
      if (orderInfo) {
        return {
          ...orderInfo,
          status: 'canceled',
          raw: cancelStatus,
        }
      }

      // 濡傛灉鏃犳硶鏌ヨ鍒拌鍗曚俊鎭紝杩斿洖鍩烘湰淇℃伅
      return {
        id,
        clientOrderId: isCloid ? id : undefined,
        symbol,
        marketType: 'perp',
        side: 'buy', // 鏃犳硶纭畾鐪熷疄鏂瑰悜
        type: 'limit', // 鏃犳硶纭畾鐪熷疄绫诲瀷
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
   * 鏌ヨ鍗曚釜璁㈠崟
   *
   * @param id - 璁㈠崟 ID锛堝彲浠ユ槸鏁板瓧 oid 鎴?0x 寮€澶寸殑 clientOrderId锛?
   * @param symbol - 浜ゆ槗瀵?symbol
   * @returns 璁㈠崟璇︽儏锛堣仛鍚堜簡澶氱瑪鎴愪氦锛?
   * @throws {OrderNotFoundError} 璁㈠崟涓嶅瓨鍦?
   *
   * @remarks
   * 璇ユ柟娉曚細鑷姩鍒ゆ柇 id 鐨勭被鍨嬶細
   * - 濡傛灉鏄暟瀛楋紝鎸?oid 鏌ヨ
   * - 濡傛灉鏄?0x 寮€澶寸殑瀛楃涓诧紝鎸?clientOrderId 鏌ヨ
   *
   * 瀵逛簬宸插叧闂殑璁㈠崟锛屼細鑱氬悎鎵€鏈夌浉鍚?oid/cloid 鐨?fill 璁板綍锛?
   * 璁＄畻鎬绘垚浜ら噺鍜屽姞鏉冨钩鍧囦环鏍硷紝纭繚杩斿洖鍑嗙‘鐨勮鍗曚俊鎭€?
   */
  async fetchOrder(id: string, symbol: string): Promise<UnifiedOrder> {
    return this.withRetry(async () => {
      const isCloid = id.startsWith('0x')

      // 鑾峰彇鐢ㄦ埛鐨勬墍鏈夋湭瀹屾垚璁㈠崟锛堜娇鐢?trading 閽卞寘鍦板潃锛?
      const openOrders: any = await this.infoClient.openOrders({ user: this.tradingWalletAddress })

      // 鏍规嵁 id 绫诲瀷鏌ユ壘鍖归厤鐨勮鍗?
      const order = openOrders.find((o: any) => {
        if (isCloid) {
          return o.cloid === id
        }
        return String(o.oid) === id
      })

      if (!order) {
        // 濡傛灉鍦ㄦ湭瀹屾垚璁㈠崟涓壘涓嶅埌锛屽皾璇曚粠璁㈠崟鍘嗗彶涓煡鎵?
        const fills: any = await this.infoClient.userFills({ user: this.tradingWalletAddress })

        // 鏍规嵁 id 绫诲瀷鏌ユ壘鎵€鏈夊尮閰嶇殑 fill 璁板綍
        const matchedFills = fills.filter((f: any) => {
          if (isCloid) {
            return f.cloid === id
          }
          return String(f.oid) === id
        })

        if (matchedFills.length === 0) {
          throw new OrderNotFoundError(`Order ${id} not found`)
        }

        // 鑱氬悎鎵€鏈?fill锛堜笌 fetchClosedOrders 淇濇寔涓€鑷达級
        const side = matchedFills[0].side === 'B' ? 'buy' : 'sell'
        const coin = matchedFills[0].coin

        let totalSz = 0
        let totalValue = 0
        let lastTime = 0
        let clientOrderId: string | undefined
        let orderId = id  // 榛樿浣跨敤浼犲叆鐨?id

        for (const fill of matchedFills) {
          totalSz += Number(fill.sz)
          totalValue += Number(fill.sz) * Number(fill.px)
          lastTime = Math.max(lastTime, fill.time)
          if (fill.cloid) {
            clientOrderId = fill.cloid
          }
          // 濡傛灉鏄€氳繃 cloid 鏌ヨ鐨勶紝灏濊瘯鑾峰彇鐪熷疄鐨?oid
          if (isCloid && fill.oid !== undefined) {
            orderId = String(fill.oid)
          }
        }

        const avgPx = totalSz > 0 ? totalValue / totalSz : 0

        return {
          id: orderId,  // 浼樺厛杩斿洖鐪熷疄鐨?oid
          clientOrderId,
          symbol,
          marketType: 'perp',
          side,
          // 娉ㄦ剰锛欻yperliquid fills API 涓嶈繑鍥炲師濮?orderType
          // 鐢变簬 Hyperliquid 鐨勫競浠峰崟鏈川涓婃槸 IOC 闄愪环鍗曪紝
          // 杩欓噷浣跨敤 'limit' 浣滀负榛樿鍊硷紝姣旂‖缂栫爜 'market' 鏇村噯纭?
          type: 'limit',
          price: avgPx, // 鍔犳潈骞冲潎浠锋牸
          amount: totalSz, // 鎬绘垚浜ら噺
          filled: totalSz,
          status: 'closed',
          createdAt: lastTime,
          raw: { fills: matchedFills, coin },
        }
      }

      // 璁㈠崟浠嶅湪闃熷垪涓紝闇€瑕佹煡璇㈠凡鎴愪氦閮ㄥ垎
      // Hyperliquid 鐨勯儴鍒嗘垚浜や細璁板綍鍦?userFills 涓紝鍗充娇璁㈠崟杩樺湪 openOrders 涓?
      const fills: any = await this.infoClient.userFills({ user: this.tradingWalletAddress })

      // 鏍规嵁 id 绫诲瀷鏌ユ壘鍖归厤鐨?fills
      const matchedFills = fills.filter((f: any) => {
        if (isCloid) {
          return f.cloid === id
        }
        return String(f.oid) === id
      })

      // 璁＄畻宸叉垚浜ゆ暟閲忓拰鍔犳潈骞冲潎浠锋牸
      let totalFilledSz = 0
      let totalFilledValue = 0

      for (const fill of matchedFills) {
        totalFilledSz += Number(fill.sz)
        totalFilledValue += Number(fill.sz) * Number(fill.px)
      }

      const avgFilledPx = totalFilledSz > 0 ? totalFilledValue / totalFilledSz : 0

      // 鏄犲皠璁㈠崟淇℃伅
      const unifiedOrder = this.mapOpenOrderToUnified(order, symbol)

      // 鏇存柊宸叉垚浜や俊鎭紝骞舵牴鎹垚浜ゆ儏鍐佃缃纭殑鐘舵€?
      // 濡傛灉鏈夐儴鍒嗘垚浜や絾璁㈠崟浠嶅湪 order book 涓紝鐘舵€佸簲涓?'partially_filled'
      // 杩欐牱璋冪敤鏂瑰彲浠ュ尯鍒?绛夊緟棣栨鎴愪氦"鍜?宸查儴鍒嗘垚浜?
      const status = totalFilledSz > 0 ? 'partially_filled' : 'open'

      return {
        ...unifiedOrder,
        filled: totalFilledSz,
        // 濡傛灉鏈夋垚浜わ紝浣跨敤瀹為檯鎴愪氦鍧囦环锛涘惁鍒欎娇鐢ㄦ寕鍗曚环鏍?
        price: totalFilledSz > 0 ? avgFilledPx : unifiedOrder.price,
        status,
        updatedAt: Date.now(),
      }
    }, 'fetchOrder')
  }

  /**
   * 鏌ヨ鏈畬鎴愯鍗?
   *
   * @param symbol - 鍙€夌殑浜ゆ槗瀵硅繃婊?
   * @returns 鏈畬鎴愯鍗曞垪琛?
   */
  async fetchOpenOrders(symbol?: string): Promise<UnifiedOrder[]> {
    return this.withRetry(async () => {
      const orders: any = await this.infoClient.openOrders({ user: this.tradingWalletAddress })

      // 濡傛灉鎸囧畾浜唖ymbol锛岃繃婊よ鍗?
      const filtered = symbol
        ? orders.filter((o: any) => o.coin === this.mapSymbolToHl(symbol))
        : orders

      return filtered.map((o: any) => this.mapOpenOrderToUnified(o, symbol || this.mapHlSymbolToInternal(o.coin)))
    }, 'fetchOpenOrders')
  }

  /**
   * 鏌ヨ鍘嗗彶璁㈠崟
   *
   * @param symbol - 鍙€夌殑浜ゆ槗瀵硅繃婊?
   * @returns 鍘嗗彶璁㈠崟鍒楄〃锛堣仛鍚堜簡澶氱瑪鎴愪氦鐨勫畬鏁磋鍗曪級
   *
   * @remarks
   * Hyperliquid 閫氳繃 fills 鎺ュ彛鑾峰彇鎴愪氦璁板綍銆?
   * 瀵逛簬鍒嗗娆℃垚浜ょ殑璁㈠崟锛岃鏂规硶浼氭寜 oid 鑱氬悎鎵€鏈?fill锛?
   * 璁＄畻鎬绘垚浜ら噺鍜屽姞鏉冨钩鍧囦环鏍硷紝纭繚杩斿洖鐨勮鍗曟暟鎹噯纭€?
   */
  async fetchClosedOrders(symbol?: string): Promise<UnifiedOrder[]> {
    return this.withRetry(async () => {
      // Hyperliquid 閫氳繃 fills 鎺ュ彛鑾峰彇鍘嗗彶鎴愪氦
      const fills: any = await this.infoClient.userFills({ user: this.tradingWalletAddress })

      // 濡傛灉鎸囧畾浜唖ymbol锛岃繃婊ゆ垚浜?
      const filtered = symbol
        ? fills.filter((f: any) => f.coin === this.mapSymbolToHl(symbol))
        : fills

      // 鎸夎鍗旾D鑱氬悎鎵€鏈?fill锛堝鐞嗗垎澶氭鎴愪氦鐨勮鍗曪級
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

      // 灏嗚仛鍚堝悗鐨勮鍗曡浆鎹负缁熶竴鏍煎紡
      return Array.from(orderMap.values()).map((order) => {
        const side = order.side === 'B' ? 'buy' : 'sell'
        const internalSymbol = symbol || this.mapHlSymbolToInternal(order.coin)

        // 璁＄畻鎬绘垚浜ら噺鍜屽姞鏉冨钩鍧囦环鏍?
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
          marketType: 'perp' as MarketType,
          side,
          // 娉ㄦ剰锛欻yperliquid fills API 涓嶈繑鍥炲師濮?orderType
          // 鐢变簬 Hyperliquid 鐨勫競浠峰崟鏈川涓婃槸 IOC 闄愪环鍗曪紝
          // 杩欓噷浣跨敤 'limit' 浣滀负榛樿鍊硷紝姣旂‖缂栫爜 'market' 鏇村噯纭?
          type: 'limit' as OrderType,
          price: avgPx, // 浣跨敤鍔犳潈骞冲潎浠锋牸
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
   * 鏌ヨ鎸佷粨
   *
   * @returns 鎸佷粨鍒楄〃
   */
  async fetchPositions(): Promise<UnifiedPosition[]> {
    return this.withRetry(async () => {
      const clearinghouseState: any = await this.infoClient.clearinghouseState({ user: this.tradingWalletAddress })

      if (!clearinghouseState.assetPositions) {
        return []
      }

      return clearinghouseState.assetPositions
        .filter((p: any) => {
          const size = Number(p.position?.szi || 0)
          return size !== 0 // 鍙繑鍥炴湁鎸佷粨鐨?
        })
        .map((p: any) => {
          const size = Number(p.position.szi)
          const side: UnifiedPosition['side'] = size > 0 ? 'long' : size < 0 ? 'short' : 'flat'
          const symbol = this.mapHlSymbolToInternal(p.position.coin)

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
   * 鏌ヨ浣欓
   *
   * @returns 浣欓鍒楄〃
   */
  async fetchBalance(): Promise<UnifiedBalance[]> {
    return this.withRetry(async () => {
      const clearinghouseState: any = await this.infoClient.clearinghouseState({ user: this.tradingWalletAddress })

      // Hyperliquid 浣跨敤 USDC 浣滀负淇濊瘉閲?
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
   * 鏌ヨ琛屾儏鏁版嵁
   *
   * @param symbol - 浜ゆ槗瀵?symbol
   * @returns 琛屾儏鏁版嵁锛堝寘鍚渶鏂颁环銆佷拱鍗栦环銆?4h楂樹綆浠峰拰鎴愪氦閲忥級
   */
  async fetchTicker(symbol: string): Promise<UnifiedTicker> {
    // 妫€鏌ョ紦瀛?
    const cached = this.tickerCache.get(symbol)
    if (cached && Date.now() - cached.timestamp < this.TICKER_CACHE_TTL) {
      return cached.data
    }

    return this.withRetry(async () => {
      const coin = this.mapSymbolToHl(symbol)

      // 骞惰鑾峰彇鎵€鏈夐渶瑕佺殑鏁版嵁
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

      // 澶勭悊 mids 缁撴灉
      if (midsResult.status === 'rejected') {
        throw new ExchangeError(`Failed to fetch market price: ${midsResult.reason}`)
      }
      const mids = midsResult.value
      const mid = mids[coin]

      if (!mid) {
        throw new ExchangeError(`Ticker not found for ${coin}`)
      }

      // 澶勭悊 meta 缁撴灉锛堝彲閫夛級
      const assetInfo = metaResult.status === 'fulfilled'
        ? metaResult.value.universe.find(u => u.name === coin)
        : undefined

      // 澶勭悊 candles 缁撴灉骞惰绠?4灏忔椂缁熻
      let high = Number(mid)
      let low = Number(mid)
      let volume = 0

      if (candlesResult.status === 'fulfilled' && candlesResult.value.length > 0) {
        const candles = candlesResult.value
        high = Math.max(...candles.map(c => Number(c.h)))
        low = Math.min(...candles.map(c => Number(c.l)))
        volume = candles.reduce((sum, c) => sum + Number(c.v), 0)
      }

      // 璁＄畻涔板崠浠峰樊
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

      // 鏇存柊缂撳瓨
      this.tickerCache.set(symbol, { data: ticker, timestamp: Date.now() })

      return ticker
    }, 'fetchTicker')
  }

  // ========== 绉佹湁鏄犲皠鏂规硶 ==========

  /**
   * 灏嗗唴閮ㄧ粺涓€ symbol 杞崲涓?Hyperliquid 甯佺鍚嶇О
   *
   * @param symbol - 缁熶竴鏍煎紡 symbol (濡? BTC/USDT:PERP)
   * @returns Hyperliquid 甯佺鍚嶇О (濡? BTC)
   * @throws {ExchangeError} symbol 鏍煎紡鏃犳晥
   *
   * @example
   * ```typescript
   * mapSymbolToHl('BTC/USDT:PERP') // 杩斿洖: 'BTC'
   * mapSymbolToHl('ETH/USDT:PERP') // 杩斿洖: 'ETH'
   * ```
   */
  private mapSymbolToHl(symbol: string): string {
    // 楠岃瘉 symbol 鏍煎紡: BASE/QUOTE:PERP
    const perpPattern = /^([A-Z0-9]+)\/[A-Z]+:PERP$/i
    const match = symbol.match(perpPattern)

    if (!match) {
      throw new ExchangeError(
        `Invalid symbol format: ${symbol}. Expected format: BASE/USDT:PERP (e.g., BTC/USDT:PERP)`,
        'INVALID_SYMBOL',
      )
    }

    return match[1].toUpperCase()
  }

  /**
   * 灏?Hyperliquid 甯佺鍚嶇О杞崲涓哄唴閮ㄧ粺涓€ symbol
   *
   * @param coin - Hyperliquid 甯佺鍚嶇О (濡? BTC)
   * @returns 缁熶竴鏍煎紡 symbol (濡? BTC/USDT:PERP)
   *
   * @example
   * ```typescript
   * mapHlSymbolToInternal('BTC') // 杩斿洖: 'BTC/USDT:PERP'
   * mapHlSymbolToInternal('ETH') // 杩斿洖: 'ETH/USDT:PERP'
   * ```
   */
  private mapHlSymbolToInternal(coin: string): string {
    // Hyperliquid 鎵€鏈夊悎绾﹂兘鏄?USDT 姘哥画
    return `${coin.toUpperCase()}/USDT:PERP`
  }

  /**
   * 鑾峰彇甯佺瀵瑰簲鐨勮祫浜?ID锛坅sset index锛?
   *
   * @param coin - 甯佺鍚嶇О (濡? BTC)
   * @returns 璧勪骇 ID
   * @throws {ExchangeError} 甯佺涓嶅瓨鍦?
   *
   * @remarks
   * Hyperliquid SDK 瑕佹眰鍦ㄤ笅鍗曞拰鎾ゅ崟鏃朵娇鐢ㄨ祫浜?ID锛堟暣鏁帮級鑰岄潪甯佺鍚嶇О銆?
   * 璇ユ柟娉曚細缂撳瓨 meta 淇℃伅 1 灏忔椂锛岄伩鍏嶉绻佽姹傘€?
   *
   * @example
   * ```typescript
   * const assetId = await this.getAssetId('BTC') // 杩斿洖: 0
   * const assetId = await this.getAssetId('ETH') // 杩斿洖: 1
   * ```
   */
  private async getAssetId(coin: string): Promise<number> {
    // 妫€鏌ョ紦瀛?
    const now = Date.now()
    if (this.assetMetaCache && now - this.assetMetaCacheTime < this.ASSET_META_CACHE_TTL) {
      const assetId = this.assetMetaCache.get(coin)
      if (assetId !== undefined) {
        return assetId
      }
    }

    // 缂撳瓨杩囨湡鎴栦笉瀛樺湪锛岄噸鏂拌幏鍙?
    const meta: any = await this.infoClient.meta()

    // 鏋勫缓 coin -> assetId 鏄犲皠
    const newCache = new Map<string, number>()
    if (meta && meta.universe && Array.isArray(meta.universe)) {
      for (const asset of meta.universe) {
        if (asset.name) {
          newCache.set(asset.name, asset.index ?? newCache.size)
        }
      }
    }

    // 鏇存柊缂撳瓨
    this.assetMetaCache = newCache
    this.assetMetaCacheTime = now

    // 鏌ユ壘鐩爣甯佺
    const assetId = newCache.get(coin)
    if (assetId === undefined) {
      throw new ExchangeError(
        `Asset ${coin} not found in Hyperliquid meta`,
        'ASSET_NOT_FOUND',
      )
    }

    return assetId
  }

  /**
   * 灏?Hyperliquid 鐨勬湭瀹屾垚璁㈠崟鏄犲皠涓虹粺涓€鏍煎紡
   *
   * @param order - Hyperliquid 鏈畬鎴愯鍗曞璞?
   * @param symbol - 缁熶竴鏍煎紡 symbol
   * @returns 缁熶竴鏍煎紡璁㈠崟瀵硅薄
   */
  private mapOpenOrderToUnified(order: any, symbol: string): UnifiedOrder {
    const side = order.side === 'B' ? 'buy' : 'sell'
    const sz = Number(order.sz)
    const limitPx = Number(order.limitPx)

    // 鍒ゆ柇璁㈠崟绫诲瀷
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
      marketType: 'perp',
      side,
      type,
      price: limitPx,
      amount: sz,
      filled: 0, // 鏈畬鎴愯鍗曠殑宸叉垚浜ゆ暟閲忛渶瑕佷粠鍏朵粬鎺ュ彛鑾峰彇
      status: 'open',
      createdAt: order.timestamp,
      raw: order,
    }
  }

  /**
   * 灏?Hyperliquid 鐨勬垚浜よ褰曟槧灏勪负缁熶竴璁㈠崟鏍煎紡
   *
   * @param fill - Hyperliquid 鎴愪氦璁板綍
   * @param symbol - 缁熶竴鏍煎紡 symbol
   * @returns 缁熶竴鏍煎紡璁㈠崟瀵硅薄
   */
  private mapFillToOrder(fill: any, symbol: string): UnifiedOrder {
    const side = fill.side === 'B' ? 'buy' : 'sell'
    const sz = Number(fill.sz)
    const px = Number(fill.px)

    return {
      id: String(fill.oid),
      clientOrderId: fill.cloid,
      symbol,
      marketType: 'perp',
      side,
      type: 'market', // 宸叉垚浜ょ殑璁㈠崟绫诲瀷闅句互鍒ゆ柇锛岄粯璁や负甯備环
      price: px,
      amount: sz,
      filled: sz, // 鎴愪氦璁板綍鐨勬暟閲忓嵆涓哄凡鎴愪氦鏁伴噺
      status: 'closed',
      createdAt: fill.time,
      raw: fill,
    }
  }

  /**
   * 鏄犲皠璁㈠崟鐘舵€?
   *
   * @param status - Hyperliquid 璁㈠崟鐘舵€?
   * @returns 缁熶竴鏍煎紡璁㈠崟鐘舵€?
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

  /**
   * 鐢熸垚鍞竴鐨勫鎴风璁㈠崟ID锛堢鍚?Hyperliquid SDK 瑕佹眰锛?
   *
   * @returns 鍞竴鐨勫鎴风璁㈠崟ID锛堟牸寮忥細0x + 32涓崄鍏繘鍒跺瓧绗︼紝鍏?6瀛楄妭锛?
   * @remarks
   * Hyperliquid SDK 瑕佹眰 clientOrderId 蹇呴』鏄?0x 寮€澶寸殑 16 瀛楄妭鍗佸叚杩涘埗瀛楃涓诧紙32涓崄鍏繘鍒跺瓧绗︼級锛?
   * 鍚﹀垯浼氭姤閿欙細
   *   "Invalid length: Expected 34 but received 66 at action.cancels.0.cloid"
   * 鍏朵腑 34 = 2 (0x 鍓嶇紑) + 32 (鍗佸叚杩涘埗瀛楃涓暟)銆?
   * 鍥犳杩欓噷浣跨敤 crypto.randomBytes(16) 鐢熸垚 16 瀛楄妭闅忔満鏁般€?
   * 鐢ㄤ簬纭繚璁㈠崟骞傜瓑鎬э紝闃叉閲嶅涓嬪崟銆?
   *
   * @example
   * ```typescript
   * generateClientOrderId()
   * // 杩斿洖: '0x1234567890abcdef1234567890abcdef'
   * //       (0x + 32涓崄鍏繘鍒跺瓧绗?= 34涓瓧绗︼紝浠ｈ〃16瀛楄妭)
   * ```
   */
  private generateClientOrderId(): string {
    // 鐢熸垚鐪熸鐨?16 瀛楄妭闅忔満鏁版嵁 = 32 涓崄鍏繘鍒跺瓧绗?
    const buf = randomBytes(16)
    return `0x${buf.toString('hex')}`
  }
}
