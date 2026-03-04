# Whale Notification Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build whale notification frontend support for two rule types (address, realtime symbol), channel selection, global unread bell, and whale notification center while preserving existing Coinflux UI style.

**Architecture:** Implement a dedicated frontend feature module (`whale-notification`) and integrate it into existing whale pages (realtime/profile) plus navbar. Keep data layer isolated (`api` + `hooks`) and reuse current UI patterns (table/modal/toast). Use incremental delivery with TDD-style checks for each integration point.

**Tech Stack:** Next.js App Router, React, TypeScript, existing Coinflux UI components/styles, i18n JSON (`zh/en`), existing test stack (Jest/RTL where available).

---

### Task 1: Define frontend notification domain types and API wrappers

**Files:**
- Create: `apps/front/src/features/whale-notification/types.ts`
- Create: `apps/front/src/features/whale-notification/api/whale-notification-api.ts`
- Modify: `apps/front/src/lib/api.ts`
- Test: `apps/front/src/features/whale-notification/api/whale-notification-api.test.ts`

**Step 1: Write the failing test**

```ts
it('maps create address rule payload correctly', async () => {
  // expect request body to include type/channel/default threshold
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter front test -- whale-notification-api.test.ts`
Expected: FAIL due to missing module/functions.

**Step 3: Write minimal implementation**

```ts
export async function createWhaleNotificationRule(input: CreateRuleInput) {
  return apiRequest('/whale-notifications/rules', { method: 'POST', body: JSON.stringify(input) })
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter front test -- whale-notification-api.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/front/src/features/whale-notification/types.ts apps/front/src/features/whale-notification/api/whale-notification-api.ts apps/front/src/lib/api.ts apps/front/src/features/whale-notification/api/whale-notification-api.test.ts
git commit -m "feat(front): add whale notification api client and domain types"
```

### Task 2: Build reusable hooks for rules, inbox, and unread count

**Files:**
- Create: `apps/front/src/features/whale-notification/hooks/useWhaleNotificationRules.ts`
- Create: `apps/front/src/features/whale-notification/hooks/useWhaleNotificationInbox.ts`
- Create: `apps/front/src/features/whale-notification/hooks/useWhaleNotificationUnreadCount.ts`
- Test: `apps/front/src/features/whale-notification/hooks/useWhaleNotificationUnreadCount.test.ts`

**Step 1: Write the failing test**

```ts
it('polls unread count and updates value', async () => {
  // mock api, advance timers, assert updated unread count
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter front test -- useWhaleNotificationUnreadCount.test.ts`
Expected: FAIL because hook not implemented.

**Step 3: Write minimal implementation**

```ts
useEffect(() => {
  const id = setInterval(fetchUnread, 30000)
  return () => clearInterval(id)
}, [fetchUnread])
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter front test -- useWhaleNotificationUnreadCount.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/front/src/features/whale-notification/hooks/*
git commit -m "feat(front): add whale notification data hooks"
```

### Task 3: Implement create monitor modal with ADDRESS/SYMBOL modes

**Files:**
- Create: `apps/front/src/features/whale-notification/components/CreateMonitorModal.tsx`
- Create: `apps/front/src/features/whale-notification/components/ChannelToggles.tsx`
- Modify: `apps/front/public/locales/zh/common.json`
- Modify: `apps/front/public/locales/en/common.json`
- Test: `apps/front/src/features/whale-notification/components/CreateMonitorModal.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders address mode with preset address and default threshold 500000', () => {
  // render modal with mode ADDRESS and assert fields/defaults
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter front test -- CreateMonitorModal.test.tsx`
Expected: FAIL due to missing component.

**Step 3: Write minimal implementation**

```tsx
<input value={threshold} onChange={...} defaultValue={500000} />
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter front test -- CreateMonitorModal.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/front/src/features/whale-notification/components/CreateMonitorModal.tsx apps/front/src/features/whale-notification/components/ChannelToggles.tsx apps/front/public/locales/zh/common.json apps/front/public/locales/en/common.json apps/front/src/features/whale-notification/components/CreateMonitorModal.test.tsx
git commit -m "feat(front): add whale notification create monitor modal"
```

### Task 4: Integrate symbol-rule entry in realtime whales page

**Files:**
- Modify: `apps/front/src/components/whale-tracking/realtime/RealtimeWhalesTable.tsx`
- Test: `apps/front/src/components/whale-tracking/realtime/RealtimeWhalesTable.test.tsx`

**Step 1: Write the failing test**

```tsx
it('opens symbol monitor modal from realtime page action', async () => {
  // click button, expect modal visible in SYMBOL mode
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter front test -- RealtimeWhalesTable.test.tsx`
Expected: FAIL because action/modal not wired.

**Step 3: Write minimal implementation**

```tsx
<button onClick={() => setOpenSymbolModal(true)}>关注币种推送</button>
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter front test -- RealtimeWhalesTable.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/front/src/components/whale-tracking/realtime/RealtimeWhalesTable.tsx apps/front/src/components/whale-tracking/realtime/RealtimeWhalesTable.test.tsx
git commit -m "feat(front): add symbol notification entry on realtime whales page"
```

### Task 5: Integrate one-click follow entry in whale profile page

**Files:**
- Modify: `apps/front/src/app/[lng]/whale-tracking/profile/ProfileClient.tsx`
- Create: `apps/front/src/components/whale-tracking/profile/FollowWhaleButton.tsx`
- Test: `apps/front/src/app/[lng]/whale-tracking/profile/ProfileClient.test.tsx`

**Step 1: Write the failing test**

```tsx
it('opens address monitor modal from profile follow button', async () => {
  // render profile with address, click follow, expect ADDRESS mode modal
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter front test -- ProfileClient.test.tsx`
Expected: FAIL due to missing button flow.

**Step 3: Write minimal implementation**

```tsx
<FollowWhaleButton address={address} onClick={openModal} />
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter front test -- ProfileClient.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/front/src/app/[lng]/whale-tracking/profile/ProfileClient.tsx apps/front/src/components/whale-tracking/profile/FollowWhaleButton.tsx apps/front/src/app/[lng]/whale-tracking/profile/ProfileClient.test.tsx
git commit -m "feat(front): add profile one-click follow for whale notifications"
```

### Task 6: Build whale notification management page (Rules + Inbox tabs)

**Files:**
- Create: `apps/front/src/app/[lng]/whale-tracking/notifications/page.tsx`
- Create: `apps/front/src/components/whale-tracking/notifications/NotificationsClient.tsx`
- Create: `apps/front/src/components/whale-tracking/notifications/RulesTab.tsx`
- Create: `apps/front/src/components/whale-tracking/notifications/InboxTab.tsx`
- Test: `apps/front/src/components/whale-tracking/notifications/NotificationsClient.test.tsx`

**Step 1: Write the failing test**

```tsx
it('switches between rules and inbox tabs and loads corresponding content', async () => {
  // assert tab switch behavior and data loading calls
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter front test -- NotificationsClient.test.tsx`
Expected: FAIL because page/components missing.

**Step 3: Write minimal implementation**

```tsx
const [tab, setTab] = useState<'rules' | 'inbox'>('rules')
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter front test -- NotificationsClient.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/front/src/app/[lng]/whale-tracking/notifications/page.tsx apps/front/src/components/whale-tracking/notifications/*
git commit -m "feat(front): add whale notification management page"
```

### Task 7: Add navbar bell unread badge and whale menu link

**Files:**
- Modify: `apps/front/src/components/layout/Navbar.tsx`
- Test: `apps/front/src/components/layout/Navbar.test.tsx`

**Step 1: Write the failing test**

```tsx
it('shows whale notification bell with unread badge and inbox navigation', async () => {
  // assert badge rendering and click navigation
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter front test -- Navbar.test.tsx`
Expected: FAIL since bell integration absent.

**Step 3: Write minimal implementation**

```tsx
<button aria-label="whale-notification-bell" onClick={goInbox}>...</button>
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter front test -- Navbar.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/front/src/components/layout/Navbar.tsx apps/front/src/components/layout/Navbar.test.tsx
git commit -m "feat(front): add whale notification bell and unread badge in navbar"
```

### Task 8: Final verification and regression checks

**Files:**
- Modify: `apps/front/public/locales/zh/common.json`
- Modify: `apps/front/public/locales/en/common.json`
- Modify: `docs/plans/2026-03-04-whale-notification-frontend-design.md` (if wording sync needed)

**Step 1: Run targeted tests**

Run:
```bash
pnpm --filter front test -- whale-notification-api.test.ts
pnpm --filter front test -- useWhaleNotificationUnreadCount.test.ts
pnpm --filter front test -- CreateMonitorModal.test.tsx
pnpm --filter front test -- RealtimeWhalesTable.test.tsx
pnpm --filter front test -- ProfileClient.test.tsx
pnpm --filter front test -- NotificationsClient.test.tsx
pnpm --filter front test -- Navbar.test.tsx
```
Expected: PASS.

**Step 2: Run lint**

Run: `dx lint`
Expected: PASS without new errors.

**Step 3: Build front**

Run: `dx build front --dev`
Expected: SUCCESS.

**Step 4: Manual smoke checks**

Run: `dx start front --dev`
Expected: Frontend runs and flows work in browser:
- Profile follow modal
- Realtime symbol modal
- Rules list/inbox list
- Navbar unread bell

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(front): complete whale notification UI flows and notification center"
```
