# Telegram Desktop Start Param Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure Telegram desktop login always carries `tg_login_xxx` start param by switching desktop entry to `webLink` first, while preserving existing desktop intent callback flow.

**Architecture:** Keep backend desktop-intent contract unchanged (`deepLink/webLink/callbackUrl`). Frontend desktop button changes only redirect target from `deepLink` to `webLink`. Callback page remains the source of truth for intent polling, confirmation, timeout, and re-create behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, existing auth-provider + Telegram desktop intent API.

---

### Task 1: Add/adjust failing test for desktop button redirect target

**Files:**
- Modify: `apps/front/src/features/auth/components/telegram-login-buttons.test.tsx` (create if absent)
- Modify: `apps/front/src/features/auth/components/telegram-login-buttons.tsx`

**Step 1: Write the failing test**

```tsx
it('desktop button redirects to webLink instead of deepLink', async () => {
  // mock createTelegramDesktopIntent => { deepLink, webLink, callbackUrl }
  // click desktop button
  // expect window.location.href to be webLink
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C apps/front test`
Expected: FAIL for redirect target assertion

**Step 3: Minimal implementation**

```tsx
window.location.href = result.webLink
```

**Step 4: Run test to verify pass**

Run: `pnpm -C apps/front test`
Expected: PASS for updated case

**Step 5: Commit**

```bash
git add apps/front/src/features/auth/components/telegram-login-buttons.tsx apps/front/src/features/auth/components/telegram-login-buttons.test.tsx
git commit -m "fix: use telegram webLink for desktop login entry"
```

### Task 2: Confirm callback flow compatibility (no behavior regression)

**Files:**
- Inspect: `apps/front/src/app/[lng]/auth/telegram/callback/page.tsx`
- Optional modify: same file (only if regression found)

**Step 1: Add regression test (or extend existing callback tests)**

```tsx
it('desktop callback with desktop_intent still polls and completes login', async () => {
  // assert existing status polling and final redirect behavior
})
```

**Step 2: Run test to verify behavior**

Run: `pnpm -C apps/front test`
Expected: PASS; no logic change required

**Step 3: If test fails, apply minimal fix**

```tsx
// only adjust parameter handling if needed, keep existing flow intact
```

**Step 4: Re-run tests**

Run: `pnpm -C apps/front test`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/app/[lng]/auth/telegram/callback/page.tsx
git commit -m "fix: keep desktop callback polling compatible with webLink entry"
```

### Task 3: Verification and release readiness

**Files:**
- Modify if needed: `docs/plans/2026-03-04-telegram-desktop-startparam-design.md`

**Step 1: Run required checks**

Run:
```bash
pnpm -C apps/backend exec tsc --noEmit --project tsconfig.json
pnpm -C apps/front type-check
```

Expected:
- backend type-check PASS
- front type-check may include existing baseline errors; ensure no new errors from changed file

**Step 2: Manual flow verification (critical)**

1. 打开登录页，点击“Telegram 桌面应用”
2. Telegram 会话中确认出现 `/start tg_login_xxx`
3. 授权后返回 callback 页，自动登录完成

**Step 3: Final commit for docs/testing notes**

```bash
git add docs/plans/2026-03-04-telegram-desktop-startparam-design.md
git commit -m "docs: record telegram desktop start-param fix verification"
```
