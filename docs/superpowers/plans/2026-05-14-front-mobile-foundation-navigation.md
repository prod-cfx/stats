# Front Mobile Foundation Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared mobile foundation and global navigation behavior required before page-specific H5 adaptation.

**Architecture:** Preserve desktop behavior while adding shared mobile primitives/conventions that page-specific work can reuse. Update Navbar/Footer/shared overlays so all user-reachable entry points are reachable at 375px and 768px. Keep route semantics, account state, i18n, and existing API/data behavior unchanged.

**Tech Stack:** Nx 19, Next.js App Router, React 19, TypeScript 5.9, Tailwind CSS 4, Jest/ts-jest, existing dx command system.

---

## Source Context

- Parent Epic: #1346 https://github.com/AlphaNet7ed/stats/issues/1346
- Child issue: #1347 https://github.com/AlphaNet7ed/stats/issues/1347
- Design spec: `docs/superpowers/specs/2026-05-14-front-h5-mobile-adaptation-design.md`
- Umbrella plan: `docs/superpowers/plans/2026-05-14-front-h5-mobile-adaptation.md`
- Repo root: `/Users/mac/.codex/worktrees/4db6/stats`

## Scope

- Make global navigation usable at `375px` and `768px`.
- Preserve desktop navigation behavior and visual hierarchy.
- Ensure mobile menu exposes Data, Whales, AI Quant, dashboard/account routes, notifications, language, theme, auth, and account settings entries.
- Ensure route changes close mobile-only navigation surfaces where practical.
- Make shared modal, confirm dialog, toast, and notification/account popover behavior fit mobile viewports.
- Add small shared mobile primitives only when existing local components do not already cover the pattern.
- Keep changes limited to `apps/front` responsive layout and interaction behavior.

## Non-Goals

- Do not adapt page-specific AI Quant, data, whale, or dashboard content layouts in this task.
- Do not change backend, Quantify, Prisma, API contracts, generated contracts, or business state semantics.
- Do not change `apps/admin-front`.
- Do not rebrand desktop UI or rewrite global navigation from scratch.
- Do not add hidden liquidation navigation entries unless product scope changes outside this task.
- Do not create branches or PRs from this plan step; future implementer handles that during execution.

## File Map

### Existing Files To Inspect And Likely Modify

- `apps/front/src/components/layout/Navbar.tsx`
  - Owns desktop nav, mobile nav menu, Data/Whales/account/notification entries, auth-aware account behavior.
- `apps/front/src/components/layout/Footer.tsx`
  - Owns footer link layout, wrapping, spacing, and mobile tap targets.
- `apps/front/src/app/globals.css`
  - Owns global overflow, safe-area helpers, base responsive utilities, and any shared mobile CSS conventions.
- `apps/front/src/components/ui/Modal.tsx`
  - Owns shared modal width, viewport max sizing, internal scrolling, and close behavior.
- `apps/front/src/components/ui/ConfirmDialog.tsx`
  - Owns confirmation dialog mobile sizing and action button wrapping.
- `apps/front/src/components/ui/toast.tsx`
  - Owns toast viewport placement and mobile collision avoidance with sticky action areas.
- `apps/front/src/components/layout/LanguageSwitcher.tsx`
  - Owns language control tap target and dropdown fit.
- `apps/front/src/components/layout/ThemeToggle.tsx`
  - Owns theme toggle tap target and test coverage.

### Candidate New Files

- `apps/front/src/components/ui/MobileSheet.tsx`
  - Create only if shared mobile bottom-sheet behavior is needed for nav/overlay primitives and no existing component fits.
- `apps/front/src/components/ui/ResponsiveActionBar.tsx`
  - Create only if shared sticky mobile actions are needed by global overlays and can be reused by later page work.
- `apps/front/src/components/ui/HorizontalScrollHint.tsx`
  - Create only if global conventions need a reusable contained-scroll wrapper for later data/table tasks.
- `apps/front/src/components/ui/ResponsiveTabs.tsx`
  - Create only if current tab patterns need a shared wrapper before page-specific adaptation.

### Test Files To Discover Before Editing

- `apps/front/src/components/layout/ThemeToggle.test.tsx` already exists.
- Other exact test files must be discovered with `rg` before choosing focused test commands.

## Task 1: Baseline Inspection

**Files:**
- Read: `apps/front/src/components/layout/Navbar.tsx`
- Read: `apps/front/src/components/layout/Footer.tsx`
- Read: `apps/front/src/app/globals.css`
- Read: `apps/front/src/components/ui/Modal.tsx`
- Read: `apps/front/src/components/ui/ConfirmDialog.tsx`
- Read: `apps/front/src/components/ui/toast.tsx`
- Read: `apps/front/src/components/layout/LanguageSwitcher.tsx`
- Read: `apps/front/src/components/layout/ThemeToggle.tsx`

- [ ] **Step 1: Confirm working tree state**

Run:

```bash
git status --short
```

Expected: note unrelated local changes and leave them untouched.

- [ ] **Step 2: Inspect current global navigation implementation**

Run:

```bash
sed -n '1,260p' apps/front/src/components/layout/Navbar.tsx
sed -n '260,620p' apps/front/src/components/layout/Navbar.tsx
```

Expected: identify nav data shape, mobile menu state, route-link rendering, notification/account popovers, auth-aware account entries, and close behavior.

- [ ] **Step 3: Inspect shared shell and overlay components**

Run:

```bash
sed -n '1,240p' apps/front/src/components/layout/Footer.tsx
sed -n '1,260p' apps/front/src/app/globals.css
sed -n '1,240p' apps/front/src/components/ui/Modal.tsx
sed -n '1,240p' apps/front/src/components/ui/ConfirmDialog.tsx
sed -n '1,260p' apps/front/src/components/ui/toast.tsx
sed -n '1,220p' apps/front/src/components/layout/LanguageSwitcher.tsx
sed -n '1,220p' apps/front/src/components/layout/ThemeToggle.tsx
```

Expected: identify mobile viewport assumptions, fixed widths, overflow risks, and reusable styling patterns.

- [ ] **Step 4: Discover focused tests**

Run:

```bash
rg -n "Navbar|ThemeToggle|LanguageSwitcher|Footer|Modal|ConfirmDialog|toast|notification|mobile menu|account menu" apps/front/src --glob '*.{test,spec}.{ts,tsx}' --glob '!**/*.d.ts'
```

Expected: list existing relevant tests. Use exact files from results for focused commands. If only `ThemeToggle.test.tsx` exists for this scope, add new focused tests next to changed components.

## Task 2: Navigation Data And Mobile Menu Behavior

**Files:**
- Modify: `apps/front/src/components/layout/Navbar.tsx`
- Test: existing discovered Navbar tests, or create `apps/front/src/components/layout/Navbar.test.tsx` if no Navbar test exists.

- [ ] **Step 1: Add or extend test coverage for nav entries**

If `Navbar` already has tests, extend that file. If no Navbar test exists, create `apps/front/src/components/layout/Navbar.test.tsx` and mock only framework hooks/providers needed to render stable links.

Test intent:

```tsx
it('exposes required data and whale destinations in mobile navigation', () => {
  // Render Navbar at mobile-oriented state or extract nav link groups into a pure helper.
  // Assert Data group contains:
  // /market
  // /long-short-ratio
  // /aggregated-orderbook
  // /prediction-market
  // /public-companies
  // Assert Whales group contains:
  // /whale-tracking/discover
  // /whale-tracking/realtime
  // /whale-tracking/holdings
  // /whale-tracking/notifications
});
```

If rendering the component requires heavy auth/i18n setup, extract pure nav group constants from `Navbar.tsx` into an internal helper within the same file or a small nearby module, then test the helper values.

- [ ] **Step 2: Verify failing test before implementation**

Run focused command chosen from discovery results, for example:

```bash
dx test unit front apps/front/src/components/layout/Navbar.test.tsx
```

Expected: FAIL if required links are missing or helper export does not exist yet.

- [ ] **Step 3: Update mobile nav link groups**

In `apps/front/src/components/layout/Navbar.tsx`, ensure mobile navigation exposes these destinations:

```ts
const requiredDataRoutes = [
  '/market',
  '/long-short-ratio',
  '/aggregated-orderbook',
  '/prediction-market',
  '/public-companies',
];

const requiredWhaleRoutes = [
  '/whale-tracking/discover',
  '/whale-tracking/realtime',
  '/whale-tracking/holdings',
  '/whale-tracking/notifications',
];
```

Implementation requirements:

- Keep desktop route groups visually and behaviorally unchanged.
- Keep i18n path prefix behavior consistent with existing `Navbar.tsx` link helpers.
- Do not add hidden `/liquidation-map` or `/liquidation-data` entries.
- Keep active route styling consistent across desktop and mobile.

- [ ] **Step 4: Add mobile close-on-navigation behavior**

In `Navbar.tsx`, make every mobile menu navigation link close the mobile menu after click. Preserve desktop dropdown behavior. If `usePathname` already drives route state, also close the menu in a small effect when pathname changes:

```tsx
useEffect(() => {
  setIsMobileMenuOpen(false);
}, [pathname]);
```

Use actual state names from the existing file.

- [ ] **Step 5: Add logged-in and logged-out account entry checks where practical**

Test intent:

```tsx
it('shows logged-in account destinations in the mobile account area', () => {
  // With authenticated user state, assert:
  // /account?tab=settings
  // /account?tab=ai-quant
});

it('shows login destination when logged out', () => {
  // With unauthenticated state, assert login link used by current Navbar implementation.
});
```

If existing auth mocks are not available, document exact blocker in the PR and keep pure nav-data tests for route coverage.

- [ ] **Step 6: Re-run focused nav tests**

Run:

```bash
dx test unit front apps/front/src/components/layout/Navbar.test.tsx
```

Expected: PASS for nav link data and mobile close behavior tests.

## Task 3: Shared Mobile Primitives And Global CSS Conventions

**Files:**
- Modify: `apps/front/src/app/globals.css`
- Create when needed: `apps/front/src/components/ui/MobileSheet.tsx`
- Create when needed: `apps/front/src/components/ui/ResponsiveActionBar.tsx`
- Create when needed: `apps/front/src/components/ui/HorizontalScrollHint.tsx`
- Create when needed: `apps/front/src/components/ui/ResponsiveTabs.tsx`

- [ ] **Step 1: Decide which primitives are necessary**

Run:

```bash
rg -n "bottom sheet|sheet|sticky.*bottom|overflow-x|tabs|role=\"tab\"|data-state=\"active\"" apps/front/src/components apps/front/src/app --glob '*.{ts,tsx,css}'
```

Expected: reuse existing components if present. Create candidate primitives only where they remove duplication for this foundation task or later child issues.

- [ ] **Step 2: Add global overflow and safe-area conventions**

In `apps/front/src/app/globals.css`, add minimal rules only if absent:

```css
html,
body {
  max-width: 100%;
  overflow-x: clip;
}

.mobile-safe-bottom {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}

.contained-x-scroll {
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
}
```

If existing global rules already provide these semantics, extend those rules rather than duplicating class names.

- [ ] **Step 3: Add `MobileSheet` only if shared mobile overlay shell is needed now**

Create `apps/front/src/components/ui/MobileSheet.tsx` with a typed component matching local component style:

```tsx
'use client';

import type { ReactNode } from 'react';

type MobileSheetProps = {
  open: boolean;
  title: string;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function MobileSheet({ open, title, closeLabel, children, footer, onClose }: MobileSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 cursor-default" type="button" aria-label={closeLabel} onClick={onClose} />
      <section className="relative max-h-[85dvh] w-full overflow-hidden rounded-t-2xl bg-background shadow-xl sm:max-w-lg sm:rounded-2xl">
        <header className="border-b px-4 py-3 text-base font-semibold">{title}</header>
        <div className="max-h-[calc(85dvh-7rem)] overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <footer className="mobile-safe-bottom border-t px-4 py-3">{footer}</footer> : null}
      </section>
    </div>
  );
}
```

Before committing this exact code, align class names, color tokens, focus handling, and close button style with existing `Modal.tsx`. Callers must pass a localized `closeLabel`; do not hardcode English user-facing labels in shared UI.

- [ ] **Step 4: Add `ResponsiveActionBar` only if global overlays need mobile sticky actions now**

Create `apps/front/src/components/ui/ResponsiveActionBar.tsx`:

```tsx
import type { ReactNode } from 'react';

type ResponsiveActionBarProps = {
  children: ReactNode;
  className?: string;
};

export function ResponsiveActionBar({ children, className = '' }: ResponsiveActionBarProps) {
  return (
    <div className={`mobile-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-lg backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none ${className}`}>
      <div className="mx-auto flex max-w-screen-sm flex-col gap-2 md:max-w-none md:flex-row md:justify-end">
        {children}
      </div>
    </div>
  );
}
```

Use existing button sizing and color tokens where current UI components require them.

- [ ] **Step 5: Add `HorizontalScrollHint` only if foundation needs a reusable contained-scroll wrapper**

Create `apps/front/src/components/ui/HorizontalScrollHint.tsx`:

```tsx
import type { ReactNode } from 'react';

type HorizontalScrollHintProps = {
  children: ReactNode;
  label: string;
};

export function HorizontalScrollHint({ children, label }: HorizontalScrollHintProps) {
  return (
    <div className="max-w-full">
      <div className="mb-2 text-xs text-muted-foreground md:hidden">{label}</div>
      <div className="contained-x-scroll">{children}</div>
    </div>
  );
}
```

Callers must pass a localized `label`; do not provide an English default in the shared component.

- [ ] **Step 6: Add `ResponsiveTabs` only if existing tab usage is inconsistent**

Create `apps/front/src/components/ui/ResponsiveTabs.tsx` only if it wraps existing tab markup without introducing a new dependency:

```tsx
import type { ReactNode } from 'react';

type ResponsiveTabsProps = {
  children: ReactNode;
  ariaLabel: string;
};

export function ResponsiveTabs({ children, ariaLabel }: ResponsiveTabsProps) {
  return (
    <div className="contained-x-scroll" role="tablist" aria-label={ariaLabel}>
      <div className="flex min-w-max gap-2 md:min-w-0 md:flex-wrap">{children}</div>
    </div>
  );
}
```

Keep the component thin; page-specific tab behavior belongs in later child issues.

## Task 4: Footer, Language, Theme, And Shared Overlays

**Files:**
- Modify: `apps/front/src/components/layout/Footer.tsx`
- Modify: `apps/front/src/components/layout/LanguageSwitcher.tsx`
- Modify: `apps/front/src/components/layout/ThemeToggle.tsx`
- Modify: `apps/front/src/components/ui/Modal.tsx`
- Modify: `apps/front/src/components/ui/ConfirmDialog.tsx`
- Modify: `apps/front/src/components/ui/toast.tsx`
- Test: `apps/front/src/components/layout/ThemeToggle.test.tsx`
- Test: add or extend focused tests discovered in Task 1.

- [ ] **Step 1: Update footer wrapping and tap targets**

In `Footer.tsx`, use existing link data and classes, but ensure mobile layout follows these constraints:

```tsx
<footer className="w-full border-t">
  <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-6">
    {/* existing footer content */}
  </div>
</footer>
```

Requirements:

- Footer links wrap without horizontal overflow at `375px`.
- Tap targets remain at least `40px` tall where practical.
- Desktop arrangement remains visually equivalent.

- [ ] **Step 2: Update language and theme controls for touch**

In `LanguageSwitcher.tsx` and `ThemeToggle.tsx`, keep existing behavior but ensure controls have stable mobile dimensions:

```tsx
className="inline-flex h-10 min-w-10 items-center justify-center"
```

Use existing local class merge helpers if present. Do not replace icons, labels, or i18n logic.

- [ ] **Step 3: Keep theme tests passing**

Run:

```bash
dx test unit front apps/front/src/components/layout/ThemeToggle.test.tsx
```

Expected: PASS. If a class or accessible label assertion fails, update assertion to reflect intended touch target without weakening behavior checks.

- [ ] **Step 4: Make shared modal fit mobile viewport**

In `Modal.tsx`, ensure content width and height are viewport-safe:

```tsx
className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg overflow-hidden"
```

Ensure modal body scrolls internally:

```tsx
className="max-h-[calc(100dvh-8rem)] overflow-y-auto"
```

Use existing class locations and tokens from `Modal.tsx`.

- [ ] **Step 5: Make confirm dialog action layout responsive**

In `ConfirmDialog.tsx`, keep existing confirm/cancel semantics and update action layout:

```tsx
className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
```

Ensure buttons do not overflow on long Chinese or English labels:

```tsx
className="min-h-10 w-full sm:w-auto"
```

- [ ] **Step 6: Make toast viewport mobile-safe**

In `toast.tsx`, update toast container placement so it fits `375px` and avoids mobile sticky controls:

```tsx
className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 sm:left-auto sm:right-4 sm:w-full sm:max-w-sm"
```

Preserve existing toast API and animation behavior.

## Task 5: Notification And Account Popovers

**Files:**
- Modify: `apps/front/src/components/layout/Navbar.tsx`
- Test: existing discovered Navbar tests, or `apps/front/src/components/layout/Navbar.test.tsx`.

- [ ] **Step 1: Constrain notification popover width**

In `Navbar.tsx`, update notification popover container classes to fit mobile:

```tsx
className="max-h-[min(32rem,calc(100dvh-5rem))] w-[calc(100vw-2rem)] max-w-sm overflow-y-auto"
```

Keep desktop alignment consistent with the current implementation.

- [ ] **Step 2: Constrain account menu width and route entries**

Ensure account popover or mobile account area includes:

```text
/account?tab=settings
/account?tab=ai-quant
```

when logged in, and the existing login route when logged out.

Use current account state and route helpers from `Navbar.tsx`; do not introduce new auth state.

- [ ] **Step 3: Add close behavior for popovers on route navigation**

When a notification/account/mobile nav link navigates, close the relevant local state. If existing popovers are controlled by booleans, clear them in link click handlers and in pathname-change effect.

Expected behavior:

- mobile menu closes after navigation
- account menu closes after account link click
- notification popover closes after notification route/action navigation when represented as route link

- [ ] **Step 4: Re-run focused Navbar tests**

Run:

```bash
dx test unit front apps/front/src/components/layout/Navbar.test.tsx
```

Expected: PASS if a Navbar test file exists or was created. If test file path differs, run exact path found in Task 1.

## Task 6: Manual Browser Verification

**Files:**
- No code files; browser verification against running `apps/front`.

- [ ] **Step 1: Build front before interactive checks**

Run:

```bash
dx build front --dev
```

Expected: build succeeds.

- [ ] **Step 2: Start front dev server with existing dx command**

Run:

```bash
dx start front --dev
```

Expected: front dev server starts on the configured front port.

- [ ] **Step 3: Verify at 375px viewport**

Use browser devtools or the in-app browser viewport controls at width `375px`.

Checklist:

- mobile menu opens and closes
- mobile menu closes after clicking a route link
- Data group contains `/market`, `/long-short-ratio`, `/aggregated-orderbook`, `/prediction-market`, `/public-companies`
- Whales group contains `/whale-tracking/discover`, `/whale-tracking/realtime`, `/whale-tracking/holdings`, `/whale-tracking/notifications`
- account menu contains `/account?tab=settings` and `/account?tab=ai-quant` when logged in
- login link appears when logged out
- notification popover fits viewport and scrolls internally when content is long
- language control is tappable
- theme control is tappable
- footer wraps cleanly
- no body horizontal overflow

- [ ] **Step 4: Verify at 768px viewport**

Use width `768px`.

Checklist:

- navigation remains reachable without clipped entries
- Data group contains `/market`, `/long-short-ratio`, `/aggregated-orderbook`, `/prediction-market`, `/public-companies`
- Whales group contains `/whale-tracking/discover`, `/whale-tracking/realtime`, `/whale-tracking/holdings`, `/whale-tracking/notifications`
- account menu contains `/account?tab=settings` and `/account?tab=ai-quant` when logged in
- login link appears when logged out
- notification popover fits viewport
- language/theme controls are tappable
- footer wraps or aligns cleanly
- no body horizontal overflow

- [ ] **Step 5: Spot-check desktop**

Use a desktop viewport such as `1440px`.

Expected: desktop navigation, footer, popovers, modal sizing, confirm dialog layout, and toast placement remain visually equivalent to pre-change behavior.

## Task 7: Full Validation

**Files:**
- No additional source files.

- [ ] **Step 1: Run focused tests first**

Run focused commands from discovered/created tests. Examples:

```bash
dx test unit front apps/front/src/components/layout/ThemeToggle.test.tsx
dx test unit front apps/front/src/components/layout/Navbar.test.tsx
```

Expected: PASS. Omit nonexistent example paths and use exact discovered test files.

- [ ] **Step 2: Run full front unit tests**

Run:

```bash
dx test unit front
```

Expected: PASS.

- [ ] **Step 3: Run front dev build**

Run:

```bash
dx build front --dev
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
dx lint
```

Expected: PASS.

- [ ] **Step 5: Check final diff**

Run:

```bash
git diff -- apps/front/src/components/layout/Navbar.tsx apps/front/src/components/layout/Footer.tsx apps/front/src/app/globals.css apps/front/src/components/ui/Modal.tsx apps/front/src/components/ui/ConfirmDialog.tsx apps/front/src/components/ui/toast.tsx apps/front/src/components/layout/LanguageSwitcher.tsx apps/front/src/components/layout/ThemeToggle.tsx apps/front/src/components/ui/MobileSheet.tsx apps/front/src/components/ui/ResponsiveActionBar.tsx apps/front/src/components/ui/HorizontalScrollHint.tsx apps/front/src/components/ui/ResponsiveTabs.tsx
```

Expected: diff contains only foundation/global navigation/mobile primitive changes for child issue #1347.

## Task 8: Commit For Future Implementer

**Files:**
- Stage only files changed for child issue #1347.

- [ ] **Step 1: Confirm no unrelated files are staged**

Run:

```bash
git status --short
```

Expected: unrelated local changes remain unstaged.

- [ ] **Step 2: Stage child issue files only**

Run:

```bash
git add apps/front/src/components/layout/Navbar.tsx apps/front/src/components/layout/Footer.tsx apps/front/src/app/globals.css apps/front/src/components/ui/Modal.tsx apps/front/src/components/ui/ConfirmDialog.tsx apps/front/src/components/ui/toast.tsx apps/front/src/components/layout/LanguageSwitcher.tsx apps/front/src/components/layout/ThemeToggle.tsx
```

If new primitives or tests were created, stage those exact files too:

```bash
git add apps/front/src/components/ui/MobileSheet.tsx apps/front/src/components/ui/ResponsiveActionBar.tsx apps/front/src/components/ui/HorizontalScrollHint.tsx apps/front/src/components/ui/ResponsiveTabs.tsx apps/front/src/components/layout/Navbar.test.tsx
```

Only run the second command for files that exist.

- [ ] **Step 3: Commit**

Run:

```bash
git commit -m "feat(front): add mobile foundation navigation"
```

Expected: commit contains only child issue #1347 implementation and tests. Do not include unrelated local changes.

## Self-Review

- Coverage: Plan covers scope/non-goals, required likely files, candidate shared primitives, TDD-oriented inspection/tests, mobile menu close-on-navigation, account/login links, notification/account popovers, footer wrapping, language/theme tap targets, shared modal/confirm/toast behavior, 375px and 768px manual checks, validation commands, and future commit step.
- Completion marker scan: No unresolved markers or unfinished sections remain. Unknown exact test names are handled by required `rg` discovery and exact-path selection from results.
- Type/path consistency: Paths use `apps/front/src/...` consistently. Candidate component names match requested file names: `MobileSheet.tsx`, `ResponsiveActionBar.tsx`, `HorizontalScrollHint.tsx`, and `ResponsiveTabs.tsx`. Validation commands use `dx test unit front`, `dx build front --dev`, and `dx lint`.
