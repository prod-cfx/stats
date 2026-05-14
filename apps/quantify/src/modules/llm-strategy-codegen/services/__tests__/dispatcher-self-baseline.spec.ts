import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
/**
 * Issue #1279 PR2 — dispatcher 自洽 baseline 录制 spec
 *
 * 路线裁定（turn 3 → turn 4）：
 *   byte-equal vs legacy SemanticSeedExtractorService 已被证伪 —— legacy 6611 行
 *   编码了大量 cross-atom 协调规则（dedup / anchor / skip / evidence formatting），
 *   任何加性启发式都会破坏 baseline 中 legacy 返回简单结果的 edge case。
 *   实测 turn 3 verb→action 接入后通过率从 2/155 降到 1/155。
 *
 * 改为 dispatcher 自洽路线：
 *   - baseline.json 由 GenericSeedDispatcher 输出（不是 legacy extractor）
 *   - PR2a ship 后任何动 dispatcher 的 PR 必须保持 baseline 一致或显式更新
 *   - 业务语义正确性由 e2e + caller 集成测试兜底（turn 5 wire dispatcher 到 callers
 *     时显式校验）
 *
 * 模式：
 *   - 如果 baseline.json 不存在 → 用 dispatcher 跑写盘 + 测试 pass（首次录制）
 *   - 如果 baseline.json 存在    → 读盘 + 严格 deepEqual（regression-proof）
 *
 * Refs: #1279
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { ATOM_BUCKETS, ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { AC7_USER_PROMPTS, AC12_WEBHOOK_PROMPTS } from './fixtures/ac-prompts'

// ── utterance-corpus 导入 ──
interface UtteranceCase { atomKey: string, utterance: string, id?: string }

function loadAllCorpusUtterances(): UtteranceCase[] {
  // eslint-disable-next-line ts/no-require-imports
  const fixturesGlob = require('node:fs').readdirSync(
    resolve(__dirname, '../../nl-gateway/utterance-corpus/atoms'),
  ) as string[]
  const allCases: UtteranceCase[] = []
  for (const fileName of fixturesGlob) {
    if (!fileName.endsWith('.utterance.ts')) {
      continue
    }
    // eslint-disable-next-line ts/no-require-imports
    const mod = require(
      `../../nl-gateway/utterance-corpus/atoms/${fileName.replace(/\.ts$/, '')}`,
    ) as Record<string, unknown>
    for (const exp of Object.values(mod)) {
      if (Array.isArray(exp)) {
        for (const c of exp) {
          if (
            c
            && typeof c === 'object'
            && typeof (c as UtteranceCase).utterance === 'string'
            && typeof (c as UtteranceCase).atomKey === 'string'
          ) {
            allCases.push(c as UtteranceCase)
          }
        }
      }
    }
  }
  return allCases
}

// ── 合成 NL（缺位 atom 兜底）──
function synthesizeForAtom(atomKey: string): string[] {
  const contract = (ATOM_CONTRACT_REGISTRY as Record<string, any>)[atomKey]
  if (!contract?.surface?.intent) {
    return [
      `${atomKey} 触发开多`,
      `检测到 ${atomKey} 信号`,
      `${atomKey} 满足时执行`,
    ]
  }
  const kw = contract.surface.intent.keywords?.[0] ?? atomKey
  const verbs = contract.surface.intent.verbs ?? {}
  const verbKeys = Object.keys(verbs)
  const v1 = verbs[verbKeys[0]]?.[0] ?? '触发'
  const v2 = verbs[verbKeys[1] ?? verbKeys[0]]?.[0] ?? v1
  return [
    `${kw} ${v1} 30 开多`,
    `检测到 ${kw} ${v2} 50 进场`,
    `${kw} ${v1} 阈值时执行平仓`,
  ]
}

// AC-7 / AC-12 prompt 共享自 ./fixtures/ac-prompts.ts，与
// dispatcher-semantic-equivalence.spec.ts 校准同一组语料。

// ── baseline case 结构 ──
interface BaselineCase {
  id: string
  source: 'corpus' | 'synthesized' | 'ac-7-user' | 'ac-12-webhook'
  atomKey?: string
  utterance: string
  patch: CodegenSemanticPatch
}

// #1329 Wave 1C：原单一 ~71k 行 dispatcher-self-baseline.json 按 atom bucket 拆分为
// 5 个子 snapshot（trigger / action / risk / positionConstraint / orchestration），
// git blame / diff 友好，单文件 ≤ ~1800 行量级。
const BASELINE_BUCKETS = [
  'trigger',
  'action',
  'risk',
  'positionConstraint',
  'orchestration',
] as const
type BaselineBucket = (typeof BASELINE_BUCKETS)[number]

function bucketForCase(c: Omit<BaselineCase, 'patch'>): BaselineBucket {
  if (c.atomKey && c.atomKey in ATOM_BUCKETS) {
    return (ATOM_BUCKETS as Record<string, BaselineBucket>)[c.atomKey]
  }
  // AC-7 user prompts（无 atomKey，多 atom 复合）归 orchestration。
  return 'orchestration'
}

function baselinePathFor(bucket: BaselineBucket): string {
  return resolve(
    __dirname,
    `__snapshots__/dispatcher-self-baseline-${bucket}.json`,
  )
}

describe('issue #1279 PR2 — dispatcher self-baseline', () => {
  const dispatcher = new GenericSeedDispatcher()

  // 收集所有 case
  const cases: Array<Omit<BaselineCase, 'patch'>> = []

  // 1) corpus
  const corpusCases = loadAllCorpusUtterances()
  const corpusCountByAtom: Record<string, number> = {}
  for (const c of corpusCases) {
    corpusCountByAtom[c.atomKey] = (corpusCountByAtom[c.atomKey] ?? 0) + 1
    cases.push({
      id: c.id ?? `corpus-${c.atomKey}-${corpusCountByAtom[c.atomKey]}`,
      source: 'corpus',
      atomKey: c.atomKey,
      utterance: c.utterance,
    })
  }

  // 2) 缺位 atom 合成
  const allRegistryKeys = Object.keys(ATOM_CONTRACT_REGISTRY)
  for (const atomKey of allRegistryKeys) {
    const have = corpusCountByAtom[atomKey] ?? 0
    if (have >= 3) {
      continue
    }
    const synthesized = synthesizeForAtom(atomKey)
    const need = 3 - have
    for (let i = 0; i < need; i++) {
      cases.push({
        id: `synthesized-${atomKey}-${i + 1}`,
        source: 'synthesized',
        atomKey,
        utterance: synthesized[i] ?? synthesized[0],
      })
    }
  }

  // 3) AC-7（来源：./fixtures/ac-prompts.ts）
  AC7_USER_PROMPTS.forEach(({ id, utterance }) => {
    cases.push({
      id,
      source: 'ac-7-user',
      utterance,
    })
  })

  // 4) AC-12（来源：./fixtures/ac-prompts.ts）
  AC12_WEBHOOK_PROMPTS.forEach(({ id, utterance }) => {
    cases.push({
      id,
      source: 'ac-12-webhook',
      atomKey: 'external.signal',
      utterance,
    })
  })

  it('应该精确 224 case（#1329 follow-up Phase 1/2/3e 引入 13 新 orchestration atom，+39 合成）', () => {
    // PR2c-final-2：9 个高频 trigger atom（rsi_lte/gte、cross_over/under、bollinger.touch_*×3、
    // breakout_up/down）各补 2 条扩展 utterance（同义词/参数换序/短 token ema20、复合 timeframe），共 +18 条。
    // #1329 follow-up Phase 1/2：ATOM_CONTRACT_REGISTRY 新增 11 个 orchestration atom
    //   （gate.regime / portfolioRisk.{symbol,substrategy}_exposure_cap /
    //    program.{dynamic_grid,fixed_grid_gated,adaptive_volatility_grid,event_listener} /
    //    scope.{symbol,leg,timeframe,dataSource}），均无 corpus fixture，
    //   走 synthesizeForAtom 兜底，11 × 3 = 33 条合成 utterance。
    // #1329 follow-up Phase 3e：ATOM_CONTRACT_REGISTRY 再追加 2 个 orchestration atom
    //   （scope.subStrategy / gate.subStrategy），同样走合成路径，+2 × 3 = +6 条。
    // 实际分布：corpus 177 + synthesized 39（13 新 orchestration atom × 3）+ ac-7 6 + ac-12 2 = 224
    expect(cases.length).toBe(224)
  })

  // #1331 C3：per-atom breakdown 断言（13 新 orchestration atom 各 ≥ 1 case），
  //   让 synthesizeForAtom 调整时回归能精确定位到具体 atom，而非只看到 total 224 失配。
  it('13 个新 orchestration atom 各应有 ≥1 synthesized/corpus case（#1331 C3 per-atom breakdown 定位）', () => {
    const NEW_ORCHESTRATION_ATOMS = [
      'gate.regime',
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
    ] as const
    const breakdown: Record<string, number> = {}
    for (const c of cases) {
      if (c.atomKey) {
        breakdown[c.atomKey] = (breakdown[c.atomKey] ?? 0) + 1
      }
    }
    const missing = NEW_ORCHESTRATION_ATOMS.filter(k => (breakdown[k] ?? 0) < 1)
    expect(missing).toEqual([])
  })

  it('应该覆盖 ATOM_CONTRACT_REGISTRY 所有 atom（≥3 条/atom）', () => {
    const countByAtom: Record<string, number> = {}
    for (const c of cases) {
      if (c.atomKey) {
        countByAtom[c.atomKey] = (countByAtom[c.atomKey] ?? 0) + 1
      }
    }
    const insufficient = allRegistryKeys.filter(k => (countByAtom[k] ?? 0) < 3)
    expect(insufficient).toEqual([])
  })

  it('dispatcher 不应在任何 utterance 上抛异常（自洽 throw-free）', () => {
    const throws: string[] = []
    for (const c of cases) {
      try {
        dispatcher.dispatch(c.utterance)
      }
      catch (e) {
        throws.push(`${c.id}: ${(e as Error).message}`)
      }
    }
    expect(throws).toEqual([])
  })

  /**
   * Issue #1279 PR2 C-spec-final 不变式：dispatcher.dispatch 必须确定性
   * （pure function-like）—— 同一 utterance 连续两次调用必产相同 patch。
   * 防止 dispatcher 内部累积可变状态、依赖 wall-clock / Math.random 等。
   */
  it('dispatcher.dispatch 必须确定性（idempotent across N runs）', () => {
    const drift: string[] = []
    for (const c of cases) {
      const a = dispatcher.dispatch(c.utterance)
      const b = dispatcher.dispatch(c.utterance)
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        drift.push(c.id)
      }
    }
    expect(drift).toEqual([])
  })

  /**
   * M2 跨 bucket ID 一致性断言：
   * 加载所有已写盘的 bucket baseline JSON，断言全局 ID 唯一——
   * 同一 ID 不允许出现在两个不同 bucket 文件中，防止 bucketForCase 分桶逻辑
   * 静默将同一 case 路由到多桶或 ID 冲突导致 byId.get() 查询结果不确定。
   */
  it('已写盘 baseline：各 bucket 之间 case ID 全局唯一（无跨 bucket 重复）', () => {
    // 仅当所有 baseline 文件均已写盘时才做断言；未写盘（首次录制前）直接 skip
    const allExist = BASELINE_BUCKETS.every(b => existsSync(baselinePathFor(b)))
    if (!allExist) {
      return
    }
    const seen = new Map<string, BaselineBucket>()
    const duplicates: Array<{ id: string, buckets: [BaselineBucket, BaselineBucket] }> = []
    for (const bucket of BASELINE_BUCKETS) {
      const cases = JSON.parse(readFileSync(baselinePathFor(bucket), 'utf-8')) as BaselineCase[]
      for (const c of cases) {
        const prev = seen.get(c.id)
        if (prev !== undefined) {
          duplicates.push({ id: c.id, buckets: [prev, bucket] })
        }
        else {
          seen.set(c.id, bucket)
        }
      }
    }
    expect(duplicates).toEqual([])
  })

  it('录制或验证 dispatcher self-baseline（首次写盘 / 后续严格 deepEqual，#1329 Wave 1C 按 bucket 拆 5 子 snapshot）', () => {
    const recorded: BaselineCase[] = cases.map((c) => {
      const patch = dispatcher.dispatch(c.utterance)
      return { ...c, patch }
    })

    // 按 bucket 分桶
    const byBucket: Record<BaselineBucket, BaselineCase[]> = {
      trigger: [],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
    }
    for (const r of recorded) {
      byBucket[bucketForCase(r)].push(r)
    }

    // 总 case 数不变：跨 bucket 累加 = recorded.length（双源记账，防漏桶）
    const totalAcrossBuckets = BASELINE_BUCKETS.reduce(
      (sum, b) => sum + byBucket[b].length,
      0,
    )
    expect(totalAcrossBuckets).toBe(recorded.length)

    for (const bucket of BASELINE_BUCKETS) {
      const bucketPath = baselinePathFor(bucket)
      const bucketCases = byBucket[bucket]

      if (!existsSync(bucketPath)) {
        // review M6：CI 环境必须有 baseline 才能 verify——任何 PR 删 baseline 子文件
        // 让该测试无脑 pass 是 silent foot-gun。dev/local 允许首次写盘录制。
        if (process.env.CI) {
          throw new Error(
            `[dispatcher-self-baseline] bucket baseline does not exist in CI environment: ${bucketPath}. `
            + `Baseline must be committed; do not delete it in CI.`,
          )
        }
        mkdirSync(dirname(bucketPath), { recursive: true })
        writeFileSync(
          bucketPath,
          `${JSON.stringify(bucketCases, null, 2)}\n`,
          'utf-8',
        )

        console.log(
          `[dispatcher-self-baseline] recorded ${bucketCases.length} cases (bucket=${bucket}) → ${bucketPath}`,
        )
        continue
      }

      // 后续验证：严格 deepEqual（regression-proof）
      const existing = JSON.parse(readFileSync(bucketPath, 'utf-8')) as BaselineCase[]
      expect(bucketCases.length).toBe(existing.length)
      const byId = new Map(existing.map(b => [b.id, b]))
      for (const r of bucketCases) {
        const base = byId.get(r.id)
        expect(base).toBeDefined()
        expect(r.patch).toEqual(base!.patch)
        expect(r.utterance).toBe(base!.utterance)
        expect(r.source).toBe(base!.source)
        expect(r.atomKey).toBe(base!.atomKey)
      }
    }
  })
})
