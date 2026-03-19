import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AggregatedLiquidationController } from './aggregated-liquidation.controller'
import { AggregatedLiquidationService } from './aggregated-liquidation.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AggregatedLiquidationController],
  providers: [AggregatedLiquidationService],
  exports: [AggregatedLiquidationService],
})
export class AggregatedLiquidationModule {}







