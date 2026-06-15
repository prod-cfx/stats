# TradingView Charting Library Vendor Boundary

`charting_library/` contains TradingView Charting Library vendor files. These files are closed-source, prebuilt distribution artifacts copied into `apps/front/public/tradingview/charting_library` and served as static assets by the front app.

Current vendored package metadata is recorded in `charting_library/package.json`:

- Package description: `CL v30.2.0 (internal id 889635ab5e3bd31aa685c07ac870cfe4d0f7caca @ 2025-12-22T14:43:22.549Z)`
- Entrypoint loaded by app code: `/tradingview/charting_library/charting_library.js`
- Library path passed to TradingView widget: `/tradingview/charting_library/`

## Update Process

1. Obtain a licensed TradingView Charting Library distribution from the project-approved TradingView source.
2. Replace the full `apps/front/public/tradingview/charting_library/` directory as a single vendor bundle. Do not hand-edit minified bundle files.
3. Confirm `charting_library/package.json` records the new package description/version metadata.
4. Run the front app smoke path that loads `TradingViewChart` and confirm `window.TradingView.widget` initializes from `/tradingview/charting_library/charting_library.js`.
5. Run `dx lint`, `dx build front --dev`, and the React Doctor command documented in issue #2468.

## React Doctor Boundary

React Doctor excludes `apps/front/public/tradingview/charting_library/**` through `doctor.config.json` at the repo root and `apps/front/doctor.config.json`. The exclusion is intentional because `charting_library/**` is a third-party vendor bundle, not source maintained by this repository.

React Doctor warnings such as `insecure-crypto-risk`, `postmessage-origin-risk`, and `dangerous-html-sink` inside this directory must be tracked as vendor acceptance and upgrade risk. They must not be treated as patched by local source edits unless the vendored TradingView package itself is replaced by an updated licensed distribution.

## Audited App Boundary

Owned integration code remains in scope for React Doctor, lint, code review, and security review:

- `apps/front/src/components/tradingview/TradingViewChart.tsx`
- `apps/front/src/components/tradingview/mock-datafeed.ts`
- `apps/front/src/components/tradingview/trading-view-chart.helpers.ts`
- TradingView consumers under `apps/front/src/components/trading/`

Owned code is responsible for loading the static script, passing fixed `SCRIPT_SRC` and `LIBRARY_PATH` values, configuring `TradingView.widget`, and building any surrounding DOM controls. Do not pass user-controlled HTML into TradingView or into local DOM sinks. Use `textContent` for labels and clear only owned containers when resetting widget state.
