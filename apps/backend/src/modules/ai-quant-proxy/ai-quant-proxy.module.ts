import { Module } from '@nestjs/common'
import { AiQuantProxyService } from './ai-quant-proxy.service'
import { AccountAiQuantStrategiesController } from './account-ai-quant-strategies.controller'
import { LlmStrategyCodegenController } from './llm-strategy-codegen.controller'
import { LlmStrategyInstancesController } from './llm-strategy-instances.controller'
import { LlmStrategySubscriptionsController } from './llm-strategy-subscriptions.controller'
import { QuantifyAiQuantClient } from './clients/quantify-ai-quant.client'

@Module({
  controllers: [
    AccountAiQuantStrategiesController,
    LlmStrategyCodegenController,
    LlmStrategyInstancesController,
    LlmStrategySubscriptionsController,
  ],
  providers: [AiQuantProxyService, QuantifyAiQuantClient],
})
export class AiQuantProxyModule {}
