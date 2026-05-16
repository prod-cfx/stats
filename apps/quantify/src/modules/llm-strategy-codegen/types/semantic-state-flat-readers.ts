/**
 * Issue #1397 — SemanticState 扁平桶 read-side 单点接入。
 *
 * **零行为变更 passthrough**：当前实现直接返回 `state.trigger / .action / .risk`
 * 同引用，**不读 `state.rules`**。本 PR 仅完成 reader 漏斗化；follow-up PR 完成 writer
 * 改造（让 `state.rules` 成为权威）后，再把本文件实现切到从 `state.rules` 投影
 * （走 {@link SemanticRuleProjectionService.projectToFlat} 或重抽的纯函数），reader 零再改。
 *
 * **为什么 helper 当前不读 rules**（来自审查反馈）：
 *   - `semantic-state-reducer` / `conversation-semantic-edit` 等服务对 helper 返回值做
 *     in-place mutation（`for (const t of readFlatTriggers(state)) { t.params[...] = ... }`）。
 *     若 helper 返回 rules 投影（非 state.trigger 同引用），mutation 写到临时数组、永远
 *     不回写 state，slot-fill / 状态变更被静默丢失。
 *   - 走 rules-prefer 需要先把这些 writer 路径全部改成 immutable 构造，那是 follow-up 范围。
 *   - 当前 passthrough 形态保证「现有 5088 unit + 8 条 e2e + #1391 历史用例」与 main 完全等价。
 *
 * ### follow-up 拆分（见 PR #1410 description）
 *
 * 1. writer 路径改造：`semantic-seed-state-builder` 任何路径都派生 `state.rules`，
 *    `state-merge / reducer / normalization / projection` 同步 rules
 * 2. 5 个 legacy risk key 注册到 `ATOM_CONTRACT_REGISTRY`（否则 projection 会丢
 *    `risk.stop_loss_pct` 等 unknown atom）
 * 3. 依赖 1+2：切 helper 实现到 rules-only + 删 `SemanticState.trigger/.action/.risk` 字段
 *
 * 用法：
 * ```ts
 * // ❌ 禁止
 * if (state.trigger.length === 0) { ... }
 * state.action.some(a => a.key === 'order.market')
 *
 * // ✅ 必须
 * if (readFlatTriggers(state).length === 0) { ... }
 * readFlatActions(state).some(a => a.key === 'order.market')
 * ```
 *
 * Refs: #1395 (rules 树主体) / #1396 (rules projection 基础设施) / #1397 (本迁移)
 */

import type {
  SemanticActionState,
  SemanticPositionConstraintState,
  SemanticRiskState,
  SemanticState,
  SemanticTriggerState,
} from './semantic-state'

/** 读取扁平 trigger 桶。当前 passthrough（同引用）；follow-up PR 切到 rules 投影。 */
export function readFlatTriggers(state: SemanticState): SemanticTriggerState[] {
  return state.trigger
}

/** 读取扁平 action 桶。当前 passthrough（同引用）；follow-up PR 切到 rules 投影。 */
export function readFlatActions(state: SemanticState): SemanticActionState[] {
  return state.action
}

/** 读取扁平 risk 桶。当前 passthrough（同引用）；follow-up PR 切到 rules 投影。 */
export function readFlatRisks(state: SemanticState): SemanticRiskState[] {
  return state.risk
}

/**
 * 读取扁平 positionConstraint 桶（#1395 引入；grid.range_rebalance 等 bucket=positionConstraint
 * 的 atom 都放这里）。当前 passthrough；follow-up PR 切到 rules 投影。
 *
 * 注意：旧的 `state.position?.constraints` 嵌套桶为 legacy 残留，部分 reader（如
 * canonical-spec-builder.service.ts:1349）仍在查询；新代码统一通过本 helper 读顶层桶。
 */
export function readFlatPositionConstraints(state: SemanticState): SemanticPositionConstraintState[] {
  return state.positionConstraint ?? []
}
