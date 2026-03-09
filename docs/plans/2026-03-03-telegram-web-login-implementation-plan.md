# Telegram Web Login UI Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Telegram official widget on login with a fully custom-styled web login button that visually matches desktop button while preserving official Telegram authorization + callback login flow.

**Architecture:** Keep current callback exchange flow and auth-provider contract; only replace the left entry trigger from injected `telegram-widget.js` to backend-provided authorize URL redirect. Frontend handles pending/error states and keeps existing callback page logic. Backend provides signed, stateful authorize URL endpoint for web login intent.

**Tech Stack:** Next.js App Router, React, TypeScript, NestJS auth module, existing i18n + auth provider + API client.

---

### Task 1: Add failing frontend tests for Telegram web button behavior

**Files:**
- Modify: `apps/front/src/features/auth/components/telegram-login-buttons.tsx`
- Create: `apps/front/src/features/auth/components/telegram-login-buttons.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders custom telegram web button instead of widget host', () => {
  render(<TelegramLoginButtons lng="zh" intent="login" />)
  expect(screen.getByRole('button', { name: /Telegram 网页版/i })).toBeInTheDocument()
  expect(document.querySelector('.telegram-widget-host')).toBeNull()
})

it('requests authorize url and redirects when telegram web button clicked', async () => {
  // mock getTelegramWebAuthorizeUrl => { authorizeUrl: 'https://oauth.telegram.org/...' }
  // click web button
  // expect window.location.href updated
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter front test telegram-login-buttons.test.tsx`
Expected: FAIL (current code still renders widget host and has no authorize-url flow)

**Step 3: Write minimal implementation scaffold**

```tsx
// add webBusy state
const [webBusy, setWebBusy] = useState(false)

// render normal button instead of widget host
<button onClick={handleWebLogin}>Telegram 网页版</button>
```

**Step 4: Run test to verify partial pass/fail**

Run: `pnpm --filter front test telegram-login-buttons.test.tsx`
Expected: first test PASS, redirect test still FAIL

**Step 5: Commit**

```bash
git add apps/front/src/features/auth/components/telegram-login-buttons.test.tsx apps/front/src/features/auth/components/telegram-login-buttons.tsx
git commit -m "test: add telegram web login button behavior tests"
```

### Task 2: Add frontend API client contract for authorize URL

**Files:**
- Modify: `apps/front/src/features/auth/api.ts`
- Modify: `apps/front/src/features/auth/types.ts`
- (Optional) Modify: `packages/api-contracts/src/generated/backend.ts`

**Step 1: Write the failing test**

```ts
it('getTelegramWebAuthorizeUrlRequest returns authorizeUrl', async () => {
  // mock fetch JSON payload and assert parsed authorizeUrl
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter front test auth-api.test.ts`
Expected: FAIL (function not implemented)

**Step 3: Write minimal implementation**

```ts
export async function getTelegramWebAuthorizeUrlRequest(payload: {
  intent: 'login' | 'bind'
  lng: 'zh' | 'en'
  redirect?: string
}): Promise<{ authorizeUrl: string }> {
  return getJson('/auth/telegram/web/authorize-url?...')
}
```

**Step 4: Run tests to verify pass**

Run: `pnpm --filter front test auth-api.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/features/auth/api.ts apps/front/src/features/auth/types.ts
git commit -m "feat: add telegram web authorize-url api client"
```

### Task 3: Implement frontend custom-button web login flow

**Files:**
- Modify: `apps/front/src/features/auth/components/telegram-login-buttons.tsx`

**Step 1: Write/extend failing test for busy + error states**

```tsx
it('disables web button while requesting authorize url and shows status message on failure', async () => {
  // mock reject, click, assert disabled + status message
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter front test telegram-login-buttons.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
const handleWebLogin = async () => {
  try {
    setWebBusy(true)
    const { authorizeUrl } = await getTelegramWebAuthorizeUrlRequest({ intent, lng })
    window.location.href = authorizeUrl
  } catch {
    setStatusMessage(t('auth.configFailed'))
  } finally {
    setWebBusy(false)
  }
}
```

**Step 4: Run tests**

Run: `pnpm --filter front test telegram-login-buttons.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/features/auth/components/telegram-login-buttons.tsx apps/front/src/features/auth/components/telegram-login-buttons.test.tsx
git commit -m "feat: replace telegram widget with custom web login trigger"
```

### Task 4: Add backend authorize-url endpoint (failing tests first)

**Files:**
- Modify: `apps/backend/src/modules/auth/auth.controller.ts`
- Modify: `apps/backend/src/modules/auth/services/user-auth.service.ts`
- Create: `apps/backend/src/modules/auth/dto/requests/get-telegram-web-authorize-url.request.dto.ts`
- Create: `apps/backend/src/modules/auth/dto/responses/get-telegram-web-authorize-url.response.dto.ts`
- Test: `apps/backend/src/modules/auth/auth.controller.spec.ts` (or auth e2e)

**Step 1: Write failing test**

```ts
it('returns signed authorizeUrl for telegram web login', async () => {
  // call GET /auth/telegram/web/authorize-url
  // expect 200 and data.authorizeUrl contains oauth.telegram.org
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter backend test auth.controller.spec.ts -t "authorize-url"`
Expected: FAIL (route missing)

**Step 3: Write minimal implementation**

```ts
@Get('telegram/web/authorize-url')
getTelegramWebAuthorizeUrl(...) {
  return this.userAuthService.getTelegramWebAuthorizeUrl(...)
}
```

```ts
getTelegramWebAuthorizeUrl(...) {
  // build state + nonce + redirect + telegram oauth url
  return { authorizeUrl }
}
```

**Step 4: Run test to verify pass**

Run: `pnpm --filter backend test auth.controller.spec.ts -t "authorize-url"`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/modules/auth/auth.controller.ts apps/backend/src/modules/auth/services/user-auth.service.ts apps/backend/src/modules/auth/dto/requests/get-telegram-web-authorize-url.request.dto.ts apps/backend/src/modules/auth/dto/responses/get-telegram-web-authorize-url.response.dto.ts
git commit -m "feat: add telegram web authorize-url endpoint"
```

### Task 5: Verify callback compatibility and regression tests

**Files:**
- Modify: `apps/front/src/app/[lng]/auth/telegram/callback/page.tsx` (only if needed)
- Modify: `apps/front/src/features/auth/auth-provider.tsx` (only if needed)
- Test: existing callback page tests / auth integration tests

**Step 1: Add failing regression test**

```tsx
it('completes login from web callback payload without extra manual action', async () => {
  // mount callback page with source=web params
  // expect login exchange called and redirect executed
})
```

**Step 2: Run test to verify fail (if behavior differs)**

Run: `pnpm --filter front test telegram-callback.test.tsx`
Expected: FAIL if incompatibility exists; otherwise skip implementation and keep existing flow.

**Step 3: Minimal fix (only if required)**

```tsx
// keep existing logic; adapt only parameter parsing if authorize-url flow changes field names
```

**Step 4: Run affected tests**

Run: `pnpm --filter front test telegram-callback.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/app/[lng]/auth/telegram/callback/page.tsx apps/front/src/features/auth/auth-provider.tsx
git commit -m "fix: preserve telegram web callback auto-login flow"
```

### Task 6: Integration verification, i18n text, and docs sync

**Files:**
- Modify: `apps/front/public/locales/zh/common.json`
- Modify: `apps/front/public/locales/en/common.json`
- Modify: `docs/plans/2026-03-03-telegram-web-login-design.md` (if behavior refined)

**Step 1: Add/adjust text keys**

```json
"auth": {
  "telegramWeb": "Telegram 网页版",
  "telegramWebUnavailable": "Telegram 网页登录暂不可用，请稍后重试"
}
```

**Step 2: Run validation**

Run: `pnpm --filter front lint`
Expected: PASS

**Step 3: End-to-end manual check**

Run:
- `dx start backend --dev`
- `dx start front --dev`
- 手动验证登录页左右按钮样式一致
- 点击左侧按钮验证跳转 Telegram 授权链路

Expected:
- 左侧不再出现官方蓝色 widget
- 流程正常回调并自动登录（在有效配置前提下）

**Step 4: Final verification**

Run: `dx lint && dx test e2e backend`
Expected: PASS（或记录未通过项与原因）

**Step 5: Commit**

```bash
git add apps/front/public/locales/zh/common.json apps/front/public/locales/en/common.json docs/plans/2026-03-03-telegram-web-login-design.md
git commit -m "docs: finalize telegram web login redesign and validation"
```
