/**
 * 解析错误对象并返回用户友好的错误消息
 */
export function resolveErrorMessage(error: unknown, fallback: string): string {
  if (!error) {
    return fallback
  }

  // 处理标准 Error 对象
  if (error instanceof Error) {
    return error.message || fallback
  }

  // 处理 API 响应错误对象
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>

    // 常见 API 错误结构: { message: string }
    if (typeof err.message === 'string' && err.message) {
      return err.message
    }

    // 嵌套错误结构: { error: { message: string } }
    if (typeof err.error === 'object' && err.error !== null) {
      const nested = err.error as Record<string, unknown>
      if (typeof nested.message === 'string' && nested.message) {
        return nested.message
      }
    }

    // 响应体结构: { data: { message: string } }
    if (typeof err.data === 'object' && err.data !== null) {
      const data = err.data as Record<string, unknown>
      if (typeof data.message === 'string' && data.message) {
        return data.message
      }
    }
  }

  // 字符串错误
  if (typeof error === 'string' && error) {
    return error
  }

  return fallback
}
