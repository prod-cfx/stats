import { Module } from '@nestjs/common'

import { AiModule } from '@/modules/ai/ai.module'
import { PrismaModule } from '@/prisma/prisma.module'

import { OpsStrategyTemplatesController } from './controllers/ops-strategy-templates.controller'
import { StrategyTemplatesRepository } from './repositories/strategy-templates.repository'
import { StrategyTemplatesService } from './services/strategy-templates.service'

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [OpsStrategyTemplatesController],
  providers: [StrategyTemplatesService, StrategyTemplatesRepository],
  exports: [StrategyTemplatesService],
})
export class StrategyTemplatesModule {}
