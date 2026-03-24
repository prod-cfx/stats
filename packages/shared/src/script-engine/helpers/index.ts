/**
 * Script Engine Helpers - 策略脚本辅助函数库
 * 
 * 这个模块提供了一套完整的辅助函数，用于在沙箱环境中安全地执行量化交易策略脚本
 */

export type { SignalDirection, SignalType } from '../../generated/prisma-enums'
export * as arrayHelpers from './array-helpers'

// 导出上下文构建器和工具函数
export {
  buildStrategyContext,
  createExampleScript,
  createStrategyTemplate,
  getAvailableGlobals,
  validateSignalResult,
} from './context-builder'
export * as financeHelpers from './finance-helpers'
// 导出类型定义
export type {
  HelperFunctionDoc,
  StrategyContext,
  StrategyHelpers,
  StrategyParamsNormalized,
} from './helpers.types'

export { getHelperDocs } from './helpers.types'

export * as signalHelpers from './signal-helpers'
export type { Signal } from './signal-helpers'

export * as technicalIndicators from './technical-indicators'
export type { Bar } from './technical-indicators'
