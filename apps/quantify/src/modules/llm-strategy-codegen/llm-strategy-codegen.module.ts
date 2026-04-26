import { Module } from '@nestjs/common'

import { AiModule } from '@/modules/ai/ai.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AccountAiQuantConversationsController } from './controllers/account-ai-quant-conversations.controller'
import { LiveLlmStrategyCodegenController } from './controllers/live-llm-strategy-codegen.controller'
import { AiQuantConversationsRepository } from './repositories/ai-quant-conversations.repository'
import { CodegenSessionsRepository } from './repositories/codegen-sessions.repository'
import { PublishedStrategySnapshotsRepository } from './repositories/published-strategy-snapshots.repository'
import { CallerIdentityService } from './services/caller-identity.service'
import { CanonicalSpecBuilderService } from './services/canonical-spec-builder.service'
import { CanonicalSpecV2DigestService } from './services/canonical-spec-v2-digest.service'
import { CanonicalSpecV2IrCompilerService } from './services/canonical-spec-v2-ir-compiler.service'
import { CanonicalSpecV2ValidatorService } from './services/canonical-spec-v2-validator.service'
import { CanonicalStrategyAstCompilerService } from './services/canonical-strategy-ast-compiler.service'
import { CanonicalStrategyIrCanonicalizerService } from './services/canonical-strategy-ir-canonicalizer.service'
import { CanonicalStrategyIrValidatorService } from './services/canonical-strategy-ir-validator.service'
import { CodegenConversationService } from './services/codegen-conversation.service'
import { CodegenSessionPublicationPipelineService } from './services/codegen-session-publication-pipeline.service'
import { CompiledPublicationGateService } from './services/compiled-publication-gate.service'
import { CompiledScriptEmitterService } from './services/compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from './services/compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from './services/compiled-script-parser.service'
import { ConversationSemanticEditService } from './services/conversation-semantic-edit.service'
import { RecommendationIndexService } from './services/recommendation-index.service'
import { RuntimeGuardrailService } from './services/runtime-guardrail.service'
import { ScriptProfileExtractorService } from './services/script-profile-extractor.service'
import { SemanticSeedExtractorService } from './services/semantic-seed-extractor.service'
import { SemanticStateProjectionService } from './services/semantic-state-projection.service'
import { SemanticStateMergeService } from './services/semantic-state-merge.service'
import { SemanticStateReducerService } from './services/semantic-state-reducer.service'
import { SpecDescBuilderService } from './services/spec-desc-builder.service'
import { StaticGuardrailService } from './services/static-guardrail.service'
import { StrategyClarificationQuestionService } from './services/strategy-clarification-question.service'
import { StrategyClarificationRulesService } from './services/strategy-clarification-rules.service'
import { StrategyCompileabilityDecisionService } from './services/strategy-compileability-decision.service'
import { StrategyConsistencyService } from './services/strategy-consistency.service'
import { StrategyExecutionContextService } from './services/strategy-execution-context.service'
import { StrategyIntentNormalizerService } from './services/strategy-intent-normalizer.service'
import { StrategyIntentResolutionService } from './services/strategy-intent-resolution.service'
import { StrategyIrBuilderService } from './services/strategy-ir-builder.service'
import { StrategyIrCanonicalAdapterService } from './services/strategy-ir-canonical-adapter.service'
import { StrategySummaryBuilderService } from './services/strategy-summary-builder.service'
import { StrategySummaryObservationService } from './services/strategy-summary-observation.service'

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [AccountAiQuantConversationsController, LiveLlmStrategyCodegenController],
  providers: [
    AiQuantConversationsRepository,
    CodegenSessionsRepository,
    PublishedStrategySnapshotsRepository,
    StaticGuardrailService,
    RuntimeGuardrailService,
    SemanticSeedExtractorService,
    SemanticStateMergeService,
    SemanticStateReducerService,
    SemanticStateProjectionService,
    SpecDescBuilderService,
    CanonicalSpecBuilderService,
    StrategyCompileabilityDecisionService,
    CanonicalSpecV2DigestService,
    CanonicalSpecV2ValidatorService,
    CanonicalStrategyIrValidatorService,
    CanonicalStrategyIrCanonicalizerService,
    CanonicalSpecV2IrCompilerService,
    CanonicalStrategyAstCompilerService,
    CompiledScriptParserService,
    CompiledScriptEmitterService,
    CompiledScriptExecutionEnvelopeService,
    CompiledPublicationGateService,
    ScriptProfileExtractorService,
    StrategyConsistencyService,
    StrategyExecutionContextService,
    StrategyIrBuilderService,
    StrategyIrCanonicalAdapterService,
    StrategyIntentNormalizerService,
    StrategyIntentResolutionService,
    StrategySummaryObservationService,
    StrategySummaryBuilderService,
    StrategyClarificationRulesService,
    StrategyClarificationQuestionService,
    RecommendationIndexService,
    CallerIdentityService,
    CodegenSessionPublicationPipelineService,
    ConversationSemanticEditService,
    CodegenConversationService,
  ],
  exports: [CallerIdentityService, CodegenConversationService],
})
export class LlmStrategyCodegenModule {}
