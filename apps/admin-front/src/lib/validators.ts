import type { StrategyLeg } from './api'

/**
 * 验证 Leg ID 唯一性
 */
export const validateUniqueLegIds = (_: any, legs: StrategyLeg[]) => {
  if (!legs || legs.length === 0) {
    return Promise.reject(new Error('至少需要一个 Leg'))
  }
  
  const ids = legs.map(leg => leg.id).filter(Boolean)
  const uniqueIds = new Set(ids)
  
  if (ids.length !== uniqueIds.size) {
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
    return Promise.reject(new Error(`Leg ID 重复: ${[...new Set(duplicates)].join(', ')}`))
  }
  
  return Promise.resolve()
}

/**
 * 验证至少有一个 Primary Leg
 */
export const validatePrimaryLeg = (_: any, legs: StrategyLeg[]) => {
  if (!legs || legs.length === 0) {
    return Promise.reject(new Error('至少需要一个 Leg'))
  }
  
  const primaryLegs = legs.filter(leg => leg.role === 'primary')
  
  if (primaryLegs.length === 0) {
    return Promise.reject(new Error('至少需要一个主要交易对 (Primary Leg)'))
  }
  
  // 后端要求：必须恰好一个 primary leg
  if (primaryLegs.length > 1) {
    const primaryIds = primaryLegs.map(leg => leg.id).join(', ')
    return Promise.reject(
      new Error(`只能有一个主要交易对 (Primary Leg)，当前有 ${primaryLegs.length} 个：${primaryIds}`)
    )
  }
  
  return Promise.resolve()
}

/**
 * 验证 Leg ID 格式
 */
export const LEG_ID_PATTERN = /^[a-z0-9_]+$/
export const LEG_ID_RULES = [
  { required: true, message: '请输入 Leg ID' },
  { 
    pattern: LEG_ID_PATTERN,
    message: 'Leg ID 只能包含小写字母、数字和下划线' 
  },
  { 
    min: 1,
    max: 50, 
    message: 'Leg ID 长度应在 1-50 个字符之间' 
  }
]

/**
 * 验证交易对代码格式
 * 允许大写字母、数字、连字符、下划线和斜杠，与后端 VALID_SYMBOL_PATTERN 一致
 * 支持如：BTCUSDT, BTC-USD, XAU/USD, ETH_USDT 等格式
 */
export const SYMBOL_PATTERN = /^[A-Z0-9\-_/]+$/
export const SYMBOL_RULES = [
  { required: true, message: '请输入交易对代码' },
  { 
    pattern: SYMBOL_PATTERN,
    message: '交易对代码只能包含大写字母、数字、连字符(-)、下划线(_)和斜杠(/)' 
  },
  { 
    min: 3,
    max: 50, 
    message: '交易对代码长度应在 3-50 个字符之间' 
  }
]

