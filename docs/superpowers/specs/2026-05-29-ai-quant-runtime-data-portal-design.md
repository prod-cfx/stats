# AI Quant Runtime Data Portal Design

## Background

Rules-only snapshots now support richer strategy expressions than the old flat five buckets. Backtest and live execution still depend on separate context assembly paths. This creates three failures:

- A normal market binding can be compiled as `scope.dataSource`, causing backtest to fail closed when `ctx.dataSourceFeeds` is absent.
- Multi-timeframe dependencies can be missing from backtest data loading and live signal context.
- Backtest and live can drift because secondary data is not resolved through the same point-in-time rule.

The product contract remains rules-only: published snapshot id and snapshot hash are the truth source for backtest and deploy. The UI should not classify strategies or manually maintain complex dependency controls.

## Goals

- Keep `publishedSnapshotId` and snapshot hash as the strategy truth source.
- Keep `scriptSnapshot` as the execution truth.
- Use snapshot strict params as the only primary market clock truth.
- Support complex strategies, including multi-timeframe, multi-indicator, external datasource, and event/webhook inputs.
- Ensure backtest and live use the same data-context semantics.
- Prevent lookahead bias and offset drift.
- Fail closed with explicit diagnostics when required data is unavailable.

## Non-Goals

- Do not add strategy-type branches such as simple strategy versus complex strategy.
- Do not make frontend backtest parameters describe strategy data dependencies.
- Do not create separate backtest-only and live-only adapters for every rules feature.
- Do not treat exchange, symbol, market type, or timeframe as `scope.dataSource`.

## Truth Sources

Strategy identity truth:

- `publishedSnapshotId`
- snapshot hash / compatible snapshot digests

Execution truth:

- `scriptSnapshot`
- formal snapshots already stored with the published snapshot, used for diagnostics and compatibility checks

Primary market binding truth:

- snapshot strict params: `exchange`, `symbol`, `marketType`, `baseTimeframe`

Backtest run parameters:

- date range
- initial cash
- leverage
- fee
- slippage
- fill price source
- allow partial coverage policy

Frontend must not be the source of truth for `stateTimeframes` or required secondary streams.

## Data Contract

Runtime data is described by data contract, not by strategy class.

`primaryClock`

- The only series that drives strategy evaluation time.
- Derived from snapshot strict params.
- Example: `binance BTCUSDT perp 15m`.

`marketSeries`

- Same exchange/symbol/market type, different timeframe or lookback needs.
- Resolved by point-in-time `asOf(primaryCloseTs)`.
- Example: `1h` and `4h` bars for a `15m` primary clock.

`indicatorSeries`

- Derived from a market series and indicator definition.
- Example: `ema20@15m`, `ema20@1h`, `ema20@4h`.

`externalDataSource`

- Explicit external feed contract with `feedId`, `role`, and `schemaRef`.
- Only this maps to `scope.dataSource`.
- Missing feed or invalid schema must fail closed.

`eventStream`

- Event or webhook input stream.
- Bound by explicit event source contract.
- Resolved through the same runtime context assembler, not through per-strategy live glue.

## Runtime Architecture

`RuntimeDataPlanResolver`

- Input: published snapshot, script snapshot, formal snapshot metadata.
- Output: derived data plan.
- It never overrides snapshot strict params.
- It detects required market series, indicators, external feeds, and event streams.

`RuntimeDataPortal`

- Provides point-in-time access to market bars, indicators, external feeds, and events.
- Main API shape is `asOf(ts)`.
- Enforces closed-bar visibility for higher timeframes.
- Backtest implementation reads historical data.
- Live implementation reads current stored/streamed data, but exposes the same semantics.

`RuntimeContextAssembler`

- Input: data plan, primary timestamp, portal, position/portfolio state.
- Output: one normalized strategy context.
- Backtest runner and live signal generation both call this component.

`BacktestClock`

- Iterates only primary bars from snapshot strict params.
- Calls strategy once per primary bar close.

`LiveClock`

- Runs only when the primary timeframe bar is closed.
- Uses the same context assembly and point-in-time rules as backtest.

## Multi-Timeframe Example

User rule:

> Buy when 15m, 1h, and 4h prices are all above EMA20. Sell when 15m falls below EMA20. Binance BTCUSDT perpetual.

Snapshot strict params:

```ts
{
  exchange: 'binance',
  symbol: 'BTCUSDT',
  marketType: 'perp',
  baseTimeframe: '15m',
}
```

Derived data plan:

```ts
{
  primaryClock: { exchange: 'binance', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
  marketSeries: [
    { timeframe: '15m' },
    { timeframe: '1h' },
    { timeframe: '4h' },
  ],
  indicatorSeries: [
    { indicator: 'ema', period: 20, timeframe: '15m' },
    { indicator: 'ema', period: 20, timeframe: '1h' },
    { indicator: 'ema', period: 20, timeframe: '4h' },
  ],
}
```

Execution rule:

- At each closed `15m` bar, evaluate the strategy.
- `15m` values use the current closed `15m` bar.
- `1h` values use the latest closed `1h` bar with close time `<= 15m.closeTs`.
- `4h` values use the latest closed `4h` bar with close time `<= 15m.closeTs`.
- The strategy cannot see an unfinished `1h` or `4h` bar.

This is not multiple main data streams. It is one primary clock plus secondary point-in-time series.

## `scope.dataSource` Rule

`scope.dataSource` is only for explicit external feeds:

- explicit feed id
- feed role
- schema reference
- runtime feed availability and permission checks

It must not be generated from ordinary exchange/symbol/timeframe context. A normal OHLCV market binding belongs to `primaryClock` or `marketSeries`.

Current failure mode to remove:

- compiler derives `scope.dataSource(primary, ohlcv)` from normal exchange context
- runtime expects `ctx.dataSourceFeeds`
- backtest has no external feed context
- strategy fails closed and emits no signal

## Backtest Behavior

Backtest job creation still accepts existing payloads for compatibility. Backend normalizes snapshot truth before execution:

- `symbols` is overridden by snapshot strict symbol when present.
- `baseTimeframe` is overridden by snapshot strict timeframe when present.
- frontend `stateTimeframes` is treated as compatibility input only.
- derived data plan decides required secondary timeframes and indicators.

Backtest runner flow:

1. Load published snapshot by `publishedSnapshotId`.
2. Verify snapshot hashes and compatibility metadata.
3. Resolve runtime data plan from snapshot/script.
4. Load primary bars and required secondary data for the requested range plus warmup.
5. Iterate primary closed bars.
6. Assemble context through `RuntimeContextAssembler`.
7. Run `scriptSnapshot`.
8. Record diagnostics for data availability, signal firing, and fills.

## Live Behavior

Live signal generation uses the same published snapshot and script snapshot.

Live flow:

1. Load published snapshot by `publishedSnapshotId`.
2. Resolve the same runtime data plan.
3. Wait for primary timeframe close.
4. Resolve secondary series with `asOf(primaryCloseTs)`.
5. Assemble context through `RuntimeContextAssembler`.
6. Run `scriptSnapshot`.

Live must not silently drop secondary timeframes or external feeds. If required data is unavailable, it must fail closed with a structured reason.

## Frontend Contract

The backtest settings UI remains focused on execution assumptions:

- range
- initial cash
- leverage
- slippage
- fee
- price source
- partial coverage policy

Snapshot market binding can be displayed as read-only context:

- exchange
- symbol
- market type
- base timeframe

Frontend should not expose secondary timeframe, indicator, datasource, or event dependency controls for rules-only strategies.

## Diagnostics

Add or reuse structured reasons that separate these cases:

- no compiled rules
- required data unavailable
- required external feed unavailable
- required event source unavailable
- signal not fired in range
- signal fired but not filled

Zero trades caused by missing data must not be reported only as `BACKTEST_NO_SIGNAL_FIRED_IN_RANGE`.

## Testing Strategy

Unit tests:

- ordinary exchange/symbol/timeframe does not generate `scope.dataSource`
- explicit external feed still generates `scope.dataSource`
- data plan derives `15m`, `1h`, and `4h` for the EMA example
- `asOf` never returns unfinished higher-timeframe bars
- context assembler produces the same logical context for backtest and live fixtures

Backtest tests:

- multi-timeframe EMA strategy loads secondary bars and can fire signals
- missing `1h` or `4h` data returns a data requirement diagnostic
- frontend-provided `stateTimeframes` cannot override snapshot-derived requirements

Live tests:

- published snapshot signal generation includes required secondary series
- live context uses only closed higher-timeframe bars
- required datasource or event stream absence fails closed with structured reason

Regression tests:

- rules-only simple single-timeframe strategy still backtests and deploys
- explicit webhook/event strategy keeps event behavior
- external datasource strategy keeps datasource fail-closed behavior

## Rollout

P0 / Phase 1:

- Stop generating `scope.dataSource` from ordinary exchange context.
- Keep explicit external datasource behavior.
- Restore current rules-only backtest signal firing.
- Acceptance test: ordinary rules-only snapshot with normal `exchange/symbol/marketType/baseTimeframe` must backtest without `ctx.dataSourceFeeds`.

P1 / Phase 2:

- Add runtime data plan resolver and point-in-time data portal for backtest.
- Derive secondary market series and indicators from snapshot/script.
- Improve diagnostics for missing data.
- Acceptance test: the 15m/1h/4h EMA20 strategy derives `15m` primary clock plus `1h` and `4h` secondary series, then backtests with closed-bar `asOf(primaryCloseTs)` semantics.

P1 / Phase 3:

- Move live signal context assembly to the same runtime data portal and context assembler.
- Lock backtest/live consistency for multi-timeframe and multi-indicator rules.
- Acceptance test: the same 15m/1h/4h EMA20 published snapshot resolves identical logical data context in live signal generation.

P2 / Phase 4:

- Tighten frontend contract by treating `stateTimeframes` as backend-derived compatibility data.
- Display snapshot primary binding as read-only context if needed.

## Acceptance Criteria

- Backtest and live both load strategy truth by `publishedSnapshotId`.
- Ordinary market binding never becomes `scope.dataSource`.
- The 15m/1h/4h EMA example uses `15m` as the only primary clock.
- Secondary 1h/4h values are resolved by closed-bar `asOf(primaryCloseTs)`.
- Missing required secondary data produces a structured data diagnostic.
- Frontend backtest settings do not become a strategy dependency editor.
- Existing simple rules-only strategies continue to work.
- Explicit external datasource and webhook/event strategies remain fail-closed when their required inputs are unavailable.
