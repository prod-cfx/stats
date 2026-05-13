/**
 * AtomContractEmit — IR emit 层契约（Issue #1279 PR1a + PR3a 兑现）
 *
 * 设计目标：
 *   把 `canonical-spec-v2-ir-compiler.service.ts` (3959 行) 内 40+ 个
 *   `switch(atom.key) case 'X.Y': { ...emit IR... }` 分支沉淀回 atom 自身。
 *   下游 IR compiler 退化为 `REGISTRY[key].emit.irShape(atom, ctx)` 调度。
 *
 *   PR1a 阶段：仅声明 type；registry entry 在 PR1b 阶段用 stub
 *   `() => { throw new Error('[#1279 PR1b stub] pending PR3a') }`。
 *
 *   PR3a 阶段（本次）：condition predicate 类 atom 真实兑现。
 *     - `IrShapeBuilder` 返回类型改为 predicate id `string`（与 compileAtom 等价）
 *     - 上下文扩展为 `{ compileContext, helpers, seed, closeRef }`：暴露 ir-compiler
 *       service 必需的 helper 方法（ensure* / upsertPredicate / readNumber 等）
 *     - irShape 实现是 "弱纯函数"：只通过 `ctx.helpers.*` 与 `ctx.compileContext.*Map`
 *       发生副作用（写 seriesMap / predicateMap / runtimeRequirements），等价于原 case body
 *     - action / risk / portfolio / position 类 atom 仍保留 stub —— 移至 PR3d/PR3e 兑现
 */

import type {
  ActionDef,
  IrOrchestrationPortfolioRisk,
  LevelSetDef,
  PredicateDef,
  RuleBlock,
  SeriesDef,
} from '../types/canonical-strategy-ir'
import type {
  CanonicalConditionAtom,
  CanonicalOrchestrationPortfolioRisk,
  CanonicalRuleAction,
  CanonicalRuleV2,
  CanonicalStrategySpecV2,
} from '../types/canonical-strategy-spec-v2'

/**
 * CapabilityTriple —— atom 行为能力三元组
 *
 * 与现有 sizingEvidence.capability 共享 shape：`{ domain, verb, object }`
 *   - domain：业务域（capital / signal / position / risk / orchestration）
 *   - verb：动作（allocate / cross / threshold / block / rebalance）
 *   - object：宾语（per_order_budget / rsi_value / drawdown / range / ...）
 *
 * 用途：IR builder 通过 capability 反查可挂载的实际执行 hook（trading / orchestration）。
 */
export interface CapabilityTriple {
  readonly domain: string
  readonly verb: string
  readonly object: string
}

/**
 * AtomIrCompileInput —— `IrShapeBuilder` 的第一参
 *
 * 直接复用 `CanonicalConditionAtom`：包含 kind/key/op/value/params 字段，
 * compileAtom dispatch 时本就持有 CanonicalConditionAtom 实例，无需转换。
 */
export type AtomIrCompileInput = CanonicalConditionAtom

/**
 * IrCompileContext —— 由 canonical IR compiler 注入的可变上下文
 *
 * 与 `canonical-spec-v2-ir-compiler.service.ts` 内私有 `CompileContext` 同 shape。
 * 抽到 types 文件以避免 registry → compiler 反向 import 形成环。
 * service 私有 CompileContext 必须可赋值给 IrCompileContext。
 */
export interface IrCompileContext {
  timeframe: string
  seriesMap: Map<string, SeriesDef>
  levelSetMap: Map<string, LevelSetDef>
  predicateMap: Map<string, PredicateDef>
  orderProgramActivePredicateMap: Map<string, string>
  movingAverage: { kind: 'EMA' | 'SMA'; fast: number; slow: number }
  rsi: { period: number }
  macd: { fastPeriod: number; slowPeriod: number; signalPeriod: number }
  bollinger: { period: number; stdDev: number }
  runtimeRequirements: { helpers: Set<string>; stateKeys: Set<string> }
}

/** GT/GTE/LT/LTE/EQ 子集，对应 compileAtom 内 resolveComparisonKind 出参 */
export type ComparisonKind = Extract<PredicateDef['kind'], 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ'>

/**
 * IrCompileHelpers —— atom irShape 可消费的 ir-compiler service 私有 helper 集合
 *
 * 等价于 `canonical-spec-v2-ir-compiler.service.ts` 内同名 private 方法的 bound 形态。
 * service 在调度时把 `this.ensurePriceSeries.bind(this)` 等装入 ctx.helpers，
 * irShape 实现禁止访问此对象之外的全局状态或 service 字段。
 *
 * 仅列出 PR3a 兑现的 condition predicate 类 atom 实际用到的 helper；
 * 后续 PR3d/PR3e 兑现 action/risk/portfolio/position 类 atom 时按需扩展。
 */
export interface IrCompileHelpers {
  ensurePriceSeries: (
    ctx: IrCompileContext,
    role: 'open' | 'high' | 'low' | 'close',
    timeframe?: string,
    lookback?: number,
  ) => string
  ensureMovingAverageSeries: (
    ctx: IrCompileContext,
    kind: 'EMA' | 'SMA',
    period: number,
  ) => string
  ensureRsiSeries: (ctx: IrCompileContext, period: number) => string
  ensureBollingerSeries: (
    ctx: IrCompileContext,
    band: 'UPPER_BAND' | 'LOWER_BAND' | 'MID_BAND',
  ) => string
  ensureChannelSeries: (
    ctx: IrCompileContext,
    kind: 'HIGHEST_HIGH' | 'LOWEST_LOW',
    period: number,
    timeframe?: string,
  ) => string
  ensureRangePositionSeries: (ctx: IrCompileContext, period: number) => string
  ensureGridLevelSet: (ctx: IrCompileContext, atom: AtomIrCompileInput) => string
  ensureStateContextSeries: (atomKey: string, ctx: IrCompileContext) => string
  ensureConstSeries: (ctx: IrCompileContext, value: number | string) => string
  ensureIndicatorReferenceSeries: (
    ctx: IrCompileContext,
    atom: AtomIrCompileInput,
    timeframe: string,
  ) => string
  upsertPredicate: (
    predicateMap: Map<string, PredicateDef>,
    baseId: string,
    kind: PredicateDef['kind'],
    args: string[],
    params?: PredicateDef['params'],
  ) => string
  readNumber: (candidates: unknown[], fallback: number) => number
  resolveComparisonKind: (op: AtomIrCompileInput['op']) => ComparisonKind
  normalizeRangePositionThreshold: (value: number) => number
  resolveMovingAverageAtomConfig: (
    atom: AtomIrCompileInput,
    fallback: IrCompileContext['movingAverage'],
  ) => IrCompileContext['movingAverage']
  // Issue #1313 PR3：rule-level emit shape 真实兑现需要的额外 helper。
  //   `ensurePositionSeries` 与 `compileActions` 是 ir-compiler service 私有方法，
  //   通过 service.irHelpers 暴露给 emit shape 实现使用。
  ensurePositionSeries: (
    ctx: IrCompileContext,
    kind: Extract<SeriesDef['kind'], 'POSITION_AVG_PRICE' | 'POSITION_PNL_PCT'>,
    id: string,
  ) => string
  compileActions: (
    rule: CanonicalRuleV2,
    spec: CanonicalStrategySpecV2,
    fallbackPositionPct: number,
    ctx: IrCompileContext,
  ) => ActionDef[]
  // Issue #1313 PR5c：6 个 action atom 的 `emit.actionShape` 真实兑现需要透出
  //   `resolveActionQuantity`（mirror service 私有方法），用于 OPEN/ADD 路径的 sizing 解析。
  //   CLOSE 路径的 `{ mode: 'position_pct', value: 100 }` 是字面量常量，无需 helper。
  resolveActionQuantity: (
    action: CanonicalRuleAction,
    defaultSizing: CanonicalStrategySpecV2['sizing'],
    fallbackPositionPct: number,
  ) => ActionDef['quantity']
}

/**
 * IrBuildContext —— atom irShape 调用上下文
 *
 * `compileContext` 暴露 ir-compiler 内可变上下文（seriesMap / predicateMap / ...）；
 * `helpers` 暴露 ir-compiler 内 ensure series / upsertPredicate 等 private 方法；
 * `seed` 来自 compileAtom 第三参（用于派生 predicate id 命名）；
 * `closeRef` 是 compileAtom 入口预拉的 `ensurePriceSeries(ctx, 'close')` 结果，
 *   多个 atom 用到，避免重复 ensure。
 */
export interface IrBuildContext {
  readonly seed: string
  readonly compileContext: IrCompileContext
  readonly helpers: IrCompileHelpers
  readonly closeRef: string
  readonly extra?: Readonly<Record<string, unknown>>
}

/**
 * IrShapeBuilder —— atom 的 IR emit 实现
 *
 * 返回 predicate id `string`（与原 compileAtom case body 等价）。
 * irShape 通过 `ctx.helpers.*` 与 `ctx.compileContext.*Map` 完成 series/predicate 写入，
 * 不允许调用其它 atom 的 irShape（PR3a 阶段约束，防止循环）。
 */
export type IrShapeBuilder = (
  atom: AtomIrCompileInput,
  context: IrBuildContext,
) => string

/**
 * EvidenceSource —— atom evidence 的取材来源
 *
 *   clause   —— evidence.text 来自单一子句（最常见）
 *   segment  —— evidence.text 来自整个 segment（含多子句聚合 atom，如 grid range）
 *   param    —— evidence.text 来自显式参数（如固定 atom，无对应 NL clause）
 *
 * 取代 `semantic-seed-state-builder.service.ts` 内硬编码的 SYNTHESIZABLE_* 集合
 * （PR2 改为派生 `Object.values(REGISTRY).filter(c => c.emit.evidenceSource === 'clause')`）。
 */
export type EvidenceSource = 'clause' | 'segment' | 'param'

/**
 * Issue #1313 PR1：rule-level / spec-level atom IR emit shape 接口骨架。
 *
 * 仅声明类型签名 + 在 `AtomContractEmit` 上挂 optional 字段；本 PR 0 atom 实际迁移，
 * 真实类型（`CanonicalRuleV2` / `CanonicalStrategySpecV2` /
 * `CanonicalOrchestrationPortfolioRisk` / `RiskGuard` / `RuleBlock` /
 * `IrOrchestrationPortfolioRisk` / `ActionDef`）由后续 atom 迁移 PR 替换占位
 * `Record<string, unknown>`。
 *
 * 5 shape ↔ service helper ↔ 消费 atom 映射：
 *   - RiskGuardShape                  ← `tryCompileRiskGuard` (canonical-spec-v2-ir-compiler.service.ts L2521-L2724)
 *     真实 sig: (rule: CanonicalRuleV2, ctx: CompileContext) => RiskGuard | null
 *     消费 atom: `position.has_position` / `position.no_position` → capabilityStatus 'pr3e-risk-guard'
 *   - RuleBlockShape                  ← `tryCompileReduceActionRule` (L2964-L3023)
 *     真实 sig: (rule, spec, fallbackPositionPct, ctx) => RuleBlock | null
 *     消费 atom: `risk.partial_take_profit` → capabilityStatus 'pr3e-rule-block'
 *   - OrchestrationPortfolioRiskShape ← `compileOrchestrationPortfolioRisks` (L1051-L1086)
 *     真实 sig: (orchRisk, ctx) => IrOrchestrationPortfolioRisk
 *     注：源头是 `spec.orchestration.portfolioRisks[]`，非 atom 自身；dispatcher 反查 atom
 *     后调度，per-risk emit。消费 atom: `portfolioRisk.drawdown_block` → 'pr3e-orchestration-portfolio'
 *   - LifecyclePyramidingShape        ← `resolveLifecyclePyramiding` (L3631-L3646)
 *     真实 sig: (rules: CanonicalRuleV2[]) => { allow, maxLayers }
 *     注：输入是 rules 数组聚合，非单 atom emit；dispatcher 在 IR 编译末段单次调用。
 *     消费 atom: `position.pyramiding_limit` → 'pr3e-lifecycle'
 *   - ActionShape                     ← `compileActions` (canonical-spec-v2-ir-compiler.service.ts L3414-L3464)
 *     真实 sig: (rule: CanonicalRuleV2, spec: CanonicalStrategySpecV2, fallbackPositionPct: number)
 *               => ActionDef[]
 *     注：`compileActions` 是 service 方法，CompileContext 经由 `this` 隐式持有（与
 *         `tryCompileRiskGuard` / `tryCompileReduceActionRule` 同），并非 4 参函数。
 *     消费 atom: `action.open_long` / `action.close_long` / `action.open_short` /
 *               `action.close_short` / `action.add_position` / `action.reverse_position`
 *               → capabilityStatus 'pr3e-action'
 *     注：dispatcher 调度发生在 `compileActions` 内 `action.type` enum switch 上层 — emit
 *         body 真实消费的载体是 `CanonicalRuleAction`（`rule.actions[i]`，持有
 *         `type / sizing / params`），非 `CanonicalConditionAtom`；ActionShape 入参形态因此
 *         同时透出 `atom`（与已有 4 类 shape 入参对齐 + 承接 PR5b 引入的
 *         `CanonicalRuleAction.atomKey` 反查）与 `action`（emit body 真实消费的 per-action
 *         载体；占位 `ActionLikeInput` 等价 `CanonicalRuleAction`）。
 *         `action.reverse_position` 单 atom 展开为 [CLOSE, OPEN] 两条 ActionDef，
 *         返回 `readonly ActionDef[]` 即兼容此形态；不在本 6 atom 集合内的
 *         `REDUCE_LONG / REDUCE_SHORT / FORCE_EXIT / BLOCK_NEW_ENTRY` 仍走 enum 兜底。
 *
 * `position.dca_schedule` IR compiler 内零 case：IR 编译阶段无独立产出（影响透过
 *   `position.constraints[]` 由 `per-trade-sizing-resolver` 派生），不引入第 6 类 shape；
 *   保持 capabilityStatus = 'irshape-not-applicable' 显式声明已审计。
 *
 * Issue #1313 PR5a：本次仅扩 `ActionShape` 接口签名 + `AtomContractEmit.actionShape?` 字段 +
 *   `'pr3e-action'` capabilityStatus 字面量；0 atom 实际迁移，6 个 action atom 仍处
 *   `'irshape-not-applicable'` 状态、仍在 `NonConditionRegistryKey` 守门集合内。
 *   后续 PR5b（`CanonicalRuleAction.atomKey?` 字段 + builder 翻译点透传）/
 *   PR5c（6 atom emit.actionShape 真实兑现 + IR compiler `compileActions` REGISTRY 调度优先 +
 *   enum 兜底，双侧 builder + IR snapshot 等价证据）/ PR5d（反转 `_ActionEmitAllReal`
 *   invariant + 6 atom 从 `NonConditionRegistryKey` 移出）接力。
 */

/**
 * RuleLevelEmitContext —— rule-level atom emit shape（RiskGuard / RuleBlock）调用上下文。
 *
 * 与 `IrBuildContext` 同形：暴露 `compileContext` 与 `helpers`，让 atom 通过 `helpers.*`
 * 完成 series / predicate / runtimeRequirements 写入，与现有 `IrShapeBuilder` 调用约定一致。
 */
export interface RuleLevelEmitContext {
  readonly compileContext: IrCompileContext
  readonly helpers: IrCompileHelpers
  readonly seed: string
  readonly extra?: Readonly<Record<string, unknown>>
}

/**
 * SpecLevelEmitContext —— spec-level atom emit shape（OrchestrationPortfolioRisk /
 * LifecyclePyramiding）调用上下文。
 *
 * 与 RuleLevelEmitContext 同形，独立别名标记"调用来源 = IR 编译末段 spec-level 聚合"，
 * 与 rule-by-rule iteration 区分；后续 atom 迁移 PR 可视需要分化为不同形状。
 */
export interface SpecLevelEmitContext {
  readonly compileContext: IrCompileContext
  readonly helpers: IrCompileHelpers
  readonly extra?: Readonly<Record<string, unknown>>
}

/**
 * 占位输入/输出类型。
 *
 * Issue #1313 PR1 阶段以 `Record<string, unknown>` 占位声明并保持松散；
 *   - RiskGuard / LifecyclePyramiding 类 atom 的 shape 已落地在 PR2 / PR4,
 *     spec mocks 使用部分构造,需要 RuleLikeInput 维持松散结构兼容。
 *   - RuleBlock / OrchestrationPortfolioRisk 类 shape 在 PR3（本 PR）兑现,
 *     内部通过各自 `*RuleLike` interface 收窄到所需字段（rule.metadata /
 *     rule.actions / orchRisk.thresholdPct 等）,无需在外部 RuleLikeInput 联合
 *     里强行收窄到 CanonicalRuleV2。
 *   - 真实 canonical 类型导入仅供注释 / 后续可选收窄；当前实现走结构性接口。
 */
export type RuleLikeInput = Readonly<Record<string, unknown>>
export type SpecLikeInput = Readonly<Record<string, unknown>>
export type OrchestrationPortfolioRiskLikeInput = Readonly<Record<string, unknown>>
/**
 * Issue #1313 PR5a：`ActionShape` per-action 载体占位 —— 等价
 * `CanonicalRuleAction`（rule.actions[i]，持有 `type / sizing / params`），
 * PR5c 兑现时替换为真实 `CanonicalRuleAction`。
 */
export type ActionLikeInput = Readonly<Record<string, unknown>>
export type RiskGuardShapeOutput = Readonly<Record<string, unknown>> | null
export type RuleBlockShapeOutput = RuleBlock | null
export type OrchestrationPortfolioRiskShapeOutput = IrOrchestrationPortfolioRisk
export interface LifecyclePyramidingShapeOutput {
  readonly allow: boolean
  readonly maxLayers: number
}

/**
 * Issue #1313 PR5a：`ActionShape` 输出占位 — `ActionDef` 真实类型由 PR5c 替换。
 * 单 atom 可展开为 0..N 条 ActionDef（如 `action.reverse_position` → [CLOSE, OPEN]），
 * 故返回 `readonly` 数组形态。
 */
export type ActionDefLikeOutput = Readonly<Record<string, unknown>>

/**
 * RiskGuardShape —— mirror `canonical-spec-v2-ir-compiler.service.ts#tryCompileRiskGuard`。
 *   atom: CanonicalConditionAtom（dispatcher 已持有的实例）
 *   rule: CanonicalRuleV2（占位 RuleLikeInput，需透出 `phase / actions / sideScope / condition`）
 *   ctx:  RuleLevelEmitContext
 *   → RiskGuard | null（不可生成时返回 null，dispatcher 兜底）
 */
export type RiskGuardShape = (
  atom: AtomIrCompileInput,
  rule: RuleLikeInput,
  context: RuleLevelEmitContext,
) => RiskGuardShapeOutput

/**
 * RuleBlockShape —— mirror `canonical-spec-v2-ir-compiler.service.ts#tryCompileReduceActionRule`。
 *   spec: CanonicalStrategySpecV2（透出给 `compileActions(rule, spec, fallbackPct)`）
 *   fallbackPositionPct: number（spec.sizing.value 兜底）
 *   → RuleBlock | null
 */
export type RuleBlockShape = (
  atom: AtomIrCompileInput,
  rule: RuleLikeInput,
  spec: SpecLikeInput,
  fallbackPositionPct: number,
  context: RuleLevelEmitContext,
) => RuleBlockShapeOutput

/**
 * OrchestrationPortfolioRiskShape —— mirror
 * `canonical-spec-v2-ir-compiler.service.ts#compileOrchestrationPortfolioRisks` 内单条
 * portfolioRisk 的 emit。源头是 `spec.orchestration.portfolioRisks[]`，per-risk emit。
 *   orchRisk: CanonicalOrchestrationPortfolioRisk（占位）
 *   → IrOrchestrationPortfolioRisk
 */
export type OrchestrationPortfolioRiskShape = (
  orchRisk: OrchestrationPortfolioRiskLikeInput,
  context: SpecLevelEmitContext,
) => OrchestrationPortfolioRiskShapeOutput

/**
 * LifecyclePyramidingShape —— mirror
 * `canonical-spec-v2-ir-compiler.service.ts#resolveLifecyclePyramiding`。
 *   rules: CanonicalRuleV2[]（聚合整个 spec.rules，dispatcher 在 IR 编译末段单次调用）
 *   → { allow: boolean, maxLayers: number }
 */
export type LifecyclePyramidingShape = (
  rules: readonly RuleLikeInput[],
  context: SpecLevelEmitContext,
) => LifecyclePyramidingShapeOutput

/**
 * Issue #1313 PR5a：`ActionShape` —— mirror
 * `canonical-spec-v2-ir-compiler.service.ts#compileActions` (L3414-L3464)。
 *
 *   atom: CanonicalConditionAtom（dispatcher 已持有的实例；与现有 `IrShapeBuilder`
 *         / `RiskGuardShape` 等保持入参形态一致。PR5b 引入
 *         `CanonicalRuleAction.atomKey` 后 dispatcher 反查 REGISTRY[atomKey]）
 *   action: CanonicalRuleAction（占位 ActionLikeInput；emit body 真实消费的 per-action
 *         载体 —— `compileActions` switch 上 `action.type / action.sizing / action.params`
 *         全部来自此处。PR5b 引入 `CanonicalRuleAction.atomKey?: string` 后由 dispatcher
 *         按 atomKey 反查 REGISTRY[key].emit.actionShape 调度）
 *   rule: CanonicalRuleV2（占位 RuleLikeInput；需透出 `actions / sideScope / metadata`）
 *   spec: CanonicalStrategySpecV2（占位 SpecLikeInput；用于 sizing 兜底）
 *   fallbackPositionPct: number（spec.sizing.value 兜底，沿用 `compileActions` 第三参）
 *   context: RuleLevelEmitContext（与 RiskGuard / RuleBlock 共用 rule-level 上下文；
 *         `compileActions` 自身不写 series/predicate，但 `collectPositionLifecycleRuntimeRequirements`
 *         等近邻 helper 写 `context.runtimeRequirements`，给 PR5c 兑现留口子）
 *   → readonly ActionDef[]（单 atom 可展开多条；如 `action.reverse_position` → [CLOSE, OPEN]）
 *
 * 与 IR compiler 内 enum case 等价的 emit 形态：
 *   - `action.open_long`       → [{ kind: 'OPEN_LONG',  quantity: resolveActionQuantity(...) }]
 *   - `action.open_short`      → [{ kind: 'OPEN_SHORT', quantity: resolveActionQuantity(...) }]
 *   - `action.close_long`      → [{ kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } }]
 *   - `action.close_short`     → [{ kind: 'CLOSE_SHORT', quantity: { mode: 'position_pct', value: 100 } }]
 *   - `action.add_position`    → [{ kind: 'ADD_LONG' | 'ADD_SHORT', quantity: resolveActionQuantity(...) }]
 *   - `action.reverse_position`→ [{ kind: 'CLOSE_*', quantity: { mode: 'position_pct', value: 100 } },
 *                                 { kind: 'OPEN_*',  quantity: resolveActionQuantity(...) }]
 *
 * 不在本 6 atom 集合内的 `REDUCE_LONG / REDUCE_SHORT / FORCE_EXIT / BLOCK_NEW_ENTRY` 仍走
 * IR compiler `compileActions` 内 enum case 兜底（分别归属 `action.reduce_position` /
 * `risk.partial_take_profit` / `portfolioRisk.drawdown_block` 等 atom，由 `RuleBlockShape` /
 * `OrchestrationPortfolioRiskShape` / `RiskGuardShape` 各自承担）。
 */
export type ActionShape = (
  atom: AtomIrCompileInput,
  action: ActionLikeInput,
  rule: RuleLikeInput,
  spec: SpecLikeInput,
  fallbackPositionPct: number,
  context: RuleLevelEmitContext,
) => readonly ActionDefLikeOutput[]

/**
 * AtomContractEmit —— atom IR emit 层契约
 *
 * `capabilityStatus`:
 *   'pr1b-stub' —— irShape 仍是 stub，调用会抛 `[#1279 PR1b stub]`（占位状态，
 *     PR3a Phase 2 落地后不再被默认使用；保留以兼容未来 condition atom 迁移中的临时状态）
 *   'pr3a-condition' —— PR3a Phase 2 兑现：condition predicate 类 atom，返回 predicate id
 *   'pr3e-risk-guard' —— Issue #1313 PR2 兑现：本 atom 通过 `emit.riskGuardShape`
 *     完成 rule-level RiskGuard emit。`position.has_position` / `position.no_position`
 *     已进入此状态，dispatcher `tryCompileRiskGuard` 内 atom-specific 分支退化为
 *     REGISTRY 调度；`_RiskGuardEmitAllReal` invariant 守门。
 *   'pr3e-rule-block' —— 本 atom 通过 `emit.ruleBlockShape` 完成 rule-level RuleBlock emit。
 *   'pr3e-orchestration-portfolio' —— 本 atom 通过 `emit.orchestrationPortfolioRiskShape`
 *     完成 spec-level IrOrchestrationPortfolioRisk emit。
 *   'pr3e-lifecycle' —— 本 atom 通过 `emit.lifecyclePyramidingShape` 完成 spec-level
 *     pyramiding 聚合 emit。
 *   'pr3e-action' —— Issue #1313 PR5a 接口骨架；PR5c 兑现：本 atom 通过 `emit.actionShape`
 *     完成 rule-level `ActionDef[]` emit（mirror `compileActions` 内 enum case body）；
 *     本 PR 0 atom 实际进入此状态。
 *   'irshape-not-applicable' —— PR3e 兑现：本 atom 走 rule-level / spec-level IR 编译路径
 *     （tryCompileRiskGuard / tryCompileReduceActionRule / compileOrchestrationPortfolioRisks /
 *     resolveLifecyclePyramiding / compileActions 等），不参与 `compileAtom` 内的
 *     `emit.irShape` predicate id 调度。声明该状态等价于"已审计并显式标注：本 atom
 *     emit.irShape 接口不适用"，与 `'pr1b-stub'`（未兑现）语义严格分离。
 *   'ready' —— 兜底字面量，给后续可能引入的真实兑现状态预留
 *
 * `riskGuardShape / ruleBlockShape / orchestrationPortfolioRiskShape /
 * lifecyclePyramidingShape / actionShape`:
 *   Issue #1313 PR1 + PR5a 接口骨架，optional + nullable；本 PR 全为 undefined，
 *   后续 atom 迁移 PR 按 atom 分组兑现并配合 capabilityStatus 反转 invariant。
 */
export interface AtomContractEmit {
  readonly capability: CapabilityTriple
  readonly capabilityStatus?:
    | 'pr1b-stub'
    | 'pr3a-condition'
    | 'pr3e-risk-guard'
    | 'pr3e-rule-block'
    | 'pr3e-orchestration-portfolio'
    | 'pr3e-lifecycle'
    | 'pr3e-action'
    | 'irshape-not-applicable'
    | 'ready'
  readonly irShape: IrShapeBuilder
  readonly riskGuardShape?: RiskGuardShape | null
  readonly ruleBlockShape?: RuleBlockShape | null
  readonly orchestrationPortfolioRiskShape?: OrchestrationPortfolioRiskShape | null
  readonly lifecyclePyramidingShape?: LifecyclePyramidingShape | null
  readonly actionShape?: ActionShape | null
  readonly evidenceSource: EvidenceSource
}

