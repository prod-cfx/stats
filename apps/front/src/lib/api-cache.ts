/**
 * 简单的 API 请求缓存和去重工具
 * 用于避免重复请求和提升性能
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
}

// 内存缓存存储
const dataCache = new Map<string, CacheEntry<any>>()

// 进行中的请求（用于去重）
const pendingRequests = new Map<string, Promise<any>>()

/**
 * 带缓存和去重的请求包装器
 * 
 * @param key - 缓存键，应该唯一标识这个请求
 * @param fetcher - 实际的请求函数
 * @param ttl - 缓存有效期（毫秒），默认 60 秒
 * @returns Promise<T>
 */
export async function cachedRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 60000
): Promise<T> {
  // 1. 检查内存缓存
  const cached = dataCache.get(key)
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data
  }

  // 2. 检查是否有相同的请求正在进行（去重）
  const pending = pendingRequests.get(key)
  if (pending) {
    return pending
  }

  // 3. 发起新请求
  const promise = fetcher()
    .then((data) => {
      // 保存到缓存
      dataCache.set(key, {
        data,
        timestamp: Date.now(),
      })
      // 清除进行中的请求记录
      pendingRequests.delete(key)
      return data
    })
    .catch((error) => {
      // 请求失败也要清除进行中的记录
      pendingRequests.delete(key)
      throw error
    })

  // 记录进行中的请求
  pendingRequests.set(key, promise)
  
  return promise
}

/**
 * 手动清除缓存
 * 
 * @param key - 要清除的缓存键，不传则清除所有缓存
 */
export function clearCache(key?: string): void {
  if (key) {
    dataCache.delete(key)
    pendingRequests.delete(key)
  } else {
    dataCache.clear()
    pendingRequests.clear()
  }
}

/**
 * 使缓存失效（标记为过期）
 * 
 * @param pattern - 缓存键的匹配模式（正则表达式或字符串前缀）
 */
export function invalidateCache(pattern: string | RegExp): void {
  const isRegex = pattern instanceof RegExp
  const keys = Array.from(dataCache.keys())
  
  for (const key of keys) {
    const matches = isRegex 
      ? pattern.test(key)
      : key.startsWith(pattern)
    
    if (matches) {
      dataCache.delete(key)
    }
  }
}

/**
 * 生成缓存键的工具函数
 */
export const CacheKeys = {
  strategyInstance: (id: string) => `strategy-instance:${id}`,
  strategyList: (params?: Record<string, any>) => 
    `strategy-list:${JSON.stringify(params || {})}`,
  strategyInstanceSignals: (id: string, params?: Record<string, any>) =>
    `strategy-instance-signals:${id}:${JSON.stringify(params || {})}`,
  llmStrategyInstance: (id: string) => `llm-strategy-instance:${id}`,
  llmStrategyList: (params?: Record<string, any>) =>
    `llm-strategy-list:${JSON.stringify(params || {})}`,
  llmStrategyInstanceSignals: (id: string, params?: Record<string, any>) =>
    `llm-strategy-instance-signals:${id}:${JSON.stringify(params || {})}`,
  subscription: (id: string) => `subscription:${id}`,
  subscriptionList: (params?: Record<string, any>) => 
    `subscription-list:${JSON.stringify(params || {})}`,
  llmSubscription: (id: string) => `llm-subscription:${id}`,
  llmSubscriptionList: (params?: Record<string, any>) =>
    `llm-subscription-list:${JSON.stringify(params || {})}`,
  exchangeAccounts: () => 'exchange-accounts',
} as const

/**
 * 缓存配置
 */
export const CacheTTL = {
  SHORT: 10000,   // 10 秒
  MEDIUM: 30000,  // 30 秒
  LONG: 60000,    // 60 秒
  VERY_LONG: 300000, // 5 分钟
} as const
