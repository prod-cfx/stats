/**
 * INVARIANT-J — Sizing Evidence Registration
 *
 * SIZING_BEARING_ATOMS 白名单内 atom 必须在 ATOM_CONTRACT_REGISTRY 声明非空
 * `sizingEvidence`。强制 per-trade sizing 证据生产者显式声明，避免 sizing
 * 守门切换后又有原子漏 emit `capital.allocate.per_order_budget` 而 sizing
 * 静默缺失。
 *
 * 编译期守门：AtomContract.sizingEvidence 必填 + ATOM_CONTRACT_REGISTRY 通过
 *   `satisfies Record<AtomContractKey, AtomContract>` exhaustive 强制每个 atom
 *   显式声明（null 或非空）
 * 运行期守门：`assertSizingEvidenceRegistered()` 遍历白名单验证非空
 *
 * 后续约束（plan PR0 决策文档 canonical extract）：
 *   - 新增"自带 per-trade 资金分配语义"的 atom 必须：
 *     1) emit `capital.allocate.per_order_budget` capability
 *     2) ATOM_CONTRACT_REGISTRY 填非空 sizingEvidence
 *     3) atom key 加入 SIZING_BEARING_ATOMS 白名单
 *   - 不贡献 sizing 的 atom 显式填 `null`（表示已审计）
 */

import { ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import type { AtomContractKey } from '../../atom-contracts/atom-contract-types'

/**
 * 已声明对 per-trade sizing 有 evidence 贡献的 atom 白名单。
 * 新增 sizing-bearing atom 时必须同步加入此 Set。
 */
export const SIZING_BEARING_ATOMS: ReadonlySet<AtomContractKey> = new Set<AtomContractKey>([
  'position.dca_schedule',
  'position.pyramiding_limit',
  // Issue #1198：grid 路径 emit `capital.allocate.per_order_budget` 已恢复（PR #1197 补 kind），
  //   atom union 同步纳入 grid.range_rebalance 后白名单收口至 grid 路径。
  'grid.range_rebalance',
])

/**
 * 验证 ATOM_CONTRACT_REGISTRY 中所有 SIZING_BEARING_ATOMS 都声明了非空 sizingEvidence。
 * 在模块 bootstrap 或专属 spec 中调用，违反时立即 throw。
 */
export function assertSizingEvidenceRegistered(): void {
  const violations: string[] = []
  for (const key of SIZING_BEARING_ATOMS) {
    if (!ATOM_CONTRACT_REGISTRY[key].sizingEvidence) {
      violations.push(key)
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `INVARIANT-J violated: atoms missing sizingEvidence in ATOM_CONTRACT_REGISTRY: ${violations.join(', ')}`,
    )
  }
}
