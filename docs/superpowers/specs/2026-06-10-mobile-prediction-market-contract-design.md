# Mobile Prediction Market Contract Design

## Background

`apps/front` renders `/zh/prediction-market` from backend contract endpoint `GET /polymarket/markets` through `client.PolymarketController_listMarkets`. It requests `page=1`, `limit=48`, `onlyActive=true`, and locale from the active language. The page maps each `PredictionMarketCardDto` into cards and a detail modal with title, outcomes or probability, status, `volume24h`, rules, and rule creation time.

`apps/quantify-mobile` already has a compact prediction market screen under the bottom navigation "数据" tab. It shows a two-column card grid, search overlay, and bottom-sheet detail page. The mobile repository currently calls the same endpoint with raw Dio and manually decodes the generated DTO. This bypasses the generated Dart API method exposed by `packages/api-contracts-dart`.

The mobile surface cannot carry every front field on cards without crowding. The useful gap is in detail view: the contract already exposes `volumeTotal` and `openInterest`, but mobile does not model or display them.

## Goals

- Use the generated Dart contract client for prediction market API access.
- Keep the mobile card layout compact and stable.
- Add `volumeTotal` and `openInterest` to the mobile detail sheet.
- Do not modify backend behavior or the TypeScript/front contract.
- Preserve current search, locale, empty-state, and card tap behavior.

## Non-Goals

- No backend endpoint changes.
- No front UI changes.
- No pagination or infinite scroll in mobile.
- No trading, order entry, or external Polymarket deep links.
- No card-level density increase beyond current `volume24h` display.

## Recommended Approach

Use generated Dart `PolymarketApi.polymarketControllerListMarkets` in `ApiPredMarketRepository`, while keeping mobile-specific mapping in the repository. The repository remains the boundary between generated backend DTOs and app-native `PredMarket` view models.

This is the smallest change that fixes the real contract issue without making UI or backend behavior depend on front internals. It also keeps special cases out of widgets: widgets consume one stable mobile model, and generated DTO quirks stay in data mapping.

## Data Flow

1. `PredMarketBody` derives locale from `Localizations.localeOf(context)`: `zh` for Chinese, otherwise `en`.
2. `predMarketsByLocaleProvider(locale)` calls `PredMarketRepository.listPredMarkets(locale: locale)`.
3. `ApiPredMarketRepository` calls:
   - `page: 1`
   - `limit: 48`
   - `onlyActive: true`
   - `locale: zh/en`
4. Generated client returns `BuiltList<PredictionMarketCardDto>`.
5. Repository maps DTO fields into `PredMarket`:
   - `id` -> `id`
   - `title` -> `question`
   - `options` or top-level `probability` -> `yesPercent`
   - `volume24h` -> `volume`
   - `volumeTotal` -> `volumeTotal`
   - `openInterest` -> `openInterest`
   - `status` -> `live`
   - `rules.paragraphs` -> `rules`
   - `rules.createdAt` -> `created`

If the backend response envelope remains `{ data, message }`, the call will use the existing mobile Dio `unwrapData` response interceptor via request `extra` so generated deserialization receives the array declared by OpenAPI.

## Model Changes

`PredMarket` gains two fields:

- `volumeTotal: double`
- `openInterest: double`

Both default to `0` to keep existing fixtures and tests easy to maintain. Existing `volume` continues to mean 24h volume and remains the only card-level volume value.

## UI Design

Cards stay unchanged:

- icon badge
- question
- Yes/No probability where available
- LIVE state
- 24h volume

Detail sheet gets a compact metric section after the heading and before rules:

- `24h Vol`: existing `volume`
- `Total Vol`: new `volumeTotal`
- `Open Interest`: new `openInterest`

Missing or unparsable numeric fields render as stable empty values. Currency-style values use the existing prediction volume formatter where possible, with detail labels omitting the trailing `Vol.` suffix for readability.

## Error Handling

Network and serialization failures continue through the current provider error path. This design does not add mock fallback or swallow errors. Missing optional fields map to `0` or empty lists so a single incomplete market card does not crash the page.

## Compatibility

Backend API remains unchanged. Front continues using the same `PolymarketController_listMarkets` operation and response DTO. Mobile switches from a raw path call to the generated Dart method, so future OpenAPI contract changes are more likely to fail at compile/test time instead of drifting silently.

## Testing

- Update `api_pred_market_repository_test.dart` to assert generated `PolymarketApi` call parameters, `unwrapData` usage, and mapping for `volumeTotal` / `openInterest`.
- Keep existing probability mapping tests for Yes/No and top-level `probability`.
- Update prediction market widget tests to verify detail sheet displays `24h Vol`, `Total Vol`, and `Open Interest`.
- Run focused mobile tests for repository and prediction market page before broader checks.

## Implementation Notes

- Before code changes, update the worktree to latest `origin/main` as requested.
- Keep generated contract files untouched unless contract generation is explicitly needed; current required types and API method already exist in `packages/api-contracts-dart`.
- Keep UI changes scoped to `apps/quantify-mobile/lib/pages/market/widgets/pred_market_detail_sheet.dart` and data/model changes scoped to prediction-market files.

