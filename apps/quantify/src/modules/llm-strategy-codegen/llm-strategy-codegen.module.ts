import { Module } from '@nestjs/common'

import { AiModule } from '@/modules/ai/ai.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { LiveLlmStrategyCodegenController } from './controllers/live-llm-strategy-codegen.controller'
import { CodegenSessionsRepository } from './repositories/codegen-sessions.repository'
import { PublishedStrategySnapshotsRepository } from './repositories/published-strategy-snapshots.repository'
import { CanonicalSpecBuilderService } from './services/canonical-spec-builder.service'
import { CallerIdentityService } from './services/caller-identity.service'
import { ChecklistGateService } from './services/checklist-gate.service'
import { CodegenConversationService } from './services/codegen-conversation.service'
import { RecommendationIndexService } from './services/recommendation-index.service'
import { RuntimeGuardrailService } from './services/runtime-guardrail.service'
import { ScriptProfileExtractorService } from './services/script-profile-extractor.service'
import { SpecDescBuilderService } from './services/spec-desc-builder.service'
import { StaticGuardrailService } from './services/static-guardrail.service'
import { StrategyConsistencyService } from './services/strategy-consistency.service'

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [LiveLlmStrategyCodegenController],
  providers: [
    CodegenSessionsRepository,
    PublishedStrategySnapshotsRepository,
    ChecklistGateService,
    StaticGuardrailService,
    RuntimeGuardrailService,
    SpecDescBuilderService,
    CanonicalSpecBuilderService,
    ScriptProfileExtractorService,
    StrategyConsistencyService,
    RecommendationIndexService,
    CallerIdentityService,
    CodegenConversationService,
  ],
  exports: [CodegenConversationService],
})
export class LlmStrategyCodegenModule {}
