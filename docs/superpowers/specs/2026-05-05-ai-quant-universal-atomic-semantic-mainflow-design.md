# AI Quant Universal Atomic Semantic Mainflow Design

## Background

PR #960 moved the grid-discovered failure toward a contract-first entry and
mainflow model. That direction is correct, but the fix still leaves a system
risk: if the next user expresses the same trading idea through Bollinger bands,
channels, moving averages, RSI, price ranges, previous highs, or another
wording, the pipeline can still fall back to strategy-family or legacy checklist
logic.

The problem is not a missing synonym such as `布林线` versus `布林带`. The problem is
that some code still treats strategy family recognition, legacy rule fields, or a
complete family-specific template as the condition for recognizing, clarifying,
confirming, or compiling a strategy.

The product requirement is broader:

- all strategy semantics must flow through universal atomic state;
- missing information must become `openSlots`;
- executable readiness must come from atom contracts;
- strategy family names must never decide mainline readiness.

This is a launch-blocking convergence requirement. The implementation must not
stop at the next failing wording. It must remove or quarantine every remaining
mainline decision point that still uses strategy family, legacy checklist
completion, or family-specific template completeness as semantic authority.

## Goal

Make this structure the only AI strategy semantic main data flow:

```ts
{
  triggers,
  actions,
  risk,
  position,
  contextSlots,
}
```

Each executable semantic node must follow the same atomic shape:

```ts
{
  id,
  key,
  status,
  source,
  params,
  contracts,
  openSlots,
}
```

`strategy family` may exist only as display metadata, migration metadata, or a
compiler routing hint. It must not participate in whether the system recognizes,
clarifies, confirms, generates, publishes, or deploys a user strategy.

## Non-Goals

- Do not add another strategy-family recognizer.
- Do not solve the Bollinger probe by adding only synonym coverage.
- Do not make `entryRules`, `exitRules`, `riskRules`, or any checklist field the
  source of truth for mainline behavior.
- Do not require the user to name a strategy family.
- Do not redesign the top-level atomic state shape.
- Do not remove legacy compatibility fields unless they directly block mainline
  atomic behavior.

## Hard Rules

1. Mainline semantic state is only `triggers`, `actions`, `risk`, `position`, and
   `contextSlots`.
2. Any recognized trading fragment must create or update one of those atoms.
3. Missing information must be represented as an `openSlot` on the owning atom or
   context slot.
4. Executable completeness must be derived from atom `contracts`, contract
   `requires`, normalized contract `capabilities`, and blocking `openSlots`.
5. Strategy family labels must not be used as closure conditions.
6. Legacy checklist projection must be one-way compatibility output unless an
   explicit legacy session is being handled.
7. If atomic semantics are complete but canonical projection cannot compile, that
   is an internal projection coverage failure, not a user-facing request for
   more strategy rules.
8. Any code path that still emits user-facing strategy-family, checklist
   completion, or legacy compileability blockers in a mainline session is a
   release blocker.
9. Compatibility code must be explicitly named, isolated, and tested as
   compatibility-only. Silent fallback from atomic mainline into compatibility
   behavior is forbidden.

## Current Failure Pattern

The user probe:

```text
15min 布林线下轨买入 上轨卖出
```

should be treated as partial but meaningful atomic semantics:

- `contextSlots.timeframe = 15m`
- lower boundary condition
- upper boundary condition
- buy / sell actions
- possible indicator source text

Instead, the conversation can still behave as if it needs to identify a complete
strategy family and then asks broad legacy questions such as strategy position
direction and sizing. That makes the system brittle: the next wording may fail
again even if it expresses the same atomic intent.

Correct behavior:

```text
recognized phrase
 -> create trigger/action/context atoms
 -> attach contracts and openSlots
 -> ask only for missing contract/context slots
 -> confirm when blocking openSlots and requirements are closed
```

Incorrect behavior:

```text
recognized phrase
 -> try to match a complete Bollinger/grid/RSI/etc. template
 -> missing one family field
 -> drop atoms or ask legacy checklist questions
```

## Residual Legacy Audit Requirement

Before implementation changes are considered complete, the codebase must have an
explicit audit of remaining old-authority paths. The audit must classify every
match into one of these buckets:

1. **Deleted from mainline**: the code path no longer influences recognition,
   clarification, readiness, confirmation, generation, publication, or deploy.
2. **Converted to atom/contract/openSlot**: the code now creates or updates
   `triggers/actions/risk/position/contextSlots`.
3. **Compatibility-only**: the code is reachable only for explicit legacy
   sessions, migration, display projection, or old fixtures.
4. **Internal diagnostic only**: the code can fail builds, tests, or engineering
   diagnostics, but cannot ask the user for more strategy text.

The audit must include at least these categories:

- strategy-family names and family-specific template checks;
- legacy `entryRules`, `exitRules`, and `riskRules` readiness checks;
- `missing_position_pct`, `missing_position_mode`, and related checklist
  clarification reasons;
- user-facing compileability messages such as `未识别可编译入场规则`;
- canonical projection failures that currently become user clarification;
- parser branches that drop a recognized phrase because a family template is
  incomplete.

Any unclassified match blocks release.

## Atomic Semantics

### Triggers

Triggers describe conditions, not strategy families.

Examples:

- price boundary touch / cross / break
- indicator boundary touch / cross / break
- moving-average cross
- percentage move
- previous high / previous low break
- candle expression
- position state condition
- time / session / startup condition

Example contract-first trigger:

```ts
{
  key: 'price.detect.indicator_boundary',
  phase: 'entry',
  sideScope: 'long',
  status: 'open',
  source: 'user_explicit',
  params: {
    sourceText: '布林线下轨买入',
    indicator: { name: 'bollinger', sourceText: '布林线' },
    boundaryRole: 'lower',
    event: 'touch_or_cross',
  },
  contracts: [{
    kind: 'trigger',
    capabilities: [{
      domain: 'price',
      verb: 'detect',
      object: 'indicator_boundary',
      shape: {
        indicator: { name: 'bollinger' },
        boundaryRole: 'lower',
        event: 'touch_or_cross',
      },
    }],
    requires: [],
    params: {},
  }],
  openSlots: [
    {
      key: 'indicator.bollinger.params',
      fieldPath: 'triggers[...].params.indicator',
      status: 'open',
      questionHint: '请确认布林线参数，或使用系统默认参数。',
    },
  ],
}
```

The indicator name is part of the trigger shape. It is not a strategy family
gate.

### Actions

Actions describe execution intent.

Examples:

- open long
- close long
- open short
- close short
- reverse position
- maintain limit ladder
- cancel orders
- reduce position

Ambiguous wording must create action atoms with open slots instead of blocking
recognition. For example, `上轨卖出` under perpetual futures may mean close long,
open short, or reverse. The owner action should carry an `order.intent` open
slot until the user answers.

### Risk

Risk atoms describe guards and exits:

- stop loss
- take profit
- trailing stop
- max drawdown
- position PnL threshold
- boundary cancellation
- order cancellation
- exposure cap

Risk atoms must carry contracts and ask through open slots when basis, scope, or
effect is missing.

### Position

Position is the capital and exposure model, not a strategy family field.

Examples:

- position sizing: percentage, quote amount, base amount
- position mode: long only, short only, long-short
- margin / leverage intent where applicable
- pyramiding / simultaneous exposure policy where applicable

Missing sizing should be represented as a `capital.allocate.position_sizing`
open slot on the position atom. Missing side mode should be represented as an
`exposure.set.position_mode` open slot. Neither should be generated from legacy
`missing_position_pct` or checklist rules in the mainline.

### Context Slots

Context slots bind execution environment:

- exchange
- symbol
- marketType
- timeframe

They are universal slots and must be merged across turns. A reply such as
`okx`, `btcusdt`, `永续合约`, or `15min` updates the matching slot directly; it
must not re-enter a strategy-family parser.

## Data Flow

### 1. Entry

The entry layer reads user text and emits only an atomic semantic patch:

```ts
interface AtomicSemanticPatch {
  triggers?: SemanticTriggerPatch[]
  actions?: SemanticActionPatch[]
  risk?: SemanticRiskPatch[]
  position?: SemanticPositionPatch | null
  contextSlots?: SemanticContextPatch
}
```

It may use deterministic parsing, LLM planner output, aliases, and existing
extractors. Its output contract is still the same: atom patches only.

It must not drop a recognized atom because a family-specific template is
incomplete.

### 2. Normalize

The normalizer converts atom patches into canonical atom contracts:

- shape normalization;
- equivalent wording normalization;
- contract requirement derivation;
- conflict detection;
- open slot generation.

If shape information is partial, the atom remains present with blocking or
non-blocking `openSlots`.

### 3. Merge

The reducer and merge services merge atoms by stable identity and semantic
signature, not by strategy family. User answers fill owner open slots or
contextSlots. Superseded atoms remain ignored by readiness.

### 4. Clarify

Clarification is generated only from:

- open context slots;
- atom `openSlots`;
- contract missing requirements;
- normalized contract shape conflicts.

The question service may rank questions for UX, but it must not invent
checklist-era blockers.

If an existing checklist-era reason is still needed for compatibility, it must
be produced from an already-created owner atom open slot and carry evidence that
points back to that atom. It must not originate from checklist completeness.

### 5. Ready And Confirm

The confirmation gate is reached when:

- required context slots are locked;
- active atoms have no blocking open slots;
- active contracts have no missing blocking requirements;
- contract shapes normalize successfully;
- no blocking conflicts remain.

Legacy compileability may run as an internal diagnostic. It must not become a
user-facing clarification authority when atomic readiness is clear.

### 6. Canonical And Compiler

Canonical spec generation and IR compilation read atom contracts. They may route
different capability objects to specialized compilers, but the routing key is a
contract capability, not a strategy family label.

If the compiler lacks projection coverage for a complete atom contract, the
session should surface an internal projection coverage failure for engineering
and tests. It should not ask the user to restate entry or exit rules.

## Compatibility Boundary

Legacy fields such as checklist `entryRules`, `exitRules`, `riskRules`, and
derived strategy family labels may remain for:

- old session recovery;
- display summaries;
- audit logs;
- migration fixtures;
- explicit compatibility tests.

They must not write backward into the mainline semantic authority unless they
are first converted into atomic patches.

When checklist data and atomic semantic state conflict, atomic semantic state
wins.

Compatibility entry points must be visibly named as compatibility code. Examples
of acceptable naming include `legacy`, `compatibility`, or
`nonSemanticCompatibilityOnly`. Compatibility code must not be imported by a
mainline service without an explicit guard that proves the session is legacy.

## Error Handling

User-facing clarification should name the missing atom slot, not an abstract
strategy family failure.

Examples:

- Good: `请确认每次开仓的仓位大小（例如 10% / 10 USDT / 0.001 BTC）。`
- Good: `你说“上轨卖出”。在永续合约下，这是平多、开空，还是反手？`
- Good: `请确认布林线参数，或选择使用默认参数。`
- Bad: `未识别可编译入场规则。`
- Bad: `请确认策略属于哪种类型。`
- Bad: `当前策略族字段不完整。`

Projection or compiler coverage failures should be logged and tested as internal
diagnostics with enough atom/contract evidence to fix the compiler path.

## Testing Strategy

### Invariant Tests

- All mainline entry paths output only `triggers/actions/risk/position/contextSlots`.
- Every executable atom has contracts.
- Missing contract requirements become owner atom `openSlots`.
- Mainline clarification questions are derived from open slots or contract
  requirements.
- Strategy family labels do not participate in readiness decisions.
- Legacy compileability blockers are not emitted after atomic readiness is clear.
- A mainline session cannot call compatibility-only readiness or clarification
  code.
- A recognized phrase cannot be discarded because a family-specific parser lacks
  one field.
- Every user-facing clarification item has an owner `openSlot`, owner atom path,
  or context slot path.

### Residual Legacy Negative Tests

Add negative tests around the old failure modes so they cannot return:

- no mainline prompt contains `未识别可编译入场规则` or `未识别可编译出场规则`;
- no mainline next action uses `compileability` as a user clarification key;
- no mainline readiness branch depends on `entryRules.length`,
  `exitRules.length`, strategy family names, or family-specific template
  completeness;
- no mainline code path asks the user to identify a strategy type;
- no mainline code path converts a canonical projection miss into a request for
  more entry / exit rule text.

These tests should fail loudly during launch verification if old authority leaks
back into the mainflow.

### Cross-Expression Regression Matrix

These prompts do not all need to publish immediately. They must all produce
atomic state and open slots rather than falling back to family-specific failure:

- `15min 布林线下轨买入 上轨卖出`
- `15min 布林带下轨做多 上轨平多`
- `价格碰通道下沿买，上沿卖`
- `突破上边界开空，回到中线平仓`
- `RSI 低于30买入，高于70卖出`
- `均线金叉买入，死叉卖出`
- `前高突破买入，跌破前低卖出`
- `上涨2%开多，回撤1%平仓`
- `持仓盈利10%止盈，亏损5%止损`

For each prompt, assertions should check:

- non-empty relevant atom arrays;
- contracts on executable atoms;
- expected context slots when present;
- expected open slots when execution-affecting details are missing;
- no legacy strategy-family or compileability blocker prompt.

### Conversation Continuity Tests

The follow-up sequence from the screenshot should be covered:

```text
15min 布林线下轨买入 上轨卖出
okx
btcusdt
永续合约
多空都做
```

Expected behavior:

- each answer updates the corresponding context or position atom;
- previously recognized trigger/action atoms remain present;
- the next question is the highest-priority remaining blocking open slot;
- the system never restarts family recognition or asks for a strategy family.

## Acceptance Criteria

1. The universal atomic state shape is documented as the mainline invariant.
2. Entry, merge, clarification, readiness, confirmation, canonical generation,
   and compatibility boundaries all follow the invariant.
3. Strategy family labels are removed from mainline readiness conditions.
4. Missing details become owner `openSlots`.
5. Contract requirements drive readiness and clarification.
6. Complete atomic semantics never fall through to user-facing legacy
   compileability blockers.
7. Cross-expression tests prove that the system is not only fixed for grid or
   Bollinger wording.
8. A residual legacy audit classifies every old-authority match as deleted,
   converted, compatibility-only, or internal diagnostic only.
9. CI or targeted regression tests fail if mainline code reintroduces
   strategy-family, checklist-completion, or compileability clarification
   authority.
10. The screenshot flow and the cross-expression matrix all keep previously
    recognized atoms across follow-up answers.

## Implementation Notes

This design should be implemented as a convergence change, not a one-off parser
patch. Existing services can be reused, but their authority boundaries must be
tightened:

- `SemanticSeedExtractorService` and planner patch ingestion should only emit
  atomic patches.
- `SemanticSeedStateBuilderService` should attach contracts and open slots to
  incomplete atoms.
- `SemanticContractReadinessService` should remain the readiness normalizer for
  missing requirements and shape slots.
- `StrategyClarificationRulesService` should stop acting as a mainline checklist
  completion gate.
- `CodegenConversationService` should rank and ask semantic open slots, then
  confirm, without selecting legacy compileability as clarification authority.
- canonical builders and compilers should consume contracts as capability
  sources.

The implementation plan should begin with a residual-authority inventory before
editing behavior. That inventory should use targeted searches and tests to find
all mainline references to strategy family, checklist completion, and
compileability clarification. Only after the inventory is classified should the
behavior changes be made. This prevents another narrow fix that solves the
current probe while leaving the next expression path broken.

## Review Checklist

- No section depends on a strategy family as a source of truth.
- All missing information is represented through open slots.
- Legacy checklist is explicitly compatibility-only.
- The design covers the Bollinger probe without making Bollinger special.
- The design is broad enough for other natural-language strategy expressions.
- The design treats residual old-authority paths as release blockers, not
  follow-up cleanup.
