/**
 * Prisma 7 枚举映射工具
 *
 * Prisma 7 中，@map 指令使得枚举键名（应用层）和数据库值分离。
 * 例如: m1 @map("1m") 表示应用层使用 "m1"，数据库存储 "1m"
 */
import type { IndicatorType, MarketTimeframe } from '@ai/shared'
import { ErrorCode, MARKET_TIMEFRAMES } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line no-restricted-imports -- $Enums needed for Prisma 7 @map key-name mapping
import { $Enums } from '../../../generated/prisma'

export type PrismaMarketTimeframe = $Enums.MarketTimeframe
export type PrismaIndicatorType = $Enums.IndicatorType
export type PrismaSymbolStatus = $Enums.SymbolStatus

/**
 * 时间周期枚举键名常量
 * 用于类型安全的枚举映射
 */
export const PRISMA_TIMEFRAME: Record<string, PrismaMarketTimeframe> = {
  M1: 'm1' as PrismaMarketTimeframe,
  M3: 'm3' as PrismaMarketTimeframe,
  M5: 'm5' as PrismaMarketTimeframe,
  M15: 'm15' as PrismaMarketTimeframe,
  M30: 'm30' as PrismaMarketTimeframe,
  H1: 'h1' as PrismaMarketTimeframe,
  H4: 'h4' as PrismaMarketTimeframe,
  H6: 'h6' as PrismaMarketTimeframe,
  H8: 'h8' as PrismaMarketTimeframe,
  H12: 'h12' as PrismaMarketTimeframe,
  D1: 'd1' as PrismaMarketTimeframe,
  W1: 'w1' as PrismaMarketTimeframe,
} as const

const MARKET_TIMEFRAME_PRISMA_MAP = {
  '1m': PRISMA_TIMEFRAME.M1,
  '3m': PRISMA_TIMEFRAME.M3,
  '5m': PRISMA_TIMEFRAME.M5,
  '15m': PRISMA_TIMEFRAME.M15,
  '30m': PRISMA_TIMEFRAME.M30,
  '1h': PRISMA_TIMEFRAME.H1,
  '4h': PRISMA_TIMEFRAME.H4,
  '6h': PRISMA_TIMEFRAME.H6,
  '8h': PRISMA_TIMEFRAME.H8,
  '12h': PRISMA_TIMEFRAME.H12,
  '1d': PRISMA_TIMEFRAME.D1,
  '1w': PRISMA_TIMEFRAME.W1,
} as const satisfies Record<MarketTimeframe, PrismaMarketTimeframe>

const PRISMA_MARKET_TIMEFRAME_MAP = Object.fromEntries(
  Object.entries(MARKET_TIMEFRAME_PRISMA_MAP).map(([appTimeframe, prismaTimeframe]) => [prismaTimeframe, appTimeframe]),
) as Record<PrismaMarketTimeframe, MarketTimeframe>

export const SUPPORTED_MARKET_TIMEFRAMES = MARKET_TIMEFRAMES satisfies readonly MarketTimeframe[]

/**
 * 将应用层时间周期映射为 Prisma 枚举键名
 * @param timeframe - 应用层时间周期（如 "1m", "5m"）
 * @param errorCode - 可选的错误码，默认是 INDICATOR_UNSUPPORTED_TIMEFRAME
 * @returns Prisma 枚举键名（如 "m1", "m5"）
 */
export function mapTimeframe(
  timeframe: MarketTimeframe,
  errorCode: ErrorCode = ErrorCode.INDICATOR_UNSUPPORTED_TIMEFRAME
): PrismaMarketTimeframe {
  const mapped = MARKET_TIMEFRAME_PRISMA_MAP[timeframe]
  if (!mapped) {
    throw new DomainException(`Unsupported timeframe: ${timeframe}`, {
      code: errorCode,
      args: { timeframe },
    })
  }
  return mapped
}

/**
 * 将 Prisma 枚举值映射回应用层时间周期
 * Prisma 从数据库读取时返回枚举键名（如 "m1"），需要转换回应用层格式（如 "1m"）
 * @param timeframe - Prisma 枚举值（枚举键名）
 * @returns 应用层时间周期（数据库存储格式）
 * @throws DomainException 当枚举值无效时
 */
export function reverseMapTimeframe(timeframe: PrismaMarketTimeframe): MarketTimeframe {
  const mapped = PRISMA_MARKET_TIMEFRAME_MAP[timeframe]
  if (!mapped) {
    throw new DomainException(`Unsupported Prisma timeframe: ${timeframe}`, {
      code: ErrorCode.INDICATOR_UNSUPPORTED_TIMEFRAME,
      args: { timeframe },
    })
  }
  return mapped
}

/**
 * 将应用层指标类型映射为 Prisma 枚举
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
 * 符号状态映射
 * @param status - 应用层符号状态
 * @returns Prisma 枚举值
 * @throws DomainException 当状态值无效时
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
