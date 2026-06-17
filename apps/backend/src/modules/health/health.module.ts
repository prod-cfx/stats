import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { HealthRepository } from './health.repository'
import { HealthService } from './health.service'
import { ShutdownStateService } from './shutdown-state.service'

@Module({
  controllers: [HealthController],
  providers: [HealthRepository, HealthService, ShutdownStateService],
})
export class HealthModule {}
