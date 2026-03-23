import { ClsPluginTransactional } from '@nestjs-cls/transactional'
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import { Module } from '@nestjs/common'
import { ClsModule } from 'nestjs-cls'
import { PrismaService } from '@/prisma/prisma.service'

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: false },
      plugins: [
        new ClsPluginTransactional({
          imports: [],
          adapter: new TransactionalAdapterPrisma({
            prismaInjectionToken: PrismaService,
          }),
        }),
      ],
    }),
  ],
  exports: [ClsModule],
})
export class ClsConfigModule {}
