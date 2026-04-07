# AI Quant Rule-Based Canonical Spec V2 Design

Date: 2026-04-07
Issue: #692

## Background

The current AI quant strategy pipeline can produce scripts that do not faithfully match the user strategy when the strategy contains multiple branches. The core failure mode is not only missing clarification, but also weak intermediate modeling:

- The conversation layer can allow rules to progress without uniquely determining direction, side scope, or risk effect.
- The canonical strategy spec is too weak, relying on flattened `entries[]`, `exits[]`, and `riskRules`.
- The compiler and consistency audit need to infer rule boundaries and action-direction mappings from text instead of consuming an explicit rule model.
- As a result, mutually exclusive branches can be merged into a single rule, or a full-close risk action can be degraded into a reduce action.

This design upgrades the strategy pipeline to a rule-based canonical model so that multi-branch strategies can be represented, compiled, audited, and published without semantic collapse.

## Goals

- Introduce `CanonicalStrategySpecV2` as the only publishable canonical format for new strategies.
- Model `entry`, `exit`, `risk`, and `rebalance` as first-class explicit rules.
- Require the conversation layer to resolve ambiguities that would otherwise produce different rule actions, side scopes, or risk effects.
- Make the compiler a deterministic consumer of explicit rule definitions instead of a semantic guesser.
- Upgrade consistency audit and publication gate to validate rule-level correctness.
- Cover the first wave of common multi-branch strategy families with reusable condition nodes, not per-strategy hardcoded patches.

## Non-Goals

- No long-term compatibility path that still allows new publishing from the old canonical structure.
- No attempt to solve every strategy family in the first rollout.
- No broad refactor unrelated to AI strategy clarification, canonical spec, compilation, or publication gating.

## User Problem Statement

The system must not produce a script when the user strategy is still ambiguous, and it must not publish a script if a semantically clear strategy was compiled incorrectly. The solution must scale beyond a single Bollinger example and prevent the same class of bugs for grid, moving average crossover, RSI, breakout, and similar multi-branch strategies.

## Design Overview

The strategy pipeline becomes:

`user strategy -> clarification gate -> canonical spec v2 -> compiler input -> generated script -> consistency audit -> publication gate`

Each layer has one responsibility:

- Clarification gate: resolve any ambiguity that could produce different rules.
- Canonical spec v2: persist explicit rule semantics.
- Compiler: generate code from explicit rules without cross-rule guessing.
- Consistency audit: prove the script matches rule semantics.
- Publication gate: block any unprovable or failed result.

## Canonical Strategy Spec V2

### Top-Level Shape

`CanonicalStrategySpecV2` keeps global metadata and introduces explicit rule modeling:

- `version: 2`
- `market`
- `indicators`
- `sizing`
- `executionPolicy`
- `dataRequirements`
- `rules[]`

Global fields remain responsible only for cross-rule defaults and shared context. Any strategy behavior that can vary by branch must live in `rules[]`.

### Rule Model

Each rule is an independent semantic unit:

- `id`
- `phase: entry | exit | risk | rebalance`
- `sideScope: long | short | both | flat`
- `priority`
- `condition`
- `actions[]`
- `metadata`

#### Rule Invariants

- A single `entry` rule must not contain mutually exclusive opening actions such as `OPEN_LONG` and `OPEN_SHORT`.
- Any direction-sensitive `exit`, `risk`, or `rebalance` rule must explicitly declare `sideScope`.
- A rule must carry a structured condition tree, not only a freeform text trigger.
- `phase` and `actions[]` must be semantically compatible.

### Condition Tree

The condition model is a structured tree:

- atomic node
- `AND`
- `OR`
- `NOT`

Atomic node examples:

- `bollinger.upper_break`
- `bollinger.lower_break`
- `bollinger.middle_revert`
- `bars_outside_band >= 3`
- `price_change_pct <= -0.01`
- `position_loss_pct >= 0.05`
- `grid_level_reached`
- `cross_over`
- `cross_under`
- `touch_or_above`
- `touch_or_below`
- `return_to_level`

The compiler consumes these nodes directly. It no longer reconstructs conditions by reinterpreting raw text.

### Action Model

Each action explicitly states the intended effect:

- `OPEN_LONG`
- `OPEN_SHORT`
- `CLOSE_LONG`
- `CLOSE_SHORT`
- `REDUCE_LONG`
- `REDUCE_SHORT`
- `BLOCK_NEW_ENTRY`
- `FORCE_EXIT`

Each action can additionally contain:

- sizing data
- effect scope
- optional reason code

This separation is required to distinguish actions such as:

- full close vs partial reduce
- long-side close vs short-side close
- forced stop vs ordinary exit

## Clarification Gate Design

### Clarification Objective

The clarification layer does not aim to collect every possible field. It must ensure that each candidate rule can be uniquely compiled.

The system must continue asking questions before logic graph confirmation when any of the following are not uniquely determined:

- rule action
- side scope
- condition basis
- risk effect

### Clarification Style

The interaction remains conversational:

- explain the ambiguity in one sentence
- ask one question only
- preserve already confirmed rule facts
- continue only on the highest-priority unresolved ambiguity

Recommended wording pattern:

`当前这条规则还缺少方向约束，否则会产生两种不同脚本。我先确认一下：突破布林带上轨时，你是只做空，还是也允许做多？`

### Clarification Blocking Rules

The conversation must not proceed to logic graph confirmation when:

- one rule can resolve to both `OPEN_LONG` and `OPEN_SHORT`
- a direction-sensitive rule lacks `sideScope`
- a risk rule can resolve to either `full close` or `reduce`
- an exit basis can resolve to two different condition semantics

This pushes semantic uniqueness forward into the dialogue instead of relying on compiler-time failure.

## Compiler Design

### Compiler Contract

The compiler accepts only `CanonicalStrategySpecV2` for new publishing flows.

Compiler behavior:

- one canonical rule becomes one predicate tree
- one canonical rule becomes one decision block
- conditions are not merged across rule boundaries
- actions are not merged across rule boundaries
- action direction is never inferred from free text when already present in the rule

### Deterministic Rule Expansion

For a strategy like:

- upper band break -> open short
- lower band break -> open long
- middle band return -> close current side
- three bars outside band -> force full close

The compiler must emit independent rules rather than combining them into a shared `AND` condition or shared action bundle.

## Consistency Audit Design

### Audit Scope

The audit must validate rule-level agreement between canonical spec v2 and script output:

- rule count
- rule key mapping
- side scope
- phase
- condition family
- action/effect
- sizing semantics where applicable

### Audit Outcome Rules

Publication must fail when any critical rule property is missing, mismatched, or not provable:

- a canonical rule has no corresponding script rule
- a script rule uses the wrong action for the matched semantic key
- a `full close` rule is implemented as `reduce`
- a long-only or short-only rule is emitted as `both`
- a rule boundary was collapsed and cannot be reconstructed from the script

## Publication Gate

The publication gate becomes strict:

- only `CanonicalStrategySpecV2` is publishable
- any old canonical structure is non-publishable
- any failed or unprovable critical audit result blocks publication

This applies even if a script passed static or runtime checks. Executability is not enough; semantic fidelity is required.

## Strategy Family Coverage

The first rollout covers the most common multi-branch strategy families while keeping the model extensible:

- Bollinger bands
- Grid strategies
- Moving average crossover
- RSI overbought/oversold
- Range breakout / breakdown

Coverage is implemented via reusable condition/operator nodes, not hardcoded strategy-name patches.

## Migration Strategy

### Publishability Policy

- `CanonicalStrategySpecV1` remains readable for historical sessions.
- New generation and publishing flows must use v2 only.
- Any session that still depends on v1 is blocked from publication.
- If an old strategy cannot be deterministically migrated, the system must require re-confirmation through the new clarification flow.

### Rollout Stages

1. Introduce spec v2 types, validator, and audit model.
2. Add clarification rules that guarantee v2 rule uniqueness.
3. Update the compiler to consume v2 only for new publishable flows.
4. Harden publication gate to reject non-v2 or non-provable outputs.
5. Migrate tests and fixtures by strategy family.

## Error Handling

### Conversation Phase

If ambiguity remains:

- stay in drafting state
- do not generate logic graph
- do not generate script
- ask the next single clarification question

### Canonical Validation Phase

If the canonical rule set violates invariants:

- reject spec construction
- surface the reason in structured validator output
- do not continue into compiler

### Publish Phase

If the audit fails or cannot prove rule fidelity:

- block publication
- keep the session reviewable
- expose the exact failing rule or invariant

## Testing Strategy

### Unit Tests

- clarification rule detection for missing action uniqueness
- clarification rule detection for missing side scope
- canonical spec v2 validator invariant failures
- compiler rule expansion without cross-rule merges
- audit failures for action/effect mismatches

### End-to-End Tests

For each first-wave strategy family, include:

- unique and valid case
- missing critical parameter case
- direction ambiguity case
- risk effect ambiguity case

### Regression Rules

Tests must explicitly prevent:

- merging mutually exclusive branches into one entry rule
- converting full close into reduce
- dropping side-specific exits into a shared generic exit
- publishing an old-format or semantically unprovable result

## Acceptance Criteria

The rollout is accepted only if all of the following are true:

- multi-branch strategies are represented as explicit independent rules in canonical spec v2
- clarification blocks any strategy that cannot yet uniquely determine rule action or side scope
- compiler no longer merges conditions or actions across rule boundaries
- consistency audit can prove rule-level fidelity
- publication is blocked for v1, failed, or unprovable outputs
- first-wave strategy families pass the new regression matrix

## Risks And Mitigations

- Risk: rollout is too broad for one pass.
  Mitigation: limit first-wave strategy families, but keep reusable condition nodes and validator rules general.

- Risk: old fixtures and tests still encode flattened assumptions.
  Mitigation: migrate fixtures by family and reject old publishable paths instead of silently adapting them.

- Risk: dialogue becomes form-like.
  Mitigation: preserve one-question conversational clarification with stored prior confirmations.

## Open Decision Log

These choices were intentionally fixed during brainstorming:

- spec structure is upgraded directly instead of maintaining long-term old-format publish compatibility
- old-format strategies are blocked from publication
- first rollout covers high-frequency strategy families rather than every family at once
- risk and rebalance rules are modeled as first-class explicit rules
- direction and mutually exclusive action ambiguity are resolved in dialogue before logic graph confirmation
