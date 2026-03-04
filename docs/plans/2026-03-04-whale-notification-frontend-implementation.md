# Whale Monitoring Frontend Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align existing whale-notification frontend to the new whale-monitoring product wording and behavior: monitor-only IA, login guard, and Hyperbot-like two-section monitoring page.

**Architecture:** Reuse the current `whale-notification` feature module but refactor page composition from tabbed rules/inbox into two monitor sections (`ADDRESS` and `SYMBOL`). Centralize login guard for all monitor-create actions. Keep route stable and UI tokens consistent with existing Coinflux components.

**Tech Stack:** Next.js App Router, React, TypeScript, existing Coinflux UI components, i18n JSON (`zh/en`), toast utility.

---

### Task 1: Update wording to monitoring terminology

**Files:**
- Modify: `apps/front/public/locales/zh/common.json`
- Modify: `apps/front/public/locales/en/common.json`

**Step 1: Write failing assertion checklist**
- Navbar whale submenu still shows `通知管理`.
- Page title still shows `巨鲸通知管理`.

**Step 2: Implement minimal wording updates**
- Change submenu label to `监控` / `Monitoring`.
- Change page title to `巨鲸监控` / `Whale Monitoring`.
- Keep existing keys when possible to minimize impact.

**Step 3: Validate JSON format**
Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('apps/front/public/locales/zh/common.json','utf8')); JSON.parse(require('fs').readFileSync('apps/front/public/locales/en/common.json','utf8')); console.log('ok')"
```
Expected: `ok`.

**Step 4: Commit**
```bash
git add apps/front/public/locales/zh/common.json apps/front/public/locales/en/common.json
git commit -m "refactor(front): rename whale notification wording to monitoring"
```

### Task 2: Add centralized login guard for monitor creation

**Files:**
- Create: `apps/front/src/features/whale-notification/guards/monitor-auth-guard.ts`
- Modify: `apps/front/src/features/whale-notification/components/CreateMonitorModal.tsx`
- Modify: `apps/front/src/components/whale-tracking/realtime/RealtimeWhalesTable.tsx`
- Modify: `apps/front/src/app/[lng]/whale-tracking/profile/ProfileClient.tsx`
- Modify: `apps/front/src/components/whale-tracking/notifications/NotificationsClient.tsx`

**Step 1: Write failing behavior checklist**
- Unauthenticated user can still open/submit monitor creation flow.

**Step 2: Implement guard utility**
- Add helper returning boolean based on token.
- On failure, show toast only:
  - zh: `请先登录后使用监控功能`
  - en: `Please log in to use monitoring features`

**Step 3: Wire guard into all create entries**
- Profile `一键监控`.
- Realtime `关注币种推送`.
- Monitoring page `创建监控`.

**Step 4: Verify behavior manually**
- Clear token and click each entry, confirm toast only.
- Restore token and confirm normal creation flow.

**Step 5: Commit**
```bash
git add apps/front/src/features/whale-notification/guards/monitor-auth-guard.ts apps/front/src/features/whale-notification/components/CreateMonitorModal.tsx apps/front/src/components/whale-tracking/realtime/RealtimeWhalesTable.tsx apps/front/src/app/[lng]/whale-tracking/profile/ProfileClient.tsx apps/front/src/components/whale-tracking/notifications/NotificationsClient.tsx
git commit -m "feat(front): guard monitor creation when user is not authenticated"
```

### Task 3: Refactor monitoring page from tabs to two sections

**Files:**
- Modify: `apps/front/src/components/whale-tracking/notifications/NotificationsClient.tsx`
- Modify: `apps/front/src/components/whale-tracking/notifications/RulesTab.tsx`
- Modify: `apps/front/src/components/whale-tracking/notifications/InboxTab.tsx` (remove usage or deprecate)
- Create: `apps/front/src/components/whale-tracking/notifications/AddressMonitorSection.tsx`
- Create: `apps/front/src/components/whale-tracking/notifications/RealtimeWhaleMonitorSection.tsx`

**Step 1: Write failing behavior checklist**
- Page still renders Rules/Inbox tabs.

**Step 2: Implement two-section layout**
- Render section A: `监控地址 (N)` filtered by `rule.type === 'ADDRESS'`.
- Render section B: `实时巨鲸 (N)` filtered by `rule.type === 'SYMBOL'`.
- Keep row actions: toggle, edit (if exists), delete.

**Step 3: Align visuals with Hyperbot-like panel style using existing Coinflux tokens**
- Dark card container.
- Dense row list.
- Right-side compact actions.

**Step 4: Remove inbox tab entry from monitoring page content**
- Monitoring page shows only two sections.

**Step 5: Commit**
```bash
git add apps/front/src/components/whale-tracking/notifications/NotificationsClient.tsx apps/front/src/components/whale-tracking/notifications/AddressMonitorSection.tsx apps/front/src/components/whale-tracking/notifications/RealtimeWhaleMonitorSection.tsx apps/front/src/components/whale-tracking/notifications/RulesTab.tsx apps/front/src/components/whale-tracking/notifications/InboxTab.tsx
git commit -m "refactor(front): reshape whale monitoring page into address and realtime sections"
```

### Task 4: Navbar and page metadata final alignment

**Files:**
- Modify: `apps/front/src/components/layout/Navbar.tsx`
- Modify: `apps/front/src/app/[lng]/whale-tracking/notifications/page.tsx`

**Step 1: Verify menu label and navigation target**
- Whale submenu shows `监控`.
- Route remains `/{lng}/whale-tracking/notifications`.

**Step 2: Verify page title/subtitle**
- `巨鲸监控` and updated subtitle text.

**Step 3: Commit**
```bash
git add apps/front/src/components/layout/Navbar.tsx apps/front/src/app/[lng]/whale-tracking/notifications/page.tsx
git commit -m "chore(front): align whale monitoring navigation and page metadata"
```

### Task 5: Verification and regression checks

**Files:**
- Modify if needed: `apps/front/public/locales/zh/common.json`
- Modify if needed: `apps/front/public/locales/en/common.json`

**Step 1: Lint touched files**
Run:
```bash
pnpm --filter @ai/front exec eslint src/features/whale-notification src/components/whale-tracking/notifications src/components/layout/Navbar.tsx src/components/whale-tracking/realtime/RealtimeWhalesTable.tsx src/app/[lng]/whale-tracking/profile/ProfileClient.tsx src/app/[lng]/whale-tracking/notifications/page.tsx --config ../../eslint.config.js
```
Expected: no errors.

**Step 2: Manual smoke checks (logged-in + not-logged-in)**
Run: `dx start front --dev` (or `next dev` fallback)
Expected:
- Menu text is monitoring wording.
- Monitoring page contains only two blocks.
- Unauthenticated create actions show toast only.
- Authenticated create actions work.

**Step 3: Commit**
```bash
git add -A
git commit -m "test(front): verify whale monitoring wording, layout, and auth guard behavior"
```
