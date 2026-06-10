import type { CodegenSemanticPatch } from '@/modules/llm-strategy-codegen/types/codegen-semantic-patch'
import type { Prisma } from '@/prisma/prisma.types'
import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import type { StrategyPlazaSourceSnapshotContent } from '../repositories/strategy-plaza-official-snapshot.repository'
import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { CanonicalSpecBuilderService } from '@/modules/llm-strategy-codegen/services/canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CodegenGraphSnapshotService } from '@/modules/llm-strategy-codegen/services/codegen-graph-snapshot.service'
import { CodegenPublicationGenerationStage } from '@/modules/llm-strategy-codegen/services/codegen-publication-generation.stage'
import { CompiledPublicationGateService } from '@/modules/llm-strategy-codegen/services/compiled-publication-gate.service'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '@/modules/llm-strategy-codegen/services/compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '@/modules/llm-strategy-codegen/services/compiled-script-parser.service'
import { GenericSeedDispatcher } from '@/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service'
import { ScriptProfileExtractorService } from '@/modules/llm-strategy-codegen/services/script-profile-extractor.service'
import { SemanticSeedStateBuilderService } from '@/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service'
import { SpecDescBuilderService } from '@/modules/llm-strategy-codegen/services/spec-desc-builder.service'
import { StrategyConsistencyService } from '@/modules/llm-strategy-codegen/services/strategy-consistency.service'
import { StrategySummaryBuilderService } from '@/modules/llm-strategy-codegen/services/strategy-summary-builder.service'
import { StrategySummaryObservationService } from '@/modules/llm-strategy-codegen/services/strategy-summary-observation.service'
import { StrategyPlazaOfficialSnapshotRepository } from '../repositories/strategy-plaza-official-snapshot.repository'
import { buildOfficialStrategySnapshotContent } from '../utils/official-strategy-plaza-snapshot-builder'
import {
  buildOfficialTemplateBacktestConfigDefaults,
  buildOfficialTemplateDataRequirements,
  buildOfficialTemplateDeploymentExecutionConstraints,
  buildOfficialTemplateDeploymentExecutionDefaults,
  buildOfficialTemplateParamsSnapshot,
  buildOfficialTemplateStrategyConfig,
} from '../utils/official-strategy-plaza-snapshot-content'

function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function sha256Text(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

@Injectable()
export class StrategyPlazaCompiledSnapshotService {
  private readonly generationStage: CodegenPublicationGenerationStage

  constructor(
    private readonly officialSnapshots: StrategyPlazaOfficialSnapshotRepository,
    private readonly seedDispatcher: GenericSeedDispatcher,
    private readonly seedStateBuilder: SemanticSeedStateBuilderService,
    canonicalSpecBuilder: CanonicalSpecBuilderService,
    specDescBuilder: SpecDescBuilderService,
    strategyConsistencyService: StrategyConsistencyService,
    strategySummaryBuilder: StrategySummaryBuilderService,
    canonicalSpecV2IrCompiler: CanonicalSpecV2IrCompilerService,
    canonicalStrategyAstCompiler: CanonicalStrategyAstCompilerService,
    compiledScriptEmitter: CompiledScriptEmitterService,
    compiledScriptExecutionEnvelope: CompiledScriptExecutionEnvelopeService,
    compiledScriptParser: CompiledScriptParserService,
    strategySummaryObservation: StrategySummaryObservationService,
    compiledPublicationGate: CompiledPublicationGateService,
    graphSnapshotService: CodegenGraphSnapshotService,
  ) {
    this.generationStage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      specDescBuilder,
      strategySummaryBuilder,
      strategyConsistencyService,
      canonicalSpecV2IrCompiler,
      canonicalStrategyAstCompiler,
      compiledScriptEmitter,
      compiledScriptExecutionEnvelope,
      compiledScriptParser,
      strategySummaryObservation,
      undefined,
      graphSnapshotService,
      compiledPublicationGate,
    )
  }

  async resolveExistingCompiledSnapshotForUser(input: {
    userId: string
    template: OfficialStrategyPlazaTemplate
  }) {
    const sourceContent = await this.buildCompiledSourceSnapshotContent(input.template)
    return this.officialSnapshots.resolveExistingOfficialSnapshotForUser({
      ...input,
      sourceContent,
    })
  }

  async resolveCompiledSnapshotForUser(input: {
    userId: string
    template: OfficialStrategyPlazaTemplate
  }) {
    const sourceContent = await this.buildCompiledSourceSnapshotContent(input.template)
    return this.officialSnapshots.resolveOfficialSnapshotForUser({
      ...input,
      sourceContent,
    })
  }

  private async buildCompiledSourceSnapshotContent(
    template: OfficialStrategyPlazaTemplate,
  ): Promise<StrategyPlazaSourceSnapshotContent> {
    const message = template.editSeed.initialMessage
    const patch = this.seedDispatcher.dispatch(message) as CodegenSemanticPatch
    const semanticState = this.seedStateBuilder.build(patch, message)
    if (!semanticState) {
      return this.buildFallbackOfficialSourceSnapshotContent(template)
    }

    const artifacts = await this.generationStage.generate({ semanticState }).catch(() => null)
    if (!artifacts) {
      return this.buildFallbackOfficialSourceSnapshotContent(template)
    }
    const scriptSnapshot = artifacts.compiledScript
    const scriptHash = sha256Text(scriptSnapshot)
    const runtimeContent = {
      paramsSnapshot: buildOfficialTemplateParamsSnapshot(template),
      strategyConfig: buildOfficialTemplateStrategyConfig(template),
      backtestConfigDefaults: buildOfficialTemplateBacktestConfigDefaults(template),
      deploymentExecutionDefaults: buildOfficialTemplateDeploymentExecutionDefaults(template),
      deploymentExecutionConstraints: buildOfficialTemplateDeploymentExecutionConstraints(template),
      dataRequirements: buildOfficialTemplateDataRequirements(template),
      lockedParams: buildOfficialTemplateParamsSnapshot(template),
    }
    const consistencyReport = {
      status: artifacts.semanticConsistency.status,
      semanticConsistency: artifacts.semanticConsistency,
      source: 'strategy-plaza-compiled-rules-template',
    }

    return {
      snapshotHash: sha256Json({ scriptHash, specSnapshot: artifacts.canonicalSpec, runtimeContent }),
      scriptHash,
      specHash: sha256Json(artifacts.canonicalSpec),
      irHash: sha256Json(artifacts.compiled.ir),
      astDigest: sha256Json(artifacts.ast),
      structuralDigest: sha256Json({ semanticGraph: artifacts.semanticPredicateGraph, astSnapshot: artifacts.ast }),
      scriptSnapshot,
      specSnapshot: artifacts.canonicalSpec as unknown as Prisma.InputJsonValue,
      semanticGraph: artifacts.semanticPredicateGraph as unknown as Prisma.InputJsonValue,
      compiledIr: artifacts.compiled.ir as unknown as Prisma.InputJsonValue,
      irSnapshot: artifacts.compiled.ir as unknown as Prisma.InputJsonValue,
      astSnapshot: artifacts.ast as unknown as Prisma.InputJsonValue,
      compiledManifest: (artifacts.ast.manifest ?? {}) as unknown as Prisma.InputJsonValue,
      consistencyReport: consistencyReport as unknown as Prisma.InputJsonValue,
      paramsSnapshot: runtimeContent.paramsSnapshot as Prisma.InputJsonValue,
      strategyConfig: runtimeContent.strategyConfig as Prisma.InputJsonValue,
      backtestConfigDefaults: runtimeContent.backtestConfigDefaults as Prisma.InputJsonValue,
      deploymentExecutionDefaults: runtimeContent.deploymentExecutionDefaults as Prisma.InputJsonValue,
      deploymentExecutionConstraints: runtimeContent.deploymentExecutionConstraints as Prisma.InputJsonValue,
      dataRequirements: artifacts.ast.dataRequirements as unknown as Prisma.InputJsonValue,
      lockedParams: runtimeContent.lockedParams as Prisma.InputJsonValue,
      executionEnvelope: {
        ...artifacts.executionEnvelope,
        runtime: 'signal-generator',
        source: 'strategy-plaza-official-template',
      } as unknown as Prisma.InputJsonValue,
      executionPolicy: artifacts.compiled.ir.executionPolicy as unknown as Prisma.InputJsonValue,
      userIntentSummary: artifacts.userIntentSummary as unknown as Prisma.InputJsonValue,
      strategySummary: artifacts.strategySummary as unknown as Prisma.InputJsonValue,
      scriptSummary: artifacts.scriptSummary as unknown as Prisma.InputJsonValue,
      snapshotVersion: 3,
    }
  }

  private buildFallbackOfficialSourceSnapshotContent(
    template: OfficialStrategyPlazaTemplate,
  ): StrategyPlazaSourceSnapshotContent {
    const content = buildOfficialStrategySnapshotContent(template)
    return {
      snapshotHash: content.snapshotHash,
      scriptHash: content.scriptHash,
      specHash: content.specHash,
      irHash: content.irHash,
      astDigest: content.astDigest,
      structuralDigest: content.structuralDigest,
      scriptSnapshot: content.scriptSnapshot,
      specSnapshot: content.specSnapshot as Prisma.InputJsonValue,
      semanticGraph: content.semanticGraph as Prisma.InputJsonValue,
      compiledIr: content.compiledIr as Prisma.InputJsonValue,
      irSnapshot: content.irSnapshot as Prisma.InputJsonValue,
      astSnapshot: content.astSnapshot as Prisma.InputJsonValue,
      compiledManifest: content.compiledManifest as Prisma.InputJsonValue,
      consistencyReport: content.consistencyReport as Prisma.InputJsonValue,
      paramsSnapshot: content.paramsSnapshot as Prisma.InputJsonValue,
      strategyConfig: content.strategyConfig as Prisma.InputJsonValue,
      backtestConfigDefaults: content.backtestConfigDefaults as Prisma.InputJsonValue,
      deploymentExecutionDefaults: content.deploymentExecutionDefaults as Prisma.InputJsonValue,
      deploymentExecutionConstraints: content.deploymentExecutionConstraints as Prisma.InputJsonValue,
      dataRequirements: content.dataRequirements as Prisma.InputJsonValue,
      lockedParams: content.lockedParams as Prisma.InputJsonValue,
      executionEnvelope: content.executionEnvelope as Prisma.InputJsonValue,
      executionPolicy: content.executionPolicy as Prisma.InputJsonValue,
      userIntentSummary: content.userIntentSummary as Prisma.InputJsonValue,
      strategySummary: content.strategySummary as Prisma.InputJsonValue,
      scriptSummary: content.scriptSummary as Prisma.InputJsonValue,
      snapshotVersion: content.snapshotVersion,
    }
  }
}
