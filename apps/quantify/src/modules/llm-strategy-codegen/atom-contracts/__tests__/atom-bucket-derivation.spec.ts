/**
 * Issue #1364 PR1 — atom-bucket-derivation 反向不变量
 *
 * 守门 contract.bucket 单一真相源：
 *   1) 每个 REGISTRY key 的 bucket ∈ AtomContractBucket 联合类型
 *   2) getAtomKeysByBucket(b) 各 bucket 并集 == getAllRegisteredAtomKeys()
 *   3) getAtomBucket(key) 与 ATOM_CONTRACT_REGISTRY[key].bucket 等价
 *   4) 编译期守门：AtomContract.bucket 是 readonly 必填字段（atom-contract-types.ts:140）
 *      — 任意删除 bucket 字段 → tsc --noEmit 失败（spec 内不验，由 build precheck 兜底）
 */

import {
  ATOM_CONTRACT_REGISTRY,
  getAllRegisteredAtomKeys,
  getAtomBucket,
  getAtomKeysByBucket,
} from '../atom-contract-registry'
import type { AtomContractBucket, AtomContractKey } from '../atom-contract-types'

// 类型层穷举守门：satisfies Record<AtomContractBucket, ...> 强制本表覆盖 enum 全集；
// 新加 bucket 字面量到 AtomContractBucket 联合类型而忘了改这里 → tsc 失败。
const ALL_BUCKETS_TABLE = {
  trigger: true,
  action: true,
  risk: true,
  positionConstraint: true,
  orchestration: true,
} as const satisfies Readonly<Record<AtomContractBucket, true>>

const ALL_BUCKETS = Object.keys(ALL_BUCKETS_TABLE) as readonly AtomContractBucket[]

describe('atom-bucket-derivation (issue #1364 PR1)', () => {
  it('每个注册表 key 的 bucket ∈ AtomContractBucket 联合类型', () => {
    for (const key of getAllRegisteredAtomKeys()) {
      const bucket = ATOM_CONTRACT_REGISTRY[key].bucket
      expect(ALL_BUCKETS).toContain(bucket)
    }
  })

  it('getAtomBucket(key) 等价 ATOM_CONTRACT_REGISTRY[key].bucket', () => {
    for (const key of getAllRegisteredAtomKeys()) {
      expect(getAtomBucket(key)).toBe(ATOM_CONTRACT_REGISTRY[key].bucket)
    }
  })

  it('getAtomKeysByBucket 各 bucket 并集 == getAllRegisteredAtomKeys()', () => {
    const union = new Set<AtomContractKey>()
    for (const bucket of ALL_BUCKETS) {
      for (const key of getAtomKeysByBucket(bucket)) union.add(key)
    }
    const all = new Set<AtomContractKey>(getAllRegisteredAtomKeys())
    expect(union).toEqual(all)
  })

  it('getAtomKeysByBucket 各 bucket 之间互斥（同一 key 不归两个桶）', () => {
    const seen = new Map<AtomContractKey, AtomContractBucket>()
    for (const bucket of ALL_BUCKETS) {
      for (const key of getAtomKeysByBucket(bucket)) {
        const prev = seen.get(key)
        if (prev !== undefined && prev !== bucket) {
          throw new Error(`atom ${key} 同时归入 ${prev} 和 ${bucket}`)
        }
        seen.set(key, bucket)
      }
    }
  })

  it('每个 bucket 至少含 1 个 atom（注册表非空验证）', () => {
    for (const bucket of ALL_BUCKETS) {
      expect(getAtomKeysByBucket(bucket).length).toBeGreaterThan(0)
    }
  })

  // #1364 PR1 critic Round 1 M3：反向一致性锚。
  // ATOM_BUCKETS 私有化后，`atom-contract-invariants.spec.ts` 内
  // `length === getAllRegisteredAtomKeys().length` 变成 trivially true，失去对照价值。
  // 这里用 hardcoded 数字作为独立锚——新增/删除 atom 必须同步更新此值，避免双表
  // （ATOM_BUCKETS + ATOM_CONTRACT_REGISTRY）同时漏注册同一 key 时无 spec 捕获。
  it('注册表 size 等于预期锚（新增 atom 必须同步更新此数字）', () => {
    // Issue #1395 Wave 1: B4 IR emit 兑现 condition.sequence / price.previous_extrema_retest /
    //   risk.atr_take_profit 三个 atom（升 supportStatus 至 supported_executable），合计 +3。
    // Issue #1498 S4 + S5: 新增 risk.atr_multiple_stop / risk.atr_multiple_take_profit /
    //   risk.remembered_level_stop 三个 atom，合计 +3。
    // Issue #1491 阶段 B: 新增 price.rolling_extrema_breakout 一个 atom，合计 +1。
    // Issue #1737 Stage 4 PR3: 新增 risk/position dialogue atom shell 八个，合计 +8。
    const EXPECTED_ATOM_COUNT = 80
    expect(getAllRegisteredAtomKeys().length).toBe(EXPECTED_ATOM_COUNT)
  })
})
