import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import type { SemanticState } from '../../types/semantic-state'
import type {
  CryptoAtomEvidence,
  CryptoCaseEvidence,
  CryptoCoverageFailure,
  CryptoCoverageFailureKind,
  CryptoCoverageLayer,
  CryptoCoverageReport,
  CryptoCoverageSupportStatus,
  CryptoStrategyCoverageCase,
  CryptoUnsupportedIntent,
} from './crypto-coverage-types'
import { collectAtomLeaves, isRuleEffectsByRole } from '../../types/atom-expr'
import { CanonicalSpecBuilderService } from '../../services/canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../../services/canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../../services/canonical-strategy-ast-compiler.service'
import { CodegenGraphSnapshotService } from '../../services/codegen-graph-snapshot.service'
import { CodegenPublicationGenerationStage } from '../../services/codegen-publication-generation.stage'
import { CompiledScriptEmitterService } from '../../services/compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../../services/compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../../services/compiled-script-parser.service'
import { GenericSeedDispatcher } from '../../services/generic-seed-dispatcher.service'
import { ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import { ScriptProfileExtractorService } from '../../services/script-profile-extractor.service'
import { SemanticContractReadinessService } from '../../services/semantic-contract-readiness.service'
import { SemanticSeedStateBuilderService } from '../../services/semantic-seed-state-builder.service'
import { SpecDescBuilderService } from '../../services/spec-desc-builder.service'
import { StrategyConsistencyService } from '../../services/strategy-consistency.service'
import { StrategySummaryBuilderService } from '../../services/strategy-summary-builder.service'
import { StrategySummaryObservationService } from '../../services/strategy-summary-observation.service'
import { buildCryptoCoverageReport } from './crypto-coverage-reporter'
import { classifyCryptoIntentScope, getCryptoAtomWeight } from './crypto-coverage-taxonomy'

const EMPTY_LAYERS: Readonly<Record<CryptoCoverageLayer, boolean>> = {
  nl_dispatch: false,
  dialogue_slot: false,
  rules_emit: false,
  atom_contract: false,
  readiness_support: false,
  canonical_emit: false,
  ir_emit: false,
  runtime_data: false,
  execution_runtime: false,
  backtest_reachability: false,
  deploy_payload: false,
  unsupported_gate: false,
}

const FAILURE_LAYER: Readonly<Record<CryptoCoverageFailureKind, CryptoCoverageLayer>> = {
  missing_nl_dispatch: 'nl_dispatch',
  missing_dialogue_slot: 'dialogue_slot',
  missing_rules_emit: 'rules_emit',
  missing_atom_contract: 'atom_contract',
  missing_readiness_support: 'readiness_support',
  missing_canonical_emit: 'canonical_emit',
  missing_ir_emit: 'ir_emit',
  missing_runtime_data: 'runtime_data',
  missing_execution_runtime: 'execution_runtime',
  missing_backtest_reachability: 'backtest_reachability',
  missing_deploy_payload: 'deploy_payload',
  ghost_atom: 'unsupported_gate',
  out_of_scope_C: 'unsupported_gate',
}

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

export function failureKindToBlockedStatus(kind: CryptoCoverageFailureKind): CryptoCoverageSupportStatus {
  switch (kind) {
    case 'out_of_scope_C':
      return 'unsupported_out_of_scope'
    case 'ghost_atom':
      return 'blocked_by_missing_readiness_support'
    default:
      return `blocked_by_${kind}` as CryptoCoverageSupportStatus
  }
}

function collectRuleAtomKeysFromPatch(patch: CodegenSemanticPatch): string[] {
  return [...new Set((patch.rules ?? []).flatMap(rule => collectRuleAtomKeys(rule.condition, rule.effects)))].sort()
}

function collectRuleAtomKeysFromState(state: SemanticState): string[] {
  return [...new Set((state.rules ?? []).flatMap(rule => collectRuleAtomKeys(rule.condition, rule.effects)))].sort()
}

function collectRuleAtomKeys(condition: CodegenSemanticPatch['rules'][number]['condition'], effects: CodegenSemanticPatch['rules'][number]['effects']): string[] {
  const conditionKeys = collectAtomLeaves(condition).map(leaf => leaf.key)
  const effectNodes = isRuleEffectsByRole(effects)
    ? [...effects.actions, ...effects.risks, ...effects.positions, ...effects.programs, ...effects.orchestration]
    : effects
  return [...conditionKeys, ...effectNodes.flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))]
}

function buildFailure(caseId: string, atomKey: string, kind: CryptoCoverageFailureKind, evidence: string): CryptoCoverageFailure {
  return { caseId, atomKey, kind, layer: FAILURE_LAYER[kind], evidence }
}

function firstFailureStatus(failures: readonly CryptoCoverageFailureKind[]): CryptoCoverageSupportStatus {
  return failures.length === 0 ? 'supported_executable' : failureKindToBlockedStatus(failures[0])
}

function hasAtomContract(atomKey: string): boolean {
  return atomKey in ATOM_CONTRACT_REGISTRY
}

function buildConversationResolvedMessage(caseItem: CryptoStrategyCoverageCase): string {
  if (caseItem.clarificationTurns.length === 0) return caseItem.initialUserMessage
  const answeredTurns = caseItem.clarificationTurns
    .map(turn => `补充 ${turn.assistantSlotPath}: ${turn.userAnswer}`)
    .join(' ')
  return `${caseItem.initialUserMessage} ${answeredTurns}`
}

async function collectPublicationLayers(state: SemanticState): Promise<Partial<Record<CryptoCoverageLayer, boolean>> & { errorMessage?: string }> {
  const canonicalSpecBuilder = new CanonicalSpecBuilderService()
  let canonicalSpec: ReturnType<CanonicalSpecBuilderService['buildFromSemanticState']>

  try {
    canonicalSpec = canonicalSpecBuilder.buildFromSemanticState(state)
  }
  catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      canonical_emit: false,
      ir_emit: false,
      runtime_data: false,
      execution_runtime: false,
      backtest_reachability: false,
      deploy_payload: false,
      errorMessage: message,
    }
  }

  try {
    const artifacts = await createPublicationStage().generate({ semanticState: state, canonicalSpecOverride: canonicalSpec })
    return {
      canonical_emit: Boolean(artifacts.canonicalSpec),
      ir_emit: Boolean(artifacts.compiled.ir),
      runtime_data: Boolean(artifacts.compiled.ir),
      execution_runtime: Boolean(artifacts.compiledScript),
      backtest_reachability: Boolean(artifacts.executionEnvelope),
      deploy_payload: Boolean(artifacts.compiled.ir && artifacts.executionEnvelope),
    }
  }
  catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.startsWith('codegen.semantic_atom_drift:')) {
      return {
        canonical_emit: true,
        ir_emit: true,
        runtime_data: true,
        execution_runtime: true,
        backtest_reachability: true,
        deploy_payload: false,
        errorMessage: message,
      }
    }
    if (message === 'codegen.publication_context_missing') {
      return {
        canonical_emit: true,
        ir_emit: true,
        runtime_data: true,
        execution_runtime: true,
        backtest_reachability: true,
        deploy_payload: false,
        errorMessage: message,
      }
    }
    return {
      canonical_emit: true,
      ir_emit: false,
      runtime_data: false,
      execution_runtime: false,
      backtest_reachability: false,
      deploy_payload: false,
      errorMessage: message,
    }
  }
}

export async function runCryptoCoverageCase(caseItem: CryptoStrategyCoverageCase): Promise<{
  readonly caseEvidence: CryptoCaseEvidence
  readonly atomEvidence: readonly CryptoAtomEvidence[]
  readonly unsupported: readonly CryptoUnsupportedIntent[]
}> {
  const scopeMatch = classifyCryptoIntentScope(caseItem.initialUserMessage)
  if (scopeMatch.scope === 'C') {
    const atomEvidence = caseItem.expectedAtomKeys.map<CryptoAtomEvidence>(atomKey => ({
      atomKey,
      scope: 'C',
      weight: 1,
      status: 'unsupported_out_of_scope',
      layers: { ...EMPTY_LAYERS, nl_dispatch: true, unsupported_gate: true },
      failures: ['out_of_scope_C'],
    }))
    return {
      caseEvidence: {
        id: caseItem.id,
        labels: caseItem.labels,
        scope: 'C',
        passed: true,
        expectedAtomKeys: caseItem.expectedAtomKeys,
        observedAtomKeys: caseItem.expectedAtomKeys,
        failures: [],
      },
      atomEvidence,
      unsupported: [{
        caseId: caseItem.id,
        matchedPhrase: scopeMatch.matchedPhrase ?? caseItem.initialUserMessage,
        status: 'unsupported_out_of_scope',
        publicReason: scopeMatch.publicReason ?? caseItem.expectedUnsupportedReason ?? 'out_of_scope',
      }],
    }
  }

  const dispatcher = new GenericSeedDispatcher()
  const seedBuilder = new SemanticSeedStateBuilderService()
  const readiness = new SemanticContractReadinessService()
  const resolvedMessage = buildConversationResolvedMessage(caseItem)
  const patch = dispatcher.dispatch(resolvedMessage) as CodegenSemanticPatch
  const patchAtomKeys = collectRuleAtomKeysFromPatch(patch)
  const seedState = seedBuilder.build(patch, resolvedMessage)
  const normalized = seedState ? readiness.normalize(seedState) : null
  const state = normalized?.state ?? seedState
  const stateAtomKeys = state ? collectRuleAtomKeysFromState(state) : []
  const observedAtomKeys = [...new Set([...patchAtomKeys, ...stateAtomKeys])].sort()
  const missingContractAtomKeys = new Set(caseItem.expectedAtomKeys.filter(atomKey => observedAtomKeys.includes(atomKey) && !hasAtomContract(atomKey)))
  const shouldAttemptPublication = state && normalized?.missingRequirements.length === 0 && missingContractAtomKeys.size === 0
  const publicationLayers = shouldAttemptPublication
    ? await collectPublicationLayers(state)
    : {}

  const failures = caseItem.expectedAtomKeys.flatMap((atomKey) => {
    const out: CryptoCoverageFailure[] = []
    if (!seedState) out.push(buildFailure(caseItem.id, atomKey, 'missing_nl_dispatch', 'semantic seed state was not built'))
    if (!observedAtomKeys.includes(atomKey)) out.push(buildFailure(caseItem.id, atomKey, 'missing_rules_emit', `${atomKey} missing from semanticPatch.rules[]`))
    if (missingContractAtomKeys.has(atomKey)) out.push(buildFailure(caseItem.id, atomKey, 'missing_atom_contract', `${atomKey} missing from atom contract registry`))
    if (out.length === 0 && missingContractAtomKeys.size > 0) {
      out.push(buildFailure(caseItem.id, atomKey, 'missing_deploy_payload', `publication skipped because expected atoms lack contracts: ${[...missingContractAtomKeys].sort().join(', ')}`))
    }
    if (missingContractAtomKeys.size === 0 && normalized && normalized.missingRequirements.length > 0) {
      out.push(buildFailure(caseItem.id, atomKey, 'missing_dialogue_slot', normalized.missingRequirements[0]?.object ?? 'missing requirement'))
    }
    if (shouldAttemptPublication && !publicationLayers.canonical_emit) {
      out.push(buildFailure(caseItem.id, atomKey, 'missing_canonical_emit', publicationLayers.errorMessage ?? 'publication generation did not produce canonical spec'))
    }
    if (publicationLayers.canonical_emit && !publicationLayers.ir_emit) out.push(buildFailure(caseItem.id, atomKey, 'missing_ir_emit', publicationLayers.errorMessage ?? 'publication generation did not produce IR'))
    if (publicationLayers.ir_emit && !publicationLayers.deploy_payload) out.push(buildFailure(caseItem.id, atomKey, 'missing_deploy_payload', publicationLayers.errorMessage ?? 'publication generation did not produce deploy payload evidence'))
    return out
  })

  const atomEvidence = caseItem.expectedAtomKeys.map<CryptoAtomEvidence>((atomKey) => {
    const atomFailures = failures.filter(item => item.atomKey === atomKey).map(item => item.kind)
    return {
      atomKey,
      scope: 'B',
      weight: getCryptoAtomWeight(atomKey),
      status: firstFailureStatus(atomFailures),
      layers: {
        ...EMPTY_LAYERS,
        nl_dispatch: Boolean(seedState),
        dialogue_slot: normalized ? normalized.missingRequirements.length === 0 : false,
        rules_emit: observedAtomKeys.includes(atomKey),
        atom_contract: observedAtomKeys.includes(atomKey),
        readiness_support: normalized ? normalized.missingRequirements.length === 0 : false,
        ...publicationLayers,
      },
      failures: atomFailures,
    }
  })

  return {
    caseEvidence: {
      id: caseItem.id,
      labels: caseItem.labels,
      scope: 'B',
      passed: failures.length === 0,
      expectedAtomKeys: caseItem.expectedAtomKeys,
      observedAtomKeys,
      failures,
    },
    atomEvidence,
    unsupported: [],
  }
}

export async function runCryptoCoverageCorpus(cases: readonly CryptoStrategyCoverageCase[]): Promise<CryptoCoverageReport> {
  const results = await Promise.all(cases.map(item => runCryptoCoverageCase(item)))
  return buildCryptoCoverageReport({
    cases: results.map(item => item.caseEvidence),
    atoms: results.flatMap(item => item.atomEvidence),
    unsupported: results.flatMap(item => item.unsupported),
  })
}
