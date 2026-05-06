import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { MastraService } from './mastra.service'

/**
 * Mastra 基础设施模块（Phase 1 脚手架）。
 *
 * @Global 决策：Phase 2 起将有多模块（codegen / llm-strategies / ai）注入 MastraService，
 * 提前 @Global 避免后续每次迁移都要改 module imports。与参考项目 apps/backend 风格一致。
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [MastraService],
  exports: [MastraService],
})
export class MastraModule {}
