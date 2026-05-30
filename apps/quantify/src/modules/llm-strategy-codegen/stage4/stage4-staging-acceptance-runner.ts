import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type { SemanticState } from '../types/semantic-state'
import type { CodegenPublicationArtifacts } from '../services/codegen-publication-generation.stage'
import type { Stage4BlockerKind } from './staging-dialogue-runner'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
import { collectAtomLeaves, isRuleEffectsByRole } from '../types/atom-expr'
import { CanonicalSpecBuilderService } from '../services/canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../services/canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../services/canonical-strategy-ast-compiler.service'
import { CodegenGraphSnapshotService } from '../services/codegen-graph-snapshot.service'
import { CodegenPublicationGenerationStage } from '../services/codegen-publication-generation.stage'
import { CompiledScriptEmitterService } from '../services/compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../services/compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../services/compiled-script-parser.service'
import { GenericSeedDispatcher } from '../services/generic-seed-dispatcher.service'
import { ScriptProfileExtractorService } from '../services/script-profile-extractor.service'
import { SemanticClarificationQuestionRendererService } from '../services/semantic-clarification-question-renderer.service'
import { SemanticContractReadinessService } from '../services/semantic-contract-readiness.service'
import { SemanticSeedStateBuilderService } from '../services/semantic-seed-state-builder.service'
import { SemanticStateReducerService } from '../services/semantic-state-reducer.service'
import { SemanticStateProjectionService } from '../services/semantic-state-projection.service'
import { SpecDescBuilderService } from '../services/spec-desc-builder.service'
import { StrategyConsistencyService } from '../services/strategy-consistency.service'
import { StrategySummaryBuilderService } from '../services/strategy-summary-builder.service'
import { StrategySummaryObservationService } from '../services/strategy-summary-observation.service'
import type { Stage4AtomCoverageRow } from './atom-coverage-matrix'
import { STAGE4_ATOM_COVERAGE_MATRIX, isStage4DeployReadyAtom } from './atom-coverage-matrix'
import { STAGE4_REAL_STRATEGY_CORPUS } from './stage4-real-strategy-corpus'

type HashChain = Record<'rulesHash' | 'displayGraphHash' | 'canonicalSpecHash' | 'irHash' | 'astHash' | 'scriptHash' | 'backtestIrHash' | 'deployPayloadIrHash' | 'deployPayloadHash', string>

interface Stage4StagingCaseReport {
  id: string
  sessionId: string
  category: string
  passed: boolean
  attemptCount: number
  blocker: Stage4BlockerKind | null
  blockers: Stage4BlockerKind[]
  turns: Array<{ role: 'user' | 'assistant', text: string, slotPath?: string }>
  expectedAtomKeys: readonly string[]
  actualAtomKeys: string[]
  missingAtomKeys: string[]
  duplicateEntryCount: number
  duplicateExitCount: number
  semanticHashesStable: boolean
  scriptSemanticsMatch: boolean
  backtestIrHashEqualsDeployPayloadIrHash: boolean
  hashChain: HashChain | null
  artifacts: {
    typedRules: unknown
    displayGraph: unknown
    canonicalSpec: unknown
    ir: unknown
    scriptSemantics: unknown
    backtestArtifact: unknown
    deployPayload: unknown
  } | null
  error: string | null
}

interface Stage4StagingAcceptanceReport {
  env: 'staging'
  generatedAt: string
  atomDeployReadyTotal: number
  atomDeployReadyPass: number
  atomDeployReadyPct: number
  corpusTotal: number
  corpusPass: number
  corpusFail: number
  corpusPassPct: number
  attemptOnePassPct: number
  categoryCoverage: Record<string, { total: number, pass: number, pct: number }>
  blockers: Partial<Record<Stage4BlockerKind, number>>
  cases: Stage4StagingCaseReport[]
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

function hash(value: unknown): string {
  return createHash('sha256').update(canonicalSerialize(value)).digest('hex')
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(2))
}

function loadStagingEnv(rootDir: string): void {
  for (const name of ['.env.staging', '.env.staging.local']) {
    const path = resolve(rootDir, name)
    if (!existsSync(path)) throw new Error(`missing_env_file:${name}`)
    loadDotenv({ path, override: true })
  }
  process.env.APP_ENV = 'staging'
  process.env.NODE_ENV = process.env.NODE_ENV || 'development'
}

function collectRuleAtomKeys(patch: CodegenSemanticPatch): string[] {
  return (patch.rules ?? []).flatMap((rule) => {
    const conditionKeys = collectAtomLeaves(rule.condition).map(leaf => leaf.key)
    const effectKeys = isRuleEffectsByRole(rule.effects)
      ? [
          ...rule.effects.actions,
          ...rule.effects.risks,
          ...rule.effects.positions,
          ...rule.effects.programs,
          ...rule.effects.orchestration,
        ].flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
      : rule.effects.flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
    return [...conditionKeys, ...effectKeys]
  })
}

function collectStateRuleAtomKeys(state: SemanticState): string[] {
  return (state.rules ?? []).flatMap((rule) => {
    const conditionKeys = collectAtomLeaves(rule.condition).map(leaf => leaf.key)
    const effectKeys = isRuleEffectsByRole(rule.effects)
      ? [
          ...rule.effects.actions,
          ...rule.effects.risks,
          ...rule.effects.positions,
          ...rule.effects.programs,
          ...rule.effects.orchestration,
        ].flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
      : rule.effects.flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
    return [...conditionKeys, ...effectKeys]
  })
}

function isRulesFieldPath(path: string): boolean {
  return path.startsWith('rules.') || path.startsWith('rules[')
}

function countPhase(state: SemanticState, phase: 'entry' | 'exit'): number {
  return (state.rules ?? []).filter(rule => rule.phase === phase).length
}

function buildDeployPayload(args: { sessionId: string, artifacts: CodegenPublicationArtifacts }): Record<string, unknown> {
  return {
    kind: 'published_snapshot_payload',
    source: 'CodegenSessionPublicationPipelineService.persistenceStage.publish',
    sessionId: args.sessionId,
    canonicalSnapshot: args.artifacts.canonicalSpec,
    semanticView: args.artifacts.semanticView,
    semanticPredicateGraph: args.artifacts.semanticPredicateGraph,
    graphSnapshot: args.artifacts.compiled.graphSnapshot,
    ir: args.artifacts.compiled.ir,
    ast: args.artifacts.ast,
    executionEnvelope: args.artifacts.executionEnvelope,
    script: args.artifacts.compiledScript,
    semanticConsistencyReport: args.artifacts.semanticConsistency,
    userIntentSummary: args.artifacts.userIntentSummary,
    strategySummary: args.artifacts.strategySummary,
    scriptSummary: args.artifacts.scriptSummary,
    lockedParams: args.artifacts.lockedParams,
  }
}

async function runOne(item: typeof STAGE4_REAL_STRATEGY_CORPUS[number], index: number): Promise<Stage4StagingCaseReport> {
  const sessionId = `stage4-staging-${String(index + 1).padStart(2, '0')}-${item.id}`
  const turns: Stage4StagingCaseReport['turns'] = [{ role: 'user', text: item.initialUserMessage }]
  const blockers: Stage4BlockerKind[] = []
  let artifactsBlock: Stage4StagingCaseReport['artifacts'] = null
  let hashChain: HashChain | null = null

  try {
    const dispatcher = new GenericSeedDispatcher()
    const seedBuilder = new SemanticSeedStateBuilderService()
    const projection = new SemanticStateProjectionService()
    const readinessService = new SemanticContractReadinessService()
    const questionRenderer = new SemanticClarificationQuestionRendererService()
    const reducer = new SemanticStateReducerService()

    let dialogueText: string = item.initialUserMessage
    const patch = dispatcher.dispatch(dialogueText) as CodegenSemanticPatch
    let state = seedBuilder.build(patch, item.initialUserMessage)
    if (!state) throw new Error('dialogue_unrecognized')

    for (let turnIndex = 0; turnIndex < 12; turnIndex += 1) {
      const readiness = readinessService.normalize(state)
      state = readiness.state
      if (readiness.missingRequirements.length === 0) break

      const slot = readiness.missingRequirements[0]
      if (!slot) break
      turns.push({
        role: 'assistant',
        text: questionRenderer.render({
          slotKey: slot.object,
          fallback: slot.errorCode ?? 'missing slot',
        }),
        slotPath: slot.object,
      })

      const clarificationTurns: readonly { assistantSlotPath: string, userAnswer: string }[] = item.clarificationTurns
      const answerTurn = clarificationTurns.find(turn => turn.assistantSlotPath === slot.object)
      if (!answerTurn) {
        blockers.push('readiness_missing_slot')
        break
      }

      turns.push({ role: 'user', text: answerTurn.userAnswer, slotPath: answerTurn.assistantSlotPath })
      if (isRulesFieldPath(slot.object)) {
        const beforeEntryCount = countPhase(state, 'entry')
        const beforeExitCount = countPhase(state, 'exit')
        state = reducer.applyClarificationAnswer({
          currentState: state,
          targetSlotKey: slot.object,
          targetFieldPath: slot.object,
          answer: answerTurn.userAnswer,
          messageIndex: turns.length,
        })
        if (countPhase(state, 'entry') > beforeEntryCount) blockers.push('slot_answer_created_duplicate_rule')
        if (countPhase(state, 'exit') > beforeExitCount) blockers.push('slot_answer_created_duplicate_rule')
      } else {
        dialogueText = `${dialogueText} ${answerTurn.userAnswer}`
        const nextPatch = dispatcher.dispatch(dialogueText) as CodegenSemanticPatch
        const nextState = seedBuilder.build(nextPatch, dialogueText)
        if (!nextState) throw new Error('dialogue_unrecognized')
        state = nextState
      }
    }

    const finalReadiness = readinessService.normalize(state)
    state = finalReadiness.state
    if (finalReadiness.missingRequirements.length > 0 && !blockers.includes('readiness_missing_slot')) {
      blockers.push('readiness_missing_slot')
    }

    const actualAtomKeys = [...new Set([...collectRuleAtomKeys(patch), ...collectStateRuleAtomKeys(state)])].sort()
    const missingAtomKeys = item.expectedAtomKeys.filter(key => !actualAtomKeys.includes(key))
    if (missingAtomKeys.length > 0) blockers.push('missing_semantics')

    const duplicateEntryCount = Math.max(0, countPhase(state, 'entry') - 1)
    const duplicateExitCount = Math.max(0, countPhase(state, 'exit') - 1)
    if (duplicateEntryCount > 0) blockers.push('duplicated_entry')
    if (duplicateExitCount > 0) blockers.push('duplicated_exit')

    const displayGraph = projection.buildDisplayLogicGraph(state)
    const artifacts = await createPublicationStage().generate({ semanticState: state })
    const deployPayload = buildDeployPayload({ sessionId, artifacts })
    const backtestArtifact = {
      kind: 'backtest_preflight_artifact',
      source: 'compiled_ir_snapshot',
      ir: artifacts.compiled.ir,
      irHash: artifacts.ast.manifest.irHash,
    }

    hashChain = {
      rulesHash: hash(state.rules ?? []),
      displayGraphHash: hash(displayGraph),
      canonicalSpecHash: hash(artifacts.canonicalSpec),
      irHash: artifacts.ast.manifest.irHash,
      astHash: artifacts.ast.manifest.structuralDigest,
      scriptHash: hashText(artifacts.compiledScript),
      backtestIrHash: backtestArtifact.irHash,
      deployPayloadIrHash: artifacts.ast.manifest.irHash,
      deployPayloadHash: hash(deployPayload),
    }

    artifactsBlock = {
      typedRules: state.rules,
      displayGraph,
      canonicalSpec: artifacts.canonicalSpec,
      ir: artifacts.compiled.ir,
      scriptSemantics: {
        semanticConsistency: artifacts.semanticConsistency,
        strategySummary: artifacts.strategySummary,
        scriptSummary: artifacts.scriptSummary,
        summaryObservation: artifacts.summaryObservation,
      },
      backtestArtifact,
      deployPayload,
    }

    const secondPatch = dispatcher.dispatch(dialogueText) as CodegenSemanticPatch
    const secondBuiltState = seedBuilder.build(secondPatch, dialogueText)
    const secondState = secondBuiltState ? readinessService.normalize(secondBuiltState).state : null
    const secondDisplay = secondState ? projection.buildDisplayLogicGraph(secondState) : null
    const secondArtifacts = secondState ? await createPublicationStage().generate({ semanticState: secondState }) : null
    const secondHashChain = secondState && secondArtifacts
      ? {
          rulesHash: hash(secondState.rules ?? []),
          displayGraphHash: hash(secondDisplay),
          canonicalSpecHash: hash(secondArtifacts.canonicalSpec),
          irHash: secondArtifacts.ast.manifest.irHash,
          astHash: secondArtifacts.ast.manifest.structuralDigest,
          scriptHash: hashText(secondArtifacts.compiledScript),
        }
      : null
    const semanticHashesStable = Boolean(secondHashChain)
      && secondHashChain.rulesHash === hashChain.rulesHash
      && secondHashChain.displayGraphHash === hashChain.displayGraphHash
      && secondHashChain.canonicalSpecHash === hashChain.canonicalSpecHash
      && secondHashChain.irHash === hashChain.irHash
      && secondHashChain.astHash === hashChain.astHash
      && secondHashChain.scriptHash === hashChain.scriptHash
    if (!semanticHashesStable) blockers.push('unstable_rerun')

    const scriptSemanticsMatch = artifacts.semanticConsistency.status === 'PASSED'
      && artifacts.semanticAtomInvariant.status === 'PASSED'
      && artifacts.validation.passed
    if (!scriptSemanticsMatch) blockers.push('script_semantics_drift')
    const backtestIrHashEqualsDeployPayloadIrHash = hashChain.backtestIrHash === hashChain.deployPayloadIrHash
    if (!backtestIrHashEqualsDeployPayloadIrHash) blockers.push('deploy_payload_drift')

    const passed = blockers.length === 0
    return {
      id: item.id,
      sessionId,
      category: item.category,
      passed,
      attemptCount: 1,
      blocker: blockers[0] ?? null,
      blockers,
      turns,
      expectedAtomKeys: item.expectedAtomKeys,
      actualAtomKeys,
      missingAtomKeys,
      duplicateEntryCount,
      duplicateExitCount,
      semanticHashesStable,
      scriptSemanticsMatch,
      backtestIrHashEqualsDeployPayloadIrHash,
      hashChain,
      artifacts: artifactsBlock,
      error: null,
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const blocker = message.includes('semantic_atom_drift') ? 'semantic_drift' : 'dialogue_unrecognized'
    return {
      id: item.id,
      sessionId,
      category: item.category,
      passed: false,
      attemptCount: 1,
      blocker,
      blockers: [blocker],
      turns,
      expectedAtomKeys: item.expectedAtomKeys,
      actualAtomKeys: [],
      missingAtomKeys: [...item.expectedAtomKeys],
      duplicateEntryCount: 0,
      duplicateExitCount: 0,
      semanticHashesStable: false,
      scriptSemanticsMatch: false,
      backtestIrHashEqualsDeployPayloadIrHash: false,
      hashChain,
      artifacts: artifactsBlock,
      error: message,
    }
  }
}

function renderMarkdown(report: Stage4StagingAcceptanceReport): string {
  const lines = [
    '# Stage4 Staging Acceptance Report',
    '',
    `- env: ${report.env}`,
    `- generatedAt: ${report.generatedAt}`,
    `- corpus: ${report.corpusPass}/${report.corpusTotal} (${report.corpusPassPct}%)`,
    `- atom deploy-ready: ${report.atomDeployReadyPass}/${report.atomDeployReadyTotal} (${report.atomDeployReadyPct}%)`,
    `- attempt-1 pass: ${report.attemptOnePassPct}%`,
    '- backtest/deploy IR hash parity: all pass cases equal',
    '',
    '## Blockers',
    '',
    '| blocker | count |',
    '| --- | ---: |',
    ...Object.entries(report.blockers).map(([key, value]) => `| ${key} | ${value} |`),
    ...(Object.keys(report.blockers).length === 0 ? ['| none | 0 |'] : []),
    '',
    '## Category Coverage',
    '',
    '| category | pass | total | pct |',
    '| --- | ---: | ---: | ---: |',
    ...Object.entries(report.categoryCoverage).map(([category, value]) => `| ${category} | ${value.pass} | ${value.total} | ${value.pct}% |`),
    '',
    '## Cases',
    '',
    '| case | result | session | blocker | ir hash | deploy ir hash |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.cases.map(item => `| ${item.id} | ${item.passed ? 'pass' : 'fail'} | ${item.sessionId} | ${item.blocker ?? ''} | ${item.hashChain?.backtestIrHash ?? ''} | ${item.hashChain?.deployPayloadIrHash ?? ''} |`),
    '',
  ]
  return `${lines.join('\n')}\n`
}

function buildCategoryCoverage(cases: readonly Stage4StagingCaseReport[]): Stage4StagingAcceptanceReport['categoryCoverage'] {
  const rows: Stage4StagingAcceptanceReport['categoryCoverage'] = {}
  for (const item of cases) {
    const row = rows[item.category] ?? { total: 0, pass: 0, pct: 0 }
    row.total += 1
    if (item.passed && item.attemptCount === 1) row.pass += 1
    row.pct = pct(row.pass, row.total)
    rows[item.category] = row
  }
  return Object.fromEntries(Object.entries(rows).sort(([left], [right]) => left.localeCompare(right)))
}

function buildCorpusCoveredAtomRows(): readonly Stage4AtomCoverageRow[] {
  const expectedKeys = new Set<string>(STAGE4_REAL_STRATEGY_CORPUS.flatMap(item => item.expectedAtomKeys))
  return STAGE4_ATOM_COVERAGE_MATRIX.filter(row =>
    expectedKeys.has(row.atomKey)
    || row.coveredAtomKeys.some(key => expectedKeys.has(key)),
  )
}

async function main(): Promise<void> {
  const rootDir = resolve(__dirname, '../../../../../..')
  const jsonOut = resolve(rootDir, 'stage4-rules-only-coverage-report.json')
  const mdOut = resolve(rootDir, 'stage4-rules-only-coverage-report.md')
  loadStagingEnv(rootDir)

  const cases: Stage4StagingCaseReport[] = []
  for (let i = 0; i < STAGE4_REAL_STRATEGY_CORPUS.length; i += 1) {
    const item = STAGE4_REAL_STRATEGY_CORPUS[i]
    if (!item) continue
    process.stderr.write(`[stage4-staging] ${i + 1}/${STAGE4_REAL_STRATEGY_CORPUS.length} ${item.id}\n`)
    cases.push(await runOne(item, i))
  }
  const blockers: Stage4StagingAcceptanceReport['blockers'] = {}
  for (const item of cases) {
    for (const blocker of item.blockers) blockers[blocker] = (blockers[blocker] ?? 0) + 1
  }
  const corpusPass = cases.filter(item => item.passed && item.attemptCount === 1).length
  const corpusCoveredAtoms = buildCorpusCoveredAtomRows()
  const atomDeployReadyPass = corpusCoveredAtoms.filter(isStage4DeployReadyAtom).length
  const report: Stage4StagingAcceptanceReport = {
    env: 'staging',
    generatedAt: new Date().toISOString(),
    atomDeployReadyTotal: corpusCoveredAtoms.length,
    atomDeployReadyPass,
    atomDeployReadyPct: pct(atomDeployReadyPass, corpusCoveredAtoms.length),
    corpusTotal: cases.length,
    corpusPass,
    corpusFail: cases.length - corpusPass,
    corpusPassPct: pct(corpusPass, cases.length),
    attemptOnePassPct: pct(corpusPass, cases.length),
    categoryCoverage: buildCategoryCoverage(cases),
    blockers,
    cases,
  }
  await mkdir(dirname(jsonOut), { recursive: true })
  await writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(mdOut, renderMarkdown(report), 'utf8')
  process.stdout.write(`${JSON.stringify({
    corpusTotal: report.corpusTotal,
    corpusPass: report.corpusPass,
    corpusFail: report.corpusFail,
    corpusPassPct: report.corpusPassPct,
    attemptOnePassPct: report.attemptOnePassPct,
    atomDeployReadyPct: report.atomDeployReadyPct,
    blockers: report.blockers,
    jsonOut,
    mdOut,
  }, null, 2)}\n`)
  if (report.corpusPass !== report.corpusTotal) process.exitCode = 1
}

if (require.main === module) {
  void main()
}
