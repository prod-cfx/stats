import { Module } from '@nestjs/common'

import { AccountsModule } from '@/modules/accounts/accounts.module'
import { PrismaModule } from '@/prisma/prisma.module'

import { LlmStrategySubscriptionsController } from './llm-strategy-subscriptions.controller'
import { LlmStrategySubscriptionsService } from './llm-strategy-subscriptions.service'
import { LlmSubscriptionsRepository } from './repositories/llm-subscriptions.repository'

@Module({
  imports: [PrismaModule, AccountsModule],
  controllers: [LlmStrategySubscriptionsController],
  providers: [LlmStrategySubscriptionsService, LlmSubscriptionsRepository],
  exports: [LlmStrategySubscriptionsService],
})
export class LlmStrategySubscriptionsModule {}
