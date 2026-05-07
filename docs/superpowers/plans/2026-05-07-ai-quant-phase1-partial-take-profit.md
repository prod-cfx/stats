# PR-3 risk.partial_take_profit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `risk.partial_take_profit` 从 unsupported_unknown 升级为 supported_executable / supported_requires_slot，全链路（atom contract → seed → canonical spec → IR → compiled runtime → backtest/live signal parity → corpus）一次性闭环交付。

**Architecture:** Risk-kind atom 在 `state.risk[]`，contract 通过 Phase 0 substrate `stateRequirements` 声明 tier 状态记忆需求；canonical spec 输出 N 条 risk-phase rule（每档独立）；IR 编译时把 risk-phase reduce-action rule 转为 exit-phase decision program，用户"% of original"语义通过 derivedRatio 静态展开为 `position_pct` 累积比例；compiled runtime 在 run-decision-programs 加 partial_take_profit gate（已 fired tier 跳过 + 入场边沿 reset）。多档同 bar 触发受 runtime 单 decision/bar 限制，跨多 bar 完成。

**Tech Stack:** NestJS 11.1 / TypeScript 5.9 strict / Jest 29 / packages/shared 通用 compiled-runtime / canonical-spec-v2 IR

**Spec:** `docs/superpowers/specs/2026-05-07-ai-quant-phase1-partial-take-profit-design.md`
**Issue:** #984
**Branch:** `feat/984-phase1-partial-take-profit`（已切，基于 origin/main 含 #998）

---

## File Structure

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts` | partial_take_profit substrate factory + supported 注册（替换原 unsupported 行） | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-semantic-contracts.ts` | partial_take_profit contract spec | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts` | tiers 解析 token-level 抽取（替换原仅 sourceText 路径） | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts` | seed → risk[]，memoryKey 生成 | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts` | per-tier rule + derivedRatio 静态换算 | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts` | 新增 `tryCompileReduceActionRule` 路径 | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts` | rule.metadata.partialTakeProfit 字段 | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts` | DecisionProgramDef metadata.partialTakeProfit 字段 | 修改 |
| `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts` | tier_fired gate + entry edge reset + state mutation | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.service.spec.ts` | partial_take_profit 注册回归 | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts` | contract 字段 | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts` | 4 类用户表达 | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts` | seed → risk[] | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts` | derivedRatio + N rule | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts` | reduce-action rule → exit decision program | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts` | 6 case parity | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts` | 4 corpus case | 修改 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts` | corpus 路由断言 | 修改（如需） |
| `apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts` | happy-path 1 case | 修改 |
| `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.spec.ts` | tier_fired gate + entry reset | 创建（如不存在）/ 修改 |

---

## Task 1: Atom Registry + Substrate Factory

**Goal:** partial_take_profit 在 registry 升级 supported；substrate 携带 `stateRequirements: ['<memoryKey>']` 与 `orderRequirements: ['reduce_only']`。

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.service.spec.ts`

- [ ] **Step 1: Write failing test in registry spec — substrate 字段断言**

```ts
// 在 describe('semantic-atom-registry') 内追加
it('registers risk.partial_take_profit with partial-take-profit substrate', () => {
  const service = new SemanticAtomRegistryService()
  const atom = service.resolve('risk.partial_take_profit', { tiers: [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }], memoryKey: 'partial_tp_abc' })

  expect(atom.category).toBe('risk')
  expect(atom.supportStatus).toBe('supported_executable')
  expect(atom.contractSubstrate?.runtimeRequirements).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'helper', helper: 'position_pnl_pct' }),
  ]))
  expect(atom.contractSubstrate?.stateRequirements).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'state_key', stateKey: expect.stringMatching(/^partial_tp_/) }),
  ]))
  expect(atom.contractSubstrate?.orderRequirements).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'order_capability', capability: 'reduce_only' }),
  ]))
})

it('routes risk.partial_take_profit without tiers to supported_requires_slot with openSlot', () => {
  const service = new SemanticAtomRegistryService()
  const atom = service.resolve('risk.partial_take_profit', {})
  expect(atom.supportStatus).toBe('supported_requires_slot')
  expect(atom.openSlots).toEqual(expect.arrayContaining([
    expect.objectContaining({ slotKey: 'risk.partial_take_profit.tiers' }),
  ]))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dx test unit quantify -t 'registers risk.partial_take_profit'`
Expected: FAIL — atom 当前还在 unsupported list

- [ ] **Step 3: Add substrate factory**

In `semantic-atom-registry.service.ts` near other substrate factories (e.g., 在已存在的 `falling_knife_guard` 等附近)：

```ts
function partialTakeProfitSubstrate(memoryKey: string): SemanticAtomContractSubstrate {
  return {
    runtimeRequirements: [{ kind: 'helper', helper: 'position_pnl_pct' }],
    stateRequirements: [{ kind: 'state_key', stateKey: memoryKey }],
    orderRequirements: [{ kind: 'order_capability', capability: 'reduce_only' }],
  }
}
```

- [ ] **Step 4: Replace unsupported entry with conditional supported**

Locate registry line 246：
```ts
unsupported('risk.partial_take_profit', 'risk', '分批止盈', 'partial_take_profit_public_beta_unsupported', '多档分批止盈当前公测暂未支持生成和回测。'),
```

Replace with new helper that switches between executable / requires_slot per resolved params。新 helper：

```ts
function executableRiskWithDynamicSubstrate(
  key: string,
  requiredParams: string[],
  resolveSubstrate: (params: Record<string, unknown>) => SemanticAtomContractSubstrate | null,
  openSlot: (params: Record<string, unknown>) => OpenSlotDef[] | null,
) {
  return (params: Record<string, unknown> = {}) => {
    const substrate = resolveSubstrate(params)
    const slots = openSlot(params)
    if (substrate) {
      return executableRiskBuilder(key, requiredParams, () => substrate)
    }
    return supportedRequiresSlotRiskBuilder(key, requiredParams, slots ?? [], () => baseExecutableSubstrate())
  }
}
```

注意：仿现有 `supportedRequiresSlotRisk` (line 335) 与 `executableRisk` 内部结构。

- [ ] **Step 5: Wire up registry entry**

在 ATOMS 数组里替换 line 246：

```ts
executableRiskWithDynamicSubstrate(
  'risk.partial_take_profit',
  ['memoryKey', 'tiers'],
  (params) => {
    const memoryKey = typeof params.memoryKey === 'string' && params.memoryKey.startsWith('partial_tp_')
      ? params.memoryKey
      : null
    const tiers = Array.isArray(params.tiers) ? params.tiers : null
    if (!memoryKey || !tiers || tiers.length === 0) return null
    return partialTakeProfitSubstrate(memoryKey)
  },
  (params) => {
    const tiers = Array.isArray(params.tiers) ? params.tiers : null
    if (!tiers || tiers.length === 0) {
      return [{
        slotKey: 'risk.partial_take_profit.tiers',
        question: '请说明分批止盈每档的触发条件（PnL 百分比）和减仓比例（例如：盈利 5% 平 50%，盈利 10% 平 50%）',
      }]
    }
    return null
  },
),
```

- [ ] **Step 6: Run tests to verify pass**

Run: `dx test unit quantify -t 'risk.partial_take_profit'`
Expected: PASS — 两个新 case 都绿；既有 50+ atom snapshot 保持 byte-equal

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts \
        apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.service.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): substrate + registry support for partial take profit

- partialTakeProfitSubstrate 工厂：position_pnl_pct helper / memoryKey state / reduce_only order
- executableRiskWithDynamicSubstrate helper：根据 params 完整度路由 supported_executable vs supported_requires_slot
- 替换 risk.partial_take_profit 原 unsupported 行
- 缺 tiers 时进入 openSlot

Refs: #984
MSG
```

---

## Task 2: Contract Spec Declaration

**Goal:** strategy-semantic-contracts 声明 partial_take_profit 完整 contract（capabilities/requires/effects/orderRequirements）。

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-semantic-contracts.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
it('declares risk.partial_take_profit contract', () => {
  const contracts = new StrategySemanticContractService()
  const contract = contracts.resolveByKey('risk.partial_take_profit')
  expect(contract).toMatchObject({
    capabilities: expect.arrayContaining(['reduce_partial_position']),
    requires: expect.arrayContaining(['position_open']),
    effects: expect.arrayContaining(['reduce_exposure']),
    orderRequirements: expect.arrayContaining(['reduce_only']),
  })
})
```

- [ ] **Step 2: Verify failing**

Run: `dx test unit quantify -t 'declares risk.partial_take_profit contract'`
Expected: FAIL — contract 未声明

- [ ] **Step 3: Add contract entry**

In `strategy-semantic-contracts.ts`, 仿 `risk.take_profit_pct` (附近已有) 加：

```ts
{
  key: 'risk.partial_take_profit',
  category: 'risk',
  capabilities: ['reduce_partial_position'],
  requires: ['position_open'],
  effects: ['reduce_exposure'],
  orderRequirements: ['reduce_only'],
  runtimeRequirements: ['position_pnl_pct'],
  stateRequirements: ['partial_take_profit_tier_state'],
},
```

- [ ] **Step 4: Verify pass**

Run: `dx test unit quantify -t 'declares risk.partial_take_profit contract'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/strategy-semantic-contracts.ts \
        apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): declare partial take profit semantic contract

Refs: #984
MSG
```

---

## Task 3: Seed Extractor Tier Parsing

**Goal:** 把"分批止盈"短语扩展为 token-level tiers 解析；4 类用户表达模式覆盖。

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts` (line ~1342 附近)
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`

- [ ] **Step 1: Write failing tests — 4 表达模式**

```ts
describe('partial take profit tiers', () => {
  const extractor = new SemanticSeedExtractorService()

  it('parses Chinese explicit ratios', () => {
    const seeds = extractor.extract('盈利 5% 平 50%，盈利 10% 平 50%')
    expect(seeds.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.partial_take_profit',
        params: expect.objectContaining({
          tiers: [
            { trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 },
            { trigger: { kind: 'pnl_pct', threshold: 10 }, reduceRatio: 0.5 },
          ],
        }),
      }),
    ]))
  })

  it('parses "平一半" / "平剩下" colloquial', () => {
    const seeds = extractor.extract('+5% 平一半，+10% 平剩下')
    expect(seeds.risk[0].params.tiers).toEqual([
      { trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 },
      { trigger: { kind: 'pnl_pct', threshold: 10 }, reduceRatio: 1.0 },
    ])
  })

  it('parses English form', () => {
    const seeds = extractor.extract('Take profit 50% at +5%, 50% at +10%')
    expect(seeds.risk[0].params.tiers).toEqual([
      { trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 },
      { trigger: { kind: 'pnl_pct', threshold: 10 }, reduceRatio: 0.5 },
    ])
  })

  it('parses "第一档/第二档" structured form', () => {
    const seeds = extractor.extract('分两档止盈，第一档 +3% 减 30%，第二档 +6% 减 70%')
    expect(seeds.risk[0].params.tiers).toEqual([
      { trigger: { kind: 'pnl_pct', threshold: 3 }, reduceRatio: 0.3 },
      { trigger: { kind: 'pnl_pct', threshold: 6 }, reduceRatio: 0.7 },
    ])
  })

  it('falls back to openSlot when phrase recognized but tiers unparseable', () => {
    const seeds = extractor.extract('设置分批止盈')
    expect(seeds.risk[0]).toMatchObject({
      key: 'risk.partial_take_profit',
      status: 'open_slot',
      openSlots: expect.arrayContaining([
        expect.objectContaining({ slotKey: 'risk.partial_take_profit.tiers' }),
      ]),
    })
  })
})
```

- [ ] **Step 2: Verify failing**

Run: `dx test unit quantify -t 'partial take profit tiers'`
Expected: FAIL — extractor 仍只 capture sourceText

- [ ] **Step 3: Implement tier parser**

In `semantic-seed-extractor.service.ts`, 替换 line 1342 附近的现有 partial_take_profit 短语检测块为 tier 解析：

```ts
private extractPartialTakeProfitTiers(clause: string): Array<{ trigger: { kind: 'pnl_pct'; threshold: number }; reduceRatio: number }> | null {
  // 模式 1: "盈利 X% 平 Y%" / "盈利 X% 平一半/剩下" 中文
  const cnPattern = /(?:盈利|赚)\s*\+?\s*(\d+(?:\.\d+)?)\s*%\s*[，,、和]?\s*(?:平|减|止盈)\s*(\d+(?:\.\d+)?)\s*%/giu
  // 模式 2: "+X% 平一半 / 剩下"
  const cnColloqPattern = /\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:平|减)\s*(?:(\d+(?:\.\d+)?)\s*%|(一半|剩下|全部|全平))/giu
  // 模式 3: 英文 "Y% at +X%"
  const enPattern = /(\d+(?:\.\d+)?)\s*%\s*(?:at|@)\s*\+?\s*(\d+(?:\.\d+)?)\s*%/giu
  // 模式 4: "第N档 +X% 减 Y%"
  const tierPattern = /第[一二三四五六七八九十]档\s*\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:减|平)\s*(\d+(?:\.\d+)?)\s*%/giu

  const tiers: Array<{ trigger: { kind: 'pnl_pct'; threshold: number }; reduceRatio: number }> = []

  // 优先按 tier 模式匹配（最具结构）
  let match
  while ((match = tierPattern.exec(clause)) !== null) {
    tiers.push({
      trigger: { kind: 'pnl_pct', threshold: Number(match[1]) },
      reduceRatio: Number(match[2]) / 100,
    })
  }
  if (tiers.length > 0) return this.normalizePartialTakeProfitTiers(tiers)

  // 中文显式比例
  while ((match = cnPattern.exec(clause)) !== null) {
    tiers.push({
      trigger: { kind: 'pnl_pct', threshold: Number(match[1]) },
      reduceRatio: Number(match[2]) / 100,
    })
  }
  if (tiers.length > 0) return this.normalizePartialTakeProfitTiers(tiers)

  // 中文口语
  while ((match = cnColloqPattern.exec(clause)) !== null) {
    const threshold = Number(match[1])
    const ratioPct = match[2] ? Number(match[2]) : null
    const colloquial = match[3] ?? null
    const reduceRatio = ratioPct !== null ? ratioPct / 100
      : (colloquial === '一半' ? 0.5 : 1.0)
    tiers.push({ trigger: { kind: 'pnl_pct', threshold }, reduceRatio })
  }
  if (tiers.length > 0) return this.normalizePartialTakeProfitTiers(tiers)

  // 英文 (Y% at +X%): 先 extract 所有，再按 threshold 排序
  while ((match = enPattern.exec(clause)) !== null) {
    tiers.push({
      trigger: { kind: 'pnl_pct', threshold: Number(match[2]) },
      reduceRatio: Number(match[1]) / 100,
    })
  }
  if (tiers.length > 0) return this.normalizePartialTakeProfitTiers(tiers)

  return null
}

private normalizePartialTakeProfitTiers(
  tiers: Array<{ trigger: { kind: 'pnl_pct'; threshold: number }; reduceRatio: number }>,
): Array<{ trigger: { kind: 'pnl_pct'; threshold: number }; reduceRatio: number }> | null {
  // 按 threshold 升序
  const sorted = [...tiers].sort((a, b) => a.trigger.threshold - b.trigger.threshold)
  // 校验：threshold 严格递增
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].trigger.threshold <= sorted[i - 1].trigger.threshold) return null
  }
  // 校验：reduceRatio 范围 + 总和
  let sum = 0
  for (const tier of sorted) {
    if (!Number.isFinite(tier.reduceRatio) || tier.reduceRatio <= 0 || tier.reduceRatio > 1) return null
    sum += tier.reduceRatio
  }
  if (sum > 1.000001) return null  // 浮点容差
  return sorted
}
```

替换原 line 1342 块为：
```ts
if (/(?:分批止盈|部分止盈|多档止盈|平一半|scale\s*out|take\s*profit)/iu.test(clause)) {
  const tiers = this.extractPartialTakeProfitTiers(clause)
  if (tiers && tiers.length > 0) {
    this.pushRisk(risk, {
      key: 'risk.partial_take_profit',
      params: { tiers, sourceText: clause },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    })
  }
  else {
    this.pushRisk(risk, {
      key: 'risk.partial_take_profit',
      params: { sourceText: clause },
      status: 'open_slot',
      source: 'user_explicit',
      openSlots: [{
        slotKey: 'risk.partial_take_profit.tiers',
        question: '请说明分批止盈每档的触发条件（PnL 百分比）和减仓比例',
      }],
    })
  }
}
```

- [ ] **Step 4: Verify pass**

Run: `dx test unit quantify -t 'partial take profit tiers'`
Expected: 5 case 全 PASS

- [ ] **Step 5: Run full extractor spec — confirm no regression**

Run: `dx test unit quantify -t 'semantic-seed-extractor'`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts \
        apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): seed extractor parses partial take profit tiers

- 4 类用户表达模式（中文显式 / 中文口语 / 英文 / 第N档）
- 不可解析时进入 open_slot
- 校验 threshold 严格递增、reduceRatio 范围、总和 ≤ 1

Refs: #984
MSG
```

---

## Task 4: State Builder memoryKey Generation

**Goal:** seed 进 builder 时为每个 partial_take_profit atom 生成稳定的 `memoryKey`（`partial_tp_<8-char-hash>`）。

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
it('assigns stable memoryKey to partial_take_profit risk atom', () => {
  const builder = new SemanticSeedStateBuilderService()
  const seedA = {
    risk: [{
      key: 'risk.partial_take_profit',
      params: {
        tiers: [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }],
      },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }],
    triggers: [],
    actions: [],
    position: [],
    contextSlots: {},
  }
  const stateA = builder.build(seedA)
  expect(stateA.risk[0].params.memoryKey).toMatch(/^partial_tp_[a-f0-9]{8}$/)

  // Same input → same memoryKey (stable hash from tiers + sourceText)
  const stateA2 = builder.build(seedA)
  expect(stateA2.risk[0].params.memoryKey).toBe(stateA.risk[0].params.memoryKey)
})
```

- [ ] **Step 2: Verify failing**

Run: `dx test unit quantify -t 'assigns stable memoryKey to partial_take_profit'`
Expected: FAIL

- [ ] **Step 3: Implement memoryKey generation**

In `semantic-seed-state-builder.service.ts`, 在 risk seed 路由处增加 partial_take_profit 分支：

```ts
import { createHash } from 'crypto'

// 在 build risk path:
if (seed.key === 'risk.partial_take_profit') {
  const tiersJson = JSON.stringify(seed.params.tiers ?? [])
  const sourceText = typeof seed.params.sourceText === 'string' ? seed.params.sourceText : ''
  const hash = createHash('sha256').update(`${tiersJson}|${sourceText}`).digest('hex').slice(0, 8)
  return {
    ...seed,
    params: {
      ...seed.params,
      memoryKey: `partial_tp_${hash}`,
    },
  }
}
```

- [ ] **Step 4: Verify pass**

Run: `dx test unit quantify -t 'assigns stable memoryKey'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts \
        apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): generate stable memoryKey for partial take profit seeds

memoryKey = 'partial_tp_' + sha256(tiers + sourceText).slice(0, 8)

Refs: #984
MSG
```

---

## Task 5: Canonical Spec Builder per-tier Rule + derivedRatio

**Goal:** N-tier atom 在 canonical spec 输出 N 条 risk-phase rule，每条 actions 含 REDUCE_LONG/REDUCE_SHORT（按 sideScope 决定单/双），sizing.value = derivedRatio_i × 100。

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts`（rule.metadata.partialTakeProfit 字段）
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`

- [ ] **Step 1: Extend CanonicalRuleV2 metadata type**

In `canonical-strategy-spec-v2.ts`，找到 rule metadata 字段定义，扩展：

```ts
export interface CanonicalRuleV2 {
  // ... 既有字段
  metadata?: {
    riskKey?: string
    guard?: string
    cancelOrders?: boolean
    partialTakeProfit?: {
      memoryKey: string
      tierIndex: number
      totalTiers: number
    }
  }
}
```

- [ ] **Step 2: Write failing test — derivedRatio + per-tier rule + sideScope**

```ts
describe('partial take profit canonical rules', () => {
  it('builds N rules with derivedRatio for [{0.5, 0.5}]', () => {
    const builder = new CanonicalSpecBuilderService()
    const semanticState: SemanticState = {
      // ... minimal valid state with one partial_take_profit risk atom
      risk: [{
        id: 'r1',
        key: 'risk.partial_take_profit',
        params: {
          memoryKey: 'partial_tp_abcd1234',
          tiers: [
            { trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 },
            { trigger: { kind: 'pnl_pct', threshold: 10 }, reduceRatio: 0.5 },
          ],
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      triggers: [], actions: [{ id:'a1', key:'open_long', status:'locked', source:'user_explicit' }],
      position: [{ id:'p1', key:'position.fixed_pct', params:{value:10}, status:'locked', source:'user_explicit', openSlots:[] }],
      contextSlots: {/*...minimal*/},
      normalizationNotes: [],
      updatedAt: '2026-05-07T00:00:00.000Z',
    }
    const spec = builder.buildFromSemanticState(semanticState)
    const ptpRules = spec.rules.filter(r => r.metadata?.partialTakeProfit)
    expect(ptpRules).toHaveLength(2)
    expect(ptpRules[0]).toMatchObject({
      phase: 'risk',
      condition: expect.objectContaining({
        kind: 'atom',
        key: 'risk.partial_take_profit',
        op: 'GTE',
        value: 5,
        params: expect.objectContaining({ tierIndex: 0, totalTiers: 2, memoryKey: 'partial_tp_abcd1234', basis: 'pnl_pct' }),
      }),
      actions: expect.arrayContaining([
        expect.objectContaining({ type: 'REDUCE_LONG', sizing: { mode: 'RATIO', value: 0.5 } }),
        expect.objectContaining({ type: 'REDUCE_SHORT', sizing: { mode: 'RATIO', value: 0.5 } }),
      ]),
      metadata: expect.objectContaining({ partialTakeProfit: { memoryKey:'partial_tp_abcd1234', tierIndex: 0, totalTiers: 2 } }),
    })
    expect(ptpRules[1].condition.value).toBe(10)
    expect(ptpRules[1].actions[0].sizing.value).toBeCloseTo(1.0, 6)  // derivedRatio_1 = 0.5 / 0.5 = 1.0
  })

  it('derivedRatio for [{0.3, 0.5, 0.2}] sums to 1', () => {
    const builder = new CanonicalSpecBuilderService()
    const semanticState = makePartialTakeProfitSemanticState({
      memoryKey: 'partial_tp_three',
      tiers: [
        { trigger: { kind: 'pnl_pct', threshold: 3 }, reduceRatio: 0.3 },
        { trigger: { kind: 'pnl_pct', threshold: 6 }, reduceRatio: 0.5 },
        { trigger: { kind: 'pnl_pct', threshold: 9 }, reduceRatio: 0.2 },
      ],
    })
    const spec = builder.buildFromSemanticState(semanticState)
    const ptpRules = spec.rules.filter(r => r.metadata?.partialTakeProfit)
    expect(ptpRules).toHaveLength(3)
    expect(ptpRules[0].actions[0].sizing.value).toBeCloseTo(0.3, 6)
    expect(ptpRules[1].actions[0].sizing.value).toBeCloseTo(0.5 / 0.7, 6)
    expect(ptpRules[2].actions[0].sizing.value).toBeCloseTo(1.0, 6)
  })

  it('respects sideScope=long by emitting only REDUCE_LONG', () => {
    const builder = new CanonicalSpecBuilderService()
    const semanticState = makePartialTakeProfitSemanticState({
      memoryKey: 'partial_tp_long',
      tiers: [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }],
      sideScope: 'long',
    })
    const spec = builder.buildFromSemanticState(semanticState)
    const ptpRule = spec.rules.find(r => r.metadata?.partialTakeProfit)!
    expect(ptpRule.actions.map(a => a.type)).toEqual(['REDUCE_LONG'])
  })
})

// 共享 fixture helper（放在 spec 文件顶部 describe 外）
function makePartialTakeProfitSemanticState(opts: {
  memoryKey: string
  tiers: Array<{ trigger: { kind: 'pnl_pct'; threshold: number }; reduceRatio: number }>
  sideScope?: 'long' | 'short' | 'both'
}): SemanticState {
  return {
    risk: [{
      id: 'r-ptp',
      key: 'risk.partial_take_profit',
      params: {
        memoryKey: opts.memoryKey,
        tiers: opts.tiers,
      },
      sideScope: opts.sideScope ?? 'both',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }],
    triggers: [{
      id: 't-ma',
      key: 'indicator.cross_over',
      phase: 'entry',
      sideScope: 'long',
      params: { indicator: 'sma' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }],
    actions: [{ id: 'a1', key: 'open_long', status: 'locked', source: 'user_explicit' }],
    position: [{
      id: 'p1', key: 'position.fixed_pct', params: { value: 10 },
      status: 'locked', source: 'user_explicit', openSlots: [],
    }],
    contextSlots: {
      exchange: { value: 'binance', status: 'locked', source: 'user_explicit' },
      symbol: { value: 'BTCUSDT', status: 'locked', source: 'user_explicit' },
      marketType: { value: 'perp', status: 'locked', source: 'user_explicit' },
      timeframe: { value: '15m', status: 'locked', source: 'user_explicit' },
    },
    normalizationNotes: [],
    updatedAt: '2026-05-07T00:00:00.000Z',
  }
}
```

- [ ] **Step 3: Verify failing**

Run: `dx test unit quantify -t 'partial take profit canonical rules'`
Expected: FAIL

- [ ] **Step 4: Implement builder path**

In `canonical-spec-builder.service.ts`，在 `buildRiskRulesFromSemanticState` (line ~3157 附近) 加分支：

```ts
if (riskAtom.key === 'risk.partial_take_profit') {
  return this.buildPartialTakeProfitRules(riskAtom, sizing)
}
```

新方法：

```ts
private buildPartialTakeProfitRules(
  atom: SemanticRiskState,
  sizing: CanonicalStrategySpecV2['sizing'],
): CanonicalRuleV2[] {
  const memoryKey = typeof atom.params.memoryKey === 'string' ? atom.params.memoryKey : null
  const tiers = Array.isArray(atom.params.tiers) ? atom.params.tiers : null
  if (!memoryKey || !tiers || tiers.length === 0) return []

  const sideScope: CanonicalRuleSideScope = atom.sideScope ?? 'both'
  const totalTiers = tiers.length
  const derivedRatios = this.deriveCumulativeReduceRatios(tiers.map(t => t.reduceRatio))

  return tiers.map((tier, i) => {
    const actions: CanonicalRuleV2['actions'] = []
    const sizing = { mode: 'RATIO' as const, value: Number(derivedRatios[i].toFixed(6)) }
    if (sideScope === 'long' || sideScope === 'both') actions.push({ type: 'REDUCE_LONG', sizing })
    if (sideScope === 'short' || sideScope === 'both') actions.push({ type: 'REDUCE_SHORT', sizing })

    return {
      id: `semantic-risk-ptp-${memoryKey}-tier-${i}`,
      phase: 'risk' as const,
      sideScope,
      priority: this.resolveSemanticRulePriority('risk', i + 1),
      condition: {
        kind: 'atom' as const,
        key: 'risk.partial_take_profit',
        semanticScope: 'position' as const,
        op: 'GTE' as const,
        value: tier.trigger.threshold,
        params: { tierIndex: i, totalTiers, memoryKey, basis: 'pnl_pct' },
      },
      actions,
      metadata: { partialTakeProfit: { memoryKey, tierIndex: i, totalTiers } },
    }
  })
}

private deriveCumulativeReduceRatios(originalRatios: number[]): number[] {
  const result: number[] = []
  let consumedOfOriginal = 0
  for (const ratio of originalRatios) {
    const remaining = 1 - consumedOfOriginal
    if (remaining <= 0) {
      result.push(0)
      continue
    }
    const derived = Math.min(1, ratio / remaining)
    result.push(derived)
    consumedOfOriginal += ratio
  }
  return result
}
```

- [ ] **Step 5: Verify all 3 cases pass**

Run: `dx test unit quantify -t 'partial take profit canonical rules'`
Expected: PASS

- [ ] **Step 6: Confirm legacy snapshots byte-equal**

Run: `dx test unit quantify -t 'canonical-spec-builder'`
Expected: 全 PASS（不含 partial_take_profit 的既有 fixture 的 snapshot byte-equal）

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts \
        apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts \
        apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): emit per-tier risk rules for partial take profit

- N-tier atom → N risk-phase rules
- derivedRatio: 用户"% of original"通过累积换算成 position_pct（运行时"% of remaining"）
- sideScope=long/short/both 决定 REDUCE 动作单/双
- rule.metadata.partialTakeProfit 携带 memoryKey/tierIndex/totalTiers

Refs: #984
MSG
```

---

## Task 6: IR Compile Reduce-Action Rule → Exit Decision Program

**Goal:** 在 canonical-spec-v2-ir-compiler 加 `tryCompileReduceActionRule` 路径，把 risk-phase + REDUCE actions + key=risk.partial_take_profit 的 rule 编译为 exit-phase decision program；exprPool 含 POSITION_PNL_PCT + CONST + GTE predicate。

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts`（DecisionProgramDef.metadata.partialTakeProfit）
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts`

- [ ] **Step 1: Extend DecisionProgramDef metadata type**

In `canonical-strategy-ir.ts`：

```ts
export interface DecisionProgramDef {
  id: string
  phase: 'entry' | 'exit' | 'rebalance'
  priority: number
  when: string
  cooldownBars?: number
  actions: ActionDef[]
  metadata?: {
    partialTakeProfit?: {
      memoryKey: string
      tierIndex: number
      totalTiers: number
    }
  }
}
```

- [ ] **Step 2: Write failing test**

```ts
describe('partial take profit ir compile', () => {
  it('compiles N risk rules into N exit decision programs with POSITION_PNL_PCT predicates', () => {
    const builder = new CanonicalSpecBuilderService()
    const compiler = new CanonicalSpecV2IrCompilerService()
    const semanticState: SemanticState = /* state with [{0.5, 0.5}] tiers, memoryKey 'partial_tp_test' */
    const canonicalSpec = builder.buildFromSemanticState(semanticState)
    const result = compiler.compile({ canonicalSpec, fallback: { exchange:'binance', symbol:'BTCUSDT', baseTimeframe:'15m', positionPct: 10 } })

    const ptpPrograms = result.ir.signalCatalog.decisionPrograms.filter(p => p.metadata?.partialTakeProfit)
    expect(ptpPrograms).toHaveLength(2)
    expect(ptpPrograms[0]).toMatchObject({
      phase: 'exit',
      metadata: { partialTakeProfit: { memoryKey: 'partial_tp_test', tierIndex: 0, totalTiers: 2 } },
      actions: expect.arrayContaining([
        expect.objectContaining({ kind: 'REDUCE_LONG', quantity: { mode: 'position_pct', value: 50 } }),
      ]),
    })
    expect(ptpPrograms[1].actions[0].quantity.value).toBe(100)  // derived 1.0 → 100%

    // Predicate refs valid
    const pred0 = result.ir.signalCatalog.predicates.find(p => p.id === ptpPrograms[0].when)
    expect(pred0).toMatchObject({ kind: 'GTE' })
    const pnlSeries = result.ir.signalCatalog.exprPool.find(s => s.id === pred0!.args[0])
    expect(pnlSeries?.payload?.kind).toBe('POSITION_PNL_PCT')
  })

  it('does not affect ir for specs without partial_take_profit', () => {
    // 旧 fixture：byte-equal regression
  })
})
```

- [ ] **Step 3: Verify failing**

Run: `dx test unit quantify -t 'partial take profit ir compile'`
Expected: FAIL

- [ ] **Step 4: Implement tryCompileReduceActionRule**

In `canonical-spec-v2-ir-compiler.service.ts`，在 buildIr 主循环里，处理 rule 的 switch 加分支（见 line 155 附近 `tryCompileRiskGuards`）：

```ts
// 在 risk-phase rule 处理路径中
if (rule.phase === 'risk') {
  const ptpProgram = this.tryCompileReduceActionRule(rule, context)
  if (ptpProgram) {
    decisionPrograms.push(ptpProgram)
    decisionOrder.push(ptpProgram.id)
    continue
  }
  const compiledGuards = this.tryCompileRiskGuards(rule, context)
  // ... existing guard path
}
```

新方法：

```ts
private tryCompileReduceActionRule(
  rule: CanonicalRuleV2,
  context: CompileContext,
): DecisionProgramDef | null {
  const ptpMeta = rule.metadata?.partialTakeProfit
  if (!ptpMeta || rule.condition.kind !== 'atom' || rule.condition.key !== 'risk.partial_take_profit') {
    return null
  }
  if (!rule.actions.some(a => a.type === 'REDUCE_LONG' || a.type === 'REDUCE_SHORT')) return null

  const threshold = this.readNumber([rule.condition.value], Number.NaN)
  if (!Number.isFinite(threshold)) return null

  const pnlSeriesId = this.ensurePositionSeries(context, 'POSITION_PNL_PCT', 'position_pnl_pct')
  const constSeriesId = this.ensureConstSeries(context, threshold)
  const predicateRef = this.upsertPredicate(
    context.predicateMap,
    `${rule.id}_pnl_gte`,
    'GTE',
    [pnlSeriesId, constSeriesId],
  )

  const actions: ActionDef[] = rule.actions
    .filter(a => a.type === 'REDUCE_LONG' || a.type === 'REDUCE_SHORT')
    .map(a => ({
      kind: a.type as 'REDUCE_LONG' | 'REDUCE_SHORT',
      quantity: {
        mode: 'position_pct' as const,
        value: Number(((a.sizing?.value ?? 0) * 100).toFixed(6)),
      },
    }))

  return {
    id: `program_ptp_${ptpMeta.memoryKey}_tier_${ptpMeta.tierIndex}`,
    phase: 'exit',
    priority: rule.priority,
    when: predicateRef,
    metadata: { partialTakeProfit: { ...ptpMeta } },
    actions,
  }
}
```

- [ ] **Step 5: Verify pass**

Run: `dx test unit quantify -t 'partial take profit ir compile'`
Expected: PASS

- [ ] **Step 6: Confirm legacy IR snapshots byte-equal**

Run: `dx test unit quantify -t 'canonical-spec-v2-ir-compiler'`
Expected: 不含 partial_take_profit 的既有 fixture 全 PASS

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts \
        apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts \
        apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): compile partial take profit risk rules into exit decision programs

- 新增 tryCompileReduceActionRule 路径
- 每档 → 一个 exit-phase decision program with POSITION_PNL_PCT GTE threshold
- quantity.mode='position_pct' value=derivedRatio×100（运行时"% of remaining"等价）
- DecisionProgramDef.metadata.partialTakeProfit 透传 memoryKey/tierIndex/totalTiers

Refs: #984
MSG
```

---

## Task 7: compiled-runtime tier_fired Gate + Entry Edge Reset

**Goal:** run-decision-programs 加 partial_take_profit 检测——已 fired tier 跳过；fire 时写状态；position 0→非0 边沿 reset。

**Files:**
- Modify: `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts`
- Test: `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.spec.ts`（创建或扩充）

- [ ] **Step 1: Write failing test — tier_fired gate**

```ts
describe('partial take profit decision gate', () => {
  it('skips program whose tier is already fired', () => {
    const ctx: any = {
      position: { qty: 1 },
      semanticRuntimeState: {
        partial_tp_test: { tier_0_fired: true },
      },
    }
    const programs = [{
      id: 'program_ptp_partial_tp_test_tier_0',
      phase: 'exit',
      priority: 100,
      when: 'predicate_threshold_met',
      metadata: { partialTakeProfit: { memoryKey: 'partial_tp_test', tierIndex: 0, totalTiers: 2 } },
      actions: [{ kind: 'REDUCE_LONG', quantity: { mode: 'position_pct', value: 50 } }],
    }]
    const exprValues = { predicate_threshold_met: true }
    const guardState = { forceExit: false, blockNewEntry: false, strategyHalt: false }
    const decision = runDecisionPrograms(ctx, programs, exprValues, guardState, ['program_ptp_partial_tp_test_tier_0'])
    expect(decision.action).toBe('NOOP')
  })

  it('fires unfired tier and writes tier_fired=true', () => {
    const ctx: any = {
      position: { qty: 1 },
      semanticRuntimeState: { partial_tp_test: {} },
    }
    const programs = [/* same as above */]
    const decision = runDecisionPrograms(ctx, programs, { predicate_threshold_met: true }, /*guard*/ {}, [programs[0].id])
    expect(decision.action).toBe('ADJUST_POSITION')
    expect(ctx.semanticRuntimeState.partial_tp_test.tier_0_fired).toBe(true)
  })

  it('resets all partial_take_profit state on entry edge (qty 0 → non-0)', () => {
    const ctx: any = {
      position: { qty: 1 },
      __compiledDecisionState: { previousPositionQty: 0, lastTriggeredByProgram: {}, barIndex: 0 },
      semanticRuntimeState: {
        partial_tp_a: { tier_0_fired: true, tier_1_fired: true },
        partial_tp_b: { tier_0_fired: true },
        unrelated_state: { foo: 'bar' },
      },
    }
    runDecisionPrograms(ctx, [], {}, {}, [])
    expect(ctx.semanticRuntimeState.partial_tp_a).toEqual({})
    expect(ctx.semanticRuntimeState.partial_tp_b).toEqual({})
    expect(ctx.semanticRuntimeState.unrelated_state).toEqual({ foo: 'bar' })  // 不动其他 key
    expect(ctx.__compiledDecisionState.previousPositionQty).toBe(1)
  })
})
```

- [ ] **Step 2: Verify failing**

Run: `npx nx test shared --testPathPattern=run-decision-programs`
Expected: FAIL

- [ ] **Step 3: Implement gate + reset + state mutation**

In `run-decision-programs.ts`，扩展 `ensureCompiledDecisionState` 含 `previousPositionQty`；在 `runDecisionPrograms` 主循环前加 entry edge 检测；在程序循环里加 ptp gate 与 fire 写回。

```ts
function ensureCompiledDecisionState(
  ctx: StrategyExecutionContextV1,
): {
  barIndex: number
  lastTriggeredByProgram: Record<string, number>
  previousPositionQty: number
} {
  // 沿用现有结构，增 previousPositionQty 字段
  const current = (ctx as Record<string, unknown>).__compiledDecisionState
  if (
    current
    && typeof current === 'object'
    && !Array.isArray(current)
    && typeof (current as { barIndex?: unknown }).barIndex === 'number'
  ) {
    const c = current as { barIndex: number; lastTriggeredByProgram: Record<string, number>; previousPositionQty?: number }
    if (typeof c.previousPositionQty !== 'number') c.previousPositionQty = 0
    return c as { barIndex: number; lastTriggeredByProgram: Record<string, number>; previousPositionQty: number }
  }
  const fallback = { barIndex: 0, lastTriggeredByProgram: {} as Record<string, number>, previousPositionQty: 0 }
  ;(ctx as Record<string, unknown>).__compiledDecisionState = fallback
  return fallback
}

function resetPartialTakeProfitStateOnEntryEdge(
  ctx: StrategyExecutionContextV1,
  compiledState: ReturnType<typeof ensureCompiledDecisionState>,
): void {
  const currentQty = readCurrentQty(ctx)
  const prevQty = compiledState.previousPositionQty
  if (prevQty === 0 && currentQty !== 0) {
    const semanticState = (ctx as { semanticRuntimeState?: Record<string, Record<string, unknown>> }).semanticRuntimeState
    if (semanticState && typeof semanticState === 'object') {
      for (const key of Object.keys(semanticState)) {
        if (key.startsWith('partial_tp_')) {
          semanticState[key] = {}
        }
      }
    }
  }
  compiledState.previousPositionQty = currentQty
}

function isPartialTakeProfitTierFired(
  ctx: StrategyExecutionContextV1,
  meta: { memoryKey: string; tierIndex: number },
): boolean {
  const state = (ctx as { semanticRuntimeState?: Record<string, Record<string, unknown>> }).semanticRuntimeState?.[meta.memoryKey]
  return state?.[`tier_${meta.tierIndex}_fired`] === true
}

function markPartialTakeProfitTierFired(
  ctx: StrategyExecutionContextV1,
  meta: { memoryKey: string; tierIndex: number },
): void {
  const root = ctx as { semanticRuntimeState?: Record<string, Record<string, unknown>> }
  if (!root.semanticRuntimeState) root.semanticRuntimeState = {}
  if (!root.semanticRuntimeState[meta.memoryKey]) root.semanticRuntimeState[meta.memoryKey] = {}
  root.semanticRuntimeState[meta.memoryKey][`tier_${meta.tierIndex}_fired`] = true
}
```

修改 `runDecisionPrograms`：

```ts
export function runDecisionPrograms(
  ctx: StrategyExecutionContextV1,
  programs: readonly DecisionProgramNode[],
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
  guardState: Readonly<CompiledGuardState>,
  decisionOrder: readonly string[],
): Readonly<StrategyDecisionV1> {
  const compiledState = ensureCompiledDecisionState(ctx)
  resetPartialTakeProfitStateOnEntryEdge(ctx, compiledState)

  // ... existing forceExit / strategyHalt path

  for (const program of orderedPrograms) {
    if (program.phase === 'entry' && guardState.blockNewEntry) continue

    // 既有 cooldown 检测

    if (exprValues[program.when] !== true) continue

    // partial_take_profit gate：已 fired 跳过
    const ptpMeta = (program as DecisionProgramNode & { metadata?: { partialTakeProfit?: { memoryKey: string; tierIndex: number; totalTiers: number } } }).metadata?.partialTakeProfit
    if (ptpMeta && isPartialTakeProfitTierFired(ctx, ptpMeta)) continue

    const decision = buildFirstApplicableDecision(program, ctx)
    if (!decision) continue

    compiledState.lastTriggeredByProgram[program.id] = compiledState.barIndex
    if (ptpMeta) {
      markPartialTakeProfitTierFired(ctx, ptpMeta)
    }
    return Object.freeze(decision)
  }

  return Object.freeze({ action: 'NOOP', reason: 'compiled.noop' })
}
```

`DecisionProgramNode` 类型加 metadata 字段：

```ts
interface DecisionProgramNode {
  id: string
  phase: 'entry' | 'exit' | 'rebalance'
  priority: number
  when: string
  cooldownBars?: number
  metadata?: {
    partialTakeProfit?: { memoryKey: string; tierIndex: number; totalTiers: number }
  }
  actions: Array<{ /* ... */ }>
}
```

- [ ] **Step 4: Verify pass**

Run: `npx nx test shared --testPathPattern=run-decision-programs`
Expected: 3 case PASS

- [ ] **Step 5: Confirm shared full test green**

Run: `npx nx test shared`
Expected: 全 PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts \
        packages/shared/src/script-engine/compiled-runtime/run-decision-programs.spec.ts
git commit -F - <<'MSG'
feat(shared): partial take profit tier state in decision programs

- ensureCompiledDecisionState 增 previousPositionQty 字段
- resetPartialTakeProfitStateOnEntryEdge：position 0→非0 时清空所有 partial_tp_* 状态
- isPartialTakeProfitTierFired / markPartialTakeProfitTierFired helper
- runDecisionPrograms 主循环识别 metadata.partialTakeProfit 决策 gate

Refs: #984
MSG
```

---

## Task 8: Parity Spec — backtest 与 live signal 路径决策序列 byte-equal

**Goal:** 在 atomic-contract-backtest-runtime-parity.spec.ts 追加 6 case 验证 partial_take_profit 在两路径决策序列一致。

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts`

- [ ] **Step 1: Write 6 case in describe('phase-1 partial take profit parity', ...)**

每 case 共享下列模板（参考 spec 文件既有 parity case 的 fixture 风格，用相同 OHLCV + position state 序列同时跑 backtest 与 live signal 两路径，断言 decision 序列 byte-equal）：

```ts
describe('phase-1 partial take profit parity', () => {
  it('case 1: 单档 50% 在阈值 bar 触发后停止', () => {
    const semanticState = makePartialTakeProfitSemanticState({
      memoryKey: 'partial_tp_p1',
      tiers: [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }],
    })
    const bars: Bar[] = [
      // 进场 bar，PnL=0
      { open: 100, high: 100, low: 100, close: 100, volume: 1, timestamp: 0 },
      // PnL=3% < 5% 不触发
      { open: 100, high: 103, low: 100, close: 103, volume: 1, timestamp: 60_000 },
      // PnL=6% >= 5% 触发 T1，REDUCE 50%
      { open: 103, high: 106, low: 103, close: 106, volume: 1, timestamp: 120_000 },
      // PnL=8% T1 已 fire 不再触发
      { open: 106, high: 108, low: 106, close: 108, volume: 1, timestamp: 180_000 },
    ]
    const initialPosition = { qty: 1, avgEntryPrice: 100 }

    const backtestDecisions = runBacktest(semanticState, bars, initialPosition)
    const liveDecisions = runLiveSignal(semanticState, bars, initialPosition)
    expect(backtestDecisions).toEqual(liveDecisions)

    // 额外断言行为正确性（不仅仅 parity）
    expect(backtestDecisions[2]).toMatchObject({ action: 'ADJUST_POSITION' })
    expect(backtestDecisions[3]).toMatchObject({ action: 'NOOP' })
  })

  it('case 2: 双档 50/50 在两 bar 跨阈值各 fire 一次', () => {
    const semanticState = makePartialTakeProfitSemanticState({
      memoryKey: 'partial_tp_p2',
      tiers: [
        { trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 },
        { trigger: { kind: 'pnl_pct', threshold: 10 }, reduceRatio: 0.5 },
      ],
    })
    const bars: Bar[] = [
      { open: 100, high: 100, low: 100, close: 100, volume: 1, timestamp: 0 },
      { open: 100, high: 106, low: 100, close: 106, volume: 1, timestamp: 60_000 }, // T1 fire
      { open: 106, high: 108, low: 106, close: 108, volume: 1, timestamp: 120_000 }, // PnL=8% < 10% 不触发
      { open: 108, high: 112, low: 108, close: 112, volume: 1, timestamp: 180_000 }, // T2 fire（剩余仓 100%）
    ]
    const decisions = runBacktest(semanticState, bars, { qty: 1, avgEntryPrice: 100 })
    expect(decisions[1]).toMatchObject({ action: 'ADJUST_POSITION' })  // T1 fire
    expect(decisions[3]).toMatchObject({ action: 'ADJUST_POSITION' })  // T2 fire (清仓)
  })

  it('case 3: 双档 sum<1 [{0.3, 0.5}] 终态保留 20%', () => {
    // 同模板，tiers [{th:5, r:0.3},{th:10, r:0.5}]
    // 验证 T1 fire reduceRatio=0.3，T2 fire derivedRatio=0.5/0.7≈0.714
    // 终态 qty 应当为入场 qty × (1 - 0.3) × (1 - 0.714) ≈ 入场 × 0.2
  })

  it('case 4: 价格反复 PnL 5%→7%→4%→8% T1 在第一根 fire 仅一次', () => {
    // bars: PnL 序列 0%, 5%, 7%, 4%, 8%
    // 期望：T1 在 PnL=5% 那根 fire 一次；后续 PnL>5% 的 bar T1 不再 fire
  })

  it('case 5: close + reopen — 同 tier 重新可 fire', () => {
    // bars: 进场 → PnL=5% T1 fire → 平仓（qty=0）→ 重新开仓（qty 0→1）→ PnL=5% T1 再次 fire
    // entry edge reset 应清空 partial_tp_* 状态
  })

  it('case 6: sideScope=long short 持仓时不触发减仓', () => {
    const semanticState = makePartialTakeProfitSemanticState({
      memoryKey: 'partial_tp_p6',
      tiers: [{ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 }],
      sideScope: 'long',
    })
    // bars: 同 case 1 但 initialPosition.qty < 0（short）
    // 期望：所有 decision NOOP（IR 编译时仅 emit REDUCE_LONG，runtime resolveReduceDeltaQty 对 currentQty<0 返回 0）
    const decisions = runBacktest(semanticState, /* bars */, { qty: -1, avgEntryPrice: 100 })
    expect(decisions.every(d => d.action === 'NOOP')).toBe(true)
  })
})
```

`runBacktest` / `runLiveSignal`：复用既有 parity spec 文件的 helper（搜索"runBacktest|runLiveSignal"在该文件已有定义，按其签名调用）。`makePartialTakeProfitSemanticState`：复用 Task 5 加入 canonical-spec-builder.service.spec.ts 的 helper（如该 helper 不在此 spec 可见，复制一份，避免跨 spec import）。

- [ ] **Step 2: Verify failing**

Run: `dx test unit quantify -t 'phase-1 partial take profit parity'`
Expected: FAIL（如未编译路径）/ 或者 0 case

- [ ] **Step 3: 直接运行 — 因实现已就位（前 7 task 已完成），应当 PASS**

Run: `dx test unit quantify -t 'phase-1 partial take profit parity'`
Expected: 6 case PASS

- [ ] **Step 4: 如有 case 不 PASS，修对应实现层（task 1-7 中相关位置）后重跑**

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts
git commit -F - <<'MSG'
test(ai-quant): backtest live parity for partial take profit

6 case 覆盖：单档、双档、sum<1、PnL 反复、close+reopen、sideScope=long

Refs: #984
MSG
```

---

## Task 9: Corpus 增量 + Optional Readiness Regression

**Goal:** atom-coverage corpus 加 4 case；readiness（如适用）回归。

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts`
- Modify (如 corpus spec 需调): `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts`

- [ ] **Step 1: 加 4 case in golden-cases**

```ts
{
  id: 'partial-tp-2-tier-50-50',
  description: '盈利 5% 平 50%，盈利 10% 平 50%',
  expectedRoute: 'supported_executable',
  // ... fixture
},
{
  id: 'partial-tp-3-tier-30-50-20',
  description: '...',
  expectedRoute: 'supported_executable',
},
{
  id: 'partial-tp-phrase-only-no-tiers',
  description: '设置分批止盈',
  expectedRoute: 'supported_requires_slot',
},
{
  id: 'partial-tp-mix-with-unsupported',
  description: '分批止盈 + 某个 unsupported atom',
  expectedRoute: 'unsupported_unknown',
},
```

- [ ] **Step 2: Verify**

Run: `dx test unit quantify -t 'atom-coverage-golden-corpus'`
Expected: 全 PASS（旧 case 0 行为变化 + 新 4 case 路由正确）

- [ ] **Step 3: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts \
        apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts
git commit -F - <<'MSG'
test(ai-quant): extend coverage corpus with partial take profit cases

Refs: #984
MSG
```

---

## Task 10: E2E happy-path

**Goal:** 用户 prompt 含分批止盈 → 后端整链路 success，IR 含 partial_take_profit decision program。

**Files:**
- Modify: `apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`

- [ ] **Step 1: 加 1 case**

```ts
it('compiles partial take profit strategy end-to-end', async () => {
  const response = await request(app)
    .post('/llm-strategy-codegen/generate')
    .send({ prompt: 'BTC 4h MA 金叉做多，盈利 5% 平 50%，盈利 10% 平 50%' })
    .expect(200)
  expect(response.body.status).toBe('completed')
  // 断言 canonical IR 含 ≥ 2 partial_take_profit decision programs
  const programs = response.body.canonicalIr.signalCatalog.decisionPrograms
  expect(programs.filter((p:any) => p.metadata?.partialTakeProfit)).toHaveLength(2)
})
```

- [ ] **Step 2: 运行 E2E**

Run: `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen`
Expected: 新 case PASS

- [ ] **Step 3: Commit**

```bash
git add apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts
git commit -F - <<'MSG'
test(ai-quant): e2e happy path covers partial take profit atom

Refs: #984
MSG
```

---

## Task 11: 全验证流水线 + Ship

- [ ] **Step 1: 并行运行**

```bash
dx lint &
dx build quantify --dev &
npx nx build shared &
dx test unit quantify &
npx nx test shared &
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen &
dx build contracts --dev &
wait
```

Expected: 全部 exit 0；contracts diff 与 main baseline 一致（仅可能含落后 contracts 的微差异）

- [ ] **Step 2: 如 contracts 产出新 diff，commit 之**

```bash
git add packages/api-contracts/src/generated/
git commit -m "chore(api-contracts): regenerate quantify contracts for partial take profit"
```

- [ ] **Step 3: 通过 git-pr-ship skill 收口**

调用 `git-pr-ship` skill：commit / push / `gh pr create --base main` / critic PR diff / `gh pr merge --squash --auto`

PR body 必含：
- `Refs: #984`
- `Spec: docs/superpowers/specs/2026-05-07-ai-quant-phase1-partial-take-profit-design.md`
- `Plan: docs/superpowers/plans/2026-05-07-ai-quant-phase1-partial-take-profit.md`

- [ ] **Step 4: 等待 auto-merge 真正 merge 到 main**（auto-merge stuck > 30 min 人工介入）

---

## 关键不变量与红测对照（spec §6）

| # | 不变量 | 落到的 Task 红测 |
|---|---|---|
| I1 | tiers ratio 总和 ≤ 1，threshold 严格递增 | Task 3 normalizePartialTakeProfitTiers + builder 拒绝构造 |
| I2 | 旧 IR byte-equal | Task 6 Step 6 全 spec 跑 |
| I3 | derivedRatio 换算正确 | Task 5 Step 2 三 case |
| I4 | 单 bar 单档 fire，已 fire 不再触发 | Task 7 Step 1 + Task 8 case 4 |
| I5 | 入场边沿 reset | Task 7 Step 1 第三 case + Task 8 case 5 |
| I6 | sideScope 决定 REDUCE_LONG/SHORT 单/双 | Task 5 Step 2 第三 case + Task 8 case 6 |
| I7 | sum<1 时最后一档 derivedRatio<1（保留持仓） | Task 5 Step 2 第二 case (`[0.3, 0.5, 0.2]` derived `[0.3, 0.714, 1.0]`) |
| I8 | sum=1 时最后一档 derivedRatio=1（清仓） | Task 5 Step 2 第一 case (`[0.5, 0.5]` derived `[0.5, 1.0]`) |

## 回滚

| 粒度 | 触发 | 动作 |
|---|---|---|
| 单 atom | corpus / parity 不稳 | registry 退回 unsupported |
| Reduce-action 通道 | tryCompileReduceActionRule 在 IR 编译产出错误 | revert PR；既有 risk-phase rule guard 路径不受影响 |
| Runtime gate | run-decision-programs 改动产生 entry edge reset bug | 移除 resetPartialTakeProfitStateOnEntryEdge 调用，partial_tp_ key 无清理但其他 atom 不影响 |
| 整 PR | 大面积异常 | `git revert` PR commit |

不引入 feature flag（YAGNI）。

## 测试运行参考

| 指标 | 命令 |
|---|---|
| Lint | `dx lint` |
| Quantify build | `dx build quantify --dev` |
| Shared build | `npx nx build shared` |
| Quantify unit（按 case 名） | `dx test unit quantify -t '<name>'` |
| Shared unit | `npx nx test shared --testPathPattern=<filename>` |
| E2E | `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen` |
| Contracts | `dx build contracts --dev` |
| Migration | 无（PR-3 零 schema 变更） |
