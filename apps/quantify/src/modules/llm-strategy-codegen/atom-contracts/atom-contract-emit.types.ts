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
  LevelSetDef,
  PredicateDef,
  SeriesDef,
} from '../types/canonical-strategy-ir'
import type { CanonicalConditionAtom } from '../types/canonical-strategy-spec-v2'

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
 * AtomContractEmit —— atom IR emit 层契约
 *
 * `capabilityStatus`:
 *   'pr1b-stub' —— irShape 仍是 stub，调用会抛 `[#1279 PR1b stub]`（占位状态，
 *     PR3a Phase 2 落地后不再被默认使用；保留以兼容未来 condition atom 迁移中的临时状态）
 *   'pr3a-condition' —— PR3a Phase 2 兑现：condition predicate 类 atom，返回 predicate id
 *   'irshape-not-applicable' —— PR3e 兑现：本 atom 走 rule-level / spec-level IR 编译路径
 *     （tryCompileRiskGuard / tryCompileReduceActionRule / compileOrchestrationPortfolioRisks /
 *     resolveLifecyclePyramiding / compileActions 等），不参与 `compileAtom` 内的
 *     `emit.irShape` predicate id 调度。声明该状态等价于"已审计并显式标注：本 atom
 *     emit.irShape 接口不适用"，与 `'pr1b-stub'`（未兑现）语义严格分离。
 *   'ready' —— 兜底字面量，给后续可能引入的真实兑现状态预留
 */
export interface AtomContractEmit {
  readonly capability: CapabilityTriple
  readonly capabilityStatus?: 'pr1b-stub' | 'pr3a-condition' | 'irshape-not-applicable' | 'ready'
  readonly irShape: IrShapeBuilder
  readonly evidenceSource: EvidenceSource
}

