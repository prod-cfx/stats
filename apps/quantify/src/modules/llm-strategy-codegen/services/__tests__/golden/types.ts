/**
 * #1496-M4: golden harness 与 mock planner data 共享 PlannerMockResponse 形状
 *
 * 设计原则：
 *  - 单一数据源：harness runner / mock data / 后续 spec 一致 import；
 *  - condition / effects 字段保持 `unknown`，让 harness 在 runtime narrow，避免与
 *    AtomExpr schema 提前耦合（schema 仍在演进）；
 *  - 全字段可选，便于 mock 表达各种生命周期片段（首轮 / 澄清回复 / 显式 unsupported）。
 */
export interface PlannerMockSemanticPatch {
  /** planner 必须同时提供 contextSlots（symbol / timeframe / exchange / marketType），
   *  否则 publication stage 直接抛 codegen.publication_context_missing。harness 不再回退。 */
  contextSlots?: {
    symbol?: string
    timeframe?: string
    exchange?: string
    marketType?: string
  }
  /** 可选：覆盖默认仓位（如 webhook / DCA 等场景需要明确仓位） */
  position?: unknown
  rules?: Array<{
    id: string
    phase: 'entry' | 'exit' | 'gate'
    sideScope: 'long' | 'short' | 'both'
    /** rules tree AtomExpr；由 harness 在 runtime narrow */
    condition: unknown
    /** AtomExpr[]；同上 */
    effects: unknown[]
    evidence?: { text: string }
  }>
}

export interface PlannerMockResponse {
  /** mock 数据建议使用 PlannerMockSemanticPatch；sanity spec 复用 GenericSeedDispatcher 输出
   *  （CodegenSemanticPatch）时仍合法，harness 在 runtime narrow 后无差异。 */
  semanticPatch?: PlannerMockSemanticPatch | Record<string, unknown>
  /** 若 planner 期望直接走 unsupported（不进 rules tree），则给出 reason */
  unsupportedReasons?: string[]
  /** 模拟 planner 的对话回复 */
  assistantPrompt?: string
  related?: boolean
  logicReady?: boolean
  /** 表示本次响应是对前一轮 clarification 的回复（仅元数据） */
  clarificationAnswered?: boolean
}

export type PlannerMockQueue = PlannerMockResponse[]
