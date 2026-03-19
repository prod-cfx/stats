# Quantify 市场数据模块全真实验收设计（24h 长稳）

日期：2026-03-17  
负责人：技术1（市场数据层）

## 1. 背景与目标

本次验收目标是在“市场数据使用真实链路、其他模块可模拟依赖”的前提下，完成可审计的后端验收闭环，回答两个问题：

1. 市场数据模块在真实 REST + 真实 WS 下是否正确、稳定、可恢复。
2. 该模块是否已具备进入三方联调/上线灰度的质量门槛。

明确范围：

1. 市场数据模块（`apps/quantify/src/modules/market-data`）使用全真实数据（REST + WS）。
2. strategy/ai/trading 等消费方允许以 mock 方式验证消费契约，不要求其业务策略本体真实交易。
3. 观测窗口采用 24 小时连续运行。

## 2. 验收总方案（A：分阶段硬门槛 + 24h 长稳）

采用串行 Gate 模式，前一关未通过不进入下一关：

1. Gate-1 基础正确性
2. Gate-2 真实链路联通
3. Gate-3 24h 长稳观测
4. Gate-4 验收报告归档

选择该方案原因：

1. 能把“功能错误”与“稳定性错误”分层隔离，定位更快。
2. 结果可追责、可复现、可用于联调签收。
3. 对 PR 修复回归最稳健，降低带病进入长跑的风险。

## 3. 各 Gate 通过标准

### 3.1 Gate-1 基础正确性（30~60 分钟）

通过条件（全部满足）：

1. `dx test unit quantify` 通过。
2. `dx test e2e quantify apps/quantify/e2e/market-data` 通过。
3. 手工接口检查返回 200：
   - `GET /api/v1/market/quote?symbol=BTCUSDT`
   - `GET /api/v1/market/bars?symbol=BTCUSDT&timeframe=1h&limit=10`
4. bars 结果为时间升序。
5. `limit` 的字符串数字兼容正确：
   - 请求 `...&limit=10`（query 原始类型为 string）返回 200。
   - 返回条数 `<= 10` 且不出现 Prisma `take` 类型错误。
   - 非法字符串（如 `limit=abc`）按 DTO 校验返回 400（不返回 500）。

### 3.2 Gate-2 真实链路联通（1~2 小时）

通过条件（全部满足）：

1. 真实 REST 拉取 symbols 与历史 bars 正常。
2. 真实 WS 推送持续，quote/bar 能落库并可被查询。
3. strategy/ai/trading 在 mock 依赖下消费 gateway 通过最小冒烟矩阵（见 3.5），无契约断裂。
4. 无持续不可恢复错误日志（允许偶发可恢复异常）。
5. 真实链路环境固定为 Binance production public market-data endpoints（不使用 testnet）。

### 3.3 Gate-3 24h 长稳观测（24 小时）

通过条件（全部满足）：

1. quantify 连续运行 24 小时，无进程崩溃。
2. 按 4.5 阈值表执行判定，24h 内不得触发任一“失败阈值”。允许短时抖动，但必须满足对应“恢复判定”。
3. `market_ws_reconnect_total`、`market_latest_bar_age_ms`（BTC/ETH 的 1m 与 3m）与 `market_gapfill_failed_total` 均有完整 24h 观测记录，且窗口计算口径与 4.6 一致。
4. 24h 内不出现超过 10 分钟的数据停更窗口（重点 1m/3m）。

### 3.5 Mock 消费最小冒烟矩阵（Gate-2 强制）

1. strategy-signals：
   - 用例：读取 `BTCUSDT/1h` recent bars（`limit=50`）。
   - 期望：成功返回升序 bars，且无 DomainException。
2. strategy-instances：
   - 用例：构建 debug payload 时读取 bars。
   - 期望：payload 中 bars 非空且时间升序。
3. ai tools：
   - 用例：`getMarketDataRaw(symbol=BTCUSDT,timeframe=1h,lookbackBars=50)`。
   - 期望：返回 bars 数组，`timestamp` 严格递增。
4. trading（mock）：
   - 用例：消费最新 quote 作为下单前价格输入。
   - 期望：能取到 `lastPrice`，并通过 mock 校验流程（不触发真实下单）。

### 3.4 Gate-4 验收报告（30 分钟）

通过条件（全部满足）：

1. 每个 Gate 有命令、结果、证据（日志片段/输出摘要/时间点）。
2. 明确最终结论：`PASS` / `CONDITIONAL PASS` / `FAIL`。
3. 非 PASS 时给出阻塞项与回滚建议。

## 4. 执行顺序与命令清单

### 4.1 Gate-1 执行

1. `dx test unit quantify`
2. `dx test e2e quantify apps/quantify/e2e/market-data`
3. 启动后手测：
   - `GET /api/v1/market/quote?symbol=BTCUSDT`
   - `GET /api/v1/market/bars?symbol=BTCUSDT&timeframe=1h&limit=10`
   - `GET /api/v1/market/bars?symbol=BTCUSDT&timeframe=1h&limit=abc`（预期 400）

### 4.2 Gate-2 执行

1. 启动 quantify，真实连接 Binance（REST + WS）。
2. 验证 symbols 同步、bars/quote 落库、查询可读。
3. 跑 mock 消费冒烟（strategy/ai/trading），确认 gateway 契约正常。

### 4.3 Gate-3 执行

1. 连续运行 24h（不主动重启）。
2. 每小时记录一次关键观测：
   - ws 连通/重连计数
   - latest bar age
   - gapfill 失败与恢复情况
   - 接口错误率与异常日志摘要
3. 每 5 分钟额外记录一次阈值表指标窗口值（见 4.5）。

### 4.4 Gate-4 执行

1. 汇总 1~3 Gate 证据。
2. 输出最终结论与风险清单。
3. 若存在阻塞，附回滚触发条件与操作建议。

### 4.5 验收阈值表（统一判定口径）

| 指标 | 统计窗口 | 通过阈值 | 失败阈值 | 恢复判定 |
|---|---|---|---|---|
| `market_ws_reconnect_total` 增量 | 5 分钟 | `<= 20` | 连续 3 个窗口 `> 20` | 连续 2 个窗口 `<= 20` |
| `market_latest_bar_age_ms` (BTC/ETH, 1m) | 10 分钟 | 超 `120000ms` 占比 `< 20%` | 任意 1 窗口占比 `>= 20%` 且连续 2 窗口 | 连续 2 窗口占比 `< 20%` |
| `market_gapfill_failed_total` 增量 | 10 分钟 | `<= 3` | 任意 1 窗口 `> 3` 且后续 10 分钟未回落 | 后续 10 分钟增量回到 0 |
| 数据停更时长（BTC/ETH, 1m） | 实时 | `< 10 分钟` | `>= 10 分钟` | 恢复连续更新 `>= 10 分钟` |

### 4.6 指标采集与计算规范（统一口径）

1. 时间基准：统一使用 `Asia/Shanghai (UTC+8)` 输出与归档。
2. 采样频率：每 1 分钟采样一次，写入验收记录。
3. 窗口算法：滚动窗口（sliding window），每分钟向前回看对应窗口长度（5m/10m）。
4. 数据源：
   - 优先：应用指标端点/监控系统（若已接入）。
   - 备选：结构化日志（以 `metric=` 前缀解析）。
5. 指标口径：
   - `market_ws_reconnect_total`：窗口末值减窗口初值。
   - `market_latest_bar_age_ms`：窗口内所有采样点的年龄值占比统计。
   - `market_gapfill_failed_total`：窗口末值减窗口初值。
   - 数据停更时长：相邻有效 bar 时间戳间隔累计。
6. 证据格式：每小时固定导出一次“原始采样 + 窗口统计 + 判定结果”到同一报告目录，禁止人工二次改写数值。

## 5. 失败处理与回滚准则

### 5.1 Gate 失败处理

1. Gate-1 失败：立即停止后续 Gate，修复后从 Gate-1 重跑。
2. Gate-2 失败：保留真实链路证据，修复后从 Gate-1 重跑。
3. Gate-3 失败：判定为稳定性不达标，触发回滚评估。

### 5.2 硬回滚触发条件

任一条件满足即触发回滚流程：

1. 连续 10 分钟无有效行情更新。
2. `latest_bar_age_ms` 持续超阈值且无恢复。
3. 5 分钟内 WS 重连异常飙升且持续。
4. gapfill 增量超阈值且未在 10 分钟内恢复（见 4.5）。

### 5.3 最终结论判定

1. `PASS`：4 个 Gate 全通过。
2. `CONDITIONAL PASS`：无硬阈值触发，且未闭环风险项 `<= 2` 个，并且每个风险都有明确监控与回滚触发条件。
3. `FAIL`：任一硬阈值触发，或 Gate-1/2 未通过。

## 6. 交付物

1. 验收执行记录（按 Gate）。
2. 24h 观测时间线与关键指标摘要。
3. 最终验收结论与后续动作建议（联调/灰度/回滚）。

## 7. 验收报告模板（Gate-4 输出）

1. 基本信息：日期、执行人、分支、commit SHA、环境。
2. Gate-1：命令、结果、失败项（如有）、证据路径。
3. Gate-2：真实链路联通结果、mock 冒烟矩阵结果、证据路径。
4. Gate-3：24h 时间线、阈值表逐项结论、异常与恢复记录。
5. 最终结论：`PASS` / `CONDITIONAL PASS` / `FAIL`。
6. 风险与建议：剩余风险、灰度建议、回滚触发项。
