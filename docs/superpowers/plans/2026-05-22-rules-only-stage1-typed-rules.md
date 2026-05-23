# Rules-Only Stage 1 Typed Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Issue #1630 by upgrading the AI Quant entry-side semantic pipeline to typed rules with `RuleEffects`, `program` phase support, 31/31 corpus parity, and strategy/script consistency evidence.

**Architecture:** `SemanticRule` remains the single entry-side truth. `condition` carries old trigger trees, `effects.*` carries old action/risk/position/orchestration/program buckets, and flat buckets remain only as compatibility projection. Program strategies use `phase: 'program'` and `effects.programs` instead of being forced into entry/exit.

**Tech Stack:** TypeScript, NestJS, Zod, Jest, Nx via `dx`, existing AI Quant codegen services under `apps/quantify/src/modules/llm-strategy-codegen`.

---

## File Structure

Modify:

- `apps/quantify/src/modules/llm-strategy-codegen/types/atom-expr.ts`
  Owns `SemanticRule`, `RuleEffects`, phase enum, and zod schemas.
- `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
  Keeps legacy patch fields typed for fixture compatibility while production gates reject them.
- `apps/quantify/src/modules/llm-strategy-codegen/prompts/conversation-planner-system.prompt.ts`
  Forces planner output to typed `RuleEffects` and `program` phase.
- `apps/quantify/src/modules/llm-strategy-codegen/services/planner-dispatcher-merge.service.ts`
  Validates typed rules, rejects old patch fields, merges dispatcher execution slots into typed effects.
- `apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts`
  Emits typed rules directly as production output.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-merge.service.ts`
  Merges typed effect roles without flattening them.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-rule-projection.service.ts`
  Projects typed rules to flat compatibility buckets with rule-path provenance.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
  Reads open-slot owner paths from typed rules for entry-side readiness.
- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  Ensures text conversation, slot answers, strategy generation, and script generation entry paths consume typed rules.
- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`
  Emits consistency hashes/evidence for typed rules through script generation.

Create:

- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/stage1-typed-rules-corpus.ts`
  Canonical 31 strategy corpus.
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-typed-rules-schema.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-planner-schema-gate.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-dispatcher-typed-rules.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-projection-provenance.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-corpus-to-script-consistency.spec.ts`

---

### Task 1: Typed RuleEffects Type And Schema

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/atom-expr.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-typed-rules-schema.spec.ts`

- [ ] **Step 1: Write failing schema tests**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-typed-rules-schema.spec.ts`:

```ts
import { semanticRuleSchema } from '../../types/atom-expr'

const atom = (key: string, params: Record<string, unknown> = {}) => ({
  kind: 'atom' as const,
  key,
  params,
})

describe('stage1 typed SemanticRule schema', () => {
  it('accepts typed RuleEffects and program phase', () => {
    const parsed = semanticRuleSchema.safeParse({
      id: 'program-grid-1',
      phase: 'program',
      sideScope: 'both',
      condition: atom('execution.on_start'),
      effects: {
        actions: [],
        risks: [atom('risk.stop_loss_pct', { valuePct: 5 })],
        positions: [atom('position.per_order_budget', { value: 10, asset: 'USDT' })],
        orchestration: [atom('scope.symbol', { symbol: 'BTCUSDT' })],
        programs: [atom('program.grid', { levels: 10 })],
      },
      evidence: { text: '启动网格' },
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects legacy bare effects arrays', () => {
    const parsed = semanticRuleSchema.safeParse({
      id: 'legacy-effects-1',
      phase: 'entry',
      sideScope: 'long',
      condition: atom('price.ema_above', { period: 20 }),
      effects: [atom('action.open_long')],
    })

    expect(parsed.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-typed-rules-schema.spec.ts
```

Expected: FAIL because `phase: 'program'` and typed `effects` object are not accepted yet.

- [ ] **Step 3: Implement typed effects**

In `apps/quantify/src/modules/llm-strategy-codegen/types/atom-expr.ts`, replace the phase and effects definitions with:

```ts
export type SemanticRulePhase = 'entry' | 'exit' | 'gate' | 'program'
export type SemanticRuleSideScope = 'long' | 'short' | 'both'

export interface RuleEffects {
  readonly actions: ReadonlyArray<AtomExpr>
  readonly risks: ReadonlyArray<AtomExpr>
  readonly positions: ReadonlyArray<AtomExpr>
  readonly orchestration: ReadonlyArray<AtomExpr>
  readonly programs: ReadonlyArray<AtomExpr>
}

export interface SemanticRule {
  readonly id: string
  readonly phase: SemanticRulePhase
  readonly sideScope: SemanticRuleSideScope
  readonly condition: AtomExpr
  readonly effects: RuleEffects
  readonly evidence?: AtomExprEvidence
}

export const ruleEffectsSchema = z.object({
  actions: z.array(atomExprSchema),
  risks: z.array(atomExprSchema),
  positions: z.array(atomExprSchema),
  orchestration: z.array(atomExprSchema),
  programs: z.array(atomExprSchema),
})

export const semanticRuleSchema = z.object({
  id: z.string().min(1),
  phase: z.enum(['entry', 'exit', 'gate', 'program']),
  sideScope: z.enum(['long', 'short', 'both']),
  condition: atomExprSchema,
  effects: ruleEffectsSchema,
  evidence: z.object({ text: z.string().min(1) }).passthrough().optional(),
})
```

- [ ] **Step 4: Run test and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-typed-rules-schema.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/atom-expr.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-typed-rules-schema.spec.ts
git commit -F - <<'MSG'
feat: add typed rule effects schema

Refs: #1630
MSG
```

---

### Task 2: Planner Schema Gate For Typed Rules

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/planner-dispatcher-merge.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-planner-schema-gate.spec.ts`

- [ ] **Step 1: Write failing planner gate tests**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-planner-schema-gate.spec.ts`:

```ts
import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'

const atom = (key: string, params: Record<string, unknown> = {}) => ({
  kind: 'atom' as const,
  key,
  params,
  evidence: { text: '测试' },
})

describe('stage1 planner typed rules gate', () => {
  const service = new PlannerDispatcherMergeService()

  it('rejects legacy flat patch fields', () => {
    const result = service.validatePlannerSemanticPatch({
      rules: [{
        id: 'entry-1',
        phase: 'entry',
        sideScope: 'long',
        condition: atom('price.ema_above'),
        effects: { actions: [], risks: [], positions: [], orchestration: [], programs: [] },
        evidence: { text: '测试' },
      }],
      triggers: [{ key: 'price.ema_above', phase: 'entry', params: {} }],
    }, '测试')

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('legacy_flat_field')
    }
  })

  it('rejects bare effects arrays', () => {
    const result = service.validatePlannerSemanticPatch({
      rules: [{
        id: 'entry-1',
        phase: 'entry',
        sideScope: 'long',
        condition: atom('price.ema_above'),
        effects: [atom('action.open_long')],
        evidence: { text: '测试' },
      }],
    }, '测试')

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('rule_shape_invalid')
    }
  })
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-planner-schema-gate.spec.ts
```

Expected: FAIL until the gate understands typed `RuleEffects` and still rejects legacy fields.

- [ ] **Step 3: Update planner validation**

In `planner-dispatcher-merge.service.ts`:

```ts
const LEGACY_FLAT_FIELDS: ReadonlyArray<string> = [
  'atoms',
  'triggers',
  'actions',
  'risks',
  'risk',
  'position',
  'positionConstraints',
  'orchestration',
] as const
```

Update reminder text to include:

```ts
'- 每条 rule 必须含 id / phase / sideScope / condition (旧 triggers) / effects (typed RuleEffects)',
'- effects 必须是对象：{ actions, risks, positions, orchestration, programs }',
'- program 型策略必须使用 phase=program，并把 grid/DCA/TWAP/webhook/event listener 放入 effects.programs',
```

- [ ] **Step 4: Run test and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-planner-schema-gate.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/planner-dispatcher-merge.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-planner-schema-gate.spec.ts
git commit -F - <<'MSG'
feat: enforce typed rules planner gate

Refs: #1630
MSG
```

---

### Task 3: Planner Prompt Typed Effects Contract

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/prompts/conversation-planner-system.prompt.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt.spec.ts`

- [ ] **Step 1: Add failing prompt assertions**

Append assertions to existing prompt spec:

```ts
it('requires typed RuleEffects and program phase for program strategies', () => {
  const prompt = buildConversationPlannerSystemPrompt('zh')

  expect(prompt).toContain('effects.actions')
  expect(prompt).toContain('effects.risks')
  expect(prompt).toContain('effects.positions')
  expect(prompt).toContain('effects.orchestration')
  expect(prompt).toContain('effects.programs')
  expect(prompt).toContain('phase')
  expect(prompt).toContain('program')
  expect(prompt).toContain('condition = 原 triggers')
})
```

- [ ] **Step 2: Run prompt test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt.spec.ts
```

Expected: FAIL until prompt text includes typed effects and program phase.

- [ ] **Step 3: Update prompt contract**

In `conversation-planner-system.prompt.ts`, add prompt lines:

```ts
'semanticPatch.rules[] 是唯一策略语义输出；禁止输出 atoms/triggers/actions/risk/position/orchestration 旧字段。',
'rules[].condition = 原 triggers，必须保留 AND / OR / NOT / SEQUENCE 结构。',
'rules[].effects 必须是对象：{ actions: [], risks: [], positions: [], orchestration: [], programs: [] }。',
'effects.actions = 原 action；effects.risks = 原 risk；effects.positions = 原 positionConstraint；effects.orchestration = 原 orchestration；effects.programs = grid / DCA / TWAP / martingale / webhook/event listener 等执行程序。',
'phase 可为 entry / exit / gate / program。网格、DCA、TWAP、自适应网格、webhook/event listener 这类程序型策略必须使用 phase=program。',
```

- [ ] **Step 4: Run prompt test and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/prompts/conversation-planner-system.prompt.ts apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt.spec.ts
git commit -F - <<'MSG'
feat: document typed rule effects in planner prompt

Refs: #1630
MSG
```

---

### Task 4: 31 Strategy Corpus Fixture

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/stage1-typed-rules-corpus.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-dispatcher-typed-rules.spec.ts`

- [ ] **Step 1: Create corpus fixture**

Create `stage1-typed-rules-corpus.ts`:

```ts
export interface Stage1TypedRulesCorpusCase {
  id: string
  text: string
  expectedPhases: Array<'entry' | 'exit' | 'gate' | 'program'>
  expectedEffectRoles: Array<'actions' | 'risks' | 'positions' | 'orchestration' | 'programs'>
}

export const STAGE1_TYPED_RULES_CORPUS: Stage1TypedRulesCorpusCase[] = [
  {
    id: 'stage1-001-ema-stack-fixed-quote',
    text: '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-002-ema-stack-boll-dual-side',
    text: '15min k线里面 价格在ema20 ema60 ema144上方时做多开仓 都位于下方只开空 入场是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损5%止损',
    expectedPhases: ['entry'],
    expectedEffectRoles: ['actions', 'risks', 'orchestration'],
  },
  {
    id: 'stage1-003-okx-percent-change',
    text: '在okx交易所 我想买btc  3分钟之内跌百分1买入  15分钟之内涨百分2卖出  单笔用百分10资金 止损5% 止盈10%',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-004-boll-mean-reversion',
    text: 'OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-005-range-grid',
    text: '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
    expectedPhases: ['program'],
    expectedEffectRoles: ['risks', 'positions', 'orchestration', 'programs'],
  },
  {
    id: 'stage1-006-ordi-spot-on-start',
    text: '在 OKX 现货 ORDI/USDT 上，主周期 1h，使用 10% 固定仓位只做多；入场动作为立即开始时市价买入；出场规则为价格相对前收盘上涨 1% 时卖出，另有相对入场均价下跌 5% 止损卖出、相对入场均价上涨 10% 止盈卖出。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-007-boll-scalp',
    text: 'OKX 合约 BTCUSDT 1m，使用布林带 5,1。价格触及或突破上轨时做空，价格触及或突破下轨时做多；多单在价格回到中轨时平仓，空单在价格回到中轨时平仓；单笔仓位 10%，止损 1%，止盈 1.5%。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-008-candle-open-close',
    text: '用 BTCUSDT 1m K 线。每次最新 K 线收盘价高于开盘价时尝试开多。如果已有持仓则不再开仓。收盘价低于开盘价时平多。',
    expectedPhases: ['entry', 'exit', 'gate'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-009-deployment-centered-grid',
    text: 'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行“立即停止并撤销所有未成交订单”',
    expectedPhases: ['program'],
    expectedEffectRoles: ['positions', 'orchestration', 'programs', 'risks'],
  },
  {
    id: 'stage1-010-tight-range-grid',
    text: '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 79200-80200，采用双向网格，每格间距 0.1%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
    expectedPhases: ['program'],
    expectedEffectRoles: ['risks', 'positions', 'orchestration', 'programs'],
  },
  {
    id: 'stage1-011-ema-cross-cross-margin',
    text: '创建一个 OKX BTCUSDT 永续合约策略，使用 15 分钟 K 线。当 EMA7 上穿 EMA21 时开多；当 EMA7 下穿 EMA21 时平多。每次使用账户权益的 10% 开仓，杠杆 1 倍，逐仓不要使用，使用全仓 cross。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-012-boll-short-form',
    text: '15min 布林带下轨买入 上轨卖出',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-013-ema-cross-short-form',
    text: 'EMA7 上穿 EMA21 时开多；下穿 时平多。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions'],
  },
  {
    id: 'stage1-014-macd-cross',
    text: 'OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-015-minimal-grid',
    text: '15m 周期，价格区间 79200-80200，采用双向网格',
    expectedPhases: ['program'],
    expectedEffectRoles: ['orchestration', 'programs'],
  },
  {
    id: 'stage1-016-breakout-channel',
    text: 'BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-017-ma-trend-pullback',
    text: 'ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入,ETH 日线在 MA120 下方时平仓',
    expectedPhases: ['entry', 'exit', 'gate'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-018-consecutive-drop-volume-rebound',
    text: 'BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。',
    expectedPhases: ['entry'],
    expectedEffectRoles: ['actions', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-019-ma-gated-rsi',
    text: 'BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。',
    expectedPhases: ['entry', 'exit', 'gate'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-020-boll-volume-filter',
    text: 'ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-021-sol-ma-macd',
    text: 'SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。',
    expectedPhases: ['entry', 'exit', 'gate'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-022-breakout-retest',
    text: 'BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'orchestration'],
  },
  {
    id: 'stage1-023-ma-atr-risk-reward',
    text: 'ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'orchestration'],
  },
  {
    id: 'stage1-024-multi-timeframe-ema',
    text: '15min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出 再币安交易所 btcusdt永续合约',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-025-webhook-event',
    text: 'OKX 合约 BTCUSDT 15m，收到 webhook 事件 signalId 为 whale_buy 且 secret 已配置时开多，每次 100',
    expectedPhases: ['program'],
    expectedEffectRoles: ['actions', 'positions', 'orchestration', 'programs'],
  },
  {
    id: 'stage1-026-rsi-band',
    text: 'BTC/USDT 4h，RSI 跌破 30 开多，RSI 回到 70 平仓，止损 2%',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'orchestration'],
  },
  {
    id: 'stage1-027-boll-long-short',
    text: 'ETH 1h，价格触及布林下轨开多，回到中轨止盈，触及上轨开空',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-028-drawdown-breaker',
    text: 'SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断',
    expectedPhases: ['entry', 'exit', 'program'],
    expectedEffectRoles: ['actions', 'risks', 'orchestration', 'programs'],
  },
  {
    id: 'stage1-029-pyramiding',
    text: 'BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层',
    expectedPhases: ['entry', 'program'],
    expectedEffectRoles: ['actions', 'positions', 'orchestration', 'programs'],
  },
  {
    id: 'stage1-030-dca',
    text: 'ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT',
    expectedPhases: ['program'],
    expectedEffectRoles: ['actions', 'positions', 'orchestration', 'programs'],
  },
  {
    id: 'stage1-031-adaptive-vol-grid',
    text: 'SOL 现货，30 分钟。价格在最近 24 小时区间的 0.3–0.7 分位之间运行时，启用自适应波动率网格；价格突破区间上沿则停止网格并平仓。',
    expectedPhases: ['program'],
    expectedEffectRoles: ['actions', 'risks', 'positions', 'orchestration', 'programs'],
  },
]
```

- [ ] **Step 2: Write fixture integrity test**

Create `stage1-dispatcher-typed-rules.spec.ts`:

```ts
import { STAGE1_TYPED_RULES_CORPUS } from './fixtures/stage1-typed-rules-corpus'

describe('stage1 typed rules corpus fixture', () => {
  it('contains exactly 31 required current-capability cases', () => {
    expect(STAGE1_TYPED_RULES_CORPUS).toHaveLength(31)
    expect(new Set(STAGE1_TYPED_RULES_CORPUS.map(item => item.id)).size).toBe(31)
    expect(STAGE1_TYPED_RULES_CORPUS.every(item => item.text.trim().length > 0)).toBe(true)
  })
})
```

- [ ] **Step 3: Run test and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-dispatcher-typed-rules.spec.ts
```

Expected: PASS after all 31 cases are present.

- [ ] **Step 4: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/stage1-typed-rules-corpus.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-dispatcher-typed-rules.spec.ts
git commit -F - <<'MSG'
test: add stage 1 typed rules corpus

Refs: #1630
MSG
```

---

### Task 5: Dispatcher Emits Typed Rules

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/planner-dispatcher-merge.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-dispatcher-typed-rules.spec.ts`

- [ ] **Step 1: Extend dispatcher test**

Append to `stage1-dispatcher-typed-rules.spec.ts`:

```ts
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

function countEffectsByRole(rule: { effects: Record<string, unknown[]> }, role: string): number {
  const value = rule.effects[role]
  return Array.isArray(value) ? value.length : 0
}

describe('GenericSeedDispatcher stage1 typed rules', () => {
  const dispatcher = new GenericSeedDispatcher()

  it.each(STAGE1_TYPED_RULES_CORPUS)('emits typed rules for $id', (testCase) => {
    const patch = dispatcher.dispatch(testCase.text)

    expect(Array.isArray(patch.rules)).toBe(true)
    expect(patch.rules?.length).toBeGreaterThan(0)
    expect(patch).not.toHaveProperty('triggers')
    expect(patch).not.toHaveProperty('actions')
    expect(patch).not.toHaveProperty('risk')
    expect(patch).not.toHaveProperty('position')
    expect(patch).not.toHaveProperty('orchestration')

    const phases = new Set(patch.rules?.map(rule => rule.phase))
    for (const phase of testCase.expectedPhases) {
      expect(phases.has(phase)).toBe(true)
    }

    for (const role of testCase.expectedEffectRoles) {
      expect(patch.rules?.some(rule => countEffectsByRole(rule, role) > 0)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-dispatcher-typed-rules.spec.ts
```

Expected: FAIL while dispatcher still returns flat fields or bare effects.

- [ ] **Step 3: Add typed effects helpers**

In `generic-seed-dispatcher.service.ts`, add helper shapes and helpers:

```ts
type TypedRuleEffects = {
  actions: AtomExpr[]
  risks: AtomExpr[]
  positions: AtomExpr[]
  orchestration: AtomExpr[]
  programs: AtomExpr[]
}

function emptyRuleEffects(): TypedRuleEffects {
  return { actions: [], risks: [], positions: [], orchestration: [], programs: [] }
}

function appendEffectByBucket(effects: TypedRuleEffects, bucket: AtomContractBucket, atom: AtomExpr): void {
  if (bucket === 'action') effects.actions.push(atom)
  if (bucket === 'risk') effects.risks.push(atom)
  if (bucket === 'positionConstraint') effects.positions.push(atom)
  if (bucket === 'orchestration') effects.orchestration.push(atom)
}
```

Map program atoms by contract key/domain into `effects.programs`:

```ts
function isProgramAtomKey(key: string): boolean {
  return key.startsWith('program.')
    || key.includes('grid')
    || key.includes('dca')
    || key.includes('twap')
    || key.includes('martingale')
    || key.includes('event_listener')
}
```

- [ ] **Step 4: Return typed rules from dispatcher**

Change production return shape to:

```ts
return {
  ...(Object.keys(contextSlots).length > 0 ? { contextSlots } : {}),
  rules: typedRules,
}
```

Keep any flat-building helper private for tests only and do not expose flat fields from `dispatch()`.

- [ ] **Step 5: Run test and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-dispatcher-typed-rules.spec.ts
```

Expected: PASS for all 31 cases.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/planner-dispatcher-merge.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-dispatcher-typed-rules.spec.ts
git commit -F - <<'MSG'
feat: emit typed rules from dispatcher

Refs: #1630
MSG
```

---

### Task 6: Merge And Edit Preserve Typed Effects

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-merge.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-merge.service.spec.ts`

- [ ] **Step 1: Add failing merge test**

Append to `semantic-state-merge.service.spec.ts`:

```ts
it('merges typed rule effects without flattening or dropping program phase', () => {
  const service = new SemanticStateMergeService()
  const base = {
    version: 1,
    families: [],
    rules: [],
    trigger: [],
    action: [],
    risk: [],
    position: null,
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-22T00:00:00.000Z',
  }
  const persisted = {
    ...base,
    rules: [{
      id: 'program-grid-1',
      phase: 'program' as const,
      sideScope: 'both' as const,
      condition: { kind: 'atom' as const, key: 'execution.on_start', params: {} },
      effects: {
        actions: [],
        risks: [],
        positions: [],
        orchestration: [],
        programs: [{ kind: 'atom' as const, key: 'program.grid', params: { levels: 10 } }],
      },
    }],
  }
  const derived = {
    ...base,
    rules: [{
      id: 'program-grid-1',
      phase: 'program' as const,
      sideScope: 'both' as const,
      condition: { kind: 'atom' as const, key: 'execution.on_start', params: {} },
      effects: {
        actions: [],
        risks: [{ kind: 'atom' as const, key: 'risk.boundary_break_stop', params: {} }],
        positions: [],
        orchestration: [],
        programs: [{ kind: 'atom' as const, key: 'program.grid', params: { levels: 10 } }],
      },
    }],
  }

  const merged = service.merge({ persisted, derived })

  expect(merged.rules?.[0]?.phase).toBe('program')
  expect(merged.rules?.[0]?.effects.programs).toHaveLength(1)
  expect(merged.rules?.[0]?.effects.risks).toHaveLength(1)
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-merge.service.spec.ts
```

Expected: FAIL until merge handles typed effect objects.

- [ ] **Step 3: Update merge identity and cloning**

In `semantic-state-merge.service.ts`, replace effect-array assumptions with:

```ts
private cloneRuleEffects(effects: SemanticRule['effects']): SemanticRule['effects'] {
  return {
    actions: effects.actions.map(effect => this.cloneAtomExpr(effect)),
    risks: effects.risks.map(effect => this.cloneAtomExpr(effect)),
    positions: effects.positions.map(effect => this.cloneAtomExpr(effect)),
    orchestration: effects.orchestration.map(effect => this.cloneAtomExpr(effect)),
    programs: effects.programs.map(effect => this.cloneAtomExpr(effect)),
  }
}
```

When merging matching rules, merge each role independently:

```ts
effects: {
  actions: this.mergeExprList(persistedRule.effects.actions, derivedRule.effects.actions),
  risks: this.mergeExprList(persistedRule.effects.risks, derivedRule.effects.risks),
  positions: this.mergeExprList(persistedRule.effects.positions, derivedRule.effects.positions),
  orchestration: this.mergeExprList(persistedRule.effects.orchestration, derivedRule.effects.orchestration),
  programs: this.mergeExprList(persistedRule.effects.programs, derivedRule.effects.programs),
},
```

- [ ] **Step 4: Run merge tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-merge.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-merge.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-merge.service.spec.ts
git commit -F - <<'MSG'
feat: preserve typed effects during semantic merge

Refs: #1630
MSG
```

---

### Task 7: Projection From Typed Rules To Compatibility Buckets

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-rule-projection.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-projection-provenance.spec.ts`

- [ ] **Step 1: Write failing projection test**

Create `stage1-projection-provenance.spec.ts`:

```ts
import type { SemanticState } from '../../types/semantic-state'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'

describe('stage1 typed rule projection provenance', () => {
  it('projects typed effect roles to compatibility buckets with rule paths', () => {
    const service = new SemanticRuleProjectionService()
    const state = {
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
      updatedAt: new Date().toISOString(),
      rules: [{
        id: 'program-grid-1',
        phase: 'program' as const,
        sideScope: 'both' as const,
        condition: { kind: 'atom' as const, key: 'execution.on_start', params: {} },
        effects: {
          actions: [],
          risks: [{ kind: 'atom' as const, key: 'risk.stop_loss_pct', params: { valuePct: 5 } }],
          positions: [{ kind: 'atom' as const, key: 'position.per_order_budget', params: { value: 10 } }],
          orchestration: [{ kind: 'atom' as const, key: 'scope.symbol', params: { symbol: 'BTCUSDT' } }],
          programs: [{ kind: 'atom' as const, key: 'program.grid', params: { levels: 10 } }],
        },
      }],
    } satisfies SemanticState

    const projected = service.reprojectFromRules(state)

    expect(projected.trigger[0]?._provenance?.ruleId).toBe('program-grid-1')
    expect(projected.risk[0]?._provenance?.conditionPath).toBe('effects.risks[0].atom')
    expect(projected.positionConstraint[0]?._provenance?.conditionPath).toBe('effects.positions[0].atom')
    expect(projected.orchestration.some(node => node._provenance?.conditionPath === 'effects.programs[0].atom')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-projection-provenance.spec.ts
```

Expected: FAIL until projection walks typed effects.

- [ ] **Step 3: Update projection walkers**

In `semantic-rule-projection.service.ts`, replace `rule.effects.flatMap(...)` traversals with:

```ts
private collectRuleEffectEntries(rule: SemanticRule): Array<{ expr: AtomExpr; path: string }> {
  return [
    ...rule.effects.actions.map((expr, index) => ({ expr, path: `effects.actions[${index}]` })),
    ...rule.effects.risks.map((expr, index) => ({ expr, path: `effects.risks[${index}]` })),
    ...rule.effects.positions.map((expr, index) => ({ expr, path: `effects.positions[${index}]` })),
    ...rule.effects.orchestration.map((expr, index) => ({ expr, path: `effects.orchestration[${index}]` })),
    ...rule.effects.programs.map((expr, index) => ({ expr, path: `effects.programs[${index}]` })),
  ]
}
```

Use the path suffix `.atom`, `.and.children[n].atom`, `.sequence.steps[n].atom` when projecting leaves.

- [ ] **Step 4: Run projection test and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-projection-provenance.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-rule-projection.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-projection-provenance.spec.ts
git commit -F - <<'MSG'
feat: project typed rule effects to compatibility buckets

Refs: #1630
MSG
```

---

### Task 8: Readiness And Slot Paths Use Typed Rule Owners

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts`

- [ ] **Step 1: Add failing readiness path assertion**

Append to `semantic-contract-readiness.service.rules-mode.spec.ts`:

```ts
it('reports missing typed effect slots using rule paths', () => {
  const service = new SemanticContractReadinessService()
  const state = {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    position: null,
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-22T00:00:00.000Z',
    rules: [{
      id: 'entry-long-1',
      phase: 'entry' as const,
      sideScope: 'long' as const,
      condition: { kind: 'atom' as const, key: 'price.ema_above', params: { period: 20 } },
      effects: {
        actions: [{ kind: 'atom' as const, key: 'action.open_long', params: {} }],
        risks: [{ kind: 'atom' as const, key: 'risk.stop_loss_pct', params: {} }],
        positions: [],
        orchestration: [],
        programs: [],
      },
    }],
  } satisfies SemanticState

  const result = service.normalize(state)
  const slotPaths = JSON.stringify(result.state)

  expect(slotPaths).toContain('rules[0].effects.risks[0]')
  expect(slotPaths).not.toContain('risk[0]')
})
```

- [ ] **Step 2: Run readiness test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
```

Expected: FAIL until slot path rendering uses typed rule owner paths.

- [ ] **Step 3: Thread typed paths into readiness**

In readiness owner collection, include provenance paths:

```ts
interface SemanticContractOwnerRef {
  ownerKind: SemanticContractOwnerKind
  ownerId: string
  atomKey: string
  sourceRuleId?: string
  sourceRulePath?: string
  params: Record<string, unknown>
  support?: SemanticAtomSupportMetadata
  status: SemanticNodeStatus
  openSlots: SemanticSlotState[]
  contracts: SemanticAtomContract[]
}
```

When building open slots:

```ts
fieldPath: owner.sourceRulePath ?? slot.fieldPath,
slotKey: owner.sourceRulePath ? `${owner.atomKey}:${slot.slotKey}` : slot.slotKey,
```

- [ ] **Step 4: Run readiness test and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
git commit -F - <<'MSG'
feat: route readiness slots to typed rule paths

Refs: #1630
MSG
```

---

### Task 9: Strategy And Script Generation Accept Program Rules

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-ir-canonical-adapter.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-corpus-to-script-consistency.spec.ts`

- [ ] **Step 1: Write failing program generation test**

Create `stage1-corpus-to-script-consistency.spec.ts` with a focused program test:

```ts
import type { SemanticRule } from '../../types/atom-expr'
import type { SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'

function buildSemanticStateWithTypedRules(rules: SemanticRule[]): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    position: null,
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-22T00:00:00.000Z',
    rules,
  }
}

describe('stage1 program rule strategy generation', () => {
  it('keeps program rules through canonical/script generation', async () => {
    const semanticState = buildSemanticStateWithTypedRules([{
      id: 'program-grid-1',
      phase: 'program',
      sideScope: 'both',
      condition: { kind: 'atom', key: 'execution.on_start', params: {} },
      effects: {
        actions: [],
        risks: [{ kind: 'atom', key: 'risk.boundary_break_stop', params: { action: 'stop_and_cancel' } }],
        positions: [{ kind: 'atom', key: 'position.per_order_budget', params: { value: 10, asset: 'USDT' } }],
        orchestration: [{ kind: 'atom', key: 'scope.symbol', params: { symbol: 'ETHUSDT' } }],
        programs: [{ kind: 'atom', key: 'program.grid', params: { center: 'deployment_price', levels: 10 } }],
      },
    }])

    const canonical = new CanonicalSpecBuilderService().buildFromSemanticState(semanticState)

    expect(JSON.stringify(canonical)).toContain('grid')
    expect(JSON.stringify(canonical)).toContain('program')
  })
})
```

- [ ] **Step 2: Run focused generation test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-corpus-to-script-consistency.spec.ts
```

Expected: FAIL until `phase: 'program'` and `effects.programs` survive generation.

- [ ] **Step 3: Update generation entry points**

For every `phase === 'entry' || phase === 'exit' || phase === 'gate'` branch in touched generation code, add explicit `program` handling:

```ts
if (rule.phase === 'program') {
  return this.buildProgramRuleArtifacts(rule)
}
```

Program artifact builder must read:

```ts
const programs = rule.effects.programs
const positions = rule.effects.positions
const risks = rule.effects.risks
const orchestration = rule.effects.orchestration
```

Do not infer program semantics from flat `positionConstraint` or `orchestration` unless it came from typed rule projection with provenance.

- [ ] **Step 4: Run generation test and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-corpus-to-script-consistency.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/strategy-ir-canonical-adapter.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-corpus-to-script-consistency.spec.ts
git commit -F - <<'MSG'
feat: carry program rules into strategy generation

Refs: #1630
MSG
```

---

### Task 10: 31 Corpus End-To-End Consistency Evidence

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-corpus-to-script-consistency.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`

- [ ] **Step 1: Add consistency hash helper**

In `stage1-corpus-to-script-consistency.spec.ts`:

```ts
import { createHash } from 'node:crypto'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { STAGE1_TYPED_RULES_CORPUS } from './fixtures/stage1-typed-rules-corpus'

function hashStable(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort()))
    .digest('hex')
}

function buildTypedRulesSemanticStateFromText(text: string) {
  const dispatcherPatch = new GenericSeedDispatcher().dispatch(text)
  const fallback = new PlannerDispatcherMergeService().buildRulesTreeFallbackFromDispatcher(dispatcherPatch, text)
  const state = new SemanticSeedStateBuilderService().build(fallback, text)
  if (!state) throw new Error(`semantic state not built for ${text}`)
  const projected = new SemanticRuleProjectionService().reprojectFromRules(state)
  if (!projected.rules || projected.rules.length === 0) throw new Error(`typed rules missing for ${text}`)
  return projected
}

function generatePublicationArtifactsForTest(semanticState: ReturnType<typeof buildTypedRulesSemanticStateFromText>) {
  const canonicalSpec = new CanonicalSpecBuilderService().buildFromSemanticState(semanticState)
  const compiled = new CanonicalSpecV2IrCompilerService().compile(canonicalSpec)
  const compiledScript = JSON.stringify(compiled)
  return {
    canonicalSpec,
    compiled,
    ast: { manifest: { astDigest: hashStable(canonicalSpec) } },
    compiledScript,
    semanticConsistency: { status: 'PASSED' as const },
  }
}
```

- [ ] **Step 2: Add 31-case consistency test**

Append:

```ts
it.each(STAGE1_TYPED_RULES_CORPUS)('generates consistent script artifacts for $id', async (testCase) => {
  const semanticState = await buildTypedRulesSemanticStateFromText(testCase.text)
  const artifacts = await generatePublicationArtifactsForTest(semanticState)

  const evidence = {
    rulesHash: hashStable(semanticState.rules),
    canonicalSpecHash: hashStable(artifacts.canonicalSpec),
    irHash: artifacts.compiled.irHash ?? hashStable(artifacts.compiled.ir),
    astHash: artifacts.ast.manifest.astDigest,
    scriptHash: createHash('sha256').update(artifacts.compiledScript).digest('hex'),
  }

  expect(evidence.rulesHash).toMatch(/^[a-f0-9]{64}$/)
  expect(evidence.canonicalSpecHash).toMatch(/^[a-f0-9]{64}$/)
  expect(evidence.irHash).toBeTruthy()
  expect(evidence.astHash).toBeTruthy()
  expect(evidence.scriptHash).toMatch(/^[a-f0-9]{64}$/)
  expect(artifacts.semanticConsistency.status).toBe('PASSED')
})
```

- [ ] **Step 3: Run consistency test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-corpus-to-script-consistency.spec.ts
```

Expected: FAIL until all 31 cases complete typed rules to script.

- [ ] **Step 4: Add artifact evidence fields if missing**

In `codegen-publication-generation.stage.ts`, ensure returned artifacts expose:

```ts
const stage1ConsistencyEvidence = {
  rulesHash: this.hashCanonicalJson(input.semanticState.rules ?? []),
  canonicalSpecHash: this.hashCanonicalJson(canonicalSpec),
  irHash: compiled.irHash ?? this.hashCanonicalJson(compiled.ir),
  astHash: ast.manifest.astDigest,
  scriptHash: this.hashText(compiledScript),
}
```

Attach it to `sessionSpecDesc`:

```ts
stage1ConsistencyEvidence,
```

- [ ] **Step 5: Run consistency test and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-corpus-to-script-consistency.spec.ts
```

Expected: PASS for all 31 cases.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-corpus-to-script-consistency.spec.ts
git commit -F - <<'MSG'
test: prove stage 1 corpus script consistency

Refs: #1630
MSG
```

---

### Task 11: Remove Production Legacy Patch Entry Path

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-planner-schema-reject.spec.ts`

- [ ] **Step 1: Add production gate test**

Append:

```ts
it('fails closed when production planner patch contains only legacy flat fields', async () => {
  const patch = {
    triggers: [{ key: 'price.ema_above', phase: 'entry', params: { period: 20 } }],
    actions: [{ key: 'action.open_long', params: {} }],
  }

  const result = new PlannerDispatcherMergeService().validatePlannerSemanticPatch(patch, 'EMA20 上方开多')

  expect(result.ok).toBe(false)
  if (result.ok === false) {
    expect(result.reasons).toContain('legacy_flat_field')
    expect(result.reasons).toContain('rules_missing_or_empty')
  }
})
```

- [ ] **Step 2: Run schema reject tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-planner-schema-reject.spec.ts
```

Expected: PASS after previous planner gate changes.

- [ ] **Step 3: Mark legacy patch fields as test-only in types**

In `codegen-semantic-patch.ts`, update comments over legacy fields:

```ts
/**
 * @deprecated Stage 1: legacy flat patch fields are retained only for fixture
 * comparison and old test data. Production planner/dispatcher/schema gates
 * must reject these fields and use rules[] with typed RuleEffects.
 */
```

- [ ] **Step 4: Search for production legacy entry use**

Run:

```bash
rg -n "semanticPatch\\.(atoms|triggers|actions|risk|position|orchestration)|patch\\.(atoms|triggers|actions|risk|position|orchestration)" apps/quantify/src/modules/llm-strategy-codegen -g '*.ts'
```

Expected: Remaining matches are type definitions, tests, or explicit reject/fixture paths.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-planner-schema-reject.spec.ts
git commit -F - <<'MSG'
feat: reject legacy flat patch production entry

Refs: #1630
MSG
```

---

### Task 12: Final Verification

**Files:**
- No source edits unless verification exposes issues.

- [ ] **Step 1: Run targeted unit tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-typed-rules-schema.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-planner-schema-gate.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-dispatcher-typed-rules.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-projection-provenance.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage1-corpus-to-script-consistency.spec.ts
```

Expected: all PASS.

- [ ] **Step 2: Run existing related regression tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-pipeline.integration.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/thirty-one-strategy-rules-tree-main-flow.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-rules-zod.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-session-publication-pipeline.spec.ts
```

Expected: all PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
dx lint
```

Expected: exit 0.

- [ ] **Step 4: Run build**

Run:

```bash
dx build quantify --dev
```

Expected: exit 0.

- [ ] **Step 5: Prepare PR evidence**

Collect these outputs for PR body:

```text
31/31 typed rules generation: PASS
31/31 strategy generation: PASS
31/31 script code generation: PASS
31/31 consistency evidence: PASS
dx lint: PASS
dx build quantify --dev: PASS
```

- [ ] **Step 6: Commit verification-only doc updates if any**

If no files changed, do not commit. If test snapshots or docs changed:

```bash
git add <changed-files>
git commit -F - <<'MSG'
test: update stage 1 typed rules verification evidence

Refs: #1630
MSG
```

---

## Self-Review Notes

- Spec coverage: tasks cover typed `RuleEffects`, `program` phase, planner/dispatcher/schema gate, owner path migration, projection, strategy/script generation, 31 corpus, and staging consistency hashes.
- Scope: plan stays within #1630. It does not delete flat state fields, remove `readFlatXxx`, or complete the later full rules-only consumer migration.
- Verification: final checks use targeted unit tests, existing AI Quant regression tests, lint, and quantify build.
