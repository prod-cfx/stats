# Strategy Plaza Official Backtest Completeness Design

## Background

Strategy Plaza official samples must behave like a curated product surface, not a debug view. The current staging page exposes three user-visible problems:

- Strategy cards show a large official backtest explanation block inside every card.
- The official sample backtest report opened from a card is thinner than the AI conversation backtest report and lacks trade details, report interpretation, and risk analysis sections.
- Many cards on later pages display `--` for return, trade count, drawdown, and win rate. Some official samples have zero or missing closed trades.

These states damage trust. A strategy plaza card with empty metrics or zero trades looks broken, even if the strategy definition itself is valid.

The product constraint stays fixed: keep the current 8 categories and 32 strategies. Do not change category names, category assignment, or strategy count.

## Goals

- All 32 Strategy Plaza cards display complete official sample backtest metrics.
- Official sample data remains real backtest evidence, not synthetic card data.
- Card layout becomes compact by removing the inline evidence explanation block.
- Card click opens a full official sample report with the same decision-making density as the AI conversation backtest report.
- Low-sample strategies remain allowed only when clearly marked as lower confidence; they must still have real closed trades and complete metrics.

## Non-Goals

- Do not change the 8 Strategy Plaza categories.
- Do not change the 32 strategy slots.
- Do not convert a strategy into a different strategy type to improve metrics. For example, a trend strategy may tune trend parameters, symbol, window, market type, or timeframe, but it must remain a trend strategy.
- Do not create user-private `btjob-*` records for public official reports.
- Do not use fake users, fake Sharpe values, synthetic card curves, or fabricated trades.

## Core Rules

Each official strategy sample must include:

- `returnPct`
- `winRatePct`
- `maxDrawdownPct`
- `tradeCount`
- `equityCurve`
- `trades`
- `confidence.level`
- `confidence.reasons`
- backtest range, generated time, candle count, and data source metadata

Hard requirements:

- `returnPct`, `winRatePct`, `maxDrawdownPct`, and `tradeCount` must not be null for any live official strategy.
- `tradeCount` must be greater than 0 for every live official strategy.
- Target sample size is at least 20 closed trades.
- If `tradeCount < 20`, confidence must not be `high`, and reasons must explain the low sample size.
- If a generator run cannot produce complete evidence for all 32 strategies, generation fails before the evidence file is updated.

## Official Sample Optimization Policy

When a strategy has too few trades or incomplete metrics, optimize in this order:

1. Keep the same strategy type and original intended symbol over the standard sample window.
2. Expand the sample window, for example from 90 days to 180 or 365 days.
3. Tune parameters while preserving the strategy type.
4. Change the trading symbol to a better fit such as BTC, ETH, SOL, XRP, or another supported liquid symbol.
5. Change timeframe or market type when it remains semantically valid for the strategy.
6. If the sample is still below the 20-trade target but has real closed trades and complete metrics, keep it with lower confidence and explicit reasons.

Examples:

- A breakout strategy may change breakout lookback, volume threshold, symbol, and timeframe, but it must still be a breakout strategy.
- A grid strategy may change grid spacing, range width, symbol, and spot/perp selection when valid, but it must still place range/grid logic.
- A DCA strategy may tune budget cadence, drawdown trigger, symbol, and window, but it must still be DCA.
- A risk-control strategy may use a symbol/window that causes enough risk events, but it must still primarily demonstrate risk-control logic.

## Data Model

Extend official Strategy Plaza evidence with closed trades:

```ts
interface StrategyPlazaOfficialBacktestTrade {
  id: string
  side: 'LONG' | 'SHORT'
  entryTs: number
  entryPrice: number
  exitTs: number
  exitPrice: number
  returnPct: number
  reasonOpen?: string
  reasonClose?: string
  reasonOpenDisplay?: string
  reasonCloseDisplay?: string
}
```

Add `trades: StrategyPlazaOfficialBacktestTrade[]` to `StrategyPlazaOfficialBacktest` in Quantify, backend proxy DTOs, frontend API types, and generated contracts.

Keep backward-compatible field names already consumed by cards:

- `officialBacktest.metrics.returnPct`
- `officialBacktest.metrics.winRatePct`
- `officialBacktest.metrics.maxDrawdownPct`
- `officialBacktest.metrics.tradeCount`
- `officialBacktest.equityCurve`
- `officialBacktest.confidence`

## Generator Behavior

Update `apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts` so the selected candidate persists closed trades into both JSON evidence and TS constant evidence.

Generation must validate all live templates before writing output:

- exactly 32 templates exist in evidence
- all current live official template ids have matching evidence
- every evidence entry has non-null metrics
- every evidence entry has `tradeCount > 0`
- every evidence entry has `trades.length === tradeCount`
- every evidence entry has non-empty equity curve
- every low-sample entry has non-high confidence and reasons

The generator may use a per-template search spec that includes symbol, timeframe, market type, parameter grids, and sample window length. That spec must remain tied to strategy type.

## Quantify And Backend API

Quantify template list/detail endpoints continue to return public official template data. Backend proxy continues to forward the same public data.

DTO updates:

- Add official backtest trade DTO.
- Add `trades` to official backtest response DTO.
- Regenerate TypeScript and Dart contracts.

No authentication is required for official sample report data. The report stays public and does not reuse user-private `btjob-*` records.

## Frontend Card Behavior

Remove the inline official evidence block from every Strategy Plaza card:

- no `details` block
- no card-level disclaimer
- no backtest range/data source/generated time/K-line count inside cards

Cards keep only compact decision metrics:

- return
- trade count
- max drawdown
- win rate
- confidence

Cards remain clickable and navigate to `/{lng}/ai-quant/plaza/{templateId}`. Run and edit buttons keep their current event isolation and must not trigger card navigation.

## Frontend Report Behavior

The official report page should reuse the existing AI backtest report presentation logic where practical. It must render:

- header and official sample badge
- core metrics
- report confidence
- strategy execution fit
- market risk coverage
- equity and drawdown chart
- report interpretation
- max drawdown analysis
- volatility and Sharpe analysis
- trade details table with filters
- evidence metadata and disclaimer

The official report can be built by mapping official evidence into the existing `LiveBacktestReportInput` shape and calling `createBacktestReportDataFromLive`. This keeps calculation rules aligned with AI conversation backtest reports and avoids duplicate report math.

If official evidence is internally inconsistent, the page must show a clear error instead of fabricating fallback report data.

## Confidence Rules

Confidence is computed from real evidence:

- `high`: `tradeCount >= 20`, complete metrics, complete trades, non-empty equity curve, and sample passes official admission gates.
- `medium`: `tradeCount > 0` but below target sample size, or passes basic metrics but has limited representativeness.
- `low`: real closed trades exist but the sample is weak, sparse, or strategy-dependent enough that users should not treat it as robust.

Confidence reasons must mention concrete evidence, such as sample size, drawdown, win rate, market type, or data coverage.

## Error Handling

- Missing official evidence for a live template is a server-side generation/build failure.
- Runtime list/detail endpoints should not emit live templates with incomplete official backtest metrics.
- Frontend should render a load error if a template detail response is missing required official report fields.
- Empty card metrics are not an acceptable fallback state for live official strategies.

## Testing

Quantify tests:

- 8 categories and 32 live strategies are preserved.
- All live templates have official evidence.
- All live templates have non-null official metrics.
- All live templates have `tradeCount > 0` and `trades.length === tradeCount`.
- Low-sample templates cannot be high confidence.
- Generator fails before writing invalid evidence.

Backend tests:

- Proxy list/detail includes `officialBacktest.trades`.
- Contracts build with the new trade DTO.

Frontend tests:

- Strategy cards no longer render the official evidence explanation block.
- Strategy cards for 32 templates show non-empty metrics across pagination pages 1 through 4.
- Official report page renders trade details, report interpretation, max drawdown analysis, volatility/Sharpe analysis, confidence/risk sections, evidence metadata, and disclaimer.
- Run/edit buttons still do not trigger official report navigation.

Verification commands expected for implementation PR:

- `dx lint`
- `dx build affected --dev`
- `dx build contracts`
- focused Quantify Strategy Plaza unit tests
- focused backend Strategy Plaza proxy tests
- focused frontend Strategy Plaza and official report tests

## Rollout Notes

Staging should be checked after deployment using the public page:

- `/zh/ai-quant/plaza`
- pages 1, 2, 3, and 4 all show complete card metrics
- no card contains the inline official evidence block
- a card click opens a report with trade details

If staging still shows `--` metrics after this change, treat it as a deployment artifact or stale bundle/data issue and verify the backend `/api/v1/strategy-plaza/templates` response first.
