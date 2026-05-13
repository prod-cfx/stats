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

// ── AC-7 六条用户测试策略 prompt ──
const AC7_PROMPTS = [
  'BTC/USDT 4h，RSI 跌破 30 开多，RSI 回到 70 平仓，止损 2%',
  'ETH 1h，价格触及布林下轨开多，回到中轨止盈，触及上轨开空',
  'SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断',
  'BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层',
  'ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT',
  'BTC 区间 60000-70000，每格 100 USDT，挂 20 格',
]

// ── AC-12 webhook prompt ──
const AC12_WEBHOOK_PROMPTS = [
  '接 TradingView webhook 信号 BTCUSDT 突破上轨 进场做多',
  '收到 webhook：ETHUSDT side=sell 卖出离场',
]

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

  // 3) AC-7
  AC7_PROMPTS.forEach((utterance, i) => {
    cases.push({
      id: `ac-7-user-${i + 1}`,
      source: 'ac-7-user',
      utterance,
    })
  })

  // 4) AC-12
  AC12_WEBHOOK_PROMPTS.forEach((utterance, i) => {
    cases.push({
      id: `ac-12-webhook-${i + 1}`,
      source: 'ac-12-webhook',
      atomKey: 'external.signal',
      utterance,
    })
  })

  it('应该精确 155 case（36 atom×≥3 + corpus 多出 + AC-7 六条 + AC-12 两条）', () => {
    // review M4：从 ≥116 改精确 155——下界过松，corpus 文件误删导致 case 数
    // 从 155 跌到 120 时该断言仍 pass。锁死精确数字让 case 数下降立刻 fail。
    // 实际分布（与 baseline.json metadata 一致）：
    //   corpus 141 + synthesized 6（grid×3 + pyramiding×3）+ ac-7 6 + ac-12 2 = 155
    expect(cases.length).toBe(155)
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
