/**
 * Issue #1345 follow-up — Required Slot Fill Diagnostic
 *
 * 跑真实 OpenAI 对 5 条用户策略，把每个返回 atom 的 params 对照
 * ATOM_CONTRACT_REGISTRY[key].surface.paramSlots 的 required slot 集合，
 * 报告：
 *   - 每个 atom 的 required slot 是否被 LLM 填充
 *   - 全填 → reducer 会 lock，对话不会再追问该 atom
 *   - 缺填 → trigger 进 open 状态，对话需要多轮才能 lock
 *
 * 该 spec 不是回归门禁，是诊断用。opt-in via RUN_REAL_LLM_E2E=1。
 * 完整 raw JSON 落盘到 /tmp/issue-1345-diag/<id>.json，便于事后人工分析。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { ATOM_BUCKETS, ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import { buildConversationPlannerSystemPrompt } from '../conversation-planner-system.prompt'

interface UserMessageFixture {
  id: string
  description: string
  message: string
}

const STRATEGIES: readonly UserMessageFixture[] = [
  { id: 'U1', description: 'EMA 上下穿', message: 'BTC 永续，1 小时级别。EMA20 上穿 EMA50 时市价开多；EMA20 下穿 EMA50 时市价平多。' },
  { id: 'U2', description: 'RSI≤30 + ATR 止损 + 回撤熔断', message: 'ETH 永续，15 分钟。RSI(14) ≤ 30 时开多，仓位的 2% ATR 作为止损，达到 3% 利润分批止盈一半；任何时刻账户回撤超过 10% 暂停开新仓。' },
  { id: 'U3', description: '区间分位自适应网格', message: 'SOL 现货，30 分钟。价格在最近 24 小时区间的 0.3–0.7 分位之间运行时，启用自适应波动率网格；价格突破区间上沿则停止网格并平仓。' },
  { id: 'U4', description: 'BTC 现货 DCA + 加仓限制', message: 'BTC 现货，1 天级别。从今天起每周一定投 100 U；同方向加仓不超过 5 次，单笔回撤超过 8% 暂停下一次定投。' },
  { id: 'U5', description: '双子策略 + 敞口/回撤限额', message: '同一账户跑两条子策略：A：BTC 永续做 RSI 反转多头；B：ETH 永续做 EMA 趋势跟随。账户总敞口不超过 50%，单币种敞口不超过 30%，账户回撤 15% 全停。' },
]

const apiKey = process.env.LLM_STRATEGY_CODEGEN_API_KEY
const baseUrl = process.env.LLM_STRATEGY_CODEGEN_BASE_URL ?? 'https://api.openai.com'
const model = process.env.LLM_STRATEGY_CODEGEN_MODEL ?? 'gpt-5.4-nano'

const HAS_API_KEY = Boolean(apiKey) && !apiKey!.startsWith('__')
const OPT_IN = process.env.RUN_REAL_LLM_E2E === '1'
const SHOULD_RUN = HAS_API_KEY && OPT_IN

const OUT_DIR = '/tmp/issue-1345-diag'

interface PlannerResponse {
  semanticPatch?: {
    triggers?: unknown[]
    actions?: unknown[]
    risk?: unknown[]
    position?: unknown
  }
}

interface AtomEntry {
  key: string
  phase?: unknown
  params: Record<string, unknown>
  source: string
}

async function callPlanner(message: string): Promise<{ raw: string, parsed: PlannerResponse | null }> {
  const systemPrompt = buildConversationPlannerSystemPrompt('zh')
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_completion_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ message, currentSemanticState: { triggers: [], actions: [], risk: [], position: null, contextSlots: {} }, history: [] }) },
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json() as { choices?: { message?: { content?: string } }[] }
  const content = json.choices?.[0]?.message?.content ?? ''
  let parsed: PlannerResponse | null = null
  try { parsed = JSON.parse(content) as PlannerResponse } catch {}
  return { raw: content, parsed }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function extractAtoms(parsed: PlannerResponse | null): AtomEntry[] {
  if (!parsed?.semanticPatch) return []
  const p = parsed.semanticPatch
  const out: AtomEntry[] = []
  const collect = (arr: unknown[] | undefined, src: string) => {
    if (!Array.isArray(arr)) return
    for (const item of arr) {
      if (!isRecord(item)) continue
      const key = typeof item.key === 'string' ? item.key : null
      if (!key) continue
      out.push({ key, phase: item.phase, params: isRecord(item.params) ? item.params : {}, source: src })
    }
  }
  collect(p.triggers, 'triggers')
  collect(p.actions, 'actions')
  collect(p.risk, 'risk')
  if (isRecord(p.position) && Array.isArray(p.position.constraints)) {
    collect(p.position.constraints as unknown[], 'position.constraints')
  }
  return out
}

function getRequiredSlots(atomKey: string): string[] {
  if (!(atomKey in ATOM_BUCKETS)) return []
  const contract = (ATOM_CONTRACT_REGISTRY as Record<string, { surface?: { paramSlots?: Record<string, { required?: boolean }> } }>)[atomKey]
  const slots = contract?.surface?.paramSlots
  if (!slots) return []
  return Object.entries(slots).filter(([, s]) => s.required === true).map(([n]) => n)
}

interface AtomAnalysis {
  source: string
  key: string
  registered: boolean
  required: string[]
  filled: string[]
  missing: string[]
  willLock: boolean
}

function analyze(atom: AtomEntry): AtomAnalysis {
  const registered = atom.key in ATOM_BUCKETS
  const required = getRequiredSlots(atom.key)
  const filled = required.filter(s => atom.params[s] !== undefined && atom.params[s] !== null && atom.params[s] !== '')
  const missing = required.filter(s => !filled.includes(s))
  return {
    source: atom.source,
    key: atom.key,
    registered,
    required,
    filled,
    missing,
    willLock: registered && missing.length === 0,
  }
}

if (!SHOULD_RUN) {
  describe('LLM planner required-slot fill diagnostic (issue #1345 follow-up)', () => {
    it.skip(`SKIP — opt-in only (RUN_REAL_LLM_E2E=${OPT_IN ? '1' : 'unset'}, HAS_API_KEY=${HAS_API_KEY})`, () => {})
  })
} else {
  describe('LLM planner required-slot fill diagnostic (real LLM)', () => {
    jest.setTimeout(60_000)

    beforeAll(() => {
      fs.mkdirSync(OUT_DIR, { recursive: true })
    })

    it.each(STRATEGIES)('[$id] $description → 落盘 raw + required slot 报告', async (fx) => {
      const { raw, parsed } = await callPlanner(fx.message)
      fs.writeFileSync(path.join(OUT_DIR, `${fx.id}.json`), JSON.stringify({ id: fx.id, raw, parsed }, null, 2))

      const atoms = extractAtoms(parsed)
      const analyses = atoms.map(analyze)
      const willLockCount = analyses.filter(a => a.willLock).length

      const report = [
        '',
        `═══ ${fx.id} ${fx.description} ═══`,
        `识别 atom 数: ${atoms.length}    可直接 lock: ${willLockCount}    需多轮追问: ${atoms.length - willLockCount}`,
        '',
        `${'source'.padEnd(22)} ${'key'.padEnd(40)} ${'reg'.padEnd(4)} ${'required'.padEnd(30)} ${'missing'.padEnd(30)} lock`,
      ]
      for (const a of analyses) {
        report.push(
          `${a.source.padEnd(22)} ${a.key.padEnd(40)} ${(a.registered ? 'Y' : 'N').padEnd(4)} ${(a.required.join(',') || '-').padEnd(30)} ${(a.missing.join(',') || '-').padEnd(30)} ${a.willLock ? 'YES' : 'NO'}`,
        )
      }
      console.log(report.join('\n'))
      // 不做硬断言；本 spec 是诊断报告
      expect(parsed).not.toBeNull()
    })

    afterAll(() => {
      console.log(`\n[#1345 diag] raw outputs persisted under ${OUT_DIR}/`)
    })
  })
}
