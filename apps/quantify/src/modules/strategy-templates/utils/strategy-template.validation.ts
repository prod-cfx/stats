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

// 甯搁噺锛氶檺鍒舵暟鎹渶姹傜殑鏈€澶ф暟閲忥紝闃叉璧勬簮鑰楀敖
const MAX_TOTAL_TIMEFRAMES = 20
const MAX_LEGS = 10

/**
 * 楠岃瘉 Symbol 鏍煎紡
 * 鍏佽澶у啓瀛楁瘝銆佹暟瀛椼€佽繛瀛楃銆佷笅鍒掔嚎鍜屾枩鏉狅紝涓?market_symbols.code 瀛楃闆嗕竴鑷?
 * 闃叉娉ㄥ叆鏀诲嚮锛堜笉鍏佽绌烘牸銆佸紩鍙枫€佺壒娈婂瓧绗︾瓑锛?
 */
const VALID_SYMBOL_PATTERN = /^[A-Z0-9\-_/]+$/

export const validateStrategyLegs = (
  legs?: StrategyLegDefinition[],
): ValidationResult => {
  if (!legs || legs.length === 0) {
    // 鎵€鏈夌瓥鐣ユā鏉块兘蹇呴』鑷冲皯瀹氫箟涓€涓?primary leg
    return {
      valid: false,
      message: '绛栫暐妯℃澘蹇呴』鑷冲皯瀹氫箟涓€涓?primary leg',
    }
  }

  // 妫€鏌?legs 鏁伴噺闄愬埗
  if (legs.length > MAX_LEGS) {
    return {
      valid: false,
      message: `leg 鏁伴噺瓒呰繃闄愬埗锛屾渶澶氬厑璁?${MAX_LEGS} 涓紝褰撳墠鏈?${legs.length} 涓猔,
    }
  }

  const uniqueIds = new Set<string>()

  for (const leg of legs) {
    // 妫€鏌?leg id 鍞竴鎬?
    if (uniqueIds.has(leg.id)) {
      return { valid: false, message: `瀛樺湪閲嶅鐨?leg id: ${leg.id}` }
    }
    uniqueIds.add(leg.id)

    // 妫€鏌?symbol 鏄惁涓虹┖
    if (!leg.symbol || leg.symbol.trim() === '') {
      return { valid: false, message: `leg ${leg.id} 缂哄皯 symbol` }
    }

    // 楠岃瘉 symbol 鏍煎紡锛堝畨鍏ㄦ鏌ワ紝闃叉娉ㄥ叆鏀诲嚮锛?
    if (!VALID_SYMBOL_PATTERN.test(leg.symbol)) {
      return {
        valid: false,
        message: `leg ${leg.id} 鐨?symbol 鏍煎紡鏃犳晥锛?{leg.symbol}锛屽彧鍏佽澶у啓瀛楁瘝鍜屾暟瀛梎,
      }
    }
  }

  // 妫€鏌?primary leg 鏁伴噺锛堝繀椤绘伆濂戒负 1锛?
  const primaryLegs = legs.filter((leg) => leg.role === 'primary')
  if (primaryLegs.length === 0) {
    return { valid: false, message: '蹇呴』瀹氫箟鎭板ソ涓€涓?primary leg' }
  }
  if (primaryLegs.length > 1) {
    return {
      valid: false,
      message: `鍙兘瀹氫箟涓€涓?primary leg锛屽綋鍓嶅畾涔変簡 ${primaryLegs.length} 涓細${primaryLegs.map(l => l.id).join(', ')}`,
      details: { primaryLegIds: primaryLegs.map(l => l.id) },
    }
  }

  return { valid: true }
}

/**
 * 楠岃瘉绛栫暐鎵ц閰嶇疆
 */
export const validateExecutionConfig = (
  execution?: StrategyExecutionConfig,
): ValidationResult => {
  if (!execution) {
    return { valid: false, message: '蹇呴』鎻愪緵绛栫暐鎵ц閰嶇疆 (execution)' }
  }

  if (!execution.timeframe) {
    return { valid: false, message: 'execution.timeframe 涓嶈兘涓虹┖' }
  }

  if (!MARKET_TIMEFRAMES.includes(execution.timeframe)) {
    return {
      valid: false,
      message: `鏃犳晥鐨?timeframe: ${execution.timeframe}锛屾敮鎸佺殑鍊? ${MARKET_TIMEFRAMES.join(', ')}`,
    }
  }

  if (execution.cooldownMinutes !== undefined) {
    if (execution.cooldownMinutes < 1 || execution.cooldownMinutes > 1440) {
      return {
        valid: false,
        message: 'cooldownMinutes 蹇呴』鍦?1-1440 鍒嗛挓涔嬮棿',
      }
    }
  }

  return { valid: true }
}

/**
 * 楠岃瘉鏁版嵁闇€姹傞厤缃?
 */
export const validateDataRequirements = (
  dataRequirements?: StrategyDataRequirements,
  legs?: StrategyLegDefinition[],
): ValidationResult => {
  if (!dataRequirements) {
    return { valid: false, message: '蹇呴』鎻愪緵鏁版嵁闇€姹傞厤缃?(dataRequirements)' }
  }

  const legIds = new Set(legs?.map(leg => leg.id) ?? [])
  const dataReqKeys = Object.keys(dataRequirements)

  // 妫€鏌?dataRequirements 涓殑姣忎釜 key 鏄惁瀵瑰簲涓€涓湁鏁堢殑 leg id
  for (const legId of dataReqKeys) {
    if (!legIds.has(legId)) {
      return {
        valid: false,
        message: `dataRequirements 涓殑 leg id "${legId}" 鍦?legs 瀹氫箟涓笉瀛樺湪`,
        details: { invalidLegId: legId, validLegIds: Array.from(legIds) },
      }
    }

    const timeframes = dataRequirements[legId]
    if (!Array.isArray(timeframes) || timeframes.length === 0) {
      return {
        valid: false,
        message: `leg "${legId}" 鐨?timeframes 蹇呴』鏄潪绌烘暟缁刞,
      }
    }

    // 楠岃瘉姣忎釜 timeframe 鍊?
    for (const tf of timeframes) {
      if (!MARKET_TIMEFRAMES.includes(tf as MarketTimeframe)) {
        return {
          valid: false,
          message: `leg "${legId}" 鍖呭惈鏃犳晥鐨?timeframe: ${tf}锛屾敮鎸佺殑鍊? ${MARKET_TIMEFRAMES.join(', ')}`,
        }
      }
    }

    // 妫€鏌ユ槸鍚︽湁閲嶅鐨?timeframe
    const uniqueTimeframes = new Set(timeframes)
    if (uniqueTimeframes.size !== timeframes.length) {
      return {
        valid: false,
        message: `leg "${legId}" 鐨?timeframes 瀛樺湪閲嶅鍊糮,
      }
    }
  }

  // 妫€鏌ユ瘡涓?leg 鏄惁閮芥湁瀵瑰簲鐨?dataRequirements
  for (const legId of legIds) {
    if (!dataReqKeys.includes(legId)) {
      return {
        valid: false,
        message: `leg "${legId}" 缂哄皯瀵瑰簲鐨?dataRequirements 閰嶇疆`,
      }
    }
  }

  // 妫€鏌ユ€荤殑 timeframe 鏁伴噺闄愬埗锛岄槻姝㈣祫婧愯€楀敖
  const totalTimeframes = Object.values(dataRequirements)
    .reduce((sum, tfs) => sum + tfs.length, 0)

  if (totalTimeframes > MAX_TOTAL_TIMEFRAMES) {
    return {
      valid: false,
      message: `鏁版嵁闇€姹傝繃澶氾紝鎬诲叡闇€瑕?${totalTimeframes} 涓椂闂村懆鏈熺殑鏁版嵁锛屾渶澶氬厑璁?${MAX_TOTAL_TIMEFRAMES} 涓猔,
      details: { totalTimeframes, maxAllowed: MAX_TOTAL_TIMEFRAMES },
    }
  }

  return { valid: true }
}

/**
 * 楠岃瘉 execution.timeframe 涓?dataRequirements 鐨勪竴鑷存€?
 * 纭繚 primary leg 鐨?dataRequirements 鍖呭惈 execution.timeframe
 */
export const validateExecutionDataConsistency = (
  execution?: StrategyExecutionConfig,
  legs?: StrategyLegDefinition[],
  dataRequirements?: StrategyDataRequirements,
): ValidationResult => {
  if (!execution || !legs || !dataRequirements) {
    return { valid: true } // 鍓嶇疆楠岃瘉浼氬鐞嗙己澶辨儏鍐?
  }

  const primaryLegs = legs.filter(leg => leg.role === 'primary')
  if (primaryLegs.length === 0) {
    return { valid: true } // 鍓嶇疆楠岃瘉浼氬鐞?
  }

  // 妫€鏌ユ瘡涓?primary leg 鐨?dataRequirements 鏄惁鍖呭惈 execution.timeframe
  for (const primaryLeg of primaryLegs) {
    const legTimeframes = dataRequirements[primaryLeg.id]
    if (!legTimeframes || !legTimeframes.includes(execution.timeframe)) {
      return {
        valid: false,
        message: `Primary leg "${primaryLeg.id}" 鐨?dataRequirements 蹇呴』鍖呭惈 execution.timeframe (${execution.timeframe})`,
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
 * @deprecated 浣跨敤 validateDataRequirements 鏇夸唬
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
      message: `requiredFields 瀛樺湪閲嶅鍊? ${duplicates.join(', ')}`,
      details: { duplicates },
    }
  }

  return { valid: true }
}
