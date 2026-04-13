# AI Quant Risk Rule Default Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI Quant treat stop-loss/take-profit percentage rules as defaulted risk semantics instead of mandatory basis questions, while keeping trigger-style percentage rules clarification-gated.

**Architecture:** Keep the existing `conversation -> checklist -> clarification gate -> canonical spec` flow intact and only tighten the semantics inside `apps/quantify/src/modules/llm-strategy-codegen`. Introduce a small rule-family/default-semantics helper, use it to narrow basis blockers, then project the adopted defaults into checklist summary and canonical risk rules. Do not reorder the main data flow and do not touch CI.

**Tech Stack:** NestJS, TypeScript, Jest, Quantify `llm-strategy-codegen` services, Prisma-backed session payloads, `dx`/Nx-backed Quantify unit tests.

---

## File Structure

### New files

- `apps/quantify/src/modules/llm-strategy-codegen/services/rule-family-default-semantics.ts`
  Central registry for percentage-rule family classification, default basis policy, and explicit risk-basis extraction from free text.
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rule-family-default-semantics.spec.ts`
  Locks the family/default behavior so future strategy families extend through one registry instead of scattered basis special-cases.

### Modified files

- `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
  Stop emitting `risk.stopLoss.basis` / `risk.takeProfit.basis` blockers for safe-default risk families while keeping trigger-family basis blockers intact.
- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  Backfill default stop-loss/take-profit basis into checklist state, preserve explicit overrides from natural language, and render richer clarification summaries.
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
  Backfill default risk basis when old or direct-build checklists arrive without explicit stop-loss/take-profit basis.
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`

## Task 1: Introduce Rule-Family Default Semantics Registry

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/rule-family-default-semantics.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rule-family-default-semantics.spec.ts`

- [ ] **Step 1: Write the failing helper spec for family classification and default basis policy**

```ts
import {
  classifyPercentageRuleFamily,
  extractExplicitRiskBasis,
  resolveDefaultRiskBasis,
} from '../rule-family-default-semantics'

describe('ruleFamilyDefaultSemantics', () => {
  it('treats stop-loss and take-profit percentages as safe-default risk families', () => {
    expect(classifyPercentageRuleFamily({
      phase: 'risk',
      rule: '止损 5%',
    })).toEqual(expect.objectContaining({
      family: 'risk.stop_loss_pct',
      defaultBasis: 'entry_avg_price',
      requiresUserBasis: false,
    }))

    expect(classifyPercentageRuleFamily({
      phase: 'risk',
      rule: '止盈 10%',
    })).toEqual(expect.objectContaining({
      family: 'risk.take_profit_pct',
      defaultBasis: 'entry_avg_price',
      requiresUserBasis: false,
    }))
  })

  it('keeps trigger percent-change rules clarification-gated', () => {
    expect(classifyPercentageRuleFamily({
      phase: 'entry',
      rule: '15 分钟上涨 1% 买入',
    })).toEqual(expect.objectContaining({
      family: 'trigger.percent_change',
      defaultBasis: null,
      requiresUserBasis: true,
    }))
  })

  it('extracts explicit non-default risk basis before applying defaults', () => {
    expect(extractExplicitRiskBasis('按持仓亏损 5% 止损')).toBe('position_pnl')
    expect(resolveDefaultRiskBasis('止损 5%', null)).toBe('entry_avg_price')
    expect(resolveDefaultRiskBasis('按持仓亏损 5% 止损', null)).toBe('position_pnl')
  })
})
```

- [ ] **Step 2: Run the new helper spec to verify the helper does not exist yet**

Run:

```bash
node scripts/dx/quantify-launcher.cjs npx nx test quantify -- --runInBand --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rule-family-default-semantics.spec.ts
```

Expected: FAIL with module-not-found or missing-export errors for `rule-family-default-semantics`.

- [ ] **Step 3: Implement the helper registry**

```ts
import type { ChecklistRuleBasis } from '../types/codegen-checklist'

export type PercentageRuleFamily =
  | 'risk.stop_loss_pct'
  | 'risk.take_profit_pct'
  | 'risk.trailing_stop_pct'
  | 'risk.drawdown_pct'
  | 'trigger.percent_change'
  | 'unknown'

export interface RuleFamilySemantics {
  family: PercentageRuleFamily
  defaultBasis: ChecklistRuleBasis['kind'] | null
  requiresUserBasis: boolean
}

export function classifyPercentageRuleFamily(input: {
  phase: 'entry' | 'exit' | 'risk'
  rule: string
}): RuleFamilySemantics {
  const rule = input.rule.trim()
  if (!rule.includes('%')) {
    return { family: 'unknown', defaultBasis: null, requiresUserBasis: false }
  }

  if (/止损|亏损/u.test(rule)) {
    return { family: 'risk.stop_loss_pct', defaultBasis: 'entry_avg_price', requiresUserBasis: false }
  }
  if (/止盈|盈利|收益率/u.test(rule)) {
    return { family: 'risk.take_profit_pct', defaultBasis: 'entry_avg_price', requiresUserBasis: false }
  }
  if (/移动止盈|trailing/i.test(rule)) {
    return { family: 'risk.trailing_stop_pct', defaultBasis: null, requiresUserBasis: true }
  }
  if (/回撤/u.test(rule)) {
    return { family: 'risk.drawdown_pct', defaultBasis: null, requiresUserBasis: true }
  }
  if (/(买入|卖出|开仓|平仓|出场|离场)/u.test(rule)) {
    return { family: 'trigger.percent_change', defaultBasis: null, requiresUserBasis: true }
  }

  return { family: 'unknown', defaultBasis: null, requiresUserBasis: false }
}

export function extractExplicitRiskBasis(rule: string): ChecklistRuleBasis['kind'] | null {
  const normalized = rule.trim().toLowerCase()
  if (!normalized) return null
  if (/持仓.*(?:收益|盈亏|亏损|利润|浮盈|pnl)|position.*pnl/i.test(normalized)) return 'position_pnl'
  if (/开仓均价|入场价|入场均价|开仓价|买入价|成本价|entry/i.test(normalized)) return 'entry_avg_price'
  return null
}

export function resolveDefaultRiskBasis(
  rule: string,
  explicitBasis: ChecklistRuleBasis['kind'] | null | undefined,
): ChecklistRuleBasis['kind'] | null {
  const family = classifyPercentageRuleFamily({ phase: 'risk', rule })
  return explicitBasis ?? extractExplicitRiskBasis(rule) ?? family.defaultBasis
}
```

- [ ] **Step 4: Re-run the helper spec**

Run:

```bash
node scripts/dx/quantify-launcher.cjs npx nx test quantify -- --runInBand --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rule-family-default-semantics.spec.ts
```

Expected: PASS with explicit coverage for defaulted risk families and trigger families.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/rule-family-default-semantics.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rule-family-default-semantics.spec.ts
git commit -m "feat: add ai quant risk-rule default semantics registry"
```

## Task 2: Narrow Basis Gate To Rule Families That Truly Need It

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`

- [ ] **Step 1: Write the failing clarification spec for defaulted risk rules**

```ts
it('does not ask basis for defaulted stop-loss and take-profit percentages', () => {
  const state = service.detect({
    symbols: ['ETHUSDT'],
    timeframes: ['15m'],
    entryRules: ['15 分钟上涨 1% 买入'],
    exitRules: ['15 分钟下跌 5% 卖出'],
    riskRules: {
      exchange: 'okx',
      marketType: 'spot',
      positionPct: 10,
      stopLossPct: 5,
      takeProfitPct: 10,
    },
  })

  expect(state.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'entry.basis.1', reason: 'ambiguous_condition_basis' }),
    expect.objectContaining({ key: 'exit.basis.1', reason: 'ambiguous_condition_basis' }),
  ]))
  expect(state.items).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'risk.stopLoss.basis' }),
    expect.objectContaining({ key: 'risk.takeProfit.basis' }),
  ]))
})

it('keeps drawdown-style risk rules basis-gated because they lack a safe default', () => {
  const state = service.detect({
    symbols: ['BTCUSDT'],
    timeframes: ['15m'],
    entryRules: ['突破布林带上轨做空'],
    exitRules: ['浮盈回撤 2% 止损'],
    riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10, stopLossPct: 5 },
  })

  expect(state.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'exit.basis.1', reason: 'ambiguous_condition_basis' }),
  ]))
})
```

- [ ] **Step 2: Run the clarification rules spec and verify it still emits risk basis blockers today**

Run:

```bash
node scripts/dx/quantify-launcher.cjs npx nx test quantify -- --runInBand --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
```

Expected: FAIL because `risk.stopLoss.basis` and `risk.takeProfit.basis` are still emitted for plain percentage risk rules.

- [ ] **Step 3: Route basis detection through the family helper**

```ts
import { classifyPercentageRuleFamily } from './rule-family-default-semantics'

if (typeof input.riskRules?.stopLossPct === 'number') {
  const semantics = classifyPercentageRuleFamily({ phase: 'risk', rule: '止损 5%' })
  if (semantics.requiresUserBasis && !this.hasNamedBasis(input.riskRules?.stopLossBasis)) {
    items.push({
      key: 'risk.stopLoss.basis',
      reason: 'ambiguous_condition_basis',
      field: 'riskRules.stopLossBasis',
      blocking: true,
      question: '这里的止损百分比是按持仓亏损，还是按价格相对入场价计算？',
      status: 'pending',
    })
  }
}

return rules.flatMap((rawRule, index) => {
  const rule = rawRule.trim()
  const semantics = classifyPercentageRuleFamily({ phase: scope, rule })
  if (!this.ruleNeedsBasis(rule, semantics.requiresUserBasis)) return []
  // keep existing basis question creation for trigger-style rules
})
```

```ts
private ruleNeedsBasis(rule: string, requiresUserBasis: boolean): boolean {
  if (!PERCENTAGE_THRESHOLD_PATTERN.test(rule)) return false
  if (!requiresUserBasis) return false
  if (this.hasExplicitBasisInText(rule)) return false
  if (/网格|步长/u.test(rule)) return false
  return /买入|卖出|开仓|平仓|止盈|止损|离场|出场|收益率|盈利|亏损|回撤|连续\s*\d+\s*根/u.test(rule)
}
```

- [ ] **Step 4: Re-run the clarification rules spec**

Run:

```bash
node scripts/dx/quantify-launcher.cjs npx nx test quantify -- --runInBand --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
```

Expected: PASS with risk stop-loss/take-profit basis blockers removed, while trigger percent-change blockers remain.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
git commit -m "feat: default ai quant stop-loss and take-profit basis semantics"
```

## Task 3: Backfill Default Risk Basis Into Conversations And Clarification Summary

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Write the failing conversation spec for default basis backfill and summary projection**

```ts
it('defaults stop-loss and take-profit basis when the user only provides percentages', async () => {
  const result = await service.continueSession('s-missing-stop-loss-answer', {
    userId: 'u1',
    message: '亏损 5% 止损，盈利 10% 止盈',
    clarificationAnswers: {
      'risk.stopLoss.rule': '亏损 5% 止损',
      'risk.takeProfit.rule': '盈利 10% 止盈',
    },
  } as ContinueCodegenSessionDto)

  expect(result.clarificationState).toEqual(expect.objectContaining({ status: 'CHECKLIST_GATE' }))
  expect(mockRepo.updateSession).toHaveBeenCalledWith(
    's-missing-stop-loss-answer',
    expect.objectContaining({
      checklist: expect.objectContaining({
        riskRules: expect.objectContaining({
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        }),
      }),
    }),
  )
})

it('preserves explicit non-default risk basis from natural language', () => {
  const checklist = (service as any).inferChecklistFromMessage(
    '在 OKX 现货 ETHUSDT，15分钟上涨1%买入，止损按持仓亏损 5%，止盈按持仓收益率 10%，仓位 10%',
  )

  expect(checklist.riskRules).toEqual(expect.objectContaining({
    stopLossPct: 5,
    stopLossBasis: 'position_pnl',
    takeProfitPct: 10,
    takeProfitBasis: 'position_pnl',
  }))
})

it('renders defaulted risk semantics in clarification summary instead of generic exit filler', () => {
  const summary = (service as any).buildClarificationSummary({
    symbols: ['ETHUSDT'],
    timeframes: ['15m'],
    entryRules: ['15 分钟上涨 1% 买入'],
    exitRules: ['15 分钟下跌 5% 卖出'],
    riskRules: {
      exchange: 'okx',
      marketType: 'spot',
      positionPct: 10,
      stopLossPct: 5,
      takeProfitPct: 10,
      stopLossBasis: 'entry_avg_price',
      takeProfitBasis: 'entry_avg_price',
    },
  })

  expect(summary).toContain('止损：价格相对入场价下跌 5%')
  expect(summary).toContain('止盈：价格相对入场价上涨 10%')
})
```

- [ ] **Step 2: Run the conversation spec and verify the current flow still leaves basis unresolved or summary too generic**

Run:

```bash
node scripts/dx/quantify-launcher.cjs npx nx test quantify -- --runInBand --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
```

Expected: FAIL because risk basis is not backfilled from default semantics and summary still uses generic entry/exit phrasing.

- [ ] **Step 3: Backfill default risk basis and preserve explicit overrides in the conversation service**

```ts
import {
  extractExplicitRiskBasis,
  resolveDefaultRiskBasis,
} from './rule-family-default-semantics'

if (item.key === 'risk.stopLoss.rule' || item.field === 'riskRules.stopLossPct') {
  const parsedPct = this.parsePercentageFromText(answer)
  const basis = resolveDefaultRiskBasis(answer, extractExplicitRiskBasis(answer))
  return {
    ...checklist,
    riskRules: {
      ...(checklist.riskRules ?? {}),
      stopLoss: answer,
      ...(parsedPct !== null ? { stopLossPct: parsedPct } : {}),
      ...(basis ? { stopLossBasis: basis } : {}),
    },
  }
}

if (stopLossMatch?.[1]) {
  riskRules.stopLossPct = Number(stopLossMatch[1])
  const explicitStopLossBasis = extractExplicitRiskBasis(text)
  const stopLossBasis = resolveDefaultRiskBasis(text, explicitStopLossBasis)
  if (stopLossBasis) {
    riskRules.stopLossBasis = stopLossBasis
  }
}
```

```ts
const riskSegments = [
  typeof checklist.riskRules?.stopLossPct === 'number'
    ? `止损：价格相对入场价下跌 ${checklist.riskRules.stopLossPct}% 强制平仓`
    : '',
  typeof checklist.riskRules?.takeProfitPct === 'number'
    ? `止盈：价格相对入场价上涨 ${checklist.riskRules.takeProfitPct}% 平仓`
    : '',
].filter(Boolean)

return [...segments, ...riskSegments].filter(Boolean).join('；') || null
```

- [ ] **Step 4: Re-run the conversation spec**

Run:

```bash
node scripts/dx/quantify-launcher.cjs npx nx test quantify -- --runInBand --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
```

Expected: PASS with defaulted `entry_avg_price` basis, explicit `position_pnl` override preservation, and richer summary output.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "feat: project ai quant default risk semantics into sessions"
```

## Task 4: Backfill Canonical Risk Basis For Direct Builds And Legacy Checklists

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`

- [ ] **Step 1: Write the failing canonical builder spec for legacy/defaulted risk basis**

```ts
it('fills default entry-price basis for stop-loss and take-profit when checklist omits them', () => {
  const service = new CanonicalSpecBuilderService()

  const spec = service.build({
    symbols: ['ETHUSDT'],
    timeframes: ['15m'],
    entryRules: ['15 分钟上涨 1% 买入'],
    exitRules: ['15 分钟下跌 5% 卖出'],
    riskRules: {
      exchange: 'okx',
      marketType: 'spot',
      positionPct: 10,
      stopLossPct: 5,
      takeProfitPct: 10,
    },
  })

  expect(spec.rules).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: 'risk-stop-loss',
      condition: expect.objectContaining({
        params: expect.objectContaining({ basis: 'entry_avg_price' }),
      }),
    }),
    expect.objectContaining({
      id: 'risk-take-profit',
      condition: expect.objectContaining({
        params: expect.objectContaining({ basis: 'entry_avg_price' }),
      }),
    }),
  ]))
})

it('keeps explicit position-pnl overrides on canonical risk rules', () => {
  const service = new CanonicalSpecBuilderService()

  const spec = service.build({
    symbols: ['ETHUSDT'],
    timeframes: ['15m'],
    entryRules: ['15 分钟上涨 1% 买入'],
    exitRules: ['15 分钟下跌 5% 卖出'],
    riskRules: {
      exchange: 'okx',
      marketType: 'spot',
      positionPct: 10,
      stopLossPct: 5,
      stopLossBasis: 'position_pnl',
      takeProfitPct: 10,
      takeProfitBasis: 'position_pnl',
    },
  })

  expect(spec.rules).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: 'risk-stop-loss',
      metadata: expect.objectContaining({ basis: 'position_pnl' }),
    }),
    expect.objectContaining({
      id: 'risk-take-profit',
      metadata: expect.objectContaining({ basis: 'position_pnl' }),
    }),
  ]))
})
```

- [ ] **Step 2: Run the canonical builder spec and verify default basis is still absent today**

Run:

```bash
node scripts/dx/quantify-launcher.cjs npx nx test quantify -- --runInBand --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
```

Expected: FAIL because direct builds with only `stopLossPct` / `takeProfitPct` do not emit `basis` params yet.

- [ ] **Step 3: Backfill default basis in the canonical builder**

```ts
import { resolveDefaultRiskBasis } from './rule-family-default-semantics'

const stopLossBasis = typeof riskRules.stopLossBasis === 'string'
  ? riskRules.stopLossBasis
  : resolveDefaultRiskBasis(String(riskRules.stopLoss ?? `止损 ${stopLossPct}%`), null)

if (stopLossPct !== null) {
  rules.push({
    id: 'risk-stop-loss',
    phase: 'risk',
    sideScope: 'both',
    priority: 120,
    condition: {
      kind: 'atom',
      key: 'position_loss_pct',
      semanticScope: 'position',
      op: 'GTE',
      value: Number((stopLossPct / 100).toFixed(4)),
      ...(stopLossBasis ? { params: { basis: stopLossBasis } } : {}),
    },
    actions: [{ type: 'FORCE_EXIT' }],
    ...(stopLossBasis ? { metadata: { basis: stopLossBasis } } : {}),
  })
}
```

- [ ] **Step 4: Re-run the canonical builder spec**

Run:

```bash
node scripts/dx/quantify-launcher.cjs npx nx test quantify -- --runInBand --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
```

Expected: PASS with default `entry_avg_price` basis for plain risk percentages and explicit override preservation.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
git commit -m "feat: backfill ai quant canonical risk basis defaults"
```

## Task 5: Focused Verification And Regression Sweep

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rule-family-default-semantics.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`

- [ ] **Step 1: Run the focused Quantify unit suite for the touched surfaces**

Run:

```bash
node scripts/dx/quantify-launcher.cjs npx nx test quantify -- --runInBand --runTestsByPath \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rule-family-default-semantics.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
```

Expected: PASS for all four spec files with no `risk.stopLoss.basis` or `risk.takeProfit.basis` blockers on plain risk percentages.

- [ ] **Step 2: Run one broader Quantify unit pass to catch collateral regressions in the same subsystem**

Run:

```bash
node scripts/dx/quantify-launcher.cjs npx nx test quantify -- --runInBand --testPathPattern=llm-strategy-codegen
```

Expected: PASS across the `llm-strategy-codegen` unit suite without touching CI configuration or unrelated app pipelines.

- [ ] **Step 3: Review `git diff --stat` to enforce scope boundaries**

Run:

```bash
git diff --stat HEAD~4..HEAD
```

Expected: Only `apps/quantify/src/modules/llm-strategy-codegen/**` tests/services and the new helper file change; no CI files, no root workflow files, no main data-flow reorder patches.

- [ ] **Step 4: Commit the verification sweep if additional assertion-only fixes were needed**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__
git commit -m "test: lock ai quant default risk semantics regressions"
```

## Self-Review

- Spec coverage: covered defaulted stop-loss/take-profit semantics, trigger percent-change basis gate retention, explicit non-default overrides, summary/canonical projection, and “do not touch main data flow / CI” scope boundaries.
- Placeholder scan: no `TODO`/`TBD` markers remain; every task includes concrete files, commands, and code snippets.
- Type consistency: plan consistently uses `entry_avg_price`, `position_pnl`, `risk.stopLossPct`, `risk.takeProfitPct`, and `ambiguous_condition_basis` across helper, conversation, clarification, and canonical tasks.
