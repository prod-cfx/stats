import { Module } from '@nestjs/common'
import { MailService } from '@/common/services/mail.service'
import { AuthModule } from '@/modules/auth/auth.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { WhaleNotificationInboxController } from './controllers/whale-notification-inbox.controller'
import { WhaleNotificationMetricsController } from './controllers/whale-notification-metrics.controller'
import { WhaleNotificationRulesController } from './controllers/whale-notification-rules.controller'
import { WhaleNotificationDeliveryRepository } from './repositories/whale-notification-delivery.repository'
import { WhaleNotificationRulesRepository } from './repositories/whale-notification-rules.repository'
import { WhaleNotificationDeduplicatorService } from './services/whale-notification-deduplicator.service'
import { WhaleNotificationDispatcherService } from './services/whale-notification-dispatcher.service'
import { WhaleNotificationInboxService } from './services/whale-notification-inbox.service'
import { WhaleNotificationMatcherService } from './services/whale-notification-matcher.service'
import { WhaleNotificationMetricsService } from './services/whale-notification-metrics.service'
import { WhaleNotificationOrchestratorService } from './services/whale-notification-orchestrator.service'
import { WhaleNotificationRulesService } from './services/whale-notification-rules.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WhaleNotificationRulesController, WhaleNotificationInboxController, WhaleNotificationMetricsController],
  providers: [
    MailService,
    WhaleNotificationDeliveryRepository,
    WhaleNotificationRulesRepository,
    WhaleNotificationRulesService,
    WhaleNotificationMatcherService,
    WhaleNotificationDeduplicatorService,
    WhaleNotificationDispatcherService,
    WhaleNotificationOrchestratorService,
    WhaleNotificationInboxService,
    WhaleNotificationMetricsService,
  ],
  exports: [
    WhaleNotificationRulesService,
    WhaleNotificationMatcherService,
    WhaleNotificationDeduplicatorService,
    WhaleNotificationOrchestratorService,
    WhaleNotificationInboxService,
    WhaleNotificationMetricsService,
  ],
})
export class WhaleNotificationModule {}
