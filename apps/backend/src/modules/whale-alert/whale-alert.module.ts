import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { WhaleAlertStreamController } from './controllers/whale-alert-stream.controller'
import { WhaleAlertIngestionModule } from './whale-alert-ingestion.module'
import { WhaleAlertController } from './whale-alert.controller'
import { WhaleAlertRepository } from './whale-alert.repository'
import { WhaleAlertService } from './whale-alert.service'

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WhaleAlertIngestionModule,
  ],
  controllers: [WhaleAlertController, WhaleAlertStreamController],
  providers: [WhaleAlertService, WhaleAlertRepository],
  exports: [WhaleAlertService],
})
export class WhaleAlertModule {}
