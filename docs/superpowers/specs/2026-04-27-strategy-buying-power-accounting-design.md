# Quantify 策略执行资金口径修复设计

Issue: #915
日期: 2026-04-27
分支: `codex/fix/915-strategy-buying-power-accounting`

## 背景

Quantify 策略运行链路已经能生成交易信号，但在执行阶段会因为本地策略账户 `balance = 0` 跳过开仓。用户详情页看到的是 `initialBalance/equity` 推导出的账户权益，例如 `4901.58 USDT`；执行器读取的是 `user_strategy_accounts.balance`。这造成用户看到“账户有钱”，系统执行却认为“可用余额为 0”。

当前问题不是布林带策略特例，而是策略资金字段语义没有统一。部署、详情页、执行器分别理解交易所余额和本地账户字段，导致总权益、可用开仓资金、策略执行本金混在一起。

## 目标

- 统一策略资金语义，明确区分总权益、可用开仓资金、执行本金、已预留资金和不可开仓原因。
- 部署初始化、详情页、信号执行器复用同一套资金解析逻辑。
- 开仓基于 `buyingPower` 做最低资金和预算限制；平仓/EXIT 不因为 quote buying power 为 0 被阻断。
- 页面和日志能说明“信号已生成，但因可用开仓资金不足未下单”。
- 保持向后兼容，避免直接把 `equity` 当成可下单资金。

## 非目标

- 不在第一阶段批量改线上账户资金。
- 不重做完整交易所账户/保证金模型。
- 不改变信号生成逻辑。
- 不把所有交易所原始字段直接暴露给前端。

## 核心判断

值得做。证据来自真实策略实例：`initial_balance/equity > 0`，`balance = 0`，ENTRY 信号生成后执行记录为 `SKIPPED`，错误是 `Account balance below minimum threshold`。这是真实资金语义错配。

关键风险是把展示权益误当作可开仓资金。正确方向是新增统一资金解析层，让特殊交易所字段差异收敛成平台资金语义，再由部署、详情和执行复用。

## 方案比较

### 推荐方案: 新增统一资金解析器，第一阶段不改 Prisma schema

新增 `StrategyBuyingPowerResolver` 纯函数或轻量服务，输入交易所 `UnifiedBalance`、本地策略账户、marketType、mode、reservedQuote、执行配置，输出统一 `StrategyFundingSnapshot`。部署、详情页、执行器调用同一解析器。

优点是改动边界小，无数据库迁移风险，能快速修复展示和执行口径不一致。缺点是 `fundingSnapshot` 如果需要持久化，只能先放到现有 `params/metadata` 或执行诊断里，长期可读性不如独立字段。

### 备选方案: 新增 Prisma 字段

给 `user_strategy_accounts` 增加 `buyingPower`、`executionCapital`、`fundingSnapshot`、`nonTradableReason` 等字段。

优点是语义最直接，查询和审计更清楚。缺点是需要迁移、Prisma 生成、兼容旧数据和前端合约评估，部署风险更高。适合作为第二阶段。

### 不采用方案: 部署时把 `balance` 改写成 `total`

这能让当前案例立刻下单，但会把总权益冒充可用资金。OKX 统一账户、保证金、冻结资金和已占用保证金都会继续出错，且可能放大真实交易风险。

## 资金语义

统一快照定义:

```ts
interface StrategyFundingSnapshot {
  asset: string
  totalEquity: number
  availableCash: number | null
  availableEquity: number | null
  reservedQuote: number
  usedMargin: number | null
  buyingPower: number
  executionCapital: number
  fundingSource: 'exchange_live' | 'exchange_testnet' | 'paper'
  accountMode?: string | null
  marginMode?: string | null
  nonTradableReason?: string | null
}
```

字段含义:

- `totalEquity`: 账户展示权益，不等于每次可下单资金。
- `availableCash`: 现货可用现金。
- `availableEquity`: 合约或统一账户可用权益。
- `reservedQuote`: 系统内部已预留 quote 资金。
- `usedMargin`: 已使用保证金，缺失时为 `null`。
- `buyingPower`: 当前可用于新开仓的资金。
- `executionCapital`: 策略百分比仓位计算基线。
- `nonTradableReason`: 总权益有值但不可开仓时的明确原因。

第一阶段 `executionCapital` 默认取 `totalEquity` 中的有效正数；实际下单预算必须再受 `buyingPower` 限制。这样保留“10% of equity”的策略直觉，又不会突破可开仓资金。

## 数据流设计

### 部署初始化

部署阶段从交易所读取余额后，不再直接把 `exchangeBalance.total` 和 `exchangeBalance.free` 分别塞给账户创建逻辑。服务层先调用资金解析器:

```ts
const funding = strategyBuyingPowerResolver.fromExchangeBalance({
  balance: exchangeBalance,
  marketType,
  mode,
  reservedQuote: 0,
})
```

传给 Repository 的资金参数改为:

- `initialBalanceQuote = funding.totalEquity`
- `accountBalanceQuote = funding.buyingPower`
- `fundingSnapshot = funding`

如果 `totalEquity > 0` 且 `buyingPower = 0`，仍允许部署和运行信号生成，但必须记录不可开仓原因。这样策略状态不会被误解为部署失败，也不会让用户误以为系统没有执行。

### 本地账户创建

`user_strategy_accounts.initialBalance` 继续表示策略资金基线，`equity` 继续表示账户权益，`balance` 在本阶段明确作为 `buyingPower` 的兼容字段使用。

创建账户时:

- `initialBalance = funding.totalEquity`，缺失时沿用现有默认保护。
- `balance = funding.buyingPower`。
- `equity = funding.totalEquity`。
- `params/metadata` 保存最小资金诊断快照，供详情和执行日志读取。

这保持旧代码读取 `balance` 的兼容性，同时把新语义收敛为 buying power。

### 详情页展示

详情页账户概览必须区分:

- `totalEquity`
- `availableBalance` 或 `buyingPower`
- `executionCapital`
- `nonTradableReason`
- 最近信号和最近执行结果

当 `equity = 4901.58` 且 `buyingPower = 0` 时，详情页应表达为:

```text
总权益: 4901.58 USDT
可用开仓资金: 0.00 USDT
状态: 策略已运行，最近信号已生成，但因可用开仓资金低于阈值未下单
```

现有响应字段 `availableBalance` 可以继续承载 buying power，新增字段需保持可选，避免破坏旧前端。

### 信号执行器

执行器锁账户时从 Repository 读取:

- `balance`
- `equity`
- `initialBalance`
- `baseCurrency`

开仓前调用资金解析器从本地账户生成 funding snapshot。最低资金校验改为:

```ts
if (funding.buyingPower < minBalanceThreshold) {
  return {
    ok: false,
    reason: 'Buying power below minimum threshold',
  }
}
```

仓位预算:

- `positionSizeQuote` 仍表示策略指定 quote 金额。
- `positionSizeRatio` 使用 `executionCapital * ratio`。
- 最终 `quoteBudget = min(strategyQuote, maxRiskQuote, funding.buyingPower)`。
- `maxRiskQuote` 基于 `executionCapital` 或明确的风险资金基线计算。

平仓/EXIT 继续不检查 quote buying power，只校验可平仓数量。

### OKX 映射

第一阶段沿用当前 `UnifiedBalance` 的 `total/free/locked` 接口，但明确解释:

- `total` 映射为 `totalEquity`。
- `free` 在合约或统一账户场景映射为 `availableEquity`。
- 现货场景映射为 `availableCash`。
- `buyingPower = max(0, available - reservedQuote)`。
- `totalEquity > 0 && buyingPower = 0` 时输出 `nonTradableReason = 'exchange_available_balance_zero'`。

后续如果需要更精细的 OKX `availBal/cashBal/availEq/ordFrozen` 区分，应扩展 `UnifiedBalance.raw` 或新增交易所余额归一化字段，不能在业务入口重复解析原始 OKX 字段。

## 错误处理和日志

执行跳过原因改为资金语义明确的错误:

- `BUYING_POWER_BELOW_MIN_THRESHOLD`
- `EXCHANGE_AVAILABLE_BALANCE_ZERO`
- `ACCOUNT_CURRENCY_MISMATCH`

日志应带结构化字段:

```text
Signal execution skipped: BUYING_POWER_BELOW_MIN_THRESHOLD
accountId=...
strategyInstanceId=...
signalId=...
totalEquity=4901.58
buyingPower=0
minBalanceThreshold=50
reservedQuote=0
fundingSource=exchange_testnet
exchange=okx
marketType=perp
```

用户侧文案不暴露内部字段名，表达为“可用开仓资金低于最低下单阈值”。

## 测试计划

### 资金解析器

- `total=4901.58/free=0` 输出 `totalEquity=4901.58`、`buyingPower=0`、`nonTradableReason`。
- spot 场景 `free` 映射为 `availableCash`。
- perp/testnet 场景 `free` 映射为 `availableEquity`。
- `reservedQuote` 会扣减 buying power，且不产生负数。

### 部署初始化

文件候选: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts`

- 交易所 `total > 0/free = 0` 时，Repository 收到的 `accountBalanceQuote` 为 `0`，但 `initialBalanceQuote` 为总权益。
- 账户创建后不会让详情页误判可开仓资金。
- preferred asset 缺失时保持现有保护。

### 详情页

文件候选: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-detail.spec.ts`

- `equity=4901.58/balance=0` 时，账户概览分别展示总权益和可用开仓资金。
- 最近执行为 `SKIPPED` 时能展示资金不足原因。

### 执行器

文件候选: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts`

- `buyingPower` 低于阈值时执行跳过，原因是 buying power 不足。
- `positionSizeRatio=10%` 基于 `executionCapital` 计算策略预算，并受 `buyingPower` 截断。
- 平仓/EXIT 不因为 quote buying power 为 0 被阻止。

## 实施顺序

1. 新增资金解析器和单测，先不接业务入口。
2. 部署初始化接入解析器，Repository 接收 funding snapshot 或最小诊断字段。
3. 详情页账户概览使用统一资金语义。
4. 执行器开仓校验和预算计算改用 `buyingPower/executionCapital`。
5. 补结构化日志和执行跳过原因。
6. 跑受影响单测、`dx lint`、`dx build quantify --dev` 或受影响构建。

## 兼容性

- 不删除旧字段，不改变 `user_strategy_accounts.balance` 的数据库类型。
- `availableBalance` 继续保留，但语义明确为可用开仓资金。
- 新增响应字段保持可选。
- 旧账户缺少 funding snapshot 时，解析器从 `initialBalance/equity/balance` 推导，避免运行时报错。

## 自检

- 无占位项。
- 设计保持单一目标: 统一策略执行资金口径。
- 不直接改生产数据，避免批量资金误修。
- 推荐方案可分阶段落地，第一阶段不要求数据库迁移。
