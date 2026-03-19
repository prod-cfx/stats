import { Module } from '@nestjs/common'

import { PrismaModule } from '@/prisma/prisma.module'
import { SubscriptionsRepository } from './repositories/subscriptions.repository'
import { StrategySubscriptionsController } from './strategy-subscriptions.controller'
import { StrategySubscriptionsService } from './strategy-subscriptions.service'

@Module({
  imports: [PrismaModule],
  controllers: [StrategySubscriptionsController],
  providers: [StrategySubscriptionsService, SubscriptionsRepository],
  exports: [StrategySubscriptionsService],
})
export class StrategySubscriptionsModule {}
