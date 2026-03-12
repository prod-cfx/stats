import { Module } from '@nestjs/common'

import { AiModule } from '@/modules/ai/ai.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { LiveLlmStrategyCodegenController } from './controllers/live-llm-strategy-codegen.controller'
import { CodegenSessionsRepository } from './repositories/codegen-sessions.repository'
import { ChecklistGateService } from './services/checklist-gate.service'
import { CodegenConversationService } from './services/codegen-conversation.service'
import { RecommendationIndexService } from './services/recommendation-index.service'
import { RuntimeGuardrailService } from './services/runtime-guardrail.service'
import { SpecDescBuilderService } from './services/spec-desc-builder.service'
import { StaticGuardrailService } from './services/static-guardrail.service'

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [LiveLlmStrategyCodegenController],
  providers: [
    CodegenSessionsRepository,
    ChecklistGateService,
    StaticGuardrailService,
    RuntimeGuardrailService,
    SpecDescBuilderService,
    RecommendationIndexService,
    CodegenConversationService,
  ],
  exports: [CodegenConversationService],
})
export class LlmStrategyCodegenModule {}
