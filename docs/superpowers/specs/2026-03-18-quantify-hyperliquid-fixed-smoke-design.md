# Quantify 交易执行层设计（Hyperliquid Testnet Fixed Smoke）

## 1. 背景

`apps/quantify` 已经完成 `Binance` 与 `OKX` 的固定回归入口建设，当前已经具备：

- 固定 seed 数据
- 固定 signal service / CLI
- 最小 roundtrip smoke
- 交易所适配与执行编排联动

下一步目标不是扩展真实用户绑定链路，而是把 `Hyperliquid` 的交易执行路径对齐到与 `Binance / OKX` 相同的内部验证水平，形成稳定的 `testnet perp` 回归入口。

## 2. 目标

本设计只覆盖 `Hyperliquid testnet + perp`。

本次目标：

- 复用现有 `HyperliquidClient` 与 `exchange-accounts` 凭据校验模型
- 打通 `Hyperliquid testnet perp` 的最小交易闭环
- 增加固定 seed 数据，形成固定用户、固定策略、固定实例、固定账户的回归入口
- 增加 fixed signal service / CLI，与当前 Binance / OKX 的用法保持一致
- 增加最小 roundtrip smoke，作为后续多人联调的固定回归入口

## 3. 非目标

本次不纳入范围：

- `front -> backend -> quantify` 的真实用户绑定链路
- `userId` 正式治理
- `Hyperliquid spot`
- 多用户隔离治理
- execution / reconciliation 的统一 E2E 重构
- fixed smoke 账户隔离问题治理

说明：

- 真实用户 API Key 提交流程后续三端联调时再统一处理
- 本次只追求 `quantify` 内部交易链路对齐现有回归水平

## 4. 已确认边界

- 目标水平对齐 `Binance / OKX 当前 fixed smoke 水平`
- 仅做 `Hyperliquid testnet`
- 仅做 `perp`
- 当前仓库里的 Hyperliquid 凭据模型不是 `apiKey/apiSecret`，而是：
  - `mainWalletAddress`
  - `agentPrivateKey`
  - `isTestnet`

## 5. 方案对比与选型

### 5.1 方案 A（选中）：Hyperliquid testnet perp 垂直切片

围绕 `Hyperliquid testnet perp` 单独补齐：

- fixed env contract
- fixed seed
- fixed signal service / CLI
- 最小 roundtrip smoke

优点：

- 与当前 Binance / OKX 路径一致
- 范围收敛，便于快速验证
- 不引入新的三端联调变量

缺点：

- 当前只覆盖 `perp`
- 后续若补 `spot` 仍需单独扩展

### 5.2 方案 B：先抽象通用 fixed smoke 框架

优点：

- 三个交易所路径更统一

缺点：

- 当前任务会从“打通交易”变成“重构抽象”
- 风险和工作量都更高

### 5.3 方案 C：只依赖动态 exchange-account 绑定，不做 fixed smoke

优点：

- 表面改动最少

缺点：

- 不能形成固定回归入口
- 无法对齐 Binance / OKX 当前水平

结论：采用方案 A。

## 6. 当前代码现状

已经存在的能力：

- `exchange-accounts` 已支持 `hyperliquid` 凭据 DTO 与加密存储
- `TradingService.validateCexCredentials()` 已支持 Hyperliquid 专用校验分支
- `ExchangeFactory` 已可按 `hyperliquid + perp` 构造客户端
- `HyperliquidClient` 已实现：
  - `ping`
  - `validateCredentials`
  - 统一交易接口的主体骨架

当前缺口：

- 没有 Hyperliquid fixed env contract
- 没有 Hyperliquid fixed seed
- 没有 Hyperliquid fixed signal service / CLI
- 没有对齐 Binance / OKX 的最小 roundtrip smoke
- Hyperliquid 交易路径的稳定性验证还没有固定化

## 7. 目标架构

本次不新增新的总线层或执行层架构，只在现有模块中补齐一条 Hyperliquid 垂直切片。

### 7.1 固定环境合同

在环境文件与 `dx/config/env-policy.jsonc` 中新增：

- `QUANTIFY_FIXED_HYPERLIQUID_ENABLED`
- `QUANTIFY_FIXED_HYPERLIQUID_USER_EMAIL`
- `QUANTIFY_FIXED_HYPERLIQUID_USER_NICKNAME`
- `QUANTIFY_FIXED_HYPERLIQUID_OPERATOR_ID`
- `QUANTIFY_FIXED_HYPERLIQUID_BASE_ASSET`
- `QUANTIFY_FIXED_HYPERLIQUID_QUOTE_ASSET`
- `QUANTIFY_FIXED_HYPERLIQUID_INITIAL_BALANCE`
- `QUANTIFY_FIXED_HYPERLIQUID_MAIN_WALLET_ADDRESS`
- `QUANTIFY_FIXED_HYPERLIQUID_AGENT_PRIVATE_KEY`
- `QUANTIFY_FIXED_HYPERLIQUID_IS_TESTNET`

命名风格完全对齐现有 Binance / OKX fixed smoke。

### 7.2 固定 seed

增加一组 Hyperliquid fixed seed，职责与 Binance / OKX 对齐：

- 创建固定测试用户
- 创建或更新固定策略
- 创建 `Hyperliquid` 交易所账户
- 创建固定实例与订阅关系
- 创建本地策略账户

约束：

- 仅创建 `perp` 对应的 symbol / instance
- 账户配置使用 `mainWalletAddress + agentPrivateKey + isTestnet`

### 7.3 固定 signal service / CLI

新增 Hyperliquid fixed signal service 与 CLI，用于：

- 解析固定上下文
- 查询 ticker
- 生成固定 signal
- 直接触发执行链路

形态与现有：

- `fixed-binance-testnet-signal.service.ts`
- `fixed-okx-simulated-signal.service.ts`

保持同一层级、同一调用方式。

### 7.4 最小 roundtrip smoke

新增 Hyperliquid 最小闭环验证：

- 最小开仓
- 最小平仓
- 执行记录可落库
- 本地仓位系统可同步

不追求复杂风控与补偿覆盖，只要求形成可重复回归入口。

## 8. 数据模型与命名约束

### 8.1 凭据模型

Hyperliquid 不沿用 `apiKey/apiSecret/passphrase`：

- `mainWalletAddress`：资金归属主钱包
- `agentPrivateKey`：用于签名的 agent 私钥
- `isTestnet`：是否连接测试网

这套模型必须贯穿：

- env contract
- seed
- exchange account config
- signal CLI 文档说明

### 8.2 Symbol 约束

本轮仅支持 `perp`，symbol 命名对齐统一执行格式：

- `<BASE>/<QUOTE>:PERP`

示例：

- `BTC/USDC:PERP`
- `ETH/USDC:PERP`

最终基准资产以用户实际 testnet 可交易标的为准。

## 9. 核心数据流

固定回归链路应为：

### 9.1 Seed

启动 seed 后生成固定上下文：

- user
- exchangeAccount
- strategy
- strategyAccount
- llmStrategyInstance
- subscription

### 9.2 Signal

通过 fixed signal CLI 创建 `ENTRY / EXIT` signal。

### 9.3 Execute

`SignalExecutorService` 复用现有执行链路：

- 解析订阅账户
- 构建 `hyperliquid + perp` 订单参数
- 调用 `TradingService.placeOrder`
- 回写执行状态
- 推动本地仓位记录

### 9.4 Verify

通过 smoke 脚本或 E2E 验证：

- 订单成功提交
- 能查询到最终状态
- 执行记录落库
- 本地仓位/成交同步成功

## 10. 模块改动范围

本轮预期涉及：

- `.env.development`
- `.env.e2e`
- `.env.staging`
- `dx/config/env-policy.jsonc`
- `apps/quantify/prisma/seed.ts`
- `apps/quantify/prisma/seed/fixed-hyperliquid-testnet.ts`
- `apps/quantify/prisma/seed/fixed-hyperliquid-testnet.spec.ts`
- `apps/quantify/src/modules/strategy-signals/services/fixed-hyperliquid-testnet-signal.service.ts`
- `apps/quantify/src/modules/strategy-signals/services/fixed-hyperliquid-testnet-signal.service.spec.ts`
- `apps/quantify/src/modules/strategy-signals/services/fixed-hyperliquid-testnet-signal-cli.ts`
- `apps/quantify/src/modules/strategy-signals/services/fixed-hyperliquid-testnet-signal-cli.spec.ts`
- `apps/quantify/scripts/fixed-hyperliquid-testnet-signal.ts`
- 受影响的 trading / strategy-signals smoke 测试

若 `HyperliquidClient` 在实际测试中暴露缺口，可最小增补其实现与单测，但不做与当前目标无关的重构。

## 11. 错误处理

错误分为三类：

### 11.1 配置错误

例如：

- 地址缺失
- 私钥缺失
- 测试网开关错误

处理：

- 在 seed / CLI 入口直接失败
- 返回明确字段缺失信息

### 11.2 凭据错误

例如：

- agent 私钥无效
- agent 未被主钱包授权

处理：

- 由 `validateCredentials()` 失败返回
- 保留足够明确的错误原因，用于人工排查

### 11.3 交易执行错误

例如：

- 下单失败
- 查单失败
- 最终状态未收敛

处理：

- 复用现有执行层与异常映射
- 必要时在 Hyperliquid 路径补最小状态收敛逻辑

## 12. 测试策略

本轮验证分三层：

### 12.1 单元测试

- fixed seed 配置解析
- fixed signal service / CLI
- 必要的 HyperliquidClient 边界行为

### 12.2 E2E / smoke

- 固定 Hyperliquid 上下文的最小 roundtrip
- 可重复运行

### 12.3 手工验证

使用用户提供的 `testnet` 主钱包地址与 agent 私钥，在本地运行：

- fixed seed
- fixed signal CLI
- 最小开/平仓闭环

## 13. 验收标准

完成标准：

- Hyperliquid fixed env contract 已补齐到目标环境文件
- Hyperliquid fixed seed 能生成固定回归上下文
- Hyperliquid fixed signal CLI 能创建并执行 testnet perp signal
- 最小 roundtrip smoke 可重复通过
- 验证方式对齐 Binance / OKX 当前固定回归入口

不以“代码静态看起来支持”为完成标准，必须以固定入口可跑通为准。
