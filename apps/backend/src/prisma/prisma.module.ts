import type { PrismaModuleOptions } from './prisma.constants'
import { Global, Module } from '@nestjs/common'
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
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
