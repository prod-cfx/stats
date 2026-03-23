import type { PrismaModuleOptions } from './prisma.constants'
import { Global, Module } from '@nestjs/common'
import { TransactionEventsService } from '@/common/services/transaction-events.service'
import { PRISMA_OPTIONS } from './prisma.constants'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  providers: [
    {
      provide: PRISMA_OPTIONS,
      useValue: {
        monitoredTables: [],
      } satisfies PrismaModuleOptions,
    },
    PrismaService,
    TransactionEventsService,
  ],
  exports: [PrismaService, TransactionEventsService],
})
export class PrismaModule {}
