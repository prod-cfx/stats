# AI Quant Frontend Semantic Sizing Design

## Background

AI Quant strategy generation already supports semantic position sizing in the backend canonical model:
`RATIO`, `QUOTE`, and `QTY`. The frontend conversation state still treats position sizing as
`positionPct`, so a prompt such as `仓位：1000 USDT` can be stored as `positionPct = 1000` and fail
the frontend request validation with `仓位比例需要在 0 到 100 之间。`

The goal is to make frontend conversation state use semantic sizing as the source of truth while
keeping `positionPct` as a compatibility alias for existing sessions, tests, and display paths.

## Scope

In scope:

- Upgrade AI Quant frontend conversation params to include semantic sizing.
- Preserve compatibility with old `positionPct`-only sessions.
- Update request validation and prompt context construction so fixed quote and quantity sizing do
  not pass through percentage validation.
- Update parameter synchronization and graph display to show `10%`, `1000 USDT`, or `0.01 BTC`
  according to sizing mode.
- Add focused tests for semantic sizing request validation, persistence migration, and display.

Out of scope:

- Removing all `positionPct` fields from account, strategy plaza, or backend API contracts.
- Changing backend canonical sizing semantics.
- Redesigning the AI Quant UI layout.

## Data Model

Add a frontend sizing type:

```ts
type QuantSizing =
  | { mode: 'RATIO'; value: number }
  | { mode: 'QUOTE'; value: number; asset?: 'USDT' | 'USDC' | 'USD' }
  | { mode: 'QTY'; value: number; asset?: string }
```

`ConversationState.params` keeps the existing market fields and adds `sizing`. The default sizing is:

```ts
{ mode: 'RATIO', value: 10 }
```

For frontend compatibility, `RATIO.value` is stored as a percentage display value, so `10` means
`10%`. Backend canonical specs may express ratio sizing as `0.1`; conversion helpers normalize
canonical ratio values into frontend display percentages.

`positionPct` remains on `QuantParams` during the compatibility period. It is derived from
`sizing.mode === 'RATIO'` and must not be populated from `QUOTE` or `QTY` values.

## Normalization Helpers

Introduce small helpers near the AI Quant conversation model:

- `normalizeSizing(value, fallbackPositionPct)` reads semantic sizing from params, param values,
  canonical spec, or old `positionPct`.
- `derivePositionPctFromSizing(sizing)` returns a number only for `RATIO`.
- `formatSizing(sizing, fallbackSymbol)` returns user-facing text such as `10%`, `1000 USDT`, or
  `0.01 BTC`.
- `buildSizingRequestContext(sizing)` returns structured prompt context lines.

These helpers keep sizing parsing and display rules out of request code, graph builders, and
conversation restoration.

## Request Validation

Request validation branches by sizing mode:

- `RATIO`: `value` must be finite, greater than `0`, and at most `100`. Error text remains
  `请求前校验失败：仓位比例需要在 0 到 100 之间。`
- `QUOTE`: `value` must be finite and greater than `0`. Error text is
  `请求前校验失败：固定金额需要大于 0。`
- `QTY`: `value` must be finite and greater than `0`. Error text is
  `请求前校验失败：固定数量需要大于 0。`

This fixes `1000 USDT`: it is validated as a quote amount, not as a percentage.

## Request Context

Preset request context should emit semantic sizing:

```text
sizing.mode=QUOTE
sizing.value=1000
sizing.asset=USDT
```

For `RATIO`, the request may also include the legacy compatibility line:

```text
positionPct=10
```

For `QUOTE` and `QTY`, the request must not include `positionPct`, because that reintroduces the
bug where an amount is interpreted as a percentage.

## Parameter Synchronization

`syncStrategyParamsFromCodegen` should prefer canonical `sizing` and rule action `sizing` over
legacy `riskRules.positionPct`.

Rules:

- `RATIO` becomes `sizing: { mode: 'RATIO', value: percent }` and keeps `positionPct` as a derived
  compatibility value.
- `QUOTE` becomes `sizing: { mode: 'QUOTE', value, asset: 'USDT' }` unless the spec supplies a
  different quote asset.
- `QTY` becomes `sizing: { mode: 'QTY', value, asset }`; if no asset is supplied, infer the base
  asset from the symbol where possible.
- Legacy specs with only `riskRules.positionPct` still produce `RATIO`.

The dynamic param schema should describe the active sizing mode:

- `RATIO`: `Position %`, `minimum: 1`, `maximum: 100`.
- `QUOTE`: `Position Amount`, `minimum: 0`, optional `sizingAsset`.
- `QTY`: `Position Quantity`, `minimum: 0`, optional `sizingAsset`.

## Display And Revision Prompts

Logic graph metadata, display logic graph execute blocks, and strategy revision prompts should use
`formatSizing`.

Expected display:

- `RATIO 10`: `仓位: 10%`
- `QUOTE 1000 USDT`: `仓位: 1000 USDT`
- `QTY 0.01 BTC`: `仓位: 0.01 BTC`

Revision prompts should say `仓位 1000 USDT` for fixed quote sizing, not `仓位 1000%`.

## Persistence And Restoration

Use read-time migration:

- If a persisted conversation has `params.sizing`, normalize and keep it.
- If it only has `params.positionPct`, create `sizing: { mode: 'RATIO', value: positionPct }`.
- If a published snapshot or restored spec contains canonical `QUOTE` or `QTY`, that canonical
  sizing overrides legacy `positionPct`.
- Persist new conversations with `sizing` and retain `positionPct` only as a derived compatibility
  field for old paths.

This avoids a storage version migration while keeping old local conversations usable.

## Error Handling

Invalid or incomplete semantic sizing falls back only when safe:

- Missing sizing in old state falls back to default `RATIO 10`.
- Invalid `RATIO` values surface percentage validation errors.
- Invalid `QUOTE` and `QTY` values surface mode-specific validation errors.
- Unknown sizing modes are treated as invalid configuration and block generation before request
  submission.

## Testing

Add or update focused frontend tests:

- `1000 USDT` or equivalent `QUOTE 1000` request validation passes and does not include
  `positionPct=1000`.
- `RATIO 120` still fails with the existing percentage error.
- Old persisted conversations with `positionPct: 10` restore as `sizing: { mode: 'RATIO', value: 10 }`.
- Canonical/action `sizing: { mode: 'QUOTE', value: 1000 }` syncs into frontend params and displays
  as `1000 USDT`.
- Logic graph and revision prompt render fixed quote sizing without a percent suffix.

## Rollout

Implement as a compatibility upgrade in one frontend-focused change:

1. Add sizing helpers and extend `QuantParams`.
2. Update request validation and preset request context.
3. Update codegen sync, graph fallback metadata, and display formatting.
4. Update persisted conversation restoration.
5. Update tests.

Backend changes are not required for this phase because the backend canonical model already supports
`RATIO`, `QUOTE`, and `QTY`.
