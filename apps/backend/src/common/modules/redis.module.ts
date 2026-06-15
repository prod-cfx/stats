import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EnvModule } from './env.module'
import { RedisService } from '../services/redis.service'

@Global()
@Module({
  imports: [ConfigModule, EnvModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}


