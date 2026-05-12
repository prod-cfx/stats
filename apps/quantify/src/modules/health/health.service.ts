import { buildHealthPayload } from '@ai/shared'
import { Inject, Injectable, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface ShardHealthMetadata {
  enabled: boolean
  count: number
  index: number
  activeStrategies: number
}

interface ShardingConfig {
  enabled?: boolean
  count?: number
  index?: number
}

@Injectable()
export class HealthService {
  constructor(
    @Optional()
    @Inject(ConfigService)
    private readonly configService?: Pick<ConfigService, 'get'>,
  ) {}

  getHealth() {
    return {
      ...buildHealthPayload('quantify'),
      shard: this.getShardMetadata(),
    }
  }

  private getShardMetadata(): ShardHealthMetadata {
    const sharding = this.configService?.get<ShardingConfig>('sharding') ?? {}

    return {
      enabled: sharding.enabled ?? false,
      count: sharding.count ?? 1,
      index: sharding.index ?? 0,
      activeStrategies: 0,
    }
  }
}
