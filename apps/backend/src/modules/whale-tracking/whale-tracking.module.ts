import { Module } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { WhaleTrackingController } from './whale-tracking.controller'
import { WhaleTrackingService } from './whale-tracking.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WhaleTrackingController],
  providers: [WhaleTrackingService],
  exports: [WhaleTrackingService],
})
export class WhaleTrackingModule {}


