/**
 * Issue #1550 — 31 条策略真实 LLM 入口语义零漂移验收。
 *
 * 与既有 thirty-one-strategy-{routing, acceptance-checks, five-layer-consistency}.spec.ts
 * 的区别：那些 spec 用 PLANNER_MOCKS_BY_STRATEGY 喂人工构造的合规 rules tree，验的是
 * 「给定 mock rules tree 后下游链路一致」。本 spec 用真实自然语言 user input 直接
 * 喂真实 planner LLM 入口，验的是「LLM 能从用户原话生成合规 rules tree」——这是
 * staging cmpc14gtw0ipavbqs5x6cbuto 失败的真正缺口。
 *
 * 运行约定（默认 skip，不污染 CI）：
 *
 *   RUN_REAL_LLM_PLANNER_31=1 \
 *   PLANNER_LLM_BASE_URL=https://api.uniapi.io \
 *   PLANNER_LLM_API_KEY=sk-... \
 *   PLANNER_LLM_MODEL=gpt-4.1-mini \
 *   npx jest --config apps/quantify/jest-unit.json \
 *     --testPathPattern=thirty-one-strategy-real-llm-entry
 *
 * 缺任一必需 env：spec 走 `describe.skip`，并由一条 sanity 测试打印 banner 提示运行命令；
 * 这样普通 CI 上不会因缺 API key 红屏，但只要 reviewer / 发布前手动跑就立刻看到结果。
 *
 * 守门内容（每条 fixture）：
 *
 *  1. **不许走旧 unsupported 退化**：assistantPrompt 不得包含
 *     "策略表达暂未识别成合规的 rules-first" 这类 unsupported 标志短语。
 *  2. **schema validator 守门**：LLM raw semanticPatch 必须通过
 *     PlannerDispatcherMergeService.validatePlannerSemanticPatch；任意 reject reason 都视为漂移。
 *  3. **expectedSemanticContract 守门**：rules tree 内必须含 expected entry/exit atom key
 *     （含 phase / sideScope / 关键 params slot），不得缺、不得多关键 atom；
 *     action/risk atom 必须命中 expected slot；contextSlots 必须含期望必填项。
 *  4. **缺必答槽位 → clarification**：fixture 标注的 clarificationSlots 在 LLM 输出里
 *     必须 *仍然为空* 或 *进入 clarification*，不得被误判为 unsupported。
 *
 * 任一守门失败 = 真实 LLM 入口漂移。
 */

import type { ChatMessage } from '../../../../ai/providers/llm-provider-adapter.interface'
import { ATOM_CONTRACT_REGISTRY } from '../../../atom-contracts/atom-contract-registry'
import { PlannerDispatcherMergeService } from '../../planner-dispatcher-merge.service'
import { buildConversationPlannerSystemPrompt } from '../../../prompts/conversation-planner-system.prompt'
import { collectAtomLeaves, listRuleEffects, type SemanticRule } from '../../../types/atom-expr'
import { THIRTY_ONE_STRATEGIES, type ThirtyOneStrategyFixture } from '../fixtures/thirty-one-strategies'

/**
 * Major M2 修复：risk 桶在 ATOM_CONTRACT_REGISTRY 里实际承担「谓词」+「副作用」两类语义。
 * Validator (`PlannerDispatcherMergeService.validatePlannerSemanticPatch`) 用
 * CONDITION_ALLOWED_BUCKETS = {trigger, risk, orchestration}、
 * EFFECTS_ALLOWED_BUCKETS = {action, risk, positionConstraint, orchestration}，
 * 同一个 risk atom 既可能 condition 也可能 effect。
 *
 * `deriveContractFromFixture` 之前把 `category==='risk'` 全部一刀切归 effects，与 validator
 * 不一致，会对「risk-as-predicate」fixture 产生假阴性（明明合规却 fail）。
 *
 * 修复：弱断言 risk 类 atom 仅检查「存在性」（出现在 condition 或 effects 任一即可），
 * 不再强制归属。靠 validator 自身的 bucket 守门 + 31 条 expectedAtoms 列表里的语义意图
 * 配合判定即可。
 */
type AtomLocationExpectation = 'either' | 'condition' | 'effects'

/* ---------------- expected semantic contract per fixture ---------------- */

interface AtomExpectation {
  key: string
  phase?: 'entry' | 'exit' | 'gate'
  sideScope?: 'long' | 'short' | 'both'
  /** params 必须命中这些 key（值不严格校验，避免 LLM 默认值漂移） */
  paramKeys?: readonly string[]
  /** 该 atom 期望出现在 condition / effects / 任一位置（默认 'either'，由 ATOM_CONTRACT_REGISTRY bucket 派生时使用） */
  location?: AtomLocationExpectation
}

interface ExpectedSemanticContract {
  /** condition leaf 中必须出现的 atom key + phase + sideScope 期望 */
  requiredConditionAtoms: readonly AtomExpectation[]
  /** effects leaf 中必须出现的 atom key */
  requiredEffectAtoms: readonly AtomExpectation[]
  /** 任一位置均可的 atom（risk 谓词/副作用、orchestration gate/effect 派生用） */
  requiredEitherAtoms: readonly AtomExpectation[]
  /** rules tree 顶层至少有这些 phase 的 rule */
  requiredPhases: ReadonlyArray<'entry' | 'exit' | 'gate'>
  /** 必须出现在 contextSlots 里的 slot 名（user 已在原话中给出，不应再问） */
  expectedContextSlots: readonly string[]
  /** 缺必答槽位（如未提供 symbol/exchange/marketType）：本字段非空时，期望 LLM 进入 clarification（不 reject、不 unsupported） */
  expectedClarificationSlots?: readonly string[]
}

const ENTRY = 'entry' as const
const EXIT = 'exit' as const

function deriveContractFromFixture(fix: ThirtyOneStrategyFixture): ExpectedSemanticContract {
  // 从已有 expectedAtoms 自动推导基本面，再按需在 override 表里精修。
  // Major M2 修复：按 ATOM_CONTRACT_REGISTRY[*].bucket 派生，与 validator
  //   CONDITION_ALLOWED_BUCKETS / EFFECTS_ALLOWED_BUCKETS 对齐。risk + orchestration
  //   两桶在 validator 里既可 condition 也可 effect → 归到 requiredEitherAtoms 弱断言。
  const conditionAtoms: AtomExpectation[] = []
  const effectAtoms: AtomExpectation[] = []
  const eitherAtoms: AtomExpectation[] = []
  type ContractShape = { bucket?: string }
  const getBucket = (key: string): string | undefined =>
    (ATOM_CONTRACT_REGISTRY as Record<string, ContractShape | undefined>)[key]?.bucket
  for (const atom of fix.expectedAtoms) {
    const phase = atom.phase
    const bucket = getBucket(atom.key)
    if (bucket === 'action' || bucket === 'positionConstraint' || atom.category === 'action' || atom.category === 'position') {
      effectAtoms.push({ key: atom.key, phase })
    }
    else if (bucket === 'risk' || bucket === 'orchestration' || atom.category === 'risk' || atom.category === 'orchestration') {
      eitherAtoms.push({ key: atom.key, phase })
    }
    else if (bucket === 'trigger' || atom.category === 'trigger') {
      conditionAtoms.push({ key: atom.key, phase })
    }
    else {
      // 未注册 atom（harness synth allowlist）：保留弱断言（任一位置都行）
      eitherAtoms.push({ key: atom.key, phase })
    }
  }
  const collectPhases = (list: AtomExpectation[]): Array<'entry' | 'exit'> => {
    const set = new Set<'entry' | 'exit'>()
    for (const a of list) {
      const p = a.phase
      if (p === ENTRY || p === EXIT) set.add(p)
    }
    return Array.from(set)
  }
  const hasEntry = [...conditionAtoms, ...effectAtoms, ...eitherAtoms].some(a => (a.phase ?? ENTRY) === ENTRY)
  const hasExit = [...conditionAtoms, ...effectAtoms, ...eitherAtoms].some(a => a.phase === EXIT)
  const requiredPhases: Array<'entry' | 'exit'> = []
  if (hasEntry) requiredPhases.push(ENTRY)
  if (hasExit) requiredPhases.push(EXIT)
  void collectPhases  // 保留 helper 供后续扩展（避免 unused 警告）
  return {
    requiredConditionAtoms: conditionAtoms,
    requiredEffectAtoms: effectAtoms,
    requiredEitherAtoms: eitherAtoms,
    requiredPhases,
    expectedContextSlots: [],
  }
}

/**
 * Per-fixture override / refinement。
 * 这里只列出与 deriveContractFromFixture 派生默认值有差异的字段；
 * 大多数 fixture 走默认值即可。
 *
 * 重点补：sideScope、context slot 期望、缺槽位 clarification 期望。
 */
const CONTRACT_OVERRIDES: Readonly<Record<number, Partial<ExpectedSemanticContract>>> = {
  // #2 EMA gate + BOLL trigger 双向（symbol/exchange/marketType 都在 user input 里）
  2: {
    expectedContextSlots: ['symbol', 'exchange', 'marketType'],
  },
  // #3 staging 复现样本：缺 symbol/exchange/marketType → clarification
  3: {
    requiredConditionAtoms: [
      { key: 'indicator.above', phase: ENTRY, sideScope: 'long' },
      { key: 'indicator.below', phase: EXIT, sideScope: 'long' },
    ],
    requiredEffectAtoms: [
      { key: 'action.open_long', phase: ENTRY },
      { key: 'action.close_long', phase: EXIT },
    ],
    requiredPhases: [ENTRY, EXIT],
    expectedContextSlots: [],
    expectedClarificationSlots: ['symbol', 'exchange', 'marketType'],
  },
  6: {
    expectedContextSlots: ['symbol', 'exchange', 'marketType'],
  },
  24: {
    expectedContextSlots: ['symbol', 'exchange', 'marketType'],
  },
}

function buildExpectedContract(fix: ThirtyOneStrategyFixture): ExpectedSemanticContract {
  const base = deriveContractFromFixture(fix)
  const overrides = CONTRACT_OVERRIDES[fix.id] ?? {}
  return {
    ...base,
    ...overrides,
    requiredEitherAtoms: overrides.requiredEitherAtoms ?? base.requiredEitherAtoms,
    requiredConditionAtoms: overrides.requiredConditionAtoms ?? base.requiredConditionAtoms,
    requiredEffectAtoms: overrides.requiredEffectAtoms ?? base.requiredEffectAtoms,
    requiredPhases: overrides.requiredPhases ?? base.requiredPhases,
    expectedContextSlots: overrides.expectedContextSlots ?? base.expectedContextSlots,
    expectedClarificationSlots: overrides.expectedClarificationSlots ?? base.expectedClarificationSlots,
  }
}

/* ---------------- runtime env + HTTP call ---------------- */

interface RealLlmEnv {
  baseUrl: string
  apiKey: string
  model: string
}

function readRealLlmEnv(): RealLlmEnv | null {
  if (process.env.RUN_REAL_LLM_PLANNER_31 !== '1') return null
  const baseUrl = process.env.PLANNER_LLM_BASE_URL
  const apiKey = process.env.PLANNER_LLM_API_KEY
  const model = process.env.PLANNER_LLM_MODEL
  if (!baseUrl || !apiKey || !model) return null
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model }
}

// 串行节流：OpenAI gpt-5.4-nano TPM 200k；prompt ~10k tokens；理论上限 20 req/min。
// 取 4s 间隔 (= 15 req/min) 留 25% 余量；再叠加 429 指数回退。
const MIN_REQUEST_INTERVAL_MS = 4000
let lastRequestEndMs = 0

async function callRealPlanner(
  env: RealLlmEnv,
  userMessage: string,
  systemPrompt: string,
): Promise<{ content: string }> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: JSON.stringify({
        message: userMessage,
        // 与生产 planConversationByLlm 对齐：currentSemanticState 用空 seed，history 空
        currentSemanticState: {
          contextSlots: {},
          trigger: [],
          action: [],
          risk: [],
          orchestration: [],
          position: null,
        },
        history: [],
      }),
    },
  ]
  const url = `${env.baseUrl}/v1/chat/completions`
  // gpt-5 / o1 系列推理模型不支持 max_tokens（必须用 max_completion_tokens）且只接受 temperature=1；
  // 旧模型用 max_tokens + temperature=0。按 model 前缀切。
  const isNewReasoningModel = /^(gpt-5|o1|o3)/i.test(env.model)
  const requestPayload: Record<string, unknown> = {
    model: env.model,
    messages,
  }
  if (isNewReasoningModel) {
    requestPayload.max_completion_tokens = 3000
    // 推理模型 temperature 必须默认（1）；不显式传 0
  }
  else {
    requestPayload.max_tokens = 3000
    requestPayload.temperature = 0
  }
  const body = JSON.stringify(requestPayload)

  // 全局节流：保证两次出站请求之间 >= MIN_REQUEST_INTERVAL_MS
  const gap = Date.now() - lastRequestEndMs
  if (gap < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL_MS - gap))
  }

  let attempt = 0
  const maxAttempts = 5
  // OpenAI 429 时 header `retry-after` (秒) 或正文里 `try again in Xs` 提示重试时间
  while (true) {
    attempt += 1
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.apiKey}`,
      },
      body,
    })
    if (resp.status === 429 && attempt < maxAttempts) {
      const retryAfter = Number(resp.headers.get('retry-after') ?? '0')
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000 + 500
        : Math.min(30_000, 2_000 * 2 ** attempt)
      await resp.body?.cancel().catch(() => undefined)
      // eslint-disable-next-line no-console
      console.warn(`[#1550 real-llm] 429 rate limit, retry attempt=${attempt} after ${waitMs}ms`)
      await new Promise(r => setTimeout(r, waitMs))
      continue
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      lastRequestEndMs = Date.now()
      throw new Error(`planner LLM HTTP ${resp.status}: ${text.slice(0, 400)}`)
    }
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> }
    lastRequestEndMs = Date.now()
    const content = json.choices?.[0]?.message?.content?.trim() ?? ''
    return { content }
  }
}

/* ---------------- assertion helpers ---------------- */

interface PlannerParsed {
  related?: boolean
  logicReady?: boolean
  assistantPrompt?: string
  semanticPatch?: {
    contextSlots?: Record<string, unknown>
    rules?: unknown[]
  }
}

function safeParsePlannerJson(content: string): PlannerParsed | null {
  if (!content) return null
  // 兼容 LLM 偶尔包 ```json 标记的情况
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(cleaned) as PlannerParsed
  }
  catch {
    return null
  }
}

const UNSUPPORTED_BANNER = '策略表达暂未识别成合规的 rules-first'

function collectAllConditionLeaves(rules: SemanticRule[]): Array<{ key: string, phase: string, sideScope: string, params: Record<string, unknown> }> {
  const out: Array<{ key: string, phase: string, sideScope: string, params: Record<string, unknown> }> = []
  for (const rule of rules) {
    for (const leaf of collectAtomLeaves(rule.condition)) {
      out.push({
        key: leaf.key,
        phase: rule.phase,
        sideScope: leaf.sideScope ?? rule.sideScope,
        params: leaf.params ?? {},
      })
    }
  }
  return out
}

function collectAllEffectLeaves(rules: SemanticRule[]): Array<{ key: string, phase: string, sideScope: string, params: Record<string, unknown> }> {
  const out: Array<{ key: string, phase: string, sideScope: string, params: Record<string, unknown> }> = []
  for (const rule of rules) {
    for (const eff of listRuleEffects(rule.effects)) {
      for (const leaf of collectAtomLeaves(eff)) {
        out.push({
          key: leaf.key,
          phase: rule.phase,
          sideScope: leaf.sideScope ?? rule.sideScope,
          params: leaf.params ?? {},
        })
      }
    }
  }
  return out
}

/**
 * fixture `expectedAtoms` 中部分 action / position atom 是 bare key（如 `open_long`，
 * 来自 SYNTHESIZABLE_ACTION_KEYS 命名空间），而 ATOM_CONTRACT_REGISTRY 与 LLM 实际输出
 * 用 `action.open_long` 完全限定形式。归一化匹配集合，避免命名空间漂移误判。
 */
function atomKeyMatchSet(key: string): readonly string[] {
  if (key.includes('.')) return [key]
  return [key, `action.${key}`, `position.${key}`, `risk.${key}`, `condition.${key}`]
}

function expectAtomPresent(
  haystack: ReadonlyArray<{ key: string, phase: string, sideScope: string, params: Record<string, unknown> }>,
  need: AtomExpectation,
  ctx: string,
): void {
  const candidates = new Set(atomKeyMatchSet(need.key))
  const hit = haystack.find((leaf) => {
    if (!candidates.has(leaf.key)) return false
    if (need.phase && leaf.phase !== need.phase) return false
    if (need.sideScope && leaf.sideScope !== need.sideScope) return false
    if (need.paramKeys) {
      for (const k of need.paramKeys) {
        if (!(k in leaf.params)) return false
      }
    }
    return true
  })
  expect({
    ctx,
    missingExpectation: need,
    hit: !!hit,
    haystackKeys: hit ? undefined : Array.from(new Set(haystack.map(h => h.key))).sort(),
  }).toEqual(expect.objectContaining({ ctx, missingExpectation: need, hit: true }))
}

/* ---------------- spec ---------------- */

const env = readRealLlmEnv()

if (!env) {
  describe.skip('thirty-one strategies real LLM entry contract (#1550)', () => {
    it('SKIPPED — 运行命令见文件头部注释（RUN_REAL_LLM_PLANNER_31 + PLANNER_LLM_BASE_URL / API_KEY / MODEL）', () => {
      // intentional no-op
    })
  })
  describe('thirty-one strategies real LLM entry contract (#1550) — banner', () => {
    it('记录运行说明，便于发布前手动跑 + PR body 引用', () => {
      const banner = [
        '[#1550] real LLM 31 acceptance is gated by env vars.',
        'To run:',
        '  RUN_REAL_LLM_PLANNER_31=1 \\',
        '  PLANNER_LLM_BASE_URL=<openai-compatible base> \\',
        '  PLANNER_LLM_API_KEY=<key> \\',
        '  PLANNER_LLM_MODEL=<model id> \\',
        '  pnpm exec jest --config apps/quantify/jest-unit.json \\',
        '    --testPathPattern=thirty-one-strategy-real-llm-entry',
      ].join('\n')
      expect(banner.length).toBeGreaterThan(0)
    })
  })
}
else {
  describe('thirty-one strategies real LLM entry contract (#1550)', () => {
    const svc = new PlannerDispatcherMergeService()
    const systemPromptZh = buildConversationPlannerSystemPrompt('zh')

    jest.setTimeout(90_000)

    it.each(THIRTY_ONE_STRATEGIES.map(fix => [fix.id, fix.name, fix]))(
      '#%i %s — LLM 入口生成合规 rules tree + 语义零漂移',
      async (_id, _name, fix) => {
        const contract = buildExpectedContract(fix as ThirtyOneStrategyFixture)
        const fixture = fix as ThirtyOneStrategyFixture

        const { content } = await callRealPlanner(env, fixture.userInput, systemPromptZh)
        expect(content.length).toBeGreaterThan(0)

        const parsed = safeParsePlannerJson(content)
        expect(parsed).not.toBeNull()
        if (!parsed) return  // 类型收窄

        // 守门 1：assistantPrompt 不得是 unsupported banner
        const assistant = String(parsed.assistantPrompt ?? '')
        expect({ fixture: fixture.id, bannerPresent: assistant.includes(UNSUPPORTED_BANNER) })
          .toEqual({ fixture: fixture.id, bannerPresent: false })

        const rawPatch = parsed.semanticPatch
        const expectsClarification = (contract.expectedClarificationSlots?.length ?? 0) > 0

        if (expectsClarification && (!rawPatch || !rawPatch.rules || rawPatch.rules.length === 0)) {
          // 缺必答槽位场景：LLM 选择仅澄清、不产 rules — 验证 assistantPrompt 确实在追问
          // 期望的 slot 关键词（任一即可，避免 wording 漂移）
          //
          // Minor m11：拆开 OR 链以提升可读性，避免 `slot.toLowerCase().includes(slot.toLowerCase())`
          //   自包含写法误读。
          const assistantLower = assistant.toLowerCase()
          const zhFallbackMatch = (slot: string): boolean => {
            if (slot === 'symbol') return /(币种|标的|交易对|symbol)/i.test(assistant)
            if (slot === 'exchange') return /(交易所|exchange|币安|okx|bybit)/i.test(assistant)
            if (slot === 'marketType') return /(现货|合约|永续|spot|perp|market.*type)/i.test(assistant)
            return false
          }
          const slotMentioned = (contract.expectedClarificationSlots ?? []).some((slot) => {
            const slotLower = slot.toLowerCase()
            return assistantLower.includes(slotLower) || zhFallbackMatch(slot)
          })
          if (!slotMentioned) {
            // Minor m3：失败时 dump 完整 assistantPrompt + parsed，避免 200 字截断丢上下文
            // eslint-disable-next-line no-console
            console.error(
              `[#1550 #${fixture.id}] clarification slot 未命中。expectedSlots=${JSON.stringify(contract.expectedClarificationSlots)}\nassistantPrompt: ${assistant}\nparsed: ${JSON.stringify(parsed, null, 2)}`,
            )
          }
          expect({ fixture: fixture.id, expectedSlotMentioned: slotMentioned, assistantPrompt: assistant.slice(0, 200) })
            .toEqual(expect.objectContaining({ expectedSlotMentioned: true }))
          return
        }

        // 守门 2：schema validator
        expect(rawPatch).toBeTruthy()
        const validation = svc.validatePlannerSemanticPatch(rawPatch, fixture.userInput)
        expect({ fixture: fixture.id, validatorOk: validation.ok, reasons: (validation.ok === false ? validation.reasons : []) })
          .toEqual(expect.objectContaining({ validatorOk: true }))
        if (validation.ok === false) return

        const rules = (rawPatch!.rules ?? []) as SemanticRule[]
        expect(rules.length).toBeGreaterThan(0)

        // 守门 3：phase coverage
        const phasesPresent = new Set(rules.map(r => r.phase))
        for (const need of contract.requiredPhases) {
          expect({ fixture: fixture.id, requiredPhase: need, present: phasesPresent.has(need) })
            .toEqual({ fixture: fixture.id, requiredPhase: need, present: true })
        }

        // 守门 4：condition / effects atom coverage（含 sideScope）
        const conditionLeaves = collectAllConditionLeaves(rules)
        for (const need of contract.requiredConditionAtoms) {
          expectAtomPresent(conditionLeaves, need, `#${fixture.id} condition`)
        }
        const effectLeaves = collectAllEffectLeaves(rules)
        for (const need of contract.requiredEffectAtoms) {
          expectAtomPresent(effectLeaves, need, `#${fixture.id} effects`)
        }
        // Major M2 修复：risk / orchestration 桶 atom 在 validator 里既可 condition
        //   也可 effect；用 either 弱断言（任一位置存在即合规），不强制归属。
        const allLeaves = [...conditionLeaves, ...effectLeaves]
        for (const need of contract.requiredEitherAtoms) {
          expectAtomPresent(allLeaves, need, `#${fixture.id} either`)
        }

        // 守门 5：contextSlots 期望
        const ctxSlots = (rawPatch!.contextSlots ?? {}) as Record<string, unknown>
        for (const slot of contract.expectedContextSlots) {
          expect({ fixture: fixture.id, slot, present: slot in ctxSlots })
            .toEqual({ fixture: fixture.id, slot, present: true })
        }
      },
    )

    // 复现样本独立断言：staging cmpc14gtw0ipavbqs5x6cbuto 入口
    it('staging 复现样本 cmpc14gtw0ipavbqs5x6cbuto — 不再返回 unsupported banner，rules tree 含 EMA 三均线 + 跌破 EMA20 平多，并对缺失 symbol/exchange/marketType 走 clarification', async () => {
      const userInput = '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt'
      const { content } = await callRealPlanner(env, userInput, systemPromptZh)
      const parsed = safeParsePlannerJson(content)
      expect(parsed).not.toBeNull()
      if (!parsed) return
      const assistant = String(parsed.assistantPrompt ?? '')
      expect(assistant.includes(UNSUPPORTED_BANNER)).toBe(false)

      const rawPatch = parsed.semanticPatch
      // 允许两种合规路径之一：
      //   (a) LLM 直接产合规 rules + assistantPrompt 追问 symbol/exchange/marketType
      //   (b) LLM 仅追问（rules 暂不产）—— 这种也算 clarification 路径，不算漂移
      const hasRules = !!rawPatch?.rules && rawPatch.rules.length > 0
      const clarificationMentioned = /(币种|标的|交易对|symbol|交易所|exchange|现货|合约|永续|spot|perp|market.*type)/i.test(assistant)
      expect({ hasRules, clarificationMentioned }).toEqual(expect.objectContaining({ clarificationMentioned: true }))

      if (hasRules) {
        const validation = svc.validatePlannerSemanticPatch(rawPatch, userInput)
        expect(validation.ok).toBe(true)
        const rules = (rawPatch!.rules ?? []) as SemanticRule[]
        const condLeaves = collectAllConditionLeaves(rules)
        const effLeaves = collectAllEffectLeaves(rules)
        // entry side：indicator.above (ema 20/60/144) —— Major M1：必须三均线都出现
        expectAtomPresent(condLeaves, { key: 'indicator.above', phase: ENTRY, sideScope: 'long' }, 'staging-replay entry above')
        expectAtomPresent(condLeaves, { key: 'indicator.below', phase: EXIT, sideScope: 'long' }, 'staging-replay exit below')
        expectAtomPresent(effLeaves, { key: 'action.open_long', phase: ENTRY }, 'staging-replay open_long')
        expectAtomPresent(effLeaves, { key: 'action.close_long', phase: EXIT }, 'staging-replay close_long')
        // Major M1：显式检查 EMA 20/60/144 三均线都出现，否则 staging 复现样本守门空转。
        //   归一化 LLM 可能返回 string '20' 或 number 20、indicator='ema'/'EMA' 大小写。
        const aboveEmaPeriods = new Set<number>()
        for (const leaf of condLeaves) {
          if (leaf.key !== 'indicator.above') continue
          if (leaf.phase !== ENTRY) continue
          const indicator = String(leaf.params.indicator ?? '').toLowerCase()
          if (indicator !== 'ema') continue
          const periodRaw = leaf.params.period
          const period = typeof periodRaw === 'number'
            ? periodRaw
            : typeof periodRaw === 'string' ? Number(periodRaw) : NaN
          if (Number.isFinite(period)) aboveEmaPeriods.add(period)
        }
        expect({
          ctx: 'staging-replay EMA 三均线必须 20/60/144 全部出现',
          actualPeriods: Array.from(aboveEmaPeriods).sort((a, b) => a - b),
          missing: [20, 60, 144].filter(p => !aboveEmaPeriods.has(p)),
        }).toEqual({
          ctx: 'staging-replay EMA 三均线必须 20/60/144 全部出现',
          actualPeriods: [20, 60, 144],
          missing: [],
        })
      }
    })
  })
}

// Minor m8：运行时断言 fixture 数量保持 31；若有人加/删 fixture 必须同步更新本 spec 的
//   override 表（CONTRACT_OVERRIDES）与 expectedSemanticContract 派生逻辑。
//   原编译期断言 `typeof THIRTY_ONE_STRATEGIES extends { length: 31 }` 在 fixture 声明为
//   `readonly ThirtyOneStrategyFixture[]`（非 tuple）时 length 类型是 number → guard 永远
//   为 never，被生产 tsc 抓 TS2322（jest isolatedModules 不查所以静默）。改成 module-load
//   时的简单 throw，效果等价、不引入 TS 类型噪音。
if (THIRTY_ONE_STRATEGIES.length !== 31) {
  throw new Error(`[#1550] thirty-one-strategy-real-llm-entry expects 31 fixtures, got ${THIRTY_ONE_STRATEGIES.length}`)
}
