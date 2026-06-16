import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'
import { ShutdownStateService } from './shutdown-state.service'

@Module({
  controllers: [HealthController],
  providers: [HealthService, ShutdownStateService],
})
export class HealthModule {}
