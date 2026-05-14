/**
 * Issue #1345 PR1.5 — Real LLM Planner Output Shape Validation (HARD GATE, opt-in)
 *
 * 跑真实 OpenAI（gpt-5.4-nano）对 9 条用户实测 + 补充策略，断言：
 *   1) LLM 返回合法 JSON
 *   2) semanticPatch.triggers[]/actions[]/risk[]/position.constraints[] 元素满足 schema：
 *        - key ∈ ATOM_CONTRACT_REGISTRY 注册表（contract.bucket 单一真相源；#1364 PR1 已删 ATOM_BUCKETS 二级表）
 *        - phase ∈ ['entry', 'exit', 'gate']（position.constraints 不校验 phase）
 *        - params 必须是 object（与 prompt "每条必填 key+phase+params" 契约一致）
 *   3) 至少有 1 个 atom 被识别（不能 triggers=[] 且 actions=[] 且 risk=[] 且 position.constraints=[]）
 *   4) 严格 fixture（U1/X1）期望两个 atom 都命中（AND）；模糊 fixture（U3/U4/U5/X2-X4）任一命中即可（OR）
 *
 * 这是 v1 plan（改 canSynthesize）证伪后真正修复（升级 planner prompt）的端到端验证：
 * v1 的 LLM 输出是 `{id, event, direction}` 自由 schema，全部被 toTriggerState
 * drop；v2 升级后应输出 `{key, phase, params}` 合规结构。
 *
 * **运行模式（opt-in）**：
 *   默认 SKIP（CI 不跑、不计费、不延时）。
 *   仅当 RUN_REAL_LLM_E2E=1 且 LLM_STRATEGY_CODEGEN_API_KEY 有效时执行。
 *   本地复跑：`RUN_REAL_LLM_E2E=1 dx test unit quantify <file>`
 *
 * 注意：本 spec 仅验证 LLM 输出 schema 合规性（prompt 层契约），不调 NestJS pipeline。
 * 完整 codegen→publication 链路验证留给 backtest/deploy 阶段的 e2e（PR2/PR3）。
 */

import { getAllRegisteredAtomKeys } from '../../atom-contracts/atom-contract-registry'
import { buildConversationPlannerSystemPrompt } from '../conversation-planner-system.prompt'

interface UserMessageFixture {
  id: string
  description: string
  message: string
  /** 任一 key 命中即视为通过（fuzzy match；用于多 atom 组合的复杂策略） */
  expectedAnyKey?: readonly string[]
  /** 所有 key 必须全部命中（strict match；用于成对入场/出场或精确组合） */
  expectedAllKeys?: readonly string[]
  expectedPhases?: readonly ('entry' | 'exit' | 'gate')[]
}

const REGISTERED_KEYS = new Set<string>(getAllRegisteredAtomKeys())
const PHASE_ENUM = new Set(['entry', 'exit', 'gate'])

const STRATEGIES: readonly UserMessageFixture[] = [
  {
    id: 'U1',
    description: 'EMA 上下穿（user-reported；entry+exit 必须成对）',
    message: 'BTC 永续，1 小时级别。EMA20 上穿 EMA50 时市价开多；EMA20 下穿 EMA50 时市价平多。',
    // strict：cross_over (entry) 和 cross_under (exit) 必须都命中
    expectedAllKeys: ['indicator.cross_over', 'indicator.cross_under'],
    expectedPhases: ['entry', 'exit'],
  },
  {
    id: 'U2',
    description: 'RSI≤30 + ATR 止损 + 回撤熔断（user-reported）',
    message: 'ETH 永续，15 分钟。RSI(14) ≤ 30 时开多，仓位的 2% ATR 作为止损，达到 3% 利润分批止盈一半；任何时刻账户回撤超过 10% 暂停开新仓。',
    expectedAnyKey: ['oscillator.rsi_lte'],
    expectedPhases: ['entry'],
  },
  {
    id: 'U3',
    description: '区间分位自适应网格（user-reported）',
    message: 'SOL 现货，30 分钟。价格在最近 24 小时区间的 0.3–0.7 分位之间运行时，启用自适应波动率网格；价格突破区间上沿则停止网格并平仓。',
    expectedAnyKey: ['price.range_position_lte', 'price.range_position_gte', 'program.adaptive_volatility_grid', 'price.breakout_up'],
  },
  {
    id: 'U4',
    description: 'BTC 现货 DCA + 加仓限制（user-reported）',
    message: 'BTC 现货，1 天级别。从今天起每周一定投 100 U；同方向加仓不超过 5 次，单笔回撤超过 8% 暂停下一次定投。',
    expectedAnyKey: ['position.dca_schedule', 'position.pyramiding_limit'],
  },
  {
    id: 'U5',
    description: '双子策略 + 敞口/回撤限额（user-reported）',
    message: '同一账户跑两条子策略：A：BTC 永续做 RSI 反转多头；B：ETH 永续做 EMA 趋势跟随。账户总敞口不超过 50%，单币种敞口不超过 30%，账户回撤 15% 全停。',
    expectedAnyKey: ['scope.subStrategy', 'portfolioRisk.symbol_exposure_cap', 'portfolioRisk.substrategy_exposure_cap', 'portfolioRisk.drawdown_block'],
  },
  {
    id: 'X1',
    description: '价格突破前 50 根 K 线 high/low（entry+exit 必须成对）',
    message: 'BTC 永续 4h，价格突破前 50 根 K 线最高点开多，破前 50 根最低点平多。',
    // strict：breakout_up (entry) 和 breakout_down (exit) 必须都命中
    expectedAllKeys: ['price.breakout_up', 'price.breakout_down'],
    expectedPhases: ['entry', 'exit'],
  },
  {
    id: 'X2',
    description: '布林上轨/中轨/下轨触碰',
    message: 'ETH 永续 1h，布林上轨触碰开空，回到中轨止盈，下轨开多。',
    expectedAnyKey: ['bollinger.touch_upper', 'bollinger.touch_middle', 'bollinger.touch_lower'],
  },
  {
    id: 'X3',
    description: '价格 1m 跌 1% + 15m 涨 2%',
    message: 'BTC 永续 5m，价格 1 分钟内跌 1% 开多，15 分钟内涨 2% 平仓，单笔仓位 10%，止损 5%/止盈 10%。',
    expectedAnyKey: ['price.percent_change'],
  },
  {
    id: 'X4',
    description: '成交量×3 + RSI>70 组合',
    message: 'SOL 永续 1h，成交量超过 24h 均量 3 倍时 + RSI > 70 时开空。',
    expectedAnyKey: ['volume.threshold', 'oscillator.rsi_gte'],
  },
]

const apiKey = process.env.LLM_STRATEGY_CODEGEN_API_KEY
const baseUrl = process.env.LLM_STRATEGY_CODEGEN_BASE_URL ?? 'https://api.openai.com'
const model = process.env.LLM_STRATEGY_CODEGEN_MODEL ?? 'gpt-5.4-nano'

const HAS_API_KEY = Boolean(apiKey) && !apiKey!.startsWith('__')
const OPT_IN = process.env.RUN_REAL_LLM_E2E === '1'
const SHOULD_RUN = HAS_API_KEY && OPT_IN

interface PlannerResponse {
  related?: boolean
  logicReady?: boolean
  assistantPrompt?: string
  semanticPatch?: {
    contextSlots?: unknown
    triggers?: unknown[]
    actions?: unknown[]
    risk?: unknown[]
    position?: unknown
  }
}

interface TriggerLike {
  key?: unknown
  phase?: unknown
  params?: unknown
}

async function callPlanner(message: string): Promise<{ raw: string, parsed: PlannerResponse | null, finishReason: string }> {
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
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`)
  }
  const json = await res.json() as { choices?: { message?: { content?: string }, finish_reason?: string }[] }
  const content = json.choices?.[0]?.message?.content ?? ''
  const finishReason = json.choices?.[0]?.finish_reason ?? 'unknown'
  let parsed: PlannerResponse | null = null
  try {
    parsed = JSON.parse(content) as PlannerResponse
  } catch {
    // leave parsed = null
  }
  return { raw: content, parsed, finishReason }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 校验单条 trigger / action / risk 元素是否符合升级后 prompt 契约。
 *
 * 契约（来自 conversation-planner-system.prompt.ts 注入段）：
 *   - key ∈ ATOM_CONTRACT_REGISTRY（注册表枚举，禁止自由文本）
 *   - phase ∈ ['entry', 'exit', 'gate']
 *   - params 必须是 object（与"每条必填 key+phase+params"一致）。
 *     `undefined` / `null` / 数组 / 原始值 均判 fail（C3 修复，与 prompt 严格一致）。
 */
function validateTriggerLike(t: TriggerLike, label: string): { ok: boolean, reasons: string[] } {
  const reasons: string[] = []
  if (typeof t.key !== 'string') reasons.push(`${label}.key 不是 string`)
  else if (!REGISTERED_KEYS.has(t.key)) reasons.push(`${label}.key='${t.key}' 不在 ATOM_CONTRACT_REGISTRY 注册表`)
  if (typeof t.phase !== 'string') reasons.push(`${label}.phase 不是 string`)
  else if (!PHASE_ENUM.has(t.phase)) reasons.push(`${label}.phase='${t.phase}' 不在 [entry,exit,gate]`)
  if (!isRecord(t.params)) reasons.push(`${label}.params 不是 object（received ${JSON.stringify(t.params)}）`)
  return { ok: reasons.length === 0, reasons }
}

if (!SHOULD_RUN) {
  describe('LLM planner real-output shape contract (issue #1345 PR1.5)', () => {
    it.skip(`SKIP — opt-in only (RUN_REAL_LLM_E2E=${OPT_IN ? '1' : 'unset'}, HAS_API_KEY=${HAS_API_KEY})`, () => {
      // 占位 it，让 SKIP 路径在 jest 输出里显式可见，避免 0-assertion 静默"绿"
    })
  })
} else {
  describe('LLM planner real-output shape contract (issue #1345 PR1.5, real LLM)', () => {
    jest.setTimeout(60_000)

    it.each(STRATEGIES)('[$id] $description → triggers/actions schema 合规', async (fx) => {
      const { raw, parsed, finishReason } = await callPlanner(fx.message)

      // 基本结构断言
      expect(parsed).not.toBeNull()
      expect(parsed!.semanticPatch).toBeDefined()

      const patch = parsed!.semanticPatch!
      const triggers = Array.isArray(patch.triggers) ? patch.triggers as TriggerLike[] : []
      const actions = Array.isArray(patch.actions) ? patch.actions as TriggerLike[] : []
      const risks = Array.isArray(patch.risk) ? patch.risk as TriggerLike[] : []
      const positionConstraints: TriggerLike[] = isRecord(patch.position) && Array.isArray((patch.position as Record<string, unknown>).constraints)
        ? ((patch.position as Record<string, unknown>).constraints as TriggerLike[])
        : []

      // 至少一条 atom 被识别（triggers / actions / risk / position.constraints 任一非空）
      const total = triggers.length + actions.length + risks.length + positionConstraints.length
      expect(total).toBeGreaterThan(0)

      // 每条 atom 满足 schema（含 position.constraints，但 positionConstraint atom 桶 phase 字段可能由 LLM 省略，宽松处理）
      const allFailures: string[] = []
      triggers.forEach((t, i) => {
        const r = validateTriggerLike(t, `triggers[${i}]`)
        if (!r.ok) allFailures.push(...r.reasons)
      })
      actions.forEach((a, i) => {
        const r = validateTriggerLike(a, `actions[${i}]`)
        if (!r.ok) allFailures.push(...r.reasons)
      })
      risks.forEach((rsk, i) => {
        const r = validateTriggerLike(rsk, `risk[${i}]`)
        if (!r.ok) allFailures.push(...r.reasons)
      })
      // position.constraints 内 atom 只校验 key（phase 在 positionConstraint 桶语义中由 atom 自身定义）
      positionConstraints.forEach((pc, i) => {
        if (typeof pc.key !== 'string') {
          allFailures.push(`position.constraints[${i}].key 不是 string`)
        } else if (!REGISTERED_KEYS.has(pc.key)) {
          allFailures.push(`position.constraints[${i}].key='${pc.key}' 不在 ATOM_CONTRACT_REGISTRY 注册表`)
        }
      })

      if (allFailures.length > 0) {
        // 把完整 raw 输出打印，便于 prompt 调优
        console.log(`\n[#1345 PR1.5] FIXTURE ${fx.id} schema 违规：`)
        for (const reason of allFailures) console.log(`  - ${reason}`)
        console.log(`  raw output (finish=${finishReason}):\n${raw}\n`)
      }
      expect(allFailures).toEqual([])

      const allKeys = [
        ...triggers.map(t => typeof t.key === 'string' ? t.key : ''),
        ...actions.map(t => typeof t.key === 'string' ? t.key : ''),
        ...risks.map(t => typeof t.key === 'string' ? t.key : ''),
        ...positionConstraints.map(t => typeof t.key === 'string' ? t.key : ''),
      ]

      // 严格模式：所有期望 key 都必须命中（U1/X1 入场+出场成对）
      if (fx.expectedAllKeys && fx.expectedAllKeys.length > 0) {
        const missing = fx.expectedAllKeys.filter(expected => !allKeys.includes(expected))
        if (missing.length > 0) {
          console.log(`\n[#1345 PR1.5] FIXTURE ${fx.id} 期望全部 key 未命中：missing ${JSON.stringify(missing)}, got ${JSON.stringify(allKeys)}`)
          console.log(`  raw output:\n${raw}\n`)
        }
        expect(missing).toEqual([])
      }

      // 宽松模式：任一期望 key 命中即可（U3/U4/U5/X2-X4 多 atom 组合）
      if (fx.expectedAnyKey && fx.expectedAnyKey.length > 0) {
        const matched = fx.expectedAnyKey.some(expected => allKeys.includes(expected))
        if (!matched) {
          console.log(`\n[#1345 PR1.5] FIXTURE ${fx.id} 期望 key 未命中：expected any of ${JSON.stringify(fx.expectedAnyKey)}, got ${JSON.stringify(allKeys)}`)
          console.log(`  raw output:\n${raw}\n`)
        }
        expect(matched).toBe(true)
      }

      // phase 范围（如指定）
      if (fx.expectedPhases && fx.expectedPhases.length > 0) {
        const phases = new Set(triggers.map(t => t.phase as string).filter(Boolean))
        for (const expectedPhase of fx.expectedPhases) {
          expect(phases.has(expectedPhase)).toBe(true)
        }
      }
    })
  })
}
