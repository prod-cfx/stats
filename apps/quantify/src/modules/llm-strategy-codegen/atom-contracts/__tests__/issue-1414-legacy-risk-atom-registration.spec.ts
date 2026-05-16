/**
 * Issue #1414 — legacy risk atom 注册覆盖断言
 *
 * 守门：3 个 legacy risk atom（risk.protective_exit / risk.max_drawdown_pct /
 *   risk.max_single_loss_pct）必须以正确 bucket / phase / roles 注册到
 *   ATOM_CONTRACT_REGISTRY，使得 atom-keys/no-atom-key-literal lint rule 不再对
 *   仓库内对应 key 字面量误报，且下游 IR compiler / projection / normalization
 *   等遗留消费路径行为不变（由各自既有 spec 守门，本 spec 只断注册存在性）。
 *
 * 注意：原计划新增 projectFlatBucketsFromRules round-trip spec 的 helper 由
 *   并行的 #1413 单独提供；待 #1413 合入后可补 round-trip 端到端断言。
 */
import {
  ATOM_CONTRACT_REGISTRY,
  getAtomBucket,
  getAtomFulfillsStrategyPhase,
  getAtomRoles,
} from '../atom-contract-registry'

describe('issue #1414 — legacy risk atom 注册覆盖', () => {
  const LEGACY_RISK_KEYS = [
    'risk.protective_exit',
    'risk.max_drawdown_pct',
    'risk.max_single_loss_pct',
  ] as const

  it.each(LEGACY_RISK_KEYS)('%s 已注册到 ATOM_CONTRACT_REGISTRY', (key) => {
    expect(ATOM_CONTRACT_REGISTRY[key]).toBeDefined()
  })

  it.each(LEGACY_RISK_KEYS)('%s 归属 risk bucket', (key) => {
    expect(getAtomBucket(key)).toBe('risk')
  })

  it.each(LEGACY_RISK_KEYS)('%s fulfills risk + exit 两个 strategy phase', (key) => {
    const phases = getAtomFulfillsStrategyPhase(key)
    expect(phases).toEqual(expect.arrayContaining(['risk', 'exit']))
  })

  it.each(LEGACY_RISK_KEYS)('%s 同时声明 predicate + effect 双角色（阈值触及 + 强平副作用）', (key) => {
    const roles = getAtomRoles(key)
    expect(roles).toEqual(expect.arrayContaining(['predicate', 'effect']))
  })

  it.each(LEGACY_RISK_KEYS)('%s 声明 publicName 中英双语', (key) => {
    const display = ATOM_CONTRACT_REGISTRY[key].display
    expect(display.publicName.zh).toBeTruthy()
    expect(display.publicName.en).toBeTruthy()
    expect(display.publicName.zh).not.toBe(display.publicName.en)
  })

  it('classifier supportStatus 全部为 supported_executable（与 legacy semantic-atom-registry 一致）', () => {
    for (const key of LEGACY_RISK_KEYS) {
      expect(ATOM_CONTRACT_REGISTRY[key].classifier.supportStatus).toBe('supported_executable')
    }
  })

  it('classifier 不带 executableSinceVersion（避免 runtime-version-gate 把老策略此 atom 强制降级为 recognized_unsupported）', () => {
    for (const key of LEGACY_RISK_KEYS) {
      const cls = ATOM_CONTRACT_REGISTRY[key].classifier as { executableSinceVersion?: string }
      expect(cls.executableSinceVersion).toBeUndefined()
    }
  })
})
