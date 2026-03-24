# Real User Testnet Trading Closure Audit

## 审计范围

- 设计基线：`docs/superpowers/specs/2026-03-23-real-user-testnet-trading-closure-design.md`
- 前端主入口：
  - `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
  - `apps/front/src/components/ai-quant/DeployDialog.tsx`
  - `apps/front/src/components/account/exchange-account-store.ts`
  - `apps/front/src/lib/api.ts`
  - `apps/front/src/lib/server-api.ts`
- Backend 用户账户 BFF：
  - `apps/backend/src/modules/account-exchange-accounts/**`
- Quantify 核心链路：
  - `apps/quantify/src/modules/trading/trading.service.ts`
  - `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`
  - `apps/quantify/src/modules/llm-strategy-subscriptions/llm-strategy-subscriptions.service.ts`
  - `apps/quantify/src/modules/strategy-subscriptions/strategy-subscriptions.service.ts`
  - `apps/quantify/src/modules/account-strategy-view/**`
  - `apps/quantify/src/modules/strategy-signals/services/fixed-*.service.ts`

## 当前正式链路

```text
front login
  -> backend account/exchange-accounts
  -> quantify exchange-accounts
  -> 用户账户绑定状态落库

front ai-quant page
  -> startLlmCodegenSession / continueLlmCodegenSession
  -> quantify llm-strategy-codegen
  -> 生成 codegen session / spec

前端策略部署
  -> deployAccountAiQuantStrategy
  -> quantify account-strategy-view deploy
  -> strategyInstance + userStrategySubscription + exchangeAccountId
  -> account center list/detail

LLM 实例执行主链
  -> quantify llmStrategyInstance
  -> userLlmStrategySubscription(exchangeAccountId)
  -> signal-executor
  -> trading.placeOrder(userId, exchangeId, marketType, input, exchangeAccountId?)
  -> execution/order/trade/position/PnL
  -> account center 聚合展示
```

## 当前 fixed 链路

```text
fixed-binance-testnet / fixed-okx-simulated / fixed-hyperliquid-testnet service
  -> 按固定邮箱、固定策略名、固定实例名解析 seed 上下文
  -> 生成 signal
  -> signal-executor
```

说明：

- `signal-executor` 本身不是 fixed-only，已经支持按 LLM 订阅读取真实 `exchangeAccountId`
- fixed 主要问题在于 signal 生成上下文仍依赖固定 seed 用户与固定实例命名

## 模块状态表

| 模块 | 当前状态 | 是否依赖 fixed | 断点/风险 |
| --- | --- | --- | --- |
| `trading` | 已实现真实用户账户解析 | 否 | 逻辑是 `exchangeAccountId` 优先、`userId + exchangeId` 回退，未发现 fixed fallback |
| `signal-executor` | 已实现订阅到账户执行 | 部分 | 能读取 `userLlmStrategySubscription.exchangeAccountId`，但 fixed signal service 仍可向它喂固定上下文 signal |
| `llm-strategy-subscriptions` | 已实现且约束较完整 | 否 | active 订阅已强制合法 `exchangeAccountId`，这是正式主链中最成熟的一段 |
| `strategy-subscriptions` | 已实现，但较宽松 | 否 | 支持 `exchangeAccountId` 归属校验，但是否为正式主入口需进一步确认 |
| `account-strategy-view` | 已实现展示与一键部署 | 部分 | `deployStrategyForUser` 在缺少账户时会创建 `encryptedConfig: '{}'` 的伪 testnet 账户，污染正式链 |
| `front ai-quant` | 局部接通 | 是 | 仍依赖 `exchange-account-store` 本地账户与 `DEV_MOCK_EXECUTION_MODE`；LLM strategy/subscription API 仍是 stub |
| `backend account-exchange-accounts` | 已实现 | 否 | 当前只覆盖用户账户绑定 BFF，尚未看到 AI Quant/LLM subscription 对应 BFF |

## 已确认的真实用户能力

### 1. 用户账户绑定链已经存在

- Backend `account/exchange-accounts` 使用 `CurrentUser` 提取真实登录用户身份
- Backend 转发给 quantify 时，`userId` 来自登录态而非前端伪造
- Quantify 已支持 Binance / OKX / Hyperliquid 的真实凭据校验与按用户存储

结论：

- 用户交易所账户绑定主链基本可复用

### 2. Quantify 执行链已经支持真实用户账户

- `trading.placeOrder()` 已支持：
  - `exchangeAccountId` 精确账户
  - `userId + exchangeId` 用户账户回退
- `signal-executor` 对 LLM signal 已读取 `userLlmStrategySubscription.exchangeAccountId`
- 执行记录阶段也会保存 `exchangeAccountId`

结论：

- 真正的执行器与交易层不是从零开始
- 核心不在“重写 trading”，而在“确保正式入口走到这条链”

### 3. LLM 订阅主链已经具备正式执行语义

- `llm-strategy-subscriptions.service.ts` 已要求：
  - 仅允许订阅 LIVE 模式实例
  - active 订阅必须有合法 `exchangeAccountId`
  - 切换 / 恢复 active 时仍校验账户归属

结论：

- “AI 生成策略 -> LLM 实例 -> 订阅 -> 用户账户执行”是当前最成熟的正式主链基础

## fixed 依赖清单

### 1. 固定邮箱

- `apps/quantify/src/modules/strategy-signals/services/fixed-binance-testnet-signal.service.ts`
  - `DEFAULT_FIXED_USER_EMAIL = 'binance-testnet-fixed@local.dev'`
- `apps/quantify/src/modules/strategy-signals/services/fixed-okx-simulated-signal.service.ts`
  - `DEFAULT_FIXED_USER_EMAIL = 'okx-sim-fixed@local.dev'`
- `apps/quantify/src/modules/strategy-signals/services/fixed-hyperliquid-testnet-signal.service.ts`
  - `DEFAULT_FIXED_USER_EMAIL = 'hyperliquid-testnet-fixed@local.dev'`

### 2. 固定策略名

- `FIXED-BINANCE-TESTNET-${spotSymbolCode}`
- `FIXED-OKX-SIMULATED-${spotSymbolCode}`
- `FIXED-HYPERLIQUID-TESTNET-${spotSymbolCode}`

### 3. 固定实例名

- `fixed-binance-${spotStrategySlug}-spot`
- `fixed-binance-${perpStrategySlug}-perp`
- `fixed-okx-${spotStrategySlug}-spot`
- `fixed-okx-${perpStrategySlug}-perp`
- `fixed-hyperliquid-${spotStrategySlug}-spot`
- `fixed-hyperliquid-${perpStrategySlug}-perp`

### 4. 固定用户上下文

- 三个 fixed service 都通过固定邮箱查 `user`
- 然后继续查固定 `strategyAccount`、`spotInstance`、`perpInstance`
- 成功后创建 signal 并送入同一个 `signal-executor`

### 5. fixed service 直接入口

- `apps/quantify/src/modules/strategy-signals/strategy-signals-execution.module.ts`
  - fixed service 仍直接注册为 provider/export

## 前端审计结论

### 1. 账户来源仍是本地 store，不是正式接口

- `AiQuantPageClient.tsx` 使用 `listExchangeAccounts()`
- `exchange-account-store.ts` 完全基于 `localStorage`
- 只支持 `binance | okx`
- 仍会从历史 `exchange_api_configs_v1` 伪造默认账户

结论：

- AI Quant 页面当前没有真正消费后端/quantify 的用户账户绑定结果
- 正式主链在前端这里断开

### 2. 前端仍启用 mock execution 思维

- `AiQuantPageClient.tsx` 中存在 `DEV_MOCK_EXECUTION_MODE = true`
- 页面在没有真实账户时仍会补 `mock-binance` / `mock-okx`

结论：

- 这是当前最明显的正式链污染点之一

### 3. LLM strategy/subscription API 大多还是 stub

`apps/front/src/lib/api.ts` 中以下函数当前直接返回空数据或 `null`：

- `fetchLlmStrategyInstances`
- `fetchLlmStrategyInstanceDetail`
- `fetchLlmStrategyInstanceSignals`
- `createLlmSubscription`
- `fetchMyLlmSubscriptions`
- `fetchLlmSubscriptionDetail`
- `updateLlmSubscription`
- `cancelLlmSubscription`

结论：

- 前端并未真正接到 LLM 策略实例 / 订阅正式 API
- 这解释了为什么 quantify 内部能力已经在，但三端还没闭环

### 4. 服务器端实例查询已接真实接口，但只覆盖“公开实例浏览”

- `apps/front/src/lib/server-api.ts` 已请求 `/llm-strategy-instances`
- 这是实例浏览能力，不等于用户订阅与真实部署闭环

结论：

- 前端并非完全没有接入 quantify
- 但接入点还停留在“列表/详情浏览”，没有完整延伸到订阅执行链

## account-strategy-view 审计结论

### 1. 一键部署路径会生成伪账户

`apps/quantify/src/modules/account-strategy-view/repositories/account-strategy-view.repository.ts` 中：

- 若 `input.exchangeAccountId` 未解析成功
- 会按 `exchange + accountName` 查找账户
- 若仍找不到，会直接创建：

```ts
exchangeAccount.create({
  data: {
    userId: input.userId,
    exchangeId: input.exchange,
    name: accountName,
    isTestnet: true,
    encryptedConfig: '{}',
  },
})
```

风险：

- 这不是有效 testnet 账户
- 但会被当成可部署账户写进 `userStrategySubscription.exchangeAccountId`

结论：

- 这条路径是正式主链中最危险的“silent fallback”
- 必须改成“无合法账户即失败”，不能创建伪账户继续跑

### 2. 策略实例模式仍是 `TESTNET`

- 一键部署会创建 `strategyInstance.mode = 'TESTNET'`
- 而 `llm-strategy-subscriptions` 只允许 `LIVE` 模式实例订阅

结论：

- 当前一键部署链和 LLM subscription 主链并不是同一条语义链
- 后续需要明确谁是正式主入口，并统一模式与账户约束

## Backend 审计结论

### 1. 用户账户绑定 BFF 已完成

- `account-exchange-accounts.controller.ts` 使用 `@CurrentUser`
- `QuantifyExchangeAccountsClient.upsert()` 转发时注入 `user.id` 和 `user.email`

结论：

- 账户绑定这一段已经是正确的真实用户链

### 2. AI Quant 对应 BFF 未在本轮审计中发现完整实现

- 当前读到的 backend 重点仍是 `account-exchange-accounts`
- 前端 AI Quant 与 LLM subscription 还大量直连或停留在 stub

结论：

- 若后续选择由 backend 统一做用户域 BFF，这一层大概率还要补
- 但是否必须新增，要先看前端是否可直接安全消费 quantify 接口

## 审核结论

### 1. 已实现且可直接复用的能力

- 真实用户交易所账户绑定链
- Quantify 按 `exchangeAccountId` / `userId + exchangeId` 解析真实用户账户
- LLM 订阅强绑定 `exchangeAccountId`
- signal-executor 基于用户订阅执行并记录 `exchangeAccountId`
- 账户中心基于 execution/trade/PnL 聚合展示的主体结构

### 2. 必须补齐的断点

- 前端 AI Quant 页面必须放弃 `exchange-account-store` 本地账户来源
- 前端 LLM strategy/subscription API 必须从 stub 接成真实接口
- `account-strategy-view.deployStrategyForUser()` 必须禁止创建伪 `exchangeAccount`
- 必须明确正式主入口是 LLM subscription 主链还是 account deploy 主链，并统一模式与账户约束
- fixed signal service 必须从正式主链断开

### 3. 可降级为 internal/dev only 的 fixed 逻辑

- `FixedBinanceTestnetSignalService`
- `FixedOkxSimulatedSignalService`
- `FixedHyperliquidTestnetSignalService`
- 任何依赖固定邮箱、固定策略名、固定实例名的 seed signal 生成逻辑

## 下一步建议

进入 `Chunk 2` 之前，先锁一个实现方向：

1. 正式主链优先收敛到 `LLM subscription -> exchangeAccountId -> signal-executor`
2. `account-strategy-view` 的一键部署只能复用真实账户，禁止再造伪账户
3. front 先接通真实账户状态与 LLM subscription API，再谈 UI 层统一
