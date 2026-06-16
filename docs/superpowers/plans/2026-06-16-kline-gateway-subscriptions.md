# Kline Gateway Subscription Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `KlineGateway` subscription state and timer ownership into focused services while keeping `/kline` WebSocket protocol compatible.

**Architecture:** Keep `KlineGateway` as the sole Socket.IO namespace/event entrypoint. Move auth, kline subscription registry, trades polling, orderbook polling, and ticker polling/cache ownership into injectable services under `apps/backend/src/modules/kline/services/`; gateway delegates and retains stale-connection inspection through service query methods.

**Tech Stack:** NestJS 11, Socket.IO, Jest unit tests, `dx` commands.

---

## Files

- Modify: `apps/backend/src/modules/kline/kline.gateway.ts` — remove direct timer maps and delegate to services.
- Modify: `apps/backend/src/modules/kline/kline.module.ts` — register new services.
- Modify: `apps/backend/src/modules/kline/kline.gateway.spec.ts` — add characterization tests for guest/auth, limits, unsubscribe, disconnect cleanup, and decorator compatibility.
- Create: `apps/backend/src/modules/kline/services/socket-auth.service.ts` — handshake token extraction/JWT verification/client data initialization.
- Create: `apps/backend/src/modules/kline/services/kline-subscription-registry.service.ts` — kline client subscriptions and callback cleanup.
- Create: `apps/backend/src/modules/kline/services/trades-subscription.service.ts` — trades client registry, timer lifecycle, cache/query/broadcast.
- Create: `apps/backend/src/modules/kline/services/orderbook-subscription.service.ts` — orderbook client registry, timer lifecycle, Redis/aggregated query/broadcast.
- Create: `apps/backend/src/modules/kline/services/ticker-subscription.service.ts` — ticker client registry, timer lifecycle, DB cache, kline price callback cleanup.

## Tasks

### Task 1: Characterization Tests

**Files:**
- Modify: `apps/backend/src/modules/kline/kline.gateway.spec.ts`

- [ ] Add tests that instantiate gateway with mocked service dependencies and assert existing behavior: `@WebSocketGateway({ namespace: '/kline' })`, guest connection marks `client.data.isGuest`, auth connection stores `userId`, kline limit emits `MAX_KLINE_SUBSCRIPTIONS_EXCEEDED`, unsubscribe calls aggregator unsubscribe and emits `unsubscribed`, disconnect cleans trades/orderbook/ticker/kline owned subscriptions.
- [ ] Run `dx test unit backend apps/backend/src/modules/kline/kline.gateway.spec.ts`; expected first run fails after service-boundary assertions are added because gateway still owns maps directly.

### Task 2: Auth + Kline Registry Services

**Files:**
- Create: `apps/backend/src/modules/kline/services/socket-auth.service.ts`
- Create: `apps/backend/src/modules/kline/services/kline-subscription-registry.service.ts`
- Modify: `apps/backend/src/modules/kline/kline.gateway.ts`
- Modify: `apps/backend/src/modules/kline/kline.module.ts`

- [ ] Move handshake auth logic from `handleConnection` into `SocketAuthService.authenticate(client)`.
- [ ] Move `clientSubscriptions` and `clientCallbacks` into `KlineSubscriptionRegistryService` with methods for initializing clients, subscribe, unsubscribe, disconnect cleanup, and count/active query.
- [ ] Update gateway kline subscribe/unsubscribe/disconnect/stale cleanup paths to use service methods.
- [ ] Run focused unit test and make it pass.

### Task 3: Trades Subscription Service

**Files:**
- Create: `apps/backend/src/modules/kline/services/trades-subscription.service.ts`
- Modify: `apps/backend/src/modules/kline/kline.gateway.ts`
- Modify: `apps/backend/src/modules/kline/kline.module.ts`

- [ ] Move `clientTradesSubscriptions`, `tradesIntervals`, trades key generation, broadcast, remove, cleanup into `TradesSubscriptionService`.
- [ ] Keep gateway event names and emitted payloads unchanged.
- [ ] Expose `countForClient(clientId)`, `hasActiveSubscriptions(clientId)`, and `disconnectClient(clientId, server)` for stale cleanup and disconnect.
- [ ] Run focused unit test and make it pass.

### Task 4: Orderbook Subscription Service

**Files:**
- Create: `apps/backend/src/modules/kline/services/orderbook-subscription.service.ts`
- Modify: `apps/backend/src/modules/kline/kline.gateway.ts`
- Modify: `apps/backend/src/modules/kline/kline.module.ts`

- [ ] Move `clientOrderbookSubscriptions`, `orderbookIntervals`, orderbook broadcast, and cleanup into `OrderbookSubscriptionService`.
- [ ] Keep room names, subscription keys, event names, payload shape, cache keys, Redis key derivation, and aggregated-orderbook calls unchanged.
- [ ] Expose client count/active/disconnect query methods.
- [ ] Run focused unit test and make it pass.

### Task 5: Ticker Subscription Service

**Files:**
- Create: `apps/backend/src/modules/kline/services/ticker-subscription.service.ts`
- Modify: `apps/backend/src/modules/kline/kline.gateway.ts`
- Modify: `apps/backend/src/modules/kline/kline.module.ts`

- [ ] Move `clientTickerSubscriptions`, `tickerIntervals`, ticker DB cache, symbol resolution, broadcast, remove, and cleanup into `TickerSubscriptionService`.
- [ ] Keep ticker room names, keys, event names, payload shape, 1m kline callback subscription, and unsubscribe behavior unchanged.
- [ ] Expose client count/active/disconnect query methods.
- [ ] Run focused unit test and make it pass.

### Task 6: Verification + PR

**Files:**
- No additional code files.

- [ ] Run three verification lanes in parallel: `dx lint`, `dx build backend --dev`, `dx test unit backend apps/backend/src/modules/kline`.
- [ ] Fix any failures and rerun all three lanes in parallel until green.
- [ ] Commit with heredoc and `Refs: #2548`.
- [ ] Push branch and create PR body with `Closes: #2548` and `Refs: #2471`.

## Self-Review

- Spec coverage: issue acceptance maps to tasks 1-6; no API/schema changes.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: services expose count/active/disconnect methods consumed by gateway stale cleanup.
