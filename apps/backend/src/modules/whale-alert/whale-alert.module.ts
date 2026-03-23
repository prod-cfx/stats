import { forwardRef, Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { DataSyncModule } from '@/modules/data-sync/data-sync.module'
import { WhaleNotificationModule } from '@/modules/whale-notification/whale-notification.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { WhaleAlertStreamController } from './controllers/whale-alert-stream.controller'
import { WhaleAlertController } from './whale-alert.controller'
import { WhaleAlertRepository } from './whale-alert.repository'
import { WhaleAlertService } from './whale-alert.service'

@Module({
  imports: [PrismaModule, AuthModule, forwardRef(() => DataSyncModule), WhaleNotificationModule],
  controllers: [WhaleAlertController, WhaleAlertStreamController],
  providers: [WhaleAlertService, WhaleAlertRepository],
  exports: [WhaleAlertService],
})
export class WhaleAlertModule {}
