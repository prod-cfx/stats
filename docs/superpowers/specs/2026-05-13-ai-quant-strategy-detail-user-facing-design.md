# AI Quant Strategy Detail User-Facing Design

Date: 2026-05-13

## Goal

Redesign the AI Quant strategy detail page as a user-facing decision page, not an internal troubleshooting dashboard.

The first screen should help a user answer four questions quickly:

1. Is this strategy healthy right now?
2. Is it making or losing money?
3. Does it currently have position or order risk?
4. What happened most recently?

Developer and audit information remains available, but it must be visually secondary and grouped under advanced tabs.

## Market References

TradingView Strategy Tester separates information into clear layers:

- Overview: strategy chart, Total P&L, max drawdown, total trades, profitable trades, profit factor, buy-and-hold comparison, trade run-up/drawdown.
- Performance: deeper statistics for all/long/short trades.
- List of Trades: chronological trade details.
- Properties: configuration, symbol info, strategy inputs, and strategy properties.

Source: https://www.tradingview.com/support/solutions/43000764138-tradingview-strategy-report-how-to-start/

TradingView Pine strategy docs reinforce the same structure: Overview, Performance Summary, List of Trades, and Properties, with configuration moved into Properties rather than mixed into the overview.

Source: https://www.tradingview.com/pine-script-docs/concepts/strategies/

OKX Spot Grid Bot documentation emphasizes Total PnL as the key metric for bot performance, while more granular profit explanations are treated as supporting detail. This supports keeping first-screen performance simple and avoiding overly technical profit decomposition.

Source: https://www.okx.com/en-us/help/spot-grid-bot-faq

## Design Principle

Use a three-layer hierarchy:

1. **User decision layer**: status, PnL, risk, recent activity, and actions.
2. **Explainability layer**: readable rules, configuration, backtest summary, and timeline.
3. **Diagnostics layer**: IDs, snapshot hashes, evidence, runtime execution states, failure reasons, and compatibility metadata.

The page should not make internal diagnostic data look equally important to user-facing trading status.

## Page Structure

### 1. Top Navigation

Show a single back button above the detail card.

Do not mix the back button with strategy status chips or page metrics.

### 2. Status Hero

Left side:

- Status chip: running, stopped, or draft.
- Exchange, symbol, and timeframe chips.
- Strategy name.
- One short user-readable status explanation.
- Small, low-emphasis debug metadata:
  - Strategy instance ID.
  - Published snapshot ID.

Right side:

- Next expected action card.
- The card should describe what the user should expect or check next.
- It should not show failure stacks, raw execution keys, or snapshot IDs.

### 3. Core Metrics

Keep exactly four primary metric cards:

- Total PnL, with return percentage as supporting text.
- Today PnL.
- Max drawdown.
- Win rate.

Trade count may appear as supporting text, but it should not become a fifth top-level metric.

Do not show initial cash, price source, backtest leverage, or long/short breakdowns in the primary metric row.

### 4. Main Content

Order the main content for user judgment:

1. Equity curve.
2. Current position and risk.
3. Latest trades.

The equity curve should show useful event markers such as entry, exit, and current point when data exists. It should avoid dense debug labels.

Current position and risk should show:

- Current position or holding quantity.
- Unrealized PnL.
- Realized PnL.
- Open order count.
- Clear risk hint if stopping requires attention.

Latest trades should show up to five recent rows:

- Time.
- Side.
- Semantic action.
- Symbol.
- Price.
- Quantity and notional value.
- Fee.

Complete trade history is outside this redesign. The detail page should show only the latest rows.

### 5. Right Sticky Rail

The right rail is for status, control, and summary only.

Show:

- Runtime control:
  - Start/stop actions.
  - Return to conversation.
  - Runtime feedback.
- Account risk summary:
  - Total equity.
  - Available balance.
  - Current holding or open position count.
  - Today PnL.
  - Current leverage and allowed range when relevant.
- Runtime health summary:
  - Online/offline.
  - Configuration consistent / needs attention.
  - Sync status in user-readable language.
- Backtest summary:
  - Return percentage.
  - Max drawdown.
  - Win rate.
  - Initial cash and backtest leverage only as compact supporting rows.

Do not show published snapshot ID, price source, snapshot hash, runtime failure family, or raw execution status cards in the right rail.

### 6. Advanced Tabs

Use tabs after the main decision content.

Tabs:

- Rules.
- Configuration.
- Backtest.
- Running record.
- Diagnostics.

Default selected tab: Rules.

#### Rules Tab

Show:

- User-readable strategy rule summary.
- Parameter summary if it helps explain the rule.

Do not show raw schema field names unless there is no readable label.

#### Configuration Tab

Show:

- Parameter snapshot.
- Deployment account.
- Deployment time.
- Market type.
- Price source.
- Leverage configuration.
- Initial cash.

This information is useful but not part of the first-screen user decision.

#### Backtest Tab

Show:

- Backtest metrics.
- Backtest configuration.
- Future extension area for trade analysis.

#### Running Record Tab

Show:

- Timeline events in user-readable language.
- Start, stop, deploy, signal executed, and subscription events.

Keep the timeline compact by default.

#### Diagnostics Tab

Show:

- Strategy instance ID.
- Published snapshot ID.
- Snapshot hash.
- Entry, exit, and sync evidence.
- Runtime execution states.
- Failure family and failure reason.
- Last attempt time.
- Consumed time.
- Cooldown time.
- Compatibility metadata.
- Data boundary text.

This tab is for support, QA, and bug investigation. It should be available but not visually prominent.

## Content To Remove Or Move From First Screen

Move out of the first screen:

- Snapshot hash.
- Entry, exit, and sync evidence.
- Runtime execution state rows.
- Failure family.
- Failure reason.
- Last attempt time.
- Consumed time.
- Cooldown time.
- Raw execution semantic key.
- Compatibility metadata details.
- Data boundary text.
- Parameter schema details.
- Deployment account and deployment time.
- Backtest default configuration cards.

Merge or remove:

- Duplicate account overview and position overview sections. Keep one user-facing "Current position and risk" section.
- Standalone current status explanation card if it duplicates the hero explanation.
- Hidden legacy sections that remain in the main structure. Content should move into the correct tab instead of being hidden in place.

## Mobile Behavior

Mobile order:

1. Back button.
2. Status Hero.
3. Core metrics.
4. Equity curve.
5. Current position and risk.
6. Latest trades.
7. Summary cards.
8. Advanced tabs.

Runtime actions should stay in a fixed bottom action bar when available.

The bottom action bar must not cover scroll content. The main page needs enough bottom padding.

## Error And Empty States

If equity data is missing, show a clear empty state instead of an empty chart.

If there are no recent trades, show a user-readable message.

If runtime health is unknown, show "needs confirmation" or equivalent user-facing copy rather than raw null/unknown values.

If stopping has risk because of open positions or open orders, show the risk in the runtime control area and confirmation dialog.

## Testing Expectations

Unit tests should cover:

- First screen renders status, four core metrics, position/risk, latest trades, and runtime controls.
- Diagnostics fields are available only in the Diagnostics tab or low-emphasis debug metadata.
- Stopped/running/draft status chips remain readable in light and dark modes.
- Runtime control actions remain hidden for view-only strategies.
- Mobile fixed action bar renders only for actionable strategies.

Manual UI checks should cover:

- Light mode contrast for status chips and metadata.
- Dark mode contrast for the same elements.
- Desktop layout at wide width.
- Small mobile width around 375px.
- Long strategy names and long IDs.

## Non-Goals

This design does not add new backend data.

This design does not implement complete trade history export.

This design does not change runtime action behavior.

This design does not change the strategy state machine or duplicate-strategy detection rules.
