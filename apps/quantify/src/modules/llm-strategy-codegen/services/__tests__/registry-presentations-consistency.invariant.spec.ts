/**
 * Issue #1279 #1329 Phase 4c — REGISTRY vs PRESENTATIONS 集合一致性 invariant。
 *
 * #1331 M3：从「allowlist 全枚举」改为「派生 + FORBIDDEN_RE_ADD 单向断言」形态。
 * 维护负担降到只在 PR 迁出 / 回灌时改 FORBIDDEN_RE_ADD（语义清晰）。
 *
 * 红线：
 *   - 已从 PRESENTATIONS 删除并迁入 REGISTRY 的 atom（FORBIDDEN_RE_ADD），禁止回灌到 PRESENTATIONS
 *   - PRESENTATIONS 全集非空（防误删全部 entry）
 */
import { ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import type { AtomContractKey } from '../../atom-contracts/atom-contract-types'
import { __forSpecOnly_getAllLegacyPresentationKeys } from '../legacy-presentation-data'

/**
 * 本 PR #1331 / #1329 follow-up 累计从 PRESENTATIONS 迁出至 REGISTRY 的 14 个 atom。
 *
 * 单向断言：未来这些 atom 不允许重新出现在 PRESENTATIONS（回灌即视为回归）。
 * 新增迁出时往此 const 追加；如要回灌（极少见，应避免）需要在此显式删除并附 PR 说明。
 */
const FORBIDDEN_RE_ADD: readonly AtomContractKey[] = [
  'gate.regime',
  'portfolioRisk.drawdown_block',
  'portfolioRisk.symbol_exposure_cap',
  'portfolioRisk.substrategy_exposure_cap',
  'program.dynamic_grid',
  'program.fixed_grid_gated',
  'program.adaptive_volatility_grid',
  'program.event_listener',
  'scope.symbol',
  'scope.leg',
  'scope.timeframe',
  'scope.dataSource',
  'scope.subStrategy',
  'gate.subStrategy',
]

describe('REGISTRY vs PRESENTATIONS 集合一致性 (Issue #1329 Phase 4c / #1331 M3)', () => {
  it('FORBIDDEN_RE_ADD 中的 atom 不允许重新出现在 PRESENTATIONS（单向断言）', () => {
    const presentationKeys = new Set(__forSpecOnly_getAllLegacyPresentationKeys())
    const reAdded = FORBIDDEN_RE_ADD.filter(key => presentationKeys.has(key))
    expect(reAdded).toEqual([])
  })

  it('FORBIDDEN_RE_ADD 中的 atom 必须在 REGISTRY 中存在（防止漂移到既不在 REGISTRY 也不在 PRESENTATIONS 的真空态）', () => {
    const registryKeys = new Set(Object.keys(ATOM_CONTRACT_REGISTRY))
    const orphans = FORBIDDEN_RE_ADD.filter(key => !registryKeys.has(key))
    expect(orphans).toEqual([])
  })

  it('PRESENTATIONS 与 REGISTRY 的交集不包含 FORBIDDEN_RE_ADD（派生形态等价检查）', () => {
    const registryKeys = new Set(Object.keys(ATOM_CONTRACT_REGISTRY))
    const overlap = __forSpecOnly_getAllLegacyPresentationKeys().filter(key => registryKeys.has(key))
    const forbiddenInOverlap = overlap.filter(key => (FORBIDDEN_RE_ADD as readonly string[]).includes(key))
    expect(forbiddenInOverlap).toEqual([])
  })

  it('PRESENTATIONS 全集非空（防误删全部 entry）', () => {
    expect(__forSpecOnly_getAllLegacyPresentationKeys().length).toBeGreaterThan(0)
  })
})
