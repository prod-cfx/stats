# Account Strategy View E2E

## Scope

This suite validates account strategy list/detail/action endpoints with deterministic seeded data.

## Rules

1. `totalPnl` / `todayPnl` values in API response are treated as backend source of truth.
2. Fallback formulas are verified in front component tests, not here.
3. `todayPnl` day boundary is defined by UTC in front-side fallback logic.

## Seed Protocol

1. Create users: owner + subscriber.
2. Create one strategy template.
3. Create strategy instances `S1..S4` with deterministic names.
4. Create subscription for owner and optional subscriber.
5. Create one user strategy account bound by `(userId, strategyTemplateId)`.
6. Create `strategy_pnl_daily` rows for deterministic detail assertions.

## Cleanup Protocol

1. Delete dependent rows in reverse order:
- `strategyPnlDaily`
- `userStrategyAccount`
- `userStrategySubscription`
- `strategyInstance`
- `strategyTemplate`
- `user`
2. Close app.

