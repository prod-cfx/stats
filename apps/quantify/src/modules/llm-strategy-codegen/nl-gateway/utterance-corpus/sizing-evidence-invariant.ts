/**
 * INVARIANT-J — Sizing Evidence Registration
 *
 * 规则（Issue #1230 扩容）：
 *   - actionable atom（isActionable: true）：sizingEvidence 可为 null 或非空，均合法
 *   - non-actionable atom（isActionable: false）：sizingEvidence 必须为 null
 *
 * SIZING_BEARING_ATOMS 不再硬编码，改为从 ATOM_CONTRACT_REGISTRY 中派生：
 *   凡是 sizingEvidence 非空的 atom，即为 sizing-bearing atom。
 *
 * 编译期守门：AtomContract.sizingEvidence + isActionable 均必填，
 *   ATOM_CONTRACT_REGISTRY 通过 `satisfies Record<AtomContractKey, AtomContract>`
 *   exhaustive 强制每个 atom 显式声明。
 * 运行期守门：`assertSizingEvidenceRegistered()` 遍历所有 atom 验证不变式。
 */

import { ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import type { AtomContractKey } from '../../atom-contracts/atom-contract-types'

/**
 * 派生自 ATOM_CONTRACT_REGISTRY 中 sizingEvidence 非空的 atom 集合。
 * 向后兼容历史调用：调用方可继续使用 SIZING_BEARING_ATOMS.has(key)。
 */
export const SIZING_BEARING_ATOMS: ReadonlySet<AtomContractKey> = new Set<AtomContractKey>(
  (Object.entries(ATOM_CONTRACT_REGISTRY) as [AtomContractKey, (typeof ATOM_CONTRACT_REGISTRY)[AtomContractKey]][])
    .filter(([, contract]) => contract.sizingEvidence !== null)
    .map(([key]) => key),
)

/**
 * 验证 ATOM_CONTRACT_REGISTRY 中所有 atom 满足 INVARIANT-J 不变式：
 *   - actionable atom：sizingEvidence 可为 null 或非空（不强制）
 *   - non-actionable atom：sizingEvidence 必须为 null
 * 违反时立即 throw。
 */
export function assertSizingEvidenceRegistered(): void {
  const violations: string[] = []
  for (const [key, contract] of Object.entries(ATOM_CONTRACT_REGISTRY) as [
    AtomContractKey,
    (typeof ATOM_CONTRACT_REGISTRY)[AtomContractKey],
  ][]) {
    if (!contract.isActionable && contract.sizingEvidence !== null) {
      violations.push(`${key} (non-actionable atom must not carry sizingEvidence)`)
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `INVARIANT-J violated: non-actionable atoms with sizingEvidence in ATOM_CONTRACT_REGISTRY: ${violations.join(', ')}`,
    )
  }
}
