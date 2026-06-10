# Strategy Plaza Official Backtest Design

## Background

Strategy Plaza currently shows 8 categories and 32 official strategies. This taxonomy and count must remain unchanged. The current card UI mixes real official backtest metrics with frontend-derived display values: return, win rate, and max drawdown come from official evidence, while Sharpe, user count, hot ranking, and sparkline are generated in the frontend.

The target product shape is an official sample backtest plaza. Every strategy remains visible, but every metric shown as performance data must be traceable to official backtest evidence. Lower-quality or lower-sample results are not hidden or cosmetically improved; they are labeled with confidence and explained in the report.

## Goals

- Preserve all 8 categories and all 32 existing official strategies.
- Replace frontend-generated performance-looking data with evidence-backed data.
- Give every strategy a public official backtest report page.
- Show lower-sample or weaker results honestly through confidence labels and explanatory reasons.
- Keep user-owned `btjob-*` reports separate from public official Strategy Plaza reports.

## Non-Goals

- Do not remove, reclassify, or reduce current Strategy Plaza templates.
- Do not create public reports by reusing private user `BacktestJob` records.
- Do not make card clicks create new live backtest jobs.
- Do not optimize strategy prompts manually until each report looks good.
- Do not add fake popularity, fake Sharpe, or synthetic equity curves.

## Product Model

Strategy Plaza becomes a public catalog of official sample backtests. All 32 templates remain listed. Each template has an `officialBacktest` payload derived from generated evidence.

Cards show a compact summary:

- Strategy name, category, symbol, timeframe, market type, position, and leverage.
- Official sample backtest label.
- Return, max drawdown, win rate, and trade count.
- Real official equity sparkline.
- Confidence label: `high`, `medium`, or `low`.

Clicking a card body opens the official report page:

```text
/<lng>/ai-quant/plaza/<templateId>
```

Existing actions remain separate:

- `Run` deploys or resolves the official strategy for the user.
- `Edit` starts an AI Quant edit session.
- A small info affordance shows backtest range, data source, generation time, candle count, and disclaimer without leaving the card.

## Data Model

Add an official backtest payload to Strategy Plaza template responses:

```ts
interface StrategyPlazaOfficialBacktest {
  generatedAt: string
  backtestFrom: number
  backtestTo: number
  source: string
  dataSource: {
    exchange: 'okx' | 'binance'
    marketType: 'spot' | 'swap'
    endpoint: string
    fixedEndTs: number
    pagination: {
      parameter: string
      pageLimit: number
      pageCount: number
    }
  }
  candleCount: number
  metrics: {
    returnPct: number | null
    winRatePct: number | null
    maxDrawdownPct: number | null
    tradeCount: number | null
  }
  equityCurve: Array<{ ts: number; equity: number }>
  confidence: {
    level: 'high' | 'medium' | 'low'
    reasons: string[]
  }
  disclaimer: string
}
```

`displayMetrics` can remain for compatibility, but new UI should prefer `officialBacktest.metrics`. `displayMetrics.tradeCount` should be populated from evidence if it remains exposed.

## Evidence Generation

The existing optimizer already simulates candidates and produces equity curves internally. Evidence generation should persist the selected candidate's downsampled equity curve, trade count, and metadata alongside existing metrics.

Evidence remains a generated artifact, not a user job:

- `apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-backtest-evidence.json`
- `apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-backtest-evidence.constant.ts`

Downsample equity curves to a stable size such as 64 points for card and report use. Preserve enough timestamps to render the report chart and compute drawdown presentation.

## Confidence Rules

All 32 strategies remain visible. Confidence affects labeling and explanation only.

Default rule shape:

- `high`: trade count meets the strategy frequency threshold, return is positive, max drawdown is within the official ceiling, and win rate is at or above the official threshold.
- `medium`: evidence is usable but misses one high-confidence condition, such as lower return, lower win rate, or moderate sample size.
- `low`: sample is clearly limited, return is negative, drawdown is high, or evidence has warnings.

Frequency-aware thresholds should be applied:

- 1m or orderbook-style strategies require more trades.
- 15m and 1h regular strategies use medium trade-count thresholds.
- DCA and risk-control templates can have fewer trades, but should use a longer evidence window and display low-sample explanations when needed.

Confidence reasons must be user-readable and deterministic, for example:

- `样本偏少：本次官方样本回测仅产生 8 笔交易，统计置信度较低。`
- `收益偏弱：本次样本窗口收益为 -0.4%，该模板保留用于展示风控结构。`
- `回撤偏高：最大回撤接近官方阈值，建议结合更长周期观察。`

## Official Report Page

The official report page should reuse the existing backtest report presentation where practical, but it must fetch Strategy Plaza official evidence rather than `BacktestJob` records.

Report content:

- Strategy title and `官方样本回测` badge.
- Core metrics: return, max drawdown, win rate, trade count.
- Equity chart from official evidence.
- Trade list is out of scope for the initial official report unless official evidence already persists trades before implementation starts.
- Backtest context: range, source, generated time, candle count, symbol, timeframe, market type, execution assumptions, and parameters.
- Confidence section with reasons.
- Disclaimer: `历史回测不代表未来收益。该结果基于固定历史窗口和官方参数，不等同于实盘表现。`

Private user reports remain on:

```text
/<lng>/ai-quant/backtest/<btjobId>
```

Those reports continue to require authentication and ownership checks.

## Frontend Behavior

Card changes:

- Card body navigates to `/<lng>/ai-quant/plaza/<templateId>`.
- `Run` and `Edit` buttons stop propagation and keep current behavior.
- Replace fake `users` with real `tradeCount`.
- Remove fake Sharpe from card sorting and stats unless a real Sharpe is computed from evidence.
- Replace generated `buildSeed()` sparkline with `officialBacktest.equityCurve`.
- Default sort stays `displayOrder` to preserve current 8-category/32-strategy arrangement.
- Optional sorts use real metrics only: return, low drawdown, win rate, trade count.

Hover or info disclosure:

- Show backtest range.
- Show data source.
- Show generated time.
- Show candle count.
- Show disclaimer.

Mobile behavior should use click/tap for the info disclosure because hover is unavailable.

## Backend/API Behavior

Quantify Strategy Plaza module should construct official backtest payloads from evidence and expose them through existing public template list/detail endpoints.

Backend proxy should pass through the official backtest payload. Public Strategy Plaza endpoints remain unauthenticated for list/detail/report data. Run and edit-session remain authenticated.

No `BacktestJob` ownership rules are changed. Public official reports do not call `/backtesting/jobs/:id`.

## Error Handling

- If a template lacks official evidence, keep the template visible but mark `confidence.level = 'low'` and include an evidence-missing reason.
- If equity curve is missing, show metrics and report context, but render an unavailable chart state instead of a synthetic curve.
- If metrics are null, show `--` and a low-confidence reason.
- If report detail fetch fails, show a retryable error state without affecting the list page.

## Testing

Backend/Quantify:

- Template service returns 32 live templates across the existing 8 categories.
- Every live template exposes `officialBacktest`.
- Evidence mapping preserves `backtestFrom`, `backtestTo`, `generatedAt`, `source`, `candleCount`, metrics, confidence, and equity curve.
- Confidence rules produce deterministic labels and reasons.
- Public list/detail endpoints expose official backtest data without auth.
- Run/edit-session endpoints remain authenticated.

Frontend:

- Strategy Plaza cards render trade count, real metrics, real sparkline, confidence label, and official sample backtest label.
- Card body navigates to the official report page.
- Run/Edit buttons do not trigger card navigation.
- Info disclosure shows range, data source, generated time, candle count, and disclaimer.
- Default ordering preserves `displayOrder`.
- Fake users, fake Sharpe sorting, and synthetic sparkline behavior are not used.

## Rollout

1. Extend evidence generation and types.
2. Expose `officialBacktest` through Quantify and Backend proxy contracts.
3. Update cards to use official backtest data and navigate to public report pages.
4. Add official report page using Strategy Plaza data.
5. Regenerate contracts if OpenAPI changes.
6. Validate with focused unit tests and affected builds.
