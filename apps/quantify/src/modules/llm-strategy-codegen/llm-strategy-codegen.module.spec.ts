import { MODULE_METADATA } from '@nestjs/common/constants'
import { CanonicalSpecV2IrCompilerService } from './services/canonical-spec-v2-ir-compiler.service'
import { CodegenGraphSnapshotService } from './services/codegen-graph-snapshot.service'
import { LlmStrategyCodegenModule } from './llm-strategy-codegen.module'
import { MarketInstrumentSymbolResolverService } from './services/market-instrument-symbol-resolver.service'
import { SemanticAtomContractService } from './services/semantic-atom-contract.service'
import { SemanticContractReadinessService } from './services/semantic-contract-readiness.service'
import { SemanticEventFrameParserService } from './services/semantic-event-frame-parser.service'
import { SemanticEventFrameProjectorService } from './services/semantic-event-frame-projector.service'
import { SemanticMissingPlaceholderReconcilerService } from './services/semantic-missing-placeholder-reconciler.service'
import { SemanticOpenSlotAnswerResolverService } from './services/semantic-open-slot-answer-resolver.service'
import { SemanticSeedExtractorService } from './services/semantic-seed-extractor.service'
import { PerTradeSizingResolver } from './services/per-trade-sizing-resolver.service'

describe('LlmStrategyCodegenModule', () => {
  it('registers providers required by the canonical spec v2 IR compiler constructor', () => {
    const compilerDependencies = Reflect.getMetadata('design:paramtypes', CanonicalSpecV2IrCompilerService)
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, LlmStrategyCodegenModule)

    expect(compilerDependencies).toContain(CodegenGraphSnapshotService)
    expect(providers).toContain(CodegenGraphSnapshotService)
  })

  it('registers the semantic atom contract resolver provider', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, LlmStrategyCodegenModule)

    expect(providers).toContain(SemanticAtomContractService)
  })

  it('registers the semantic contract readiness provider', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, LlmStrategyCodegenModule)

    expect(providers).toContain(SemanticContractReadinessService)
  })

  it('registers the semantic missing placeholder reconciler provider', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, LlmStrategyCodegenModule)

    expect(providers).toContain(SemanticMissingPlaceholderReconcilerService)
  })

  it('registers semantic event frame parser and projector providers', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, LlmStrategyCodegenModule)
    const dependencies = Reflect.getMetadata('design:paramtypes', SemanticSeedExtractorService)

    expect(providers).toContain(SemanticEventFrameParserService)
    expect(providers).toContain(SemanticEventFrameProjectorService)
    expect(dependencies).toEqual(expect.arrayContaining([
      SemanticEventFrameParserService,
      SemanticEventFrameProjectorService,
    ]))
  })

  it('registers the market instrument symbol resolver required by open slot answer resolution', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, LlmStrategyCodegenModule)
    const dependencies = Reflect.getMetadata('design:paramtypes', SemanticOpenSlotAnswerResolverService)

    expect(providers).toContain(MarketInstrumentSymbolResolverService)
    expect(dependencies).toContain(MarketInstrumentSymbolResolverService)
  })

  it('emits semantic atom contract dependency metadata for semantic contract readiness', () => {
    const dependencies = Reflect.getMetadata('design:paramtypes', SemanticContractReadinessService)

    expect(dependencies).toContain(SemanticAtomContractService)
  })

  // #1186 PR3 (decision 选项 A): readiness service multi-leg per_order_budget 判定共用 resolver；
  // 哨兵：DI 元数据中必须含 PerTradeSizingResolver，且 module providers 注册了同一实例。
  it('wires PerTradeSizingResolver into the semantic contract readiness service', () => {
    const dependencies = Reflect.getMetadata('design:paramtypes', SemanticContractReadinessService)
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, LlmStrategyCodegenModule)

    expect(dependencies).toContain(PerTradeSizingResolver)
    expect(providers).toContain(PerTradeSizingResolver)
  })
})
