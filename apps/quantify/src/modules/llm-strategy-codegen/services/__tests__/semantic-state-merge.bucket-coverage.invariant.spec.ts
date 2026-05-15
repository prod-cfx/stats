// #1383 Lane B — 桶覆盖结构不变式：5 个 atom bucket 中任一桶，若 persisted 持有 atom 而
// derived 给出空数组，merge 结果必须仍然包含 persisted 的 atom。
// 该 spec 用 keyof SemanticStateBuckets 类型驱动，确保未来 AtomContractBucket 扩张时
// 编译期就强制本测试列出新桶（漏写 ts7053/扩展失败显式可见）。
import type { AtomContractBucket } from '../../atom-contracts/atom-contract-types'
import type {
  SemanticActionState,
  SemanticOrchestrationNode,
  SemanticPositionConstraintState,
  SemanticRiskState,
  SemanticState,
  SemanticStateBuckets,
  SemanticTriggerState,
} from '../../types/semantic-state'
import { SemanticStateMergeService } from '../semantic-state-merge.service'

function emptyState(): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-15T00:00:00.000Z',
  }
}

function makeTrigger(): SemanticTriggerState {
  return {
    id: 't1',
    key: 'indicator.above',
    phase: 'entry',
    params: { indicator: 'ema20' },
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
  }
}
function makeAction(): SemanticActionState {
  return {
    id: 'a1',
    key: 'open_long',
    params: {},
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
  }
}
function makeRisk(): SemanticRiskState {
  return {
    id: 'r1',
    key: 'risk.stop_loss_pct',
    params: { valuePct: 5 },
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
  }
}
function makePositionConstraint(): SemanticPositionConstraintState {
  return {
    id: 'pc1',
    key: 'position.dca_schedule',
    params: { tiers: [{ ratio: 0.5 }] },
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
  }
}
function makeOrchestration(): SemanticOrchestrationNode {
  return {
    id: 'o1',
    kind: 'program',
    key: 'runtime.schedule',
    params: { cron: '* * * * *' },
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    contracts: [],
  }
}

type BucketSpec = {
  [B in AtomContractBucket]: {
    bucket: B
    seed: () => SemanticStateBuckets[B]
  }
}

const BUCKET_FIXTURES: BucketSpec = {
  trigger: { bucket: 'trigger', seed: () => [makeTrigger()] },
  action: { bucket: 'action', seed: () => [makeAction()] },
  risk: { bucket: 'risk', seed: () => [makeRisk()] },
  positionConstraint: { bucket: 'positionConstraint', seed: () => [makePositionConstraint()] },
  orchestration: { bucket: 'orchestration', seed: () => [makeOrchestration()] },
}

describe('SemanticStateMergeService — bucket coverage invariant (#1383 Lane B)', () => {
  const merge = new SemanticStateMergeService()
  const buckets = Object.keys(BUCKET_FIXTURES) as AtomContractBucket[]

  // Issue #1383 Round 1 m6：原 expect 写在 describe 顶层会在加载阶段失败而非 it 失败。
  //   挪到独立 it() 中以遵守 Jest 模式；TS7053 仍会保留编译期 bucket 覆盖断言。
  it('BUCKET_FIXTURES 覆盖所有 AtomContractBucket', () => {
    expect([...buckets].sort()).toEqual(['action', 'orchestration', 'positionConstraint', 'risk', 'trigger'])
  })

  for (const bucket of buckets) {
    it(`preserves persisted "${bucket}" atom when derived has empty "${bucket}" array`, () => {
      const persisted = emptyState()
      ;(persisted[bucket] as unknown[]) = BUCKET_FIXTURES[bucket].seed() as unknown[]

      const derived = emptyState() // derived 的 bucket 是 []

      const merged = merge.merge({ persisted, derived })

      const mergedBucket = merged[bucket] as unknown[]
      expect(mergedBucket.length).toBeGreaterThanOrEqual(1)
    })
  }
})
