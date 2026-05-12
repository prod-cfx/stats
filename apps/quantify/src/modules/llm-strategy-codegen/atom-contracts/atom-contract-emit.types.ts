/**
 * AtomContractEmit — IR emit 层契约（Issue #1279 PR1a）
 *
 * 设计目标：
 *   把 `canonical-spec-v2-ir-compiler.service.ts` (3959 行) 内 40+ 个
 *   `switch(atom.key) case 'X.Y': { ...emit IR... }` 分支沉淀回 atom 自身。
 *   下游 IR compiler 退化为 `REGISTRY[key].emit.irShape(params, ctx)` 调度。
 *
 *   PR1a 阶段：仅声明 type；registry entry 在 PR1b 阶段用 stub
 *   `(params) => { throw new Error('[#1279 PR1b stub] pending PR3a') }`，
 *   PR3a 阶段在 IR compiler refactor 时一次性兑现。
 *
 *   PR2 dispatcher 不调用 `emit.irShape`（dispatcher 只产 seed，IR compiler 才用 emit），
 *   stub 在 PR2 → PR3a 之间挂着但不被任何路径调用。
 */

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
 * IrBuildContext —— IR compile 阶段透传的上下文
 *
 * 由 canonical IR compiler 注入（PR3a 阶段填充实际 shape），PR1a 阶段先用最小占位结构。
 * irShape 实现禁止依赖此 context 之外的全局状态。
 */
export interface IrBuildContext {
  readonly symbol?: string
  readonly timeframe?: string
  readonly sideScope?: 'long' | 'short' | 'both'
  readonly phase?: 'entry' | 'exit'
  /** PR3a 阶段扩展：indicator alias / multi-leg ctx 等 */
  readonly extra?: Readonly<Record<string, unknown>>
}

/**
 * CanonicalIrNode —— IR compiler 产出的节点（占位类型）
 *
 * PR3a 阶段会替换为 canonical-strategy-ir.types.ts 内的真实 union；
 * PR1a 用最小描述足以让 irShape 签名成立、不引入循环依赖。
 */
export interface CanonicalIrNode {
  readonly kind: string
  readonly atomKey: string
  readonly params: Readonly<Record<string, unknown>>
  readonly children?: readonly CanonicalIrNode[]
}

/**
 * IrShapeBuilder —— atom 的 IR emit 实现
 *
 * 必须是纯函数；不允许调用其它 atom 的 irShape（PR3a 阶段会显式守护，防止循环）。
 */
export type IrShapeBuilder = (
  params: Readonly<Record<string, unknown>>,
  context: IrBuildContext,
) => CanonicalIrNode

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
 */
export interface AtomContractEmit {
  readonly capability: CapabilityTriple
  readonly irShape: IrShapeBuilder
  readonly evidenceSource: EvidenceSource
}
