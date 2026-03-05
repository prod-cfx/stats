import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { WhaleNotificationInboxController } from './controllers/whale-notification-inbox.controller'
import { WhaleNotificationRulesController } from './controllers/whale-notification-rules.controller'
import { WhaleNotificationDeliveryRepository } from './repositories/whale-notification-delivery.repository'
import { WhaleNotificationRulesRepository } from './repositories/whale-notification-rules.repository'
import { WhaleNotificationDeduplicatorService } from './services/whale-notification-deduplicator.service'
import { WhaleNotificationInboxService } from './services/whale-notification-inbox.service'
import { WhaleNotificationMatcherService } from './services/whale-notification-matcher.service'
import { WhaleNotificationRulesService } from './services/whale-notification-rules.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WhaleNotificationRulesController, WhaleNotificationInboxController],
  providers: [
    WhaleNotificationDeliveryRepository,
    WhaleNotificationRulesRepository,
    WhaleNotificationRulesService,
    WhaleNotificationMatcherService,
    WhaleNotificationDeduplicatorService,
    WhaleNotificationInboxService,
  ],
  exports: [
    WhaleNotificationRulesService,
    WhaleNotificationMatcherService,
    WhaleNotificationDeduplicatorService,
    WhaleNotificationInboxService,
  ],
})
export class WhaleNotificationModule {}
