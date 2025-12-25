import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { OpenInterestController } from './open-interest.controller'
import { OpenInterestService } from './open-interest.service'

/**
 * 持仓量数据模块
 */
@Module({
  imports: [PrismaModule],
  controllers: [OpenInterestController],
  providers: [OpenInterestService],
  exports: [OpenInterestService],
})
export class OpenInterestModule {}
