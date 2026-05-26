# Rules-Only Stage 3 Hard Delete Design

## Context

Issue #1633 is stage 3 of the rules-only pipeline from #1629. Stage 2, merged in PR #1676, moved the AI Quant mainflow to rules-first execution: conversation output, readiness, display, canonical spec, IR, script generation, backtest, and deploy payload now rely on `rules -> canonical spec -> IR`.

Stage 3 is different. It must remove the old flat five-bucket model and every legacy compatibility path. After this stage, the system must not keep flat buckets as state, as compatibility input, as display fallback, as readiness fallback, or as a hidden execution source.

The target flow is:

```text
user text
  -> planner semanticPatch.rules
  -> rules merge / edit / clarification
  -> readiness from rules paths
  -> display graph from rules or canonical spec
  -> canonical spec from typed rules
  -> IR
  -> AST / script
  -> backtest runtime and live deploy snapshot truth
```

No step may produce or consume legacy `trigger/action/risk/positionConstraint/orchestration` state.

## Goals

- Remove `SemanticState.trigger/action/risk/positionConstraint/orchestration`.
- Remove legacy `CodegenSemanticPatch.atoms/triggers/actions/risk/position/orchestration`.
- Delete pure-flat seed/build paths, legacy display fallback, and rules-empty plus flat-nonempty readiness fallback.
- Ensure TypeScript cannot construct a flat-only `SemanticState`.
- Keep all existing 60% strategy capabilities by rebuilding them through typed rules.
- Run the fixed staging 30-strategy corpus from natural language entry through deploy/runtime evidence.

## Non-Goals

- No old session migration adapter.
- No old strategy compatibility adapter.
- No flat projection compatibility layer left after the work is complete.
- No single-strategy special cases to pass staging.
- No restoration of legacy fixture objects as executable input.

## Recommended Approach

Use a replace-then-delete approach.

First, move all remaining consumers from flat readers and projected buckets to a rules-native reader or visitor. Then delete the flat state shape and projection helpers. This avoids a broad unsafe type explosion while still ending with no compatibility layer.

Rejected alternatives:

- Directly deleting flat fields first would create noisy TypeScript failures across conversation, readiness, display, canonical, and tests, increasing the chance of accidental compatibility shims.
- Keeping an internal projection helper would reduce changes but violate #1633 because flat buckets would remain a hidden semantic source.

## Architecture

### Rules-Native Reader

`rules-mainflow-reader.service.ts` remains the central rules reader and should be expanded where needed. It should expose typed views over:

- `rules[].condition`
- `rules[].effects.actions`
- `rules[].effects.risks`
- `rules[].effects.positions`
- `rules[].effects.orchestration`
- `rules[].effects.programs`

The reader may return normalized rule-path facts, but it must not return legacy bucket objects named trigger/action/risk/positionConstraint/orchestration.

### Type Model

`SemanticState` keeps only rules and non-semantic auxiliary state such as context, position runtime metadata, diagnostics, pending edit state, and unsupported status. It no longer extends `SemanticStateBuckets`.

`CodegenSemanticPatch` keeps:

- `contextSlots`
- `rules`

Legacy top-level patch fields are removed from the type. Raw planner schema validation still rejects those fields at runtime because LLM output is untrusted, but internal TypeScript callers cannot construct them.

### Conversation Entry

The planner schema gate continues to reject legacy flat fields with explicit errors. The deterministic dispatcher must emit typed rules directly. It must not emit flat buckets and lift them into rules.

Conversation merge, edit, reducer, and clarification code update rules tree paths only. Open slots must point to rule paths such as:

- `rules[0].condition.atom.params.period`
- `rules[0].effects.actions[0].atom.params.quantity`
- `rules[1].effects.risks[0].atom.params.valuePct`

No new open slot may use flat owners such as `trigger`, `action`, `risk`, or `position`.

### Readiness

Readiness reads typed rules directly:

- `condition` validates entry, exit, gate, sequence, and predicate completeness.
- `effects.actions` validates order actions, side, quantity, and bindings.
- `effects.risks` validates stop loss, take profit, trailing stop, drawdown, and risk basis.
- `effects.positions` validates sizing, budget, exposure, pyramiding, and DCA parameters.
- `effects.orchestration` validates symbol, timeframe, data source, scope, and gate bindings.
- `effects.programs` validates grid, DCA, TWAP, and order-program preconditions.

Rules-empty means no executable semantics and must fail closed. Flat-nonempty fallback is removed.

### Display

Display graph is generated from rules or canonical spec only. It must not:

- Read legacy `entryRules` or `exitRules`.
- Guess executable semantics from display text.
- Use legacy display fallback to backfill execution meaning.

If display cannot render a supported atom, it should render a clear unsupported display state or fail a guard test, not create execution semantics.

### Canonical Spec, IR, Script

`CanonicalSpecBuilder` compiles typed rules directly:

- condition tree -> canonical condition
- `effects.actions` -> canonical actions
- `effects.risks` -> risk guards / exit policy
- `effects.positions` -> sizing and position constraints
- `effects.orchestration` -> gates, scopes, data-source bindings, portfolio controls
- `effects.programs` -> order programs

Any helper that currently accepts `trigger`, `action`, or `risk` bucket objects must either be deleted or rewritten to accept `AtomExpr` leaves or rules-mainflow facts.

Publication gate continues to require rules hash, canonical spec hash, IR hash, AST hash, script hash, and runtime evaluator version. Missing or mismatched hash-chain evidence fails closed.

### Backtest and Deploy

Backtest and deploy use published snapshot truth:

- canonical spec
- compiled IR
- AST / script
- hash-chain evidence
- deployment execution defaults and constraints

Backtest snapshot loading must not infer risk or trigger behavior from `specSnapshot.trigger`, legacy graph nodes, or localized trigger text. If a snapshot lacks formal rules/canonical/IR truth, it fails closed and must be republished through the rules-only pipeline.

Deploy uses `publishedSnapshotId` and persisted snapshot truth. It must not accept semantic fields from the deploy payload as execution truth.

## Delete and Rewrite List

### Delete

- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state-flat-readers.ts`
- `SemanticStateBuckets`
- `SemanticState.trigger`
- `SemanticState.action`
- `SemanticState.risk`
- `SemanticState.positionConstraint`
- `SemanticState.orchestration`
- legacy `CodegenSemanticPatch` fields: `atoms`, `triggers`, `actions`, `risk`, `position`, `orchestration`
- production use of `SemanticRuleProjectionService.projectToFlat`
- production use of `SemanticRuleProjectionService.reprojectFromRules`
- pure-flat seed/build path
- legacy display fallback paths
- rules-empty plus flat-nonempty readiness fallback

### Rewrite

- `codegen-conversation.service.ts`: conversation state checks, generation gates, slot handling, support classification calls, and canonical context must read rules.
- `planner-dispatcher-merge.service.ts`: internal patch type and deterministic merge output must be rules-only.
- `semantic-state-merge.service.ts`: merge rules without syncing flat buckets.
- `semantic-state-reducer.service.ts`: slot fills update rules only.
- `conversation-semantic-edit.service.ts`: edits target rule paths, not flat owner IDs.
- `semantic-contract-readiness.service.ts`: validate rules roles and emit rule-path missing requirements.
- `semantic-state-projection.service.ts`: build display graph from rules/canonical only.
- `semantic-support-classifier.service.ts`: classify support from rules leaves.
- `semantic-executable-semantics.service.ts`: determine executable semantics from rules.
- `semantic-atom-invariant.service.ts`: enforce invariants on rules leaves and rule paths.
- `per-trade-sizing-resolver.service.ts`: read action sizing from rules actions.
- `strategy-execution-context.service.ts`: derive execution context from rules/canonical facts.
- `canonical-spec-builder.service.ts`: remove main-path reads from flat buckets.
- `backtest-snapshot-loader.service.ts`: remove legacy text/trigger inference.
- `account-strategy-view.service.ts`: keep deploy truth on snapshot/hash-chain only.

Tests and fixtures must be rewritten as typed rules corpus or natural-language replay. Legacy fixture objects are not executable compatibility input.

## Source Guards

Production code must fail source guard checks for these patterns:

```text
readFlatTriggers
readFlatActions
readFlatRisks
readFlatPositionConstraints
projectToFlat
reprojectFromRules
SemanticStateBuckets
semanticPatch.atoms
semanticPatch.triggers
semanticPatch.actions
state.trigger
state.action
state.risk
state.positionConstraint
state.orchestration
rules-empty + flat-nonempty
legacy display fallback
```

Allowed mentions:

- Runtime schema rejection tests that assert legacy fields are rejected.
- Documentation describing removed behavior.
- Migration notes in the stage 3 spec or PR body.

## Staging Validation

Use `.env.staging.local` from the repository root to run staging and connect to the staging DB. Use account:

- Email: `123456@qq.com`
- Verification code: `123456`

Before fixing code, query the staging DB for these 30 strategies and record failures. Each failure must be fixed through the generic rules-only mainflow. Do not add one-off handling for a single strategy.

For each strategy, record:

- conversation id
- strategy id
- published snapshot id
- rules hash
- canonical spec hash
- IR hash
- script hash
- backtest result or fail-closed reason
- deploy payload evidence or fail-closed reason
- runtime execution evidence or fail-closed reason

The staging corpus is:

1. 入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt
2. 15min k线里面 价格在ema20 ema60 ema144上方时做多开仓 都位于下方只开空 入场是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损5%止损
3. 在okx交易所 我想买btc  3分钟之内跌百分1买入  15分钟之内涨百分2卖出  单笔用百分10资金 止损5% 止盈10%
4. OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。
5. 在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈
6. 在 OKX 现货 ORDI/USDT 上，主周期 1h，使用 10% 固定仓位只做多；入场动作为立即开始时市价买入；出场规则为价格相对前收盘上涨 1% 时卖出，另有相对入场均价下跌 5% 止损卖出、相对入场均价上涨 10% 止盈卖出。
7. OKX 合约 BTCUSDT 1m，使用布林带 5,1。价格触及或突破上轨时做空，价格触及或突破下轨时做多；多单在价格回到中轨时平仓，空单在价格回到中轨时平仓；单笔仓位 10%，止损 1%，止盈 1.5%。
8. 用 BTCUSDT 1m K 线。每次最新 K 线收盘价高于开盘价时尝试开多。如果已有持仓则不再开仓。收盘价低于开盘价时平多。
9. OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行“立即停止并撤销所有未成交订单”
10. 在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 79200-80200，采用双向网格，每格间距 0.1%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈
11. 创建一个 OKX BTCUSDT 永续合约策略，使用 15 分钟 K 线。当 EMA7 上穿 EMA21 时开多；当 EMA7 下穿 EMA21 时平多。每次使用账户权益的 10% 开仓，杠杆 1 倍，逐仓不要使用，使用全仓 cross。
12. 15min 布林带下轨买入 上轨卖出
13. EMA7 上穿 EMA21 时开多；下穿 时平多。
14. OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出
15. 15m 周期，价格区间 79200-80200，采用双向网格
16. BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。
17. ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入,ETH 日线在 MA120 下方时平仓
18. BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。
19. BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。
20. ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。
21. SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。
22. BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。
23. ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈。
24. 15min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出 再币安交易所 btcusdt永续合约
25. OKX 合约 BTCUSDT 15m，收到 webhook 事件 signalId 为 whale_buy 且 secret 已配置时开多，每次 100
26. BTC/USDT 4h，RSI 跌破 30 开多，RSI 回到 70 平仓，止损 2%
27. ETH 1h，价格触及布林下轨开多，回到中轨止盈，触及上轨开空
28. SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断
29. BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层
30. ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT

## Acceptance Criteria

- TypeScript cannot construct flat-only `SemanticState`.
- Production code has no old five-bucket semantic state references.
- Production code has no `readFlat*`, `projectToFlat`, or `reprojectFromRules` mainflow dependency.
- Old planner patch fields fail closed at schema gate with explicit errors.
- Old fixtures are not compatibility objects; they are natural-language replay or typed rules corpus only.
- Display, readiness, canonical spec, IR, script, backtest, deploy, and runtime contain no semantic loss after flat deletion.
- Backtest and deploy use the same IR hash.
- Missing parameters are asked during readiness from rule paths, not silently defaulted in spec, IR, or runtime.
- The 30-strategy staging corpus runs from natural language entry through deploy/runtime evidence, or fails closed with a formal unsupported reason.
- PR body lists user validation steps and evidence locations.

## Validation Commands

Minimum local checks:

```bash
dx build quantify --dev
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-planner-schema-reject.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts
```

Add stage 3 source guard tests for removed symbols and run them as part of the focused unit set.

Staging checks must use `.env.staging.local` and produce a report for all 30 strategies.

