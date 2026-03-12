/**
 * Prisma 7 鏋氫妇鏄犲皠宸ュ叿
 *
 * Prisma 7 鐨?@map 鎸囦护浣垮緱鏋氫妇閿悕锛堝簲鐢ㄥ眰锛夊拰鏁版嵁搴撳€煎垎绂?
 * 渚嬪: m1 @map("1m") 琛ㄧず搴旂敤灞備娇鐢?"m1"锛屾暟鎹簱瀛樺偍 "1m"
 */
import type { IndicatorType, MarketTimeframe } from '@ai/shared'
import { ErrorCode } from '@ai/shared'
import { $Enums } from '@prisma/client'
import { DomainException } from '@/common/exceptions/domain.exception'

export type PrismaMarketTimeframe = $Enums.MarketTimeframe
export type PrismaIndicatorType = $Enums.IndicatorType
export type PrismaSymbolStatus = $Enums.SymbolStatus

/**
 * 鏃堕棿鍛ㄦ湡鏋氫妇閿悕甯搁噺
 * 鐢ㄤ簬绫诲瀷瀹夊叏鐨勬灇涓炬槧灏?
 */
export const PRISMA_TIMEFRAME: Record<string, PrismaMarketTimeframe> = {
  M1: 'm1' as PrismaMarketTimeframe,
  M5: 'm5' as PrismaMarketTimeframe,
  M15: 'm15' as PrismaMarketTimeframe,
  H1: 'h1' as PrismaMarketTimeframe,
  H4: 'h4' as PrismaMarketTimeframe,
  D1: 'd1' as PrismaMarketTimeframe,
} as const

/**
 * 灏嗗簲鐢ㄥ眰鏃堕棿鍛ㄦ湡鏄犲皠涓?Prisma 鏋氫妇閿悕
 * @param timeframe - 搴旂敤灞傛椂闂村懆鏈燂紙濡?"1m", "5m"锛?
 * @param errorCode - 鍙€夌殑閿欒鐮侊紝榛樿涓?INDICATOR_UNSUPPORTED_TIMEFRAME
 * @returns Prisma 鏋氫妇閿悕锛堝 "m1", "m5"锛?
 */
export function mapTimeframe(
  timeframe: MarketTimeframe,
  errorCode: ErrorCode = ErrorCode.INDICATOR_UNSUPPORTED_TIMEFRAME
): PrismaMarketTimeframe {
  const mapping: Record<string, PrismaMarketTimeframe> = {
    '1m': PRISMA_TIMEFRAME.M1,
    '5m': PRISMA_TIMEFRAME.M5,
    '15m': PRISMA_TIMEFRAME.M15,
    '1h': PRISMA_TIMEFRAME.H1,
    '4h': PRISMA_TIMEFRAME.H4,
    '1d': PRISMA_TIMEFRAME.D1,
  }

  const mapped = mapping[timeframe]
  if (!mapped) {
    throw new DomainException(`Unsupported timeframe: ${timeframe}`, {
      code: errorCode,
      args: { timeframe },
    })
  }
  return mapped
}

/**
 * 灏?Prisma 鏋氫妇鍊兼槧灏勫洖搴旂敤灞傛椂闂村懆鏈?
 * Prisma 浠庢暟鎹簱璇诲彇鏃惰繑鍥炴灇涓鹃敭鍚嶏紙濡?"m1"锛夛紝闇€瑕佽浆鎹㈠洖搴旂敤灞傛牸寮忥紙濡?"1m"锛?
 * @param timeframe - Prisma 鏋氫妇鍊硷紙鏋氫妇閿悕锛?
 * @returns 搴旂敤灞傛椂闂村懆鏈燂紙鏁版嵁搴撳瓨鍌ㄦ牸寮忥級
 * @throws DomainException 褰撴灇涓惧€兼棤鏁堟椂
 */
export function reverseMapTimeframe(timeframe: PrismaMarketTimeframe): MarketTimeframe {
  const reverseMapping: Record<string, MarketTimeframe> = {
    'm1': '1m',
    'm5': '5m',
    'm15': '15m',
    'h1': '1h',
    'h4': '4h',
    'd1': '1d',
  }

  const mapped = reverseMapping[timeframe]
  if (!mapped) {
    throw new DomainException(`Unsupported Prisma timeframe: ${timeframe}`, {
      code: ErrorCode.INDICATOR_UNSUPPORTED_TIMEFRAME,
      args: { timeframe },
    })
  }
  return mapped
}

/**
 * 灏嗗簲鐢ㄥ眰鎸囨爣绫诲瀷鏄犲皠涓?Prisma 鏋氫妇
 */
export function mapIndicatorType(type: IndicatorType): PrismaIndicatorType {
  const mapping: Record<string, PrismaIndicatorType> = {
    'RET': $Enums.IndicatorType.RET,
    'MOVING_AVG': $Enums.IndicatorType.MOVING_AVG,
    'VOLATILITY': $Enums.IndicatorType.VOLATILITY,
    'VOLUME_RATIO': $Enums.IndicatorType.VOLUME_RATIO,
  }

  const mapped = mapping[type]
  if (!mapped) {
    throw new DomainException(`Unsupported indicator type: ${type}`, {
      code: ErrorCode.VALIDATION_ERROR,
      args: { type },
    })
  }
  return mapped
}

/**
 * 绗﹀彿鐘舵€佹槧灏?
 * @param status - 搴旂敤灞傜鍙风姸鎬?
 * @returns Prisma 鏋氫妇鍊?
 * @throws DomainException 褰撶姸鎬佸€兼棤鏁堟椂
 */
export function mapSymbolStatus(status: string): PrismaSymbolStatus {
  const upperStatus = status.toUpperCase()
  const statusMap: Record<string, PrismaSymbolStatus> = {
    'ACTIVE': $Enums.SymbolStatus.ACTIVE,
    'TRADING': $Enums.SymbolStatus.ACTIVE,
    'DISABLED': $Enums.SymbolStatus.DISABLED,
    'DELISTED': $Enums.SymbolStatus.DISABLED,
  }

  const mapped = statusMap[upperStatus]
  if (!mapped) {
    throw new DomainException(`Unsupported symbol status: ${status}`, {
      code: ErrorCode.VALIDATION_ERROR,
      args: { status },
    })
  }
  return mapped
}
