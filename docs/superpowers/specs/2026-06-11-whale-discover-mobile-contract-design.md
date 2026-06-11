# Mobile Whale Discover Contract Design

## Context

`apps/quantify-mobile` has a bottom navigation item named `巨鲸`. Its `发现` tab should consume the same backend discover contract used by `apps/front` at `/zh/whale-tracking/discover`, but mobile has a smaller presentation surface than front.

The backend contract already exists in `packages/api-contracts-dart`:

- `WhaleTrackingApi.whaleTrackingControllerGetDiscover`
- `WhaleDiscoverResponseDto`
- `WhaleDiscoverTraderDto`

This work does not change backend APIs, OpenAPI generation, or `apps/front` behavior.

## Goals

- Use the generated Dart backend contract for the mobile whale discover page.
- Keep mobile focused on its current UI scope: top recommendations, sort bar, list cards, AI tags, and the trading stats entry point.
- Show card addresses in the mobile-designed abbreviated form: `0x1234...abcd`.
- Preserve full backend addresses for copy, profile navigation, and trading stats API calls.
- Treat real empty API responses as empty UI data, not as a reason to fall back to mock fixtures.

## Non-Goals

- Do not add front-only discover data to mobile unless current mobile UI already needs it.
- Do not change backend discover response shape.
- Do not modify `packages/api-contracts-dart` generated files by hand.
- Do not introduce raw HTTP calls for this discover flow.

## Architecture

Keep the existing mobile data flow:

```text
WhaleDiscoverTab
  -> whaleLeaderboardProvider
  -> WhaleLeaderboardRepository
  -> ApiWhaleLeaderboardRepository
  -> GeneratedBackendApi
  -> packages/api-contracts-dart WhaleTrackingApi
```

`ApiWhaleLeaderboardRepository` remains the only production mapper from the generated DTOs into mobile domain models. Widgets consume domain models only.

## Domain Model

`WhaleLeaderEntry.id` is the full chain address returned by the backend. It is used for behavior:

- copy address
- profile route `/whale/profile/:address`
- `/whale-tracking/traders/{address}/performance`

Add `WhaleLeaderEntry.displayAddress` for UI text only. It uses the mobile mock/design style:

```text
0x1234...abcd
```

Use ASCII three-dot `...`, not the Unicode ellipsis, because current mobile whale leader fixtures use `0x8ba1...ba72` style.

## Data Mapping

Map `/whale-tracking/discover` as follows:

- `recommended` and `details` become one `List<WhaleLeaderEntry>`.
- `variant == recommended` entries keep `avatarText`, `avatarBgHex`, and `tier`, so `topWhaleLeaders` can keep driving the top slideshow.
- `variant == detail` entries leave top-card-only fields null.
- `address` maps to `id` unchanged.
- `displayAddress` derives from `address`.
- `totalValueUsd` maps to `aumValue` and compact USD `aumDisplay`.
- `pnlUsd` maps to `pnlValue`, `pnlPositive`, and signed compact USD `pnlDisplay`.
- `trades` and `positions` default to `0` when absent.
- `winRatePct` maps to `winRate`.
- `aiTags` map to the existing Chinese chip labels; unknown values fall back to the generated enum name.
- `avatarColor` keeps existing parsing for recommended-card tint.

No additional front-only fields are introduced in mobile.

## UI Behavior

`WhaleAddressLink` should render the display address but keep behavior callbacks owned by the parent card. The parent continues to call copy, profile navigation, and stats with the full `entry.id`.

Affected widgets:

- `WhaleLeaderCard`
- `WhaleTopCard`
- `WhaleAddressLink`

Expected behavior:

- Card address text shows `entry.displayAddress`.
- Copy copies `entry.id`.
- Profile navigation pushes `entry.id`.
- Trading stats opens with `entry.id`.

## Error And Empty States

- Loading, error, and empty states keep current `WhaleDiscoverTab` behavior.
- Empty backend arrays render no cards and do not fall back to fixtures.
- Network and serialization errors surface through `AsyncValue.error` and show `whaleLoadError`.

## Testing

Add or update focused tests:

- Repository mapping test asserts `id` is the full backend address and `displayAddress` is the mobile abbreviation.
- Empty discover response test continues to assert no mock fallback.
- Widget or focused unit test asserts address UI renders `displayAddress` while callbacks use full `id`.
- Existing trading stats mapping tests continue to cover `/whale-tracking/traders/{address}/performance`.

## Verification

Run focused mobile tests first:

```bash
cd apps/quantify-mobile
flutter test test/data/api_whale_real_empty_repository_test.dart
```

Then run broader repo checks required by the project workflow from the repository root:

```bash
dx lint
dx build quantify-mobile --dev
```

If `dx build quantify-mobile --dev` is not a registered target, record the command failure and run the nearest supported Flutter build or test command instead.

## Self-Review

- No placeholders remain.
- Scope is limited to mobile discover contract consumption and address display semantics.
- Backend and front compatibility is preserved.
- Full address versus display address semantics are explicit.
