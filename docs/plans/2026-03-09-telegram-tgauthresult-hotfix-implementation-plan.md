# Telegram tgAuthResult Production Hotfix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复生产 Telegram 网页登录在 `#tgAuthResult` 回调格式下的“缺少授权参数”错误，恢复登录成功率。

**Architecture:** 仅修改前端回调参数解析层，新增 `tgAuthResult`（base64/base64url JSON）解码与字段映射，不改后端接口。保持现有优先级 `query > hash kv > tgAuthResult`，通过测试保证兼容与回退行为。

**Tech Stack:** Next.js/TypeScript、Jest（apps/front）

---

### Task 1: 扩展回调解析单测（TDD 先红）

**Files:**
- Test: `apps/front/src/features/auth/telegram-callback-params.test.ts`

**Step 1: 写失败测试（tgAuthResult base64）**

```ts
it('parses payload from tgAuthResult base64 hash', () => {
  const payload = {
    id: 1110614274,
    auth_date: 1773023842,
    hash: 'h123',
    first_name: 'lisa',
    username: 'TON_future_value',
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64').replace(/=+$/, '')
  const result = resolveTelegramCallbackPayload({
    query: new URLSearchParams('source=web&intent=login'),
    hash: `#tgAuthResult=${encoded}`,
    lng: 'zh',
  })
  expect(result.payload.telegramId).toBe('1110614274')
  expect(result.payload.authDate).toBe('1773023842')
  expect(result.payload.hash).toBe('h123')
})
```

**Step 2: 写失败测试（base64url）**

```ts
it('parses payload from tgAuthResult base64url hash', () => {
  const encoded = '...' // 由 base64 替换 +/ 为 -_ 并去掉 =
  const result = resolveTelegramCallbackPayload({
    query: new URLSearchParams('source=web&intent=login'),
    hash: `#tgAuthResult=${encoded}`,
    lng: 'zh',
  })
  expect(result.payload.telegramId).toBe('1110614274')
})
```

**Step 3: 写优先级测试（query 优先于 tgAuthResult）**

```ts
it('keeps query params priority over tgAuthResult payload', () => {
  const result = resolveTelegramCallbackPayload({
    query: new URLSearchParams('source=web&intent=login&id=from_query&auth_date=1&hash=qhash'),
    hash: '#tgAuthResult=<encoded_with_different_values>',
    lng: 'zh',
  })
  expect(result.payload.telegramId).toBe('from_query')
  expect(result.payload.hash).toBe('qhash')
})
```

**Step 4: 写容错测试（非法 tgAuthResult）**

```ts
it('does not throw on invalid tgAuthResult', () => {
  expect(() =>
    resolveTelegramCallbackPayload({
      query: new URLSearchParams('source=web&intent=login'),
      hash: '#tgAuthResult=%%%invalid%%%',
      lng: 'zh',
    }),
  ).not.toThrow()
})
```

**Step 5: 跑测试确认失败**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/features/auth/telegram-callback-params.test.ts`
Expected: FAIL（尚未支持 tgAuthResult）

**Step 6: Commit**

```bash
git add apps/front/src/features/auth/telegram-callback-params.test.ts
git commit -m "test(front): add tgAuthResult callback parsing tests\n\nRefs: #398"
```

### Task 2: 最小实现 tgAuthResult 解析（TDD 转绿）

**Files:**
- Modify: `apps/front/src/features/auth/telegram-callback-params.ts`
- Test: `apps/front/src/features/auth/telegram-callback-params.test.ts`

**Step 1: 新增安全解码 helper（base64 + base64url）**

```ts
function decodeBase64UrlSafe(input: string): string | null {
  // 统一 -_ 到 +/，补齐 padding，失败返回 null
}
```

**Step 2: 新增 tgAuthResult 解析 helper**

```ts
function parseTgAuthResult(hashParams: URLSearchParams): Partial<...> {
  // 读取 tgAuthResult，JSON.parse，映射 id/auth_date/hash/first_name...
}
```

**Step 3: 在 payload 组装处按优先级补位**

```ts
telegramId: pickParam(...) || tgAuthPayload.id || ''
```

**Step 4: 跑测试确认通过**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/features/auth/telegram-callback-params.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/features/auth/telegram-callback-params.ts apps/front/src/features/auth/telegram-callback-params.test.ts
git commit -m "fix(front): support tgAuthResult callback payload parsing\n\nRefs: #398"
```

### Task 3: 回归验证与发布前检查

**Files:**
- Modify: `docs/plans/2026-03-09-telegram-tgauthresult-hotfix-design.md`（可选：补验收结果）

**Step 1: 本地回归相关测试**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/features/auth/telegram-callback-params.test.ts`
Expected: PASS

**Step 2: 生产回调格式手工验收（预发/生产）**

Run: 使用真实回调 URL 模式验证：
`/auth/telegram/callback?source=web&intent=login#tgAuthResult=...`
Expected: 页面进入登录成功流程，不再出现“缺少 Telegram 授权参数”

**Step 3: 发布后观测**

Run: 观察前端错误监控 + `/auth/telegram/exchange` 失败率（30 分钟）
Expected: 错误率显著下降

**Step 4: Commit（可选，若补文档）**

```bash
git add docs/plans/2026-03-09-telegram-tgauthresult-hotfix-design.md
git commit -m "docs: record tgAuthResult hotfix validation\n\nRefs: #398"
```

### Task 4: 代码评审与收口

**Files:**
- No code changes required

**Step 1: 发起评审（推荐）**
Run: 使用 `@requesting-code-review` 技能进行快速评审清单
Expected: 无阻塞问题

**Step 2: 收口决策**
Run: 使用 `@finishing-a-development-branch` 技能决定 merge/PR 路径
Expected: 产出可执行的发布收口动作
