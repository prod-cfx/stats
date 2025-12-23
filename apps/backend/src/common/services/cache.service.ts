import type { OnModuleInit } from '@nestjs/common'
import type Redis from 'ioredis'
import type { TTLInSeconds } from '../constants/cache.constants'
import { Inject, Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 RedisService，禁止改成 type-only
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
   * 从缓存获取数据
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
   * 设置缓存
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
   * 删除缓存
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
   * 清空缓存（仅删除 cache: 前缀的键，避免影响其他模块）
   * 使用批量删除策略，避免大规模缓存时的内存占用和 Redis 阻塞
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

        // 当批次达到阈值或扫描完成时，执行删除
        if (batch.length >= batchSize || cursor === '0') {
          if (batch.length > 0) {
            const pipeline = this.client.pipeline()
            for (const key of batch) {
              pipeline.unlink(key) // UNLINK 是异步删除，对 Redis 性能影响更小
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
   * 检查键是否存在
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
   * 缓存不存在时执行回调
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
   * 获取匹配模式的键（返回不带前缀的键名）
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
      // 移除前缀后返回
      return keys.map(key => key.replace(this.keyPrefix, ''))
    } catch (error) {
      this.logError('keys', pattern, error)
      return []
    }
  }

  /**
   * 删除匹配模式的键
   * 使用批量删除策略，避免大规模缓存时的内存占用和 Redis 阻塞
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

        // 当批次达到阈值或扫描完成时，执行删除
        if (batch.length >= batchSize || cursor === '0') {
          if (batch.length > 0) {
            const pipeline = this.client.pipeline()
            for (const key of batch) {
              pipeline.unlink(key) // UNLINK 是异步删除，对 Redis 性能影响更小
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
   * 分布式锁：仅在不存在时设置
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
   * 条件删除
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
   * 条件续期
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
   * 构建完整的 Redis 键（添加前缀）
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
