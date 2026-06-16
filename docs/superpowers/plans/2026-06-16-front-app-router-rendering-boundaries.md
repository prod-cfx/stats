# Front App Router Rendering Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve issue #2540 by removing App Router boundary, metadata, redirect, and image warnings reported for `apps/front/src/**` without changing routes or auth semantics.

**Architecture:** Keep App Router server pages responsible for Suspense and metadata. Keep auth side effects in client components only where they depend on client auth/session state, with precise react-doctor suppression comments when server redirects are not possible. Replace target `<img>` tags with `next/image` and allow only concrete remote image hosts needed by the affected components.

**Tech Stack:** Next.js App Router, React Suspense, Jest + Testing Library, `next/image`, `dx` commands.

---

## Files

- Modify: `apps/front/src/app/[lng]/dashboard/page.tsx` — keep `DashboardClient` under the nearest server Suspense boundary and format fallback clearly.
- Modify: `apps/front/src/app/[lng]/trade/page.tsx` — verify existing `TradingPageClient` Suspense boundary remains intact.
- Modify: `apps/front/src/app/[lng]/auth/login/page.tsx` — keep login client under server Suspense.
- Modify: `apps/front/src/app/[lng]/auth/login/LoginPageClient.tsx` — keep authenticated redirect behavior and add focused suppression only if react-doctor still reports client redirect.
- Modify: `apps/front/src/app/[lng]/auth/telegram/callback/TelegramCallbackPageClient.tsx` — keep async callback redirects client-side and add focused suppression only if react-doctor still reports them.
- Modify: `apps/front/src/app/[lng]/market/page.tsx` — add locale-aware `generateMetadata` using `getPageMetadata`.
- Modify: `apps/front/src/app/[lng]/ai-quant/plaza/page.tsx` — add locale-aware `generateMetadata`.
- Modify: `apps/front/src/app/[lng]/liquidation-map/page.tsx` — add locale-aware `generateMetadata`.
- Modify: `apps/front/src/lib/page-metadata.ts` — add page metadata keys for any missing pages.
- Modify: `apps/front/src/app/[lng]/page-metadata.test.ts` — add expectations for market, AI Quant plaza, and liquidation map.
- Modify: `apps/front/src/components/account/UserAvatar.tsx` — replace avatar `<img>` with `next/image` while preserving size, `alt`, and `referrerPolicy`.
- Modify: `apps/front/src/components/account/UserAvatar.test.tsx` — assert image rendering still exposes the label and source.
- Modify: `apps/front/src/components/dashboard/ExploreDashboards.tsx` — replace modal image `<img>` with `next/image`.
- Modify: `apps/front/src/components/dashboard/DashboardCard.tsx` / `DashboardListItem.tsx` if current target images are delegated there.
- Modify: `apps/front/src/features/dashboards/widgets/contents/CryptoStocksWidget.tsx` — replace asset/company logos with `next/image` and stable sizes.
- Modify: `apps/front/next.config.js` — add concrete `remotePatterns` for `cryptologos.cc`, `upload.wikimedia.org`, `www.circle.com`, and `bitmine.tech` if needed by `next/image`.

## Tasks

### Task 1: Metadata coverage

- [ ] Add failing metadata expectations in `apps/front/src/app/[lng]/page-metadata.test.ts` for `market`, `ai-quant/plaza`, and `liquidation-map` routes.
- [ ] Run `dx test unit front apps/front/src/app/[lng]/page-metadata.test.ts`; expect failures because the target pages do not export `generateMetadata` yet.
- [ ] Add missing metadata entries in `apps/front/src/lib/page-metadata.ts` and `generateMetadata` exports in the three pages.
- [ ] Re-run the focused metadata test; expect pass.

### Task 2: Image migration

- [ ] Add or update focused tests for `UserAvatar` so a real avatar source is asserted through the rendered image element.
- [ ] Run `dx test unit front apps/front/src/components/account/UserAvatar.test.tsx`; expect the test to fail if it relies on Next image behavior not yet wired in the component.
- [ ] Replace targeted `<img>` tags in `UserAvatar`, `ExploreDashboards`, and `CryptoStocksWidget` with `Image` from `next/image`; use `fill` for cover images inside positioned containers and numeric `width` / `height` for logos.
- [ ] Add minimal image host allow-list entries to `apps/front/next.config.js` for hosts used by the changed components.
- [ ] Re-run the focused avatar test; expect pass.

### Task 3: Suspense and client redirect warnings

- [ ] Run `react-doctor apps/front --full --offline --json --fail-on none` and inspect `apps/front/src/**` warnings for the four issue rule IDs.
- [ ] For any remaining `nextjs-no-use-search-params-without-suspense` warning on dashboard, trade, login, or telegram callback, move/keep the Suspense boundary in the nearest server page and avoid client self-wrapping.
- [ ] For `nextjs-no-client-side-redirect` warnings in auth flows, keep redirects that depend on `useAuth()`, Telegram callback payloads, sessionStorage, or async login results in client code; add exact react-doctor suppression comments explaining the runtime dependency.
- [ ] Re-run react-doctor and confirm the four issue rule IDs are zero or only have exact justified suppressions.

### Task 4: Full verification and PR

- [ ] Run three verification lanes in parallel from repo root: `dx lint`, `dx build front --dev`, and relevant tests (`dx test unit front apps/front/src/app/[lng]/page-metadata.test.ts apps/front/src/components/account/UserAvatar.test.tsx`, plus react-doctor command).
- [ ] If any lane fails, fix the issue and re-run all lanes.
- [ ] Commit with heredoc and `Refs: #2540`.
- [ ] Push branch and create PR with heredoc/body-file. Include react-doctor, lint, build, and test evidence.
