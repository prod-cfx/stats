# React Doctor Split Implementation Plan

**Goal:** Lower React Doctor warnings for `AiQuantStrategyDetail`, `ProfileDataTabs`, and the current TradingView chart wrapper without changing visible behavior.
**Track:** B
**Issue:** #2571

## Files

- Modify `apps/front/src/components/account/AiQuantStrategyDetail.tsx`
- Add focused account detail child components/helpers only if extraction keeps props small.
- Modify `apps/front/src/components/whale-tracking/profile/ProfileDataTabs.tsx`
- Add whale profile child components/helpers only around tab/filter/sort/history state.
- Modify `apps/front/src/components/trading/center-chart-panel/TradingViewChart.tsx`
- Add/modify tests near existing front unit tests if behavior coverage needs adjustment.

Note: `TradingViewLightweightChart.tsx` does not exist in the current tree. The remaining lightweight wrapper target is `apps/front/src/components/trading/center-chart-panel/TradingViewChart.tsx`, whose comments identify the previous Lightweight Charts wrapper boundary.

## Steps

1. Capture React Doctor baseline with `react-doctor apps/front --full --offline --json --fail-on none`. If local executable is missing, use the isolated npm install flow from `ruler/development.md`.
2. `AiQuantStrategyDetail`: move pure header/identifier, metric grid, equity chart, and runtime-control render blocks into local pure components or adjacent files. Keep runtime actions in the container so user-visible behavior and fetch/action flow stay unchanged.
3. `ProfileDataTabs`: replace related tab/sort/filter state setters with one reducer for the same interaction domain. Extract sort/filter helpers with typed accessors and keep data fetch behavior unchanged.
4. `ProfileDataTabs`: extract mobile table/card rendering helpers where props are direct data + callbacks, avoiding new behavior branches.
5. `TradingViewChart`: move interval-resolution mapping to a pure helper and memoize derived props; keep wrapper output identical.
6. Re-run React Doctor and compare warnings for target files. Record remaining warnings and reason.

## Verify

- `react-doctor apps/front --full --offline --json --fail-on none`
- `dx lint`
- `dx build front --dev`
- `dx test unit front`

## Commit

- Commit title: `refactor: split react doctor target components`
- Footer: `Refs: #2571`
