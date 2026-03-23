import { Module } from '@nestjs/common'

import { AiModule } from '@/modules/ai/ai.module'
import { LlmSubscriptionsRepository } from '@/modules/llm-strategy-subscriptions/repositories/llm-subscriptions.repository'
import { PrismaModule } from '@/prisma/prisma.module'

import { LiveLlmStrategyInstancesController } from './controllers/live-llm-strategy-instances.controller'
import { OpsLlmStrategiesController } from './controllers/ops-llm-strategies.controller'
import { OpsLlmStrategyInstancesController } from './controllers/ops-llm-strategy-instances.controller'
import { LlmOrchestratedEngineV3 } from './llm-orchestrated-engine-v3.service'
import { LlmToolsService } from './llm-tools.service'
import {
  LlmStrategiesRepository,
  LlmStrategyInstancesRepository,
  LlmStrategyRunsRepository,
} from './repositories'
import { LiveLlmStrategyInstancesService } from './services/live-llm-strategy-instances.service'
import { LlmStrategiesService } from './services/llm-strategies.service'
import { LlmStrategyInstanceSchedulerService } from './services/llm-strategy-instance-scheduler.service'
import { LlmStrategyInstancesService } from './services/llm-strategy-instances.service'
import { LlmStrategyRunsService } from './services/llm-strategy-runs.service'

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [
    OpsLlmStrategiesController,
    OpsLlmStrategyInstancesController,
    LiveLlmStrategyInstancesController,
  ],
  providers: [
    LlmStrategiesRepository,
    LlmStrategyInstancesRepository,
    LlmStrategyRunsRepository,
    LlmSubscriptionsRepository,
    LlmStrategiesService,
    LlmStrategyInstancesService,
    LlmStrategyInstanceSchedulerService,
    LlmStrategyRunsService,
    LiveLlmStrategyInstancesService,
    LlmOrchestratedEngineV3,
    LlmToolsService,
  ],
  exports: [
    LlmStrategiesService,
    LlmStrategyInstancesService,
    LlmStrategyInstanceSchedulerService,
    LlmStrategyRunsService,
    LlmOrchestratedEngineV3,
    LlmToolsService,
  ],
})
export class LlmStrategiesModule {}
