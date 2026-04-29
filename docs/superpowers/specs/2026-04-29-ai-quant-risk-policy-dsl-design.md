# AI Quant Risk Policy DSL Design

Date: 2026-04-29

Status: design approved, awaiting review

## Context

AI Quant currently stores risk semantics mostly as keyed atoms such as
`risk.stop_loss_pct` and `risk.take_profit_pct`. That shape works for a few
known cases, but it makes recognition too brittle:

- users can express the same risk rule in many natural ways
- new risk controls require new keys or family-level exceptions
- clarification can leak internal fields such as `basis` back to users
- default semantics are scattered across extractors, projection, canonical
  builders, and clarification code

The visible symptom is that a plain rule like `亏损 5% 止损` can still trigger a
question asking for the stop-loss calculation basis, even though the product
semantics should default it to entry price.

The deeper issue is that risk is still modeled as key-based atoms. The desired
model is a general risk policy language: users can describe risk in many ways,
and the system should normalize those descriptions into one field-based risk
semantic structure before deciding whether to clarify or compile.

## Goals

1. Make risk semantics independent of atom keys and family defaults.
2. Normalize all user risk language into a general `RiskPolicy` structure.
3. Represent risk as `condition + effect + scope`, not as `key + params`.
4. Keep safe market defaults, such as stop-loss basis = entry price, inside the
   semantic structure with explicit source metadata.
5. Ask clarification questions only for fields that change execution semantics
   and cannot be safely defaulted.
6. Preserve compatibility with existing canonical, IR, AST, publication, and
   backtest paths by projecting `RiskPolicy` into current legacy structures.
7. Allow the semantic model to express broad quantitative risk controls even
   when runtime compilation support lands incrementally.

## Non-Goals

- Do not attempt to compile every possible risk policy in the first
  implementation phase.
- Do not make atom keys or family names the source of truth for risk semantics.
- Do not remove existing canonical risk fields in one step.
- Do not ask users internal implementation terms such as `basis`,
  `entry_avg_price`, or atom keys.

## Core Model

Risk semantics should use a field-based policy language.

```ts
interface RiskPolicy {
  version: 1
  rules: RiskRule[]
}

interface RiskRule {
  id: string
  condition: RiskCondition
  effects: RiskEffect[]
  scope: RiskScope
  priority?: number
  source: 'user_explicit' | 'system_default' | 'derived'
  evidence?: RiskEvidence
  openSlots: RiskSlot[]
}

interface RiskCondition {
  left: RiskOperand
  operator:
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'eq'
    | 'crosses_above'
    | 'crosses_below'
  right: RiskOperand
  window?: RiskWindow
  aggregation?: RiskAggregation
}

type RiskAggregation =
  | 'current'
  | 'max'
  | 'min'
  | 'avg'
  | 'sum'
  | 'consecutive'
  | 'drawdown_from_peak'

interface RiskOperand {
  kind:
    | 'price'
    | 'entry_price'
    | 'position_pnl'
    | 'unrealized_pnl'
    | 'realized_pnl'
    | 'equity'
    | 'equity_peak'
    | 'indicator'
    | 'time_in_position'
    | 'trade_count'
    | 'loss_streak'
    | 'volatility'
    | 'custom_metric'
    | 'constant'
  params?: Record<string, unknown>
  source?: 'user_explicit' | 'system_default' | 'derived'
}

interface RiskEffect {
  type:
    | 'close_position'
    | 'reduce_position'
    | 'block_entry'
    | 'pause_strategy'
    | 'cancel_orders'
    | 'switch_mode'
    | 'notify_only'
  size?: {
    value: number
    unit: 'percent' | 'ratio' | 'base' | 'quote'
  }
}

interface RiskScope {
  position: 'current' | 'long' | 'short' | 'both'
  market?: 'current_symbol' | 'all_symbols'
  lifecycle?: 'position' | 'strategy' | 'session' | 'day'
}

interface RiskSlot {
  fieldPath: string
  questionHint: string
  priority: 'risk'
  affectsExecution: true
  status: 'open' | 'locked'
}

interface RiskEvidence {
  text: string
  source: 'user_explicit' | 'system_default' | 'derived'
  messageIndex?: number
}
```

This model is the semantic source of truth. Legacy atom keys may still be
derived for compatibility, but they are output details, not recognition inputs.

## Default Semantics

Defaults belong to the field structure, not to atom keys.

For plain stop loss phrases such as:

- `止损 5%`
- `亏损 5% 跑`
- `跌破成本价 5% 平仓`
- `持仓亏损达到 5% 全平`

the normalized policy is:

```ts
{
  condition: {
    left: {
      kind: 'position_pnl',
      params: {
        basis: 'entry_price',
        basisSource: 'system_default',
      },
    },
    operator: 'lte',
    right: { kind: 'constant', params: { value: -5, unit: 'percent' } },
    aggregation: 'current',
  },
  effects: [{ type: 'close_position' }],
  scope: { position: 'current', lifecycle: 'position' },
  source: 'user_explicit',
  openSlots: [],
}
```

The system keeps `basisSource: 'system_default'` so downstream display,
confirmation, and audit code can distinguish defaults from explicit user
choices. It does not ask the user to confirm that default unless the user
expresses conflicting semantics.

If the user says `按持仓收益率止损` or `按浮盈回撤止损`, the relevant operand and
aggregation become user-explicit:

```ts
left: {
  kind: 'position_pnl',
  params: {
    basis: 'position_return',
    basisSource: 'user_explicit',
  },
}
```

or:

```ts
aggregation: 'drawdown_from_peak'
left: {
  kind: 'unrealized_pnl',
  params: {
    basis: 'peak_position_pnl',
    basisSource: 'user_explicit',
  },
}
```

## Recognition Strategy

Risk recognition should not first map user text to a key. It should extract the
semantic fields:

1. Identify whether the user text describes risk control.
2. Extract the condition:
   - metric or operand
   - threshold
   - comparison direction
   - time/window/aggregation
3. Extract the effect:
   - close
   - reduce
   - block
   - pause
   - notify
4. Extract the scope:
   - long, short, both, current position
   - position lifecycle, strategy lifecycle, daily lifecycle
5. Apply safe defaults only after field extraction.
6. Produce open slots only for missing fields that affect execution.

Examples:

```text
止损 5%
```

means:

```text
current position pnl <= -5% -> close current position
```

```text
浮盈回撤 2% 止损
```

means:

```text
drawdown_from_peak(unrealized_pnl) >= 2% -> close current position
```

```text
连续 3 根 K 线在布林带外减仓一半
```

means:

```text
consecutive(indicator.bollinger_position == outside, 3) -> reduce current position 50%
```

```text
日亏损超过 3% 暂停开仓
```

means:

```text
daily strategy pnl <= -3% -> block entry
```

```text
ATR 两倍止损
```

means:

```text
price <= entry_price - 2 * indicator.atr -> close current position
```

## Clarification Rules

Clarification is driven by missing semantic fields, not by internal names.

Ask when:

- threshold is missing: `亏损多少触发？`
- effect is ambiguous: `触发后是全部平仓、减仓，还是只提醒？`
- scope is ambiguous and changes execution: `这个风控作用于多仓、空仓，还是所有持仓？`
- lifecycle is ambiguous and changes execution: `这是单笔持仓风控，还是账户/策略级风控？`
- a non-default basis is implied but not resolvable safely.

Do not ask when:

- plain stop loss or take profit has a safe default basis
- the missing field is an internal projection detail
- the system can derive the value from confirmed position, trigger, or market
  context without changing execution semantics

The user should never be asked to type values such as `entry_avg_price`.

## Compatibility Projection

Existing code still expects risk atoms and legacy checklist fields in several
places. The migration should add compatibility projection instead of changing
every downstream consumer at once.

```text
RiskPolicy
  -> semanticState.riskPolicy
  -> legacy semantic risk atoms, when representable
  -> StrategyLogicSnapshot.riskRules
  -> canonicalSpec
  -> IR / AST / script
```

For example:

```text
position_pnl <= -5%, close_position
```

can project to current compatibility structures:

```ts
{
  key: 'risk.stop_loss_pct',
  params: {
    valuePct: 5,
    basis: 'entry_avg_price',
    basisSource: 'system_default',
  },
}
```

This projection is explicitly compatibility-only. New semantic logic should
read `RiskPolicy`.

Unsupported but recognized risk policies should not fall back to vague
clarification. They should be marked as recognized but unsupported:

```ts
{
  status: 'unsupported_capability',
  reason: 'risk_policy_compile_not_supported',
  policy: ...
}
```

That lets the product say the strategy is understood but cannot yet be safely
generated, instead of asking unrelated questions.

## Integration Points

The first implementation should touch these boundaries:

- `SemanticState`: add `riskPolicy?: RiskPolicy` while keeping existing `risk`
  array for compatibility.
- Risk extraction: introduce a field-based `RiskPolicyExtractor`.
- Semantic merge: merge `RiskPolicy.rules` by evidence and semantic equivalence,
  not by atom key.
- Clarification: derive risk open slots from `RiskPolicy`.
- Projection: derive legacy `risk.stop_loss_pct` / `risk.take_profit_pct` /
  `risk.max_drawdown_pct` atoms from compatible `RiskPolicy` rules.
- Canonical and publication: prefer `RiskPolicy` when present, fall back to
  legacy risk atoms during migration.

## Testing Strategy

Add regression coverage for:

- `止损 5%` produces no basis question and stores default basis source.
- `entry_avg_price` is never required as a user answer for plain stop loss.
- alternate wording such as `亏 5% 跑` and `持仓亏损达到 5% 全平` normalizes to the
  same risk policy.
- take profit normalizes as positive position pnl or price return close effect.
- drawdown, reduce-position, block-entry, ATR stop, and indicator-based risk are
  recognized as `RiskPolicy` even if some are initially unsupported for compile.
- unsupported recognized policies return `unsupported_capability`, not bogus
  clarification prompts.
- compatibility projection preserves existing stop-loss/take-profit canonical
  behavior.

## Rollout

1. Add the `RiskPolicy` types and field-based extractor.
2. Store `riskPolicy` alongside existing semantic risk atoms.
3. Use `RiskPolicy` to drive clarification for risk rules.
4. Project compatible policies to existing atoms and checklist fields.
5. Move canonical/publication paths to prefer `RiskPolicy`.
6. Retire key-based risk recognition once golden regressions pass.

This gives the system a broad, stable semantic model now, while allowing runtime
support for each advanced risk capability to be enabled safely.
