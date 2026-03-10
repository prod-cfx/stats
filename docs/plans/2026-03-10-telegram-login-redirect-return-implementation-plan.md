# Telegram 登录 redirect 回跳修复 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 Telegram Web/Desktop 登录链路中的 `redirect` 透传缺失，确保登录成功后回到用户登录前页面，并在非法/缺失时兜底到 `/${lng}/account`。

**Architecture:** 保留现有 callback 解析与登录流程，只在“参数传递层”补齐 `redirect`。在 API 请求层和 Auth 类型层增加可选 `redirect`，按钮组件负责透传，回调解析层继续统一做站内路径校验和兜底。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Jest (@jest/globals), 现有 auth API 封装。

---

### Task 1: 回调解析层补充 redirect 安全测试

**Files:**
- Modify: `apps/front/src/features/auth/telegram-callback-params.test.ts`
- Test: `apps/front/src/features/auth/telegram-callback-params.test.ts`

**Step 1: Write the failing test**

在 `resolveTelegramCallbackPayload` 用例集中新增 3 个测试：

```ts
it('应保留站内 redirect', () => {
  const query = new URLSearchParams('redirect=/zh/ai-quant')
  const result = resolveTelegramCallbackPayload({ query, hash: '#id=1&auth_date=2&hash=3', lng: 'zh' })
  expect(result.redirect).toBe('/zh/ai-quant')
})

it('当 redirect 为外链时应回退到账户页', () => {
  const query = new URLSearchParams('redirect=https://evil.com')
  const result = resolveTelegramCallbackPayload({ query, hash: '#id=1&auth_date=2&hash=3', lng: 'zh' })
  expect(result.redirect).toBe('/zh/account')
})

it('当 redirect 缺失时应回退到账户页', () => {
  const query = new URLSearchParams('')
  const result = resolveTelegramCallbackPayload({ query, hash: '#id=1&auth_date=2&hash=3', lng: 'en' })
  expect(result.redirect).toBe('/en/account')
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/front exec jest apps/front/src/features/auth/telegram-callback-params.test.ts --runInBand`

Expected: 至少 1 条 `redirect` 相关用例失败（若实现已满足则此步记录为“先验通过”）。

**Step 3: Write minimal implementation (if needed)**

仅在必要时调整：
- `apps/front/src/features/auth/telegram-callback-params.ts`

确保 `normalizeRedirect` 明确拒绝非站内路径。

```ts
function normalizeRedirect(value: string | null, lng: string) {
  if (!value) return `/${lng}/account`
  return value.startsWith('/') ? value : `/${lng}/account`
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai/front exec jest apps/front/src/features/auth/telegram-callback-params.test.ts --runInBand`

Expected: PASS。

**Step 5: Commit**

```bash
git add apps/front/src/features/auth/telegram-callback-params.test.ts apps/front/src/features/auth/telegram-callback-params.ts
git commit -m "test(auth): add redirect fallback tests for telegram callback"
```

### Task 2: 补齐 API/Auth 类型中的 redirect 透传契约

**Files:**
- Modify: `apps/front/src/features/auth/api.ts`
- Modify: `apps/front/src/features/auth/types.ts`
- Modify: `apps/front/src/features/auth/auth-provider.tsx`
- Test: `apps/front/src/features/auth/telegram-callback-params.test.ts`（回归）

**Step 1: Write the failing type assertion/test**

在按钮组件测试（Task 3 会新增）前，先在本任务内添加一个简单编译断言注释（可放在测试文件顶部）说明 `redirect` 应为可选字段，避免未来回归。

```ts
// compile contract: createTelegramDesktopIntent payload supports optional redirect
```

**Step 2: Run targeted check to verify it fails (before fix)**

Run: `pnpm --filter @ai/front run type-check`

Expected: 在当前实现下，可能出现 `redirect does not exist`（若已修复过则记录为“先验通过”）。

**Step 3: Write minimal implementation**

更新签名与请求参数构造：

```ts
// types.ts
createTelegramDesktopIntent: (payload: {
  intent: 'login' | 'bind'
  lng: 'zh' | 'en'
  redirect?: string
}) => Promise<...>

// api.ts
export async function createTelegramDesktopIntentRequest(payload: {
  intent: TelegramDesktopIntentKind
  lng: 'zh' | 'en'
  redirect?: string
}) { ... }

export async function getTelegramWebAuthorizeUrlRequest(payload: {
  intent: 'login' | 'bind'
  lng: 'zh' | 'en'
  redirect?: string
}) {
  const query = new URLSearchParams({ intent: payload.intent, lng: payload.lng })
  if (payload.redirect) query.set('redirect', payload.redirect)
  return getJson(`/auth/telegram/web/authorize-url?${query.toString()}`)
}
```

`auth-provider.tsx` 的 `createTelegramDesktopIntent` useCallback 类型也同步放开 `redirect?: string`。

**Step 4: Run validation**

Run:
- `pnpm --filter @ai/front exec jest apps/front/src/features/auth/telegram-callback-params.test.ts --runInBand`

Expected: PASS。

**Step 5: Commit**

```bash
git add apps/front/src/features/auth/api.ts apps/front/src/features/auth/types.ts apps/front/src/features/auth/auth-provider.tsx
git commit -m "refactor(auth): extend telegram intent/api contract with redirect"
```

### Task 3: 按钮组件透传 redirect 到 Web/Desktop 登录链路

**Files:**
- Create: `apps/front/src/features/auth/components/telegram-login-buttons.test.tsx`
- Modify: `apps/front/src/features/auth/components/telegram-login-buttons.tsx`
- Test: `apps/front/src/features/auth/components/telegram-login-buttons.test.tsx`

**Step 1: Write the failing test**

新增组件测试，mock `getTelegramWebAuthorizeUrlRequest` 与 `useAuth().createTelegramDesktopIntent`，断言调用参数包含 `redirect`：

```ts
expect(getTelegramWebAuthorizeUrlRequest).toHaveBeenCalledWith({
  intent: 'login',
  lng: 'zh',
  redirect: '/zh/ai-quant',
})

expect(createTelegramDesktopIntent).toHaveBeenCalledWith({
  intent: 'login',
  lng: 'zh',
  redirect: '/zh/ai-quant',
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/front exec jest apps/front/src/features/auth/components/telegram-login-buttons.test.tsx --runInBand`

Expected: FAIL（参数不含 redirect）。

**Step 3: Write minimal implementation**

在 `telegram-login-buttons.tsx` 中：
- 解构 `redirect`。
- Web 按钮请求改为：

```ts
await getTelegramWebAuthorizeUrlRequest({ intent, lng, redirect })
```

- Desktop intent 请求改为：

```ts
await createTelegramDesktopIntent({ intent, lng, redirect })
```

**Step 4: Run test to verify it passes**

Run:
- `pnpm --filter @ai/front exec jest apps/front/src/features/auth/components/telegram-login-buttons.test.tsx --runInBand`
- `pnpm --filter @ai/front exec jest apps/front/src/features/auth/telegram-callback-params.test.ts --runInBand`

Expected: PASS。

**Step 5: Commit**

```bash
git add apps/front/src/features/auth/components/telegram-login-buttons.tsx apps/front/src/features/auth/components/telegram-login-buttons.test.tsx
git commit -m "fix(auth): pass redirect through telegram web and desktop login flows"
```

### Task 4: 端到端手工冒烟与 PR 更新

**Files:**
- Modify: PR 描述（GitHub）

**Step 1: Manual smoke checklist**

- 访问 `/${lng}/auth/login?redirect=/${lng}/ai-quant`，执行 Telegram 登录，确认最终落在 `/${lng}/ai-quant`。
- 访问 `/${lng}/auth/login?redirect=https://evil.com`，执行登录，确认最终落在 `/${lng}/account`。
- 不带 redirect 登录，确认最终落在 `/${lng}/account`。

**Step 2: Record results**

将结果写入 PR comment：

```text
验证项：
- redirect 回跳（合法）: PASS
- redirect 非法兜底: PASS
- redirect 缺失兜底: PASS
```

**Step 3: Push and update PR**

Run:

```bash
git push -u origin HEAD
```

Expected: PR #423 自动更新。

**Step 4: Final verification command**

Run: `/pr-review-loop --pr 423`

Expected: 无新增高优阻断问题。
