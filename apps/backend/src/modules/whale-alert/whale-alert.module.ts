import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { WhaleAlertStreamController } from './controllers/whale-alert-stream.controller'
import { WhaleAlertController } from './whale-alert.controller'
import { WhaleAlertService } from './whale-alert.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WhaleAlertController, WhaleAlertStreamController],
  providers: [WhaleAlertService],
  exports: [WhaleAlertService],
})
export class WhaleAlertModule {}
