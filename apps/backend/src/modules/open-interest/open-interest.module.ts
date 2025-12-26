import { Module } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'
import { OpenInterestController } from './open-interest.controller'
import { OpenInterestService } from './open-interest.service'

/**
 * 持仓量数据模块
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OpenInterestController],
  providers: [OpenInterestService],
  exports: [OpenInterestService],
})
export class OpenInterestModule {}
