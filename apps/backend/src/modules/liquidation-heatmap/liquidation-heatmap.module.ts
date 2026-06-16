import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { LiquidationHeatmapController } from './liquidation-heatmap.controller'
import { LiquidationHeatmapRepository } from './liquidation-heatmap.repository'
import { LiquidationHeatmapService } from './liquidation-heatmap.service'

@Module({
  imports: [AuthModule],
  controllers: [LiquidationHeatmapController],
  providers: [LiquidationHeatmapRepository, LiquidationHeatmapService],
  exports: [LiquidationHeatmapRepository],
})
export class LiquidationHeatmapModule {}


