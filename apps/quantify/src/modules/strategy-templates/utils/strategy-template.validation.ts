import type { MarketTimeframe } from '@ai/shared'
import type {
  StrategyDataRequirements,
  StrategyExecutionConfig,
  StrategyLegDefinition,
} from '../types/strategy-template.types'
import { MARKET_TIMEFRAMES } from '@ai/shared'

export interface ValidationResult {
  valid: boolean
  message?: string
  details?: Record<string, unknown>
}

// 常量：限制数据需求的最大数量，防止资源耗尽
const MAX_TOTAL_TIMEFRAMES = 20
const MAX_LEGS = 10

/**
 * 验证 Symbol 格式
 * 允许大写字母、数字、连字符、下划线和斜杠，与 market_symbols.code 字符集一致
 * 防止注入攻击（不允许空格、引号、特殊字符等）
 */
const VALID_SYMBOL_PATTERN = /^[A-Z0-9\-_/]+$/

export const validateStrategyLegs = (
  legs?: StrategyLegDefinition[],
): ValidationResult => {
  if (!legs || legs.length === 0) {
    // 所有策略模板都必须至少定义一个 primary leg
    return {
      valid: false,
      message: '策略模板必须至少定义一个 primary leg',
    }
  }

  // 检查 legs 数量限制
  if (legs.length > MAX_LEGS) {
    return {
      valid: false,
      message: `leg 数量超过限制，最多允许 ${MAX_LEGS} 个，当前有 ${legs.length} 个`,
    }
  }

  const uniqueIds = new Set<string>()

  for (const leg of legs) {
    // 检查 leg id 唯一性
    if (uniqueIds.has(leg.id)) {
      return { valid: false, message: `存在重复的 leg id: ${leg.id}` }
    }
    uniqueIds.add(leg.id)

    // 检查 symbol 是否为空
    if (!leg.symbol || leg.symbol.trim() === '') {
      return { valid: false, message: `leg ${leg.id} 缺少 symbol` }
    }

    // 验证 symbol 格式（安全检查，防止注入攻击）
    if (!VALID_SYMBOL_PATTERN.test(leg.symbol)) {
      return {
        valid: false,
        message: `leg ${leg.id} 的 symbol 格式无效：${leg.symbol}，只允许大写字母和数字`,
      }
    }
  }

  // 检查 primary leg 数量（必须恰好为 1）
  const primaryLegs = legs.filter((leg) => leg.role === 'primary')
  if (primaryLegs.length === 0) {
    return { valid: false, message: '必须定义恰好一个 primary leg' }
  }
  if (primaryLegs.length > 1) {
    return {
      valid: false,
      message: `只能定义一个 primary leg，当前定义了 ${primaryLegs.length} 个：${primaryLegs.map(l => l.id).join(', ')}`,
      details: { primaryLegIds: primaryLegs.map(l => l.id) },
    }
  }

  return { valid: true }
}

/**
 * 验证策略执行配置
 */
export const validateExecutionConfig = (
  execution?: StrategyExecutionConfig,
): ValidationResult => {
  if (!execution) {
    return { valid: false, message: '必须提供策略执行配置 (execution)' }
  }

  if (!execution.timeframe) {
    return { valid: false, message: 'execution.timeframe 不能为空' }
  }

  if (!MARKET_TIMEFRAMES.includes(execution.timeframe)) {
    return {
      valid: false,
      message: `无效的 timeframe: ${execution.timeframe}，支持的值: ${MARKET_TIMEFRAMES.join(', ')}`,
    }
  }

  if (execution.cooldownMinutes !== undefined) {
    if (execution.cooldownMinutes < 1 || execution.cooldownMinutes > 1440) {
      return {
        valid: false,
        message: 'cooldownMinutes 必须在 1-1440 分钟之间',
      }
    }
  }

  return { valid: true }
}

/**
 * 验证数据需求配置
 */
export const validateDataRequirements = (
  dataRequirements?: StrategyDataRequirements,
  legs?: StrategyLegDefinition[],
): ValidationResult => {
  if (!dataRequirements) {
    return { valid: false, message: '必须提供数据需求配置 (dataRequirements)' }
  }

  const legIds = new Set(legs?.map(leg => leg.id) ?? [])
  const dataReqKeys = Object.keys(dataRequirements)

  // 检查 dataRequirements 中的每个 key 是否对应一个有效的 leg id
  for (const legId of dataReqKeys) {
    if (!legIds.has(legId)) {
      return {
        valid: false,
        message: `dataRequirements 中的 leg id "${legId}" 在 legs 定义中不存在`,
        details: { invalidLegId: legId, validLegIds: Array.from(legIds) },
      }
    }

    const timeframes = dataRequirements[legId]
    if (!Array.isArray(timeframes) || timeframes.length === 0) {
      return {
        valid: false,
        message: `leg "${legId}" 的 timeframes 必须是非空数组`,
      }
    }

    // 验证每个 timeframe 值
    for (const tf of timeframes) {
      if (!MARKET_TIMEFRAMES.includes(tf as MarketTimeframe)) {
        return {
          valid: false,
          message: `leg "${legId}" 包含无效的 timeframe: ${tf}，支持的值: ${MARKET_TIMEFRAMES.join(', ')}`,
        }
      }
    }

    // 检查是否有重复的 timeframe
    const uniqueTimeframes = new Set(timeframes)
    if (uniqueTimeframes.size !== timeframes.length) {
      return {
        valid: false,
        message: `leg "${legId}" 的 timeframes 存在重复值`,
      }
    }
  }

  // 检查每个 leg 是否都有对应的 dataRequirements
  for (const legId of legIds) {
    if (!dataReqKeys.includes(legId)) {
      return {
        valid: false,
        message: `leg "${legId}" 缺少对应的 dataRequirements 配置`,
      }
    }
  }

  // 检查总的 timeframe 数量限制，防止资源耗尽
  const totalTimeframes = Object.values(dataRequirements)
    .reduce((sum, tfs) => sum + tfs.length, 0)
  
  if (totalTimeframes > MAX_TOTAL_TIMEFRAMES) {
    return {
      valid: false,
      message: `数据需求过多，总共需要 ${totalTimeframes} 个时间周期的数据，最多允许 ${MAX_TOTAL_TIMEFRAMES} 个`,
      details: { totalTimeframes, maxAllowed: MAX_TOTAL_TIMEFRAMES },
    }
  }

  return { valid: true }
}

/**
 * 验证 execution.timeframe 与 dataRequirements 的一致性
 * 确保 primary leg 的 dataRequirements 包含 execution.timeframe
 */
export const validateExecutionDataConsistency = (
  execution?: StrategyExecutionConfig,
  legs?: StrategyLegDefinition[],
  dataRequirements?: StrategyDataRequirements,
): ValidationResult => {
  if (!execution || !legs || !dataRequirements) {
    return { valid: true } // 前置验证会处理缺失情况
  }

  const primaryLegs = legs.filter(leg => leg.role === 'primary')
  if (primaryLegs.length === 0) {
    return { valid: true } // 前置验证会处理
  }

  // 检查每个 primary leg 的 dataRequirements 是否包含 execution.timeframe
  for (const primaryLeg of primaryLegs) {
    const legTimeframes = dataRequirements[primaryLeg.id]
    if (!legTimeframes || !legTimeframes.includes(execution.timeframe)) {
      return {
        valid: false,
        message: `Primary leg "${primaryLeg.id}" 的 dataRequirements 必须包含 execution.timeframe (${execution.timeframe})`,
        details: {
          legId: primaryLeg.id,
          executionTimeframe: execution.timeframe,
          legTimeframes: legTimeframes || [],
        },
      }
    }
  }

  return { valid: true }
}

const findDuplicates = (items: string[]): string[] => {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const item of items) {
    if (seen.has(item)) {
      duplicates.add(item)
      continue
    }
    seen.add(item)
  }

  return Array.from(duplicates)
}

/**
 * @deprecated 使用 validateDataRequirements 替代
 */
export const validateRequiredFields = (
  requiredFields: string[],
): ValidationResult => {
  if (!requiredFields || requiredFields.length === 0) {
    return { valid: true }
  }

  const duplicates = findDuplicates(requiredFields)
  if (duplicates.length > 0) {
    return {
      valid: false,
      message: `requiredFields 存在重复值: ${duplicates.join(', ')}`,
      details: { duplicates },
    }
  }

  return { valid: true }
}


