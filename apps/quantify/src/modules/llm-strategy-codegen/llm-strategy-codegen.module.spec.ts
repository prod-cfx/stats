import { MODULE_METADATA } from '@nestjs/common/constants'
import { CanonicalSpecV2IrCompilerService } from './services/canonical-spec-v2-ir-compiler.service'
import { CodegenGraphSnapshotService } from './services/codegen-graph-snapshot.service'
import { LlmStrategyCodegenModule } from './llm-strategy-codegen.module'
import { SemanticAtomContractService } from './services/semantic-atom-contract.service'
import { SemanticContractReadinessService } from './services/semantic-contract-readiness.service'

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

  it('emits semantic atom contract dependency metadata for semantic contract readiness', () => {
    const dependencies = Reflect.getMetadata('design:paramtypes', SemanticContractReadinessService)

    expect(dependencies).toContain(SemanticAtomContractService)
  })
})
