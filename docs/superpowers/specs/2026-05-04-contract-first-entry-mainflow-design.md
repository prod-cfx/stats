# Contract-First Entry And Mainflow Design

## Background

The LLM strategy codegen pipeline already uses a large-atom semantic state:

- `triggers`
- `actions`
- `risk`
- `position`
- `contextSlots`

Executable atoms can also carry `SemanticAtomContract` entries with structured
`capabilities` and `requires`. This is the right main data shape.

The current bug is not that the main state shape is wrong. The bug is that some
entry logic still uses small strategy templates to decide whether a large atom
exists. For example, fixed-range grid extraction can require `range + stepPct`
before it creates a trigger. A user can describe the same executable capability
with `range + gridCount` or `range + absoluteSpacing`, but the trigger is dropped
before contract readiness can reason about missing or equivalent capability
fields.

## Goal

Make the entry layer and the whole main data flow consistently use the same
large-atom and contract model.

The entry layer must output semantic patches shaped as:

- `triggers`
- `actions`
- `risk`
- `position`
- `contextSlots`

Every executable entry-layer atom must carry contracts. A bare `key` or `params`
value can help display and compatibility, but it must not be the source of
truth for readiness, confirmation, or compilation.

## Non-Goals

- Do not redesign the top-level `SemanticState` shape.
- Do not create a strategy-family-first recognizer.
- Do not fix only the fixed-range grid wording.
- Do not let legacy `StrategyLogicSnapshot` decide whether semantic strategy
  logic is ready, confirmable, or compilable.

## Core Rule

Mainflow modules must not use strategy family, legacy checklist fields, or a
single atom key as the semantic closure condition.

Semantic closure must come from normalized large atoms and their contracts:

- atom status
- atom `openSlots`
- contract `capabilities`
- contract `requires`
- normalized contract shape validity
- contract conflicts

Strategy family labels may exist only as derived metadata, display grouping, or
compile routing hints.

## Current Failure Pattern

The problematic pattern is:

```text
entry extractor sees a possible strategy phrase
 -> tries to match a complete small template
 -> missing one template field
 -> returns without creating the large atom
```

For the grid case:

```text
text includes fixed price range, grid count, absolute step, and budget
 -> fixed grid template requires percentage step
 -> no trigger is created
 -> downstream contract readiness never sees price.define.level_set
```

The correct behavior is:

```text
recognized fragment -> corresponding large atom with contracts
missing details -> openSlots
conflicting details -> openSlots
complete details -> locked atom
```

## Entry-Layer Design

`SemanticSeedExtractorService` and planner-patch ingestion must produce only the
large semantic patch structure:

```ts
interface EntrySemanticPatch {
  triggers?: SemanticTriggerPatch[]
  actions?: SemanticActionPatch[]
  risk?: SemanticRiskPatch[]
  position?: SemanticPositionPatch | null
  contextSlots?: SemanticContextPatch
}
```

Each executable patch item must include:

```ts
{
  key: string
  status: 'locked' | 'open'
  source: 'user_explicit' | 'derived' | 'inferred'
  openSlots: SemanticSlotState[]
  contracts: SemanticAtomContract[]
}
```

The extractor may use pattern matching, parser logic, and LLM-provided semantic
patches, but it must not discard a recognized executable concept because a
strategy-family template is incomplete.

### Entry Atom Examples

Fixed-range grid wording should become separate large atoms:

```ts
triggers: [{
  key: 'condition.level_set',
  phase: 'entry',
  status: 'locked',
  contracts: [{
    kind: 'trigger',
    capabilities: [{
      domain: 'price',
      verb: 'define',
      object: 'level_set',
      shape: {
        mode: 'fixed_range',
        lower: 78800,
        upper: 81400,
        gridCount: 10,
        absoluteSpacing: 260,
        spacingMode: 'arithmetic',
      },
    }],
    requires: [],
    params: {},
  }],
}]
```

The corresponding order program should be an action atom:

```ts
actions: [{
  key: 'order_program.limit_ladder',
  status: 'locked',
  contracts: [{
    kind: 'action',
    capabilities: [
      {
        domain: 'order_program',
        verb: 'maintain',
        object: 'limit_ladder',
        shape: {
          orderType: 'limit',
          timeInForce: 'gtc',
          recycleOnFill: true,
          pairingPolicy: 'adjacent_level',
        },
      },
      {
        domain: 'capital',
        verb: 'allocate',
        object: 'per_order_budget',
        shape: { value: 500, asset: 'USDT' },
      },
    ],
    requires: [
      { domain: 'price', verb: 'define', object: 'level_set' },
    ],
    params: {},
  }],
}]
```

Risk wording should become risk atoms with contracts when possible:

```ts
risk: [
  {
    key: 'risk.stop_loss_pct',
    status: 'locked',
    params: {
      valuePct: 5,
      direction: 'loss',
      basis: 'entry_avg_price',
      basisSource: 'user_explicit',
      effect: 'close_position',
      scope: 'current_position',
    },
    contracts: [{
      kind: 'risk',
      capabilities: [{
        domain: 'guard',
        verb: 'enforce',
        object: 'stop_loss_pct',
        shape: {
          valuePct: 5,
          basis: 'entry_avg_price',
          effect: 'close_position',
          scope: 'current_position',
        },
      }],
      requires: [],
      params: {},
    }],
  },
]
```

## Contract Normalization

Introduce a single contract normalization path used by entry, readiness,
projection, invariant checks, and compiler adapters.

The normalizer should turn equivalent surface forms into stable contract shapes.
For `price.define.level_set`, accepted fixed-range variants include:

- `lower + upper + gridCount`
- `lower + upper + absoluteSpacing`
- `lower + upper + spacingPct`
- `lower + upper` with an open slot for missing level density when required by
  an order program

Centered-range variants include:

- `centerSource + halfRangePct + gridCount`
- `centerSource + totalRangePct + gridCount`

Conflicts must not be silently resolved. If `gridCount` and `absoluteSpacing`
contradict the range, keep the atom, mark the conflict with `openSlots`, and ask
the user which value should win.

## Mainflow Audit Scope

The implementation plan must inspect and align these mainflow stages:

1. Entry extraction
   - `SemanticSeedExtractorService`
   - `extractSemanticPatchFromMessage`
   - planner `semanticPatch` ingestion

2. Patch-to-state conversion
   - `SemanticSeedStateBuilderService`
   - semantic merge and reducer services

3. Readiness
   - `SemanticContractReadinessService`
   - readiness must use normalized contract validity and open slots.

4. Confirmation and clarification
   - `SemanticStateProjectionService`
   - confirmation prompts must be generated from `SemanticState`.
   - legacy summaries must not add duplicate or contradictory strategy logic.

5. Canonical and compile path
   - `buildCanonicalSpecForConversation`
   - canonical spec builder
   - IR / AST compiler services
   - invariant checks

6. Legacy compatibility boundary
   - `buildLegacyLogicSnapshotProjectionForCompatibility`
   - `resolveClarificationArtifacts`
   - legacy fallback paths

Legacy projection may be generated from `SemanticState` for old consumers. It
must not be used as the source of truth for semantic readiness, confirmation, or
compilation when `SemanticState` exists.

## Required Behavioral Invariants

- Entry extraction must never drop a recognized executable concept only because
  a strategy template is incomplete.
- Missing semantic details become `openSlots`.
- Conflicting semantic details become `openSlots`.
- Executable atoms from the entry layer must carry contracts.
- Bare `key` and `params` cannot make an atom ready or compilable without the
  corresponding contracts.
- Confirmation summaries must be generated from `SemanticStateProjection`.
- Strategy family is derived from atoms and contracts; it is never an entry
  precondition.

## Regression Matrix

Add tests that prove different wording maps to the same large atoms and
contracts, not just the same strategy family label.

### Grid / Order Program

Equivalent fixed-range level-set descriptions:

- `价格区间 78800-81400，共 10 格`
- `价格区间 78800-81400，网格数量 10 个`
- `价格区间 78800-81400，拆成 10 份`
- `价格区间 78800-81400，每格价格间距 260 USDT`
- `固定区间 78800 到 81400，等距挂 10 档`

All should create:

- a trigger atom with `price.define.level_set`
- an action atom with `order_program.maintain.limit_ladder` when order-program
  wording is present
- a `capital.allocate.per_order_budget` capability when per-order budget wording
  is present

### Indicator / Predicate

Equivalent moving-average descriptions:

- `MA20 上穿 MA50 做多`
- `20 均线上穿 50 均线开多`
- `短均线上穿长均线买入，短均线为 MA20，长均线为 MA50`

All should create trigger/action atoms through indicator and predicate
contracts, not a hard-coded moving-average strategy template.

### Bollinger

Equivalent Bollinger descriptions:

- `价格触及布林带上轨做空`
- `收盘价突破布林上轨开空`
- `布林带 20,2，上轨反向开空，下轨反向开多`

All should create indicator/predicate/action contracts with open slots for
missing period or standard deviation when needed.

### Breakout

Equivalent breakout descriptions:

- `突破前高开多`
- `收盘价站上上一根 K 线最高价买入`
- `突破最近 20 根 K 线高点做多`

All should create data/predicate/action contracts.

### Risk

Equivalent risk descriptions:

- `按入场均价亏损 5% 止损`
- `相对开仓均价下跌 5% 平仓`
- `盈利 10% 止盈`
- `价格突破上下边界时停止并撤销未成交订单`

All should create risk atoms with risk/guard contracts and stable summary text.

## Acceptance Criteria

For the original failing input:

```text
在 OKX 交易 BTCUSDT 永续合约，15m 周期，做固定区间双向网格。
价格区间 78800-81400，共 10 格，按等距价格网格划分，
每格价格间距 260 USDT，每格下单资金 500 USDT。
部署后立即创建限价网格挂单，成交后在相邻网格自动挂反向单。
价格突破上下边界时停止策略并撤销未成交网格订单。
按入场均价亏损 5% 止损，盈利 10% 止盈。
```

The confirmation summary should contain the semantic meaning below without
duplicate legacy risk text:

```text
OKX 永续 BTCUSDT 15m；
入场：区间网格，固定区间 78800-81400，共 10 格，等距价差 260 USDT；
挂单：限价网格，成交后相邻网格反向挂单，每格 500 USDT；
风控：突破上下边界时停止策略并撤销未成交网格订单，不再重新部署网格；
止损：价格相对入场均价下跌 5% 平仓；
止盈：价格相对入场均价上涨 10% 平仓。
```

Tests must also assert the internal data flow:

- `semanticState.triggers` contains a locked or open level-set trigger atom.
- `semanticState.actions` contains a limit-ladder action atom when the input
  mentions grid order maintenance.
- `semanticState.risk` contains stop-loss, take-profit, and boundary guard atoms.
- executable atoms include contracts.
- legacy checklist projection does not add duplicate confirmation summary items.

## Review Checklist

- No mainflow readiness decision is based on legacy checklist fields when
  `SemanticState` exists.
- No entry extractor drops a partially recognized executable atom.
- Every executable entry atom has contract coverage.
- Contract shape normalization is shared instead of repeated ad hoc in
  extractor, readiness, projection, invariant, and compiler code.
- Family labels are derived and optional.
