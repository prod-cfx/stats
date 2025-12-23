/**
 * API 错误处理工具函数
 */
export const handleApiError = (error: unknown, defaultMessage: string): string => {
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }
    
    // 处理可能的验证错误
    if ('errors' in error && Array.isArray(error.errors)) {
      return error.errors.map((e: any) => e.message || String(e)).join('; ')
    }
  }
  
  return defaultMessage
}
