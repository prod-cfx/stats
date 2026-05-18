# Global Auth Sheet Design

## Context

Mobile login was recently styled as a bottom sheet inside `/auth/login`. That makes the visual pattern page-bound: protected flows must leave their current page to show login. The desired behavior is a reusable login surface that can appear over the current page, while `/auth/login` remains a fallback route.

## Goals

- Provide one reusable login UI for mobile bottom sheet and desktop dialog.
- Keep login available from any protected action without forcing route navigation.
- Preserve existing email OTP, Telegram login, beta-code gate, redirect, and authenticated redirect behavior.
- Support light and dark themes through existing `--cf-*` tokens.
- Respect mobile safe areas, reduced motion, and touch target requirements.

## Non-Goals

- No auth API changes.
- No redesign of the email OTP or Telegram button internals beyond container/layout needs.
- No broad migration of every protected action in the first pass unless explicitly included in the implementation plan.

## Proposed Architecture

### `AuthSheet`

`AuthSheet` owns presentation only:

- Mobile: bottom sheet anchored to viewport bottom.
- Desktop: centered dialog.
- Shared form content: login title, description, `EmailOtpForm`, divider, `TelegramLoginButtons`.
- Props: `open`, `lng`, `redirect`, `onOpenChange`, `onSuccess`.
- Theme: all surfaces, text, borders, shadows use semantic tokens.
- Motion: enter uses transform/opacity only. Reduced motion disables animation.

### `AuthSheetProvider`

`AuthSheetProvider` owns global state:

- Exposes `useAuthSheet()`.
- `openAuth({ redirect, source })` opens the sheet.
- `closeAuth()` closes the sheet.
- Keeps current page in place.
- On successful login, closes sheet and navigates to `redirect` when provided.

Provider placement should be near the app shell so route pages and components can call it without prop drilling. If full root provider placement conflicts with server component boundaries, use a small client provider mounted by localized route layout or page shell.

### `/auth/login` fallback

`/auth/login` should reuse the same login content:

- Direct visit renders the same login UI as a page-backed fallback.
- Mobile still appears like a bottom sheet, but it is driven by the route shell rather than custom duplicated markup.
- Close action returns to previous page when possible, or to `/${lng}`.
- Existing `redirect` query continues to work.

## Interaction Flow

1. User clicks a protected action.
2. Caller checks auth state.
3. If authenticated, continue action.
4. If unauthenticated, call `openAuth({ redirect })`.
5. User logs in with email OTP or Telegram.
6. Auth state updates.
7. Sheet closes.
8. App navigates to `redirect` or lets current action re-run according to caller behavior.

## Migration Strategy

Phase 1:

- Extract current `LoginPageClient` form shell into reusable `AuthSheet`.
- Add provider and hook.
- Make `/auth/login` use the reusable surface.
- Keep existing route redirects working.

Phase 2:

- Migrate high-value protected flows to global sheet:
  - AI Quant guest actions.
  - Strategy Plaza run/edit.
  - Account entry points where current context should remain visible.

Phase 3:

- Remove duplicated page-only login styling if no longer needed.
- Add follow-up tests for migrated protected flows.

## Visual Rules

- Mobile sheet radius: top corners only.
- Desktop dialog radius: standard small dialog/card radius.
- Background scrim only when overlaying an existing page.
- No hardcoded white or near-white page backgrounds.
- Inputs and buttons keep existing tokenized styles.
- Sheet animation:
  - Enter: 280ms, `cubic-bezier(0.16, 1, 0.3, 1)`.
  - Properties: `transform` and `opacity`.
  - Reduced motion: no animation.

## Risks

- Provider placement may need care because the app mixes server and client components.
- Telegram callback and email OTP success flows must keep existing redirect semantics.
- Some callers may rely on full-page navigation today; those should be migrated deliberately.

## Tests

- `AuthSheet` renders mobile bottom sheet classes and desktop dialog classes.
- `AuthSheet` uses tokenized background/surface/text classes and no hardcoded white background.
- Reduced-motion CSS exists for sheet animation.
- `/auth/login` fallback renders login UI and preserves `redirect`.
- A migrated protected action opens the sheet instead of pushing `/auth/login`.
- Login success calls close and navigates to the expected redirect.
