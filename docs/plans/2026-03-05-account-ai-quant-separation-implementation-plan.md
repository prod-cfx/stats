# Account/AI Quant Separation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将用户中心中的账号设置与 AI量化内容解耦，通过“右上角下拉 + 账号页双 Tab”实现清晰分区。

**Architecture:** 保持 `/{lng}/account` 为统一容器路由，使用 `tab` query 驱动面板切换。导航层将登录用户入口改为下拉菜单，分别指向 `settings` 和 `ai-quant` 视图。

**Tech Stack:** Next.js App Router、React 19、TypeScript、现有 Coinflux 样式变量与组件。

---

### Task 1: 账号页引入 Tab 状态模型

**Files:**
- Modify: `apps/front/src/app/[lng]/account/page.tsx`
- Create: `apps/front/src/components/account/AccountTabs.tsx`
- Test: `apps/front/src/components/account/AccountTabs.test.tsx`

**Step 1: Write the failing test**
```tsx
it('defaults to settings tab when query is missing', () => {
  expect(screen.getByText('账号设置')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test AccountTabs.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
const tab = searchParams.get('tab') === 'ai-quant' ? 'ai-quant' : 'settings'
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test AccountTabs.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/app/[lng]/account/page.tsx apps/front/src/components/account/AccountTabs.tsx apps/front/src/components/account/AccountTabs.test.tsx
git commit -m "feat: add account tab state model"
```

### Task 2: 分离账号设置与 AI量化面板

**Files:**
- Modify: `apps/front/src/app/[lng]/account/page.tsx`
- Create: `apps/front/src/components/account/AccountSettingsPanel.tsx`
- Create: `apps/front/src/components/account/AccountAiQuantPanel.tsx`
- Test: `apps/front/src/components/account/AccountPanels.test.tsx`

**Step 1: Write the failing test**
```tsx
it('shows only ai-quant content when tab=ai-quant', () => {
  expect(screen.queryByText('账号信息')).not.toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test AccountPanels.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
{tab === 'settings' ? <AccountSettingsPanel /> : <AccountAiQuantPanel />}
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test AccountPanels.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/app/[lng]/account/page.tsx apps/front/src/components/account/AccountSettingsPanel.tsx apps/front/src/components/account/AccountAiQuantPanel.tsx apps/front/src/components/account/AccountPanels.test.tsx
git commit -m "feat: separate account settings and ai-quant panels"
```

### Task 3: 右上角用户入口改为下拉菜单

**Files:**
- Modify: `apps/front/src/components/layout/Navbar.tsx`
- Create: `apps/front/src/components/layout/AccountDropdown.tsx`
- Test: `apps/front/src/components/layout/AccountDropdown.test.tsx`

**Step 1: Write the failing test**
```tsx
it('shows dropdown menu with settings and ai-quant entries', () => {
  expect(screen.getByText('AI量化')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test AccountDropdown.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
<Link href={withLng('/account?tab=settings')}>账号设置</Link>
<Link href={withLng('/account?tab=ai-quant')}>AI量化</Link>
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test AccountDropdown.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/components/layout/Navbar.tsx apps/front/src/components/layout/AccountDropdown.tsx apps/front/src/components/layout/AccountDropdown.test.tsx
git commit -m "feat: replace account actions with dropdown menu"
```

### Task 4: URL 容错与非法 tab 回退

**Files:**
- Modify: `apps/front/src/app/[lng]/account/page.tsx`
- Test: `apps/front/src/app/[lng]/account/account-page-tab.guard.test.tsx`

**Step 1: Write the failing test**
```tsx
it('falls back to settings for invalid tab values', () => {
  expect(screen.getByTestId('tab-settings-active')).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test account-page-tab.guard.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
const safeTab = tabParam === 'ai-quant' ? 'ai-quant' : 'settings'
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test account-page-tab.guard.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/app/[lng]/account/page.tsx apps/front/src/app/[lng]/account/account-page-tab.guard.test.tsx
git commit -m "fix: guard account tab query param"
```

### Task 5: 样式一致性回归与构建验证

**Files:**
- Modify: `apps/front/src/components/layout/AccountDropdown.tsx`
- Modify: `apps/front/src/components/account/*.tsx`
- Test: `apps/front/src/components/account/*.test.tsx`

**Step 1: Verify class/style consistency**
Run: `rg -n "cf-|var\(--cf-|from-primary|to-secondary" apps/front/src/components/account apps/front/src/components/layout/AccountDropdown.tsx`
Expected: consistent Coinflux style token usage

**Step 2: Run build gate**
Run: `dx build front --dev`
Expected: PASS

**Step 3: Optional lint**
Run: `dx lint`
Expected: PASS

**Step 4: Final commit**
```bash
git add apps/front/src/components apps/front/src/app/[lng]/account
git commit -m "chore: finalize account and ai-quant separation ui"
```

---

## Execution Notes
- 保持 UI 与 Coinflux 现有风格一致，不新增主题。
- 避免将 AI 相关内容继续混入 settings 面板。
- 提交前至少完成 `dx build front --dev` 验证。
