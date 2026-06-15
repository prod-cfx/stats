import { Module } from '@nestjs/common'
import { AccountExchangeAccountsModule } from '@/modules/account-exchange-accounts/account-exchange-accounts.module'
import { AuthModule } from '@/modules/auth/auth.module'
import { AccountAiQuantConversationsController } from './account-ai-quant-conversations.controller'
import { AccountAiQuantStrategiesController } from './account-ai-quant-strategies.controller'
import { AccountAiQuantStrategiesProxyService } from './account-ai-quant-strategies-proxy.service'
import { AiQuantProxyService } from './ai-quant-proxy.service'
import { AiQuantProxySupportService } from './ai-quant-proxy-support.service'
import { BacktestingProxyController } from './backtesting.controller'
import { QuantifyAiQuantClient } from './clients/quantify-ai-quant.client'
import { LlmStrategyCodegenController } from './llm-strategy-codegen.controller'
import { LlmStrategyInstancesController } from './llm-strategy-instances.controller'
import { LlmStrategyInstancesProxyService } from './llm-strategy-instances-proxy.service'
import { LlmStrategySubscriptionsController } from './llm-strategy-subscriptions.controller'
import { LlmStrategySubscriptionsProxyService } from './llm-strategy-subscriptions-proxy.service'
import { StrategyPlazaProxyController } from './strategy-plaza.controller'

@Module({
  imports: [AuthModule, AccountExchangeAccountsModule],
  controllers: [
    AccountAiQuantConversationsController,
    AccountAiQuantStrategiesController,
    BacktestingProxyController,
    LlmStrategyCodegenController,
    LlmStrategyInstancesController,
    LlmStrategySubscriptionsController,
    StrategyPlazaProxyController,
  ],
  providers: [
    AiQuantProxyService,
    AiQuantProxySupportService,
    AccountAiQuantStrategiesProxyService,
    LlmStrategyInstancesProxyService,
    LlmStrategySubscriptionsProxyService,
    QuantifyAiQuantClient,
  ],
})
export class AiQuantProxyModule {}
