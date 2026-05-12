import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { shardingConfig } from '@/config/configuration'
import { WorkloadShardingService } from './services/workload-sharding.service'

@Module({
  imports: [ConfigModule.forFeature(shardingConfig)],
  providers: [WorkloadShardingService],
  exports: [WorkloadShardingService],
})
export class ShardingModule {}
