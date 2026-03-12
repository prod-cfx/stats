import { Module } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { InternalIndicatorsController } from './controllers/internal-indicators.controller'
import { OpsIndicatorConfigsController } from './controllers/ops-indicator-configs.controller'
import { IndicatorConfigRepository } from './repositories/indicator-config.repository'
import { IndicatorValueRepository } from './repositories/indicator-value.repository'
import { IndicatorConfigService } from './services/indicator-config.service'
import { IndicatorEngineService } from './services/indicator-engine.service'

@Module({
  imports: [PrismaModule],
  controllers: [OpsIndicatorConfigsController, InternalIndicatorsController],
  providers: [IndicatorConfigService, IndicatorConfigRepository, IndicatorValueRepository, IndicatorEngineService],
  exports: [IndicatorEngineService, IndicatorConfigService],
})
export class IndicatorsModule {}
