import { Module } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { HyperliquidApiService, WhalePerformanceService, WhaleSnapshotService } from './services'
import { WhaleTrackingController } from './whale-tracking.controller'
import { WhaleTrackingRepository } from './whale-tracking.repository'
import { WhaleTrackingService } from './whale-tracking.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WhaleTrackingController],
  providers: [
    WhaleTrackingService,
    HyperliquidApiService,
    WhalePerformanceService,
    WhaleSnapshotService,
    WhaleTrackingRepository,
  ],
  exports: [WhaleTrackingService, HyperliquidApiService],
})
export class WhaleTrackingModule {}






