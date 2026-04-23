# AI Quant Semantic Atom Invariant Design

## Context

The current AI Quant publication pipeline is:

```text
user message
  -> semanticState
  -> normalizedIntent
  -> canonicalSpec
  -> digest confirmation
  -> publication
  -> IR
  -> AST
  -> compiled script
  -> consistency
  -> published snapshot
```

A production snapshot showed an intent drift:

- User intent: close long when price rises 1% relative to previous close.
- Published AST: `LTE(PRICE_CHANGE_PCT(1h, 1), -0.01) -> CLOSE_LONG`.
- Runtime meaning: close long when price drops 1% relative to previous close.

The compiled script did not visibly show "drop 1%" because the generated script is a fixed wrapper plus JSON constants. Runtime behavior comes from `EXPR_POOL` and `DECISION_PROGRAMS`, not from human-readable condition code or rule ids.

The likely source of this drift is clause-level parsing. A single user message can contain multiple percentage clauses, such as:

```text
price rises 1% relative to previous close -> sell
price drops 5% relative to entry average -> stop loss
price rises 10% relative to entry average -> take profit
```

If a parser determines percentage direction from the whole segment instead of the local clause, a later "drop" phrase can contaminate an earlier "rise" rule.

## Goals

- Fix the observed percent-change direction drift with the smallest safe change.
- Keep the solution strategy-agnostic: no strategy-family branches and no deleted checklist dependency.
- Preserve already-working Bollinger, MA, and grid strategies.
- Make future complex strategies easier to extend by validating semantic atoms rather than full strategy families.
- Reject publication when a compiled artifact contradicts explicit user semantic intent.

## Non-Goals

- Do not rewrite the canonical compiler.
- Do not reintroduce checklist as an authority.
- Do not change runtime execution semantics for existing Bollinger, MA, or grid strategies.
- Do not repair wrong compiled artifacts downstream by guessing the user's intent at deploy time.

## Core Design

### 1. Semantic Atom Contract

Treat each explicit strategy condition as a semantic atom with enough structure to verify compilation:

```ts
interface SemanticAtomInvariant {
  key: string
  phase: 'entry' | 'exit' | 'risk' | 'rebalance' | 'gate'
  sideScope?: 'long' | 'short' | 'both' | 'flat'
  action?: string
  params: Record<string, unknown>
  evidence?: {
    text: string
    source: 'user_explicit' | 'system_default' | 'planner'
  }
}
```

For percent-change rules, direction should be explicit and not inferred only from signed `valuePct`:

```ts
{
  key: 'price.percent_change',
  phase: 'exit',
  sideScope: 'long',
  action: 'close_long',
  params: {
    basis: 'prev_close',
    direction: 'up',
    valuePct: 1,
    window: '1h'
  },
  evidence: {
    text: '价格相对前收盘上涨 1% 时卖出',
    source: 'user_explicit'
  }
}
```

Existing `valuePct` sign can remain for compatibility, but the invariant should use explicit direction when available.

### 2. Local Clause Extraction

Percent-change extraction must operate on the smallest relevant clause, not on the whole user message.

Correct clause split for the failing case:

```text
出场规则为价格相对前收盘上涨 1% 时卖出
相对入场均价下跌 5% 止损卖出
相对入场均价上涨 10% 止盈卖出
```

Each clause independently determines:

- `phase`
- `sideScope`
- `basis`
- `direction`
- `valuePct`
- `action`

This is the only parsing behavior change required for the observed bug.

### 3. Publication Invariant Gate

Before publishing a snapshot, verify that explicit semantic atoms are faithfully represented through canonicalSpec, IR, and AST.

For the failing case:

```text
semantic atom:
  price.percent_change exit long close_long prev_close up 1%

canonicalSpec must contain:
  price.change_pct GTE 0.01 basis=prev_close timeframe=1h

IR/AST must contain:
  PRICE_CHANGE_PCT(current close, previous close)
  predicate GTE(..., const 0.01)
  decision CLOSE_LONG
```

If the compiled artifact contains `LTE(..., -0.01)` for that atom, publication must fail with a clear semantic drift error.

### 4. Compatibility With Existing Strategies

The first implementation phase should only block on `price.percent_change` invariants. Existing working strategy types stay on their current compilation path.

Bollinger, MA, and grid should be added as non-invasive invariant checks or regression locks:

- Bollinger:
  - upper breakout -> `CROSS_OVER(close, upper_band)`
  - lower breakdown -> `CROSS_UNDER(close, lower_band)`
  - middle revert -> existing `OR(CROSS_OVER, CROSS_UNDER)` behavior
- MA:
  - golden cross / above -> `CROSS_OVER` or expected comparison
  - death cross / below -> `CROSS_UNDER` or expected comparison
- Grid:
  - lower-level touch buy -> `TOUCH_LEVEL_DOWN`
  - upper-level touch sell -> `TOUCH_LEVEL_UP`

These checks should not alter generated output. They should pass for already-working strategies and serve as regression protection. If any legacy edge case is ambiguous, report warning first instead of blocking.

## Data Flow With Invariants

```text
user message
  -> semanticState
      stores explicit atom evidence
  -> normalizedIntent
      preserves atom direction/basis/value/action
  -> canonicalSpec
      maps atom to canonical condition/action
  -> digest confirmation
      confirms canonical truth, not checklist text
  -> publication
      runs semantic atom invariant gate
  -> IR
  -> AST
  -> compiled script
  -> consistency
      verifies artifact consistency plus atom fidelity
  -> published snapshot
```

The key shift is that consistency must include "does the artifact still mean the explicit user atom?", not only "do spec, IR, AST, and script agree with each other?"

## Error Handling

When invariant validation fails, reject publication. Do not auto-correct the artifact.

Example error:

```text
codegen.semantic_atom_drift:
price.percent_change exit close_long expected GTE 0.01 relative to prev_close,
but AST contains LTE -0.01.
```

This keeps the system safe: wrong strategy publication is blocked before backtest/deploy.

## Testing Strategy

Add focused tests for:

- The failing ORDIUSDT scenario:
  - OKX spot
  - ORDIUSDT
  - 1h
  - 10% fixed long-only position
  - on-start market buy
  - previous-close rise 1% close long
  - entry-average drop 5% stop loss
  - entry-average rise 10% take profit
- Mixed percentage clauses in one sentence.
- Percent-change invariant rejecting `LTE -0.01` when user evidence says rise.
- Existing Bollinger, MA, and grid golden cases continue to publish.
- Compiled script parser can prove the relevant `EXPR_POOL` and `DECISION_PROGRAMS` shape.

## Rollout

1. Implement local percent clause extraction.
2. Add `price.percent_change` semantic atom invariant as blocking.
3. Add regression tests for Bollinger, MA, and grid without changing their compilation.
4. Add non-blocking diagnostics for other direction-sensitive atoms.
5. Promote additional atom invariants to blocking only after regression coverage proves compatibility.

## Open Decision

The initial blocking invariant should cover only `price.percent_change`. Bollinger, MA, and grid should be covered by regression tests and warning-level checks first to avoid disrupting strategies that are already working.
