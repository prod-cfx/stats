import type { OnModuleInit } from '@nestjs/common'
import type Redis from 'ioredis'
import type { TTLInSeconds } from '../constants/cache.constants'
import { Inject, Injectable, Logger } from '@nestjs/common'
// Nest 娉ㄥ叆闇€瑕佽繍琛屾椂寮曠敤 RedisService锛岀姝㈡敼鎴?type-only
import { RedisService } from './redis.service'

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name)
  private client!: Redis
  private readonly keyPrefix = 'cache:'

  constructor(
    @Inject(RedisService)
    private readonly redisService: RedisService,
  ) {
    this.logger.debug?.('[CacheService] constructor: redisService initialized')
  }

  onModuleInit() {
    this.logger.debug?.('[CacheService] onModuleInit: getting client...')
    this.client = this.redisService.getClient()
    this.logger.debug?.('[CacheService] onModuleInit: client obtained')
  }

  /**
   * 浠庣紦瀛樿幏鍙栨暟鎹?
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const fullKey = this.buildKey(key)
      const raw = await this.client.get(fullKey)
      if (!raw) return undefined
      return JSON.parse(raw) as T
    } catch (error) {
      this.logError('get', key, error)
      return undefined
    }
  }

  /**
   * 璁剧疆缂撳瓨
   */
  async set<T>(key: string, value: T, ttl?: TTLInSeconds): Promise<void> {
    try {
      const fullKey = this.buildKey(key)
      const serialized = JSON.stringify(value)
      if (ttl) {
        await this.client.setex(fullKey, ttl, serialized)
      } else {
        await this.client.set(fullKey, serialized)
      }
    } catch (error) {
      this.logError('set', key, error)
      throw error
    }
  }

  /**
   * 鍒犻櫎缂撳瓨
   */
  async del(key: string): Promise<void> {
    try {
      const fullKey = this.buildKey(key)
      await this.client.del(fullKey)
    } catch (error) {
      this.logError('del', key, error)
    }
  }

  /**
   * 娓呯┖缂撳瓨锛堜粎鍒犻櫎 cache: 鍓嶇紑鐨勯敭锛岄伩鍏嶅奖鍝嶅叾浠栨ā鍧楋級
   * 浣跨敤鎵归噺鍒犻櫎绛栫暐锛岄伩鍏嶅ぇ瑙勬ā缂撳瓨鏃剁殑鍐呭瓨鍗犵敤鍜?Redis 闃诲
   */
  async reset(): Promise<void> {
    try {
      const fullPattern = `${this.keyPrefix}*`
      const batchSize = 500
      let totalDeleted = 0
      let cursor = '0'
      let batch: string[] = []

      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100)
        cursor = nextCursor
        batch.push(...(keys as string[]))

        // 褰撴壒娆¤揪鍒伴槇鍊兼垨鎵弿瀹屾垚鏃讹紝鎵ц鍒犻櫎
        if (batch.length >= batchSize || cursor === '0') {
          if (batch.length > 0) {
            const pipeline = this.client.pipeline()
            for (const key of batch) {
              pipeline.unlink(key) // UNLINK 鏄紓姝ュ垹闄わ紝瀵?Redis 鎬ц兘褰卞搷鏇村皬
            }
            await pipeline.exec()
            totalDeleted += batch.length
            batch = []
          }
        }
      } while (cursor !== '0')

      if (totalDeleted > 0) {
        this.logger.log(`[CacheService] Cleared ${totalDeleted} cache keys with prefix: ${this.keyPrefix}`)
      }
    } catch (error) {
      this.logger.error('[CacheService] Failed to reset cache', error as Error)
      throw error
    }
  }

  /**
   * 妫€鏌ラ敭鏄惁瀛樺湪
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key)
      const result = await this.client.exists(fullKey)
      return result === 1
    } catch (error) {
      this.logError('exists', key, error)
      return false
    }
  }

  /**
   * 缂撳瓨涓嶅瓨鍦ㄦ椂鎵ц鍥炶皟
   */
  async getOrSet<T>(key: string, callback: () => Promise<T>, ttl?: TTLInSeconds): Promise<T> {
    const cachedValue = await this.get<T>(key)
    if (cachedValue !== undefined) {
      return cachedValue
    }

    try {
      const value = await callback()
      await this.set(key, value, ttl)
      return value
    } catch (error) {
      this.logError('getOrSet', key, error)
      throw error
    }
  }

  /**
   * 鑾峰彇鍖归厤妯″紡鐨勯敭锛堣繑鍥炰笉甯﹀墠缂€鐨勯敭鍚嶏級
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const fullPattern = this.buildKey(pattern)
      const keys: string[] = []
      let cursor = '0'
      do {
        const [nextCursor, batch] = await this.client.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100)
        cursor = nextCursor
        keys.push(...(batch as string[]))
      } while (cursor !== '0')
      // 绉婚櫎鍓嶇紑鍚庤繑鍥?
      return keys.map(key => key.replace(this.keyPrefix, ''))
    } catch (error) {
      this.logError('keys', pattern, error)
      return []
    }
  }

  /**
   * 鍒犻櫎鍖归厤妯″紡鐨勯敭
   * 浣跨敤鎵归噺鍒犻櫎绛栫暐锛岄伩鍏嶅ぇ瑙勬ā缂撳瓨鏃剁殑鍐呭瓨鍗犵敤鍜?Redis 闃诲
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      const fullPattern = this.buildKey(pattern)
      const batchSize = 500
      let cursor = '0'
      let batch: string[] = []

      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100)
        cursor = nextCursor
        batch.push(...(keys as string[]))

        // 褰撴壒娆¤揪鍒伴槇鍊兼垨鎵弿瀹屾垚鏃讹紝鎵ц鍒犻櫎
        if (batch.length >= batchSize || cursor === '0') {
          if (batch.length > 0) {
            const pipeline = this.client.pipeline()
            for (const key of batch) {
              pipeline.unlink(key) // UNLINK 鏄紓姝ュ垹闄わ紝瀵?Redis 鎬ц兘褰卞搷鏇村皬
            }
            await pipeline.exec()
            batch = []
          }
        }
      } while (cursor !== '0')
    } catch (error) {
      this.logError('delByPattern', pattern, error)
      throw error
    }
  }

  /**
   * 鍒嗗竷寮忛攣锛氫粎鍦ㄤ笉瀛樺湪鏃惰缃?
   */
  async setIfNotExists<T>(key: string, value: T, ttl?: TTLInSeconds): Promise<boolean> {
    const ttlInSeconds = ttl ?? 300
    try {
      const fullKey = this.buildKey(key)
      const result = await this.client.set(fullKey, JSON.stringify(value), 'EX', ttlInSeconds, 'NX')
      return result === 'OK'
    } catch (error) {
      this.logError('setIfNotExists', key, error)
      throw error
    }
  }

  /**
   * 鏉′欢鍒犻櫎
   */
  async deleteIfValue(key: string, expectedValue: unknown): Promise<boolean> {
    const lua = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `

    try {
      const fullKey = this.buildKey(key)
      const result = await this.client.eval(lua, 1, fullKey, JSON.stringify(expectedValue))
      return result === 1
    } catch (error) {
      this.logError('deleteIfValue', key, error)
      throw error
    }
  }

  /**
   * 鏉′欢缁湡
   */
  async refreshIfValue(key: string, expectedValue: unknown, ttl?: TTLInSeconds): Promise<boolean> {
    const ttlInSeconds = ttl ?? 300
    const lua = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], tonumber(ARGV[2]))
      else
        return 0
      end
    `

    try {
      const fullKey = this.buildKey(key)
      const result = await this.client.eval(
        lua,
        1,
        fullKey,
        JSON.stringify(expectedValue),
        String(ttlInSeconds),
      )
      return result === 1
    } catch (error) {
      this.logError('refreshIfValue', key, error)
      throw error
    }
  }

  /**
   * 鏋勫缓瀹屾暣鐨?Redis 閿紙娣诲姞鍓嶇紑锛?
   */
  private buildKey(key: string): string {
    return `${this.keyPrefix}${key}`
  }

  private logError(action: string, key: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    this.logger.error(`[CacheService] Failed to ${action} cache key ${key}: ${message}`, stack)
  }
}
