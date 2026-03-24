# LLM Codegen Strict Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在策略代码生成阶段启用 strict 结构化输出（`{code}`），降低输出格式错误并保持现有校验链路兼容。

**Architecture:** 在 codegen 服务层新增 strict 请求与解析逻辑，provider 适配层透传 response_format。strict 失败按配置回退旧文本模式，最终仍走 TypeScript 编译与 guardrail。

**Tech Stack:** NestJS, TypeScript, Jest, existing AiService/OpenAI-compatible adapter.

---

### Task 1: 定义 strict 响应结构与配置开关

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/config/configuration.ts`（或现有配置接入点）
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

**Step 1: Write the failing test**
- 断言 strict 开启时，codegen 请求会走 strict 路径。

**Step 2: Run test to verify it fails**
Run:
`pnpm --filter @net/quantify run test:unit -- --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
- 增加 strict 相关配置读取与默认值。
- 增加 strict schema 常量（v1）。

**Step 4: Run test to verify it passes**
Run same command.
Expected: PASS

**Step 5: Commit**
```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/config/configuration.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "feat: add strict mode config and schema for llm codegen"
```

### Task 2: 扩展 AiService / Provider 支持 response_format

**Files:**
- Modify: `apps/quantify/src/modules/ai/ai.service.ts`
- Modify: `apps/quantify/src/modules/ai/providers/llm-provider-adapter.interface.ts`
- Modify: `apps/quantify/src/modules/ai/providers/openai-compatible.adapter.ts`
- Test: `apps/quantify/src/modules/ai/providers/__tests__/openai-compatible.adapter.spec.ts`（若无则创建）

**Step 1: Write the failing test**
- 断言传入 strict response_format 时，adapter 请求体包含对应字段。

**Step 2: Run test to verify it fails**
Run provider tests.
Expected: FAIL

**Step 3: Write minimal implementation**
- 扩展 chat options 类型：增加 `responseFormat`。
- adapter 将其映射到 provider 请求 payload。

**Step 4: Run test to verify it passes**
Run provider tests.
Expected: PASS

**Step 5: Commit**
```bash
git add apps/quantify/src/modules/ai/ai.service.ts apps/quantify/src/modules/ai/providers/llm-provider-adapter.interface.ts apps/quantify/src/modules/ai/providers/openai-compatible.adapter.ts apps/quantify/src/modules/ai/providers/__tests__/openai-compatible.adapter.spec.ts
git commit -m "feat: support response_format in ai provider adapter"
```

### Task 3: codegen 严格解析 + fallback

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

**Step 1: Write the failing test**
- strict 返回 `{code}` 成功发布。
- strict 返回无 `code` 且 fallback 开启 -> 回退文本模式成功。
- strict 返回无 `code` 且 fallback 关闭 -> `REJECTED`。

**Step 2: Run test to verify it fails**
Run codegen service tests.
Expected: FAIL

**Step 3: Write minimal implementation**
- `generateScript` 先走 strict 请求。
- strict 解析失败按配置 fallback。
- 日志打点 `mode=strict|fallback-text`。

**Step 4: Run test to verify it passes**
Run codegen service tests.
Expected: PASS

**Step 5: Commit**
```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "feat: enable strict structured output for llm codegen with fallback"
```

### Task 4: 自动修复链路复用 strict

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

**Step 1: Write the failing test**
- 首轮 strict code 无效，修复轮 strict code 有效，最终 `PUBLISHED`。

**Step 2: Run test to verify it fails**
Run codegen service tests.
Expected: FAIL

**Step 3: Write minimal implementation**
- 自动修复轮次复用同一个 strict 生成入口。

**Step 4: Run test to verify it passes**
Run codegen service tests.
Expected: PASS

**Step 5: Commit**
```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "refactor: reuse strict codegen path in auto-repair retries"
```

### Task 5: 端到端验证（含你当前场景）

**Files:**
- Test-only, no file modification required unless failure found.

**Step 1: Unit tests**
```bash
pnpm --filter @net/quantify run test:unit -- --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
pnpm --filter @net/quantify run test:unit -- --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/runtime-guardrail.service.spec.ts
```
Expected: PASS

**Step 2: Build**
```bash
pnpm --filter @net/quantify run build
```
Expected: PASS

**Step 3: Manual API verify**
- 使用你提供同类 body 调用 `/llm-strategy-codegen/sessions/:id/messages`。
Expected: 不返回 500，返回 `PUBLISHED` 或 `REJECTED` 且含明确 `rejectReason`。

**Step 4: Final commit**
```bash
git add -A
git commit -m "feat: enable strict mode for llm strategy code generation"
```
