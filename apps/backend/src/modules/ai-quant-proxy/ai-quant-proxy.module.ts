import { Module } from '@nestjs/common'
import { AccountAiQuantStrategiesController } from './account-ai-quant-strategies.controller'
import { AiQuantProxyService } from './ai-quant-proxy.service'
import { BacktestingProxyController } from './backtesting.controller'
import { QuantifyAiQuantClient } from './clients/quantify-ai-quant.client'
import { LlmStrategyCodegenController } from './llm-strategy-codegen.controller'
import { LlmStrategyInstancesController } from './llm-strategy-instances.controller'
import { LlmStrategySubscriptionsController } from './llm-strategy-subscriptions.controller'

@Module({
  controllers: [
    AccountAiQuantStrategiesController,
    BacktestingProxyController,
    LlmStrategyCodegenController,
    LlmStrategyInstancesController,
    LlmStrategySubscriptionsController,
  ],
  providers: [AiQuantProxyService, QuantifyAiQuantClient],
})
export class AiQuantProxyModule {}
