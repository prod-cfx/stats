import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { AggregatedLiquidationController } from './aggregated-liquidation.controller'
import { AggregatedLiquidationRepository } from './aggregated-liquidation.repository'
import { AggregatedLiquidationService } from './aggregated-liquidation.service'

@Module({
  imports: [AuthModule],
  controllers: [AggregatedLiquidationController],
  providers: [AggregatedLiquidationService, AggregatedLiquidationRepository],
  exports: [AggregatedLiquidationService],
})
export class AggregatedLiquidationModule {}







