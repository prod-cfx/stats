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
 * 缓存配置
 */
export const CacheTTL = {
  SHORT: 10000,   // 10 秒
  MEDIUM: 30000,  // 30 秒
  LONG: 60000,    // 60 秒
  VERY_LONG: 300000, // 5 分钟
} as const
