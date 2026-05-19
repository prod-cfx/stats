import 'reflect-metadata'

import type { INestApplicationContext } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type { CodegenSessionResponseDto } from '../dto/codegen-session.response.dto'
import type { SemanticState } from '../types/semantic-state'
import type { StrategyClarificationItem } from '../types/strategy-clarification'
import type { StrategyClarificationState } from '../types/strategy-clarification'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { config as loadDotenv } from 'dotenv'
import { Pool } from 'pg'
import { AiService } from '../../../modules/ai/ai.service'
import { ClsConfigModule } from '../../../common/modules/cls.module'
import { EnvModule } from '../../../common/modules/env.module'
import { allConfigLoaders } from '../../../config'
import { applyQuantifyEnvOverrides } from '../../../config/quantify-env'
import { PrismaModule } from '../../../prisma/prisma.module'
import { AiQuantConversationsRepository } from '../repositories/ai-quant-conversations.repository'
import { CodegenSessionsRepository } from '../repositories/codegen-sessions.repository'
import { PublishedStrategySnapshotsRepository } from '../repositories/published-strategy-snapshots.repository'
import { STAGING31_CASES } from './staging31-hard-gate-cases'
import { CURRENT_SEMANTIC_VERSION } from '../nl-gateway/version-gate/version-gate'
import { CanonicalSpecBuilderService } from '../services/canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../services/canonical-spec-v2-ir-compiler.service'
import { CanonicalSpecV2DigestService } from '../services/canonical-spec-v2-digest.service'
import { CanonicalSpecV2ValidatorService } from '../services/canonical-spec-v2-validator.service'
import { CanonicalStrategyAstCompilerService } from '../services/canonical-strategy-ast-compiler.service'
import { CanonicalStrategyIrCanonicalizerService } from '../services/canonical-strategy-ir-canonicalizer.service'
import { CanonicalStrategyIrValidatorService } from '../services/canonical-strategy-ir-validator.service'
import { CodegenConversationService } from '../services/codegen-conversation.service'
import { CodegenGraphSnapshotService } from '../services/codegen-graph-snapshot.service'
import { CodegenPublicationGenerationStage } from '../services/codegen-publication-generation.stage'
import { CodegenSessionPublicationPipelineService } from '../services/codegen-session-publication-pipeline.service'
import { CompiledPublicationGateService } from '../services/compiled-publication-gate.service'
import { CompiledScriptEmitterService } from '../services/compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../services/compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../services/compiled-script-parser.service'
import { ConversationSemanticEditService } from '../services/conversation-semantic-edit.service'
import { GenericSeedDispatcher } from '../services/generic-seed-dispatcher.service'
import { MarketInstrumentSymbolResolverService } from '../services/market-instrument-symbol-resolver.service'
import { NaturalLanguageGatewayService } from '../services/natural-language-gateway.service'
import { PerTradeSizingResolver } from '../services/per-trade-sizing-resolver.service'
import { PlannerDispatcherMergeService } from '../services/planner-dispatcher-merge.service'
import { PositionSizingContractService } from '../services/position-sizing-contract.service'
import { RecommendationIndexService } from '../services/recommendation-index.service'
import { RuntimeGuardrailService } from '../services/runtime-guardrail.service'
import { ScriptProfileExtractorService } from '../services/script-profile-extractor.service'
import { SemanticAtomContractService } from '../services/semantic-atom-contract.service'
import { SemanticAtomRegistryService } from '../services/semantic-atom-registry.service'
import { SemanticClarificationQuestionRendererService } from '../services/semantic-clarification-question-renderer.service'
import { SemanticContractReadinessService } from '../services/semantic-contract-readiness.service'
import { SemanticContractShapeNormalizerService } from '../services/semantic-contract-shape-normalizer.service'
import { SemanticEventFrameParserService } from '../services/semantic-event-frame-parser.service'
import { SemanticEventFrameProjectorService } from '../services/semantic-event-frame-projector.service'
import { SemanticExecutableSemanticsService } from '../services/semantic-executable-semantics.service'
import { SemanticFrameNormalizerService } from '../services/semantic-frame-normalizer.service'
import { SemanticOpenSlotAnswerResolverService } from '../services/semantic-open-slot-answer-resolver.service'
import { SemanticOrchestrationRegistryService } from '../services/semantic-orchestration-registry.service'
import { SemanticRuleProjectionService } from '../services/semantic-rule-projection.service'
import {
  SEMANTIC_SEED_EVIDENCE_INVARIANT_MODE,
  SemanticSeedStateBuilderService,
} from '../services/semantic-seed-state-builder.service'
import { SemanticStateMergeService } from '../services/semantic-state-merge.service'
import { SemanticStateProjectionService } from '../services/semantic-state-projection.service'
import { SemanticStateReducerService } from '../services/semantic-state-reducer.service'
import { SemanticSupportClassifierService } from '../services/semantic-support-classifier.service'
import { SemanticTriggerCombinationContractService } from '../services/semantic-trigger-combination-contract.service'
import { SpecDescBuilderService } from '../services/spec-desc-builder.service'
import { StaticGuardrailService } from '../services/static-guardrail.service'
import { StrategyClarificationQuestionService } from '../services/strategy-clarification-question.service'
import { StrategyClarificationRulesService } from '../services/strategy-clarification-rules.service'
import { StrategyCompileabilityDecisionService } from '../services/strategy-compileability-decision.service'
import { StrategyConsistencyService } from '../services/strategy-consistency.service'
import { StrategyExecutionContextService } from '../services/strategy-execution-context.service'
import { StrategyIrBuilderService } from '../services/strategy-ir-builder.service'
import { StrategyIrCanonicalAdapterService } from '../services/strategy-ir-canonical-adapter.service'
import { StrategySummaryBuilderService } from '../services/strategy-summary-builder.service'
import { StrategySummaryObservationService } from '../services/strategy-summary-observation.service'
import { UnsupportedFallbackService } from '../services/unsupported-fallback.service'

const RUNNER_USER_ID = 'staging31-hard-gate-runner'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: allConfigLoaders,
    }),
    EnvModule,
    ClsConfigModule,
    EventEmitterModule.forRoot(),
    PrismaModule,
  ],
  providers: [
    AiService,
    AiQuantConversationsRepository,
    CodegenSessionsRepository,
    PublishedStrategySnapshotsRepository,
    StaticGuardrailService,
    RuntimeGuardrailService,
    GenericSeedDispatcher,
    PlannerDispatcherMergeService,
    SemanticEventFrameParserService,
    SemanticEventFrameProjectorService,
    SemanticSeedStateBuilderService,
    { provide: SEMANTIC_SEED_EVIDENCE_INVARIANT_MODE, useValue: 'drop' },
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
})
class Staging31RunnerModule {}

export interface Staging31CaseReport {
  index: number
  input: string
  assistantResponse: string
  rulesTree: unknown
  projectedFlat: unknown
  contextPositionRisk: unknown
  clarification: unknown
  readiness: unknown
  uiSummaryOrGraph: unknown
  canonicalSpec: unknown
  ir: unknown
  ast: unknown
  scriptOrError: unknown
  result: 'pass' | 'needs_clarification' | 'unsupported' | 'fail'
  failures: string[]
}

interface Staging31FullReport {
  env: string
  source: 'entry' | 'db'
  generatedAt: string
  summary: {
    total: number
    pass: number
    needsClarification: number
    unsupported: number
    fail: number
    emptyRulesWithClear: number
    supportedActionReportedUnsupported: number
    clarificationClearsRulesTree: number
    uiScriptMismatch: number
    unsupportedWithGeneratedScript: number
  }
  cases: Staging31CaseReport[]
}

interface Args {
  env: string
  out: string
  source: 'entry' | 'db'
}

interface SessionRow {
  id: string
  status: string
  semantic_state: unknown
  clarification_state: unknown
  latest_draft_code: string | null
  latest_spec_desc: unknown
  graph_snapshot: unknown
  semantic_graph: unknown
  validation_report: unknown
  compiled_ir: unknown
  reject_reason: string | null
  messages: Array<{ role: 'user' | 'assistant', content: string }> | null
}

interface EntryRunOutcome {
  sessionId: string
  turns: number
  answers: Record<string, string>
}

export function assertStaging31ReportShape(report: Staging31CaseReport): void {
  const requiredKeys: Array<keyof Staging31CaseReport> = [
    'index',
    'input',
    'assistantResponse',
    'rulesTree',
    'projectedFlat',
    'contextPositionRisk',
    'clarification',
    'readiness',
    'uiSummaryOrGraph',
    'canonicalSpec',
    'ir',
    'ast',
    'scriptOrError',
    'result',
    'failures',
  ]

  for (const key of requiredKeys) {
    if (!(key in report)) {
      throw new Error(`staging31_report_missing_key:${String(key)}`)
    }
  }
}

export function listStaging31Cases(): typeof STAGING31_CASES {
  return STAGING31_CASES
}

export function parseArgs(argv: string[]): Args {
  const args: Args = { env: 'staging', out: 'tmp/staging31-hard-gate-report.json', source: 'entry' }
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i]
    if (item === '--env') args.env = argv[++i] ?? args.env
    else if (item === '--out') args.out = argv[++i] ?? args.out
    else if (item === '--source') {
      const source = argv[++i]
      if (source === 'entry' || source === 'db') args.source = source
      else throw new Error(`invalid_source:${source}`)
    }
  }
  if (!['development', 'staging', 'production'].includes(args.env)) {
    throw new Error(`invalid_env:${args.env}`)
  }
  if (args.env === 'production' && args.source === 'entry') {
    throw new Error('production_entry_source_forbidden')
  }
  return args
}

function loadEnv(env: string): void {
  const root = findEnvRoot(env)
  const base = resolve(root, `.env.${env}`)
  const local = resolve(root, `.env.${env}.local`)
  loadDotenv({ path: base, override: false })
  loadDotenv({ path: local, override: true })
  process.env.APP_ENV = env
  process.env.NODE_ENV = env
  applyQuantifyEnvOverrides(process.env)
  if (!process.env.DATABASE_URL) {
    throw new Error(`missing_database_url:${env}`)
  }
}

function findEnvRoot(env: string): string {
  let current = process.cwd()
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(resolve(current, `.env.${env}`)) && existsSync(resolve(current, `.env.${env}.local`))) {
      return current
    }
    const parent = resolve(current, '..')
    if (parent === current) break
    current = parent
  }
  throw new Error(`missing_env_files:${env}`)
}

async function createApp(): Promise<INestApplicationContext> {
  return NestFactory.createApplicationContext(Staging31RunnerModule, { abortOnError: false, logger: ['error', 'warn'] })
}

function createPublicationStage(): CodegenPublicationGenerationStage {
  const parser = new CompiledScriptParserService()
  const profileExtractor = new ScriptProfileExtractorService()
  return new CodegenPublicationGenerationStage(
    new CanonicalSpecBuilderService(),
    new SpecDescBuilderService(),
    new StrategySummaryBuilderService(profileExtractor),
    new StrategyConsistencyService(profileExtractor, parser),
    new CanonicalSpecV2IrCompilerService(),
    new CanonicalStrategyAstCompilerService(),
    new CompiledScriptEmitterService(),
    new CompiledScriptExecutionEnvelopeService(),
    parser,
  )
}

async function fetchSession(client: PoolClient, sessionId: string): Promise<SessionRow | null> {
  const result = await client.query<SessionRow>(`
    SELECT
      s.id,
      s.status::text AS status,
      s.semantic_state,
      s.clarification_state,
      s.latest_draft_code,
      s.latest_spec_desc,
      s.graph_snapshot,
      s.semantic_graph,
      s.validation_report,
      s.compiled_ir,
      s.reject_reason,
      COALESCE(
        jsonb_agg(
          jsonb_build_object('role', m.role::text, 'content', m.content)
          ORDER BY m.sort_order
        ) FILTER (WHERE m.id IS NOT NULL),
        '[]'::jsonb
      ) AS messages
    FROM llm_strategy_codegen_sessions s
    LEFT JOIN ai_quant_conversations c ON c.codegen_session_id = s.id
    LEFT JOIN ai_quant_conversation_messages m ON m.conversation_id = c.id
    WHERE s.id = $1
    GROUP BY s.id
  `, [sessionId])
  return result.rows[0] ?? null
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function readPendingItems(response: CodegenSessionResponseDto): StrategyClarificationItem[] {
  const gateItems = response.clarificationGate?.pendingItems
  if (Array.isArray(gateItems) && gateItems.length > 0) return gateItems
  const items = response.clarificationState?.items
  if (!Array.isArray(items)) return []
  return items.filter(item => item.blocking && item.status === 'pending')
}

function extractPercent(text: string, fallback: string): string {
  const matched = text.match(/(?:百分之?|%|％)\s*(\d+(?:\.\d+)?)/u)
    ?? text.match(/(\d+(?:\.\d+)?)\s*(?:%|％)/u)
  return matched?.[1] ? `${matched[1]}%` : fallback
}

function inferExchange(input: string): string {
  if (/币安|binance/i.test(input)) return 'binance'
  if (/okx|欧易/i.test(input)) return 'okx'
  return 'okx'
}

function inferMarketType(input: string): string {
  if (/现货|spot/i.test(input)) return 'spot'
  if (/合约|永续|perp|perpetual/i.test(input)) return 'perp'
  return 'perp'
}

function inferTimeframe(input: string): string {
  const normalized = input
    .replace(/分钟|分/u, 'm')
    .replace(/小时/u, 'h')
    .replace(/日线|天/u, 'd')
  const matched = normalized.match(/(\d+)\s*(min|m|h|d|day)\b/iu)
  if (!matched) return '15m'
  const unit = matched[2].toLowerCase()
  if (unit === 'min') return `${matched[1]}m`
  if (unit === 'day') return `${matched[1]}d`
  return `${matched[1]}${unit}`
}

function inferSymbol(input: string): string {
  const upper = input.toUpperCase()
  const pair = upper.match(/\b([A-Z]{2,12})\s*\/?\s*USDT\b/u)
  if (pair?.[1]) return `${pair[1]}USDT`
  const asset = upper.match(/\b(BTC|ETH|SOL|ORDI)\b/u)
  return `${asset?.[1] ?? 'BTC'}USDT`
}

function inferSizing(input: string): string {
  const fixed = input.match(/(\d+(?:\.\d+)?)\s*USDT/iu)
  if (fixed?.[1]) return `${fixed[1]} USDT`
  const bareFixed = input.match(/(?:每次|单笔|每笔|一次)\s*(\d+(?:\.\d+)?)(?!\s*(?:%|％))/u)
  if (bareFixed?.[1]) return `${bareFixed[1]} USDT`
  const percent = input.match(/(?:单笔|仓位|使用|固定仓位|每次).*?(\d+(?:\.\d+)?)\s*(?:%|％)/u)
    ?? input.match(/百分之?\s*(\d+(?:\.\d+)?)/u)
  if (percent?.[1]) return `${percent[1]}%`
  return '10%'
}

function inferClarificationAnswer(input: string, item: StrategyClarificationItem): string {
  const field = `${item.field ?? ''} ${item.fieldPath ?? ''} ${item.slotKey ?? ''} ${item.reason ?? ''} ${item.question ?? ''}`.toLowerCase()
  if (item.allowedAnswers?.length) {
    const allowed = item.allowedAnswers.map(value => value.toLowerCase())
    if (field.includes('exchange')) {
      const exchange = inferExchange(input)
      if (allowed.includes(exchange)) return exchange
    }
    if (field.includes('market')) {
      const marketType = inferMarketType(input)
      if (allowed.includes(marketType)) return marketType
    }
    if (field.includes('basis') && allowed.includes('entry_avg_price')) return 'entry_avg_price'
    if (field.includes('confirmation') && allowed.includes('touch')) return 'touch'
    if (allowed.includes('no')) return 'no'
    if (allowed.includes('false')) return 'false'
    return item.allowedAnswers[0]
  }
  if (field.includes('exchange')) return inferExchange(input)
  if (field.includes('symbol')) return inferSymbol(input)
  if (field.includes('timeframe')) return inferTimeframe(input)
  if (field.includes('market')) return inferMarketType(input)
  if (
    field.includes('rulestree.empty')
    || field.includes('missing_entry_rules')
    || field.includes('entryrules')
  ) {
    return input
  }
  if (field.includes('missing_exit_rules') || field.includes('exitrules')) {
    return '按入场均价亏损 5% 止损，盈利 10% 止盈时平仓。'
  }
  if (field.includes('grid')) {
    if (field.includes('breakout') || field.includes('cancel') || field.includes('撤销') || field.includes('停止')) {
      return /停止|撤销|cancel|stop/iu.test(input) ? 'stop' : 'continue'
    }
    if (field.includes('center')) {
      const center = input.match(/上下各\s*(\d+(?:\.\d+)?)\s*(?:%|％)/u)
      if (center?.[1]) return `${center[1]}%`
    }
    if (field.includes('level')) {
      const levels = input.match(/(?:共)?\s*(\d+)\s*格/u)
      if (levels?.[1]) return levels[1]
    }
  }
  if (field.includes('add_position') && field.includes('constraint')) {
    return '最多加 1 次，最大总敞口 300 USDT。'
  }
  if (field.includes('position') || field.includes('sizing') || field.includes('budget')) return inferSizing(input)
  if (field.includes('basis')) return 'entry_avg_price'
  if (field.includes('grid') && (field.includes('lower') || field.includes('upper'))) {
    const range = input.match(/(\d+(?:\.\d+)?)\s*[-到至]\s*(\d+(?:\.\d+)?)/u)
    if (range?.[1] && field.includes('lower')) return range[1]
    if (range?.[2] && field.includes('upper')) return range[2]
  }
  if (field.includes('step')) {
    const step = input.match(/(?:间距|每格).*?(\d+(?:\.\d+)?)\s*(?:%|％)/u)
    if (step?.[1]) return `${step[1]}%`
  }
  if (field.includes('side')) return /双向/u.test(input) ? 'both' : 'long'
  if (field.includes('stop')) return extractPercent(input, '5%')
  if (field.includes('take')) return extractPercent(input, '10%')
  return '按原策略描述默认值补齐'
}

function buildClarificationAnswers(input: string, items: readonly StrategyClarificationItem[]): Record<string, string> {
  const answers: Record<string, string> = {}
  for (const item of items) {
    answers[item.key] = inferClarificationAnswer(input, item)
  }
  return answers
}

async function waitForSessionSettled(client: PoolClient, sessionId: string): Promise<void> {
  const processing = new Set([
    'GENERATING',
    'VALIDATING_STATIC',
    'VALIDATING_RUNTIME',
    'VALIDATING_OUTPUT',
    'VALIDATING_CONSISTENCY',
  ])
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const row = await fetchSession(client, sessionId)
    if (!row || !processing.has(row.status)) return
    await sleep(1000)
  }
}

async function runEntryCase(input: {
  codegen: CodegenConversationService
  client: PoolClient
  index: number
  text: string
}): Promise<EntryRunOutcome> {
  let response = await input.codegen.startSession({
    userId: RUNNER_USER_ID,
    initialMessage: input.text,
    locale: 'zh',
  }, RUNNER_USER_ID)
  const answers: Record<string, string> = {}
  let confirmed = false

  for (let turn = 1; turn <= 8; turn += 1) {
    const pendingItems = readPendingItems(response)
    if (pendingItems.length > 0) {
      const turnAnswers = buildClarificationAnswers(input.text, pendingItems)
      Object.assign(answers, turnAnswers)
      response = await input.codegen.continueSession(response.id, {
        userId: RUNNER_USER_ID,
        locale: 'zh',
        message: Object.entries(turnAnswers).map(([key, value]) => `${key}: ${value}`).join('\n'),
        clarificationAnswers: turnAnswers,
      }, RUNNER_USER_ID)
      continue
    }

    if (!confirmed) {
      confirmed = true
      response = await input.codegen.continueSession(response.id, {
        userId: RUNNER_USER_ID,
        locale: 'zh',
        message: '确认生成',
      }, RUNNER_USER_ID)
      await waitForSessionSettled(input.client, response.id)
      continue
    }

    return { sessionId: response.id, turns: turn, answers }
  }

  return { sessionId: response.id, turns: 8, answers }
}

function asSemanticState(value: unknown): SemanticState | null {
  if (!value || typeof value !== 'object') return null
  return value as SemanticState
}

function asClarification(value: unknown): StrategyClarificationState | null {
  if (!value || typeof value !== 'object') return null
  return value as StrategyClarificationState
}

function summarizeFlat(state: SemanticState): Record<string, unknown> {
  return {
    trigger: state.trigger ?? [],
    action: state.action ?? [],
    risk: state.risk ?? [],
    positionConstraint: state.positionConstraint ?? [],
    orchestration: state.orchestration ?? [],
  }
}

function buildContextPositionRisk(state: SemanticState): Record<string, unknown> {
  return {
    contextSlots: state.contextSlots ?? null,
    position: state.position ?? null,
    risk: state.risk ?? [],
    positionConstraint: state.positionConstraint ?? [],
    orchestration: state.orchestration ?? [],
  }
}

export function hasUiAstScriptMismatch(args: {
  rulesTree: unknown
  uiSummaryOrGraph: unknown
  ast: unknown
  scriptOrError: unknown
}): boolean {
  const ruleActions = collectRulesTreeSemanticActions(args.rulesTree)
  const uiActions = collectUiGraphSemanticActions(args.uiSummaryOrGraph)
  const astSemanticActions = collectAstSemanticActions(args.ast)
  if (
    !sameStringSet(ruleActions, uiActions)
    || !sameStringSet(ruleActions, astSemanticActions)
  ) {
    return true
  }

  const astExecutableActions = collectAstExecutableActions(args.ast)
  const scriptActions = collectScriptExecutableActions(args.scriptOrError)
  return scriptActions.length > 0 && !sameStringSet(astExecutableActions, scriptActions)
}

function collectRulesTreeSemanticActions(rulesTree: unknown): string[] {
  if (!Array.isArray(rulesTree)) return []
  return uniqueSorted(rulesTree.flatMap((rule) => {
    const item = rule as { phase?: unknown, condition?: unknown, effects?: unknown, sideScope?: unknown }
    if (collectAtomKeys(item.condition).includes('portfolioRisk.drawdown_block')) {
      return []
    }
    if (collectAtomKeys(item.condition).includes('grid.range_rebalance')) {
      return ['OPEN_LONG', 'OPEN_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT']
    }
    return [
      ...collectActionKeys(item.effects, item.sideScope),
      ...collectRiskSemanticActions(item.condition, item.effects, item.sideScope),
    ]
  }))
}

function collectActionKeys(effects: unknown, sideScope?: unknown): string[] {
  if (!Array.isArray(effects)) return []
  return effects.flatMap((effect) => {
    const key = (effect as { key?: unknown }).key
    if (
      key === 'program.fixed_grid_gated'
      || key === 'program.dynamic_grid'
      || key === 'program.adaptive_volatility_grid'
    ) {
      return ['OPEN_LONG', 'OPEN_SHORT']
    }
    if (key === 'portfolioRisk.drawdown_block') {
      return []
    }
    if (key === 'action.add_position') {
      if (sideScope === 'short') return ['ADD_SHORT']
      if (sideScope === 'both') return ['ADD_LONG', 'ADD_SHORT']
      return ['ADD_LONG']
    }
    return [key]
  })
    .filter((key): key is string => typeof key === 'string')
    .map(toCanonicalAction)
    .filter((key): key is string => typeof key === 'string')
}

function collectRiskSemanticActions(condition: unknown, effects: unknown, sideScope: unknown): string[] {
  const explicit = collectActionKeys(effects, sideScope)
  if (explicit.some(action => action === 'CLOSE_LONG' || action === 'CLOSE_SHORT')) {
    return explicit.filter(action => action === 'CLOSE_LONG' || action === 'CLOSE_SHORT')
  }
  const effectKeys = collectAtomKeys(effects)
  if (!effectKeys.some(key => key.startsWith('risk.') || key === 'position_loss_pct')) {
    return []
  }
  if (sideScope === 'long') return ['CLOSE_LONG']
  if (sideScope === 'short') return ['CLOSE_SHORT']
  return ['CLOSE_LONG', 'CLOSE_SHORT']
}

function collectAtomKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectAtomKeys)
  if (!value || typeof value !== 'object') return []
  const node = value as { key?: unknown, children?: unknown, child?: unknown, steps?: unknown, effects?: unknown, condition?: unknown }
  const keys = typeof node.key === 'string' ? [node.key] : []
  return [
    ...keys,
    ...collectAtomKeys(node.children),
    ...collectAtomKeys(node.child),
    ...collectAtomKeys(node.steps),
    ...collectAtomKeys(node.effects),
    ...collectAtomKeys(node.condition),
  ]
}

function collectUiGraphSemanticActions(uiSummaryOrGraph: unknown): string[] {
  const graph = (uiSummaryOrGraph as { graph?: { blocks?: unknown } } | null)?.graph
  if (!graph || !Array.isArray(graph.blocks)) return []
  const actions = graph.blocks.flatMap((block) => {
    const items = (block as { items?: unknown }).items
    if (!Array.isArray(items)) return []
    if (items.some((item) => {
      const text = (item as { text?: unknown }).text
      return typeof text === 'string' && (text.includes('阻止开新仓') || text.includes('组合回撤护栏'))
    })) {
      return []
    }
    const blockActions = items
      .filter(item => (item as { kind?: unknown }).kind === 'action')
      .flatMap((item) => {
        const text = (item as { text?: unknown }).text
        if (typeof text === 'string' && (text.includes('止损') || text.includes('止盈'))) {
          return inferUiRiskCloseActions(items)
        }
        if (typeof text === 'string' && text.includes('网格')) {
          return ['OPEN_LONG', 'OPEN_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT']
        }
        if (typeof text === 'string' && isUiAddPositionActionText(text)) {
          return inferUiAddActions(items)
        }
        return [toCanonicalAction(text)]
      })
      .filter((key): key is string => typeof key === 'string')
    const hasGridCondition = items.some((item) => {
      const text = (item as { text?: unknown }).text
      return typeof text === 'string' && text.includes('网格')
    })
    return hasGridCondition
      ? [...blockActions, 'OPEN_LONG', 'OPEN_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT']
      : blockActions
  })
  return uniqueSorted(actions)
}

function inferUiRiskCloseActions(items: unknown[]): string[] {
  const texts = items
    .map(item => (item as { text?: unknown }).text)
    .filter((text): text is string => typeof text === 'string')
  const hasLong = texts.some(text => text.includes('开多') || text.includes('做多') || text.includes('平多'))
  const hasShort = texts.some(text => text.includes('开空') || text.includes('做空') || text.includes('平空'))
  if (hasLong && hasShort) return ['CLOSE_LONG', 'CLOSE_SHORT']
  if (hasShort) return ['CLOSE_SHORT']
  if (hasLong) return ['CLOSE_LONG']
  return ['CLOSE_LONG', 'CLOSE_SHORT']
}

function inferUiAddActions(items: unknown[]): string[] {
  const texts = items
    .map(item => (item as { text?: unknown }).text)
    .filter((text): text is string => typeof text === 'string')
  const hasLong = texts.some(text => text.includes('开多') || text.includes('做多') || text.includes('多'))
  const hasShort = texts.some(text => text.includes('开空') || text.includes('做空') || text.includes('空'))
  if (hasLong && hasShort) return ['ADD_LONG', 'ADD_SHORT']
  if (hasShort) return ['ADD_SHORT']
  return ['ADD_LONG']
}

function isUiAddPositionActionText(text: string): boolean {
  const normalized = text.trim()
  if (normalized.includes('DCA') || normalized.includes('计划')) return false
  return normalized.startsWith('加仓') || normalized.includes('追加仓位')
}

function collectAstSemanticActions(ast: unknown): string[] {
  return uniqueSorted([
    ...collectAstDecisionActions(ast),
    ...collectAstGuardSemanticActions(ast),
    ...collectAstRiskPredicateActions(ast),
    ...collectAstOrchestrationProgramActions(ast),
  ])
}

function collectAstExecutableActions(ast: unknown): string[] {
  return uniqueSorted([
    ...collectAstDecisionActions(ast),
    ...collectAstGuardExecutableActions(ast),
    ...collectAstRiskPredicateActions(ast),
    ...collectAstOrchestrationProgramActions(ast),
  ])
}

function collectAstDecisionActions(ast: unknown): string[] {
  const decisionPrograms = (ast as { decisionPrograms?: unknown } | null)?.decisionPrograms
  if (!Array.isArray(decisionPrograms)) return []
  return decisionPrograms.flatMap((program) => {
    const actions = (program as { actions?: unknown }).actions
    if (!Array.isArray(actions)) return []
    return actions
      .map(action => toCanonicalAction((action as { kind?: unknown }).kind))
      .filter((key): key is string => typeof key === 'string')
  })
}

function collectAstGuardSemanticActions(ast: unknown): string[] {
  const guards = (ast as { guards?: unknown } | null)?.guards
  if (!Array.isArray(guards)) return []
  return guards
    .map((guard) => {
      const payload = (guard as { payload?: { onBreach?: unknown, appliesTo?: unknown } }).payload
      const onBreach = toCanonicalAction(payload?.onBreach)
      if (onBreach !== 'FORCE_EXIT') return onBreach
      if (payload?.appliesTo === 'long') return 'CLOSE_LONG'
      if (payload?.appliesTo === 'short') return 'CLOSE_SHORT'
      return 'CLOSE_LONG|CLOSE_SHORT'
    })
    .flatMap(action => action === 'CLOSE_LONG|CLOSE_SHORT' ? ['CLOSE_LONG', 'CLOSE_SHORT'] : [action])
    .filter((key): key is string => typeof key === 'string')
}

function collectAstGuardExecutableActions(ast: unknown): string[] {
  const guards = (ast as { guards?: unknown } | null)?.guards
  if (!Array.isArray(guards)) return []
  return guards
    .map(guard => toCanonicalAction((guard as { payload?: { onBreach?: unknown } }).payload?.onBreach))
    .filter((key): key is string => typeof key === 'string')
}

function collectAstOrchestrationProgramActions(ast: unknown): string[] {
  const programs = (ast as { orchestrationPrograms?: unknown } | null)?.orchestrationPrograms
  if (!Array.isArray(programs)) return []
  return programs.flatMap((program) => {
    const kind = (program as { programKind?: unknown }).programKind
    return kind === 'fixed_grid_gated' || kind === 'dynamic_grid' || kind === 'adaptive_volatility_grid'
      ? ['OPEN_LONG', 'OPEN_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT']
      : []
  })
}

function collectAstRiskPredicateActions(ast: unknown): string[] {
  const predicates = (ast as { riskPredicates?: unknown } | null)?.riskPredicates
  if (!Array.isArray(predicates)) return []
  const closeActions = inferForceExitCloseActions(ast)
  return predicates.flatMap((predicate) => {
    const actions = (predicate as { payload?: { actions?: unknown } }).payload?.actions
    if (!Array.isArray(actions)) return []
    return actions.flatMap((action) => {
      const kind = toCanonicalAction((action as { kind?: unknown }).kind)
      return kind === 'FORCE_EXIT' ? closeActions : [kind]
    })
  }).filter((key): key is string => typeof key === 'string')
}

function inferForceExitCloseActions(ast: unknown): string[] {
  const decisionActions = collectAstDecisionActions(ast)
  const hasLong = decisionActions.includes('OPEN_LONG') || decisionActions.includes('CLOSE_LONG')
  const hasShort = decisionActions.includes('OPEN_SHORT') || decisionActions.includes('CLOSE_SHORT')
  if (hasLong && hasShort) return ['CLOSE_LONG', 'CLOSE_SHORT']
  if (hasShort) return ['CLOSE_SHORT']
  return ['CLOSE_LONG']
}

function collectScriptExecutableActions(scriptOrError: unknown): string[] {
  const script = (scriptOrError as { script?: unknown } | null)?.script
  if (typeof script !== 'string' || script.length === 0) return []
  return uniqueSorted(new ScriptProfileExtractorService().extract(script).actions)
}

function toCanonicalAction(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  switch (normalized) {
    case 'action.open_long':
    case 'OPEN_LONG':
    case '开多':
      return 'OPEN_LONG'
    case 'action.open_short':
    case 'OPEN_SHORT':
    case '开空':
      return 'OPEN_SHORT'
    case 'action.close_long':
    case 'CLOSE_LONG':
    case '平多':
      return 'CLOSE_LONG'
    case 'action.close_short':
    case 'CLOSE_SHORT':
    case '平空':
      return 'CLOSE_SHORT'
    case 'action.adjust_position':
    case 'ADJUST_POSITION':
      return 'ADJUST_POSITION'
    case 'ADD_LONG':
      return 'ADD_LONG'
    case 'ADD_SHORT':
      return 'ADD_SHORT'
    case 'FORCE_EXIT':
      return 'FORCE_EXIT'
    default:
      return null
  }
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return uniqueSorted(left).join('|') === uniqueSorted(right).join('|')
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort()
}

function readAssistant(messages: SessionRow['messages']): string {
  return messages?.filter(message => message.role === 'assistant').at(-1)?.content ?? ''
}

function readInput(messages: SessionRow['messages'], fallback: string): string {
  return messages?.find(message => message.role === 'user')?.content ?? fallback
}

function classifyResult(args: {
  clarification: StrategyClarificationState | null
  readinessReady: boolean
  scriptGenerated: boolean
  unsupported: boolean
  failures: string[]
}): Staging31CaseReport['result'] {
  if (args.failures.length > 0) return 'fail'
  if (args.unsupported) return 'unsupported'
  if (!args.readinessReady || args.clarification?.status === 'NEEDS_CLARIFICATION') return 'fail'
  if (args.scriptGenerated) return 'pass'
  return 'unsupported'
}

async function buildCaseReport(input: {
  row: SessionRow | null
  index: number
  fallbackInput: string
  services: {
    ruleProjection: SemanticRuleProjectionService
    readiness: SemanticContractReadinessService
    stateProjection: SemanticStateProjectionService
    supportClassifier: SemanticSupportClassifierService
    publication: CodegenPublicationGenerationStage
  }
}): Promise<Staging31CaseReport> {
  const failures: string[] = []
  if (!input.row) {
    failures.push('session_missing')
    return {
      index: input.index,
      input: input.fallbackInput,
      assistantResponse: '',
      rulesTree: null,
      projectedFlat: null,
      contextPositionRisk: null,
      clarification: null,
      readiness: null,
      uiSummaryOrGraph: null,
      canonicalSpec: null,
      ir: null,
      ast: null,
      scriptOrError: { error: 'session_missing' },
      result: 'fail',
      failures,
    }
  }

  const semanticState = asSemanticState(input.row.semantic_state)
  const clarification = asClarification(input.row.clarification_state)
  if (!semanticState) failures.push('semantic_state_missing')

  let projectedState = semanticState ? input.services.ruleProjection.reprojectFromRules(semanticState) : null
  if (projectedState) {
    projectedState = input.services.supportClassifier.classify(projectedState, {
      deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION,
    }).state
  }
  const readiness = projectedState
    ? input.services.readiness.normalize(projectedState, {
        deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION,
      })
    : null
  const reportState = readiness?.state ?? projectedState
  const rulesTree = reportState?.rules ?? []
  const rulesEmpty = !Array.isArray(rulesTree) || rulesTree.length === 0
  const clarificationClear = clarification?.status === 'CLEAR'
  if (rulesEmpty) failures.push('rules_tree_empty')
  if (rulesEmpty && clarificationClear) failures.push('empty_rules_with_clear')
  if (rulesEmpty && clarificationClear) failures.push('clarification_clears_rules_tree')
  if (clarification?.status === 'NEEDS_CLARIFICATION') failures.push('clarification_not_resolved_to_script')
  if (readiness && !readiness.ready) failures.push('readiness_not_ready')

  const unsupportedActions = (reportState?.action ?? []).filter(action =>
    action.key?.startsWith('action.')
    && action.support?.supportStatus
    && action.support.supportStatus !== 'supported_executable'
  )
  if (unsupportedActions.length > 0) failures.push('supported_action_reported_unsupported')

  let canonicalSpec: unknown = null
  let ir: unknown = null
  let ast: unknown = null
  let scriptOrError: unknown = { error: 'not_ready', ready: readiness?.ready ?? false }
  let scriptGenerated = false
  if (reportState && !rulesEmpty && readiness?.ready) {
    try {
      const artifacts = await input.services.publication.generate({
        semanticState: reportState,
        clarificationState: clarification,
      })
      canonicalSpec = artifacts.canonicalSpec
      ir = artifacts.compiled.ir
      ast = artifacts.ast
      scriptOrError = { script: artifacts.compiledScript, validation: artifacts.validation }
      scriptGenerated = true
      const uiSummaryOrGraph = reportState
        ? {
            summary: input.services.stateProjection.buildConversationView(reportState),
            graph: input.services.stateProjection.buildDisplayLogicGraph(reportState),
          }
        : null
      if (hasUiAstScriptMismatch({ rulesTree, uiSummaryOrGraph, ast, scriptOrError })) {
        failures.push('ui_script_mismatch')
      }
    }
    catch (error) {
      scriptOrError = { error: error instanceof Error ? error.message : String(error) }
    }
  }

  const unsupported = Boolean(input.row.reject_reason) || /暂未识别成合规|不支持|unsupported/i.test(readAssistant(input.row.messages))
  if (unsupported && scriptGenerated) failures.push('unsupported_with_generated_script')

  return {
    index: input.index,
    input: readInput(input.row.messages, input.fallbackInput),
    assistantResponse: readAssistant(input.row.messages),
    rulesTree,
    projectedFlat: reportState ? summarizeFlat(reportState) : null,
    contextPositionRisk: reportState ? buildContextPositionRisk(reportState) : null,
    clarification,
    readiness: readiness ? { ready: readiness.ready, missingRequirements: readiness.missingRequirements } : null,
    uiSummaryOrGraph: reportState
      ? {
          summary: input.services.stateProjection.buildConversationView(reportState),
          graph: input.services.stateProjection.buildDisplayLogicGraph(reportState),
        }
      : null,
    canonicalSpec,
    ir,
    ast,
    scriptOrError,
    result: classifyResult({
      clarification,
      readinessReady: readiness?.ready ?? false,
      scriptGenerated,
      unsupported,
      failures,
    }),
    failures,
  }
}

function summarize(cases: Staging31CaseReport[]): Staging31FullReport['summary'] {
  const countFailure = (code: string) => cases.filter(item => item.failures.includes(code)).length
  return {
    total: cases.length,
    pass: cases.filter(item => item.result === 'pass').length,
    needsClarification: cases.filter(item => item.result === 'needs_clarification').length,
    unsupported: cases.filter(item => item.result === 'unsupported').length,
    fail: cases.filter(item => item.result === 'fail').length,
    emptyRulesWithClear: countFailure('empty_rules_with_clear'),
    supportedActionReportedUnsupported: countFailure('supported_action_reported_unsupported'),
    clarificationClearsRulesTree: countFailure('clarification_clears_rules_tree'),
    uiScriptMismatch: countFailure('ui_script_mismatch'),
    unsupportedWithGeneratedScript: countFailure('unsupported_with_generated_script'),
  }
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  loadEnv(args.env)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  let app: INestApplicationContext | null = null
  try {
    if (args.source === 'entry') {
      process.stderr.write('[staging31] creating Nest application context\n')
      app = await createApp()
      const codegen = app.get(CodegenConversationService)
      for (const item of STAGING31_CASES) {
        process.stderr.write(`[staging31] entry case ${item.index}\n`)
        const outcome = await runEntryCase({
          codegen,
          client,
          index: item.index,
          text: item.input,
        })
        process.stderr.write(`[staging31] entry case ${item.index} session=${outcome.sessionId} turns=${outcome.turns} answers=${Object.keys(outcome.answers).length}\n`)
        ;(item as { sessionId: string }).sessionId = outcome.sessionId
      }
    }

    const services = {
      ruleProjection: new SemanticRuleProjectionService(),
      readiness: new SemanticContractReadinessService(),
      stateProjection: new SemanticStateProjectionService(),
      supportClassifier: new SemanticSupportClassifierService(
        new SemanticAtomRegistryService(),
        new SemanticOrchestrationRegistryService(),
      ),
      publication: createPublicationStage(),
    }
    const cases: Staging31CaseReport[] = []
    for (const item of STAGING31_CASES) {
      const row = await fetchSession(client, item.sessionId)
      const report = await buildCaseReport({
        row,
        index: item.index,
        fallbackInput: item.input,
        services,
      })
      assertStaging31ReportShape(report)
      cases.push(report)
    }

    const fullReport: Staging31FullReport = {
      env: args.env,
      source: args.source,
      generatedAt: new Date().toISOString(),
      summary: summarize(cases),
      cases,
    }
    const out = resolve(args.out)
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, `${JSON.stringify(fullReport, null, 2)}\n`, 'utf8')
    process.stdout.write(`${JSON.stringify(fullReport.summary)}\n`)
  }
  finally {
    client.release()
    await pool.end()
    await app?.close()
  }
}

if (require.main === module) {
  run().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
