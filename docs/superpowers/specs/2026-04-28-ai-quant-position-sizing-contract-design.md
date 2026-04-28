# AI Quant Position Sizing Contract Design

## Background

Issue #920 moved AI Quant generation toward `SemanticState` as the primary strategy authority. The current semantic flow already represents triggers, actions, risk, position, and context as structured semantic atoms, but position sizing still has legacy assumptions in the conversation path.

The failure case is:

> 用 BTCUSDT 1m K 线。每次最新 K 线收盘价高于开盘价时尝试开多，固定使用 10 USDT。如果已有持仓则不再开仓。收盘价低于开盘价时平多。

The system can extract or compile fixed quote sizing in some paths, but the main conversation flow still treats a valid position as “fixed ratio only”. This causes `fixed_quote 10 USDT` to be overwritten by an open clarification slot asking for a percentage. A local regex patch can fix one phrase, but it does not solve the architectural problem: position sizing needs a first-class semantic contract.

## Goals

- Make position sizing a first-class contract in `SemanticState`, not a loose `{ mode, value }` object with scattered validators.
- Support ratio, quote amount, and base quantity sizing in both initial user messages and clarification answers.
- Keep the new main flow on `SemanticState -> CanonicalSpec -> IR -> AST`, without falling back to legacy `positionPct` completeness checks.
- Preserve compatibility with existing persisted semantic states and canonical sizing fields.
- Avoid adding any new `NORMALIZED_TRIGGER_ATOM_KEYS`.

## Non-Goals

- This design does not add portfolio-level risk sizing formulas such as volatility parity or Kelly sizing.
- This design does not change exchange minimum order validation; runtime order sizing constraints remain outside semantic parsing.
- This design does not change risk semantics such as stop loss or take profit.

## Position Contract

Add an explicit position sizing contract and use it as the canonical semantic shape:

```ts
export type SemanticPositionSizingContract =
  | {
      kind: 'ratio'
      value: number
      unit: 'ratio' | 'percent'
    }
  | {
      kind: 'quote'
      value: number
      asset: 'USDT' | 'USDC' | 'USD'
    }
  | {
      kind: 'base'
      value: number
      asset: string
    }
```

`SemanticPositionState` keeps `positionMode`, status, source, evidence, and openSlots, but gains a `sizing` contract:

```ts
export interface SemanticPositionState {
  sizing: SemanticPositionSizingContract | null
  positionMode: string
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots?: SemanticSlotState[]

  // Legacy compatibility during migration only.
  mode?: string
  value?: number
}
```

Compatibility reads may still accept legacy `mode/value`, but all new writes should populate `sizing`.

## Supported Language

The parser should normalize these classes into the same contract instead of special-casing one phrase at each consumer:

- Ratio:
  - `用 10% 仓位`
  - `单笔百分之十资金`
  - `每次使用 0.1 资金比例`
- Quote amount:
  - `固定使用 10 USDT`
  - `每次 10u`
  - `单笔 10 刀`
  - `投入 10 美元`
- Base quantity:
  - `每次买 0.001 BTC`
  - `固定 0.01 ETH`
  - `单笔 2 SOL`

The parser should return a structured result with evidence text. It may continue to use deterministic pattern extraction, but downstream code must depend on the contract, not on phrase-specific checks.

## Data Flow

### Seed Extraction

`semantic-seed-extractor.service.ts` should produce `semanticPatch.position.sizing`:

- ratio language -> `{ kind: 'ratio', value: 0.1, unit: 'ratio' }` or `{ kind: 'ratio', value: 10, unit: 'percent' }`, normalized before canonical build.
- quote language -> `{ kind: 'quote', value: 10, asset: 'USDT' }`.
- base language -> `{ kind: 'base', value: 0.001, asset: 'BTC' }`.

The parser should avoid classifying stop loss, take profit, maximum drawdown, or risk amount language as position sizing.

### Planner Patch

`CodegenSemanticPatch.position` should accept the new `sizing` shape. Legacy planner output with `{ mode, value }` remains accepted and is converted into the new contract.

### Required Slots

`withRequiredSemanticOpenSlots()` should check `validateSemanticPositionContract(position)` instead of checking `position.mode === 'fixed_ratio'`.

If no valid sizing contract exists, it should open one position slot:

- slotKey: `position.sizing`
- fieldPath: `position.sizing`
- questionHint: `请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。`

The open slot should not assume the missing answer must be a percentage.

### Clarification Answers

`semantic-state-reducer.service.ts` should parse the active `position.sizing` answer into the same contract parser used by seed extraction:

- `10%` locks ratio sizing.
- `10 USDT`, `10u`, `10刀` lock quote sizing.
- `0.001 BTC` locks base sizing.

The reducer writes `position.sizing`, status, source, evidence, and the slot value. It must not write only `position.value` as a percentage.

### Projection

`semantic-state-projection.service.ts` formats the contract:

- ratio -> `仓位：10%`
- quote -> `仓位：10 USDT`
- base -> `仓位：0.001 BTC`

Deterministic completeness should treat all valid sizing contracts as complete.

### Canonical Builder

`canonical-spec-builder.service.ts` maps position sizing from `SemanticState`:

- `ratio` -> `CanonicalStrategySpecV2.sizing = { mode: 'RATIO', value }`
- `quote` -> `CanonicalStrategySpecV2.sizing = { mode: 'QUOTE', value }`
- `base` -> `CanonicalStrategySpecV2.sizing = { mode: 'QTY', value }`

The builder should prefer `position.sizing` over legacy `position.mode/value`.

### IR Compiler

No major IR compiler redesign is required if existing sizing mappings remain:

- `RATIO` -> `pct_equity`
- `QUOTE` -> `fixed_quote`
- `QTY` -> `fixed_base`

Tests should confirm the contract survives through `SemanticState -> CanonicalSpec -> IR`.

## Validation

`strategy-semantic-contracts.ts` should own position contract validation:

- `ratio` value must be finite and greater than 0. Percent values must be normalized or validated consistently before canonical build.
- `quote` value must be finite and greater than 0; asset must be a supported quote asset.
- `base` value must be finite and greater than 0; asset must be a non-empty uppercase asset symbol.
- `positionMode` remains constrained to supported side modes.

This validator is the only completeness predicate for new position sizing flow.

## Compatibility

Existing persisted semantic states may still contain:

```ts
{ mode: 'fixed_ratio' | 'fixed_quote' | 'fixed_qty', value: number }
```

Readers should convert this shape into `sizing` at boundaries. New writes should include `sizing`. Compatibility support can remain until older sessions no longer need migration.

Legacy checklist projection may still expose `riskRules.positionPct` for old snapshots, but it must not decide new semantic completeness.

## Testing

Add or update tests for:

- Initial message with `固定使用 10 USDT` does not ask for position percentage.
- Clarification answer `固定使用 10 USDT` locks quote sizing.
- Clarification answer `10u` locks quote sizing.
- Clarification answer `10刀` locks quote sizing.
- Initial message with `每次买 0.001 BTC` locks base sizing.
- Clarification answer `0.001 BTC` locks base sizing.
- Existing `10%` tests keep passing.
- Projection formats `10 USDT`, `0.001 BTC`, and `10%`.
- CanonicalSpec and IR preserve `QUOTE` and `QTY` sizing.

## Acceptance Criteria

- The user example with `固定使用 10 USDT` no longer asks for “单笔仓位百分比”.
- Reworded quote sizing such as `10u` and `10刀` behaves the same as `10 USDT`.
- Base quantity sizing such as `0.001 BTC` is supported in the same flow.
- New semantic completeness logic relies on `validateSemanticPositionContract`, not a hard-coded `fixed_ratio` check.
- No new `NORMALIZED_TRIGGER_ATOM_KEYS` are added.
