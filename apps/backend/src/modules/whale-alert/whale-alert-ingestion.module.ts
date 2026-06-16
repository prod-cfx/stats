import { Module } from '@nestjs/common'
import { WhaleNotificationModule } from '@/modules/whale-notification/whale-notification.module'
import { PrismaModule } from '@/prisma/prisma.module'
import {
  WHALE_ALERT_INGESTION_SERVICE,
  WhaleAlertIngestionService,
} from './whale-alert-ingestion.service'
import { WhaleAlertRepository } from './whale-alert.repository'

@Module({
  imports: [PrismaModule, WhaleNotificationModule],
  providers: [
    WhaleAlertRepository,
    WhaleAlertIngestionService,
    {
      provide: WHALE_ALERT_INGESTION_SERVICE,
      useExisting: WhaleAlertIngestionService,
    },
  ],
  exports: [WhaleAlertIngestionService, WHALE_ALERT_INGESTION_SERVICE],
})
export class WhaleAlertIngestionModule {}
