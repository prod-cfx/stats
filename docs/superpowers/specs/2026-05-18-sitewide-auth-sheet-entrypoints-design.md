# Sitewide Auth Sheet Entrypoints Design

## Context

The app now has a reusable `AuthSheet` and `AuthSheetProvider`. AI Quant guest actions and Strategy Plaza run/edit already open login over the current page. Other sitewide login entry points still navigate to `/auth/login`, so a user on a public page such as `/aggregated-orderbook` leaves the page before seeing login.

## Goal

Make in-site login entry points open the global auth sheet over the current page on both desktop and mobile.

- Desktop: centered dialog over the current page.
- Mobile: bottom sheet over the current page.
- Current page remains visible behind the overlay.
- `/auth/login` remains available as a direct-visit and external-link fallback.
- Existing post-login redirect behavior remains explicit and predictable.

## Non-Goals

- Do not remove `/auth/login`.
- Do not change auth APIs, OTP behavior, Telegram login internals, beta-code behavior, or session storage.
- Do not redesign the login form beyond reusing the existing `AuthSheet`.
- Do not create a large protected-route framework unless a small helper is needed to keep call sites consistent.

## Existing Entry Points

Known entry points that currently need review or migration:

- `Navbar`: unauthenticated top-level login button currently links to `/auth/login`.
- `AccountPageClient`: unauthenticated account access currently routes to `/auth/login`.
- `StrategyDetailPageClient`: unauthenticated strategy detail currently assigns `window.location.href` to `/auth/login?redirect=...`.
- `AuthGateCard`: renders a link to `/auth/login`.
- `TelegramCallbackPageClient`: has a recovery button that routes to `/auth/login`; this may remain a fallback because it is part of the auth callback flow.
- AI Quant and Plaza flows already use `openAuth`; keep them as-is unless tests show regressions.

## Design

### Global Login Entrypoint

Use the existing `useAuthSheet()` hook for in-site login actions:

- `openAuth({ lng, redirect })` opens the overlay.
- `redirect` should be the page the user should land on after login.
- For normal login buttons, `redirect` should be the current localized path, including query string when available.
- For protected actions targeting another page, `redirect` should be that target page.

Do not navigate to `/auth/login` for normal in-site clicks.

### Navbar Login

Convert the unauthenticated `Navbar` login `Link` into a button:

- On click, close any mobile menu or account menu state.
- Call `openAuth({ lng, redirect: currentPathWithSearch })`.
- Keep visual styling unchanged.
- Preserve accessible button semantics, focus outline, and icon/text layout.

This covers pages such as `/aggregated-orderbook`: clicking login opens the auth sheet over that page.

### Protected Page Entrypoints

For pages that require login:

- If the page can safely render a guest shell, open the auth sheet on the current page and redirect back to the same page after login.
- If the page cannot safely render without auth, prefer a small guest gate with the same auth sheet trigger instead of immediate route navigation.
- Keep hard fallback navigation only where the route is part of the auth flow or cannot host the provider safely.

Per-file intended behavior:

- `AccountPageClient`: replace automatic `/auth/login` navigation with an auth sheet gate when unauthenticated. Login success redirects to `/${lng}/account` with current query when appropriate.
- `StrategyDetailPageClient`: replace `window.location.href` login jump with `openAuth({ redirect: strategy detail path })`.
- `AuthGateCard`: replace login link with a button that calls `openAuth`.
- `TelegramCallbackPageClient`: keep the recovery route to `/auth/login` unless review shows it is a normal in-site login action. This is a callback/error recovery surface, not a standard protected action.

### Fallback Route

`/auth/login` remains:

- Direct URL fallback.
- External-link fallback.
- Auth callback recovery target when safer than overlay.
- Test fixture for the same `AuthSheet` surface.

It should not be the normal target for in-site login buttons.

## Data Flow

1. User clicks a login button or protected action.
2. Caller determines locale and redirect.
3. Caller calls `openAuth({ lng, redirect })`.
4. `AuthSheetProvider` renders `AuthSheet` over the current page.
5. User completes email OTP or Telegram login.
6. `AuthSheetProvider` closes the sheet.
7. If `redirect` exists, provider navigates there with `router.replace(redirect)`.

## Error Handling

- Auth form errors remain inside `EmailOtpForm` and existing Telegram components.
- Closing the overlay keeps the user on the current page.
- If a migrated component cannot access `useAuthSheet`, that is a provider placement bug and should fail in tests.
- Invalid external redirects must not be introduced. Call sites should only pass localized internal paths.

## Testing

Add focused tests around migrated entry points:

- `Navbar` unauthenticated login calls `openAuth` with current localized path and does not render an `/auth/login` link.
- `Navbar` mobile menu login closes the menu and opens the auth sheet.
- `AccountPageClient` unauthenticated state opens auth sheet instead of routing to `/auth/login`.
- `StrategyDetailPageClient` unauthenticated state opens auth sheet with strategy detail redirect.
- `AuthGateCard` opens auth sheet instead of linking to `/auth/login`.
- Existing `/auth/login` fallback tests continue to pass.
- Existing AI Quant and Plaza tests continue to pass.
- Search production code for remaining `/auth/login` usage and classify any retained usage as fallback/auth-callback only.

## Risks

- Some pages currently depend on full-page redirect to avoid rendering protected UI. Those pages need a small guest gate rather than blindly removing the redirect.
- `Navbar` appears on many pages, so the test should mock pathname/search and verify redirect construction.
- Telegram callback recovery may intentionally need a route fallback. Treat it separately instead of forcing overlay behavior.

## Acceptance Criteria

- On `/aggregated-orderbook`, clicking login opens the login overlay on that same page on desktop and mobile.
- In-site login buttons do not route to `/auth/login`.
- Protected action login prompts use the same `AuthSheet` mechanism.
- `/auth/login` direct visit still works.
- Focused tests and lint pass.
