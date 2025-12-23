import { Module } from '@nestjs/common'
import { ClsModule } from 'nestjs-cls'

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: false },
    }),
  ],
  exports: [ClsModule],
})
export class ClsConfigModule {}

