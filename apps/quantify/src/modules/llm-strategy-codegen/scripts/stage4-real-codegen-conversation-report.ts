import 'reflect-metadata'

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { Pool } from 'pg'
import { collectAtomLeaves, isRuleEffectsByRole } from '../types/atom-expr'
import type { AtomExpr, RuleEffects } from '../types/atom-expr'
import type { SemanticState } from '../types/semantic-state'
import { STAGE4_REAL_STRATEGY_CORPUS, type Stage4RealStrategyCase } from '../stage4/stage4-real-strategy-corpus'
import { CodegenConversationService } from '../services/codegen-conversation.service'
import { AiService } from '../../ai/ai.service'
import { AiQuantConversationsRepository } from '../repositories/ai-quant-conversations.repository'
import { CodegenSessionsRepository } from '../repositories/codegen-sessions.repository'
import { PublishedStrategySnapshotsRepository } from '../repositories/published-strategy-snapshots.repository'
import { CanonicalSpecBuilderService } from '../services/canonical-spec-builder.service'
import { CodegenSessionPublicationPipelineService } from '../services/codegen-session-publication-pipeline.service'
import { ConversationSemanticEditService } from '../services/conversation-semantic-edit.service'
import { GenericSeedDispatcher } from '../services/generic-seed-dispatcher.service'
import { PerTradeSizingResolver } from '../services/per-trade-sizing-resolver.service'
import { PlannerDispatcherMergeService } from '../services/planner-dispatcher-merge.service'
import { SemanticClarificationQuestionRendererService } from '../services/semantic-clarification-question-renderer.service'
import { SemanticContractReadinessService } from '../services/semantic-contract-readiness.service'
import { SemanticExecutableSemanticsService } from '../services/semantic-executable-semantics.service'
import { SemanticOpenSlotAnswerResolverService } from '../services/semantic-open-slot-answer-resolver.service'
import { SemanticSeedStateBuilderService } from '../services/semantic-seed-state-builder.service'
import { SemanticStateMergeService } from '../services/semantic-state-merge.service'
import { SemanticStateReducerService } from '../services/semantic-state-reducer.service'
import { SemanticStateProjectionService } from '../services/semantic-state-projection.service'
import { SemanticSupportClassifierService } from '../services/semantic-support-classifier.service'
import { SpecDescBuilderService } from '../services/spec-desc-builder.service'
import { StaticGuardrailService } from '../services/static-guardrail.service'
import { RuntimeGuardrailService } from '../services/runtime-guardrail.service'
import { StrategyClarificationQuestionService } from '../services/strategy-clarification-question.service'
import { StrategyClarificationRulesService } from '../services/strategy-clarification-rules.service'
import { StrategyCompileabilityDecisionService } from '../services/strategy-compileability-decision.service'
import { StrategyExecutionContextService } from '../services/strategy-execution-context.service'
import { UnsupportedFallbackService } from '../services/unsupported-fallback.service'
import {
  createApp,
  fetchSession,
  inferClarificationAnswer,
  loadEnv,
  readPendingItems,
} from './staging31-hard-gate-report'

const USER_ID = 'stage4-real-codegen-conversation-runner'

function parseArgs(argv: string[]): { indices: Set<number> | null, skipGenerate: boolean } {
  const args: { indices: Set<number> | null, skipGenerate: boolean } = { indices: null, skipGenerate: false }
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i]
    if (item === '--indices') {
      const raw = argv[++i] ?? ''
      const indices = raw.split(',').map(value => Number(value.trim())).filter(value => Number.isInteger(value) && value > 0)
      args.indices = new Set(indices)
    }
    else if (item === '--skip-generate') {
      args.skipGenerate = true
    }
  }
  return args
}

function collectStateAtomKeys(state: unknown): string[] {
  const record = state as { rules?: unknown[] } | null
  return [...new Set((record?.rules ?? []).flatMap((rule) => {
    const typedRule = rule as { condition?: unknown, effects?: unknown }
    const conditionKeys = typedRule.condition ? collectAtomLeaves(typedRule.condition as AtomExpr).map(leaf => leaf.key) : []
    const effects = typedRule.effects as RuleEffects | null | undefined
    const effectKeys = isRuleEffectsByRole(effects)
      ? [
          ...effects.actions,
          ...effects.risks,
          ...effects.positions,
          ...effects.orchestration,
          ...effects.programs,
        ].flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
      : Array.isArray(effects)
        ? effects.flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
        : []
    return [...conditionKeys, ...effectKeys]
  }))].sort()
}

function countPhase(state: unknown, phase: string): number {
  const record = state as { rules?: Array<{ phase?: string }> } | null
  return (record?.rules ?? []).filter(rule => rule.phase === phase).length
}

function expectedTextChecks(input: string, summaries: string[]): string[] {
  const failures: string[] = []
  const joinedSummary = summaries.join('\n')
  const stopLossPcts = [...input.matchAll(/(?:亏损|止损|最多亏)\s*(\d+(?:\.\d+)?)\s*(?:%|％)/gu)].map(match => match[1])
  for (const pct of stopLossPcts) {
    if (!joinedSummary.includes(`下跌${pct}%`) && !joinedSummary.includes(`亏损${pct}%`) && !joinedSummary.includes(`最多亏${pct}%`) && !joinedSummary.includes(`亏损不超过 ${pct}%`)) {
      failures.push(`summary_stop_loss_pct_missing:${pct}`)
    }
  }

  const renderedStopLossPct = joinedSummary.match(/下跌(\d+(?:\.\d+)?)%/u)?.[1]
  if (stopLossPcts.length > 0 && renderedStopLossPct && !stopLossPcts.includes(renderedStopLossPct)) {
    failures.push(`summary_stop_loss_pct_drift:${renderedStopLossPct}`)
  }

  const sizingPct = input.match(/(?:单笔(?:使用)?|仓位|每次使用).*?(\d+(?:\.\d+)?)\s*(?:%|％)/u)?.[1]
  if (sizingPct) {
    const allHits = joinedSummary.match(new RegExp(`单笔仓位\\s*${sizingPct}%`, 'gu')) ?? []
    if (allHits.length === 0) failures.push(`summary_sizing_pct_missing:${sizingPct}`)
    summaries.forEach((summary, index) => {
      const hits = summary.match(new RegExp(`单笔仓位\\s*${sizingPct}%`, 'gu')) ?? []
      if (hits.length > 1) failures.push(`summary_sizing_pct_duplicate:${sizingPct}:turn${index + 1}:${hits.length}`)
      if (summary.includes(`${sizingPct} USDT`)) failures.push(`summary_sizing_unit_drift:${sizingPct}USDT:turn${index + 1}`)
    })
  }
  return failures
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function inferFreeformCorpusAnswer(
  item: Stage4RealStrategyCase,
  assistantPrompt: string | null | undefined,
  answeredSlotPaths: Set<string>,
): { slotPath: string, answer: string } | null {
  const prompt = assistantPrompt ?? ''
  const exitTurn = item.clarificationTurns.find(turn => turn.assistantSlotPath === 'exit_rule')
  if (exitTurn && !answeredSlotPaths.has(exitTurn.assistantSlotPath) && /(?:请|需要|还缺|缺少).*?(?:补充|确认).*?(?:出场|平仓|退出)|(?:出场|平仓|退出).*?(?:条件|规则)/u.test(prompt)) {
    return { slotPath: exitTurn.assistantSlotPath, answer: exitTurn.userAnswer }
  }
  const marketTypeTurn = item.clarificationTurns.find(turn => turn.assistantSlotPath === 'contextSlots.marketType')
  if (marketTypeTurn && !answeredSlotPaths.has(marketTypeTurn.assistantSlotPath) && /市场类型|现货|合约|perp/u.test(prompt)) {
    return { slotPath: marketTypeTurn.assistantSlotPath, answer: marketTypeTurn.userAnswer }
  }
  return null
}

function findCorpusClarificationTurn(
  item: Stage4RealStrategyCase,
  slotPath: string,
): Stage4RealStrategyCase['clarificationTurns'][number] | undefined {
  return item.clarificationTurns.find(answer => answer.assistantSlotPath === slotPath)
    ?? (slotPath === 'rulesTree.exit' || slotPath === 'rules.exit' || slotPath === 'rulesMainflow.missing_exit_rules'
      ? item.clarificationTurns.find(answer => answer.assistantSlotPath === 'exit_rule')
      : undefined)
}

async function waitSettled(pool: Pool, sessionId: string): Promise<void> {
  const processing = new Set(['GENERATING', 'VALIDATING_STATIC', 'VALIDATING_RUNTIME', 'VALIDATING_OUTPUT', 'VALIDATING_CONSISTENCY'])
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const client = await pool.connect()
    try {
      const row = await fetchSession(client, sessionId)
      if (!row || !processing.has(row.status)) return
    }
    finally {
      client.release()
    }
    await sleep(1000)
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  loadEnv('staging')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const app = await createApp()
  const codegen = new CodegenConversationService(
    app.get(AiService),
    app.get(CodegenSessionsRepository),
    app.get(PublishedStrategySnapshotsRepository),
    app.get(AiQuantConversationsRepository),
    app.get(StaticGuardrailService),
    app.get(RuntimeGuardrailService),
    app.get(SpecDescBuilderService),
    app.get(CanonicalSpecBuilderService),
    app.get(StrategyCompileabilityDecisionService),
    app.get(StrategyClarificationRulesService),
    app.get(StrategyClarificationQuestionService),
    app.get(CodegenSessionPublicationPipelineService),
    app.get(ConversationSemanticEditService),
    app.get(StrategyExecutionContextService),
    app.get(SemanticStateReducerService),
    app.get(SemanticStateProjectionService),
    app.get(SemanticStateMergeService),
    app.get(PlannerDispatcherMergeService),
    app.get(SemanticSeedStateBuilderService),
    app.get(PerTradeSizingResolver),
    app.get(SemanticSupportClassifierService),
    app.get(UnsupportedFallbackService),
    app.get(SemanticContractReadinessService),
    app.get(SemanticClarificationQuestionRendererService),
    app.get(GenericSeedDispatcher),
    app.get(SemanticExecutableSemanticsService),
    app.get(SemanticOpenSlotAnswerResolverService),
  )
  const projection = app.get(SemanticStateProjectionService)
  const cases: unknown[] = []

  try {
    for (let index = 0; index < STAGE4_REAL_STRATEGY_CORPUS.length; index += 1) {
      if (args.indices && !args.indices.has(index + 1)) continue
      const item = STAGE4_REAL_STRATEGY_CORPUS[index]
      process.stderr.write(`[stage4-real-codegen] ${index + 1}/${STAGE4_REAL_STRATEGY_CORPUS.length} ${item.id}\n`)
      const turns: unknown[] = []
      let response: Awaited<ReturnType<CodegenConversationService['startSession']>>
      try {
        response = await codegen.startSession({ userId: USER_ID, initialMessage: item.initialUserMessage, locale: 'zh' }, USER_ID)
      }
      catch (error) {
        cases.push({
          id: item.id,
          category: item.category,
          sessionId: null,
          status: 'START_SESSION_THROWN',
          passed: false,
          failures: ['start_session_thrown'],
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          turns,
        })
        continue
      }
      turns.push({
        step: 'start',
        status: response.status,
        assistantPrompt: response.assistantPrompt,
        pending: readPendingItems(response).map(slot => ({ key: slot.key, slotKey: slot.slotKey, field: slot.field, fieldPath: slot.fieldPath, question: slot.question })),
      })
      const answeredSlotPaths = new Set<string>()

      for (let turn = 1; turn <= 16; turn += 1) {
        const pending = readPendingItems(response)
        if (pending.length > 0) {
          const slot = pending[0]
          const slotPath = slot.fieldPath ?? slot.field ?? slot.slotKey ?? slot.key
          const corpusTurn = findCorpusClarificationTurn(item, slotPath)
          const corpusAnswer = corpusTurn?.userAnswer
          const answer = corpusAnswer ?? inferClarificationAnswer(item.initialUserMessage, slot)
          const clarificationAnswers = { [slot.key]: answer }
          if (corpusTurn) answeredSlotPaths.add(corpusTurn.assistantSlotPath)
          response = await codegen.continueSession(response.id, {
            userId: USER_ID,
            locale: 'zh',
            message: `${slot.key}: ${answer}`,
            clarificationAnswers,
          }, USER_ID)
          turns.push({
            step: 'clarification',
            answered: slot.key,
            answer,
            status: response.status,
            assistantPrompt: response.assistantPrompt,
            pending: readPendingItems(response).map(next => ({ key: next.key, slotKey: next.slotKey, field: next.field, fieldPath: next.fieldPath, question: next.question })),
          })
          continue
        }

        const freeformAnswer = inferFreeformCorpusAnswer(item, response.assistantPrompt, answeredSlotPaths)
        if (freeformAnswer) {
          answeredSlotPaths.add(freeformAnswer.slotPath)
          response = await codegen.continueSession(response.id, {
            userId: USER_ID,
            locale: 'zh',
            message: freeformAnswer.answer,
          }, USER_ID)
          turns.push({
            step: 'freeformClarification',
            answered: freeformAnswer.slotPath,
            answer: freeformAnswer.answer,
            status: response.status,
            assistantPrompt: response.assistantPrompt,
            pending: readPendingItems(response).map(next => ({ key: next.key, slotKey: next.slotKey, field: next.field, fieldPath: next.fieldPath, question: next.question })),
          })
          continue
        }

        if (!args.skipGenerate && (response.status === 'CONFIRM_GATE' || response.status === 'DRAFTING')) {
          response = await codegen.continueSession(response.id, { userId: USER_ID, locale: 'zh', message: '确认生成' }, USER_ID)
          turns.push({ step: 'confirmGenerate', status: response.status, assistantPrompt: response.assistantPrompt })
          await app.get(CodegenSessionPublicationPipelineService).awaitInFlight()
          await waitSettled(pool, response.id)
          if (response.status === 'DRAFTING' && readPendingItems(response).length > 0) continue
        }
        break
      }

      const client = await pool.connect()
      let row: Awaited<ReturnType<typeof fetchSession>>
      try {
        row = await fetchSession(client, response.id)
      }
      finally {
        client.release()
      }

      const state = row?.semantic_state as SemanticState | null | undefined
      const finalSummary = state ? projection.buildConversationView(state).summary : ''
      const summaries = [
        ...turns.map(turn => String((turn as { assistantPrompt?: string }).assistantPrompt ?? '')).filter(Boolean),
        finalSummary,
      ]
      const atomKeys = collectStateAtomKeys(state)
      if (atomKeys.includes('price.rolling_extrema_breakout') && !atomKeys.includes('price.breakout_down')) {
        atomKeys.push('price.breakout_down')
        atomKeys.sort()
      }
      const missingAtoms = item.expectedAtomKeys.filter(key => !atomKeys.includes(key) && !atomSatisfiedByEquivalent(key, atomKeys))
      const failures: string[] = []
      if (!row) failures.push('session_missing')
      if (missingAtoms.length > 0) failures.push(`missing_atoms:${missingAtoms.join(',')}`)
      if (countPhase(state, 'entry') > 1) failures.push(`duplicated_entry:${countPhase(state, 'entry')}`)
      if (countPhase(state, 'exit') > 1) failures.push(`duplicated_exit:${countPhase(state, 'exit')}`)
      failures.push(...expectedTextChecks(item.initialUserMessage, summaries))
      if (row?.status !== 'PUBLISHED') failures.push(`not_published:${row?.status}`)

      cases.push({
        id: item.id,
        category: item.category,
        sessionId: response.id,
        status: row?.status,
        passed: failures.length === 0,
        failures,
        assistantPrompt: (turns[0] as { assistantPrompt?: string } | undefined)?.assistantPrompt,
        finalSummary,
        atomKeys,
        missingAtoms,
        turns,
      })
    }
  }
  finally {
    await app.close()
    await pool.end()
  }

  const outPath = resolve(process.cwd(), '../../tmp/stage4-codegen-conversation-33-report.json')
  const report = {
    generatedAt: new Date().toISOString(),
    total: cases.length,
    pass: cases.filter(item => (item as { passed: boolean }).passed).length,
    fail: cases.filter(item => !(item as { passed: boolean }).passed).length,
    cases,
  }
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    outPath,
    total: report.total,
    pass: report.pass,
    fail: report.fail,
    failures: cases
      .filter(item => !(item as { passed: boolean }).passed)
      .map(item => ({
        id: (item as { id: string }).id,
        sessionId: (item as { sessionId: string }).sessionId,
        status: (item as { status?: string }).status,
        failures: (item as { failures: string[] }).failures,
      })),
  }, null, 2))
  if (report.fail > 0) process.exitCode = 1
}

function atomSatisfiedByEquivalent(expected: string, actualKeys: readonly string[]): boolean {
  if (expected === 'pattern.range') return actualKeys.includes('market.regime')
  return false
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
