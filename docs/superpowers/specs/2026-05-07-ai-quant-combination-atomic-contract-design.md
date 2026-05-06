# AI Quant Combination Atomic Contract Design

## Context

The current AI Quant semantic mainline already uses atomic semantic domains:

- `triggers`
- `actions`
- `risk`
- `position`
- `contextSlots`

Remote `main` also already has important combination and contract capabilities:

- `SemanticTriggerState`, `SemanticActionState`, `SemanticRiskState`, and `SemanticPositionState` support `contracts?: SemanticAtomContract[]`.
- `SemanticAtomContract` already has `id`, `kind`, `capabilities`, `requires`, `params`, and `effects`.
- `SemanticStateProjectionService` already reads trigger contract params such as `displayGroupId`, `groupId`, and `combinationId` for display grouping.
- `CanonicalSpecBuilderService` already recognizes several legacy grouping markers.
- `CanonicalSpecV2IrCompilerService` already compiles `AND`, `OR`, `allOf`, and `anyOf`.
- The compiled runtime already evaluates `allOf`, `anyOf`, `riskPredicates`, ATR predicates, and remembered-level predicates.

The problem is therefore not missing combination support from scratch. The problem is that combination semantics are not yet a standard, end-to-end trigger contract protocol. Some strategy shapes are recognized in early semantic extraction, but the later publication path can lose the relationship between grouped triggers, actions, and risk effects.

## Goal

Build one contract-first semantic compilation model for both simple single-leg strategies and combination strategies.

Simple strategies and combination strategies must not be two separate pipelines. A simple strategy is the singleton form of the same model:

- A single entry trigger is an implicit one-member entry group.
- A single exit trigger is an implicit one-member exit group.
- Explicit combination strategies are groups with multiple trigger members, a `join`, and a single action binding.
- Gate triggers are attached to entry groups as preconditions.
- Risk remains in the `risk` atomic domain and is not folded into trigger groups.

The source of truth remains `SemanticState`:

```text
SemanticState.triggers/actions/risk/position/contextSlots
  -> contract normalization
  -> CanonicalSpec
  -> IR/AST/compiled artifact
  -> consistency alignment
```

No profile or compatibility projection may become a replacement source of truth. Profiles can be reports or compatibility projections only.

## Contract Model

Combination membership is expressed through trigger contracts. The implementation should reuse the existing `contracts` array and standardize the combination fields under `contracts[].params`, with equivalent shape metadata under `capabilities[].shape` when useful.

Recommended trigger contract shape:

```ts
{
  id: 'contract-entry-ema-stack',
  kind: 'trigger',
  capabilities: [{
    domain: 'market',
    verb: 'combine',
    object: 'predicate_group',
    shape: {
      groupId: 'entry-ema-stack',
      join: 'AND',
      role: 'member',
      phase: 'entry',
      sideScope: 'long',
      actionKey: 'open_long',
      actionBinding: 'single_action'
    }
  }],
  requires: [],
  params: {
    groupId: 'entry-ema-stack',
    join: 'AND',
    role: 'member',
    actionKey: 'open_long',
    actionBinding: 'single_action'
  }
}
```

The first implementation can use `contracts[].params` as the primary read path, because current services already read contract params. `capabilities[].shape` should mirror the same semantic intent for contract clarity and future extension.

Required fields:

- `groupId`: stable id for the predicate group.
- `join`: `AND` or `OR`.
- `role`: initially `member`; future roles can be added only when they map to executable semantics.
- `actionKey`: action atom bound to the group, such as `open_long` or `close_long`.
- `actionBinding`: `single_action`, meaning the whole group produces one bound action, not one action per member.

Derived fields:

- `phase` can be read from the trigger itself if omitted.
- `sideScope` can be read from the trigger itself if omitted.

Compatibility:

- Existing loose fields such as `params.groupId`, `semanticGroupId`, `logicalGroupId`, `combinationId`, and `atomicCombinationId` may remain fallback inputs during testing.
- New deterministic output should write the standard contract fields.
- Because this is a testing-stage feature, broad old-data migration is out of scope.

## Compilation Rules

Every deterministic entry or exit trigger is compiled through a rule-group builder:

1. Read the trigger's standard combination contract.
2. If no explicit contract exists, create an implicit singleton group for that trigger.
3. Group by `phase + sideScope + actionKey + groupId`.
4. Compile each member trigger into a canonical condition atom or expression.
5. Combine member conditions with the group `join`.
6. Bind the group action once when `actionBinding = single_action`.
7. Attach applicable gate conditions to entry groups.
8. Emit one canonical rule per executable group.

This preserves simple strategy behavior because a singleton group compiles to the same condition and action as the existing single-trigger rule.

Gate handling:

- Gate triggers remain trigger atoms with `phase = gate`.
- Gate conditions do not create trading actions.
- Gate conditions attach to compatible entry groups as preconditions.
- The resulting entry rule condition is `AND(entryCondition, gateCondition...)`.

Risk handling:

- Risk atoms stay in `SemanticState.risk`.
- ATR multiple stop and take-profit compile to `riskPredicates`.
- Remembered-level stop compiles to `riskPredicates` and declares required runtime state keys.
- Percent stop-loss and take-profit continue through existing guard/risk rule paths.
- Consistency must recognize that risk predicates and guards can implement `FORCE_EXIT`, `CLOSE_LONG`, or related effects even when those effects are not ordinary decision-program actions.

## Acceptance Strategies

### Strategy 1: EMA Stack Entry

Input:

```text
入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里价格低于EMA20平多；止损：5%强制平仓；仓位：10usdt
```

Expected semantic shape:

- Three entry triggers: `indicator.above` for EMA20, EMA60, EMA144.
- All three entry triggers share the same standard contract group:
  - `groupId = entry-ema-stack`
  - `join = AND`
  - `actionKey = open_long`
  - `actionBinding = single_action`
- One exit trigger for price below EMA20, bound to `close_long`.
- One risk atom for 5% stop-loss with `FORCE_EXIT`.
- Position sizing is fixed quote `10 USDT`.

Expected compiled behavior:

- One entry rule: `AND(price > EMA20, price > EMA60, price > EMA144) -> OPEN_LONG`.
- No separate entry actions for EMA20, EMA60, and EMA144.
- One exit rule for EMA20 break-down.
- Stop-loss force exit remains present in risk alignment.

### Strategy 2: MA20 Breakout With ATR Risk

Input:

```text
ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈。
```

Expected semantic shape:

- Entry trigger for MA20 breakout or above-MA20 entry.
- Risk atom `risk.atr_multiple_stop` with `multiple = 2`.
- Risk atom `risk.atr_multiple_take_profit` with `multiple = 3`.
- Position and context slots locked by follow-up answers.

Expected compiled behavior:

- Entry decision emits `OPEN_LONG`.
- IR contains `riskPredicates` for `atrMultipleStop` and `atrMultipleTakeProfit`.
- Compiled artifact contains `RISK_PREDICATES`.
- Consistency does not report missing `FORCE_EXIT` or `CLOSE_LONG` when those effects are implemented by risk predicates.

### Strategy 3: Breakout Retest With Remembered Level Stop

Input:

```text
BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。
```

Expected semantic shape:

- Entry trigger `condition.sequence` with `sequenceKind = breakout_retest`.
- The sequence uses memory key `breakout`.
- Risk atom `risk.remembered_level_stop` with `levelKey = breakout`.

Expected compiled behavior:

- Runtime requirements include state key `breakout`.
- IR contains `rememberedLevelStop`.
- Consistency does not report missing `FORCE_EXIT` when the remembered-level risk predicate implements it.

### Strategy 4: MA100 Gate, MACD Entry, OR Exit

Input:

```text
SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。
```

Expected semantic shape:

- Gate trigger `indicator.above` for MA100.
- Entry trigger `indicator.cross_over` for MACD golden cross, bound to `open_long`.
- Exit trigger `indicator.below` for MA100.
- Exit trigger `indicator.cross_under` for MACD death cross.
- Both exit triggers share the same standard contract group:
  - `groupId = exit-ma100-macd`
  - `join = OR`
  - `actionKey = close_long`
  - `actionBinding = single_action`
- Risk atom for 5% stop-loss after user confirmation.

Expected compiled behavior:

- Entry rule condition is `AND(MACD golden cross, MA100 gate) -> OPEN_LONG`.
- Exit rule condition is `OR(price below MA100, MACD death cross) -> CLOSE_LONG`.
- Consistency can trace `macd.death_cross:exit:long` through the compiled `anyOf` predicate.
- Stop-loss remains a risk atom and compiles through the existing risk path.

## Consistency Alignment

Consistency must check that compiled artifacts implement the original `SemanticState` contract:

- Trigger group membership is preserved.
- Group `join` is preserved.
- Group members are all present in compiled predicates.
- `single_action` groups bind the action once.
- Gates are attached to compatible entry groups.
- Risk atoms are present as guards or risk predicates.
- Risk effects are counted from guards and risk predicates, not only from decision programs.
- Position sizing is present in portfolio sizing and open actions.
- Context slots are present in market/execution envelope.

The current `StrategySemanticProfile` can remain as a report-friendly projection, but it must not become the semantic source. Any new alignment check should read from `SemanticState` or from a canonical contract projection derived directly from `SemanticState`.

## Testing

Required unit coverage:

- Contract normalization turns explicit group contracts into stable group descriptors.
- Missing explicit contract creates an implicit singleton group.
- Singleton groups compile like existing simple single-leg strategies.
- AND entry groups compile to one canonical rule and one action.
- OR exit groups compile to one canonical rule and one action.
- Gate triggers attach to entry groups without creating independent trading actions.
- ATR risk and remembered-level risk compile to `riskPredicates`.
- Consistency alignment recognizes risk predicate effects.

Required regression coverage:

- The four acceptance strategies publish successfully and pass consistency.
- Existing simple MA, RSI, MACD, stop-loss, and take-profit strategies still publish through the same singleton group model.

Required negative coverage:

- Multiple triggers with the same group but conflicting `join` values fail with a clear semantic contract error.
- Multiple triggers with conflicting `actionKey` values are split into distinct executable groups or fail if the contract claims a single action.
- A multi-member group without a known `join` does not silently split into multiple entries.

## Out of Scope

- Broad migration of old persisted sessions.
- Replacing `SemanticState` with a new profile or top-level combination graph.
- Rewriting the compiled runtime for `allOf`, `anyOf`, ATR, or remembered-level predicates, because these already exist on `main`.
- General multi-leg portfolio orchestration beyond the current single-position strategy shapes.

## Success Criteria

- Simple and combination strategies use the same rule-group compilation model.
- Combination intent is represented in trigger contracts, not in a separate semantic source.
- The four reported strategies no longer fail with `CONSISTENCY_FAILED`.
- Strategy 1 does not split one AND entry into three entries.
- Strategy 2 does not report missing `FORCE_EXIT` or `CLOSE_LONG`.
- Strategy 3 does not report missing `FORCE_EXIT`.
- Strategy 4 does not report missing `macd.death_cross:exit:long`.
- Existing simple single-leg strategy tests remain green.
