import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import {
  STAGE4_ATOM_COVERAGE_MATRIX,
  isStage4DeployReadyAtom,
} from '../atom-coverage-matrix'
import { CanonicalSpecBuilderService } from '../../services/canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../../services/canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../../services/canonical-strategy-ast-compiler.service'
import { CodegenGraphSnapshotService } from '../../services/codegen-graph-snapshot.service'
import { CodegenPublicationGenerationStage } from '../../services/codegen-publication-generation.stage'
import { CompiledScriptEmitterService } from '../../services/compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../../services/compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../../services/compiled-script-parser.service'
import { GenericSeedDispatcher } from '../../services/generic-seed-dispatcher.service'
import { ScriptProfileExtractorService } from '../../services/script-profile-extractor.service'
import { SemanticClarificationQuestionRendererService } from '../../services/semantic-clarification-question-renderer.service'
import { SemanticContractReadinessService } from '../../services/semantic-contract-readiness.service'
import { SemanticSeedStateBuilderService } from '../../services/semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../../services/semantic-state-projection.service'
import { SpecDescBuilderService } from '../../services/spec-desc-builder.service'
import { StrategyConsistencyService } from '../../services/strategy-consistency.service'
import { StrategySummaryBuilderService } from '../../services/strategy-summary-builder.service'
import { StrategySummaryObservationService } from '../../services/strategy-summary-observation.service'

function createPublicationStage(): CodegenPublicationGenerationStage {
  return new CodegenPublicationGenerationStage(
    new CanonicalSpecBuilderService(),
    new SpecDescBuilderService(),
    new StrategySummaryBuilderService(new ScriptProfileExtractorService()),
    new StrategyConsistencyService(new ScriptProfileExtractorService()),
    new CanonicalSpecV2IrCompilerService(),
    new CanonicalStrategyAstCompilerService(),
    new CompiledScriptEmitterService(),
    new CompiledScriptExecutionEnvelopeService(),
    new CompiledScriptParserService(),
    new StrategySummaryObservationService(),
    undefined,
    new CodegenGraphSnapshotService(),
  )
}

async function runFailClosedPipeline(utterance: string) {
  const semanticPatch = new GenericSeedDispatcher().dispatch(utterance) as CodegenSemanticPatch
  expect(semanticPatch.rules?.length ?? 0).toBeGreaterThan(0)

  const state = new SemanticSeedStateBuilderService().build(semanticPatch, utterance)
  expect(state).not.toBeNull()
  expect(state?.rules?.length ?? 0).toBeGreaterThan(0)

  const readiness = new SemanticContractReadinessService().normalize(state!)
  const firstSlot = readiness.missingRequirements[0]
  const assistantText = new SemanticClarificationQuestionRendererService().render({
    slotKey: firstSlot?.object ?? 'stage4.fail_closed',
    fallback: firstSlot?.errorCode ?? 'fail closed before deploy payload',
  })
  expect(assistantText.length).toBeGreaterThan(0)

  const displayGraph = new SemanticStateProjectionService().buildDisplayLogicGraph(state!)
  expect(displayGraph.blocks.length).toBeGreaterThan(0)

  let publication: unknown = null
  let publicationError: unknown = null
  try {
    publication = await createPublicationStage().generate({ semanticState: state! })
  }
  catch (error) {
    publicationError = error
  }

  return { semanticPatch, state: state!, readiness, assistantText, displayGraph, publication, publicationError }
}

function coverageRowsForAtomKey(atomKey: string) {
  return STAGE4_ATOM_COVERAGE_MATRIX.filter(row => row.atomKey === atomKey || row.coveredAtomKeys.includes(atomKey))
}

describe('Stage 4 PR5 rules-only full pipeline', () => {
  it('claims deploy-ready PR5 rows only after full deploy payload proof exists', () => {
    const pr5ReadyRows = STAGE4_ATOM_COVERAGE_MATRIX
      .filter(row => row.prBatch === 'pr5-orchestration-data')
      .filter(isStage4DeployReadyAtom)

    expect(pr5ReadyRows.map(row => row.atomKey).sort()).toEqual([
      'orchestration.data_source_binding',
      'orchestration.multi_symbol',
      'orchestration.multi_timeframe',
      'orchestration.portfolio_risk',
      'orchestration.regime_gate',
    ].sort())
    expect(pr5ReadyRows.every(row => row.reachesBacktest && row.reachesDeployPayload)).toBe(true)
  })

  it.each([
    ['orderbook.imbalance', 'BTCUSDT 15m。EMA20 上穿开多，但需要 Binance orderbook imbalance 大于 60% 确认。'],
    ['fundingRate.condition', 'BTCUSDT 15m。资金费率为正并且 EMA20 上穿时开多。'],
    ['openInterest.condition', 'BTCUSDT 15m。未平仓量增加并且突破 20 根高点时开多。'],
    ['liquidation.condition', 'BTCUSDT 15m。出现多头清算瀑布后只做空。'],
    ['external.signal', 'OKX 合约 BTCUSDT 15m，收到 TradingView webhook buy 信号后开多，单笔 10% 仓位。'],
  ])('%s reaches publication pipeline without fake deploy payload', async (atomKey, utterance) => {
    const rows = coverageRowsForAtomKey(atomKey)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some(isStage4DeployReadyAtom)).toBe(true)

    const result = await runFailClosedPipeline(utterance)
    const serializedState = JSON.stringify(result.state)
    const serializedPublication = JSON.stringify(result.publication ?? {})

    expect(serializedState).toContain('rules')
    expect(serializedState).toContain(atomKey)
    expect(result.publicationError).toBeNull()
    expect(serializedPublication).toContain('protocolVersion')
    expect(serializedPublication).not.toContain('fake_deploy_payload')
  })
})
