import type { MarketTimeframe } from '@ai/shared'

/**
 * 灏?MarketTimeframe 杞崲涓哄垎閽熸暟
 */
export function timeframeToMinutes(timeframe: MarketTimeframe): number {
  const map: Record<MarketTimeframe, number> = {
    '1m': 1,
    '3m': 3,
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
    '4h': 240,
    '6h': 360,
    '8h': 480,
    '12h': 720,
    '1d': 1440,
    '1w': 10080,
  }
  return map[timeframe] ?? 60 // 榛樿 1 灏忔椂
}

export const STRATEGY_LEG_ROLES = ['primary', 'hedge', 'context'] as const

export type StrategyLegRole = (typeof STRATEGY_LEG_ROLES)[number]

/**
 * 绛栫暐鑵垮畾涔?- 瀹氫箟绛栫暐鐨勪氦鏄撳璞?
 *
 * 涓€涓瓥鐣ュ彲浠ュ寘鍚涓?legs锛屾瘡涓?leg 浠ｈ〃涓€涓氦鏄撳璞°€?
 *
 * @example
 * ```typescript
 * {
 *   id: "btc",                    // 鍦ㄧ瓥鐣ヤ腑鍞竴鏍囪瘑杩欎釜 leg
 *   symbol: "BTCUSDT",            // 浜ゆ槗瀵逛唬鐮?
 *   role: "primary",              // 涓昏浜ゆ槗瀵硅薄
 *   description: "姣旂壒甯佷富鍚堢害"   // 鍙€夋弿杩?
 * }
 * ```
 */
export interface StrategyLegDefinition {
  /**
   * 鍦ㄥ悓涓€绛栫暐妯℃澘鍐呭敮涓€鐨?leg 鏍囪瘑锛屼緥濡傦細btc銆乪th銆乨xy
   */
  id: string
  /**
   * 浜ゆ槗瀵逛唬鐮侊紝渚嬪锛欱TCUSDT銆丒THUSDT
   * 鍙厑璁稿ぇ鍐欏瓧姣嶅拰鏁板瓧
   */
  symbol: string
  /**
   * leg 鐨勮鑹诧紝鍐冲畾鍏跺湪绛栫暐涓殑鐢ㄩ€旓紙涓昏吙 / 瀵瑰啿鑵?/ 涓婁笅鏂囷級
   */
  role: StrategyLegRole
  /**
   * 鍙€夋弿杩帮紝甯姪绠＄悊鍛樼悊瑙ｈ leg
   */
  description?: string
}

/**
 * 绛栫暐鎵ц閰嶇疆
 *
 * 瀹氫箟绛栫暐鐨勮繍琛屽弬鏁帮紝濡備俊鍙疯Е鍙戦鐜囧拰鍐峰嵈鏃堕棿銆?
 *
 * @example
 * ```typescript
 * {
 *   timeframe: "1h",           // 姣忓皬鏃舵鏌ヤ竴娆＄瓥鐣ユ潯浠?
 *   cooldownMinutes: 15        // 鍚屼竴浜ゆ槗瀵?15 鍒嗛挓鍐呬笉閲嶅鐢熸垚淇″彿
 * }
 * ```
 */
export interface StrategyExecutionConfig {
  /**
   * 淇″彿瑙﹀彂鍛ㄦ湡锛屽喅瀹氬涔呮鏌ヤ竴娆＄瓥鐣ユ潯浠?
   *
   * 鏀寔鐨勫€? '1m', '5m', '15m', '1h', '4h', '1d'
   */
  timeframe: MarketTimeframe
  /**
   * 鍐峰嵈鏃堕棿锛堝垎閽燂級锛屽悓涓€浜ゆ槗瀵瑰湪姝ゆ椂闂村唴涓嶄細閲嶅鐢熸垚淇″彿
   *
   * @default 鍙栧喅浜庡叏灞€閰嶇疆
   * @min 1
   * @max 1440 (24灏忔椂)
   */
  cooldownMinutes?: number
}

/**
 * 绛栫暐鏁版嵁闇€姹?- 瀹氫箟姣忎釜 leg 闇€瑕佸姞杞界殑鏃堕棿鍛ㄦ湡鏁版嵁
 *
 * 浣跨敤 Record 绫诲瀷灏?leg id 鏄犲皠鍒板叾鎵€闇€鐨勬椂闂村懆鏈熸暟缁勩€?
 * 杩欏厑璁哥瓥鐣ヤ负涓嶅悓鐨?leg 璇锋眰涓嶅悓鐨勬暟鎹懆鏈熴€?
 *
 * @example
 * ```typescript
 * {
 *   "btc": ["15m", "1h", "4h", "1d"],  // BTC leg 闇€瑕?4 涓懆鏈熺殑鏁版嵁
 *   "eth": ["1h"],                     // ETH leg 鍙渶瑕?1h 鏁版嵁
 *   "dxy": ["1d"]                      // DXY leg 鍙渶瑕佹棩绾挎暟鎹?
 * }
 * ```
 *
 * @remarks
 * - 鎵€鏈?leg id 蹇呴』鍦?`legs` 鏁扮粍涓瓨鍦?
 * - 姣忎釜 leg 蹇呴』鑷冲皯瀹氫箟涓€涓?timeframe
 * - 鎬荤殑 timeframe 鏁伴噺涓嶅簲瓒呰繃绯荤粺闄愬埗锛堥粯璁?20锛?
 */
export type StrategyDataRequirements = Record<string, MarketTimeframe[]>

export const STRATEGY_STATUS_VALUES = ['draft', 'testing', 'live', 'disabled'] as const

export type StrategyStatus = (typeof STRATEGY_STATUS_VALUES)[number]

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[]
