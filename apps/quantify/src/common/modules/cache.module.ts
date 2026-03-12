import { Global, Module } from '@nestjs/common'
import { CacheService } from '../services/cache.service'
import { RedisModule } from './redis.module'

@Global()
@Module({
  imports: [RedisModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
