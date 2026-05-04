# Quant Trading Execution Core Design

## Context

Real OKX simulated execution testing exposed that grid, signal, and position-closing flows do not share one execution boundary. Recent fixes improved individual symptoms, but the same class of failures can still reappear through another strategy path:

- grid-generated `clientOrderId` used exchange-incompatible characters;
- grid-planned prices and quantities could persist long decimals when instrument precision was absent from the strategy snapshot;
- perpetual grid initialization could attempt reduce-only close orders without a matching position;
- a single submit failure could move the whole grid runtime into `RECONCILE_REQUIRED`;
- spot grid reconciliation could mismatch local and exchange order representations;
- UI and debugging views could confuse signal strategy execution with grid runtime execution.

The agreed scope is an A+ migration: build a minimal common execution core and route grid runtime, signal executor, and automatic position-closing tools through it. This is still a testing-phase change, but it must protect the six strategy plaza quantitative strategies that already submit orders successfully.

## Goals

- Provide one shared path from strategy order intent to `TradingService.placeOrder()`.
- Fail closed when exchange instrument constraints cannot be resolved.
- Normalize `symbol`, `price`, `quantity`, contract size, and `clientOrderId` before any exchange submission.
- Block reduce-only or close intents unless there is a matching closable position.
- Return structured execution outcomes instead of forcing every caller to interpret exchange exceptions.
- Keep each caller responsible for its own persistence model and business state transitions.
- Preserve the already-working signal strategy behavior through golden regression tests.

## Non-Goals

- Do not rewrite strategy generation, signal generation, funding reservation, or ledger application.
- Do not replace `TradingService` or exchange clients.
- Do not migrate future manual trading UI flows in this change.
- Do not rely on live OKX access for automated verification.

## Architecture

Add a `trading-execution` module between strategy runtimes and `TradingService`:

```text
GridRuntime / SignalExecutor / PositionsTool
  -> TradingExecutionService
  -> TradingService
  -> ExchangeClient
```

The module is intentionally thin. It owns execution admission and normalization, not strategy semantics or database state machines.

### Components

- `OrderIntent`
  - Canonical input for all automatic order execution.
  - Includes source (`grid`, `signal`, `position_tool`), source reference id, exchange account, exchange id, market type, symbol, side, order type, optional price, quantity, intent role, reduce-only flag, and optional caller metadata.

- `ExchangeConstraintsResolver`
  - Resolves instrument constraints for `exchangeId + marketType + symbol + account`.
  - Required fields include tick size, lot size or size precision, minimum quantity when available, contract value for OKX perpetuals, and client order id policy.
  - If required constraints cannot be resolved, returns `waiting_constraints` and does not submit.

- `OrderNormalizer`
  - Normalizes symbol representation.
  - Rounds limit prices to tick size.
  - Floors quantities to lot size and validates minimum quantity.
  - Converts perpetual base quantity to exchange contract size when required by the exchange contract.
  - Generates exchange-compatible client order ids. For OKX this means alphanumeric, case-sensitive, and no longer than 32 characters.

- `OrderAdmissionGate`
  - Validates whether an intent is allowed to submit.
  - `close_long`, `close_short`, and `reduceOnly=true` require a matching position with positive closable size.
  - Insufficient or missing position returns `waiting_position`, not an exchange submit failure.
  - Opening orders do not require a current position, but still require constraints and quantity validation.

- `OrderSubmitter`
  - Calls `TradingService.placeOrder()` only after constraints, normalization, and admission pass.
  - Returns exchange accepted fields so callers can persist accepted price, accepted quantity, exchange order id, client order id, and raw response.

## Data Flow

1. A caller creates an `OrderIntent`.
   - Grid maps `GridOrder` to intent role, side, limit price, quantity, and grid order id.
   - Signal maps the existing `effectiveOrderParams` into an intent without changing signal semantics.
   - Position tools map close requests into reduce-only close intents.

2. `TradingExecutionService.executeIntent()` resolves exchange constraints.
   - Constraints are mandatory.
   - Missing or incomplete constraints produce `waiting_constraints`.

3. The intent is normalized.
   - Planned and submitted parameters use the same constraints.
   - Grid-created or grid-replenished orders persist normalized price and quantity before submission.

4. Admission runs.
   - Reduce-only and close intents check current positions.
   - Missing matching position produces `waiting_position`.

5. The order submits.
   - The submitter calls `TradingService.placeOrder()` with normalized parameters.
   - The result includes submitted and exchange accepted values.

6. The caller persists the result.
   - Grid writes `grid_orders`, `grid_fills`, and `grid_runtime_events`.
   - Signal writes existing execution stages and metadata.
   - Position tools write their current close result state.

## Execution Outcomes

`TradingExecutionService` returns a discriminated result:

- `submitted`
  - Exchange accepted the order.
  - Includes exchange order id, client order id, normalized request, accepted price, accepted quantity, and raw response.

- `waiting_constraints`
  - Required exchange rules are unavailable or incomplete.
  - No exchange order is submitted.

- `waiting_position`
  - The intent requires a closable position, but no matching position or insufficient size is available.
  - No exchange order is submitted.

- `rejected`
  - Parameters are invalid after normalization, for example below minimum quantity or unsupported symbol.
  - No exchange order is submitted.

- `submit_failed`
  - Exchange submission failed after normalization and admission passed.
  - Includes structured error details.

- `reconcile_required`
  - Used only when local state and exchange state cannot be safely matched after an order was believed to have been submitted or filled.

## Caller Behavior

### Grid Runtime

- Initial and replenishment orders both go through `TradingExecutionService`.
- Perpetual close roles are submitted only when admission finds a matching closable position.
- `waiting_position` keeps the order at order-level waiting or planned state and must not permanently stop the whole runtime.
- `submitted` updates local order state using exchange accepted price and quantity.
- Fill sync creates inverse `OrderIntent` values, then routes them through the execution core.
- Reconciliation compares client order id, normalized symbol, normalized market type, and exchange accepted price and quantity.

### Signal Executor

- Only the final order submission hop is migrated.
- The existing signal generation, funding reservation, stage records, final order resolution, and ledger application remain intact.
- Existing `effectiveOrderParams` map one-to-one to `OrderIntent`.
- Existing execution stages remain the public contract. Execution core diagnostics are appended to metadata.
- The six already-working strategy plaza quantitative strategies are protected by golden tests.

### Position Tools

- Close requests become reduce-only close intents.
- No matching position returns `waiting_position` and does not hit the exchange.
- Submitted closes continue through the existing close result handling.

## Protecting Existing Strategies

The six working strategy plaza quantitative strategies must not regress. For each strategy, add a golden test that verifies:

- the signal still reaches the order submission path;
- `symbol`, `marketType`, `side`, `amount`, `price`, `reduceOnly`, and `exchangeAccountId` preserve current semantics;
- execution stage writes remain compatible;
- ledger and reconciliation entry points are unchanged;
- the only allowed differences are execution-core additions such as generated client order id, normalized request payload, and diagnostics metadata.

## UI and Debugging Projection

This design does not rebuild the UI, but it defines a projection requirement:

- signal strategies should be debugged through signal execution records;
- grid strategies should be debugged through grid runtime instances, grid orders, and grid fills;
- both should expose execution-core outcome and diagnostics consistently.

This prevents `signals=0` from being interpreted as “grid did not execute.”

## Test Plan

### Execution Core Unit Tests

- Generates OKX-compatible alphanumeric client order ids within 32 characters.
- Returns `waiting_constraints` and does not call `TradingService.placeOrder()` when required instrument rules are missing.
- Normalizes limit prices by tick size and quantities by lot size.
- Converts OKX perpetual quantity through contract value where required.
- Blocks reduce-only or close intents without a matching position.
- Allows close intents with matching position.
- Returns exchange accepted fields on successful submission.

### Grid Tests

- Perpetual neutral grid does not submit no-position close orders.
- A waiting close order does not force the whole runtime into permanent `RECONCILE_REQUIRED`.
- Filled grid orders write `grid_fills` and create inverse intents.
- Spot grid reconciliation accepts equivalent symbol and market type formatting.
- Planned grid order price and quantity are normalized before persistence and before submission.

### Signal Golden Tests

- The six existing working strategy plaza quantitative strategies keep their order semantics.
- Existing execution stage flow remains compatible.
- Execution-core diagnostics are present without replacing existing execution metadata.

### Position Tool Tests

- Existing position closes submit reduce-only orders when a matching position exists.
- Missing position returns `waiting_position` and does not submit.

### Verification Commands

- `dx test unit quantify` for affected modules, or narrower unit files while iterating.
- `dx lint`
- `dx build affected --dev`
- Quantify E2E only where the local environment can run without live exchange dependency.

## Rollout

1. Add the `trading-execution` module and unit-test it independently.
2. Migrate grid runtime order submission and grid replenishment to `TradingExecutionService`.
3. Migrate signal executor final submit hop while preserving existing stage and ledger flow.
4. Migrate automatic position close submission.
5. Add golden regression tests for the six working strategy plaza strategies.
6. Run focused unit tests, lint, and affected build before PR update.

## Acceptance Criteria

- All automatic quantitative order entries use the execution core before calling `TradingService.placeOrder()`.
- No order submits when exchange constraints are missing.
- No close or reduce-only order submits without a matching closable position.
- OKX client order ids are exchange-compatible for all migrated callers.
- Grid orders persist normalized planned and accepted values.
- Existing signal strategy order semantics are preserved by golden tests.
- Execution outcomes are structured enough to distinguish waiting, rejected, submit failed, and reconcile-required states.
