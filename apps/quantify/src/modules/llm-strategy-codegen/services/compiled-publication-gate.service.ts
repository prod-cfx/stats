import type { StrategyAstV1 } from '../types/canonical-strategy-ast'
import type { CanonicalStrategyIrV1 } from '../types/canonical-strategy-ir'
import type { CompiledScriptExecutionEnvelope } from '../types/compiled-script-projection'
import type {
  PublicationGateCheck,
  PublicationGateReport,
  PublishedRuntimeExecutionSemantic,
  PublishedStrategyAstSnapshot,
} from '../types/publication-gate'
import type { StrategyClarificationItem, StrategyClarificationState } from '../types/strategy-clarification'
import type { StrategyLogicGraphSnapshot } from '../types/strategy-logic-graph-snapshot'
import { lookupIrFieldsForClarificationReason } from '../types/clarification-slot-ir-mapping'
import { GRID_PROGRAM_KINDS } from '../types/semantic-state'
import { createHash } from 'node:crypto'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient } from '@/prisma/prisma.types'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable, Logger } from '@nestjs/common'
import { normalizeRuntimeRequirements } from '@/modules/strategy-runtime/semantic-runtime-state.util'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { PublishedStrategySnapshotsRepository } from '../repositories/published-strategy-snapshots.repository'
import { CompiledScriptParserService } from './compiled-script-parser.service'

type ExprNode = StrategyAstV1['exprPool'][number]
type RuntimeActionKind = CanonicalStrategyIrV1['ruleBlocks'][number]['actions'][number]['kind']

interface PublishCompiledSnapshotInput {
  sessionId: string
  strategyTemplateId?: string | null
  strategyInstanceId?: string | null
  canonicalSnapshot: Record<string, unknown>
  semanticView: Record<string, unknown>
  semanticPredicateGraph?: Record<string, unknown>
  graphSnapshot: StrategyLogicGraphSnapshot
  clarificationState?: StrategyClarificationState | null
  ir: CanonicalStrategyIrV1
  ast: StrategyAstV1
  executionEnvelope: CompiledScriptExecutionEnvelope
  script: string
  semanticConsistencyReport: Record<string, unknown>
  userIntentSummary: Record<string, unknown>
  strategySummary: Record<string, unknown>
  scriptSummary: Record<string, unknown>
  lockedParams: Record<string, unknown>
}

export interface RulesOnlyHashChainInput {
  rules: unknown
  canonicalSpec: Record<string, unknown>
  ir: CanonicalStrategyIrV1
  ast: StrategyAstV1
  script: string
}

export interface RulesOnlyHashChainCheck {
  key: string
  passed: boolean
  expected?: unknown
  actual?: unknown
}

export interface RulesOnlyHashChainResult {
  passed: boolean
  blocked: boolean
  reason?: 'rules_only_trace_missing' | 'rules_only_hash_mismatch'
  hashes: {
    rulesHash: string
    canonicalSpecHash: string
    irHash: string
    astHash: string
    scriptHash: string
  }
  checks: RulesOnlyHashChainCheck[]
}

interface FormalStrategyConfig {
  exchange: string
  symbol: string
  marketType: 'spot' | 'perp'
  baseTimeframe: string | null
  stateTimeframes?: string[]
  positionPct: number | null
  positionSizing: {
    mode: CanonicalStrategyIrV1['portfolio']['sizing']['mode']
    value: number
    asset?: string
  }
  strategyDeclaredLeverageRange: null
}

interface FormalBacktestConfigDefaults {
  initialCash: number
  leverage: number
  slippageBps: number
  feeBps: number
  priceSource: 'open' | 'close' | 'mid'
  allowPartial: boolean
}

interface FormalDeploymentExecutionDefaults {
  leverage: number
  priceSource: 'open' | 'close' | 'mid'
  orderType: 'market' | 'limit'
  timeInForce: 'gtc' | 'ioc' | 'fok'
  tdMode?: 'cross'
}

interface FormalDeploymentExecutionConstraints {
  platformRiskMaxLeverage: number
  strategyDeclaredLeverageRange: null
  defaultLeverage: number
  effectiveAllowedLeverageRange: { min: number; max: number }
  supportedPriceSources: Array<'open' | 'close' | 'mid'>
  supportedOrderTypes: Array<'market' | 'limit'>
  supportedTimeInForce: Array<'gtc' | 'ioc' | 'fok'>
  supportedTdModes?: ['cross']
  constraintExplanation: string
}

const ON_START_SOURCE_REF_PATTERN = /(^|[_-])(?:execution[_-])?on_start([_-]|$)/i
const DEFAULT_PERP_PLATFORM_MAX_LEVERAGE = 5

/**
 * Issue #1456 / 父 Issue #1455 闸 1：publication-gate 阻断未澄清 IR 编译。
 *   - 任何 clarificationState.status === 'NEEDS_CLARIFICATION'
 *     或 items 中存在 blocking 且 status==='pending' 的条目，
 *     必须 fail-closed 拒绝产出 IR / 脚本。
 *   - reason 固定为 'CLARIFICATION_PENDING'，便于上游 saga / metric scraper 路由。
 *   - 同时附 slot → IR 字段 mapping（详见 ../types/clarification-slot-ir-mapping）。
 */
export const PUBLICATION_GATE_BLOCK_REASONS = {
  CLARIFICATION_PENDING: 'CLARIFICATION_PENDING',
} as const

export type PublicationGateBlockReason =
  typeof PUBLICATION_GATE_BLOCK_REASONS[keyof typeof PUBLICATION_GATE_BLOCK_REASONS]

export interface PublicationGateClarificationBlock {
  blocked: true
  reason: PublicationGateBlockReason
  pendingItems: StrategyClarificationItem[]
  /**
   * 把每个 pending item 反查到的 IR 字段汇总（去重），方便前端直接展示
   * 「下列 IR 字段被阻断」而不必再 join slot→field mapping。
   */
  blockedIrFields: string[]
}

/**
 * publication-gate 内部异常类型：携带结构化 blocked payload，让 pipeline
 * 在 catch 分支可以原样持久化到 session.specDesc.publicationGate。
 */
export class PublicationGateClarificationBlockedError extends Error {
  readonly publicationGate: PublicationGateClarificationBlock

  constructor(payload: PublicationGateClarificationBlock) {
    super(`publication gate blocked: ${payload.reason}`)
    this.name = 'PublicationGateClarificationBlockedError'
    this.publicationGate = payload
  }
}

@Injectable()
export class CompiledPublicationGateService {
  private readonly logger = new Logger(CompiledPublicationGateService.name)

  constructor(
    private readonly publishedSnapshotsRepo: PublishedStrategySnapshotsRepository,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
    private readonly scriptParser: CompiledScriptParserService = new CompiledScriptParserService(),
  ) {}

  /**
   * Issue #1456：硬阻断接口，可在 IR builder 入口提前调用。
   *   - 当前条件 = clarificationState.status === 'NEEDS_CLARIFICATION'
   *     || 任一 item.blocking === true && item.status === 'pending'
   *   - 命中即抛 `PublicationGateClarificationBlockedError`；同时 emit
   *     `metric=publication_gate_block_total reason=CLARIFICATION_PENDING value=1`，
   *     与现有 `metric=evidence_invariant_drop_total` 同款 logger-stub 形态，
   *     等待 prom-client 接入时统一替换为 counter.inc。
   */
  assertClarificationResolvedForIrBuild(
    clarificationState?: StrategyClarificationState | null,
  ): void {
    const block = this.detectClarificationBlock(clarificationState)
    if (!block) return

    this.logger.warn(
      `metric=publication_gate_block_total reason=${block.reason} value=1 pendingItems=${block.pendingItems.length} blockedIrFields=${block.blockedIrFields.join(',') || 'n/a'}`,
    )
    throw new PublicationGateClarificationBlockedError(block)
  }

  private detectClarificationBlock(
    clarificationState?: StrategyClarificationState | null,
  ): PublicationGateClarificationBlock | null {
    if (!clarificationState) return null

    // 类型上 StrategyClarificationItem.blocking === true 是必填字面量，所以仅
    //   按 status === 'pending' 判定即可；如未来引入 non-blocking 条目，需要
    //   先调整 StrategyClarificationItem.blocking 类型再放宽这里。
    const pendingItems = (clarificationState.items ?? []).filter(
      item => item.status === 'pending',
    )
    if (clarificationState.status !== 'NEEDS_CLARIFICATION' && pendingItems.length === 0) {
      return null
    }
    if (pendingItems.length === 0) {
      // NEEDS_CLARIFICATION 但没有具体 pending blocking item：仍然阻断，
      //   宁可误拦不可漏放。
      return {
        blocked: true,
        reason: PUBLICATION_GATE_BLOCK_REASONS.CLARIFICATION_PENDING,
        pendingItems: [],
        blockedIrFields: [],
      }
    }

    const blockedIrFields = Array.from(
      new Set(
        pendingItems.flatMap(item => lookupIrFieldsForClarificationReason(item.reason)),
      ),
    )

    return {
      blocked: true,
      reason: PUBLICATION_GATE_BLOCK_REASONS.CLARIFICATION_PENDING,
      pendingItems,
      blockedIrFields,
    }
  }

  validateRulesOnlyHashChain(input: RulesOnlyHashChainInput): RulesOnlyHashChainResult {
    const hashes = {
      rulesHash: this.hashCanonicalJsonHex(input.rules),
      canonicalSpecHash: this.hashCanonicalJsonHex(input.canonicalSpec),
      irHash: this.hashCanonicalJsonHex(input.ir),
      astHash: this.hashAstProjection(input.ast),
      scriptHash: this.hashTextHex(input.script),
    }
    const canonicalTrace = this.collectCanonicalExecutableTrace(input.canonicalSpec)
    const irTrace = this.collectIrExecutableTrace(input.ir)
    const astTrace = this.collectAstExecutableTrace(input.ast)
    const scriptManifest = this.readScriptManifest(input.script)
    const hashChecks = this.buildRulesOnlyHashChecks(input, hashes, scriptManifest)
    const scriptHashLinked = hashChecks
      .filter(check => check.key.startsWith('hash.script.'))
      .length > 0
      && hashChecks
        .filter(check => check.key.startsWith('hash.script.'))
        .every(check => check.passed)
    const checks: RulesOnlyHashChainCheck[] = [
      ...hashChecks,
      {
        key: 'trace.canonical',
        passed: canonicalTrace.sourcePaths.length > 0 && canonicalTrace.missing.length === 0,
        expected: 'canonical executable nodes carry rules[] sourcePath',
        actual: canonicalTrace,
      },
      {
        key: 'trace.ir',
        passed: irTrace.sourcePaths.length > 0 && irTrace.missing.length === 0,
        expected: canonicalTrace.sourcePaths,
        actual: irTrace,
      },
      {
        key: 'trace.ast',
        passed: astTrace.sourcePaths.length > 0 && astTrace.missing.length === 0,
        expected: canonicalTrace.sourcePaths,
        actual: astTrace,
      },
      {
        key: 'trace.script',
        passed: scriptHashLinked,
        expected: 'script manifest links to computed IR/spec/AST hashes',
        actual: scriptManifest ?? null,
      },
    ]
    const blocked = checks.some(check => !check.passed)
    const hashMismatch = hashChecks.some(check => !check.passed)

    return {
      passed: !blocked,
      blocked,
      ...(blocked
        ? { reason: hashMismatch ? 'rules_only_hash_mismatch' as const : 'rules_only_trace_missing' as const }
        : {}),
      hashes,
      checks,
    }
  }

  async publish(input: PublishCompiledSnapshotInput): Promise<{
    snapshotId: string
    snapshotHash: string
    consistencyReport: Record<string, unknown>
  }> {
    // Issue #1456 闸 1：publication-gate 入口硬阻断未澄清 IR 编译。
    //   - 此处保留原 inline 检查，承担「最后一道」职责：上游 IR builder 入口
    //     已通过 assertClarificationResolvedForIrBuild 拒过一遍，这里防御漏调用。
    //   - 抛 PublicationGateClarificationBlockedError，pipeline catch 分支通过
    //     `(error as { publicationGate?: unknown }).publicationGate` 拿结构化 payload。
    this.assertClarificationResolvedForIrBuild(input.clarificationState)

    const parsed = this.scriptParser.parse(input.script)
    const manifest = parsed.compiledManifest
    const publicationGate = this.buildPublicationGateReport(input, parsed)
    const blockingChecks = publicationGate.checks.filter(check => check.blocking && check.status === 'failed')
    if (blockingChecks.length > 0) {
      const error = new Error(`publication gate blocked: ${blockingChecks.map(check => check.message).join('；')}`) as Error & {
        publicationGate?: PublicationGateReport
      }
      error.publicationGate = publicationGate
      throw error
    }

    const compilerConsistency = this.buildCompilerConsistency(input, parsed, publicationGate)
    const strategyConfig = this.buildStrategyConfig(input)
    const backtestConfigDefaults = this.buildBacktestConfigDefaults(input)
    const deploymentExecutionDefaults = this.buildDeploymentExecutionDefaults(input)
    const deploymentExecutionConstraints = this.buildDeploymentExecutionConstraints(input, deploymentExecutionDefaults)
    const astSnapshot = this.buildPublicationAstSnapshot(input.ast)
    const scriptSummary = this.buildScriptSummaryWithCompatibilityMetadata(input, parsed)
    const semanticStatus = input.semanticConsistencyReport.status
    const consistencyReport = {
      status:
        semanticStatus === 'PASSED' && compilerConsistency.status === 'PASSED'
          ? 'PASSED'
          : 'FAILED',
      semanticConsistency: input.semanticConsistencyReport,
      compilerConsistency,
    }

    // 显式包一层 withTransaction 保证 snapshot 写入在 fire-and-forget 发布路径中仍有事务边界。
    // 当前 publish() 调用方包括 CodegenSessionPublicationPipelineService.run，该路径脱离 HTTP
    // 生命周期，AfterCommitInterceptor / @Transactional 不会触发，因此必须在 service 内部显式
    // 开启事务。如外层已有事务，withTransaction 会复用现有 cls scope。
    const snapshot = await this.txHost.withTransaction(async () => {
      const created = await this.publishedSnapshotsRepo.create({
        sessionId: input.sessionId,
        strategyTemplateId: input.strategyTemplateId ?? null,
        strategyInstanceId: input.strategyInstanceId ?? null,
        scriptSnapshot: input.script,
        specSnapshot: input.canonicalSnapshot,
        semanticGraph: input.semanticPredicateGraph ?? input.semanticView,
        compiledIr: input.ir as unknown as Record<string, unknown>,
        irSnapshot: input.ir as unknown as Record<string, unknown>,
        astSnapshot,
        compiledManifest: manifest as unknown as Record<string, unknown>,
        consistencyReport,
        userIntentSummary: input.userIntentSummary,
        strategySummary: input.strategySummary,
        scriptSummary,
        lockedParams: input.lockedParams,
        snapshotVersion: 3,
        paramsSnapshot: {
          exchange: strategyConfig.exchange,
          symbol: strategyConfig.symbol,
          timeframe: strategyConfig.baseTimeframe,
          marketType: strategyConfig.marketType,
          positionPct: strategyConfig.positionPct,
          positionSizing: strategyConfig.positionSizing,
        },
        strategyConfig: strategyConfig as unknown as Record<string, unknown>,
        backtestConfigDefaults: backtestConfigDefaults as unknown as Record<string, unknown>,
        deploymentExecutionDefaults: deploymentExecutionDefaults as unknown as Record<string, unknown>,
        deploymentExecutionConstraints: deploymentExecutionConstraints as unknown as Record<string, unknown>,
        executionEnvelope: input.executionEnvelope as unknown as Record<string, unknown>,
        executionPolicy: input.ir.executionPolicy as unknown as Record<string, unknown>,
        dataRequirements: input.ast.dataRequirements as unknown as Record<string, unknown>,
      })

      return created
    })

    return {
      snapshotId: snapshot.id,
      snapshotHash: snapshot.snapshotHash,
      consistencyReport,
    }
  }

  private buildCompilerConsistency(
    input: PublishCompiledSnapshotInput,
    parsed: ReturnType<CompiledScriptParserService['parse']>,
    publicationGate: PublicationGateReport,
  ): Record<string, unknown> {
    const semanticGraphDigest = input.semanticPredicateGraph
      ? this.hashCanonicalJson(input.semanticPredicateGraph)
      : null
    const graphVsIrPassed = semanticGraphDigest !== null
      && input.ir.source.graphDigest === semanticGraphDigest
    const irVsScriptPassed = parsed.compiledManifest.irHash === input.ast.manifest.irHash
    const manifestSelfCheckPassed = parsed.compiledManifest.specHash === input.ast.manifest.specHash

    return {
      status: graphVsIrPassed && irVsScriptPassed && manifestSelfCheckPassed && publicationGate.status === 'PASSED'
        ? 'PASSED'
        : 'FAILED',
      graphVsIr: {
        passed: graphVsIrPassed,
        graphDigest: input.ir.source.graphDigest,
        semanticGraphDigest,
        specHash: input.ir.source.specHash,
      },
      irVsScript: {
        passed: irVsScriptPassed,
        irHash: parsed.compiledManifest.irHash,
        astDigest: parsed.compiledManifest.astDigest,
      },
      manifestSelfCheck: {
        passed: manifestSelfCheckPassed,
        irHash: parsed.compiledManifest.irHash,
        specHash: parsed.compiledManifest.specHash,
        astDigest: parsed.compiledManifest.astDigest,
        structuralDigest: parsed.compiledManifest.structuralDigest,
      },
      publicationGate,
    }
  }

  private hashCanonicalJson(value: unknown): `sha256:${string}` {
    return `sha256:${createHash('sha256').update(canonicalSerialize(value)).digest('hex')}`
  }

  private hashCanonicalJsonHex(value: unknown): string {
    return createHash('sha256').update(canonicalSerialize(value)).digest('hex')
  }

  private hashTextHex(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex')
  }

  private hashAstProjection(ast: StrategyAstV1): string {
    const astProjection = {
      astVersion: ast.astVersion,
      executionModel: ast.executionModel,
      dataRequirements: ast.dataRequirements,
      runtimeRequirements: ast.runtimeRequirements,
      exprPool: this.projectByOrder(ast.exprPool, ast.topology.exprOrder),
      guards: this.projectByOrder(ast.guards, ast.topology.guardOrder),
      riskPredicates: this.projectOptionalByOrder(ast.riskPredicates, ast.topology.riskPredicateOrder),
      decisionPrograms: this.projectByOrder(ast.decisionPrograms, ast.topology.decisionOrder),
      orderPrograms: this.projectByOrder(ast.orderPrograms, ast.topology.orderProgramOrder),
      ...(ast.orchestrationPortfolioRisks ? { orchestrationPortfolioRisks: ast.orchestrationPortfolioRisks } : {}),
      ...(ast.orchestrationPrograms ? { orchestrationPrograms: ast.orchestrationPrograms } : {}),
      topology: ast.topology,
    }
    return this.hashCanonicalJsonHex(astProjection)
  }

  private projectByOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
    const itemIndex = new Map(items.map(item => [item.id, item]))
    return order
      .map(id => itemIndex.get(id))
      .filter((item): item is T => item !== undefined)
  }

  private projectOptionalByOrder<T extends { id: string }>(
    items: T[] | undefined,
    order: string[] | undefined,
  ): T[] | undefined {
    if (!items || !order) return undefined
    return this.projectByOrder(items, order)
  }

  private buildRulesOnlyHashChecks(
    input: RulesOnlyHashChainInput,
    hashes: RulesOnlyHashChainResult['hashes'],
    scriptManifest: Record<string, string> | null,
  ): RulesOnlyHashChainCheck[] {
    const canonicalRulesHashes = this.collectHashFields(input.canonicalSpec, 'rulesHash')
    const source = this.readRecord(input.ir.source) ?? {}
    const astManifest = input.ast.manifest as unknown as Record<string, unknown>
    return [
      ...canonicalRulesHashes.map((actual, index) => this.buildHashCheck(
        `hash.canonical.rulesHash${canonicalRulesHashes.length > 1 ? `.${index}` : ''}`,
        hashes.rulesHash,
        actual,
      )),
      ...(typeof source.specHash === 'string'
        ? [this.buildHashCheck('hash.ir.specHash', hashes.canonicalSpecHash, source.specHash)]
        : []),
      ...(typeof source.canonicalSpecHash === 'string'
        ? [this.buildHashCheck('hash.ir.canonicalSpecHash', hashes.canonicalSpecHash, source.canonicalSpecHash)]
        : []),
      ...(typeof astManifest.irHash === 'string'
        ? [this.buildHashCheck('hash.ast.irHash', hashes.irHash, astManifest.irHash)]
        : []),
      ...(typeof astManifest.specHash === 'string'
        ? [this.buildHashCheck('hash.ast.specHash', hashes.canonicalSpecHash, astManifest.specHash)]
        : []),
      ...(typeof astManifest.astDigest === 'string'
        ? [this.buildHashCheck('hash.ast.astDigest', hashes.astHash, astManifest.astDigest)]
        : []),
      ...(scriptManifest?.irHash
        ? [this.buildHashCheck('hash.script.irHash', hashes.irHash, scriptManifest.irHash)]
        : []),
      ...(scriptManifest?.specHash
        ? [this.buildHashCheck('hash.script.specHash', hashes.canonicalSpecHash, scriptManifest.specHash)]
        : []),
      ...(scriptManifest?.astDigest
        ? [this.buildHashCheck('hash.script.astDigest', hashes.astHash, scriptManifest.astDigest)]
        : []),
    ]
  }

  private buildHashCheck(key: string, expectedHash: string, actualHash: string): RulesOnlyHashChainCheck {
    const actual = this.normalizeHash(actualHash)
    return {
      key,
      passed: actual === expectedHash,
      expected: expectedHash,
      actual,
    }
  }

  private collectHashFields(value: unknown, key: string): string[] {
    const hashes = new Set<string>()
    this.visitRecords(value, (record) => {
      const maybeHash = record[key]
      if (typeof maybeHash === 'string' && maybeHash.trim().length > 0) {
        hashes.add(maybeHash.trim())
      }
    })
    return Array.from(hashes).sort()
  }

  private normalizeHash(value: string): string {
    return value.startsWith('sha256:') ? value.slice('sha256:'.length) : value
  }

  private readScriptManifest(script: string): Record<string, string> | null {
    try {
      const parsed = this.scriptParser.parse(script)
      return {
        irHash: parsed.compiledManifest.irHash,
        specHash: parsed.compiledManifest.specHash,
        astDigest: parsed.compiledManifest.astDigest,
        structuralDigest: parsed.compiledManifest.structuralDigest,
      }
    } catch {
      const match = /^\/\* @generated by compiler\.v1 \*\/\n\/\* irHash: (?<irHash>sha256:[a-f0-9]+) \*\/\n\/\* specHash: (?<specHash>sha256:[a-f0-9]+) \*\/\n\/\* astDigest: (?<astDigest>sha256:[a-f0-9]+) \*\/\n\/\* structuralDigest: (?<structuralDigest>sha256:[a-f0-9]+) \*\//u.exec(script)
      return match?.groups ?? null
    }
  }

  private collectCanonicalExecutableTrace(canonicalSpec: Record<string, unknown>): {
    sourcePaths: string[]
    missing: string[]
  } {
    const sourcePaths = new Set<string>()
    const missing: string[] = []
    const specRules = Array.isArray(canonicalSpec.rules) ? canonicalSpec.rules : []
    specRules.forEach((item, index) => {
      this.collectExecutableSourcePath(item, `rules[${index}]`, sourcePaths, missing)
      const record = this.readRecord(item)
      const ruleSourcePath = this.readRulesSourcePath(record?.metadata ? this.readRecord(record.metadata)?.sourcePath : undefined)
      const actions = Array.isArray(record?.actions) ? record.actions : []
      actions.forEach((action, actionIndex) => {
        this.collectExecutableSourcePath(action, `rules[${index}].actions[${actionIndex}]`, sourcePaths, missing, ruleSourcePath)
      })
    })

    const orchestration = this.readRecord(canonicalSpec.orchestration)
    const programs = Array.isArray(orchestration?.programs) ? orchestration.programs : []
    programs.forEach((program, index) => {
      this.collectExecutableSourcePath(program, `orchestration.programs[${index}]`, sourcePaths, missing)
    })
    return { sourcePaths: Array.from(sourcePaths).sort(), missing }
  }

  private collectIrExecutableTrace(ir: CanonicalStrategyIrV1): {
    sourcePaths: string[]
    missing: string[]
  } {
    const sourcePaths = new Set<string>()
    const missing: string[] = []
    ;[
      ...ir.ruleBlocks.map((item, index) => [item, `ir.ruleBlocks[${index}]`] as const),
      ...ir.orderPrograms.map((item, index) => [item, `ir.orderPrograms[${index}]`] as const),
      ...(ir.orchestrationGates ?? []).map((item, index) => [item, `ir.orchestrationGates[${index}]`] as const),
      ...(ir.orchestrationPrograms ?? []).map((item, index) => [item, `ir.orchestrationPrograms[${index}]`] as const),
    ].forEach(([item, label]) => {
      this.collectExecutableSourcePath(item, label, sourcePaths, missing)
    })
    return { sourcePaths: Array.from(sourcePaths).sort(), missing }
  }

  private collectAstExecutableTrace(ast: StrategyAstV1): {
    sourcePaths: string[]
    missing: string[]
  } {
    const sourcePaths = new Set<string>()
    const missing: string[] = []
    ;[
      ...ast.decisionPrograms.map((item, index) => [item, `ast.decisionPrograms[${index}]`] as const),
      ...ast.orderPrograms.map((item, index) => [item, `ast.orderPrograms[${index}]`] as const),
      ...(ast.orchestrationPrograms ?? []).map((item, index) => [item, `ast.orchestrationPrograms[${index}]`] as const),
    ].forEach(([item, label]) => {
      this.collectExecutableSourcePath(item, label, sourcePaths, missing)
    })
    return { sourcePaths: Array.from(sourcePaths).sort(), missing }
  }

  private collectExecutableSourcePath(
    value: unknown,
    label: string,
    sourcePaths: Set<string>,
    missing: string[],
    fallbackSourcePath?: string | null,
  ): void {
    const record = this.readRecord(value)
    if (!record) {
      missing.push(label)
      return
    }
    const sourcePath = this.readRulesSourcePath(record.sourcePath)
      ?? this.readRulesSourcePath(this.readRecord(record.metadata)?.sourcePath)
      ?? fallbackSourcePath
    if (!sourcePath) {
      missing.push(label)
      return
    }
    sourcePaths.add(sourcePath)
  }

  private readRulesSourcePath(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return /^rules\[\d+\]/u.test(trimmed) ? trimmed : null
  }

  private visitRecords(value: unknown, visitor: (record: Record<string, unknown>) => void): void {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      for (const item of value) {
        this.visitRecords(item, visitor)
      }
      return
    }

    const record = value as Record<string, unknown>
    visitor(record)
    for (const item of Object.values(record)) {
      this.visitRecords(item, visitor)
    }
  }

  private buildPublicationAstSnapshot(ast: StrategyAstV1): PublishedStrategyAstSnapshot {
    const runtimeExecutionSemantics = this.buildRuntimeExecutionSemantics(ast)
    return {
      ...ast,
      ...(runtimeExecutionSemantics.length > 0 ? { runtimeExecutionSemantics } : {}),
    }
  }

  private buildScriptSummaryWithCompatibilityMetadata(
    input: PublishCompiledSnapshotInput,
    parsed: ReturnType<CompiledScriptParserService['parse']>,
  ): Record<string, unknown> {
    const runtimeRequirements = normalizeRuntimeRequirements(input.ast.runtimeRequirements)
      ?? normalizeRuntimeRequirements(input.ir.runtimeRequirements)
      ?? normalizeRuntimeRequirements(parsed.runtimeRequirements)

    if (!runtimeRequirements) {
      return input.scriptSummary
    }

    const existingCompatibilityMetadata = this.readRecord(input.scriptSummary.compatibilityMetadata) ?? {}
    const existingAtomicContractExecution = this.readRecord(existingCompatibilityMetadata.atomicContractExecution) ?? {}

    return {
      ...input.scriptSummary,
      compatibilityMetadata: {
        ...existingCompatibilityMetadata,
        atomicContractExecution: {
          ...existingAtomicContractExecution,
          schemaVersion: 1,
          runtimeRequirements,
        },
      },
    }
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  }

  private buildRuntimeExecutionSemantics(ast: StrategyAstV1): PublishedRuntimeExecutionSemantic[] {
    const firstMarkedProgram = ast.decisionPrograms.find((program) => {
      const markerSource = `${program.sourceRef} ${program.id}`
      return ON_START_SOURCE_REF_PATTERN.test(markerSource)
    })

    if (!firstMarkedProgram) {
      return []
    }

    return [{
      semanticKey: `on_start.${firstMarkedProgram.phase}.${this.resolveSemanticLabel(1)}`,
      trigger: 'on_start',
      phase: firstMarkedProgram.phase,
      consumePolicy: 'once',
      requiredRuntimeContext: {
        barIndex: 1,
        requiresReferenceBar: true,
        requiresSymbol: true,
        requiresTimeframe: true,
      },
      sourceRefs: [firstMarkedProgram.sourceRef],
    }]
  }

  private resolveSemanticLabel(index: number): string {
    const labels = ['primary', 'secondary', 'tertiary', 'quaternary'] as const
    return labels[index - 1] ?? `slot_${index}`
  }

  private buildStrategyConfig(input: PublishCompiledSnapshotInput): FormalStrategyConfig {
    const [baseTimeframe, ...stateTimeframes] = input.ir.market.timeframes
    return {
      exchange: input.ir.market.venue,
      symbol: input.ir.market.symbol,
      marketType: input.ir.market.instrumentType === 'perpetual' ? 'perp' : 'spot',
      baseTimeframe: baseTimeframe ?? null,
      stateTimeframes,
      positionPct: input.ir.portfolio.sizing.mode === 'pct_equity'
        ? input.ir.portfolio.sizing.value
        : null,
      positionSizing: input.ir.portfolio.sizing,
      strategyDeclaredLeverageRange: null,
    }
  }

  private buildBacktestConfigDefaults(input: PublishCompiledSnapshotInput): FormalBacktestConfigDefaults {
    return {
      initialCash: 10000,
      leverage: 1,
      slippageBps: 10,
      feeBps: 5,
      priceSource: this.resolvePriceSource(input.ir.market.priceFeed),
      allowPartial: input.ir.executionPolicy.allowPartialFill,
    }
  }

  private buildDeploymentExecutionDefaults(
    input: PublishCompiledSnapshotInput,
  ): FormalDeploymentExecutionDefaults {
    const isPerp = input.ir.market.instrumentType === 'perpetual'
    return {
      leverage: 1,
      priceSource: this.resolvePriceSource(input.ir.market.priceFeed),
      orderType: input.ir.executionPolicy.orderTypeDefault,
      timeInForce: input.ir.executionPolicy.timeInForce,
      ...(isPerp ? { tdMode: 'cross' as const } : {}),
    }
  }

  private buildDeploymentExecutionConstraints(
    input: PublishCompiledSnapshotInput,
    defaults: FormalDeploymentExecutionDefaults,
  ): FormalDeploymentExecutionConstraints {
    const isPerp = input.ir.market.instrumentType === 'perpetual'
    const platformRiskMaxLeverage = isPerp
      ? DEFAULT_PERP_PLATFORM_MAX_LEVERAGE
      : 1
    return {
      platformRiskMaxLeverage,
      strategyDeclaredLeverageRange: null,
      defaultLeverage: defaults.leverage,
      effectiveAllowedLeverageRange: { min: 1, max: platformRiskMaxLeverage },
      supportedPriceSources: [defaults.priceSource],
      supportedOrderTypes: [defaults.orderType],
      supportedTimeInForce: [defaults.timeInForce],
      ...(isPerp ? { supportedTdModes: ['cross'] as const } : {}),
      constraintExplanation: 'strategy/default constraints pending account-capability intersection',
    }
  }

  private resolvePriceSource(priceFeed: CanonicalStrategyIrV1['market']['priceFeed']): 'open' | 'close' | 'mid' {
    if (priceFeed === 'hlc3' || priceFeed === 'ohlc4') return 'mid'
    return 'close'
  }

  private buildPublicationGateReport(
    input: PublishCompiledSnapshotInput,
    parsed: ReturnType<CompiledScriptParserService['parse']>,
  ): PublicationGateReport {
    const checks: PublicationGateCheck[] = [
      ...this.buildMarketMetadataChecks(input, parsed),
      ...this.buildPositionModeChecks(input, parsed),
      ...this.buildOutsideBandRiskChecks(input, parsed),
    ]

    return {
      status: checks.some(check => check.blocking && check.status === 'failed') ? 'FAILED' : 'PASSED',
      checks,
    }
  }

  private buildMarketMetadataChecks(
    input: PublishCompiledSnapshotInput,
    parsed: ReturnType<CompiledScriptParserService['parse']>,
  ): PublicationGateCheck[] {
    const market = this.readCanonicalMarket(input.canonicalSnapshot)
    if (!market) return []

    const actual = {
      ir: {
        exchange: input.ir.market.venue,
        marketType: input.ir.market.instrumentType === 'perpetual' ? 'perp' : 'spot',
        symbol: input.ir.market.symbol,
        timeframe: input.ir.market.timeframes[0] ?? null,
      },
      script: {
        exchange: parsed.executionModel.venue,
        marketType: parsed.executionModel.instrumentType === 'perpetual' ? 'perp' : 'spot',
        symbol: parsed.executionModel.symbol,
        timeframe: parsed.executionModel.primaryTimeframe,
      },
    }

    const entries: Array<[keyof typeof market, string | null]> = [
      ['exchange', market.exchange],
      ['marketType', market.marketType],
      ['symbol', market.symbol],
      ['timeframe', market.timeframe],
    ]

    return entries
      .filter(([, expected]) => typeof expected === 'string' && expected.trim().length > 0)
      .map(([field, expected]) => {
        const irValue = actual.ir[field]
        const scriptValue = actual.script[field]
        const passed = irValue === expected && scriptValue === expected
        return {
          key: `market.${field}`,
          blocking: true,
          status: passed ? 'passed' : 'failed',
          expected,
          actual: {
            ir: irValue,
            script: scriptValue,
          },
          message: passed
            ? `confirmed ${field} 与 IR/脚本一致。`
            : `confirmed ${field}=${expected}，但 IR=${irValue}、script=${scriptValue}`,
        }
      })
  }

  private buildOutsideBandRiskChecks(
    input: PublishCompiledSnapshotInput,
    parsed: ReturnType<CompiledScriptParserService['parse']>,
  ): PublicationGateCheck[] {
    const expectedRules = this.readOutsideBandRules(input.canonicalSnapshot)
    if (expectedRules.length === 0) return []

    const irOutsideBars = new Set(
      input.ir.signalCatalog.series
        .filter(series => series.kind === 'BOLLINGER_BARS_OUTSIDE')
        .map(series => typeof series.params?.bars === 'number' ? series.params.bars : 1),
    )
    const scriptOutsideSeries = parsed.exprPool
      .filter(this.isSeriesExprNode)
      .filter(expr => expr.payload.kind === 'BOLLINGER_BARS_OUTSIDE')
    const scriptOutsideBars = new Set(
      scriptOutsideSeries
        .map(series => typeof series.payload.params?.bars === 'number' ? series.payload.params.bars : 1),
    )
    const outsideSeriesIds = new Set(scriptOutsideSeries.map(series => series.id))
    const outsidePredicateIds = new Set(
      parsed.exprPool
        .filter(this.isPredicateExprNode)
        .filter(expr =>
          expr.sourceRef.toLowerCase().includes('outside')
          || expr.payload.args.some(arg => outsideSeriesIds.has(arg)))
        .map(expr => expr.id),
    )
    const scriptOutsideActions = new Set(
      parsed.decisionPrograms
        .filter(program => outsidePredicateIds.has(program.when) || program.sourceRef.toLowerCase().includes('outside'))
        .flatMap(program => program.actions.map(action => action.kind)),
    )

    const missingBars = expectedRules
      .map(rule => rule.bars)
      .filter(bars => !irOutsideBars.has(bars) || !scriptOutsideBars.has(bars))
    const missingActions = Array.from(new Set(
      expectedRules
        .flatMap(rule => rule.actions)
        .flatMap(action => this.mapOutsideRuleActionsToRuntimeActions(action))
        .filter(action => !scriptOutsideActions.has(action)),
    ))

    const passed = missingBars.length === 0 && missingActions.length === 0

    return [{
      key: 'risk.bollinger_bars_outside',
      blocking: true,
      status: passed ? 'passed' : 'failed',
      expected: expectedRules,
      actual: {
        irBars: Array.from(irOutsideBars),
        scriptBars: Array.from(scriptOutsideBars),
        scriptActions: Array.from(scriptOutsideActions),
      },
      message: passed
        ? '轨外连续 K 线风险规则已完整落到 IR 和脚本。'
        : [
            missingBars.length > 0 ? `缺少轨外 bars=${missingBars.join(',')}` : '',
            missingActions.length > 0 ? `缺少轨外动作=${missingActions.join(',')}` : '',
          ].filter(Boolean).join('；'),
    }]
  }

  private buildPositionModeChecks(
    input: PublishCompiledSnapshotInput,
    parsed: ReturnType<CompiledScriptParserService['parse']>,
  ): PublicationGateCheck[] {
    const expected = this.readCanonicalPositionMode(input.canonicalSnapshot)
    if (!expected) return []

    const actual = {
      ir: input.ir.portfolio.positionMode,
      script: parsed.executionModel.positionMode,
    }
    const passed = actual.ir === expected && actual.script === expected

    return [{
      key: 'portfolio.positionMode',
      blocking: true,
      status: passed ? 'passed' : 'failed',
      expected,
      actual,
      message: passed
        ? 'confirmed positionMode 与 IR/脚本一致。'
        : `confirmed positionMode=${expected}，但 IR=${actual.ir}、script=${actual.script}`,
    }]
  }

  private readCanonicalMarket(snapshot: Record<string, unknown>): {
    exchange: string | null
    marketType: string | null
      symbol: string | null
      timeframe: string | null
  } | null {
    const market = snapshot.market
    if (!market || typeof market !== 'object' || Array.isArray(market)) return null

    const record = market as Record<string, unknown>
    return {
      exchange: typeof record.exchange === 'string' ? record.exchange : null,
      marketType: typeof record.marketType === 'string' ? record.marketType : null,
      symbol: typeof record.symbol === 'string' ? record.symbol : null,
      timeframe: typeof record.defaultTimeframe === 'string'
        ? record.defaultTimeframe
        : (typeof record.timeframe === 'string' ? record.timeframe : null),
    }
  }

  private readOutsideBandRules(snapshot: Record<string, unknown>): Array<{
    bars: number
    actions: string[]
  }> {
    const rules = snapshot.rules
    if (!Array.isArray(rules)) return []

    return rules.flatMap((rule) => {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return []
      const record = rule as Record<string, unknown>
      const barsValues = this.collectOutsideBandBars(record.condition)
      if (barsValues.length === 0) return []

      const actions = Array.isArray(record.actions)
        ? record.actions
          .map((action) => {
            if (!action || typeof action !== 'object' || Array.isArray(action)) return null
            const type = (action as Record<string, unknown>).type
            return typeof type === 'string' ? type : null
          })
          .filter((action): action is string => action !== null)
        : []

      return barsValues.map(bars => ({ bars, actions }))
    })
  }

  private readCanonicalPositionMode(
    snapshot: Record<string, unknown>,
  ): 'long_only' | 'short_only' | 'long_short' | null {
    const orderProgramMode = this.readOrderProgramPositionMode(snapshot)
    // Issue #1437：网格策略走 spec.orchestration.programs[dynamic_grid / fixed_grid_gated /
    //   adaptive_volatility_grid] 而非 orderPrograms；grid program 天然 long_short
    //   （runtime 双向挂单），但不会在 rules.actions 中显式 OPEN_LONG/SHORT。原实现只看
    //   orderPrograms + rules.actions OPEN_LONG/SHORT，对 grid case 始终落 long_only → 与
    //   IR/script 三方不一致，触发 PUBLICATION_GATE_BLOCKED（用户实测策略 3）。
    const hasGridOrchestration = this.detectGridOrchestrationPositionMode(snapshot)
    const rules = snapshot.rules
    if (!Array.isArray(rules) || rules.length === 0) {
      if (hasGridOrchestration) return 'long_short'
      return orderProgramMode
    }

    const hasLongExposure = rules.some((rule) => {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return false
      const actions = (rule as Record<string, unknown>).actions
      if (!Array.isArray(actions)) return false

      return actions.some((action) => {
        if (!action || typeof action !== 'object' || Array.isArray(action)) return false
        const type = (action as Record<string, unknown>).type
        return type === 'OPEN_LONG' || type === 'REDUCE_LONG'
      })
    })
    const hasShortExposure = rules.some((rule) => {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return false
      const actions = (rule as Record<string, unknown>).actions
      if (!Array.isArray(actions)) return false

      return actions.some((action) => {
        if (!action || typeof action !== 'object' || Array.isArray(action)) return false
        const type = (action as Record<string, unknown>).type
        return type === 'OPEN_SHORT' || type === 'REDUCE_SHORT'
      })
    })

    // Issue #1437：grid orchestration 与其它信号并列作为 long_short 真相源
    if (hasGridOrchestration) return 'long_short'
    if (orderProgramMode === 'long_short') return 'long_short'
    if (orderProgramMode === 'long_only' && hasShortExposure) return 'long_short'
    if (orderProgramMode === 'short_only' && hasLongExposure) return 'long_short'
    if (hasLongExposure && hasShortExposure) return 'long_short'
    if (orderProgramMode) return orderProgramMode
    if (hasShortExposure) return 'short_only'
    return 'long_only'
  }

  /**
   * Issue #1437：检测 spec.orchestration.programs 是否含双向网格类 programKind。
   *   网格 program 在 runtime 双向挂单（OPEN_LONG + OPEN_SHORT 同时维护），天然
   *   long_short，但不会在 rules.actions 中显式 OPEN_LONG/SHORT。原 positionMode
   *   推断逻辑无法捕获，导致 publication gate 三方不一致拦截网格策略。
   *
   *   grid programKind（与 atom-contract-registry 中 program.* bucket=orchestration 对齐）：
   *     - dynamic_grid（用户实测策略 3 走这条）
   *     - fixed_grid_gated
   *     - adaptive_volatility_grid
   *   非网格 program（event_listener）不算 long_short 真相源。
   */
  private detectGridOrchestrationPositionMode(snapshot: Record<string, unknown>): boolean {
    const orchestration = snapshot.orchestration
    if (!orchestration || typeof orchestration !== 'object' || Array.isArray(orchestration)) return false
    const programs = (orchestration as Record<string, unknown>).programs
    if (!Array.isArray(programs)) return false
    return programs.some((program) => {
      if (!program || typeof program !== 'object' || Array.isArray(program)) return false
      const programKind = (program as Record<string, unknown>).programKind
      return typeof programKind === 'string' && (GRID_PROGRAM_KINDS as ReadonlySet<string>).has(programKind)
    })
  }

  private readOrderProgramPositionMode(
    snapshot: Record<string, unknown>,
  ): 'long_only' | 'short_only' | 'long_short' | null {
    const orderPrograms = snapshot.orderPrograms
    if (!Array.isArray(orderPrograms) || orderPrograms.length === 0) return null

    let hasLongExposure = false
    let hasShortExposure = false

    orderPrograms.forEach((program) => {
      if (!program || typeof program !== 'object' || Array.isArray(program)) return
      const record = program as Record<string, unknown>
      const mode = typeof record.mode === 'string'
        ? record.mode
        : (typeof record.sidePolicy === 'string' ? record.sidePolicy : null)

      if (mode === 'perp_neutral') {
        hasLongExposure = true
        hasShortExposure = true
        return
      }
      if (mode === 'perp_short') {
        hasShortExposure = true
        return
      }
      if (mode === 'spot' || mode === 'spot_grid' || mode === 'perp_long') {
        hasLongExposure = true
      }
    })

    if (hasLongExposure && hasShortExposure) return 'long_short'
    if (hasShortExposure) return 'short_only'
    if (hasLongExposure) return 'long_only'
    return null
  }

  private collectOutsideBandBars(condition: unknown): number[] {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return []
    const record = condition as Record<string, unknown>

    // eslint-disable-next-line atom-keys/no-atom-key-literal -- legacy atom key not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
    if (record.kind === 'atom' && record.key === 'bollinger.bars_outside') {
      const params = record.params
      const paramBars = params && typeof params === 'object' && !Array.isArray(params)
        ? (params as Record<string, unknown>).bars
        : null
      const value = typeof record.value === 'number' ? record.value : null
      const bars = typeof paramBars === 'number' ? paramBars : value
      return typeof bars === 'number' ? [bars] : []
    }

    if (!Array.isArray(record.children)) return []
    return record.children.flatMap(child => this.collectOutsideBandBars(child))
  }

  private mapOutsideRuleActionsToRuntimeActions(action: string): RuntimeActionKind[] {
    const runtimeActions: RuntimeActionKind[] = []
    switch (action) {
      case 'FORCE_EXIT':
        runtimeActions.push('CLOSE_LONG', 'CLOSE_SHORT')
        break
      case 'REDUCE_LONG':
      case 'REDUCE_SHORT':
      case 'CLOSE_LONG':
      case 'CLOSE_SHORT':
        runtimeActions.push(action)
        break
      default:
        break
    }
    return runtimeActions
  }

  private isSeriesExprNode(expr: ExprNode): expr is ExprNode & { nodeType: 'series', payload: CanonicalStrategyIrV1['signalCatalog']['series'][number] } {
    return expr.nodeType === 'series'
  }

  private isPredicateExprNode(expr: ExprNode): expr is ExprNode & { nodeType: 'predicate', payload: CanonicalStrategyIrV1['signalCatalog']['predicates'][number] } {
    return expr.nodeType === 'predicate'
  }
}
