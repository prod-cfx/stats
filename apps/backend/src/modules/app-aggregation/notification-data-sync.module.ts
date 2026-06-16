import { Module } from '@nestjs/common'
import { DataSyncModule } from '../data-sync/data-sync.module'
import { WhaleAlertModule } from '../whale-alert/whale-alert.module'
import { WhaleHoldingsModule } from '../whale-holdings/whale-holdings.module'
import { WhaleNotificationModule } from '../whale-notification/whale-notification.module'
import { WhaleTrackingModule } from '../whale-tracking/whale-tracking.module'

@Module({
  imports: [
    DataSyncModule,
    WhaleAlertModule,
    WhaleNotificationModule,
    WhaleTrackingModule,
    WhaleHoldingsModule,
  ],
})
export class NotificationDataSyncModule {}
