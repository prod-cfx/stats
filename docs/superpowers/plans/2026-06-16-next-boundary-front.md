# Next Boundary Front Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve issue #2512 by restoring Suspense boundaries around `useSearchParams`, reducing client-side redirect diagnostics, migrating safe bare images, and adding missing metadata in `apps/front`.

**Architecture:** Keep page shells server-rendered and isolate page-private client-only hooks behind small Suspense boundaries. Remove the unnecessary `useSearchParams` dependency from `Navbar` by reading the query only when opening auth, so every page avoids duplicated Navbar workarounds. Convert only images with stable layout dimensions or existing bounded containers to `next/image` to avoid CDN/data-source churn.

**Tech Stack:** Next.js App Router, React Suspense, TypeScript, Jest, React Doctor, `dx` commands.

---

## Files

- Modify: `apps/front/src/components/layout/Navbar.tsx` — remove `useSearchParams` from global navigation.
- Modify: `apps/front/src/components/layout/Navbar.test.tsx` — keep login redirect query behavior covered.
- Modify: `apps/front/src/app/[lng]/account/page.tsx` — wrap `AccountPageClient` in Suspense.
- Modify: `apps/front/src/app/[lng]/auth/login/page.tsx` — wrap `LoginPageClient` in Suspense.
- Modify: `apps/front/src/app/[lng]/auth/telegram/callback/page.tsx` — wrap `TelegramCallbackPageClient` in Suspense.
- Modify: `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/page.tsx` — wrap `StrategyDetailPageClient` in Suspense.
- Delete: `apps/front/src/app/(redirect)/RootRedirectClient.tsx` — remove unused client-effect root redirect.
- Modify: `apps/front/src/app/(redirect)/page.tsx` — replace client-effect redirect with server `redirect()` and add metadata.
- Modify: `apps/front/src/app/root-redirect-page.test.tsx` — assert server redirect preserves English default.
- Modify: `apps/front/src/app/404/page.tsx` — add minimal metadata.
- Modify: `apps/front/src/app/tv-test/page.tsx` — add minimal metadata.
- Modify: `apps/front/src/components/ui/ExchangeLogo.tsx` — convert stable exchange logos to `next/image`.
- Modify: `apps/front/src/components/dashboard/DashboardCard.tsx` — convert bounded thumbnail image to `next/image`.
- Modify: `apps/front/src/components/public-companies/PublicCompaniesTable.tsx` — convert table/detail company logos to `next/image` where size/container is already fixed.

## Steps

### Task 1: Navbar Search Params Removal

- [ ] **Step 1: Write failing redirect preservation test**

Keep `apps/front/src/components/layout/Navbar.test.tsx` desktop/mobile login tests asserting auth opens with `/zh/aggregated-orderbook?tab=depth`.

- [ ] **Step 2: Remove hook from implementation**

In `apps/front/src/components/layout/Navbar.tsx`, remove `useSearchParams`. Build the auth redirect from `pathname` plus `window.location.search` inside the login click callback.

- [ ] **Step 3: Run test to verify GREEN**

Run: `dx test unit front apps/front/src/components/layout/Navbar.test.tsx`

Expected: pass.

### Task 2: Page-Level Client Search Param Boundaries

- [ ] **Step 1: Wrap page-private clients**

In `account`, `auth/login`, `auth/telegram/callback`, and `account/ai-quant/strategy/[id]` pages, import `Suspense` from `react` and wrap the page client component with a fixed-height fallback, for example:

```tsx
<Suspense fallback={<main className="flex flex-1 items-center justify-center text-[color:var(--cf-muted)]">Loading...</main>}>
  <AccountPageClient lng={lng} />
</Suspense>
```

Use the same pattern for `LoginPageClient`, `TelegramCallbackPageClient`, and `StrategyDetailPageClient`.

- [ ] **Step 2: Run focused render tests**

Run:

```bash
dx test unit front apps/front/src/components/layout/Navbar.test.tsx
cd apps/front && ../../node_modules/.bin/jest --config jest.config.ts --runTestsByPath 'src/app/[lng]/account/AccountPageClient.test.tsx' --runInBand
cd apps/front && ../../node_modules/.bin/jest --config jest.config.ts --runTestsByPath 'src/app/[lng]/auth/login/LoginPageClient.test.tsx' --runInBand
cd apps/front && ../../node_modules/.bin/jest --config jest.config.ts --runTestsByPath 'src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.test.tsx' --runInBand
```

Expected: pass. Direct Jest is used only for bracket-literal route paths because `dx test unit front <path>` forwards paths as Jest patterns.

- [ ] **Step 3: Verify Navbar no longer uses search params**

Run: `rg -n "useSearchParams" apps/front/src/components/layout/Navbar.tsx`
Expected: no matches.

### Task 3: Server Redirect and Metadata

- [ ] **Step 1: Write failing redirect test**

Modify `apps/front/src/app/root-redirect-page.test.tsx` to mock `next/navigation` `redirect` and expect `RootPage()` to throw/call redirect to `/en`.

- [ ] **Step 2: Run test to verify RED**

Run: `dx test unit front apps/front/src/app/root-redirect-page.test.tsx`
Expected: fail because current page renders `RootRedirectClient` instead of calling `redirect()`.

- [ ] **Step 3: Implement server redirect**

In `apps/front/src/app/(redirect)/page.tsx`, import `redirect` and `Metadata`, export minimal metadata, and call `redirect('/en')`. Leave `RootRedirectClient.tsx` untouched unless no references remain and lint requires deletion.

- [ ] **Step 4: Add missing metadata**

In `apps/front/src/app/404/page.tsx`, export `metadata` with title `Page not found | CoinFlux` and description `The requested CoinFlux page could not be found.`

In `apps/front/src/app/tv-test/page.tsx`, export `metadata` with title `TradingView Test | CoinFlux` and description `Internal TradingView chart integration test page.`

- [ ] **Step 5: Run redirect test to verify GREEN**

Run: `dx test unit front apps/front/src/app/root-redirect-page.test.tsx`
Expected: pass.

### Task 4: Safe Next Image Migration

- [ ] **Step 1: Convert bounded images**

Import `Image` from `next/image` and replace stable bare images in `ExchangeLogo.tsx`, `DashboardCard.tsx`, and `PublicCompaniesTable.tsx` with `Image`. Use explicit `width`/`height` for logo rows and `fill` with `sizes` for already bounded thumbnail containers.

- [ ] **Step 2: Preserve alt text and layout classes**

Keep existing `alt`, `object-contain`/`object-cover`, rounded, and size classes. Add `unoptimized` only when source may be SVG or non-optimized exchange/company URL and the project already disables optimization globally.

- [ ] **Step 3: Run lint/build to catch remote image and JSX issues**

Run: `dx build front --dev`
Expected: exit 0.

### Task 5: Diagnostics and Full Verification

- [ ] **Step 1: Run React Doctor**

Run: `npx react-doctor@latest . --project apps/front --no-telemetry --json --output-dir /tmp/react-doctor-front-only-output > /tmp/react-doctor-front-only-report.json`
Expected: command exits 0. If CLI options are unavailable, record actual error and run supported scan command from the installed CLI help.

- [ ] **Step 2: Run required parallel verification**

Run concurrently from repo root: `dx lint`, `dx build front --dev`, and focused front unit tests covering changed files.

- [ ] **Step 3: Fix failures and rerun all three verification commands**

Expected: lint, build, and focused tests exit 0 before commit.

## Verify

- `dx lint`
- `dx build front --dev`
- `dx test unit front apps/front/src/components/layout/Navbar.test.tsx apps/front/src/app/root-redirect-page.test.tsx apps/front/src/app/[lng]/account/AccountPageClient.test.tsx apps/front/src/app/[lng]/auth/login/LoginPageClient.test.tsx`
- React Doctor scan command from issue #2512, or documented compatible CLI fallback.

## Commit

Use one commit:

```bash
git add apps/front/src docs/superpowers/plans/2026-06-16-next-boundary-front.md .omc/plans/next-boundary-front-critic-round1.md
git commit -F - <<'MSG'
fix: restore front next rendering boundaries

变更说明：
- 移除 Navbar 的 search params hook 并隔离页面 search params client 子树
- 改用服务端根路由跳转，补齐缺失 metadata，并迁移安全裸图片到 next/image

Closes: #2512
MSG
```
