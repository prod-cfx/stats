# AI Quant Risk Semantic Contract Alignment Design

Date: 2026-04-29

Status: design approved, awaiting review

## Context

AI Quant already uses a structured semantic-state architecture. The source of
truth is not a simple `key + params` checklist shape. The main semantic state is
organized around four large strategy atoms plus execution context:

```ts
SemanticState {
  triggers: SemanticTriggerState[]
  actions: SemanticActionState[]
  risk: SemanticRiskState[]
  position: SemanticPositionState | null
  contextSlots: SemanticContextSlotState
}
```

Each semantic node carries structured params, status, evidence, and open slots.
Triggers already support a structured expression contract:

```ts
SemanticExpression =
  | SemanticPredicateExpression
  | SemanticLogicalExpression
```

with predicate operands such as bar series, indicators, position fields, and
constants. This is already an embedded structured semantic language. It should
not be replaced by a new external DSL.

The current problem is narrower: risk semantics have not fully caught up with
the structured contract/expression standard already used by triggers and
position sizing. Some risk fields, especially stop-loss/take-profit basis, can
still leak into clarification as if they were user-facing required slots.

The visible symptom is that a plain rule like `亏损 5% 止损` can ask the user to
confirm a calculation basis, even though the product semantics should default
that basis to entry price and keep the default as internal metadata.

## Goals

1. Keep the existing four-atom semantic-state model.
2. Do not introduce a separate top-level StrategyGraph or external DSL.
3. Align risk with the existing structured semantic contract/expression style.
4. Treat common stop-loss/take-profit basis as semantic defaults, not open
   clarification slots.
5. Preserve source metadata such as `basisSource: 'system_default'`.
6. Continue to support compatibility projection to current canonical, IR, AST,
   publication, and backtest paths.
7. Make future risk rules extensible by structured fields and contracts, not by
   ad hoc prompt wording or legacy checklist gaps.

## Non-Goals

- Do not rewrite `SemanticState`.
- Do not remove `triggers / actions / risk / position / contextSlots`.
- Do not move grid, DCA, market-making, or rebalance into a new `behavior`
  top-level field. In this architecture they are trigger semantics.
- Do not require users to answer internal enum values such as
  `entry_avg_price`.
- Do not compile every possible advanced risk rule in the first implementation
  phase.

## Design Principle

The product vocabulary is:

```text
触发条件
执行动作
风控
仓位
上下文
```

All quantitative strategies, including grid and more complex strategies, should
fit into these semantic atoms:

- grid range/spacing/touch/rebalance logic is trigger semantics
- DCA ladder or schedule is trigger semantics
- market-making quote refresh and spread rules are trigger semantics
- arbitrage spread conditions are trigger semantics
- order placement, reduce, close, cancel, pause, and notify are action semantics
- stop loss, take profit, drawdown, exposure, loss streak, and account guards are
  risk semantics
- fixed ratio, fixed quote, fixed base, and risk-budget sizing are position
  semantics

The fix is not "upgrade to DSL". The fix is to make risk follow the same
structured contract discipline as the rest of the semantic state.

## Current Strengths

The existing architecture already has the right foundation:

- `SemanticState` is the conversation source of truth.
- Every semantic node can be open, locked, or superseded.
- Every semantic node can carry `openSlots` with field paths and question hints.
- `SemanticExpression` supports predicate and logical expression trees.
- `validateSemanticExpressionContract()` validates expression structure.
- `CanonicalSpecBuilderService` can project `condition.expression` into
  canonical conditions.
- `CanonicalSpecV2IrCompilerService` can compile supported expression operands.
- `SemanticAtomInvariantService` already checks semantic expression fidelity
  through canonical, IR, and AST.

This means the right direction is incremental alignment, not a new modeling
layer.

## Risk Contract Gap

Risk currently still has legacy pressure from keyed atoms:

```ts
{
  key: 'risk.stop_loss_pct',
  params: {
    valuePct: 5,
    basis?: 'entry_avg_price' | 'position_pnl'
  },
  openSlots: []
}
```

That shape is acceptable as a compatibility projection, but it is not enough as
the full risk semantic contract. It does not clearly say:

- which fields are user-facing required fields
- which fields are safe semantic defaults
- which fields can be edited later but should not be asked during initial
  clarification
- which fields represent internal compile/projection metadata
- whether a default came from the user, the system, or a derived rule

Because this contract is incomplete, planner output or persisted open slots can
surface `params.basis` as a clarification question.

## Target Risk Contract

Risk should remain inside `SemanticRiskState`, but the internal params contract
should be more explicit:

```ts
interface SemanticRiskState {
  id: string
  key: string
  params: SemanticRiskParams
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots: SemanticSlotState[]
  supersedes?: string[]
}

type SemanticRiskParams =
  | PercentRiskParams
  | DrawdownRiskParams
  | TimeRiskParams
  | ExposureRiskParams
  | IndicatorRiskParams
  | AccountRiskParams

interface PercentRiskParams {
  valuePct: number
  direction: 'loss' | 'profit'
  basis: 'entry_avg_price' | 'position_pnl'
  basisSource: 'user_explicit' | 'system_default' | 'derived'
  effect: 'close_position' | 'reduce_position' | 'notify_only'
  scope: 'current_position' | 'long' | 'short' | 'both'
  reducePct?: number
}
```

The existing `key` can stay for compatibility and coarse capability routing, but
it must not be the only contract. The structured params decide clarification,
defaults, projection, and display.

## Default Semantics

Plain stop-loss and take-profit expressions have safe product defaults.

Examples:

- `止损 5%`
- `亏损 5% 跑`
- `跌破成本价 5% 平仓`
- `持仓亏损达到 5% 全平`

They normalize to:

```ts
{
  key: 'risk.stop_loss_pct',
  params: {
    valuePct: 5,
    direction: 'loss',
    basis: 'entry_avg_price',
    basisSource: 'system_default',
    effect: 'close_position',
    scope: 'current_position',
  },
  status: 'locked',
  openSlots: [],
}
```

The system should not ask the user to confirm `basis`. It should preserve the
default source so display, confirmation, audit, and later edits can distinguish
defaulted semantics from explicit user choices.

If the user explicitly says `按持仓收益率止损`, the normalized state becomes:

```ts
{
  params: {
    valuePct: 5,
    direction: 'loss',
    basis: 'position_pnl',
    basisSource: 'user_explicit',
    effect: 'close_position',
    scope: 'current_position',
  },
}
```

## Open Slot Rules

Risk clarification should be driven by semantic field gaps:

Ask when:

- threshold is missing: `亏损多少触发？`
- effect is ambiguous: `触发后是全部平仓、减仓，还是只提醒？`
- reduce size is needed but missing: `减仓多少？`
- scope changes execution and is ambiguous: `作用于多仓、空仓，还是所有持仓？`
- lifecycle changes execution and is ambiguous: `这是单笔持仓风控，还是账户/策略级风控？`

Do not ask when:

- plain stop loss or take profit can use a safe default basis
- the field is internal projection metadata
- the system can derive the value from confirmed semantic context without
  changing execution
- the only missing value is an implementation enum such as `entry_avg_price`

Implementation rule:

```text
semantic risk openSlots may include user-facing semantic gaps only.
internal defaultable fields must be normalized before clarification.
```

## Relationship To Triggers

Triggers already demonstrate the desired pattern:

```ts
{
  key: 'condition.expression',
  params: {
    expression: SemanticExpression
  },
  openSlots: []
}
```

Risk does not need a separate external DSL. It needs equivalent structured
contracts for risk expressions and effects.

For advanced risk rules, risk may use the same expression primitives:

```ts
{
  key: 'risk.condition_expression',
  params: {
    condition: SemanticExpression,
    effect: {
      type: 'reduce_position',
      reducePct: 50,
    },
    scope: 'current_position',
  },
}
```

This keeps risk aligned with the current architecture while allowing advanced
rules such as:

- consecutive outside-band risk
- ATR stop
- account drawdown guard
- loss streak stop
- time-in-position stop
- volatility halt

Unsupported advanced risk expressions should be recognized as semantic state
with a compile capability blocker, not converted into vague basis
clarification.

## Compatibility Projection

The migration should preserve existing consumers:

```text
SemanticRiskState structured params
  -> legacy risk atom compatibility, when needed
  -> StrategyLogicSnapshot.riskRules
  -> canonicalSpec
  -> IR / AST / script
```

For current compatible rules:

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

can still project to:

```ts
riskRules.stopLossPct = 5
riskRules.stopLossBasis = 'entry_avg_price'
```

But compatibility projection must not reintroduce a basis clarification item.

## Data Flow

The intended main flow remains:

```text
user message
  -> semantic seed / planner patch
  -> SemanticSeedStateBuilder
  -> SemanticStateMerge
  -> semantic default normalization
  -> open slot derivation
  -> SemanticState
  -> clarification / confirmation
  -> canonical spec
  -> IR / AST / compiled script
  -> invariant checks
```

The important ordering is:

```text
normalize risk defaults before deriving clarification prompts
```

This prevents defaultable fields from leaking into `openSlots`.

## Testing Strategy

Add focused tests for:

- `止损 5%` locks risk with `basis: entry_avg_price` and
  `basisSource: system_default`.
- `止盈 10%` follows the same defaulting pattern.
- planner patches that include an open `params.basis` slot for plain stop loss
  are normalized to a locked risk state.
- user-explicit non-default basis is preserved with
  `basisSource: user_explicit`.
- `entry_avg_price` is never required as a user-facing answer.
- clarification asks for missing threshold/effect/scope only when those fields
  affect execution.
- compatibility projection still fills existing `riskRules.stopLossPct`,
  `riskRules.stopLossBasis`, `riskRules.takeProfitPct`, and
  `riskRules.takeProfitBasis`.
- advanced risk expressions are either compiled when supported or marked as
  recognized-but-unsupported, not converted into unrelated basis questions.

## Rollout

1. Extend risk params contracts to distinguish user-facing required fields,
   defaultable fields, and internal projection fields.
2. Add risk default normalization before semantic clarification.
3. Filter or rewrite invalid risk basis open slots produced by planner patches.
4. Preserve `basisSource` through projection, display, and confirmation.
5. Add regression tests around stop-loss/take-profit basis noise.
6. Expand advanced risk expression support incrementally using the existing
   `SemanticExpression` infrastructure.

This keeps the current four-atom semantic architecture intact and fixes the
actual gap: risk default semantics and open-slot derivation are not yet aligned
with the structured semantic contract model already present in triggers and
position sizing.
