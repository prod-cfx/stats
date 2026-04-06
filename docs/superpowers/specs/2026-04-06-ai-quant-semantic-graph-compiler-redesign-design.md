# AI Quant Semantic Graph Compiler Redesign

## Background

During staging integration, multiple ordinary quant strategies failed at `confirmGenerate` with `codegen.graph_operator_invalid`.

Examples that failed:

- Bollinger-band breakout / mean-reversion strategies
- Multi-timeframe price-change strategies
- Fixed-range grid strategies

The root cause is a structural mismatch in the current pipeline:

1. The planner and checklist flow produce natural-language rules.
2. `CodegenGraphSnapshotService` stores those natural-language rules directly into `graphSnapshot.trigger.operator`.
3. `CanonicalStrategyIrCompilerService` treats `trigger.operator` as executable DSL and routes it through `GraphOperatorParserService`.
4. `GraphOperatorParserService` only accepts a narrow whitelist of function-style operators.

This means a strategy can reach `CHECKLIST_GATE`, be shown to the user as a confirmable logic graph, and then fail immediately when the backend attempts compilation. The current test suite misses this because many compiler-path tests construct DSL-shaped graph snapshots directly instead of covering the real user flow.

## Problem Statement

The current AI quant generation flow allows a gap between:

- what the user confirms in the UI,
- what the backend persists as "logic graph",
- what the compiler expects as executable input,
- and what the script emitter finally outputs.

This creates a system where "confirmed" strategies are not guaranteed to be compilable, and where script/strategy drift is controlled too late by consistency checks instead of prevented by design.

## Goals

- Any strategy that the current UI can naturally express and display as a confirmable logic graph must be able to complete `confirmGenerate -> compile -> script generation -> consistency audit -> backtest/publish readiness`.
- Remove the structural mismatch between natural-language graph content and compiler input.
- Make IR the single execution source of truth.
- Ensure the displayed logic graph, compiled IR, and emitted script all derive from the same strategy semantics.
- Move unsupported-strategy errors earlier, from compile-time to graph validation time.
- Support ordinary quant strategies as a first-class target during integration and staging verification.

## Non-Goals

- Supporting arbitrary free-form natural language as directly executable compiler input
- Supporting arbitrary user-defined custom functions in the first repair scope
- Expanding the compiler to every exotic strategy pattern in one pass
- Using fallback code paths to mask unsupported semantics during integration

## Design Principles

- Single semantic source: one strategy meaning, many projections
- No "confirmable but not compilable" state
- Validation before confirmation
- Compiler errors must indicate implementation bugs, not routine user input shape
- Consistency audit verifies fidelity; it must not repair semantics
- Frontend-confirmed structures must map deterministically to execution artifacts

## Chosen Direction

Use a structured semantic graph as the user-facing confirmed representation, and compile that semantic graph into IR immediately upon confirmation. Persist both the semantic graph and IR, but treat IR as the only execution source of truth. The logic graph becomes a visualization/projection layer, not an executable string container.

This rejects two weaker approaches:

- Keeping natural-language graph nodes and adding a rule-to-DSL adapter
  - Lower short-term cost, but preserves semantic drift risk because the user confirms one thing and execution depends on a separate translation layer.
- Making IR itself the frontend editing/confirmation model
  - Strong execution fidelity, but too low-level and too costly for current product and integration flow.

## Target Architecture

### 1. StrategyIntentPlanner

Responsibility:

- Convert user conversation and existing context into structured intent
- Determine completeness
- Never emit executable operator strings

Output shape:

- `symbols`
- `timeframes`
- `riskRules`
- structured `entryIntents`
- structured `exitIntents`
- structured `riskIntents`

Contract:

- `logicReady=true` means "semantically complete enough to build a structured graph"
- It does not mean "already executable DSL"

### 2. SemanticGraphBuilder

Responsibility:

- Convert structured intent into a typed semantic graph
- Provide the representation shown to the user for confirmation

Rules:

- No free-text `operator: string`
- Nodes must use typed semantic primitives
- Every node must be serializable, replayable, and compiler-addressable

Example node families:

- `price_change_pct`
- `bar_reference`
- `indicator_value`
- `indicator_cross`
- `threshold_compare`
- `bollinger_band_touch`
- `bollinger_bars_outside`
- `grid_level_touch`
- `position_avg_price_compare`
- `position_pnl_pct`
- `logical_and`
- `logical_or`
- `logical_not`

### 3. SemanticGraphValidator

Responsibility:

- Validate semantic completeness
- Validate reference correctness
- Validate compiler support before confirmation

Rules:

- `CHECKLIST_GATE` can only be entered with a valid semantic graph
- Unsupported strategies must fail here with explicit reasons
- The validator becomes the boundary between "user intent understanding" and "execution eligibility"

Representative error family:

- `codegen.semantic_graph_incomplete`
- `codegen.semantic_graph_invalid_reference`
- `codegen.semantic_graph_unsupported_feature`
- `codegen.semantic_graph_invalid_join`

### 4. SemanticGraphCompiler

Responsibility:

- Compile semantic graph into canonical IR

Capabilities required in the redesign:

- Multi-timeframe signal references
- Previous-bar and N-bars-back references
- Position average price references
- Position PnL-based predicates
- Bollinger band series and predicates
- Grid level-set compilation
- Logical composition with deterministic joins
- Long-only, short-only, and long-short position modes

Constraint:

- Compiler input must be typed semantic graph, never natural-language rule text

### 5. IR-backed Execution Flow

Responsibility:

- Persist IR immediately after successful confirmation/compilation
- Generate AST and script exclusively from IR
- Treat script as a compiled artifact, not an independently interpreted strategy

Persisted artifacts:

- `semanticGraph`
- `compiledIr`
- `compiledAst` or derivable AST
- `script`

Execution truth:

- `compiledIr`

Visualization truth:

- `semanticGraph`, which must remain a projection of the same semantics

### 6. ConsistencyAudit

Responsibility:

- Verify that the emitted script faithfully represents IR and semantic graph

Restrictions:

- Must not reinterpret or "fix" user strategy meaning
- Must not serve as a late-stage semantic repair mechanism

The audit becomes an acceptance gate, not a reconciliation engine.

## End-to-End Data Flow

New flow:

`User Message -> StrategyIntentPlanner -> SemanticGraphBuilder -> SemanticGraphValidator -> CHECKLIST_GATE -> Confirm -> SemanticGraphCompiler -> IR -> AST -> ScriptEmitter -> ConsistencyAudit -> Backtest/Publish`

This removes the broken current behavior:

`natural language rules -> fake graphSnapshot.operator strings -> DSL parser -> compile failure`

## First-Class Support Boundary

The first formal support set must include ordinary strategies that the UI can naturally express and users will reasonably expect to work.

### Market and Time Semantics

- Single timeframe and multi-timeframe references
- Current bar, previous bar, N-bars-back
- Bar-close evaluation and next-bar-open execution timing
- Position-state references such as average entry price

### Indicator and Price Semantics

- Price relative change
- SMA / EMA
- RSI
- ATR
- Bollinger upper / middle / lower bands
- Count of bars outside Bollinger bands
- Fixed-price range grid with equal-distance steps
- Threshold / cross / equality / interval comparisons

### Action and Portfolio Semantics

- `OPEN_LONG`
- `CLOSE_LONG`
- `OPEN_SHORT`
- `CLOSE_SHORT`
- `REDUCE_POSITION`
- `long_only`
- `short_only`
- `long_short`
- position sizing by percent
- stop-loss and take-profit based on percentage
- risk conditions tied to position state

### Composition Semantics

- `AND`
- `OR`
- `NOT`
- entry / exit / risk phase separation

## Explicitly Unsupported in This Repair Scope

- Arbitrary user-defined custom indicator functions
- Direct execution of free-form natural language conditions
- Unbounded nested free-form strategy grammar
- Exotic order-program families beyond the scoped ordinary strategy set

Unsupported strategies must fail at semantic graph validation, not at confirmation or compilation.

## Contract Changes

### User-Facing Contract

If the frontend shows a strategy as a confirmable logic graph, then that graph must already be:

- structurally typed,
- semantically valid,
- compiler-supported,
- and eligible for `confirmGenerate`.

The system must not display a graph as confirmable if it has not passed those checks.

### Backend Contract

- `logicReady=true` no longer implies "draw a graph from rule strings"
- `CHECKLIST_GATE` no longer accepts free-text graph operators
- `confirmGenerate` only accepts prevalidated semantic graphs
- compile-stage input shape errors should disappear from normal user flow

## Migration Plan

### Phase 1: Introduce SemanticGraphV2

- Add new semantic graph schema and builder
- Keep existing string-based graph snapshot readable for compatibility
- Route all new sessions through semantic graph generation
- Add validation before `CHECKLIST_GATE`

### Phase 2: Compile from SemanticGraphV2

- Make confirmation compile from semantic graph only
- Persist compiled IR as execution source
- Keep legacy graph snapshots viewable but non-authoritative

### Phase 3: Remove Legacy String-Operator Execution Path

- Remove string `operator` as executable compiler input in the primary path
- Retire `graph_operator_invalid` from normal user confirmation flow
- Keep legacy migration handling only where necessary for old records

## Testing Strategy

The redesign must add real-flow coverage, not only hand-crafted compiler fixtures.

### Layer 1: Planner -> Semantic Graph

Test that ordinary strategies become valid semantic graphs.

Representative cases:

- Bollinger breakout / reversion
- Multi-timeframe drop-then-take-profit
- Position-average-price exits
- Fixed-range grid strategy

### Layer 2: Semantic Graph -> IR

Test compiler correctness for:

- multi-timeframe references
- previous-bar references
- position average price
- Bollinger band nodes
- grid level sets
- long-short mode

### Layer 3: IR -> Script -> Consistency Audit

Test that emitted script is a faithful compilation of IR, not an independent semantic rewrite.

### Layer 4: End-to-End User Flow

Test:

`message -> logicReady -> graph confirm -> confirmGenerate -> script/backtest-ready`

These tests must use realistic user inputs, not manually injected DSL graph snapshots.

## Acceptance Criteria

The redesign is complete only when all of the following are true:

- A graph shown to the user for confirmation is always structurally typed and prevalidated.
- `confirmGenerate` no longer fails because a natural-language graph was treated as DSL.
- Ordinary strategies expressed through the current UI can complete the full compiled flow.
- Unsupported strategies fail earlier at semantic validation with explicit reasons.
- Script/strategy drift is prevented structurally by shared semantics, not patched later by fallback or consistency repair.
- Real user-flow tests cover the supported strategy set.

## Risks

### Risk: Scope expansion into a full strategy language rewrite

Mitigation:

- Constrain first-class support to the ordinary strategy set defined in this spec
- Reject unsupported features early and explicitly

### Risk: Frontend and backend models drift during migration

Mitigation:

- Version the semantic graph schema
- Use shared contracts where possible
- Block confirmation if schema version or support matrix is invalid

### Risk: IR and semantic graph diverge over time

Mitigation:

- Compile IR only from semantic graph
- Treat IR as execution truth
- Rebuild graph views from semantic graph or IR projections, not script introspection

### Risk: Tests still only validate artificial fixtures

Mitigation:

- Add end-to-end conversation-driven tests as a hard requirement
- Treat fixture-only compiler tests as insufficient coverage

## Rollout Guidance

- Land semantic graph infrastructure before expanding compiler capability
- Do not introduce fallback code paths to hide unsupported semantics during integration
- Make the first rollout block invalid confirmation rather than allow later compile failure
- Expand supported ordinary strategies in the compiler only after semantic graph validation and contracts are in place

## Final Recommendation

Adopt semantic graph as the confirmed user-facing strategy representation, compile semantic graph into IR immediately, and make IR the sole execution truth. This is the smallest design that meaningfully eliminates the current structural bug and creates a stable foundation for ordinary quant strategy support without relying on fallback behavior.
