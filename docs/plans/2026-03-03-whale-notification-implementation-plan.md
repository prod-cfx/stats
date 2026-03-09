# Whale Notification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为用户提供“自选巨鲸地址开单”的规则化多渠道通知（站内/浏览器/邮箱/TG），包含两层阈值与冷却去重。

**Architecture:** 新增后端 `whale-notification` 模块作为独立边界：规则管理 API、事件匹配、去重、渠道分发、投递日志。前端新增规则管理与通知中心，实时巨鲸列表增加“一键关注”。复用现有 `MailService` 与 Telegram Bot 能力，保证单渠道失败不影响其他渠道。

**Tech Stack:** NestJS 11 + Prisma 7 + PostgreSQL + Next.js + React + Nx + dx

---

### Task 1: Prisma 模型与迁移

**Files:**
- Modify: `apps/backend/prisma/schema/market_data.prisma`
- Create: `apps/backend/prisma/schema/migrations/<timestamp>_add_whale_notification_tables/migration.sql`

**Step 1: Write the failing test**
- 先写一个简单仓储单测骨架，假设新表已存在（查询失败即为红灯）。

**Step 2: Run test to verify it fails**
- Run: `dx test e2e backend apps/backend/e2e/whale-notification-rules.e2e-spec.ts -t "should create rule"`
- Expected: FAIL（表不存在或接口不存在）。

**Step 3: Write minimal implementation**
- 新增 4 张表：`whale_notification_rules`、`whale_notification_rule_addresses`、`whale_notification_rule_symbol_overrides`、`whale_notification_deliveries`，并补齐索引与唯一约束。

**Step 4: Run migration checks**
- Run: `dx db format && dx db generate && dx db migrate --dev --name add_whale_notification_tables`
- Expected: PASS。

**Step 5: Commit**
```bash
git add apps/backend/prisma/schema/market_data.prisma apps/backend/prisma/schema/migrations
git commit -m "feat: add whale notification prisma tables\n\nRefs: #400"
```

### Task 2: DTO 与错误码

**Files:**
- Modify: `packages/shared/src/constants/error-codes.ts`
- Create: `apps/backend/src/modules/whale-notification/dto/*.ts`
- Create: `apps/backend/src/modules/whale-notification/exceptions/*.exception.ts`
- Create: `apps/backend/src/modules/whale-notification/exceptions/*.spec.ts`

**Step 1: Write the failing test**
- 为非法地址、阈值<=0、渠道为空写异常单测。

**Step 2: Run test to verify it fails**
- Run: `pnpm --filter backend test whale-notification`（或仓库现有最小 Jest 命令）
- Expected: FAIL。

**Step 3: Write minimal implementation**
- 新增请求/响应 DTO；新增 DomainException 子类并映射 ErrorCode。

**Step 4: Run test to verify it passes**
- Run 同上
- Expected: PASS。

**Step 5: Commit**
```bash
git add packages/shared/src/constants/error-codes.ts apps/backend/src/modules/whale-notification
git commit -m "feat: add whale notification dto and exceptions\n\nRefs: #400"
```

### Task 3: 规则 CRUD API

**Files:**
- Create: `apps/backend/src/modules/whale-notification/whale-notification.module.ts`
- Create: `apps/backend/src/modules/whale-notification/controllers/whale-notification-rules.controller.ts`
- Create: `apps/backend/src/modules/whale-notification/services/whale-notification-rules.service.ts`
- Create: `apps/backend/src/modules/whale-notification/repositories/whale-notification.repository.ts`
- Modify: `apps/backend/src/modules/app.module.ts`

**Step 1: Write the failing test**
- E2E：创建规则、查询规则、更新规则、删除规则。

**Step 2: Run test to verify it fails**
- Run: `dx test e2e backend apps/backend/e2e/whale-notification-rules.e2e-spec.ts`
- Expected: FAIL。

**Step 3: Write minimal implementation**
- 完成受保护接口：`GET/POST/PATCH/DELETE /whale-notification-rules` 与 `POST /:id/toggle`。

**Step 4: Run test to verify it passes**
- Run 同上
- Expected: PASS。

**Step 5: Commit**
```bash
git add apps/backend/src/modules/whale-notification apps/backend/src/modules/app.module.ts
git commit -m "feat: add whale notification rule management api\n\nRefs: #400"
```

### Task 4: 匹配器与阈值优先级

**Files:**
- Create: `apps/backend/src/modules/whale-notification/services/whale-notification-matcher.service.ts`
- Create: `apps/backend/src/modules/whale-notification/services/whale-notification-threshold.service.ts`
- Create: `apps/backend/src/modules/whale-notification/services/*.spec.ts`

**Step 1: Write the failing test**
- 覆盖优先级：地址+币种覆盖 > 规则级币种覆盖 > 规则默认阈值。

**Step 2: Run test to verify it fails**
- Run: `pnpm --filter backend test whale-notification-matcher`
- Expected: FAIL。

**Step 3: Write minimal implementation**
- 输入一条 trade event，输出命中的用户规则与渠道任务。

**Step 4: Run test to verify it passes**
- Expected: PASS。

**Step 5: Commit**
```bash
git add apps/backend/src/modules/whale-notification/services
git commit -m "feat: implement whale notification matcher and threshold priority\n\nRefs: #400"
```

### Task 5: 冷却去重

**Files:**
- Create: `apps/backend/src/modules/whale-notification/services/whale-notification-deduplicator.service.ts`
- Create: `apps/backend/src/modules/whale-notification/services/whale-notification-deduplicator.service.spec.ts`

**Step 1: Write the failing test**
- 60 秒内同 `user+address+symbol+side+channel` 重复事件应 `skipped_cooldown`。

**Step 2: Run test to verify it fails**
- Run: `pnpm --filter backend test whale-notification-deduplicator`
- Expected: FAIL。

**Step 3: Write minimal implementation**
- 先基于 DB 查询最近已发送记录实现去重。

**Step 4: Run test to verify it passes**
- Expected: PASS。

**Step 5: Commit**
```bash
git add apps/backend/src/modules/whale-notification/services/whale-notification-deduplicator.*
git commit -m "feat: add whale notification cooldown deduplication\n\nRefs: #400"
```

### Task 6: 渠道分发（站内/邮箱/TG）

**Files:**
- Create: `apps/backend/src/modules/whale-notification/services/whale-notification-dispatcher.service.ts`
- Create: `apps/backend/src/modules/whale-notification/services/channels/*.ts`
- Modify: `apps/backend/src/modules/auth/services/user-auth.service.ts`（抽离可复用 TG 发送能力到 channel service，避免跨模块强耦合）

**Step 1: Write the failing test**
- 渠道部分失败不影响其他渠道成功。

**Step 2: Run test to verify it fails**
- Run: `pnpm --filter backend test whale-notification-dispatcher`
- Expected: FAIL。

**Step 3: Write minimal implementation**
- 实现 `web_inbox` 写库、`email` 调用 `MailService`、`telegram` 调用 bot sender。

**Step 4: Run test to verify it passes**
- Expected: PASS。

**Step 5: Commit**
```bash
git add apps/backend/src/modules/whale-notification apps/backend/src/modules/auth/services/user-auth.service.ts
git commit -m "feat: add whale notification multi-channel dispatcher\n\nRefs: #400"
```

### Task 7: 事件接入与投递流水

**Files:**
- Create: `apps/backend/src/modules/whale-notification/services/whale-notification-orchestrator.service.ts`
- Modify: `apps/backend/src/modules/whale-alert/whale-alert.service.ts`
- Create: `apps/backend/src/modules/whale-notification/jobs/whale-notification-dispatch.job.ts`（若采用定时增量扫描）

**Step 1: Write the failing test**
- E2E：写入一条 `HyperliquidWhaleTrade`，应产生命中投递记录。

**Step 2: Run test to verify it fails**
- Run: `dx test e2e backend apps/backend/e2e/whale-notification-delivery.e2e-spec.ts`
- Expected: FAIL。

**Step 3: Write minimal implementation**
- 将 trade 事件送入 orchestrator，完成“匹配 -> 去重 -> 分发 -> 记录”。

**Step 4: Run test to verify it passes**
- Expected: PASS。

**Step 5: Commit**
```bash
git add apps/backend/src/modules/whale-notification apps/backend/src/modules/whale-alert/whale-alert.service.ts
git commit -m "feat: wire whale trade events to notification pipeline\n\nRefs: #400"
```

### Task 8: 通知查询 API

**Files:**
- Create: `apps/backend/src/modules/whale-notification/controllers/whale-notifications.controller.ts`
- Modify: `apps/backend/src/modules/whale-notification/services/whale-notification-rules.service.ts`
- Create: `apps/backend/e2e/whale-notifications.e2e-spec.ts`

**Step 1: Write the failing test**
- `GET /whale-notifications` 分页查询当前用户通知。

**Step 2: Run test to verify it fails**
- Run: `dx test e2e backend apps/backend/e2e/whale-notifications.e2e-spec.ts`
- Expected: FAIL。

**Step 3: Write minimal implementation**
- 返回 `web_inbox` 渠道的通知列表。

**Step 4: Run test to verify it passes**
- Expected: PASS。

**Step 5: Commit**
```bash
git add apps/backend/src/modules/whale-notification apps/backend/e2e/whale-notifications.e2e-spec.ts
git commit -m "feat: add whale notification inbox query api\n\nRefs: #400"
```

### Task 9: 前端规则管理页

**Files:**
- Create: `apps/front/src/app/[lng]/whale-notifications/rules/page.tsx`
- Create: `apps/front/src/components/whale-notifications/RuleEditor.tsx`
- Modify: `apps/front/src/lib/api.ts`
- Modify: `apps/front/src/components/layout/Navbar.tsx`

**Step 1: Write the failing test**
- 组件测试：可新增规则、编辑阈值、切换渠道。

**Step 2: Run test to verify it fails**
- Run: `pnpm --filter front test RuleEditor`
- Expected: FAIL。

**Step 3: Write minimal implementation**
- 完成规则列表、表单、新增/编辑/启停/删除。

**Step 4: Run test to verify it passes**
- Expected: PASS。

**Step 5: Commit**
```bash
git add apps/front/src/app/[lng]/whale-notifications/rules apps/front/src/components/whale-notifications apps/front/src/lib/api.ts apps/front/src/components/layout/Navbar.tsx
git commit -m "feat: add whale notification rules ui\n\nRefs: #400"
```

### Task 10: 前端通知中心与实时页一键关注

**Files:**
- Create: `apps/front/src/app/[lng]/whale-notifications/inbox/page.tsx`
- Create: `apps/front/src/components/whale-notifications/InboxList.tsx`
- Modify: `apps/front/src/components/whale-tracking/realtime/RealtimeWhalesTable.tsx`
- Modify: `apps/front/src/lib/api.ts`

**Step 1: Write the failing test**
- 组件测试：实时页点击“关注”可添加地址到规则；通知中心可渲染消息。

**Step 2: Run test to verify it fails**
- Run: `pnpm --filter front test RealtimeWhalesTable`
- Expected: FAIL。

**Step 3: Write minimal implementation**
- 接入“关注地址”入口、通知列表展示、浏览器通知授权与弹出。

**Step 4: Run test to verify it passes**
- Expected: PASS。

**Step 5: Commit**
```bash
git add apps/front/src/components/whale-tracking/realtime/RealtimeWhalesTable.tsx apps/front/src/app/[lng]/whale-notifications apps/front/src/components/whale-notifications apps/front/src/lib/api.ts
git commit -m "feat: add whale notification inbox and quick follow action\n\nRefs: #400"
```

### Task 11: 合约与回归验证

**Files:**
- Modify: `packages/api-contracts/openapi/backend.json`（由命令生成）
- Modify: `packages/api-contracts/src/generated/backend.ts`（由命令生成）
- Modify: `docs/plans/2026-03-03-whale-notification-design.md`（若需要同步变更）

**Step 1: Generate contracts**
- Run: `dx build contracts --dev`

**Step 2: Run lint/build/tests**
- Run: `dx lint`
- Run: `dx build backend --dev && dx build front --dev`
- Run: `dx test e2e backend apps/backend/e2e/whale-notification-rules.e2e-spec.ts`
- Run: `dx test e2e backend apps/backend/e2e/whale-notification-delivery.e2e-spec.ts`

**Step 3: Commit**
```bash
git add packages/api-contracts
# 如有文档/测试更新一并 add
git commit -m "chore: regenerate api contracts for whale notifications\n\nRefs: #400"
```

### Task 12: 最终集成与 PR 准备

**Files:**
- Modify: `README.md`（如需补充使用说明）
- Create/Modify: `docs/whale-notifications.md`（可选）

**Step 1: Final verification**
- Run: `git status --short`
- Expected: clean。

**Step 2: Prepare PR summary**
- 变更范围、风险点、回滚点、验证证据（命令与结果）。

**Step 3: Commit (docs if needed)**
```bash
git add README.md docs
git commit -m "docs: add whale notification usage notes\n\nRefs: #400"
```
