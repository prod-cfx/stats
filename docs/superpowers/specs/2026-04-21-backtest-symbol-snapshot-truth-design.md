# 删除 `allowedSymbols` 路线：回测按快照真相 + 后端动态校验设计

日期：2026-04-21  
状态：draft（brainstorming 已收敛）

## 1. 背景

当前回测链路中，平台通过 `GET /backtesting/capabilities` 返回 `allowedSymbols`，由前端先根据这个白名单决定某个策略是否可以回测。

这条路线存在根本性设计问题：

- 策略的真实标的来自 `published snapshot`
- 平台却通过一个独立的静态/半静态白名单再次裁决 symbol
- 结果是策略真相与平台能力真相割裂

典型现象：
- 已发布策略的 symbol 是 `ORDIUSDT`
- `capabilities.allowedSymbols` 却只有 `BTCUSDT`
- 前端因此直接阻断回测，或者即使前面允许，后端 create-job 又因能力不一致失败

用户要求：
- 不再用补丁方式往 capability 白名单里手工加 symbol
- 删除这条错误方向
- 回测要统一按照已发布策略快照 truth 来
- 如果当前不可回测，要提示用户，而且提示要有清晰可读的中英文文案

## 2. 目标

本次设计的目标是：

1. 删除 `allowedSymbols` 作为 symbol 准入依据的设计
2. 已发布策略的回测 symbol 只来自 `published snapshot`
3. 后端动态判断某个 symbol 当前是否真的可回测
4. `symbols/check` 与 `create-job` 使用同一套动态校验逻辑
5. 不可回测时，向前端返回结构化错误码，由前端展示中英文、用户可读提示

## 3. 非目标

以下内容不在本次设计范围内：

1. 不修改回测基础参数可编辑的产品形态（如 initialCash / slippage / fee）
2. 不修改 deploy/runtime once 语义模型
3. 不修改 AI Quant 对话/发布主链路
4. 不在这次设计里扩展新的 provider 能力模型，只重构 symbol 准入逻辑

## 4. 原则

### 4.1 snapshot 是唯一策略真相

对于已发布策略：
- `exchange`
- `marketType`
- `symbol`
- `baseTimeframe`

都必须来自 `publishedSnapshotId` 对应的快照，而不是前端白名单、页面状态或人工覆盖。

### 4.2 平台只做动态验证，不做静态裁决

平台可以回答：
- 这个 symbol 当前能不能回测
- 如果不能，原因是什么

但平台不再通过 `allowedSymbols` 白名单决定“你不能测这个策略”。

### 4.3 前端不再提前替系统做 symbol 裁决

前端可以做：
- 展示策略快照 truth
- 发起 `symbols/check`
- 发起 `create-job`
- 展示后端返回的可读错误

前端不再做：
- `allowedSymbols.includes(symbol)` 之类的 symbol 白名单拦截

### 4.4 create-job 保留最终执行前确认

即使前面有 `symbols/check`，`create-job` 仍需保留最终执行时确认。

这不是补丁逻辑，而是执行时一致性保证：
- `symbols/check` 解决“尽早提示用户”
- `create-job` 解决“真正入队前状态可能已变化”

两者必须共用同一套后端动态 symbol 校验逻辑，而不是两套分叉逻辑。

## 5. 方案对比

### 方案 A：保留 capabilities，但移除 `allowedSymbols`

做法：
- `GET /backtesting/capabilities` 保留
- 删除 `allowedSymbols`
- 只保留 timeframe 等通用能力
- symbol 校验转移到 `symbols/check` / `create-job`

优点：
- 改动路径清晰
- capability 接口仍可继续提供通用能力

缺点：
- 仍保留 capability 入口，虽然不再裁决 symbol

### 方案 B：前端直接跳过 capabilities，仅 snapshot + create-job

做法：
- 前端不再依赖 capability 做任何回测前判断
- 直接读 snapshot 并调用 create-job
- create-job 完成全部动态校验

优点：
- 结构最简
- 更接近“后端唯一裁决点”

缺点：
- 用户只能在 create-job 时得到错误
- 缺少一层更早的可读反馈

### 方案 C：删除 `allowedSymbols`，保留 `symbols/check` 作为唯一预检查

做法：
- `capabilities` 不再返回 symbol 白名单
- 前端从 snapshot 读取 symbol
- 点击回测前先调用 `symbols/check`
- 通过后再 `create-job`
- 后端两者共用统一动态校验逻辑

优点：
- 符合 snapshot truth 驱动
- 用户能更早看到可读错误
- 仍保留 create-job 最终确认

缺点：
- 仍是两步调用
- 必须严禁两处逻辑漂移

### 推荐方案

推荐 **方案 C**。

原因：
- 删除了错误的 `allowedSymbols` 路线
- 保留用户体验上必要的“提前提示”
- 同时保留执行前的最终一致性确认
- 最符合“按策略快照真相来，但平台动态判断当前能不能测”的目标

## 6. 最终设计

## 6.1 `GET /backtesting/capabilities`

此接口保留，但职责缩小为：
- 提供通用回测能力
- 提供可用 timeframe / execution 通用配置

明确删除：
- `allowedSymbols`

也就是说：
- capability 不再参与 symbol 准入裁决

## 6.2 symbol 真相来源

已发布策略回测时：
- `symbol`
- `exchange`
- `marketType`
- `baseTimeframe`

统一来自：
- `publishedSnapshotId`
- 其对应 `strategyConfig`

前端和后端都不得再以 capability 或页面参数覆盖 symbol 真相。

## 6.3 动态 symbol 校验层

新增统一动态校验服务，例如：
- `backtest-symbol-availability.service`

输入：
- exchange
- marketType
- symbol
- baseTimeframe

职责：
1. 校验本地 symbol catalog 是否存在该 symbol
2. 必要时触发 refresh/sync
3. 校验 provider 是否支持该 symbol
4. 校验历史行情是否可获取
5. 输出统一结果：
   - supported
   - 或 error code + args

## 6.4 `POST /backtesting/symbols/check`

该接口保留，但语义改为：
- 基于 snapshot truth / provider / market data 动态判断 symbol 是否可回测

不再做：
- 读取静态 `allowedSymbols`
- 按 capability 白名单判断支持性

## 6.5 `POST /backtesting/jobs`

`create-job` 继续做最终执行前确认。

做法：
- 使用 snapshot truth 解析 symbol
- 调用与 `symbols/check` 相同的动态校验服务
- 支持则创建 job
- 不支持则返回结构化业务错误

## 7. 错误模型与用户提示

### 7.1 后端返回结构化错误

后端只返回：
- code
- args
- 必要上下文

示例：

```json
{
  "code": "BACKTEST_SYMBOL_UNAVAILABLE",
  "args": {
    "symbol": "ORDIUSDT",
    "exchange": "okx",
    "marketType": "spot"
  }
}
```

### 7.2 前端负责中英文文案

前端根据错误码渲染中英文可读提示。

#### 示例：symbol 不可回测

中文：
> 当前策略标的 ORDIUSDT 暂不支持回测，请先确认该标的的历史行情能力是否已接入。

English:
> Backtesting is not available for ORDIUSDT yet. Please confirm that historical market data for this symbol has been enabled.

#### 示例：暂时不可用

中文：
> 回测服务暂时不可用，请稍后重试。

English:
> The backtesting service is temporarily unavailable. Please try again later.

### 7.3 推荐错误码分层

#### 策略快照缺失类
- `BACKTEST_SNAPSHOT_REQUIRED`
- `BACKTEST_SNAPSHOT_SYMBOL_MISSING`
- `BACKTEST_SNAPSHOT_MARKET_TYPE_MISSING`
- `BACKTEST_SNAPSHOT_TIMEFRAME_MISSING`

#### symbol / 数据能力类
- `BACKTEST_SYMBOL_UNAVAILABLE`
- `BACKTEST_SYMBOL_NOT_FOUND`
- `BACKTEST_SYMBOL_REFRESH_FAILED`
- `BACKTEST_MARKET_DATA_UNAVAILABLE`

#### 参数类
- `BACKTEST_RANGE_INVALID`
- `BACKTEST_TIMEFRAME_UNSUPPORTED`
- `BACKTEST_EXECUTION_CONFIG_INVALID`

#### 服务临时错误类
- `BACKTEST_SERVICE_TEMPORARILY_UNAVAILABLE`
- `BACKTEST_PROVIDER_TEMPORARILY_UNAVAILABLE`

## 8. 修改范围

### quantify

#### 删除/改造
- `apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.ts`
- `apps/quantify/src/modules/backtesting/backtest-capability-config.ts`
- `apps/quantify/src/modules/backtesting/repositories/backtest-capabilities.repository.ts`
- `apps/quantify/src/modules/backtesting/dto/backtest.response.dto.ts`
- `apps/quantify/prisma/schema/backtesting_capabilities.prisma`

#### 新增/重构
- `apps/quantify/src/modules/backtesting/services/backtest-symbol-availability.service.ts`
- `apps/quantify/src/modules/backtesting/services/backtest-symbol-support.service.ts`
- `apps/quantify/src/modules/backtesting/services/backtest-market-data.service.ts`
- `apps/quantify/src/modules/backtesting/backtesting.controller.ts`
- `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts`

### front

- `apps/front/src/lib/backtesting-api.ts`
- `apps/front/src/components/ai-quant/backtest-payload-builder.ts`
- `apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts`
- `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- i18n 文案资源

### tests

- quantify unit tests
- backtesting e2e
- front 回测流程 tests
- contract tests

## 9. 风险与控制

### 风险 1：`symbols/check` 与 `create-job` 逻辑漂移

控制方式：
- 两者必须共用同一 service
- 禁止复制 symbol 校验逻辑

### 风险 2：删除 `allowedSymbols` 后，旧前端逻辑残留

控制方式：
- 前端搜索并删除所有 `allowedSymbols` 依赖
- 补适配测试

### 风险 3：迁移阶段旧配置残留

控制方式：
- 第一阶段：代码停用读取
- 第二阶段：schema cleanup migration

## 10. 最终结论

本次建议采用：

> **删除 `allowedSymbols` 路线，回测 symbol 统一按 published snapshot truth，后端动态校验，前端展示中英文可读错误。**

这不是 capability 小修，而是一次：

> **从“平台静态白名单裁决 symbol”切换到“策略快照真相 + 后端动态验证”的结构纠偏。**
