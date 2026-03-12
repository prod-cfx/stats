import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { PrismaModule } from '@/prisma/prisma.module'

import { AiService } from './ai.service'
import { LlmV3ToolsExecutor } from './llm-v3-tools.executor'

@Module({
  // 鏄惧紡瀵煎叆 ConfigModule锛岀‘淇濆湪 Swagger 瀵煎嚭绛夐潪 HTTP 鍚姩鍦烘櫙涓?ConfigService 渚濊禆鍙敤
  imports: [ConfigModule, PrismaModule],
  providers: [AiService, LlmV3ToolsExecutor],
  exports: [AiService, LlmV3ToolsExecutor],
})
export class AiModule {}
