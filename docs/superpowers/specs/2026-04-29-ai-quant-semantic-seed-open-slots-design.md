# AI Quant Semantic Seed Open Slots Design

## Background

PR #921 (`feat: 打通语义状态表达式主链路`) correctly moved the main strategy generation path to `SemanticState -> CanonicalSpec -> IR -> runtime`. The canonical builder, publication path, reducers, projections, and expression support now understand the large semantic state shape from `semantic-state.ts`: `triggers`, `actions`, `risk`, `position`, and `contextSlots`.

The remaining gap is at the seed entry boundary. `SemanticSeedExtractorService` still returns `CodegenSemanticPatch`, and `CodegenConversationService.buildSemanticStateFromPlannerPatch()` converts that patch into `SemanticState` by defaulting every seed trigger and risk node to `status: 'locked'` and `openSlots: []`. That means a partially recognized semantic atom cannot enter the main semantic state. If the seed extractor does not fully match a phrase, the phrase disappears instead of becoming an open semantic node with clarification slots.

The BTCUSDT 1m example exposes this gap:

- "最新收盘价突破上一根 K 线最高价" should become a locked entry trigger.
- "最新收盘价跌破上一根 K 线最低价" should become a locked exit trigger.
- "突破关键位置开多" should become an open trigger with a slot asking how to define the reference.

## Goal

Complete the #921 migration at the seed boundary so seed extraction preserves the same large semantic node contract used by the rest of the system.

After this change:

- Seed extraction may emit complete locked nodes.
- Seed extraction may emit partial open nodes with `openSlots`.
- Patch-to-state conversion must preserve node `status`, `openSlots`, `source`, and `evidence`.
- Missing or partial semantics should not silently disappear when the system can identify the large semantic atom family.
- Existing planner patch inputs without node envelopes remain compatible.

## Non-Goals

- Do not introduce new normalized trigger atom keys for candle or breakout variants.
- Do not move canonical generation back to `normalizedIntent`.
- Do not replace the #921 expression path.
- Do not refactor unrelated LLM planner behavior.
- Do not require the seed extractor to understand every future phrase. It only needs a mechanism to retain partial semantic atoms when it can identify their family.

## Current Problem

The current seed path has three layers:

1. `SemanticSeedExtractorService.extract(message)` returns `CodegenSemanticPatch`.
2. `buildSemanticStateFromPlannerPatch(patch)` converts the patch to `SemanticState`.
3. `CanonicalSpecBuilderService.buildFromSemanticState(state)` compiles locked semantic nodes.

Layer 3 is already aligned with #921. Layer 2 is still a compatibility bridge that erases partial-state information because seed patch nodes cannot represent it. The bridge also hard-codes locked status and empty slots.

This creates a bad data shape:

- Fully matched seed phrase: becomes a locked node and compiles.
- Partially matched seed phrase: no node is emitted, so clarification has nothing to ask about.

The correct shape is:

- Fully matched seed phrase: locked node.
- Partially matched seed phrase: open node with open slots.
- Unknown phrase: no node, so planner or later clarification can still handle it.

## Proposed Design

### 1. Extend `CodegenSemanticPatch` Node Envelope

Extend seed patch trigger and risk items with optional semantic node envelope fields:

- `id?: string`
- `status?: SemanticNodeStatus`
- `source?: SemanticSource`
- `evidence?: SemanticEvidence`
- `openSlots?: SemanticSlotState[]`

Position and context handling should also preserve existing open-slot support where applicable. Existing callers that send only `{ key, phase, sideScope, params }` continue to work and default to `locked`, `user_explicit`, and `[]`.

This keeps compatibility with current planner patches while allowing seed extraction to express partial nodes.

### 2. Preserve Envelope in Patch-to-State Builder

Update `buildSemanticStateFromPlannerPatch()` and its helper methods to:

- Read optional node `status`.
- Read optional `openSlots`.
- Read optional `source`.
- Read optional `evidence`.
- Use existing defaults only when those fields are absent.
- Set `status: 'open'` when any `openSlots` item has `status: 'open'`, unless the input explicitly supersedes the node.

This method should stop being a silent "everything is locked" adapter. It should be a compatibility-preserving semantic state builder.

If practical during implementation, extract this private method into a dedicated service such as `SemanticSeedStateBuilderService`. The behavior should stay identical for existing inputs, but tests should no longer need to cast `CodegenConversationService` to access the private builder.

### 3. Teach Seed Extraction to Emit Partial Nodes

Keep the seed extractor's current responsibility: identify likely semantic atoms from user text. Do not make it the compiler.

For fully recognized phrases, emit locked nodes. Examples:

- "收盘价高于开盘价时开多" -> `condition.expression`, entry, long, locked.
- "已有持仓不再开仓" -> `condition.expression`, gate, locked.
- "突破上一根 K 线最高价开多" -> `condition.expression` comparing current close to previous high, entry, long, locked.
- "跌破上一根 K 线最低价平多" -> `condition.expression` comparing current close to previous low, exit, long, locked.

For partially recognized phrases, emit open nodes. Examples:

- "突破关键位置开多" -> entry long `price.breakout_up` with an open reference-definition slot.
- "跌破支撑平多" without a concrete support definition -> exit long open node with reference-definition slot.

Use `condition.expression` for exact bar-to-bar comparisons, because #921 already made expression the mainline for generic series predicates. Use `price.breakout_up/down` for channel-like or reference-defined breakout families, including partial references that need clarification, such as "关键位置", "支撑", or "压力".

### 4. Clarification and Compilation Rules

The existing flow already has the right shape:

- `findNextOpenSemanticSlot()` asks about open slots.
- `SemanticStateReducerService` applies answers to open slots.
- `CanonicalSpecBuilderService.buildFromSemanticState()` compiles locked nodes.

The seed boundary should feed that flow:

- Open nodes must block compilation through existing normalization/clarification artifacts.
- Locked nodes must compile without needing normalizedIntent.
- Open trigger slots should have concrete `slotKey`, `fieldPath`, `questionHint`, `priority`, and `affectsExecution`.

### 5. Regression Coverage

Add tests for both positive and guardrail cases:

- BTCUSDT 1m current close greater than previous high opens long with 3% sizing after context is supplied.
- BTCUSDT 1m current close less than previous low closes long.
- Existing no-position gate remains attached to entry rules.
- A partial phrase such as "突破关键位置开多" produces an open semantic trigger instead of disappearing.
- Patch-to-state builder preserves provided `openSlots`, `status`, and `evidence`.
- Existing legacy planner patches without envelope fields still become locked nodes.
- The semantic-only regression guard continues to forbid `buildFromNormalizedIntent()` in the main conversation/publication paths.

## Data Flow

```text
User text
  -> SemanticSeedExtractorService
  -> CodegenSemanticPatch with optional semantic node envelope
  -> Semantic seed state builder
  -> SemanticState
  -> SemanticStateMergeService / SemanticStateReducerService
  -> CanonicalSpecBuilderService.buildFromSemanticState()
  -> IR / AST / runtime
```

## Error Handling

Invalid patch envelope fields should not crash the conversation path. The builder should ignore malformed optional envelope fields and use compatibility defaults. Invalid expression contracts should still fail to compile as they do now, leaving the node out of canonical rules rather than producing unsafe runtime behavior.

Open slots must be explicit enough for clarification. A malformed open slot should be dropped or normalized to a valid slot shape before reaching the reducer.

## Compatibility

This is a non-breaking migration:

- Existing planner patches remain accepted.
- Existing seed extractor tests that expect simple patches remain valid unless they intentionally cover new open-slot behavior.
- Published snapshots already using `SemanticState` continue to compile.
- The normalizedIntent adapter remains a compatibility layer, not a main authority path.

## Acceptance Criteria

- The BTCUSDT 1m previous high/low strategy reaches a compileable semantic state after exchange and market type are provided.
- The system no longer reports "未识别可编译入场规则 / 未识别可编译出场规则" for that strategy.
- Partial recognized trigger semantics produce open slots instead of disappearing.
- Mainline generation remains free of normalizedIntent authority.
- Tests prove the patch-to-state builder preserves open semantic nodes.
