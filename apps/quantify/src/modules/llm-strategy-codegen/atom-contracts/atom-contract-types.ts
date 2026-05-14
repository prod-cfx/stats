/**
 * Atom Contract Types — per-atom 全链路强契约接口（Issue #1162）
 *
 * 设计原则（Plan v2 M5 简化版）：
 *   - 4 字段：summaryContribution / readinessCheck / clarificationQuestion / mutex
 *   - Symbol sentinels：COMMON_PIPELINE / VIA_PRESENTATION_DISPLAY / NO_SUMMARY
 *   - AtomContract<> 用 TS exhaustive Record 守门；新增 atom → 编译失败
 */

import type { SupportedAtomKey } from '../nl-gateway/utterance-corpus/utterance-corpus.types'
import type { AtomContractSurface } from './atom-contract-surface.types'
import type { AtomContractDisplay } from './atom-contract-display.types'
import type { AtomContractEmit } from './atom-contract-emit.types'
import type { AtomContractCorpus } from './atom-contract-corpus.types'

export type { AtomContractCorpus } from './atom-contract-corpus.types'
export type {
  AtomContractSurface,
  Direction,
  ParamSlotSchema,
  PhaseResolverSpec,
  PhaseResolverFn,
  SideResolverSpec,
  SideResolverFn,
} from './atom-contract-surface.types'
export type {
  AtomContractDisplay,
  LocaleMap,
  ParamRenderer,
  SummaryTemplateFn,
} from './atom-contract-display.types'
export type {
  AtomContractEmit,
  CapabilityTriple,
  IrBuildContext,
  IrShapeBuilder,
  EvidenceSource,
  // Issue #1313 PR1: rule-level / spec-level atom IR emit shape 接口骨架
  RuleLevelEmitContext,
  SpecLevelEmitContext,
  RuleLikeInput,
  SpecLikeInput,
  OrchestrationPortfolioRiskLikeInput,
  RiskGuardShape,
  RiskGuardShapeOutput,
  RuleBlockShape,
  RuleBlockShapeOutput,
  OrchestrationPortfolioRiskShape,
  OrchestrationPortfolioRiskShapeOutput,
  LifecyclePyramidingShape,
  LifecyclePyramidingShapeOutput,
  // Issue #1313 PR5a: action atom IR emit shape 接口骨架
  ActionShape,
  ActionDefLikeOutput,
  ActionLikeInput,
} from './atom-contract-emit.types'

// =========================================================
// Symbol sentinels（编译期常量）
// =========================================================

/** 该 atom 不参与 conversation summary 段（如纯顶层 contextSlot） */
export const NO_SUMMARY = Symbol('no_summary')

/** summary 复用 presentationRegistry.getEntry(key).displayRenderer 文本 */
export const VIA_PRESENTATION_DISPLAY = Symbol('via_presentation_display')

/** readiness 走 contractReadiness.normalize 通用流水线（无自定义逻辑） */
export const COMMON_PIPELINE = Symbol('common_pipeline')

/**
 * #1162 critic Major #3：atom 在 atom-registry 注册为 unsupported（如公测 partial_take_profit）时，
 *   contractReadiness 主动跳过；此 sentinel 显式表达"声明已注册但行为 unsupported"，
 *   避免与 COMMON_PIPELINE 混淆产生"声明 vs 行为"错位
 */
export const UNSUPPORTED_SKIP = Symbol('unsupported_skip')

// =========================================================
// AtomContract<TParams>
// =========================================================

/**
 * SizingEvidence: per-trade order 金额贡献声明
 *
 * 新增 atom 时（plan critic Round 2 Mi SIZING_BEARING_ATOMS 新人指引）：
 *   - 若该 atom 行为会决定 per-trade 下单金额（DCA / pyramiding / grid ladder 等）：
 *     必须填 `sizingEvidence` 非空，并同步把 atom key 加入 `SIZING_BEARING_ATOMS` 白名单
 *   - 否则显式填 `null`，表示已审计、该 atom 不贡献 sizing
 *   - TS exhaustive Record + INVARIANT-J 双层守门防止漏填
 */
export interface SizingEvidence {
  readonly capability: { readonly domain: string; readonly verb: string; readonly object: string }
  readonly paramSource: string
}

export interface AtomContract<TParams = Record<string, unknown>> {
  /** atom 自身 key；PR1b 起导出 registry 时由单一真相源补齐 */
  key: AtomContractKey

  /** codegen 主数据流的 5 桶归类；dispatcher / FIRST_WAVE 派生只查此字段 */
  bucket: AtomContractBucket

  /** canonical strategy capability wave membership；constants 只能从 registry 派生 */
  canonicalWave?: 'first-wave'

  /**
   * Summary 贡献：
   *   NO_SUMMARY                   → 不参与 conversation summary
   *   VIA_PRESENTATION_DISPLAY     → 调 presentationRegistry.getEntry(key).displayRenderer
   *   (atom) => string | null      → 内联自定义文本
   */
  summaryContribution:
    | typeof NO_SUMMARY
    | typeof VIA_PRESENTATION_DISPLAY
    | ((atom: { params: TParams; status: string }) => string | null)

  /**
   * Readiness 检查：
   *   COMMON_PIPELINE              → 走通用 contractReadiness 流水线
   *   inline fn                   → 完全自定义（如 portfolioRisk.drawdown_block 的 fail-closed）
   */
  readinessCheck:
    | typeof COMMON_PIPELINE
    | typeof UNSUPPORTED_SKIP
    | ((atom: {
        params: TParams
        status: string
      }) => { satisfied: boolean; missingSlotKeys: readonly string[] })

  /**
   * Clarification 文案生成：
   *   VIA_PRESENTATION_DISPLAY     → 调 presentationRegistry.getEntry(key).clarificationRenderer
   *   (slotKey, params) => string  → 内联自定义文案
   */
  clarificationQuestion:
    | typeof VIA_PRESENTATION_DISPLAY
    | ((slotKey: string, params: TParams, locale?: 'zh' | 'en') => string)

  /**
   * 互斥 atom key 列表（融合 corpus-invariants ATOM_MUTEX）；无互斥时显式 []
   */
  mutex: readonly string[]

  /**
   * 是否为 actionable atom（能触发实际下单/平仓/调仓等执行行为）。
   *   true  → 该 atom 可以携带 sizingEvidence（null 或非空均可）
   *   false → non-actionable atom，sizingEvidence 必须为 null
   * INVARIANT-J 守门：non-actionable + sizingEvidence 非空 → throw
   */
  isActionable: boolean

  /**
   * 是否贡献 per-trade sizing evidence
   *   null    → 不贡献（需显式声明已审计）
   *   非空    → 声明 capability + paramSource
   * INVARIANT-J 守门（扩容后）：
   *   - actionable atom：null 或非空均合法
   *   - non-actionable atom：必须为 null
   */
  sizingEvidence: SizingEvidence | null

  /**
   * NL 识别面契约（Issue #1279 PR1a）—— 取代 semantic-seed-extractor 内的 39 个 push* 方法。
   *
   * PR1b 起：必选，paramSlots / phaseResolver / sideResolver 全部补齐。
   * PR2 阶段：dispatcher 唯一消费此字段。
   */
  surface: AtomContractSurface

  /**
   * 渲染层契约（Issue #1279 PR1a）—— 取代 semantic-presentation-registry.service.ts（2157 行）
   * 与 display-token-table.ts（336 行）两个并行真相源。
   *
   * PR1b 起：必选，先填 zh-only stub。
   * PR1c 阶段：从 presentation-registry 迁移真实双语数据，删除并行真相源。
   */
  display: AtomContractDisplay

  /**
   * NL corpus 字段（#1329 follow-up：取代 PRESENTATIONS）。
   * 每个 atom 必填；aliases/examples/golden 必非空字符串数组（允许 [] 表示无）。
   *
   * 不变量：corpus 4 字段不允许全部为空，除非该 atom 在 seed 处显式 stub 注释。
   */
  corpus: AtomContractCorpus

  /**
   * IR emit 层契约（Issue #1279 PR1a）—— 取代 canonical-spec-v2-ir-compiler.service.ts
   * 内 40+ case 分支。
   *
   * PR1b 起：必选，irShape 用 stub `() => throw new Error('PR1b stub pending PR3a')`。
   * PR3a 阶段：在 IR compiler refactor 时真实兑现，反转 `_IrShapeAllStub` invariant。
   */
  emit: AtomContractEmit
}

export type AtomContractKey = SupportedAtomKey
export type AtomContractBucket =
  | 'trigger'
  | 'action'
  | 'risk'
  | 'positionConstraint'
  | 'orchestration'
