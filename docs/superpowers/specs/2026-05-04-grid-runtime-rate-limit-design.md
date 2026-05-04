# Grid Runtime OKX Rate Limit Recovery Design

## Context

OKX grid runtime deployment can create many planned orders for a single strategy instance. A 33-level neutral perpetual grid may submit many orders in one sync cycle. The current path has two pressure points:

- `GridRuntimeService.createFromDeployment()` fetches instrument constraints once while building the initial plan.
- `TradingExecutionService.prepareIntent()` fetches instrument constraints again for every planned order submitted by `GridOrderSyncService`.

When OKX returns `50011 Too Many Requests`, the current grid order submission path treats the failure like a hard submission failure and marks the runtime `RECONCILE_REQUIRED`. That is too severe for a clearly transient rate-limit response. It leaves already-submitted orders live on OKX, leaves later local orders in `PLANNED`, and prevents the normal resume button from continuing.

Recent related history includes OKX perpetual position-side fixes and grid order cleanup fixes, so this design keeps the change tightly scoped to the grid submission pressure and transient failure handling.

## Goal

Implement the first phase of a safer grid runtime recovery path:

- Reuse instrument constraints within one grid order submission cycle.
- Submit only a small bounded number of planned grid orders per sync cycle.
- Treat OKX rate limits as retryable, not as immediate `RECONCILE_REQUIRED`.
- Preserve current behavior for non-grid execution paths and deterministic failures.
- Leave clear extension points for later full backoff and reconcile-and-resume work.

## Non-Goals

This phase does not implement a full reconcile-and-resume workflow. It does not change Prisma runtime status enums, does not change the public `resume()` semantics, and does not add a persistent retry schedule. It also does not change signal execution or position-tool execution behavior except through backward-compatible optional API shape.

## Recommended Approach

Use a staged fix.

Phase 1, this work:

- Add an optional preloaded constraints parameter to `TradingExecutionService.prepareIntent()`.
- In `GridOrderSyncService`, fetch constraints once per sync submission cycle and pass them into every planned order preparation.
- Add a conservative per-cycle submission limit for grid planned orders.
- Detect retryable rate-limit failures and keep the runtime `RUNNING`.

Future phase:

- Extract a `GridOrderSubmissionPolicy` or equivalent service.
- Add persistent backoff timing and exchange-specific quota tuning.
- Add true reconcile-and-resume by fetching open and closed exchange orders, updating local order state, and only then moving the runtime back to `RUNNING`.

This avoids a large state-machine change while fixing the immediate failure mode.

## Components

### TradingExecutionService

`prepareIntent(intent)` remains backward compatible. Existing callers that do not pass options continue to fetch constraints internally.

The method gains an optional shape similar to:

```ts
prepareIntent(intent: OrderIntent, options?: { constraints?: TradingExecutionConstraints })
```

If `options.constraints` is present, `prepareIntent` uses it directly for client order ID generation and normalization. It still runs the current admission gate, client order ID factory, and order normalizer. It does not bypass existing validation.

This keeps signal and position-tool paths unchanged while allowing grid submission to avoid repeated exchange metadata calls.

### GridOrderSyncService

Grid submission becomes a bounded cycle:

1. Filter local orders to `PLANNED`.
2. Apply a per-cycle submission limit.
3. Load instrument constraints once for the instance.
4. For each selected planned order, build the existing order intent.
5. Prepare the intent with the preloaded constraints.
6. Mark the order `SUBMITTING`, submit it, and mark it `OPEN` using the existing state chain.
7. Stop the cycle on retryable rate-limit failure and leave remaining orders for the next sync.

The first implementation can keep the policy local to `GridOrderSyncService` as private methods and constants. A later phase can extract it when persistent backoff and per-exchange policy become real needs.

## Error Handling

Errors are split into retryable transient failures and deterministic failures.

Retryable rate-limit failures include:

- `RateLimitError`
- OKX error code `50011`
- Messages containing `Too Many Requests`
- Messages containing `rate limit`

When a retryable rate-limit happens:

- If the order was marked `SUBMITTING` but no exchange order was accepted, move it back to `PLANNED`.
- Keep the runtime status unchanged, normally `RUNNING`.
- Record a warn event such as `runtime_rate_limited`.
- Include payload fields such as `orderId`, `clientOrderId`, `exchangeId`, `marketType`, `symbol`, and `reason`.
- Stop submitting more orders in the current cycle.

Deterministic or consistency-risk failures keep the current conservative behavior and mark `RECONCILE_REQUIRED`. Examples include parameter errors, exchange mismatch, local state races after a successful exchange submit, failed cancel after a submit race, stop or boundary cancel failures, and fill ledger mirror failures.

## State Semantics

`RECONCILE_REQUIRED` remains reserved for possible local-versus-exchange divergence or situations that require explicit reconciliation.

OKX `50011 Too Many Requests` before order acceptance is not treated as divergence. It is a temporary inability to submit more orders. The runtime stays `RUNNING`, already-open orders stay open, and planned orders remain available for later sync cycles.

`resume()` remains `PAUSED -> RUNNING` only. This design does not allow the ordinary resume button to bypass reconciliation. A future full fix should add a separate reconcile-and-resume flow.

## Backward Compatibility

This design protects existing execution paths in five ways:

- `TradingExecutionService.prepareIntent()` only gains optional input; old callers keep the same behavior.
- The preloaded constraints path still uses the same admission gate, client order ID factory, and normalizer.
- Grid-specific reuse happens only in `GridOrderSyncService`.
- Rate-limit special handling is narrowly matched to explicit transient errors.
- Non-rate-limit submission failures continue to mark `RECONCILE_REQUIRED`.

## Testing

Add or update focused tests.

`TradingExecutionService` tests:

- Without preloaded constraints, `prepareIntent()` still calls `tradingService.getInstrumentConstraints`.
- With preloaded constraints, `prepareIntent()` does not call `tradingService.getInstrumentConstraints`.
- The prepared result still contains normalized order data and generated client order ID.

`GridOrderSyncService` tests:

- A sync cycle fetches constraints once and reuses them for multiple planned orders.
- A sync cycle submits no more than the configured per-cycle limit.
- OKX `50011 Too Many Requests` restores the current order to `PLANNED`, does not mark runtime `RECONCILE_REQUIRED`, records a rate-limit event, and leaves later planned orders untouched.
- A non-rate-limit submit failure still marks `RECONCILE_REQUIRED`.
- Existing successful spot and perpetual grid submission cases still pass.

Verification commands should use the repository `dx` entrypoint from the repo root. Prefer the narrow quantify unit specs for `trading-execution` and `grid-runtime`; run `dx build quantify --dev` if the touched surface or test runner support makes that appropriate.

## Acceptance Criteria

- A 33-level OKX neutral grid no longer repeatedly fetches instrument constraints for every planned order in one sync cycle.
- A single sync cycle submits only a bounded number of planned orders.
- OKX `50011 Too Many Requests` does not push the runtime into `RECONCILE_REQUIRED` when no exchange order was accepted.
- Remaining planned orders can continue on later sync cycles.
- Existing non-grid execution paths remain compatible.
- Deterministic failures and possible state divergence still require reconciliation.

## Follow-Up Work

After this phase, implement a full grid recovery loop:

- Persistent exchange-aware backoff.
- Centralized submission policy service.
- Reconcile endpoint behavior that fetches open and closed exchange orders, maps them to local orders by client order ID and exchange order ID, updates local statuses, records fills when safe, and then resumes only after local and exchange state agree.
