import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { PrismaModule } from '@/prisma/prisma.module'

import { AiService } from './ai.service'
import { LlmV3ToolsExecutor } from './llm-v3-tools.executor'

@Module({
  // 显式导入 ConfigModule，确保在 Swagger 导出等非 HTTP 启动场景下 ConfigService 依赖可用
  imports: [ConfigModule, PrismaModule],
  providers: [AiService, LlmV3ToolsExecutor],
  exports: [AiService, LlmV3ToolsExecutor],
})
export class AiModule {}
