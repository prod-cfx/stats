/**
 * 统一的API客户端工具
 * 处理Zodios在Next.js SSR环境中的路径参数问题
 */

import { createApiClient as createZodiosClient } from '@ai/api-contracts'

// 优先使用显式配置的基础地址（包含 /api/v1 前缀），与 admin-front 保持一致
// 若未配置 NEXT_PUBLIC_API_BASE_URL，则回退到旧逻辑：由 NEXT_PUBLIC_API_SERVER_URL 拼接 /api/v1
const EXPLICIT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '')
const SERVER_BASE_URL =
  process.env.NEXT_PUBLIC_API_SERVER_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'

export const API_BASE_URL = EXPLICIT_API_BASE_URL ?? `${SERVER_BASE_URL}/api/v1`

/**
 * Zodios客户端实例
 */
export const client = createZodiosClient(API_BASE_URL, { validate: 'request' })

/**
 * 验证ID参数格式（CUID格式）
 */
export function validateId(id: string, paramName = 'id'): void {
  // CUID格式: 25个字符，以c开头，由小写字母和数字组成
  if (!id || typeof id !== 'string') {
    throw new Error(`${paramName} must be a non-empty string`)
  }

  if (!/^c[a-z0-9]{24}$/i.test(id)) {
    throw new Error(`Invalid ${paramName} format: expected CUID format`)
  }

  // 防止路径参数注入
  if (id.includes('/') || id.includes('\\') || id.includes(':')) {
    throw new Error(`${paramName} contains invalid characters`)
  }
}

/**
 * 带有Zodios fallback的安全API调用
 * 
 * 解决问题：Zodios在Next.js SSR环境中无法正确替换路径参数
 * 
 * @param zodiosCall - Zodios客户端调用
 * @param fallbackConfig - Fallback配置
 * @param fallbackConfig.url - 备用URL
 * @param fallbackConfig.options - 备用请求选项
 * @param fallbackConfig.validateResponse - 响应验证函数
 */
export async function safeApiCall<T>(
  zodiosCall: () => Promise<T>,
  fallbackConfig: {
    url: string
    options?: RequestInit
    validateResponse?: (data: unknown) => T
  }
): Promise<T> {
  try {
    // 首先尝试使用 Zodios（提供类型安全和验证）
    return await zodiosCall()
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // 检测是否是路径参数替换失败
    // Zodios 失败的特征：请求 URL 中包含 :id, :accountId 等路径参数占位符
    const isPathParamIssue = errorMessage.includes(':id') || 
                            errorMessage.includes(':accountId') ||
                            errorMessage.includes(':subscriptionId') ||
                            /:\w+/.test(errorMessage)
    
    if (isPathParamIssue) {
      console.warn('[API Client] Zodios path parameter substitution failed, using fetch fallback')
      console.warn('[API Client] Error:', errorMessage)
      return performFetch(fallbackConfig)
    }
    
    // 其他错误直接抛出
    throw error
  }
}

/**
 * 执行 fetch 请求的通用函数
 */
async function performFetch<T>(fallbackConfig: {
  url: string
  options?: RequestInit
  validateResponse?: (data: unknown) => T
}): Promise<T> {
  // 使用fetch作为fallback
  const response = await fetch(fallbackConfig.url, {
    ...fallbackConfig.options,
    headers: {
      'Content-Type': 'application/json',
      ...fallbackConfig.options?.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText)
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }

  // 处理无响应体的情况（如 204 No Content）
  const contentType = response.headers.get('content-type')
  const contentLength = response.headers.get('content-length')
  
  // 204 No Content 或空响应体
  if (response.status === 204 || contentLength === '0') {
    if (fallbackConfig.validateResponse) {
      return fallbackConfig.validateResponse(undefined as unknown as T)
    }
    return undefined as T
  }

  // 只有当响应有内容时才解析 JSON
  if (!contentType || !contentType.includes('application/json')) {
    // 非 JSON 响应，尝试读取为文本
    const text = await response.text()
    if (!text) {
      if (fallbackConfig.validateResponse) {
        return fallbackConfig.validateResponse(undefined as unknown as T)
      }
      return undefined as T
    }
    // 尝试解析为 JSON
    try {
      const data = JSON.parse(text)
      if (fallbackConfig.validateResponse) {
        return fallbackConfig.validateResponse(data)
      }
      return data as T
    } catch {
      // 解析失败，作为纯文本返回
      throw new Error(`Unexpected response format: ${text}`)
    }
  }

  // 标准 JSON 响应
  const data = await response.json()
  
  // 如果提供了响应验证函数，使用它来验证数据
  if (fallbackConfig.validateResponse) {
    return fallbackConfig.validateResponse(data)
  }
  
  return data as T
}

/**
 * 构建带缓存的fetch选项（用于Next.js）
 */
export function buildCachedFetchOptions(
  cacheTime: number = 60,
  tags?: string[]
): RequestInit {
  return {
    next: {
      revalidate: cacheTime, // 缓存时间（秒）
      tags: tags || [], // 缓存标签，用于按需重新验证
    },
  }
}

/**
 * 从响应中解包数据
 * 处理 { data: T } 和直接返回 T 两种格式
 */
export function unwrapApiResponse<T>(response: T | { data?: T; message?: string }): T {
  if (response && typeof response === 'object' && 'data' in response) {
    const data = (response as { data?: T }).data
    if (data !== undefined) {
      return data
    }
  }
  return response as T
}
