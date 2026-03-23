import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AggregatedLiquidationController } from './aggregated-liquidation.controller'
import { AggregatedLiquidationRepository } from './aggregated-liquidation.repository'
import { AggregatedLiquidationService } from './aggregated-liquidation.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AggregatedLiquidationController],
  providers: [AggregatedLiquidationService, AggregatedLiquidationRepository],
  exports: [AggregatedLiquidationService],
})
export class AggregatedLiquidationModule {}







