# React Doctor Navbar RightPanel Implementation Plan

**Goal:** Reduce React Doctor state warnings in `Navbar` and `RightPanel` without changing navigation, auth, notification, orderbook, or trade semantics.
**Track:** B
**Issue:** #2575

## Files

- Modify `apps/front/src/components/layout/Navbar.tsx`
- Modify `apps/front/src/components/layout/Navbar.test.tsx`
- Modify `apps/front/src/components/trading/right-panel/RightPanel.tsx`
- Modify `apps/front/src/components/trading/right-panel/right-panel-socket-lifecycle.test.ts`

## Steps

1. Add source-level regression tests that fail on the current render-phase `RightPanel` mock reset and on multi-set route-close behavior in `Navbar`.
2. Refactor `Navbar` interaction booleans and mobile expansion state into a reducer. Keep search query and active index separate because they are search data, not menu visibility state.
3. Replace the copyright-year mount effect with a stable external-store snapshot to avoid mount-time state sync.
4. Refactor `RightPanel` orderbook/trades/last price/ticker/loading state into a reducer and move deterministic mock reset from render into an effect keyed by the mock source.
5. Keep existing display component boundaries: `NavbarDesktopLinks`, `NavbarMobileMenu`, and `RightPanelView` remain pure presentation consumers.

## Verify

- `react-doctor apps/front --full --offline --json --fail-on none` using temporary `react-doctor@0.1.6` install if command is not on `PATH`.
- `dx lint`
- `dx build front --dev`
- `dx test unit front`

## Commit

- Commit title: `refactor(front): reduce navbar right panel doctor state warnings`
- Footer: `Refs: #2575`
