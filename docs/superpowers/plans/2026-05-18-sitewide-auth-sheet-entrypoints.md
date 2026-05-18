# Sitewide Auth Sheet Entrypoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make in-site login entry points open the global auth sheet over the current page on desktop and mobile, while keeping `/auth/login` as a fallback route.

**Architecture:** Reuse the existing `AuthSheetProvider/useAuthSheet` API. Convert normal site login links and protected-action redirects into `openAuth({ lng, redirect })` calls. Keep auth callback recovery on `/auth/login` as an explicit fallback.

**Tech Stack:** Next.js App Router, React client components, Jest/jsdom, existing `AuthSheet` and `AuthSheetProvider`.

---

## File Structure

- Modify `apps/front/src/components/layout/Navbar.tsx`
  - Replace unauthenticated login `Link` with button.
  - Use `useAuthSheet`, `useSearchParams`, and `usePathname` to build current-page redirect.
- Modify `apps/front/src/components/layout/Navbar.test.tsx`
  - Mock `useAuthSheet`.
  - Mock `usePathname` and `useSearchParams`.
  - Assert desktop and mobile login open the auth sheet without `/auth/login` links.
- Modify `apps/front/src/app/[lng]/account/AccountPageClient.tsx`
  - Replace unauthenticated auto route to `/auth/login` with auth sheet open.
  - Replace logout redirect to `/auth/login` with auth sheet open or neutral account-root handling after logout.
- Modify `apps/front/src/app/[lng]/account/AccountPageClient.test.tsx`
  - Mock `useAuthSheet`.
  - Assert unauthenticated account access opens auth sheet and does not call `router.replace('/zh/auth/login')`.
  - Assert logout no longer routes to `/auth/login`.
- Modify `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx`
  - Replace `window.location.href` login jump with `openAuth`.
- Modify `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.test.tsx`
  - Mock unauthenticated auth state for one test.
  - Mock `useAuthSheet`.
  - Assert strategy detail redirect is passed to auth sheet.
- Modify `apps/front/src/components/ai-quant/AuthGateCard.tsx`
  - Replace login `Link` with button and `openAuth`.
- Create `apps/front/src/components/ai-quant/AuthGateCard.test.tsx`
  - Assert click calls `openAuth({ lng, redirect: '/zh/ai-quant' })`.
- Do not modify `apps/front/src/app/[lng]/auth/telegram/callback/TelegramCallbackPageClient.tsx`
  - Retain `/auth/login` as callback recovery fallback.

---

### Task 1: Navbar Login Opens Auth Sheet

**Files:**
- Modify: `apps/front/src/components/layout/Navbar.tsx`
- Modify: `apps/front/src/components/layout/Navbar.test.tsx`

- [ ] **Step 1: Write failing tests for desktop and mobile login**

Add mocks near existing `next/navigation` and auth mocks:

```tsx
const mockOpenAuth = jest.fn()
const mockUsePathname = jest.fn(() => '/zh/aggregated-orderbook')
const mockUseSearchParams = jest.fn(() => new URLSearchParams('tab=depth'))

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('@/features/auth/AuthSheetProvider', () => ({
  useAuthSheet: () => ({ openAuth: mockOpenAuth }),
}))
```

Add tests:

```tsx
it('opens auth sheet from desktop login without linking to login page', async () => {
  await act(async () => {
    root.render(<Navbar />)
  })

  const loginButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    button => button.textContent === '登录',
  )
  expect(loginButton).toBeDefined()
  expect(container.querySelector('a[href="/zh/auth/login"]')).toBeNull()

  await act(async () => {
    loginButton?.click()
  })

  expect(mockOpenAuth).toHaveBeenCalledWith({
    lng: 'zh',
    redirect: '/zh/aggregated-orderbook?tab=depth',
  })
})

it('opens auth sheet from mobile menu login and closes the menu', async () => {
  await act(async () => {
    root.render(<Navbar />)
  })

  const mobileMenuButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    button => button.getAttribute('aria-label') === '打开菜单',
  )
  await act(async () => {
    mobileMenuButton?.click()
  })

  const mobileLoginButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    button => button.textContent === '登录',
  )
  await act(async () => {
    mobileLoginButton?.click()
  })

  expect(mockOpenAuth).toHaveBeenCalledWith({
    lng: 'zh',
    redirect: '/zh/aggregated-orderbook?tab=depth',
  })
  expect(container.textContent).not.toContain('上市公司')
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath apps/front/src/components/layout/Navbar.test.tsx --runInBand
```

Expected: FAIL because `useAuthSheet` is unused and the desktop login is still an `/auth/login` link.

- [ ] **Step 3: Implement Navbar auth-sheet trigger**

Update imports:

```tsx
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuthSheet } from '@/features/auth/AuthSheetProvider'
```

Inside `Navbar`:

```tsx
const searchParams = useSearchParams()
const { openAuth } = useAuthSheet()

const currentRedirect = useMemo(() => {
  const path = pathname || `/${currentLng}`
  const query = searchParams?.toString()
  return query ? `${path}?${query}` : path
}, [currentLng, pathname, searchParams])

const openLoginSheet = useCallback(() => {
  setMobileMenuOpen(false)
  setAccountMenuOpen(false)
  openAuth({ lng: currentLng, redirect: currentRedirect })
}, [currentLng, currentRedirect, openAuth])
```

Replace the unauthenticated desktop login `Link` with:

```tsx
<button
  type="button"
  onClick={openLoginSheet}
  className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-secondary px-3 !text-xs !font-semibold !leading-5 whitespace-nowrap !text-white shadow-sm transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:min-h-8"
>
  <LogIn className="h-3.5 w-3.5 !text-white" aria-hidden="true" />
  {t('nav.login')}
</button>
```

Find the mobile-menu login entry if present as a `Link` to `withLng('/auth/login')`; replace it with the same `button` semantics and `onClick={openLoginSheet}`. If no mobile login entry exists, add one at the bottom of the mobile menu when `ENABLE_USER_SYSTEM && !session`.

- [ ] **Step 4: Run Navbar tests**

Run:

```bash
pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath apps/front/src/components/layout/Navbar.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/front/src/components/layout/Navbar.tsx apps/front/src/components/layout/Navbar.test.tsx
git commit -m "feat: open auth sheet from navbar login"
```

---

### Task 2: Protected Account And Strategy Entrypoints

**Files:**
- Modify: `apps/front/src/app/[lng]/account/AccountPageClient.tsx`
- Modify: `apps/front/src/app/[lng]/account/AccountPageClient.test.tsx`
- Modify: `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx`
- Modify: `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.test.tsx`

- [ ] **Step 1: Write failing AccountPageClient tests**

Add:

```tsx
const mockOpenAuth = jest.fn()
```

Add mock:

```tsx
jest.mock('@/features/auth/AuthSheetProvider', () => ({
  useAuthSheet: () => ({ openAuth: mockOpenAuth }),
}))
```

Add reset in `beforeEach`:

```tsx
mockOpenAuth.mockReset()
```

Add test:

```tsx
it('opens auth sheet instead of routing to login when unauthenticated', async () => {
  mockSession = null as unknown as typeof mockSession

  await act(async () => {
    root?.render(<AccountPageClient lng="zh" />)
  })

  expect(mockOpenAuth).toHaveBeenCalledWith({ lng: 'zh', redirect: '/zh/account?tab=settings' })
  expect(mockReplace).not.toHaveBeenCalledWith('/zh/auth/login')
})
```

Add logout test near existing logout coverage:

```tsx
it('does not route to login page after logout', async () => {
  await act(async () => {
    root?.render(<AccountPageClient lng="zh" />)
  })

  const logoutButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    button => button.textContent === 'Logout',
  )

  await act(async () => {
    logoutButton?.click()
  })

  expect(mockLogout).toHaveBeenCalledTimes(1)
  expect(mockReplace).not.toHaveBeenCalledWith('/zh/auth/login')
})
```

- [ ] **Step 2: Write failing StrategyDetailPageClient test**

Make auth mock configurable:

```tsx
const mockOpenAuth = jest.fn()
let mockSession: { userId: string } | null = stableSession

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    session: mockSession,
    isLoading: false,
  }),
}))

jest.mock('@/features/auth/AuthSheetProvider', () => ({
  useAuthSheet: () => ({ openAuth: mockOpenAuth }),
}))
```

Reset:

```tsx
mockOpenAuth.mockReset()
mockSession = stableSession
```

Add test:

```tsx
it('opens auth sheet with strategy redirect when unauthenticated', async () => {
  mockSession = null

  await act(async () => {
    root.render(<StrategyDetailPageClient lng="zh" id="inst-1" />)
  })

  expect(mockOpenAuth).toHaveBeenCalledWith({
    lng: 'zh',
    redirect: '/zh/account/ai-quant/strategy/inst-1',
  })
  expect(mockFetchDetail).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath apps/front/src/app/'[lng]'/account/AccountPageClient.test.tsx apps/front/src/app/'[lng]'/account/ai-quant/strategy/'[id]'/StrategyDetailPageClient.test.tsx --runInBand
```

Expected: FAIL because both components still route to `/auth/login`.

- [ ] **Step 4: Implement account auth sheet behavior**

Update `AccountPageClient.tsx` imports:

```tsx
import { useAuthSheet } from '@/features/auth/AuthSheetProvider'
```

Inside component:

```tsx
const { openAuth } = useAuthSheet()
const accountRedirect = useMemo(() => {
  const query = searchParams?.toString()
  return query ? `/${lng}/account?${query}` : `/${lng}/account`
}, [lng, searchParams])
```

Replace unauthenticated effect:

```tsx
useEffect(() => {
  if (!isLoading && !session) {
    openAuth({ lng, redirect: accountRedirect })
  }
}, [accountRedirect, isLoading, lng, openAuth, session])
```

Replace logout handler:

```tsx
onClick={() => {
  logout()
  router.replace(`/${lng}`)
}}
```

Keep `if (!session) return null` to avoid exposing account UI while the auth sheet is open.

- [ ] **Step 5: Implement strategy detail auth sheet behavior**

Update `StrategyDetailPageClient.tsx` imports:

```tsx
import { useAuthSheet } from '@/features/auth/AuthSheetProvider'
```

Inside component:

```tsx
const { openAuth } = useAuthSheet()
const strategyRedirect = `/${lng}/account/ai-quant/strategy/${id}`
```

Replace unauthenticated effect:

```tsx
useEffect(() => {
  if (!isLoading && !session) {
    openAuth({ lng, redirect: strategyRedirect })
  }
}, [isLoading, lng, openAuth, session, strategyRedirect])
```

Do not call `window.location.href`.

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath apps/front/src/app/'[lng]'/account/AccountPageClient.test.tsx apps/front/src/app/'[lng]'/account/ai-quant/strategy/'[id]'/StrategyDetailPageClient.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/front/src/app/'[lng]'/account/AccountPageClient.tsx apps/front/src/app/'[lng]'/account/AccountPageClient.test.tsx apps/front/src/app/'[lng]'/account/ai-quant/strategy/'[id]'/StrategyDetailPageClient.tsx apps/front/src/app/'[lng]'/account/ai-quant/strategy/'[id]'/StrategyDetailPageClient.test.tsx
git commit -m "feat: open auth sheet for account gates"
```

---

### Task 3: AuthGateCard Opens Auth Sheet

**Files:**
- Modify: `apps/front/src/components/ai-quant/AuthGateCard.tsx`
- Create: `apps/front/src/components/ai-quant/AuthGateCard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `AuthGateCard.test.tsx`:

```tsx
/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthGateCard } from './AuthGateCard'

const mockOpenAuth = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'aiQuant.authGate.description': 'Login required',
      'aiQuant.authGate.login': 'Login',
      'aiQuant.authGate.title': 'Auth required',
    }[key] ?? key),
  }),
}))

jest.mock('@/features/auth/AuthSheetProvider', () => ({
  useAuthSheet: () => ({ openAuth: mockOpenAuth }),
}))

describe('AuthGateCard', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mockOpenAuth.mockReset()
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('opens auth sheet instead of linking to login page', async () => {
    await act(async () => {
      root.render(<AuthGateCard lng="zh" />)
    })

    expect(container.querySelector('a[href="/zh/auth/login"]')).toBeNull()

    const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      item => item.textContent === 'Login',
    )

    await act(async () => {
      button?.click()
    })

    expect(mockOpenAuth).toHaveBeenCalledWith({ lng: 'zh', redirect: '/zh/ai-quant' })
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath apps/front/src/components/ai-quant/AuthGateCard.test.tsx --runInBand
```

Expected: FAIL because `AuthGateCard` still renders an `/auth/login` link.

- [ ] **Step 3: Implement AuthGateCard auth sheet trigger**

Replace `Link` import:

```tsx
import { useAuthSheet } from '@/features/auth/AuthSheetProvider'
```

Inside component:

```tsx
const { openAuth } = useAuthSheet()
```

Replace `Link` with:

```tsx
<button
  type="button"
  onClick={() => openAuth({ lng, redirect: `/${lng}/ai-quant` })}
  className="from-primary to-secondary mt-4 inline-flex rounded-full bg-gradient-to-r px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-white"
>
  {t('aiQuant.authGate.login')}
</button>
```

- [ ] **Step 4: Run test**

Run:

```bash
pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath apps/front/src/components/ai-quant/AuthGateCard.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/front/src/components/ai-quant/AuthGateCard.tsx apps/front/src/components/ai-quant/AuthGateCard.test.tsx
git commit -m "feat: open auth sheet from auth gate card"
```

---

### Task 4: Residual Login Route Classification And Final Verification

**Files:**
- Review only unless tests reveal a required fix:
  - `apps/front/src/app/[lng]/auth/telegram/callback/TelegramCallbackPageClient.tsx`
  - `apps/front/src/app/[lng]/auth/login/LoginPageClient.tsx`
  - migrated files from Tasks 1-3

- [ ] **Step 1: Search production `/auth/login` usage**

Run:

```bash
rg 'auth/login\\?redirect|/auth/login' apps/front/src -n --glob '*.tsx' --glob '!*.test.tsx'
```

Expected remaining production hits:

```text
apps/front/src/app/[lng]/auth/telegram/callback/TelegramCallbackPageClient.tsx:... router.replace(`/${lng}/auth/login`)
```

If `Navbar`, `AccountPageClient`, `StrategyDetailPageClient`, or `AuthGateCard` still appear, fix them before continuing.

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath \
  apps/front/src/components/layout/Navbar.test.tsx \
  apps/front/src/app/'[lng]'/account/AccountPageClient.test.tsx \
  apps/front/src/app/'[lng]'/account/ai-quant/strategy/'[id]'/StrategyDetailPageClient.test.tsx \
  apps/front/src/components/ai-quant/AuthGateCard.test.tsx \
  apps/front/src/features/auth/components/AuthSheet.test.tsx \
  apps/front/src/features/auth/AuthSheetProvider.test.tsx \
  apps/front/src/app/'[lng]'/auth/login/LoginPageClient.test.tsx \
  apps/front/src/app/'[lng]'/ai-quant/AiQuantPageClient.test.tsx \
  apps/front/src/app/'[lng]'/ai-quant/plaza/PlazaPageClient.test.tsx \
  --runInBand
```

Expected: all suites PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
dx lint
```

Expected: command exits 0.

- [ ] **Step 4: Optional browser smoke check if local stack is running**

Open:

```text
http://localhost:3001/zh/aggregated-orderbook
```

Manual checks:

- Desktop viewport: click Navbar login, confirm centered login dialog appears over `/zh/aggregated-orderbook`.
- Mobile viewport: click Navbar/mobile-menu login, confirm bottom sheet appears over `/zh/aggregated-orderbook`.
- Close sheet, confirm URL remains `/zh/aggregated-orderbook`.
- Direct visit `http://localhost:3001/zh/auth/login` still renders fallback login page.

- [ ] **Step 5: Commit any verification-only fixes**

If Step 1-3 required fixes:

```bash
git add <changed-files>
git commit -m "fix: classify auth login fallbacks"
```

If no files changed, do not create an empty commit.

---

## Self-Review

- Spec coverage: Navbar, AccountPageClient, StrategyDetailPageClient, AuthGateCard, `/auth/login` fallback, AI Quant/Plaza regression checks, and Telegram callback fallback are covered.
- Placeholder scan: no `TBD`, `TODO`, or open-ended implementation steps remain.
- Type consistency: all planned calls use existing `openAuth({ lng, redirect })` from `AuthSheetProvider`.
