import type { StrategyLogicGraphSnapshot } from '../types/strategy-logic-graph-snapshot'
import type { CanonicalStrategyIrV1 } from '../types/canonical-strategy-ir'
import type { StrategyAstV1 } from '../types/canonical-strategy-ast'
import type { SemanticStrategyGraph } from '../types/semantic-strategy-graph'
import type { StrategyClarificationState } from '../types/strategy-clarification'
import type { CompiledScriptExecutionEnvelope } from '../types/compiled-script-projection'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { PublishedStrategySnapshotsRepository } from '../repositories/published-strategy-snapshots.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { CompiledScriptParserService } from './compiled-script-parser.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { ScriptProfileExtractorService } from './script-profile-extractor.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { StrategyConsistencyService } from './strategy-consistency.service'

interface PublishCompiledSnapshotInput {
  sessionId: string
  strategyTemplateId?: string | null
  strategyInstanceId?: string | null
  graphSnapshot: StrategyLogicGraphSnapshot
  clarificationState?: StrategyClarificationState | null
  semanticGraph?: SemanticStrategyGraph
  ir: CanonicalStrategyIrV1
  ast: StrategyAstV1
  executionEnvelope: CompiledScriptExecutionEnvelope
  script: string
  userIntentSummary: Record<string, unknown>
  strategySummary: Record<string, unknown>
  scriptSummary: Record<string, unknown>
  lockedParams: Record<string, unknown>
}

@Injectable()
export class CompiledPublicationGateService {
  constructor(
    private readonly publishedSnapshotsRepo: PublishedStrategySnapshotsRepository,
    private readonly scriptParser: CompiledScriptParserService = new CompiledScriptParserService(),
    private readonly strategyConsistency: StrategyConsistencyService = new StrategyConsistencyService(
      new ScriptProfileExtractorService(),
      new CompiledScriptParserService(),
    ),
  ) {}

  async publish(input: PublishCompiledSnapshotInput): Promise<{
    snapshotId: string
    consistencyReport: Record<string, unknown>
  }> {
    if (input.clarificationState?.items.some(item => item.status === 'pending')) {
      throw new Error('clarification unresolved')
    }

    const parsed = this.scriptParser.parse(input.script)
    const manifest = parsed.compiledManifest
    const consistencyReport = this.buildConsistencyReport(input, parsed)
    if (consistencyReport.status !== 'PASSED') {
      throw new Error('consistency report failed')
    }

    const snapshot = await this.publishedSnapshotsRepo.create({
      sessionId: input.sessionId,
      strategyTemplateId: input.strategyTemplateId ?? null,
      strategyInstanceId: input.strategyInstanceId ?? null,
      scriptSnapshot: input.script,
      specSnapshot: input.graphSnapshot as unknown as Record<string, unknown>,
      semanticGraph: input.semanticGraph as unknown as Record<string, unknown> | null | undefined,
      compiledIr: input.ir as unknown as Record<string, unknown>,
      irSnapshot: input.ir as unknown as Record<string, unknown>,
      astSnapshot: input.ast as unknown as Record<string, unknown>,
      compiledManifest: manifest as unknown as Record<string, unknown>,
      consistencyReport,
      userIntentSummary: input.userIntentSummary,
      strategySummary: input.strategySummary,
      scriptSummary: input.scriptSummary,
      lockedParams: input.lockedParams,
      snapshotVersion: 2,
      paramsSnapshot: {
        symbol: input.ir.market.symbol,
        timeframe: input.ir.market.timeframes[0] ?? null,
        positionPct: input.executionEnvelope.positionMode === 'long_only' ? input.ir.portfolio.sizing.value : null,
      },
      executionEnvelope: input.executionEnvelope as unknown as Record<string, unknown>,
      executionPolicy: input.ir.executionPolicy as unknown as Record<string, unknown>,
      dataRequirements: input.ast.dataRequirements as unknown as Record<string, unknown>,
    })

    return {
      snapshotId: snapshot.id,
      consistencyReport,
    }
  }

  private buildConsistencyReport(
    input: PublishCompiledSnapshotInput,
    parsed: ReturnType<CompiledScriptParserService['parse']>,
  ): Record<string, unknown> {
    if (input.semanticGraph) {
      return this.strategyConsistency.audit({
        semanticGraph: input.semanticGraph,
        ir: input.ir,
        scriptCode: input.script,
      }) as unknown as Record<string, unknown>
    }

    const graphVsIrPassed = input.ir.source.graphDigest === input.ir.source.specHash
    const irVsScriptPassed = parsed.compiledManifest.irHash === input.ast.manifest.irHash
      && parsed.compiledManifest.structuralDigest === input.ast.manifest.structuralDigest
    const manifestSelfCheckPassed = parsed.compiledManifest.irHash === input.ast.manifest.irHash
      && parsed.compiledManifest.specHash === input.ast.manifest.specHash

    return {
      status: graphVsIrPassed && irVsScriptPassed && manifestSelfCheckPassed ? 'PASSED' : 'FAILED',
      graphVsIr: {
        passed: graphVsIrPassed,
        graphDigest: input.ir.source.graphDigest,
        specHash: input.ir.source.specHash,
      },
      irVsScript: {
        passed: irVsScriptPassed,
        irHash: parsed.compiledManifest.irHash,
        structuralDigest: parsed.compiledManifest.structuralDigest,
      },
      manifestSelfCheck: {
        passed: manifestSelfCheckPassed,
        irHash: parsed.compiledManifest.irHash,
        specHash: parsed.compiledManifest.specHash,
        astDigest: parsed.compiledManifest.astDigest,
        structuralDigest: parsed.compiledManifest.structuralDigest,
      },
    }
  }
}
