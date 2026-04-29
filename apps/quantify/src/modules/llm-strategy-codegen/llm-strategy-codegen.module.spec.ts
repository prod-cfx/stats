import { MODULE_METADATA } from '@nestjs/common/constants'
import { CanonicalSpecV2IrCompilerService } from './services/canonical-spec-v2-ir-compiler.service'
import { CodegenGraphSnapshotService } from './services/codegen-graph-snapshot.service'
import { LlmStrategyCodegenModule } from './llm-strategy-codegen.module'

describe('LlmStrategyCodegenModule', () => {
  it('registers providers required by the canonical spec v2 IR compiler constructor', () => {
    const compilerDependencies = Reflect.getMetadata('design:paramtypes', CanonicalSpecV2IrCompilerService)
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, LlmStrategyCodegenModule)

    expect(compilerDependencies).toContain(CodegenGraphSnapshotService)
    expect(providers).toContain(CodegenGraphSnapshotService)
  })
})
