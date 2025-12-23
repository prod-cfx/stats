/**
 * 统一的 API 错误处理工具
 * 复用 @/lib/errors 中的 ApiError 类，避免类型不一致
 */

import { ApiError } from './errors'

// 重新导出 ApiError 以保持向后兼容
export { ApiError }

/**
 * 类型守卫：检查是否为 ApiError
 * 使用 duck typing 而不是 instanceof，以兼容不同模块间的类实例
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in (error as any) &&
      typeof (error as any).code === 'string')
  )
}

/**
 * 类型守卫：检查是否为包含 error.code 的 API 响应错误
 */
export function isApiErrorResponse(error: unknown): error is { 
  error: { code: string; message?: string }
  status?: number
  message?: string
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as any).error === 'object' &&
    (error as any).error !== null &&
    'code' in (error as any).error &&
    typeof (error as any).error.code === 'string'
  )
}

/**
 * 解析各种格式的错误为统一的 ApiError
 */
export function parseApiError(error: unknown): ApiError {
  // 已经是 ApiError
  if (isApiError(error)) {
    return error
  }
  
  // API 响应错误格式
  if (isApiErrorResponse(error)) {
    return new ApiError(
      error.error.message || error.message || 'API request failed',
      error.error.code,
      error.status,
      error
    )
  }
  
  // 标准 Error 对象
  if (error instanceof Error) {
    return new ApiError(
      error.message,
      'UNKNOWN_ERROR',
      undefined,
      error
    )
  }
  
  // 其他类型的错误
  return new ApiError(
    String(error),
    'UNKNOWN_ERROR',
    undefined,
    error
  )
}

/**
 * 检查是否为特定错误代码
 */
export function hasErrorCode(error: unknown, code: string): boolean {
  if (isApiError(error)) {
    return error.code === code
  }
  
  if (isApiErrorResponse(error)) {
    return error.error.code === code
  }
  
  return false
}

/**
 * 常见错误代码常量
 */
export const ErrorCodes = {
  SUBSCRIPTION_ALREADY_EXISTS: 'SUBSCRIPTION_ALREADY_EXISTS',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  STRATEGY_NOT_FOUND: 'STRATEGY_NOT_FOUND',
  EXCHANGE_ACCOUNT_NOT_FOUND: 'EXCHANGE_ACCOUNT_NOT_FOUND',
} as const
