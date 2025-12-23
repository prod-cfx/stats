import type { schemas } from '@ai/api-contracts'
import type { ZodTypeAny } from 'zod'

import { API_BASE_URL, unwrapApiResponse } from './api-client'
import { getServerAuthHeaders } from './server-auth'

type Infer<T extends ZodTypeAny> = T['_output']

export type UserLlmStrategyInstanceResponse = Infer<typeof schemas.UserLlmStrategyInstanceResponseDto>

interface PaginationParams {
  page: number
  limit: number
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * 在服务端获取 LLM 策略实例列表
 * 支持匿名访问，登录用户会看到 isSubscribed 状态
 * 
 * 注意：如果 token 失效（401/403），会自动降级为匿名请求重试
 * 这确保公开页面不会因为残留的过期 cookie 而无法访问
 */
export async function fetchLlmStrategyInstancesServer(
  params: PaginationParams,
): Promise<PaginatedResponse<UserLlmStrategyInstanceResponse>> {
  const authHeaders = await getServerAuthHeaders()
  
  const url = new URL(`${API_BASE_URL}/llm-strategy-instances`)
  url.searchParams.set('page', params.page.toString())
  url.searchParams.set('limit', params.limit.toString())

  // 第一次请求：带上 Authorization（如果有）
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    cache: 'no-store',
  })

  // 如果 token 失效（401/403），降级为匿名请求重试
  // 这是公开接口，匿名访问是允许的，只是看不到 isSubscribed 状态
  if ((response.status === 401 || response.status === 403) && authHeaders.Authorization) {
    console.warn('[server-api] Token invalid, retrying as anonymous request')
    
    const anonymousResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 不带 Authorization
      },
      cache: 'no-store',
    })
    
    if (!anonymousResponse.ok) {
      const error = new Error(`Failed to fetch strategies: ${anonymousResponse.statusText}`) as Error & { status?: number }
      error.status = anonymousResponse.status
      throw error
    }
    
    const json = await anonymousResponse.json()
    return unwrapApiResponse(json) as PaginatedResponse<UserLlmStrategyInstanceResponse>
  }

  if (!response.ok) {
    const error = new Error(`Failed to fetch strategies: ${response.statusText}`) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  const json = await response.json()
  return unwrapApiResponse(json) as PaginatedResponse<UserLlmStrategyInstanceResponse>
}

/**
 * 在服务端获取 LLM 策略实例详情
 * 支持匿名访问，登录用户会看到 isSubscribed 状态
 * 
 * 注意：如果 token 失效（401/403），会自动降级为匿名请求重试
 * 这确保公开页面不会因为残留的过期 cookie 而无法访问
 */
export async function fetchLlmStrategyInstanceDetailServer(
  id: string,
): Promise<UserLlmStrategyInstanceResponse> {
  const authHeaders = await getServerAuthHeaders()
  
  const url = `${API_BASE_URL}/llm-strategy-instances/${id}`

  // 第一次请求：带上 Authorization（如果有）
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    cache: 'no-store',
  })

  // 如果 token 失效（401/403），降级为匿名请求重试
  // 这是公开接口，匿名访问是允许的，只是看不到 isSubscribed 状态
  if ((response.status === 401 || response.status === 403) && authHeaders.Authorization) {
    console.warn('[server-api] Token invalid, retrying as anonymous request')
    
    const anonymousResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 不带 Authorization
      },
      cache: 'no-store',
    })
    
    if (!anonymousResponse.ok) {
      const error = new Error(`Failed to fetch strategy detail: ${anonymousResponse.statusText}`) as Error & { status?: number }
      error.status = anonymousResponse.status
      throw error
    }
    
    const json = await anonymousResponse.json()
    return unwrapApiResponse(json) as UserLlmStrategyInstanceResponse
  }

  if (!response.ok) {
    const error = new Error(`Failed to fetch strategy detail: ${response.statusText}`) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  const json = await response.json()
  return unwrapApiResponse(json) as UserLlmStrategyInstanceResponse
}
