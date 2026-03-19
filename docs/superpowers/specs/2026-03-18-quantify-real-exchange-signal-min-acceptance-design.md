# Quantify 真实交易所数据与策略信号最小验收设计

日期：2026-03-18
范围：`apps/quantify` 验收流程与 `scripts/acceptance/*`

## 1. 背景与目标

本设计面向一次“真实链路最小验收”，回答两个问题：

1. Binance / OKX / Hyperliquid 是否都能在当前运行态拿到有效 market data（quote + bars）。
2. 复用现有 strategy-instance 手动触发后，是否能生成策略信号（tradingSignal）。

## 2. 约束与边界

1. 仅做验收编排，不改动交易执行与策略业务逻辑。
2. 仅使用真实公开行情端点，不使用 testnet。
3. 不追求本阶段可复现/长稳压测，只满足“最小通过”。
4. 失败必须可诊断（按 gate 输出结构化错误与日志）。

## 3. 通过标准（最小通过）

任一条件失败即判定 FAIL：

1. 三家交易所各至少一个目标 symbol 能从 API 返回 `quote` 与 `bars`。
2. 三家交易所在 DB 中能观察到 `t0` 之后的最新 quote/bar 写入或更新。
3. strategy-instance 手动触发成功，并新增一条 `tradingSignal`（关键字段完整：`strategyId` / `symbolId` / `direction` / `status` / `createdAt`）。
4. 输出统一汇总 JSON（含各 gate 状态、失败原因、时间戳）。

## 4. 方案对比与选择

### 方案 A（推荐）：单次编排脚本闭环

- preflight -> runtime -> 三交易所数据校验 -> strategy-instance 触发 -> 汇总
- 优点：一步执行、结果标准化、可复用性最好
- 成本：需新增少量编排与断言代码

### 方案 B：手工串行执行

- 复用现有脚本并手工调 API / 查 DB
- 优点：改动最少
- 缺点：人工步骤多，易漏检，难复用

### 方案 C：全放 E2E

- 把真实外部校验并入 Jest E2E
- 优点：测试入口统一
- 缺点：受外部波动影响，稳定性差，首轮落地成本高

结论：采用方案 A。

## 5. 验收架构与执行流

### Gate 0：Preflight

复用 `scripts/acceptance/quantify-market-data-preflight.sh`：

1. 校验命令依赖。
2. 校验环境变量与 provider 约束。
3. 校验 REST/WS 基础连通性。

### Gate 1：Runtime

复用 `scripts/acceptance/quantify-market-data-runtime.sh start`：

1. 启动 quantify。
2. 等待端口绑定。
3. 等待市场数据初始化日志。
4. 记录本次验收 `t0`。

### Gate 2：三交易所数据可用性

新增“多交易所校验脚本”（建议路径：`scripts/acceptance/quantify-multi-exchange-gate-check.sh`）：

1. 对 `binance` / `okx` / `hyperliquid` 分别执行 API 检查：
   - `GET /api/v1/market/quote`
   - `GET /api/v1/market/bars`
2. 对应执行 DB 检查：
   - quote/bar 在 `t0` 后有新增或更新
3. 产出单交易所结果对象与 gate 汇总。

### Gate 3：策略信号触发

新增“strategy-instance 触发校验脚本”（建议路径：`scripts/acceptance/quantify-strategy-signal-gate-check.sh`）：

1. 读取并复用现有 strategy-instance（由环境变量传入实例 ID）。
2. 调用现有手动触发入口。
3. 校验 `tradingSignal` 在本次触发后新增。

### Gate 4：统一汇总与退出

新增总编排脚本（建议路径：`scripts/acceptance/quantify-min-acceptance.sh`）：

1. 串行执行 Gate 0-3。
2. 汇总输出 `tmp/quantify-min-acceptance/acceptance-summary.json`。
3. 全通过返回 `0`，否则返回非 `0`。
4. 默认执行收尾 `runtime stop`，支持保留现场开关。

## 6. 错误处理与稳定性策略

1. 外部波动容忍：每个交易所检查短重试（如 3 次，退避间隔）。
2. 失败可诊断：每个 gate 提供结构化错误码（例如 `EXCHANGE_QUOTE_EMPTY`、`SIGNAL_NOT_CREATED`）。
3. 幂等与重复执行：严格使用 `t0` 限定本次窗口，避免历史数据干扰。
4. 安全：日志脱敏，不输出明文敏感信息。

## 7. 数据与配置约定

1. 目标交易所：`binance` / `okx` / `hyperliquid`。
2. 每家至少一个 symbol（建议由环境变量显式指定，避免硬编码）：
   - `ACCEPT_SYMBOL_BINANCE`
   - `ACCEPT_SYMBOL_OKX`
   - `ACCEPT_SYMBOL_HYPERLIQUID`
3. 策略实例 ID：`ACCEPT_STRATEGY_INSTANCE_ID`。
4. 结果目录：`tmp/quantify-min-acceptance/`。

## 8. 非目标

1. 不在本次引入“重复两次结果一致”的可复现要求。
2. 不在本次引入 30-60 分钟长稳运行门禁。
3. 不在本次重构 market-data / strategy-signals 业务实现。

## 9. 风险与回滚

1. 风险：外部行情抖动导致短时失败。
   - 缓解：短重试 + 明确错误码。
2. 风险：复用的 strategy-instance 状态不满足触发条件。
   - 缓解：触发前做实例状态检查并给出可读错误。
3. 回滚：新增脚本均为增量文件，移除脚本即可回滚，不影响线上逻辑。

## 10. 验收产物

1. 可一键执行的最小验收脚本。
2. 机器可读的汇总 JSON。
3. 失败可定位的 gate 级日志与错误码。
