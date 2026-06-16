import { buildHealthPayload } from '@ai/shared'
import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { RedisService } from '@/common/services/redis.service'
import { PrismaService } from '@/prisma/prisma.service'
import { ShutdownStateService } from './shutdown-state.service'

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly shutdownState: ShutdownStateService,
  ) {}

  getHealth() {
    return buildHealthPayload('backend')
  }

  getLiveHealth() {
    return buildHealthPayload('backend')
  }

  async getReadyHealth() {
    if (this.shutdownState.isShuttingDown()) {
      throw new ServiceUnavailableException('Application is shutting down')
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`
      await this.redis.getClient().ping()
    } catch (error) {
      throw new ServiceUnavailableException('Backend dependencies are not ready', { cause: error })
    }

    return buildHealthPayload('backend')
  }
}
