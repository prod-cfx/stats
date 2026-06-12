# Mobile AI Quant Context Consistency Design

## Background

Manual Flutter mobile exploration found that the AI Quant wizard can move through:

```text
确认策略 -> 策略脚本 -> 回测设置 -> 回测结果 -> 部署
```

but visible strategy identity and execution fields drift across steps.

Observed examples:

- Confirm page used an older `ETHUSDT` strategy instead of the user's new EMA20/EMA60/EMA144 OKX request.
- Script page showed `ETHUSDT · 1x` while the prior strategy text mentioned `2倍杠杆`.
- Backtest config page banner showed `BTC 趋势 · 双均线` while the current strategy context was `ETHUSDT`.
- Backtest result page showed `BTC 趋势 · 双均线 · 15m`, `1970-01 -> 1970-01`, and all-zero metrics.
- Deploy page continued showing `BTC 趋势 · 双均线` while the instrument row showed `ETHUSDT · 15m`.

These are mobile data-binding bugs. They are separate from backend generation quality and from the duplicate backtest `409` conflict. The first fix should make one published strategy context drive every downstream step.

## Goal

Make the mobile AI Quant wizard display one consistent strategy identity and execution context from confirm through deploy, using existing backend contract data and existing mobile model scope.

## Non-Goals

- Do not change backend contracts.
- Do not change front behavior.
- Do not redesign the mobile wizard.
- Do not add full front-style graph version reconciliation in this step.
- Do not require deploy to pass when API key or balance checks fail.

## Source of Truth

After codegen reaches `PUBLISHED`, `AiPublishedStrategyContext` becomes the mobile source of truth for downstream pages.

Required downstream fields should come from this context first:

- `publishedSnapshotId`
- `codegenSessionId`
- `conversationId`
- `strategyInstanceId`
- `scriptCode`
- `snapshotParamValues`
- `strategyConfig`
- `backtestConfigDefaults`
- `deploymentExecutionDefaults`
- `deploymentExecutionConstraints`
- `compatibilityMetadata`

Derived display values should use the same priority everywhere:

1. Published snapshot strategy config.
2. Published snapshot param values.
3. Backtest or deployment defaults from the published snapshot.
4. Existing route params only as compatibility fallback.
5. Local mock/default labels only when no published context exists.

## Design

### Shared Resolver

Add a small mobile resolver for published strategy display and execution context. It should accept `AiPublishedStrategyContext` plus optional route params and return a normalized view model:

- title or display name
- exchange
- symbol
- base timeframe
- market type
- leverage
- sizing or position display
- published snapshot id
- script availability

Each wizard page should consume this resolver instead of independently rebuilding labels.

### Confirm Page

Confirm page can still render draft logic before publication, but when a published session exists it must pass `AiPublishedStrategyContext.fromCodegen(result)` forward without losing fields.

The previous published-session reuse design remains in force: `PUBLISHED + publishedSnapshotId` should skip repeat `confirmStrategy` unless metadata requires republish.

### Script Page

Script page header should use the resolver. It must not show default `1x` when published deployment or backtest defaults contain another leverage value. If leverage is absent, show no leverage rather than an invented value.

### Backtest Config Page

Backtest config banner should use the same symbol/title/timeframe from the resolver. It must not fall back to `BTC 趋势 · 双均线` when a published context exists.

Backtest request body should continue using the existing real backend payload. This design only fixes field selection and display consistency unless a mapping bug is directly causing request corruption.

### Backtest Result Page

Backtest result page should use backend job timestamps and summary fields. It must not render Unix epoch defaults as `1970-01 -> 1970-01`. If timestamps are missing, show a neutral missing-date display instead of epoch dates.

The result title and instrument metadata should come from the resolver or from the submitted backtest request context, not from static BTC fallback labels.

### Deploy Page

Deploy page should use the same resolver. Deployment precheck failures remain valid and visible:

- API key not bound
- insufficient balance
- exchange/network latency issue

The deploy CTA can remain disabled when checks fail. The key requirement is that the strategy identity and deployment parameters match the published context.

## Error Handling

- Missing `publishedSnapshotId`: block downstream actions with the existing local error.
- Missing optional display fields: omit the field or show a neutral `--`; do not inject BTC/mock strategy labels.
- Missing timestamps in backtest result: show `--` or configured range, never `1970-01`.
- Duplicate backtest `409`: keep the friendly conflict message from the published-session reuse design.

## Testing

Add focused tests around resolver and affected pages:

- Resolver prefers published strategy config over route fallback.
- Script page shows published symbol/timeframe/leverage consistently.
- Backtest config page banner uses published context and does not show BTC fallback.
- Backtest result page does not render epoch dates when timestamps are missing.
- Deploy sheet/page uses published exchange, symbol, timeframe, market type, and leverage.

Run focused mobile verification:

```bash
flutter analyze --no-pub
flutter test --no-pub --reporter expanded test/data/api_backtest_repository_test.dart test/pages/ai_confirm_page_test.dart test/pages/ai_script_page_test.dart test/widgets/qz_deploy_sheet_test.dart
```

## Acceptance Criteria

- One published strategy context drives script, backtest config, backtest result, and deploy pages.
- Published `ETHUSDT` context never displays `BTC 趋势 · 双均线` fallback in downstream steps.
- Missing result timestamps do not display `1970-01`.
- Deploy precheck failures remain visible and do not block data consistency fixes.

Refs: #2427
