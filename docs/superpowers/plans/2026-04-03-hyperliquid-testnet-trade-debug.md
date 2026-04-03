# Hyperliquid Testnet Trade Debug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `staging` 环境中基于 `okx` 成功样本对照排查 `hyperliquid-testnet` 真实交易提交链路，并只在证据充分时做最小修复与复验。

**Architecture:** 先建立 `okx` 成功样本，再沿相同链路执行 `hyperliquid-testnet`，逐层收集从前端登录、codegen、deploy、signal、executor 到 exchange client 的证据。若断点属于运行条件，则修正条件并复验；若断点属于代码，则仅修改最小责任文件并再次走完整链路验证。

**Tech Stack:** Next.js front、NestJS backend、NestJS quantify、GitHub Issue/branch workflow、Playwright/浏览器自动化、Resend API、Hyperliquid SDK、Prisma、dx/Nx。

---

### Task 1: 固化工作上下文与执行日志容器

**Files:**
- Modify: `docs/superpowers/specs/2026-04-03-hyperliquid-testnet-trade-debug-design.md`
- Create: `docs/testing/reports/2026-04-03-hyperliquid-testnet-trade-debug-report.md`

- [ ] **Step 1: 确认当前分支与 Issue 关联**

Run: `git branch --show-current`
Expected: `codex/fix/667-hyperliquid-testnet-trade-debug`

- [ ] **Step 2: 建立调试报告文件**

在 `docs/testing/reports/2026-04-03-hyperliquid-testnet-trade-debug-report.md` 写入以下骨架：

```md
# Hyperliquid Testnet 交易提交流程调试报告

Issue: #667
Branch: `codex/fix/667-hyperliquid-testnet-trade-debug`
Spec: `docs/superpowers/specs/2026-04-03-hyperliquid-testnet-trade-debug-design.md`

## 环境门禁
- Target env:
- `.env.staging`:
- `.env.staging.local`:

## OKX 基准样本
- 登录:
- Codegen:
- Deploy:
- Signal:
- Execution:
- Exchange result:

## Hyperliquid Testnet 样本
- 登录:
- Codegen:
- Deploy:
- Signal:
- Execution:
- Exchange result:

## 断点结论
- Layer:
- Root cause:
- Evidence:

## 处置结果
- Runtime fix only / Code fix:
- Verification:
```

- [ ] **Step 3: 记录环境门禁结果**

Run: `ls -1 .env.staging .env.staging.local`
Expected: 两个文件都存在，并把结果写入报告。

- [ ] **Step 4: 提交文档起始状态**

Run:

```bash
git add docs/superpowers/specs/2026-04-03-hyperliquid-testnet-trade-debug-design.md docs/superpowers/plans/2026-04-03-hyperliquid-testnet-trade-debug.md docs/testing/reports/2026-04-03-hyperliquid-testnet-trade-debug-report.md
git commit -F - <<'MSG'
docs: add hyperliquid testnet trade debug spec and plan

- add approved design doc
- add execution plan
- add debug report template

Refs: #667
MSG
```

Expected: 提交成功。

### Task 2: 准备真实链路执行前的只读核查

**Files:**
- Modify: `docs/testing/reports/2026-04-03-hyperliquid-testnet-trade-debug-report.md`
- Inspect: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Inspect: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts`
- Inspect: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`
- Inspect: `apps/quantify/src/modules/trading/exchanges/hyperliquid-client.ts`

- [ ] **Step 1: 核查前端 deploy 入口对交易所的限制**

Run:

```bash
sed -n '2020,2088p' apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx
```

Expected: 明确看到 `onSelectExchange` 当前允许哪些交易所，并把结论写入报告“预检查”部分。

- [ ] **Step 2: 核查 deploy 参数透传链路**

Run:

```bash
sed -n '60,120p' apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts
sed -n '60,95p' apps/backend/src/modules/ai-quant-proxy/account-ai-quant-strategies.controller.ts
```

Expected: 确认 `exchange`、`strategyInstanceId`、`exchangeAccountId`、`exchangeAccountName` 是否透传。

- [ ] **Step 3: 核查 executor 的 testnet/live 门禁**

Run:

```bash
sed -n '250,340p' apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts
```

Expected: 确认 `TESTNET/LIVE/PAPER` 与 `exchangeAccount.isTestnet` 的匹配规则，并记录可能的跳过条件。

- [ ] **Step 4: 核查 Hyperliquid client 的 testnet 网络切换**

Run:

```bash
sed -n '80,130p' apps/quantify/src/modules/trading/exchanges/hyperliquid-client.ts
```

Expected: 确认 `config.isTestnet` 控制 testnet endpoint，记录为后续核对项。

- [ ] **Step 5: 将“高优先级怀疑点”写入报告**

把以下结论落到报告：

```md
## 预检查
- 前端 deploy 入口是否允许 `hyperliquid`
- deploy 参数是否完整透传
- executor 是否会因网络模式不匹配而跳过
- Hyperliquid client 是否按 `isTestnet` 切换网络
```

### Task 3: 跑通 OKX 成功基准样本

**Files:**
- Modify: `docs/testing/reports/2026-04-03-hyperliquid-testnet-trade-debug-report.md`
- Inspect: `apps/front/src/app/[lng]/auth/login/LoginPageClient.tsx`
- Inspect: `apps/front/src/features/auth/components/EmailOtpForm.tsx`
- Inspect: `apps/quantify/src/modules/llm-strategy-codegen/controllers/live-llm-strategy-codegen.controller.ts`

- [ ] **Step 1: 读取 Resend 所需配置名，不在终端回显敏感值**

Run:

```bash
rg -n "^RESEND_API_KEY=" .env.staging.local
```

Expected: 确认 key 存在，不把完整密钥写入日志或报告。

- [ ] **Step 2: 用无头浏览器执行 staging 登录**

Run: 使用浏览器自动化脚本或 Playwright 打开 `https://cfx-www-staging.devbase.cloud/zh/auth/login`，输入 `541172405@qq.com`，调用 Resend API 拉取验证码并完成登录。

Expected: 成功进入登录后页面，并在报告中记录“登录成功时间”和“验证码来源 = Resend API”。

- [ ] **Step 3: 在 AI Quant 页面完成一次最小可部署策略对话**

Run: 通过页面发起最小对话，目标不是复杂策略，而是生成可发布、可部署实例。

Expected: 记录 codegen session ID、状态变化和最终 `publishedStrategyInstanceId`。

- [ ] **Step 4: 选择 OKX 账户完成 deploy**

Run: 在前端 deploy 对话框选择 OKX 可用账户完成部署。

Expected: 记录 deploy 请求参数、返回结果和关联账户信息。

- [ ] **Step 5: 验证 signal 与 execution 已出现**

Run: 查询 quantify 侧关联记录，重点检查 signal、execution stage、order 状态。

Expected: 在报告中形成一条完整的 OKX 成功样本。

- [ ] **Step 6: 提交基准样本证据**

Run:

```bash
git add docs/testing/reports/2026-04-03-hyperliquid-testnet-trade-debug-report.md
git commit -F - <<'MSG'
docs: record okx baseline evidence for hyperliquid testnet debug

- record successful okx login/codegen/deploy sample
- capture executor and exchange evidence for comparison

Refs: #667
MSG
```

Expected: 提交成功。

### Task 4: 跑 Hyperliquid Testnet 真实样本并定位断点

**Files:**
- Modify: `docs/testing/reports/2026-04-03-hyperliquid-testnet-trade-debug-report.md`
- Inspect: `apps/front/src/components/account/ExchangeApiSection.tsx`
- Inspect: `apps/quantify/src/modules/trading/factory/account-store.impl.ts`
- Inspect: `apps/quantify/src/modules/trading/trading.service.ts`

- [ ] **Step 1: 确认 Hyperliquid 测试网账户处于可选状态**

Run: 通过页面或接口检查 `exchangeAccount` 列表，确认 `exchangeId=hyperliquid` 且 `isTestnet=true` 的账户存在且可用。

Expected: 报告中记录账户 ID、显示名和 `isTestnet` 状态。

- [ ] **Step 2: 在同一流程下尝试部署到 Hyperliquid Testnet**

Run: 与 OKX 相同方式执行 deploy，但目标账户改为 Hyperliquid Testnet。

Expected: 记录是否能在前端选择该账户，以及 deploy 是否真正发出。

- [ ] **Step 3: 若 deploy 未发出，停在入口层取证**

Run: 检查浏览器请求、前端状态和 deploy 对话框选择逻辑。

Expected: 明确是否是前端入口限制或账户筛选问题，并在报告中将断点标记为 `front deploy gating`。

- [ ] **Step 4: 若 deploy 已发出，继续查 subscription/signal/executor**

Run: 查询 quantify 侧 strategy instance、subscription、signal execution 记录。

Expected: 找到最深可达层，并记录第一处失败层级。

- [ ] **Step 5: 若执行已到 trading service，则核对 testnet/client 参数**

Run: 对照检查 `exchangeAccountId`、`exchangeId`、`marketType`、`symbol`、`config.isTestnet`。

Expected: 明确断点是在 executor 之前、trading service、account store，还是 hyperliquid client 本身。

### Task 5: 根据断点分类处理

**Files:**
- Modify: `docs/testing/reports/2026-04-03-hyperliquid-testnet-trade-debug-report.md`
- Conditional Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Conditional Modify: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`
- Conditional Modify: `apps/quantify/src/modules/trading/factory/account-store.impl.ts`
- Conditional Modify: `apps/quantify/src/modules/trading/exchanges/hyperliquid-client.ts`

- [ ] **Step 1: 如果根因属于运行条件，则不要改代码**

允许的运行条件结论：

```md
- Hyperliquid testnet 账户不存在或未绑定
- deploy 入口未走到后端，因为页面当前产品能力未开放
- strategy 没有生成 signal
- executor 被 `dryRun` 或模式网络不匹配门禁跳过
- 账户权限或 agent 授权无效
```

Expected: 报告中明确写出“无需代码修改”。

- [ ] **Step 2: 如果根因属于前端入口限制，最小修改入口责任文件**

仅在证据显示前端阻断 deploy 时，修改：

```text
apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx
```

Expected: 放开正确的交易所选择与账户透传，不做无关 UI 重构。

- [ ] **Step 3: 如果根因属于账户网络标记或透传，最小修改账户/执行链责任文件**

仅在证据显示 `exchangeAccountId`、`exchangeId`、`isTestnet` 透传错误时，修改：

```text
apps/quantify/src/modules/trading/factory/account-store.impl.ts
apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts
apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts
```

Expected: 修正单一数据责任链，不顺手改动其他业务逻辑。

- [ ] **Step 4: 如果根因属于 Hyperliquid client，下最小修复**

仅在证据显示请求已进入 client 但 testnet/network/symbol/order 映射错误时，修改：

```text
apps/quantify/src/modules/trading/exchanges/hyperliquid-client.ts
```

Expected: 只修复被证据命中的映射或网络问题。

- [ ] **Step 5: 为实际修改补最小验证**

Run: 针对被修改文件执行最小相关测试。

建议命令：

```bash
dx test unit front -- --runInBand
dx test e2e quantify apps/quantify/e2e/strategy-signals
pnpm jest apps/quantify/src/modules/trading/exchanges/hyperliquid-client.spec.ts --runInBand
```

Expected: 至少跑通与改动直接相关的测试；若命令不适用，则在报告中说明实际替代命令与结果。

### Task 6: 真实链路复验与收口

**Files:**
- Modify: `docs/testing/reports/2026-04-03-hyperliquid-testnet-trade-debug-report.md`

- [ ] **Step 1: 重新跑完整 Hyperliquid Testnet 链路**

Run: 用同一 staging 账号重新执行登录后的策略创建、deploy 和交易验证。

Expected: 若已修复，应形成完整成功样本；若无代码改动，则验证运行条件修正后是否打通。

- [ ] **Step 2: 对比修复前后证据**

在报告中补充：

```md
## 修复前后对比
- Before:
- After:
- Changed layer:
- Residual risk:
```

- [ ] **Step 3: 输出最终结论**

在报告中给出唯一结论：

```md
- Root cause layer:
- Why okx worked:
- Why hyperliquid-testnet failed:
- Whether code changed:
- Final verification result:
```

- [ ] **Step 4: 提交最终结果**

Run:

```bash
git add docs/testing/reports/2026-04-03-hyperliquid-testnet-trade-debug-report.md apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts apps/quantify/src/modules/trading/factory/account-store.impl.ts apps/quantify/src/modules/trading/exchanges/hyperliquid-client.ts
git commit -F - <<'MSG'
fix: debug and verify hyperliquid testnet trade submission flow

- capture hyperliquid testnet evidence chain end-to-end
- apply minimal fix only when root cause is confirmed
- verify staging flow after remediation

Refs: #667
MSG
```

Expected: 提交成功；若某些文件未改动，使用实际改动文件替换 `git add` 列表。

## Self-Review

- Spec coverage: 方案中的五个检查点、证据清单、改代码门槛和成功标准均已映射到具体任务。
- Placeholder scan: 计划中没有 `TODO`、`TBD` 或“后续实现”类空洞步骤；条件分支均绑定了明确文件和触发条件。
- Type consistency: 使用的字段名与现有链路保持一致，包括 `exchangeAccountId`、`publishedStrategyInstanceId`、`isTestnet`、`TradingService.placeOrder()`、`HyperliquidClient.createOrder()`。

