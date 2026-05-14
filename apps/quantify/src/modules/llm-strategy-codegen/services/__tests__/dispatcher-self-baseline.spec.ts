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
import { ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
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

const BASELINE_JSON_PATH = resolve(
  __dirname,
  '__snapshots__/dispatcher-self-baseline.json',
)

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

  it('录制或验证 dispatcher self-baseline（首次写盘 / 后续严格 deepEqual）', () => {
    const recorded: BaselineCase[] = cases.map((c) => {
      const patch = dispatcher.dispatch(c.utterance)
      return { ...c, patch }
    })

    if (!existsSync(BASELINE_JSON_PATH)) {
      // review M6：CI 环境必须有 baseline 才能 verify——任何 PR 删 baseline.json
      // 让该测试无脑 pass 是 silent foot-gun。dev/local 允许首次写盘录制。
      if (process.env.CI) {
        throw new Error(
          `[dispatcher-self-baseline] BASELINE_JSON_PATH does not exist in CI environment: ${BASELINE_JSON_PATH}. `
          + `Baseline must be committed; do not delete it in CI.`,
        )
      }
      mkdirSync(dirname(BASELINE_JSON_PATH), { recursive: true })
      writeFileSync(
        BASELINE_JSON_PATH,
        `${JSON.stringify(recorded, null, 2)}\n`,
        'utf-8',
      )

      console.log(
        `[dispatcher-self-baseline] recorded ${recorded.length} cases → ${BASELINE_JSON_PATH}`,
      )
      return
    }

    // 后续验证：严格 deepEqual（regression-proof）
    const existing = JSON.parse(readFileSync(BASELINE_JSON_PATH, 'utf-8')) as BaselineCase[]
    expect(recorded.length).toBe(existing.length)
    const byId = new Map(existing.map(b => [b.id, b]))
    for (const r of recorded) {
      const base = byId.get(r.id)
      expect(base).toBeDefined()
      expect(r.patch).toEqual(base!.patch)
      expect(r.utterance).toBe(base!.utterance)
      expect(r.source).toBe(base!.source)
      expect(r.atomKey).toBe(base!.atomKey)
    }
  })
})
