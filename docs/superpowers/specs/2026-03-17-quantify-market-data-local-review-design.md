# Quantify 市场数据模块本地审查与验收设计（真实 market-data + mock 消费方）

日期：2026-03-17  
负责人：技术1（market-data）

## 1. 背景与目标

本设计解决的问题不是“有没有测试”，而是如何在 `apps/quantify` 中对 `market-data` 模块建立一套本地可执行、证据充分、成本可控的审查闭环，回答下面两个问题：

1. 当前代码版本下，`market-data` 自身对 Binance 的真实 REST / WS 链路是否已经打通。
2. 在其他消费方允许 mock 的前提下，是否可以证明“接口能通、数据能落库、查询结果正确”。

本次设计采用双层门禁：

1. 第一层：`0~45` 分钟内可完成的本地最小审查。
2. 第二层：提测前或联调前执行的完整验收扩展。

## 2. 边界与非目标

明确边界：

1. 目标模块仅为 `apps/quantify/src/modules/market-data`。
2. `market-data` 本体必须使用真实 Binance REST / WS 链路，不允许在该层 mock provider。
3. `strategy`、`ai`、`trading` 等消费方允许 mock，仅在第二层验收中做最小契约冒烟。
4. 第一优先成功标准是：接口能通、数据能落库、查询结果正确。

非目标：

1. 本次不设计 `market-data` 以外模块的功能正确性验收。
2. 本次不把长时间稳定性观测强塞进日常开发前检查。
3. 本次不要求为了验收而重构 `market-data` 模块实现。

## 3. 前置条件

执行本设计前，下面条件必须满足：

1. 命令均从仓库根目录执行。
2. `dx start quantify --dev` 使用 quantify 的开发环境配置。
3. Quantify 所需数据库可连接，且相关 schema 已完成 generate / migrate 或 deploy。
4. Quantify 所需 Redis 可连接。
5. 本机网络可访问 Binance public REST / WS：
   - `https://api.binance.com`
   - `wss://stream.binance.com:9443`
6. 当前执行不是在 E2E 测试注入环境里，不应存在 `.overrideProvider(MARKET_DATA_PROVIDER)` 之类的 provider override。

若前置条件不满足，结论应标记为 `BLOCKED`，而不是误记为 `FAIL`。

## 4. 方案对比

### 4.1 方案 A：纯自动化测试优先

做法：

1. 跑 `dx test unit quantify`。
2. 跑 `dx test e2e quantify apps/quantify/e2e/market-data`。
3. 少量补手工接口检查。

优点：

1. 速度最快，适合频繁回归。
2. 对现有仓库测试体系复用最高。

缺点：

1. 无法充分证明真实 Binance REST / WS 已经打通。
2. 现有 E2E 中 provider 可被 override，真实链路证据不足。

### 4.2 方案 B：双层门禁（推荐）

做法：

1. 第一层先跑现有 unit / E2E，排除代码回归。
2. 然后启动真实 `quantify`，让 `market-data` 直接连接 Binance。
3. 抽样验证 symbols 同步、quote / bar 落库、HTTP 查询结果与数据库一致。
4. 第二层再补持续观测、恢复性检查、mock 消费方契约冒烟。

优点：

1. 能同时覆盖自动化回归与真实链路正确性。
2. 第一层成本可控，适合作为开发前/提测前固定动作。
3. 第二层可以自然扩展成联调前验收，不需要再定义另一套口径。

缺点：

1. 比纯自动化测试多一段真实环境观测。
2. 第一层包含少量手工抽样，完全自动化程度较低。

### 4.3 方案 C：轻量验收化

做法：

1. 在方案 B 基础上，把恢复性、持续写入、mock 消费方契约都前置到日常流程。

优点：

1. 证据最强。

缺点：

1. 日常成本过高，不适合高频开发自查。

结论：采用方案 B。

## 5. 总体设计

### 5.1 双层门禁

#### 第一层：0~45 分钟最小审查

目标是回答：

1. 这次改动是否已经把 `market-data` 的基础正确性搞坏。
2. 当前版本的真实 Binance 链路是否能成功产出可查询数据。

特点：

1. 优先快，但不能只测到“假通”。
2. 以现有 unit / E2E 为起点。
3. 必须补真实链路启动后的数据库与 HTTP 对样。

#### 第二层：完整验收扩展

目标是回答：

1. 这版是否已经适合给其他模块联调或进入提测前阶段。

特点：

1. 在第一层全通过后再执行。
2. 增加持续观测、恢复性检查、mock 消费方最小契约冒烟。

### 5.2 审查对象

第一层固定关注下面三类证据：

1. 自动化证据：unit / E2E 是否通过。
2. 落库证据：本次真实运行后是否产生新的 `symbol / marketQuote / marketBar` 数据。
3. 查询证据：HTTP 读接口是否返回与数据库一致的数据。

第二层在此基础上增加：

1. 持续性证据：数据是否持续写入而不是只在启动瞬间成功。
2. 恢复性证据：重启后是否能重新建连并继续写入。
3. 契约证据：mock 消费方是否还能稳定消费 `market-data` 读侧契约。

## 6. 第一层设计：0~45 分钟最小审查

### 6.1 Gate 1.1：单测回归

执行：

1. `dx test unit quantify`

目标：

1. 先排除显而易见的代码回归，避免带着单测失败去看真实链路。

通过标准：

1. 命令执行成功。
2. 无新增失败用例。

### 6.2 Gate 1.2：模块 E2E 回归

执行：

1. `dx test e2e quantify apps/quantify/e2e/market-data`

目标：

1. 验证读接口、DTO 转换、排序、查询行为没有被改坏。

通过标准：

1. 命令执行成功。
2. `GET /api/v1/market/quote` 与 `GET /api/v1/market/bars` 路径通过。
3. `bars` 返回保持时间升序。

说明：

1. 这一层仍不足以证明真实 Binance 链路已通，因为现有 E2E 可 override provider。

### 6.3 Gate 1.3：真实链路启动

执行：

1. `dx start quantify --dev`

前提：

1. `market-data` provider 不做 mock，直接走 Binance production public market-data endpoints。

目标：

1. 验证 `market-data` 能完成真实初始化流程。
2. 记录本次真实运行的启动时间 `T0`，作为后续落库与查询对样的时间基线。

观察点：

1. 进程在启动后至少持续存活 2 分钟。
2. 日志中出现 `行情模块初始化完成`。
3. 日志中未出现持续性的 `交易对信息同步失败`、`历史 K 线同步失败`、`实时行情订阅失败`。
4. 后续落库记录能体现真实 source，而不是测试 source。
5. 必须确认当前运行未发生 provider override。

通过标准：

1. quantify 正常启动。
2. 进程在启动后至少持续存活 2 分钟。
3. 出现 `行情模块初始化完成` 日志。
4. Binance REST / WS 均未出现阻断性错误。
5. 无 provider override 证据，且后续落库 `source` 来自真实链路：
   - quote 允许 `BINANCE_WS`
   - bar 允许 `BINANCE_REST` 或 `BINANCE_WS`
6. 已明确记录本次运行的 `T0`。

未 mock 检查点：

1. 本 Gate 只能通过 `dx start quantify --dev` 启动真实应用，不复用 E2E `TestingModule`。
2. 不允许使用 `.overrideProvider(MARKET_DATA_PROVIDER)`。
3. 若日志、配置或代码路径显示当前 provider 非 `binance`，则本 Gate 直接失败。

### 6.4 Gate 1.4：真数据落库

目标：

1. 确认不是“接口空跑”，而是真实写入了新的市场数据。

抽样建议：

1. 固定检查 `BTCUSDT`。
2. 如有时间可增加 `ETHUSDT`。
3. 每个 symbol 最长等待时间为 5 分钟；若 `BTCUSDT` 在 5 分钟内无数据，再切换 `ETHUSDT` 复核一次。

检查对象：

1. `symbol`
2. `marketQuote`
3. `marketBar`

通过标准：

1. 目标 symbol 在数据库存在。
2. 在 `T0` 后 60 秒内，可以观察到至少 1 条 `source='BINANCE_WS'` 的新 `marketQuote` 记录。
3. 在 `T0` 后 5 分钟内，可以观察到至少 1 条 `source in ('BINANCE_REST', 'BINANCE_WS')` 的新 `marketBar` 记录。
4. `marketQuote` 的“本次写入证据”以 `eventTime >= T0` 或 `createdAt >= T0` 为准。
5. `marketBar` 的“本次写入证据”以 `createdAt >= T0` 或 `updatedAt >= T0` 为准，不使用 `time >= T0` 作为判定依据。
6. 若数据库已有历史数据，必须用 `T0` + `createdAt/updatedAt` 区分本次新写入与历史残留旧数据。

### 6.5 Gate 1.5：HTTP 查询与数据库对样

接口抽样：

1. `GET /api/v1/market/quote?symbol=BTCUSDT`
2. `GET /api/v1/market/bars?symbol=BTCUSDT&timeframe=1h&limit=10`

目标：

1. 证明接口返回的是刚落库的真实数据，而不是旧缓存、空值或错误拼装。

通过标准：

1. 接口返回 `200`。
2. `quote.lastPrice` 能对应数据库中 `eventTime >= T0` 的最新 quote 记录。
3. `bars` 返回数组时间升序。
4. 返回条数 `<= limit`。
5. 抽样对比时，最新 bar 的时间与 OHLC 能与数据库中对应记录匹配。
6. quote / bars 返回中的 `source` 与数据库记录一致。

### 6.6 Gate 1.6：参数健壮性

接口抽样：

1. `GET /api/v1/market/bars?symbol=BTCUSDT&timeframe=1h&limit=10`
2. `GET /api/v1/market/bars?symbol=BTCUSDT&timeframe=1h&limit=abc`
3. `GET /api/v1/market/bars?symbol=BTCUSDT&timeframe=abc&limit=10`
4. `GET /api/v1/market/quote?symbol=NOTEXIST`

目标：

1. 验证错误被正确拦在 DTO / 领域层，而不是掉成裸 `500`。

固定口径：

1. 合法 timeframe 集合为：`1m`、`5m`、`15m`、`1h`、`4h`、`1d`。
2. DTO / class-validator 校验失败返回 `400`。
3. `DomainException` 默认返回 `400`，响应体包含 `status`、`error.code`、`timestamp`、`path`。

通过标准：

1. `limit=10` 返回 `200`。
2. `limit=abc` 返回 `400`，不返回 `500`。
3. `timeframe=abc` 返回 `400`，属于 DTO 校验失败。
4. `symbol=NOTEXIST` 返回 `400`，且 `error.code = MARKET_SYMBOL_NOT_FOUND`。
5. 上述错误场景均不得返回裸 `500`。

### 6.7 第一层结论规则

全局结论枚举：

1. `BLOCKED`
2. `PASS`
3. `FAIL`

判定顺序：

1. 若第 3 节前置条件任一不满足，则整轮审查直接记为 `BLOCKED`，不进入 Gate 1.1 ~ 1.6。
2. 仅当前置条件满足时，第一层才使用 `PASS / FAIL`。

第一层判定规则：

1. 只要 Gate 1.1 ~ 1.6 全部满足，即为 `PASS`。
2. 任一 Gate 未满足，即为 `FAIL`。
3. 第一层不设 `CONDITIONAL PASS`，避免“已经正确”的结论被模糊化。

## 7. 第二层设计：完整验收扩展

### 7.1 适用场景

第二层只在下面场景执行：

1. 提测前
2. 联调前
3. 准备进入更长时间稳定性观测前

### 7.2 扩展检查项

在第一层基础上增加：

1. 持续观测 `30~120` 分钟，确认 quote / bar 持续写入。
2. 执行一次服务重启，确认重启后能重新建连与继续落库。
3. 对 `BTCUSDT`、`ETHUSDT` 做重复抽样，确认查询结果始终与数据库一致。
4. 对 `strategy`、`ai`、`trading` 的 mock 消费方做最小契约冒烟。

mock 消费方最小契约冒烟固定为：

1. `strategy-signals`
   - 用例：读取 `BTCUSDT/1h` recent bars，`limit=50`
   - 通过标准：返回 bars 非空、时间升序、无 `DomainException`
   - 执行入口：新增或固定一条专用单测，建议路径为 `apps/quantify/src/modules/strategy-signals/services/__tests__/signal-generator.market-data-gateway.spec.ts`
2. `strategy-instances`
   - 用例：构建 debug payload 时读取 `BTCUSDT/1h` bars
   - 通过标准：payload 中 bars 非空，且最新 bar 时间不倒序
   - 执行入口：现有 [strategy-instances-mode.spec.ts](/Users/zengmengdan/coinfulx-new/stats/apps/quantify/src/modules/strategy-instances/services/__tests__/strategy-instances-mode.spec.ts) 或同目录新增专用 smoke spec
3. `ai`
   - 用例：`getMarketDataRaw(symbol=BTCUSDT,timeframe=1h,lookbackBars=50)`
   - 通过标准：返回 bars 数组，`timestamp` 严格递增
   - 执行入口：现有 [llm-v3-tools.gateway.spec.ts](/Users/zengmengdan/coinfulx-new/stats/apps/quantify/src/modules/ai/__tests__/llm-v3-tools.gateway.spec.ts)
4. `trading`（mock）
   - 用例：消费最新 quote 作为下单前价格输入
   - 通过标准：可读取 `lastPrice`，并完成 mock 校验流程，不触发真实下单
   - 执行入口：新增 trading mock smoke spec，建议路径为 `apps/quantify/src/modules/trading/__tests__/trading-market-data-smoke.spec.ts`

### 7.3 第二层结论规则

结论分四类：

1. `BLOCKED`
2. `PASS`
3. `CONDITIONAL PASS`
4. `FAIL`

判定规则：

1. 若第 3 节前置条件在第二层执行时不满足，则记为 `BLOCKED`。
2. `PASS`：第一层通过，且持续观测、恢复性检查、mock 消费方冒烟都通过。
3. `CONDITIONAL PASS`：第一层通过，且不存在阻断性正确性问题，但第二层仅剩不超过 2 个非阻塞风险；每个风险都必须具备：
   - 对应监控项
   - 触发阈值
   - 明确回滚动作
4. `FAIL`：正确性未通过，或持续运行中暴露出阻断性问题。

非阻塞风险示例：

1. 偶发单次 WS 重连，但可自动恢复，且后续数据持续写入。
2. 单次 gapfill 失败后在下一轮恢复，且未影响查询正确性。

## 8. 推荐执行顺序与命令

### 8.1 第一层推荐顺序

1. `dx test unit quantify`
2. `dx test e2e quantify apps/quantify/e2e/market-data`
3. `dx start quantify --dev`
4. 手工接口抽样：
   - `GET /api/v1/market/quote?symbol=BTCUSDT`
   - `GET /api/v1/market/bars?symbol=BTCUSDT&timeframe=1h&limit=10`
   - `GET /api/v1/market/bars?symbol=BTCUSDT&timeframe=1h&limit=abc`
5. 数据库对样：
   - `symbol`
   - `marketQuote`
   - `marketBar`

### 8.2 第二层推荐顺序

1. 完整执行第一层。
2. 持续观察 `30~120` 分钟。
3. 执行一次服务重启恢复检查。
4. 跑 mock 消费方最小契约冒烟。
5. 汇总结果并输出结论。

## 9. 记录模板

每次执行至少记录：

1. 日期时间
2. 分支名
3. commit SHA
4. 本次运行启动时间 `T0`
5. 第一层各 Gate 结果
6. 抽样 symbol
7. 接口返回摘要
8. 数据库对样摘要
9. 若执行第二层，则补持续观测与恢复性结果

记录原则：

1. 只保留能支撑结论的最小证据，不做过重报告系统。
2. 失败时必须明确是自动化失败、真实链路失败，还是查询与落库不一致。

## 10. 日常使用方式

建议固定拆成两个使用场景：

1. 日常开发 / 改动后自查：只跑第一层。
2. 提测前 / 联调前 / 准上线前：第一层通过后再跑第二层。

这样定义的好处：

1. 第一层回答“这次改动是否已经把 `market-data` 基本正确性搞坏”。
2. 第二层回答“这版是否更适合给别人联调或继续推进”。

## 11. 风险与取舍

风险：

1. 第一层仍包含手工抽样，不是完全自动化。
2. 如果数据库残留历史数据而未区分启动窗口，容易误判“已经落库”。
3. 只抽样单个 symbol 时，可能漏掉个别 symbol 特有问题。

缓解：

1. 固定至少检查当前启动窗口内的新记录。
2. 默认抽样 `BTCUSDT`，有余力时补 `ETHUSDT`。
3. 将“持续观测、恢复性、mock 消费方契约”明确后移到第二层，避免第一层过重。
