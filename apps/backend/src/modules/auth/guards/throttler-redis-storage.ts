import type { ThrottlerStorage } from '@nestjs/throttler'
import type { Redis } from 'ioredis'
import { Injectable } from '@nestjs/common'
// NestJS 依赖注入需要 RedisService 的运行时类型，不能使用 `import type`
// eslint-disable-next-line ts/consistent-type-imports
import { RedisService } from '@/common/services/redis.service'

interface ThrottlerStorageRecord {
  totalHits: number
  timeToExpire: number
  isBlocked: boolean
  timeToBlockExpire: number
}

@Injectable()
export class ThrottlerRedisStorage implements ThrottlerStorage {
  private readonly client: Redis

  constructor(private readonly redisService: RedisService) {
    this.client = this.redisService.getClient()
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttler:${throttlerName}:${key}`
    const multi = this.client.multi()

    multi.incr(redisKey)
    multi.pttl(redisKey)

    const results = await multi.exec()

    if (!results) {
      throw new Error('Redis transaction failed')
    }

    const [[, totalHits], [, timeToExpire]] = results as [[null, number], [null, number]]

    // 如果是第一次访问（TTL 为 -1 或 -2），设置过期时间
    if (timeToExpire === -1 || timeToExpire === -2) {
      await this.client.pexpire(redisKey, ttl)
      return {
        totalHits,
        timeToExpire: ttl,
        isBlocked: totalHits > limit,
        timeToBlockExpire: totalHits > limit ? blockDuration : 0,
      }
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked: totalHits > limit,
      timeToBlockExpire: totalHits > limit ? blockDuration : 0,
    }
  }
}
