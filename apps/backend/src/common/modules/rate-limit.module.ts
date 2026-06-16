import { Global, Module } from '@nestjs/common'
import { seconds, ThrottlerModule } from '@nestjs/throttler'
import { ThrottlerRedisStorage } from '@/common/guards/throttler-redis-storage'
import { RedisModule } from './redis.module'
// NestJS 依赖注入需要 RedisService 的运行时类型，不能使用 `import type`
// eslint-disable-next-line ts/consistent-type-imports
import { RedisService } from '../services/redis.service'

@Global()
@Module({
  imports: [
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redisService: RedisService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: seconds(60),
            limit: 300,
          },
          {
            name: 'auth',
            ttl: seconds(60),
            limit: 20,
          },
        ],
        storage: new ThrottlerRedisStorage(redisService),
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
