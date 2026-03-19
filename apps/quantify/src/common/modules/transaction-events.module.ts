import { Global, Module } from '@nestjs/common'
import { TransactionEventsService } from '../services/transaction-events.service'

@Global()
@Module({
  providers: [TransactionEventsService],
  exports: [TransactionEventsService],
})
export class TransactionEventsModule {}
