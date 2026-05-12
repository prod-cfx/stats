import type { ShardingConfig } from '../types/sharding-config.type'
import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 ConfigService
import { ConfigService } from '@nestjs/config'

@Injectable()
export class WorkloadShardingService {
  constructor(private readonly configService: ConfigService) {}

  ownsStrategyInstance(strategyInstanceId: string, config = this.getConfig()): boolean {
    return this.belongsToShard(strategyInstanceId, config)
  }

  ownsUser(userId: string, config = this.getConfig()): boolean {
    return this.belongsToShard(userId, config)
  }

  belongsToShard(id: string, config = this.getConfig()): boolean {
    if (!config.enabled) return true
    if (config.count <= 1) return true
    if (config.index < 0 || config.index >= config.count) return false

    return this.getShardIndex(id, config.count) === config.index
  }

  getShardIndex(id: string, count: number): number {
    if (count <= 1) return 0

    const digest = createHash('sha256').update(id).digest()
    const hashPrefix = digest.readUInt32BE(0)
    return hashPrefix % count
  }

  private getConfig(): ShardingConfig {
    return this.configService.get<ShardingConfig>('sharding') ?? {
      enabled: false,
      count: 1,
      index: 0,
    }
  }
}
