/**
 * 31 条策略 golden harness runner（Issue #1496 块 2）
 *
 * 接口契约（与块 3 mock planner data 约定）：
 *  - PlannerMockResponse.semanticPatch 形状等价于生产 planner 输出的 `semanticPatch`
 *    字段：可被 SemanticSeedStateBuilderService.build(patch, message) 直接消费。
 *  - mockQueue 顺序与会话轮次一一对应：第 0 项 = startSession 首轮 planner 返回；
 *    后续每一轮 readiness clarification 都从 queue 顶端取下一项作为 planner 复用响应。
 *
 * Mock 注入策略：**A 方案（不改生产代码）**
 *  - 不构造完整 CodegenConversationService（其依赖大量 repo / pipeline）；
 *  - 直接驱动 SemanticSeedStateBuilderService + StrategyClarificationQuestionService
 *    + CodegenPublicationGenerationStage，等价于生产路径
 *      planConversationByLlm → applyConversationPlanToSemanticState
 *      → buildClarificationFromSemanticState → publicationStage.generate
 *    的最小可验证子集；
 *  - 块 1 fixture / 块 3 mock 数据均以"planner semanticPatch"为契约面。
 *
 * 阶段 A 不追求 byte-equal 重现，仅追求：
 *   1) route 判定正确（pass / unsupported(reason)）
 *   2) 5 层产物 hash 稳定可对比（rulesTree / displayGraph / spec / IR / AST）
 *   3) scriptAtoms 列出脚本里命中的 atom-key 白名单集合
 */

import type { AtomExpr } from '../../../types/atom-expr'
import type { SemanticState } from '../../../types/semantic-state'
import type { ThirtyOneStrategyFixture } from '../fixtures/thirty-one-strategies'
import type { PlannerMockQueue, PlannerMockResponse } from './types'
import { createHash } from 'node:crypto'
import { ATOM_CONTRACT_REGISTRY } from '../../../atom-contracts/atom-contract-registry'
import { collectAtomLeaves } from '../../../types/atom-expr'
import { CanonicalSpecBuilderService } from '../../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../../canonical-strategy-ast-compiler.service'
import { CodegenGraphSnapshotService } from '../../codegen-graph-snapshot.service'
import { CodegenPublicationGenerationStage } from '../../codegen-publication-generation.stage'
import { CompiledScriptEmitterService } from '../../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../../compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../../compiled-script-parser.service'
import { ScriptProfileExtractorService } from '../../script-profile-extractor.service'
import { SemanticSeedStateBuilderService } from '../../semantic-seed-state-builder.service'
import { SemanticStateMergeService } from '../../semantic-state-merge.service'
import { SpecDescBuilderService } from '../../spec-desc-builder.service'
import { StrategyClarificationQuestionService } from '../../strategy-clarification-question.service'
import { StrategyConsistencyService } from '../../strategy-consistency.service'
import { StrategySummaryBuilderService } from '../../strategy-summary-builder.service'
import { StrategySummaryObservationService } from '../../strategy-summary-observation.service'

// #1496-M4: PlannerMockResponse / PlannerMockQueue 抽到 ./types，与 mock data 共用
export type { PlannerMockQueue, PlannerMockResponse } from './types'

export interface FiveLayerArtifacts {
  rulesTreeHash: string
  displayGraphHash: string
  specHash: string
  irHash: string
  astHash: string
  scriptAtoms: string[]
  route: 'pass' | { kind: 'unsupported'; reason: string }
  clarificationRounds: number
}

export const MAX_CLARIFICATION_ROUNDS = 6

/**
 * #1496 round-2 C-NEW-1：harness 层显式 atom-key 白名单。
 *
 * 来源：ATOM_CONTRACT_REGISTRY 全集 ∪ `semantic-seed-state-builder.service.ts` 内
 *   `canSynthesizeTriggerContract` / `canSynthesizeRiskContract` /
 *   `SYNTHESIZABLE_ACTION_KEYS` / `SYNTHESIZABLE_POSITION_LIFECYCLE_ACTION_KEYS`
 *   等"已识别但未在 registry 中声明"的 synth allowlist。
 *
 * 不在白名单中的 atom-key 视为"registry 未声明 + 未实装 synth 通道"，被
 * `dispatchAtomsByContractBucket` 在生产路径上 warn-drop（fail-closed）静默丢弃；
 * harness 改为预检显式把它路由到 unsupported(reason='unknown_atom:<key>')，
 * 暴露阶段 A 7 条"伪 pass"策略的实际缺口（#1497 / #1498 / #1499 跟进）。
 */
const HARNESS_SYNTHESIZABLE_ATOM_KEYS: ReadonlySet<string> = new Set<string>([
  // 触发器：seed builder canSynthesizeTriggerContract 内列表（registry 未声明）
  'condition.expression',
  'volume.spike',
  'volume.relative_average',
  'condition.sequence',
  'confirmation.rebound',
  'market.trend',
  'market.range',
  // 动作：SYNTHESIZABLE_ACTION_KEYS（verb-derived 硬编码标签）
  'open_long',
  'close_long',
  'open_short',
  'close_short',
  // 动作（legacy）：SYNTHESIZABLE_POSITION_LIFECYCLE_ACTION_KEYS union
  'action.reduce_position',
  // 风险：seed builder canSynthesizeRiskContract 内列表（registry 未声明）
  'risk.atr_stop',
  'risk.stop_loss_pct',
  'risk.take_profit_pct',
  'risk.trailing_stop_pct',
  'risk.max_drawdown_pct',
  'risk.max_single_loss_pct',
  'risk.condition_expression',
  'risk.falling_knife_guard',
])

/** harness 视野下"已实装"key 集合 = registry ∪ synth allowlist */
function isKnownAtomKey(key: string): boolean {
  if (HARNESS_SYNTHESIZABLE_ATOM_KEYS.has(key)) return true
  return Object.prototype.hasOwnProperty.call(ATOM_CONTRACT_REGISTRY as Record<string, unknown>, key)
}

/**
 * #1496 round-2 C-NEW-1：扫 mock semanticPatch.rules[*].condition / effects 所有叶子 atom，
 * 返回未在白名单中的 key 列表（保留出现顺序、去重）。
 *
 * 设计要点：
 *  - 仅扫 mock 第一轮 patch（与 harness `run()` 首轮 seed 行为一致）。
 *  - rule.condition 与 rule.effects[*] 均尝试 narrow 为 AtomExpr 再用 `collectAtomLeaves`
 *    递归；narrow 失败的节点忽略（不是 unknown atom，是 schema 噪音）。
 */
function collectUnknownAtomKeys(patch: unknown): string[] {
  if (!patch || typeof patch !== 'object') return []
  const rules = (patch as { rules?: unknown }).rules
  if (!Array.isArray(rules)) return []
  const out: string[] = []
  const seen = new Set<string>()
  const visit = (expr: unknown): void => {
    if (!expr || typeof expr !== 'object') return
    const leaves = (() => {
      try {
        return collectAtomLeaves(expr as AtomExpr)
      } catch {
        return []
      }
    })()
    for (const leaf of leaves) {
      const key = leaf.key
      if (typeof key !== 'string' || key.length === 0) continue
      if (isKnownAtomKey(key)) continue
      if (seen.has(key)) continue
      seen.add(key)
      out.push(key)
    }
  }
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') continue
    const r = rule as { condition?: unknown, effects?: unknown }
    visit(r.condition)
    if (Array.isArray(r.effects)) {
      for (const eff of r.effects) visit(eff)
    }
  }
  return out
}

function stableHash(value: unknown): string {
  // 简化序列化：仅用于产物 snapshot 对比，不追求严格的递归排序
  const serialized = JSON.stringify(value ?? null)
  return createHash('sha256').update(serialized).digest('hex').slice(0, 16)
}

/**
 * #1496-M3.1: 不再 grep compiled script 字面量（atom key 编译后会被 sanitize 成下划线形式，
 *  原 key 几乎不会出现在脚本正文，导致 scriptAtoms 恒为空）。改为递归扫 IR / spec / AST /
 *  semanticState 中的 `key` / `atomKey` 字段，命中 ATOM_CONTRACT_REGISTRY 视为脚本使用了该 atom。
 */
function extractScriptAtoms(sources: readonly unknown[]): string[] {
  const registry = ATOM_CONTRACT_REGISTRY as Record<string, unknown>
  const hits = new Set<string>()
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) visit(item)
      return
    }
    const obj = node as Record<string, unknown>
    for (const field of ['key', 'atomKey'] as const) {
      const candidate = obj[field]
      if (typeof candidate === 'string' && Object.prototype.hasOwnProperty.call(registry, candidate)) {
        hits.add(candidate)
      }
    }
    for (const value of Object.values(obj)) visit(value)
  }
  for (const source of sources) visit(source)
  return Array.from(hits).sort()
}

function createPublicationStage(): CodegenPublicationGenerationStage {
  const profileExtractor = new ScriptProfileExtractorService()
  return new CodegenPublicationGenerationStage(
    new CanonicalSpecBuilderService(),
    new SpecDescBuilderService(),
    new StrategySummaryBuilderService(profileExtractor),
    new StrategyConsistencyService(profileExtractor),
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

/**
 * 收集 rules-tree 顶层可序列化结构（仅用于 hash 稳定性）。
 *  - 优先使用 semanticPatch.rules（块 3 约定 raw planner shape）；
 *  - 退化到 SemanticState 中的 trigger/action/risk flat list 摘要。
 */
function snapshotRulesTree(
  initialPatch: unknown,
  state: SemanticState,
): unknown {
  const patch = initialPatch as { rules?: unknown[] } | undefined
  if (patch?.rules && Array.isArray(patch.rules) && patch.rules.length > 0) {
    return patch.rules
  }
  return {
    triggers: state.trigger.map(item => ({ key: item.key, status: item.status })),
    actions: state.action.map(item => ({ key: item.key, status: item.status })),
    risks: state.risk.map(item => ({ key: item.key, status: item.status })),
    orchestration: state.orchestration.map(item => ({ key: item.key, status: item.status })),
  }
}

export class ThirtyOneStrategyHarness {
  private readonly seedBuilder = new SemanticSeedStateBuilderService()
  private readonly clarificationQuestion = new StrategyClarificationQuestionService()
  private readonly stateMerge = new SemanticStateMergeService()

  /**
   * #1496-C1: harness 不再回退 dispatcher（#1492 「dispatcher 不参与生产解释」契约）。
   *  mock planner data 是 harness 的唯一 patch 源。
   *  mock 缺 semanticPatch 视为 fixture bug，显式抛错让 spec 失败。
   */
  private resolveInitialPatch(mockPatch: unknown, fixtureId: number): unknown {
    if (!mockPatch) {
      throw new Error(
        `#1496 harness: mock planner response missing semanticPatch (fixture #${fixtureId})`,
      )
    }
    return mockPatch
  }

  async run(
    fixture: ThirtyOneStrategyFixture,
    mockQueue: PlannerMockQueue,
  ): Promise<FiveLayerArtifacts> {
    if (mockQueue.length === 0) {
      throw new Error(`harness: empty mockQueue for fixture #${fixture.id} (${fixture.name})`)
    }

    const queue = [...mockQueue]
    const firstResponse = queue.shift()!

    // 1) 显式 unsupported：planner mock 指明 unsupportedReasons → 直接路由
    if (firstResponse.unsupportedReasons && firstResponse.unsupportedReasons.length > 0) {
      return this.buildUnsupportedResult(firstResponse, /* rounds */ 0, /* state */ null, firstResponse.semanticPatch)
    }

    // 1.5) #1496 round-2 C-NEW-1：unknown atom 预检 — 暴露 registry 静默 drop 掩盖的 unsupported
    //   生产 seed builder 对未识别 atom 仅 logger.warn 后丢弃（fail-closed only in log），
    //   导致原本应 unsupported 的策略 pipeline 仍可落 publication，造成"伪 pass"。
    //   harness 在首轮 seed 之前扫 mock.semanticPatch.rules 全树叶子 atom，命中
    //   `HARNESS_SYNTHESIZABLE_ATOM_KEYS ∪ ATOM_CONTRACT_REGISTRY` 之外的 key 即视为
    //   unsupported(reason='unknown_atom:<keys_joined>')，与阶段 A 「unsupported 必须
    //   fail-closed」承诺对齐。
    const unknownAtomKeys = collectUnknownAtomKeys(firstResponse.semanticPatch)
    if (unknownAtomKeys.length > 0) {
      return this.buildUnsupportedResult(
        { unsupportedReasons: [`unknown_atom:${unknownAtomKeys.join(',')}`] },
        0,
        null,
        firstResponse.semanticPatch,
      )
    }

    // 2) 首轮 seed state（mock 必须提供 semanticPatch；缺则显式抛错）
    const initialPatch = this.resolveInitialPatch(firstResponse.semanticPatch, fixture.id)
    let state = this.seedBuilder.build(initialPatch, undefined)
    if (state === null) {
      // planner 返回空 patch（无法 seed）；按 unsupported 处理
      return this.buildUnsupportedResult(
        { unsupportedReasons: ['planner_returned_empty_semantic_patch'] },
        0,
        null,
        firstResponse.semanticPatch,
      )
    }

    // 3) clarification loop（最多 6 轮）
    let rounds = 0
    const answers = [...fixture.clarificationAnswers]
    while (rounds < MAX_CLARIFICATION_ROUNDS) {
      const items = this.buildSafetyClarificationItems(state)
      if (items.length === 0) break
      if (queue.length === 0 || answers.length === 0) {
        // queue 耗尽但仍有 pending clarification → unsupported(clarification_blocked)
        return this.buildUnsupportedResult(
          { unsupportedReasons: ['clarification_unresolved'] },
          rounds,
          state,
          firstResponse.semanticPatch,
        )
      }
      const next = queue.shift()!
      answers.shift()
      if (next.unsupportedReasons && next.unsupportedReasons.length > 0) {
        return this.buildUnsupportedResult(next, rounds + 1, state, firstResponse.semanticPatch)
      }
      const derived = this.seedBuilder.build(next.semanticPatch, undefined)
      if (derived) {
        state = this.stateMerge.merge({ persisted: state, derived })
      }
      rounds += 1
    }

    // 4) state 仍未 ready（safety items 死循环）→ unsupported
    const lingeringItems = this.buildSafetyClarificationItems(state)
    if (lingeringItems.length > 0) {
      return this.buildUnsupportedResult(
        { unsupportedReasons: ['clarification_max_rounds_exceeded'] },
        rounds,
        state,
        firstResponse.semanticPatch,
      )
    }

    // 5) publication 生成；catch 任何错（PublicationGateClarificationBlocked / semantic_atom_drift 等）→ unsupported
    try {
      const stage = createPublicationStage()
      const artifacts = await stage.generate({ semanticState: state })
      const scriptAtoms = extractScriptAtoms([
        artifacts.canonicalSpec,
        artifacts.compiled.ir,
        artifacts.ast,
        artifacts.semanticPredicateGraph,
        state,
      ])
      return {
        rulesTreeHash: stableHash(snapshotRulesTree(firstResponse.semanticPatch, state)),
        displayGraphHash: stableHash(artifacts.semanticPredicateGraph),
        specHash: stableHash(artifacts.canonicalSpec),
        irHash: stableHash(artifacts.compiled.ir),
        astHash: stableHash(artifacts.ast),
        scriptAtoms,
        route: 'pass',
        clarificationRounds: rounds,
      }
    } catch (error) {
      // #1496-C2: unsupported reason 改用 ErrorCode 分类码，禁止串入 stringified Error message。
      //   - 若 error 自带 `code: 'codegen.xxx'`（DomainException 风格），直接用 code；
      //   - 否则退化为 error.constructor.name（如 'Error' / 'PublicationGateClarificationBlockedError'）。
      //   不再使用 error.message（防止 100+ 字符 message 污染 fixture expectedRoute.reason）。
      const candidate = (error as { code?: unknown })?.code
      let reason: string
      if (typeof candidate === 'string' && candidate.length > 0) {
        reason = candidate
      } else if (error instanceof Error) {
        // 兜底解析 `codegen.xxx` 前缀（部分管线把 ErrorCode 拼到 message 头部，如
        //   `codegen.publication_context_missing: ...`）。
        const head = error.message.split(':')[0]?.trim()
        if (head && /^[a-z][a-z0-9._]+$/i.test(head)) {
          reason = head
        } else {
          reason = error.constructor.name || 'unknown'
        }
      } else {
        reason = 'publication_generate_failed'
      }
      return this.buildUnsupportedResult(
        { unsupportedReasons: [reason] },
        rounds,
        state,
        firstResponse.semanticPatch,
      )
    }
  }

  /**
   * 仅复刻 CodegenConversationService.buildSemanticSafetyClarificationItems
   * 的最小判定（spot + short 不兼容），用于驱动 clarification loop。
   * SemanticContractReadiness 的完整 readiness 判定在 publication.generate
   * 内由 PublicationGate 兜底（throw PublicationGateClarificationBlockedError）。
   */
  private buildSafetyClarificationItems(state: SemanticState): unknown[] {
    const marketType = this.readSemanticContextValue(state.contextSlots.marketType)
    if (marketType !== 'spot') return []
    // #1496-M2: spot + short 不兼容判定。原先 status==='locked' 过滤过严——
    //   lifted atoms 经过 toTriggerState 后多数会停留在 'open'（等待 readiness
    //   补 evidence/params 才 locked），导致 spot+short 判定永远不触发，
    //   harness clarification 路径在 31 条 fixture 中从未被验证。
    //   语义上 sideScope==='short' 已足以表达"用户意图做空"，与 lifecycle status 解耦。
    const hasShortIntent =
      state.action.some(action =>
        action.key === 'open_short' || action.key === 'close_short' || action.key === 'reduce_short',
      )
      || state.trigger.some(trigger =>
        trigger.sideScope === 'short' || trigger.sideScope === 'both',
      )
    return hasShortIntent ? [{ reason: 'invalid_spot_short_combo' }] : []
  }

  private readSemanticContextValue(slot: unknown): string | null {
    if (!slot || typeof slot !== 'object') return null
    const raw = (slot as { value?: unknown }).value
    return typeof raw === 'string' ? raw : null
  }

  private buildUnsupportedResult(
    response: PlannerMockResponse,
    rounds: number,
    state: SemanticState | null,
    initialPatch: unknown,
  ): FiveLayerArtifacts {
    const reason = response.unsupportedReasons?.[0] ?? 'unsupported_unknown'
    const rulesTreeSnapshot = state
      ? snapshotRulesTree(initialPatch, state)
      : initialPatch ?? null
    return {
      rulesTreeHash: stableHash(rulesTreeSnapshot),
      displayGraphHash: stableHash({ unsupported: true, reason }),
      specHash: stableHash({ unsupported: true, reason }),
      irHash: stableHash({ unsupported: true, reason }),
      astHash: stableHash({ unsupported: true, reason }),
      scriptAtoms: [],
      route: { kind: 'unsupported', reason },
      clarificationRounds: rounds,
    }
  }
}
