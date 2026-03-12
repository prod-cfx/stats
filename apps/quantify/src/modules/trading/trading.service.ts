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
    /** 鍙€夛細绮剧‘鎸囧畾浜ゆ槗鎵€璐︽埛 ID锛堢敤浜?LLM 璁㈤槄绛夊満鏅級 */
    exchangeAccountId?: string,
  ): Promise<UnifiedOrder> {
    // 濡傛灉鎸囧畾浜嗗叿浣撹处鎴?ID锛屽垯绮剧‘鏌ユ壘锛涘惁鍒欐寜 (userId, exchangeId) 鍙栨渶鏂拌处鎴?
    // 娉ㄦ剰锛歡etAccountConfigById 蹇呴』浼犲叆 userId锛岄槻姝㈣秺鏉冭闂粬浜鸿处鎴?
    const account = exchangeAccountId
      ? await this.accountStore.getAccountConfigById(exchangeAccountId, userId)
      : await this.accountStore.getAccountConfig(userId, exchangeId)
    if (!account) {
      throw new TradingAccountNotFoundException({ userId, exchangeId })
    }

    // 鏍￠獙 marketType 涓€鑷存€э細鍙傛暟涓?input 涓殑 marketType 蹇呴』涓€鑷?
    if (input.marketType && input.marketType !== marketType) {
      throw new UnsupportedMarketTypeException({ exchangeId, marketType: input.marketType })
    }

    const client = this.exchangeFactory.createClient(exchangeId, marketType, account)

    try {
      // 棰勭暀椋庢帶鍏ュ彛锛氫笅鍗曞墠鍙湪姝ゅ姞鍏ラ檺棰濄€侀粦鍚嶅崟绛夋鏌?
      return await client.createOrder(input)
    }
    catch (error) {
      // 鎹曡幏浜ゆ槗鎵€閿欒骞舵槧灏勪负涓氬姟寮傚父锛岄伩鍏嶇洿鎺ユ毚闇茬涓夋柟閿欒璇︽儏
      if (error instanceof ExchangeError) {
        throw new OrderCreationFailedException({ exchangeId, reason: error.message })
      }
      throw error
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
  ): Promise<UnifiedBalance[]> {
    const account = await this.accountStore.getAccountConfig(userId, exchangeId)
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
   * 鏍￠獙浜ゆ槗鎵€鍑嵁鏄惁鏈夋晥銆?
   *
   * 鏀寔鐨勪氦鏄撴墍锛?
   * - Binance/OKX锛氶獙璇?API key/secret锛堥€氳繃 fetchBalance锛?
   * - Hyperliquid锛氶獙璇侀挶鍖呭湴鍧€鍜岀閽ョ鍚嶏紙閫氳繃涓撶敤鐨?validateCredentials 鏂规硶锛?
   *
   * 浣跨敤鏂瑰紡锛?
   * - 鍦ㄧ敤鎴锋彁浜ゅ嚟鎹悗锛岃皟鐢ㄨ鏂规硶杩涜涓€娆¤交閲忕殑绉佹湁鎺ュ彛璁块棶锛?
   * - 鑻ヨ繑鍥?true锛岃鏄庤璇侀€氳繃锛?
   * - 鑻ユ姏鍑?InvalidCredentialsException锛岃〃绀哄瘑閽ユ棤鏁堟垨鏉冮檺涓嶈冻锛?
   * - 鑻ユ姏鍑?ExchangeOperationFailedException锛屽垯灞炰簬鐜鎴栦氦鏄撴墍閿欒锛屽簲鎻愮ず鐢ㄦ埛绋嶅悗閲嶈瘯銆?
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
        // Hyperliquid 闇€瑕佷娇鐢ㄤ笓闂ㄧ殑鍑嵁楠岃瘉鏂规硶
        // 鍥犱负 fetchBalance 浣跨敤鐨勬槸鍏紑 API锛屼笉楠岃瘉绛惧悕
        // validateCredentials 浼氬皾璇曡皟鐢ㄩ渶瑕佺鍚嶇殑鎺ュ彛鏉ラ獙璇?agent 鎺堟潈
        await (client as any).validateCredentials()
      }
      else {
        // Binance/OKX 浣跨敤 fetchBalance 楠岃瘉 API key/secret
        await client.fetchBalance()
      }
      return true
    }
    catch (error) {
      if (error instanceof AuthError) {
        // 璁よ瘉閿欒锛歬ey/secret 鏃犳晥銆佹潈闄愪笉瓒崇瓑
        // 浼犻€掕缁嗙殑閿欒淇℃伅缁欏紓甯?
        throw new InvalidCredentialsException({
          exchangeId,
          message: error.message
        })
      }

      if (error instanceof ExchangeError) {
        // 闈炶璇佺被鐨勪氦鏄撴墍閿欒缁熶竴鍖呰涓洪鍩熷紓甯革紝閬垮厤鐩存帴鏆撮湶绗笁鏂归敊璇?
        throw new ExchangeOperationFailedException({ operation: 'validate credentials', exchangeId, reason: error.message })
      }

      throw error
    }
  }
}
