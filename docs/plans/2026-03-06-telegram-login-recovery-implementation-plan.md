# Telegram 登录恢复（生产优先）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复生产 Telegram 登录（网页 + 桌面）并建立可观测性，满足上线验收标准。

**Architecture:** 采用双轨方案：先完成生产配置修复与验证，再发布代码修复。前端扩展回调参数解析以支持 `#tgAuthResult`；后端补充 Telegram 健康检查接口与结构化日志，确保故障可定位。每个功能改动遵循 TDD（先失败测试，再最小实现，再回归验证）。

**Tech Stack:** Next.js/React（front）、NestJS（backend）、Jest、dx 命令系统、Telegram Bot API。

---

### Task 1: 生产配置修复与基线验证

**Files:**
- Create: `docs/runbooks/telegram-production-checklist.md`
- Modify: `docs/plans/2026-03-06-telegram-login-recovery-design.md`

**Step 1: 编写生产修复 checklist 文档**

```md
- 校验 getMe
- setWebhook + secret_token
- BotFather /setdomain
- getWebhookInfo 验收
```

**Step 2: 验证 token（运行命令）**

Run: `curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | jq`
Expected: `ok=true`

**Step 3: 重设 webhook（运行命令）**

Run: `curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" -d "url=${BACKEND_WEBHOOK_URL}" -d "secret_token=${TELEGRAM_BOT_WEBHOOK_SECRET}" | jq`
Expected: `ok=true`

**Step 4: 验证 webhook 信息（运行命令）**

Run: `curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq`
Expected: `url` 匹配生产后端，且无近期错误

**Step 5: Commit**

```bash
git add docs/runbooks/telegram-production-checklist.md docs/plans/2026-03-06-telegram-login-recovery-design.md
git commit -m "docs: add telegram production recovery checklist"
```

### Task 2: 前端 `tgAuthResult` 解析（TDD）

**Files:**
- Modify: `apps/front/src/features/auth/telegram-callback-params.ts`
- Test: `apps/front/src/features/auth/telegram-callback-params.test.ts`

**Step 1: 写失败测试（tgAuthResult base64 json）**

```ts
it('should parse payload from #tgAuthResult', () => {
  const encoded = '<base64-json>'
  const result = resolveTelegramCallbackPayload({ query: new URLSearchParams('source=web'), hash: `#tgAuthResult=${encoded}` })
  expect(result.payload.telegramId).toBe('1110614274')
})
```

**Step 2: 跑测试确认失败**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/features/auth/telegram-callback-params.test.ts`
Expected: FAIL（无法从 tgAuthResult 提取 id）

**Step 3: 最小实现解析逻辑**

```ts
// 解析 hash 中 tgAuthResult，支持 base64/base64url
```

**Step 4: 跑测试确认通过**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/features/auth/telegram-callback-params.test.ts`
Expected: PASS

**Step 5: 补充边界测试并回归**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/features/auth/telegram-callback-params.test.ts`
Expected: PASS（含 query/hash/tgAuthResult 优先级）

**Step 6: Commit**

```bash
git add apps/front/src/features/auth/telegram-callback-params.ts apps/front/src/features/auth/telegram-callback-params.test.ts
git commit -m "fix(front): support tgAuthResult callback payload"
```

### Task 3: 后端 Telegram 健康检查接口（TDD）

**Files:**
- Modify: `apps/backend/src/modules/auth/auth.controller.ts`
- Modify: `apps/backend/src/modules/auth/services/user-auth.service.ts`
- Create: `apps/backend/src/modules/auth/dto/responses/telegram-health.response.dto.ts`
- Test: `apps/backend/src/modules/auth/services/user-auth.service.spec.ts`（或就近 auth spec）

**Step 1: 写失败测试（health 返回字段）**

```ts
it('returns telegram health summary without leaking token', async () => {
  const result = await service.getTelegramHealth()
  expect(result).toHaveProperty('botConfigured')
  expect(result).not.toHaveProperty('token')
})
```

**Step 2: 跑测试确认失败**

Run: `dx test e2e backend <auth-related-test-file>` 或对应单测命令
Expected: FAIL（方法/接口不存在）

**Step 3: 实现最小健康检查**

```ts
// 返回 botConfigured/botNameResolved/webhookConfigured/webhookUrlMatch/lastWebhookError
```

**Step 4: 跑测试确认通过**

Run: `dx test e2e backend <auth-related-test-file>` 或对应单测命令
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/modules/auth/auth.controller.ts apps/backend/src/modules/auth/services/user-auth.service.ts apps/backend/src/modules/auth/dto/responses/telegram-health.response.dto.ts
git commit -m "feat(backend): add telegram health check endpoint"
```

### Task 4: 后端结构化日志增强

**Files:**
- Modify: `apps/backend/src/modules/auth/services/user-auth.service.ts`
- Test: `apps/backend/src/modules/auth/services/user-auth.service.spec.ts`（补日志分支断言）

**Step 1: 写失败测试（错误分类标签）**

```ts
it('logs TOKEN_INVALID classification when telegram token is invalid', async () => {
  // mock logger, assert classification tag
})
```

**Step 2: 跑测试确认失败**

Run: `dx test e2e backend <auth-related-test-file>` 或对应单测命令
Expected: FAIL

**Step 3: 最小实现日志分类**

```ts
// TOKEN_INVALID / WEBHOOK_NOT_TRIGGERED / PAYLOAD_PARSE_FAILED / SIGNATURE_INVALID
```

**Step 4: 跑测试确认通过**

Run: `dx test e2e backend <auth-related-test-file>` 或对应单测命令
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/modules/auth/services/user-auth.service.ts
git commit -m "chore(backend): add structured telegram auth diagnostics"
```

### Task 5: 全量验证与上线验收

**Files:**
- Modify: `docs/runbooks/telegram-production-checklist.md`

**Step 1: 本地静态验证**

Run: `dx lint`
Expected: PASS

**Step 2: 前端构建验证**

Run: `dx build front --prod`
Expected: PASS

**Step 3: 后端构建验证**

Run: `dx build backend --prod`
Expected: PASS

**Step 4: 生产冒烟（人工执行）**

Run:
- 网页登录一轮
- 桌面登录一轮
Expected:
- 均成功进入账户页
- 不出现“缺少 Telegram 授权参数”

**Step 5: Commit（文档回填）**

```bash
git add docs/runbooks/telegram-production-checklist.md
git commit -m "docs: record telegram production verification results"
```
