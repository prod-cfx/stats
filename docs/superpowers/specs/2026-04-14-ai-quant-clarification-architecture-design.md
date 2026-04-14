# AI Quant Clarification Architecture Design

Date: 2026-04-14
Status: Draft for review

## Context

The current AI Quant clarification flow over-asks in the wrong places for complex strategies such as grid trading. The immediate symptom is not only that the product asks too many questions, but that the question direction is wrong:

- it asks based on checklist slot gaps instead of true execution ambiguity
- it mixes strategy semantics with execution context
- it lets clarification compensate for weak normalization
- it makes strategy onboarding scale with handwritten family-specific patches

This is especially visible in grid strategies, where current questioning can incorrectly demand extra clarification for side mode, basis, TP/SL shape, or other fields that should either normalize cleanly or only be asked when there is a real execution fork.

At the same time, the product requirement is not "ask less at all costs". The first priority remains:

- stability and consistency across strategy -> script -> backtest -> deploy

This design therefore aims to reduce unnecessary clarification without weakening semantic stability.

## Current Mainline Baseline

After aligning with the latest `origin/main`, the real mainline already contains an important portion of the target direction:

- a bounded semantic capability catalog
- first-wave trigger atoms and first-wave families
- `StrategyIntentNormalizerService`
- `StrategyNormalizedIntent`
- canonical-spec-v2-driven downstream compilation and validation

The current mainline data flow is effectively:

`Natural Language -> checklist/session state -> StrategyIntentNormalizer -> StrategyNormalizedIntent -> Canonical Spec v2 -> compiled IR / script / backtest / deploy checks`

The current problem is therefore not that normalization is absent. The current problem is that:

- checklist still acts as the dominant conversational truth
- clarification still primarily reasons over checklist gaps and handwritten missing reasons
- market context is not isolated as a first-class execution object
- normalized intent exists, but is not yet the single clarification boundary
- canonical spec v2 is still the active compilation center

This design should therefore be understood as an evolution from the current mainline, not a greenfield rewrite.

## Goals

- Replace slot-gap-driven clarification with ambiguity-driven clarification.
- Preserve and strengthen consistency across strategy, script, backtest, and deploy.
- Handle complex strategies such as grid without family-specific patch accumulation.
- Keep beginner-friendly conversational UX with one-question-at-a-time clarification.
- Preserve already-stable MA and Bollinger strategy behavior through migration.
- Reuse the atomic library already present on `main`.

## Non-Goals

- Do not move leverage, margin mode, hedge mode, or account-level execution settings into first-round strategy clarification.
- Do not make family objects executable truth.
- Do not rely on open-ended semantic interpretation from raw natural language all the way to codegen.
- Do not replace the current system in a single cutover.

## Problem Statement

The current architecture conflates four concerns:

1. User input interpretation
2. Strategy semantic normalization
3. Clarification triggering
4. Cross-artifact consistency checking

Because those concerns are mixed, the clarification layer acts like a fallback semantic parser. That leads to:

- wrong questions for grid and other complex strategies
- repeated additions of handwritten clarification reasons
- family-specific drift
- checklist becoming de facto source of truth
- potential loss or drift of market context across multi-turn merges

The core architectural correction is:

- semantic normalization must happen before clarification
- clarification must operate on ambiguity, not incompleteness
- consistency gates must operate after IR generation, not on user language

## Target Architecture

The target flow is:

`Natural Language -> checklist/session memory -> Constrained Normalizer -> ExecutionContext + Atomic Intent Graph candidates -> Resolver -> Strategy IR -> canonical-spec-v2 compatibility output during migration -> script/backtest/deploy -> Consistency Gate`

Clarification only happens between candidate generation/resolution and Strategy IR finalization.

## Core Principles

### 1. Constrained normalization, not open semantic understanding

The first layer does not try to "understand anything the user might mean". Its job is to map user input into a bounded semantic space backed by an atomic rule library.

The output is not text understanding. The output is executable candidate semantics.

### 2. Family is not executable truth

Family remains useful for:

- UX grouping
- recommendation summaries
- routing to likely candidate atomic rules
- default semantic injection

But family must never define execution semantics directly.

The single executable semantic truth is the atomic graph plus execution context, and then the compiled Strategy IR.

This is intentionally stricter than the current mainline family usage: family may route, summarize, and assist controlled default injection, but must not become runtime execution truth.

### 3. Clarification only resolves forks

Clarification does not ask because:

- a field is empty
- a sentence looks incomplete
- a checklist slot is missing
- the model is unsure in a generic sense

Clarification asks only when:

- execution context cannot be uniquely formed, or
- multiple valid atomic interpretations remain and they would produce different Strategy IR / backtest behavior

### 4. Consistency gates do not touch user semantics

After Strategy IR is formed, downstream gates should compare compiled artifacts only. They must not re-interpret user text.

## Core Objects

### ExecutionContext

ExecutionContext is separate from the atomic graph.

It contains only first-round execution environment truth required to compile legal strategy semantics:

- `exchange`
- `symbol`
- `marketType`
- `timeframe`

ExecutionContext participates in:

- legality checks
- clarification gate
- Strategy IR compilation
- consistency/publication validation

ExecutionContext explicitly does not include:

- leverage
- margin mode
- hedge mode
- account-level deploy settings

Those belong to later execution/deployment flows unless they become strictly required for legal execution.

### Atomic Intent Graph

Atomic Intent Graph is the only executable strategy semantic source before compilation.

It should be organized into five stable atomic domains:

- `trigger`
- `action`
- `sizing`
- `risk`
- `relation`

Supporting atomic properties such as basis, comparator, threshold, scope, or direction live inside those domains as structured fields, not as ad hoc text.

The graph must be expressive enough that:

- grid strategies are graph compositions, not special-case runtime objects
- MA and Bollinger strategies map naturally without strategy-family-specific execution paths
- future strategies can be introduced by extending atomic rules rather than expanding handwritten clarification branches

Note:

- the current mainline `StrategyNormalizedIntent` should be treated as the nearest existing precursor to this layer
- the target architecture should evolve that layer toward stricter executable atomic meaning instead of discarding it blindly

### Strategy IR

Strategy IR is a new clean intermediate representation and should be introduced as a new layer rather than treating the current canonical spec as the long-term core truth.

Strategy IR is compiled from:

- resolved `ExecutionContext`
- resolved `Atomic Intent Graph`

All downstream executable artifacts should ultimately derive from Strategy IR:

- script
- backtest config
- deploy config

However, the current mainline reality is that canonical spec v2 is still the active compilation center.

So the intended migration posture is:

- short term: `StrategyNormalizedIntent -> Canonical Spec v2` remains active
- medium term: `ExecutionContext + Atomic Intent Graph -> Strategy IR -> Canonical Spec v2 compatibility output`
- long term: Strategy IR becomes the compilation center and canonical spec v2 becomes compatibility-facing rather than core-facing

### Clarification Gate

Clarification Gate operates on candidate ambiguity, not on slot completeness.

It accepts:

- `ExecutionContext` candidates
- `Atomic Intent Graph` candidates

During migration this also implies:

- current checklist-driven clarification still exists
- normalized-intent blockage already exists on mainline through `blockerReason`
- the target is to shift clarification progressively toward execution-context forks and atomic semantic forks rather than handwritten slot-gap reasons

It triggers only for:

1. Execution context forks
2. Atomic semantic forks that produce materially different Strategy IR

Examples:

- missing exchange/symbol/marketType/timeframe: ask
- conflicting market context across turns: ask
- one stable grid interpretation from current rules: do not ask
- multiple legal Bollinger breakout interpretations with different trigger semantics: ask
- multiple drawdown basis interpretations with different backtest outcomes: ask

### Consistency / Publication Gate

This layer remains, but its scope is narrowed and made cleaner.

It validates that:

- `ExecutionContext + Strategy IR`
- compiled script
- backtest inputs/results assumptions
- deploy payload

remain semantically aligned.

It must not read or reinterpret user natural language.

## Clarification Decision Rule

The clarification rule should be formalized as:

> Ask only if the current `ExecutionContext + Atomic Intent Graph` state still permits multiple equally legal and materially different executable interpretations.

This replaces the current behavior of asking because a named checklist field is absent.

### Cases that should not ask

- The atomic rule library resolves the expression to a unique graph.
- Different textual phrasings normalize to the same graph.
- Family labels differ but executable graph is the same.
- Product copy is vague but executable semantics are already unique.
- A stable default can be injected by the atomic rule library without creating semantic forks.

### Cases that should ask

- Missing or conflicting execution context.
- Multiple legal trigger interpretations.
- Multiple legal basis interpretations.
- Multiple legal action-direction interpretations.
- Any unresolved fork that changes generated IR, script behavior, or backtest outcome.

## How This Solves The Current Grid Problem

For the grid case discussed in this thread:

- the system should not ask because a `grid.sideMode` slot is missing
- the system should not ask generic basis questions if the atomic mapping resolves "reverse one grid take profit" uniquely
- the system should not ask for an overall TP if per-grid profit-taking is already the stable executable meaning
- the system should still ask for exchange, symbol, market type, and timeframe if execution context is not uniquely known

This moves failure to the correct layer:

- if normalization is strong, no clarification is needed
- if a real fork remains, clarification asks about that fork
- if execution context is missing, clarification asks for execution context

## Migration Strategy

Migration should be incremental and dual-track.

### Phase 1: Merge `main` and adopt the current semantic baseline

- Merge the latest `main` into the working branch.
- Treat the atomic library, `StrategyIntentNormalizerService`, `StrategyNormalizedIntent`, and canonical-spec-v2 pipeline on `main` as the baseline capability, not as something to rewrite from scratch.

### Phase 2: Isolate `ExecutionContext` and tighten normalized intent semantics

Add a semantic tightening path that produces:

- `ExecutionContext`
- stricter candidate `Atomic Intent Graphs` building on the current normalized intent shape
- eventually resolved `Strategy IR`

without yet replacing the current production compilation path.

### Phase 3: Route clarification through semantic forks instead of checklist gaps

Shift clarification triggering source gradually:

- from handwritten checklist missing reasons
- toward execution-context ambiguity and atomic semantic ambiguity

while preserving one-question-at-a-time UX.

### Phase 4: Gold-sample regression

Use already-stable strategies and current mainline outputs as regression anchors:

- MA strategies
- Bollinger strategies
- the discussed grid case
- additional stable historical or staging examples

Compare old vs new on:

- execution context
- compiled semantic intent / IR
- key script behavior
- backtest-relevant behavior

### Phase 5: Gradual cutover

Cut over in stages:

1. question generation source
2. execution-context resolution source
3. semantic resolution source
4. Strategy IR introduction behind canonical-spec-v2 compatibility
5. deprecation of checklist-driven clarification as primary truth

## Compatibility Strategy For Existing Stable Strategies

The new architecture must not overwrite already-stable MA and Bollinger behavior by assumption.

Instead:

- preserve current stable outputs as gold samples
- compile them through the new path
- require semantic equivalence before switching those paths

This means existing stable strategies become migration anchors rather than rewrite targets.

## Risks

### 1. Weak normalization causes too many real forks

If the constrained normalizer is underpowered, the system may still ask many questions. This is healthier than wrong questioning, but still a usability issue.

Mitigation:

- invest in rule-library-driven normalization
- add regression suites by strategy phrase families

### 2. Dual-truth period during migration

For some time, the system will have:

- old checklist-driven semantics
- new atomic-first semantics

Mitigation:

- make the new path shadow-mode first
- compare outputs before any cutover

### 3. Historical canonical spec assumptions may leak forward

If the current canonical spec remains semantically privileged, the new architecture will degrade back toward the old shape.

Mitigation:

- introduce new Strategy IR as the long-term core
- keep canonical spec only as transitional compatibility output

### 4. Family creep can return indirectly

Even if family is not executable truth on paper, it can drift back into semantic control through convenience shortcuts.

Mitigation:

- enforce that runtime compilation only accepts Strategy IR
- prevent family-based direct compilation paths

### 5. Current normalized intent may remain too loose

The current mainline `StrategyNormalizedIntent` is already valuable, but it is still first-wave bounded and still coexists with checklist-led clarification.

If it remains only a recommendation layer rather than evolving toward stricter executable meaning, clarification pressure will continue leaking back into handwritten rules.

Mitigation:

- evolve normalized intent toward stricter executable atomic meaning
- isolate execution context explicitly
- stop treating checklist as the dominant clarification authority

## Design Constraints

- Beginner-friendly one-question-at-a-time UX must remain.
- Stability and consistency outrank reducing question count.
- Clarification must become more accurate before it becomes less frequent.
- Execution context must remain mandatory where needed for unique legal execution.
- The architecture must scale to future strategy types without recurring whitelist-style product patches.

## Recommended Direction

Adopt an atomic-first constrained normalization architecture with:

- independent `ExecutionContext`
- current `StrategyNormalizedIntent` treated as the mainline precursor to a stricter atomic graph
- atomic graph as executable semantic truth
- new `Strategy IR`
- ambiguity-driven clarification
- artifact-only consistency validation

This is the strongest path to solving the current grid clarification issue without creating a new long-term family-driven maintenance trap, while staying aligned with the actual mainline code that already exists today.
