import { Module } from '@nestjs/common'
import { TradingModule } from '@/modules/trading/trading.module'
import { ClientOrderIdFactoryService } from './services/client-order-id-factory.service'
import { OrderAdmissionGateService } from './services/order-admission-gate.service'
import { OrderNormalizerService } from './services/order-normalizer.service'
import { TradingExecutionService } from './services/trading-execution.service'

@Module({
  imports: [TradingModule],
  providers: [
    ClientOrderIdFactoryService,
    OrderNormalizerService,
    OrderAdmissionGateService,
    TradingExecutionService,
  ],
  exports: [TradingExecutionService],
})
export class TradingExecutionModule {}
