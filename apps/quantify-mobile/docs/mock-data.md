# Mock 数据规格

本文档记录 `quantify-mobile` 在 `USE_MOCK` 模式下各 Repository 的数据形状、刷新策略与
真实 API 接入后的对齐要点。

## 启动开关

- 编译期常量：`String.fromEnvironment('USE_MOCK', defaultValue: 'false')`
- 解析策略：**严格只认 `false`（不区分大小写）为真实模式**；缺省值等价于真实模式，
  只有显式传入其它值才启用 mock。
- 默认真实模式：`flutter run`
- 显式 mock 模式：`flutter run --dart-define=USE_MOCK=true`
- 真实模式下，repository provider 必须装配 `Api*Repository`。API repository 不得 import
  `lib/data/mock/fixtures/**` 作为长期业务兜底；真实空响应应返回空态或错误态。

## 当前进度

当前默认 `useMock=false`，移动端走真实 API repository；`USE_MOCK=true` 才走
`MockXxxRepository` 与 fixtures。mock 数据继续保留，用于离线开发、widget 原型和确定性测试。
真实模式防回退由 `test/data/providers_test.dart` 覆盖：provider 矩阵需返回 API 实现，
`lib/data/api` 不得依赖 mock fixtures，空响应不展示 mock fixture 行。

通用模式：
- `Future` 方法：固定 `Future.delayed(Duration(milliseconds: 200))` 模拟网络延迟
- `Stream` 方法：优先使用 `Stream<T>.periodic(...)`；订阅取消时底层 `Timer` 自动释放
- 需要确定性的位置（K 线漂移、巨鲸抽样）统一使用 `Random(42)` 种子

## Repository 列表

### AuthRepository

- **形状**：`AuthSession { userId, token, email }`
- **策略**：
  - `login`：任意 `email` / `password` 200ms 延迟后返回固定
    `AuthSession(userId: 'mock-user', token: 'mock-token', email: <输入>)`
  - `logout`：清空内存 session
  - `watchSession`：通过 `StreamController.broadcast()` 推送；订阅时先 `yield` 当前 session
- **真实 API 对齐**：接入后 `userId` / `token` 来自后端响应；保持 `Stream<AuthSession?>`
  在登入/登出时序的等价行为

### Stream 语义约定

> Mock 阶段全局规范，避免后续 10 个 Repository 重复写脆弱的 `async*` 拼装。

- **订阅即推当前值**：`watchSession` 等返回 `Stream` 的方法，订阅时应先发送当前内部状态，
  再接转 `StreamController.broadcast()`。当前 `MockAuthRepository.watchSession()` 用
  `yield _session; yield* _controller.stream;` 实现，`yield` 与 `yield*` 之间存在极小事件窗口
  （测试以 `Future.delayed(Duration.zero)` 让出 microtask 规避）。PR2 会引入统一 helper
  （形如 `seededBroadcast(initial, controller)`）消除该模式重复
- **Unimplemented 阶段的 Stream 错误传播**：`Unimplemented*Repository` 在 Stream-returning
  方法上**同步抛** `UnimplementedError`（不是返回 `Stream.error(...)` 异步派发）。这是占位
  阶段的简化语义；PR2 接入真实 API 后，Stream 错误应改走 `controller.addError(...)` 异步派发
  以符合常规 Dart Stream 错误模型

### TickerRepository

- **形状**：`Ticker { symbol, price, changePercent, volume24h }`
- **策略**：
  - `listTickers`：返回 `fixtures/tickers.dart` 中的 8 条静态行情
  - `watchTicker(symbol)`：`Stream.periodic(1s)` 推送基于 `Random(42)` 的微小价格漂移
  - **未知 symbol 回退**：`watchTicker` 在 mock 中未匹配 `mockTickers` 时回退第一条
- **真实 API 对齐**：接入后改走 `GET /markets/tickers` + WebSocket ticker 通道

### KlineRepository

- **形状**：`Candle { openTime, open, high, low, close, volume }` + `KlineInterval`
- **策略**：
  - `listCandles`：`generateSeededCandles(...)` 从 `kCandleBaselinePrice` 起点用
    `Random(42)` 走 `count` 步随机游走（每根 ±0.6%，spread ±0.3%）
  - `watchCandles`：`Stream.periodic(1s)` 调用 `nextSeededCandle(last, ...)` 推
    下一根；`openTime` 按 `interval` 步长严格递增
  - **mock 阶段 `symbol` 被忽略**：watchCandles 起点为 `baseline` 单根序列的末尾，
    不接续 `listCandles` 的最后一根；这是 mock 简化，真实 API 接入后两者必须连续
- **Stream 节奏**：`Stream.periodic(Duration(seconds: 1))`
- **真实 API 对齐**：接入后 `listCandles` 走 REST 历史 K 线接口；
  `watchCandles` 切换到行情 WebSocket 的 K 线通道

### OrderbookRepository

- **形状**：`OrderbookSnapshot { symbol, bids[], asks[], timestamp }`
- **策略**：
  - `getSnapshot(symbol)`：以 `mockTickers` 对应 ticker 的 price 作 mid，
    `buildMockOrderbook(...)` 生成 10 档对称买卖盘
  - `watchOrderbook(symbol)`：`Stream.periodic(1s)` 每秒推送一份新时间戳的快照
  - **未知 symbol 回退**：`getSnapshot/watchOrderbook` 在 `mockTickers` 未命中时回退第一条
- **真实 API 对齐**：接入后切换到聚合盘口 WebSocket

### LongShortRepository

- **形状**：`LongShortRatio { symbol, longRatio, shortRatio, timestamp }`
- **策略**：`getRatio(symbol, interval)` 从 `mockLongShortBySymbol` 查表；
  未命中回退 `0.5/0.5`
- **真实 API 对齐**：接入后改走 `GET /markets/long-short` 系列接口

### WhaleFeedRepository

- **形状**：`WhaleEvent { id, symbol, amountUsd, direction, from/toLabel, timestamp }`
- **策略**：
  - `listRecent(limit)`：取 `mockWhaleEvents` 前 `min(limit, total)` 条
  - `watchFeed`：`Stream.periodic(3s)` 用 `Random(42)` 从 pool 抽样推送
- **Stream 节奏**：`Stream.periodic(Duration(seconds: 3))`
- **真实 API 对齐**：接入后切换到 `whale-alert` SSE/WebSocket 推送

### StrategyRepository

- **形状**：`StrategyCard { id, name, description, pnlPercent, subscribers, tags }`
- **策略**：`listFeatured` / `listMine` / `getDetail` 直接返回
  `mockFeaturedStrategies` / `mockMyStrategies`；`getDetail` 在合集中按 id 查找，
  未命中回退第一条
- **真实 API 对齐**：接入后由 quantify `strategy-plaza` / `strategy-subscriptions` 模块提供

### AiChatRepository

- **形状**：`ChatTurn { id, role, content, timestamp }` + `BacktestSummary`
- **策略**：
  - `sendMessage(turn)`：把入参与 mock 助手回复都 push 进内部 `broadcast`
    `StreamController`，返回助手回复
  - `watchSession(sessionId)`：订阅时先 yield `mockChatTurns` 历史会话，
    再接转 controller
  - **mock 阶段单会话**：`sessionId` 被忽略，所有调用共享同一 `broadcast` controller；
    真实 API 接入时按 sessionId 路由
  - `latestBacktest`：返回 `mockLatestBacktestSummary`
- **真实 API 对齐**：接入后由 quantify `ai` / `llm-strategies` 模块提供

### BacktestRepository

- **形状**：`BacktestRequest` / `BacktestResult { ..., equityCurve }`
- **策略**：`run(request)` / `getResult(id)` 一律返回 `mockBacktestResult`
- **真实 API 对齐**：接入后走 quantify `backtesting` 模块的回测任务接口

### AccountRepository

- **形状**：`AccountInfo { userId, totalEquityUsd, availableBalanceUsd, unrealizedPnlUsd }`
- **策略**：`getInfo` 返回 `mockAccountInfo`；`watchInfo` 用 `Stream.periodic(5s)`
  推同一份快照
- **真实 API 对齐**：接入后由 quantify `accounts` 模块提供 REST + WebSocket

### ApiKeyRepository

- **形状**：`ExchangeApiKey { id, exchange, label, maskedKey, createdAt }`
- **策略**：内存 list 持有 `mockApiKeys` 副本；`listKeys` 返回 unmodifiable 视图；
  `addKey` / `removeKey` 直接在内存上修改
- **真实 API 对齐**：接入后由 quantify `exchange-accounts` 模块提供
