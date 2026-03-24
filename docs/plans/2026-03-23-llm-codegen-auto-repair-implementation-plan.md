# LLM Codegen Auto Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 LLM 策略生成首轮失败时自动修复重试，减少 REJECTED 并确保错误可观测。

**Architecture:** 在 `CodegenConversationService` 中抽离统一校验函数与自动修复生成循环，复用现有 TS/静态/运行时 guardrail。每轮失败记录版本与原因，最终返回业务态（PUBLISHED/REJECTED）。

**Tech Stack:** NestJS, TypeScript, Prisma, Jest, existing strategy runtime compiler/guardrails.

---

### Task 1: 先补失败回归测试（红灯）

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

**Step 1: Write the failing test**
- 添加用例：首次生成返回“旧协议+类型错误脚本”，第二次返回合法脚本，期望最终 `PUBLISHED`。
- 添加用例：连续三次失败，期望最终 `REJECTED` 且含最后错误。

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/quantify run test:unit -- --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
Expected: FAIL（自动修复路径未实现）

**Step 3: Commit**
```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "test: add failing cases for llm codegen auto-repair"
```

### Task 2: 抽离统一脚本校验函数

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

**Step 1: Write the failing test**
- 断言 `static/runtime` 不同失败路径都归一出 `reason`，并进入修复链。

**Step 2: Run test to verify it fails**
Run same unit test command.
Expected: FAIL（尚未归一化）

**Step 3: Write minimal implementation**
- 新增 `validateGeneratedScript(script)`。
- 统一输出 `{ passed, stage, reason }`，内部复用：
  - `compileStrategyScriptForVm`
  - `staticGuardrail.validate`
  - `runtimeGuardrail.validate`

**Step 4: Run test to verify it passes**
Run same unit test command.
Expected: PASS（相关断言通过）

**Step 5: Commit**
```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "refactor: unify llm generated script validation result"
```

### Task 3: 实现自动修复重试循环

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`

**Step 1: Write the failing test**
- 断言失败后最多重试 2 次（总 3 次生成）。
- 断言第二次成功后立即停止后续重试。

**Step 2: Run test to verify it fails**
Run same unit test command.
Expected: FAIL

**Step 3: Write minimal implementation**
- 新增 `generateWithAutoRepair(...)`。
- 循环上限：`maxAttempts = 3`。
- 每次失败构造修复消息并再次调用 `aiService.chat`。
- 任一通过则返回脚本；全部失败返回最后失败原因。

**Step 4: Run test to verify it passes**
Run same unit test command.
Expected: PASS

**Step 5: Commit**
```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "feat: add auto-repair retries for llm codegen failures"
```

### Task 4: 保证异常不抛 500，统一返回业务态

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

**Step 1: Write the failing test**
- 模拟 provider 抛错，断言返回 `REJECTED + rejectReason`。

**Step 2: Run test to verify it fails**
Run same unit test command.
Expected: FAIL

**Step 3: Write minimal implementation**
- 生成分支 catch 中更新 session 后返回 `REJECTED` payload，不再 `throw`。

**Step 4: Run test to verify it passes**
Run same unit test command.
Expected: PASS

**Step 5: Commit**
```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "fix: return rejected payload instead of 500 in codegen pipeline"
```

### Task 5: 用真实失败 body 做验证

**Files:**
- Modify (optional helper test fixture): `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/` (如需)
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

**Step 1: Add scenario**
- 把你提供的失败脚本特征（`LONG`、`implicit any`、旧 action 结构、语法残缺）放入 mock 返回。

**Step 2: Run test**
Run same unit test command.
Expected: PASS（触发修复并成功或稳定 REJECTED 且有完整原因）

**Step 3: Manual verify API**
Run:
```bash
curl -s -X POST http://localhost:3010/api/v1/llm-strategy-codegen/sessions/<sessionId>/messages \
  -H 'Content-Type: application/json' \
  -d '<same-body-you-provided>'
```
Expected: 不返回 500；返回 `PUBLISHED` 或 `REJECTED` 且含 `rejectReason`。

**Step 4: Commit**
```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "test: validate auto-repair with real rejected body pattern"
```

### Task 6: 全量验证与收尾

**Files:**
- No code change required unless failures discovered.

**Step 1: Run targeted tests**
```bash
pnpm --filter @net/quantify run test:unit -- --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
pnpm --filter @net/quantify run test:unit -- --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/runtime-guardrail.service.spec.ts
```
Expected: PASS

**Step 2: Build verify**
```bash
pnpm --filter @net/quantify run build
```
Expected: PASS

**Step 3: Final commit**
```bash
git add -A
git commit -m "feat: stabilize llm strategy codegen with auto-repair retries"
```
