import { Module } from '@nestjs/common'

import { AiModule } from '@/modules/ai/ai.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { LiveLlmStrategyCodegenController } from './controllers/live-llm-strategy-codegen.controller'
import { CodegenSessionsRepository } from './repositories/codegen-sessions.repository'
import { PublishedStrategySnapshotsRepository } from './repositories/published-strategy-snapshots.repository'
import { CallerIdentityService } from './services/caller-identity.service'
import { CanonicalSpecBuilderService } from './services/canonical-spec-builder.service'
import { CanonicalSpecV2DigestService } from './services/canonical-spec-v2-digest.service'
import { CanonicalSpecV2ValidatorService } from './services/canonical-spec-v2-validator.service'
import { CompiledPublicationGateService } from './services/compiled-publication-gate.service'
import { CompiledScriptParserService } from './services/compiled-script-parser.service'
import { ChecklistGateService } from './services/checklist-gate.service'
import { CodegenConversationService } from './services/codegen-conversation.service'
import { RecommendationIndexService } from './services/recommendation-index.service'
import { RuntimeGuardrailService } from './services/runtime-guardrail.service'
import { ScriptProfileExtractorService } from './services/script-profile-extractor.service'
import { StrategyClarificationQuestionService } from './services/strategy-clarification-question.service'
import { StrategyClarificationRulesService } from './services/strategy-clarification-rules.service'
import { SpecDescBuilderService } from './services/spec-desc-builder.service'
import { StaticGuardrailService } from './services/static-guardrail.service'
import { StrategyConsistencyService } from './services/strategy-consistency.service'
import { StrategySummaryBuilderService } from './services/strategy-summary-builder.service'

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
    CanonicalSpecV2DigestService,
    CanonicalSpecV2ValidatorService,
    CompiledScriptParserService,
    CompiledPublicationGateService,
    ScriptProfileExtractorService,
    StrategyConsistencyService,
    StrategySummaryBuilderService,
    StrategyClarificationRulesService,
    StrategyClarificationQuestionService,
    RecommendationIndexService,
    CallerIdentityService,
    CodegenConversationService,
  ],
  exports: [CodegenConversationService],
})
export class LlmStrategyCodegenModule {}
