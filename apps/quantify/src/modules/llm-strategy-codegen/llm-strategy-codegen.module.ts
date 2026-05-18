import { Module } from '@nestjs/common'

import { AccountStrategyViewModule } from '@/modules/account-strategy-view/account-strategy-view.module'
import { AiModule } from '@/modules/ai/ai.module'
import { LlmStrategiesModule } from '@/modules/llm-strategies/llm-strategies.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AccountAiQuantConversationsController } from './controllers/account-ai-quant-conversations.controller'
import { LiveLlmStrategyCodegenController } from './controllers/live-llm-strategy-codegen.controller'
import { NlGatewayModule } from './nl-gateway/nl-gateway.module'
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
import { CodegenGraphSnapshotService } from './services/codegen-graph-snapshot.service'
import { CodegenSessionPublicationPipelineService } from './services/codegen-session-publication-pipeline.service'
import { CompiledPublicationGateService } from './services/compiled-publication-gate.service'
import { CompiledScriptEmitterService } from './services/compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from './services/compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from './services/compiled-script-parser.service'
import { ConversationSemanticEditService } from './services/conversation-semantic-edit.service'
import { GenericSeedDispatcher } from './services/generic-seed-dispatcher.service'
import { MarketInstrumentSymbolResolverService } from './services/market-instrument-symbol-resolver.service'
import { NaturalLanguageGatewayService } from './services/natural-language-gateway.service'
import { PerTradeSizingResolver } from './services/per-trade-sizing-resolver.service'
import { PlannerDispatcherMergeService } from './services/planner-dispatcher-merge.service'
import { PositionSizingContractService } from './services/position-sizing-contract.service'
import { RecommendationIndexService } from './services/recommendation-index.service'
import { RuntimeGuardrailService } from './services/runtime-guardrail.service'
import { ScriptProfileExtractorService } from './services/script-profile-extractor.service'
import { SemanticAtomContractService } from './services/semantic-atom-contract.service'
import { SemanticAtomRegistryService } from './services/semantic-atom-registry.service'
import { SemanticClarificationQuestionRendererService } from './services/semantic-clarification-question-renderer.service'
import { SemanticContractReadinessService } from './services/semantic-contract-readiness.service'
import { SemanticContractShapeNormalizerService } from './services/semantic-contract-shape-normalizer.service'
import { SemanticEventFrameParserService } from './services/semantic-event-frame-parser.service'
import { SemanticEventFrameProjectorService } from './services/semantic-event-frame-projector.service'
import { SemanticExecutableSemanticsService } from './services/semantic-executable-semantics.service'
import { SemanticFrameNormalizerService } from './services/semantic-frame-normalizer.service'
import { SemanticOpenSlotAnswerResolverService } from './services/semantic-open-slot-answer-resolver.service'
import { SemanticOrchestrationRegistryService } from './services/semantic-orchestration-registry.service'
import { SemanticRuleProjectionService } from './services/semantic-rule-projection.service'
// M3: SemanticSeedExtractorService import 已移除（PR2c-final-1bc 清理：caller 切 GenericSeedDispatcher 后字段 0 引用）
// M5: SemanticPresentationRegistryService 已于 PR3c.7d 移除（切 pure helper，Issue #1279）
import { SemanticSeedStateBuilderService } from './services/semantic-seed-state-builder.service'
import { SemanticStateMergeService } from './services/semantic-state-merge.service'
import { SemanticStateProjectionService } from './services/semantic-state-projection.service'
import { SemanticStateReducerService } from './services/semantic-state-reducer.service'
import { SemanticSupportClassifierService } from './services/semantic-support-classifier.service'
import { SemanticTriggerCombinationContractService } from './services/semantic-trigger-combination-contract.service'
import { SpecDescBuilderService } from './services/spec-desc-builder.service'
import { StaticGuardrailService } from './services/static-guardrail.service'
import { StrategyClarificationQuestionService } from './services/strategy-clarification-question.service'
import { StrategyClarificationRulesService } from './services/strategy-clarification-rules.service'
import { StrategyCompileabilityDecisionService } from './services/strategy-compileability-decision.service'
import { StrategyConsistencyService } from './services/strategy-consistency.service'
import { StrategyExecutionContextService } from './services/strategy-execution-context.service'
import { StrategyIrBuilderService } from './services/strategy-ir-builder.service'
import { StrategyIrCanonicalAdapterService } from './services/strategy-ir-canonical-adapter.service'
import { StrategySummaryBuilderService } from './services/strategy-summary-builder.service'
import { StrategySummaryObservationService } from './services/strategy-summary-observation.service'
import { UnsupportedFallbackService } from './services/unsupported-fallback.service'

@Module({
  imports: [PrismaModule, AiModule, AccountStrategyViewModule, NlGatewayModule, LlmStrategiesModule],
  controllers: [AccountAiQuantConversationsController, LiveLlmStrategyCodegenController],
  providers: [
    AiQuantConversationsRepository,
    CodegenSessionsRepository,
    PublishedStrategySnapshotsRepository,
    StaticGuardrailService,
    RuntimeGuardrailService,
    // M4: GenericSeedDispatcher + SemanticSeedStateBuilderService 为 PR2c-final-1bc 双 provider 过渡态；
    // SemanticSeedExtractorService 已于 PR2c-final-1bc 删除（M3），legacy provider 不再注册。
    GenericSeedDispatcher,
    PlannerDispatcherMergeService,
    SemanticEventFrameParserService,
    SemanticEventFrameProjectorService,
    SemanticSeedStateBuilderService,
    SemanticStateMergeService,
    SemanticStateReducerService,
    SemanticStateProjectionService,
    SpecDescBuilderService,
    CanonicalSpecBuilderService,
    SemanticTriggerCombinationContractService,
    StrategyCompileabilityDecisionService,
    CanonicalSpecV2DigestService,
    CanonicalSpecV2ValidatorService,
    CanonicalStrategyIrValidatorService,
    CanonicalStrategyIrCanonicalizerService,
    CodegenGraphSnapshotService,
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
    StrategySummaryObservationService,
    StrategySummaryBuilderService,
    SemanticClarificationQuestionRendererService,
    StrategyClarificationRulesService,
    StrategyClarificationQuestionService,
    RecommendationIndexService,
    CallerIdentityService,
    CodegenSessionPublicationPipelineService,
    ConversationSemanticEditService,
    CodegenConversationService,
    PositionSizingContractService,
    SemanticAtomContractService,
    SemanticAtomRegistryService,
    SemanticOrchestrationRegistryService,
    SemanticRuleProjectionService,
    SemanticContractReadinessService,
    SemanticContractShapeNormalizerService,
    SemanticExecutableSemanticsService,
    MarketInstrumentSymbolResolverService,
    SemanticOpenSlotAnswerResolverService,
    SemanticSupportClassifierService,
    NaturalLanguageGatewayService,
    SemanticFrameNormalizerService,
    UnsupportedFallbackService,
    PerTradeSizingResolver,
  ],
  exports: [CallerIdentityService, CodegenConversationService],
})
export class LlmStrategyCodegenModule {}
