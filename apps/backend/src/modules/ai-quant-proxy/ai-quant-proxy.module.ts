import { Module } from '@nestjs/common'
import { AccountExchangeAccountsModule } from '@/modules/account-exchange-accounts/account-exchange-accounts.module'
import { AuthModule } from '@/modules/auth/auth.module'
import { AccountAiQuantStrategiesController } from './account-ai-quant-strategies.controller'
import { AiQuantProxyService } from './ai-quant-proxy.service'
import { BacktestingProxyController } from './backtesting.controller'
import { QuantifyAiQuantClient } from './clients/quantify-ai-quant.client'
import { LlmStrategyCodegenController } from './llm-strategy-codegen.controller'
import { LlmStrategyInstancesController } from './llm-strategy-instances.controller'
import { LlmStrategySubscriptionsController } from './llm-strategy-subscriptions.controller'

@Module({
  imports: [AuthModule, AccountExchangeAccountsModule],
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
