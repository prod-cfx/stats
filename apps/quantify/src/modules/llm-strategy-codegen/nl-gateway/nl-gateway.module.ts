import { Module } from '@nestjs/common'

/**
 * NlGatewayModule
 * 当前仅承载 version-gate 纯函数（无 NestJS provider 需要注入）。
 * 后续 atom PR 可在此模块扩展 injectable provider。
 */
@Module({
  imports: [],
  providers: [],
  exports: [],
})
export class NlGatewayModule {}
